import os
import time
from datetime import date

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query

from core.security import get_current_user

router = APIRouter(prefix="/api/eco-calendar", tags=["eco_calendar"])

_FRED_RELEASE_DATES_URL = "https://api.stlouisfed.org/fred/releases/dates"
_CACHE_TTL = 1800  # 30 minutes
_cache: dict[str, tuple[float, list[dict]]] = {}


def _parse_date(value: str) -> date:
    try:
        parsed = date.fromisoformat(value)
        if parsed.isoformat() != value:
            raise ValueError
        return parsed
    except ValueError:
        raise HTTPException(422, "Dates attendues au format AAAA-MM-JJ") from None


def _to_event(release: dict) -> dict | None:
    release_date = release.get("date")
    release_name = release.get("release_name")
    if not isinstance(release_date, str) or not isinstance(release_name, str) or not release_name.strip():
        return None
    try:
        _parse_date(release_date)
    except HTTPException:
        return None

    # FRED publishes a date, but no precise time, consensus, result or impact.
    return {
        "actual": None,
        "country": "",
        "estimate": None,
        "event": release_name,
        "impact": "unknown",
        "prev": None,
        "time": f"{release_date} 00:00:00",
        "time_known": False,
        "unit": "",
    }


@router.get("")
async def get_eco_calendar(
    from_date: str = Query(..., alias="from"),
    to_date: str = Query(..., alias="to"),
    user: dict = Depends(get_current_user),
):
    start, end = _parse_date(from_date), _parse_date(to_date)
    if end < start or (end - start).days > 31:
        raise HTTPException(422, "La période doit couvrir entre 1 et 32 jours")

    api_key = os.environ.get("FRED_API_KEY", "")
    if not api_key:
        raise HTTPException(503, "FRED_API_KEY non configurée")

    cache_key = f"{from_date}_{to_date}"
    now = time.time()
    cached = _cache.get(cache_key)
    if cached and now - cached[0] < _CACHE_TTL:
        return cached[1]

    events = []
    offset = 0
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            while True:
                response = await client.get(
                    _FRED_RELEASE_DATES_URL,
                    params={
                        "api_key": api_key,
                        "file_type": "json",
                        # FRED's real-time window also bounds release dates in
                        # this endpoint. Filter the returned dates again below.
                        "realtime_start": from_date,
                        "realtime_end": to_date,
                        "include_release_dates_with_no_data": "true",
                        "limit": 1000,
                        "offset": offset,
                        "sort_order": "desc",
                    },
                )
                if response.status_code in (400, 401, 403):
                    try:
                        message = str(response.json().get("error_message", ""))
                    except (ValueError, AttributeError):
                        message = ""
                    if response.status_code in (401, 403) or "api_key" in message.lower():
                        raise HTTPException(503, "Clé FRED invalide")
                if response.status_code != 200:
                    raise HTTPException(502, f"Erreur FRED: {response.status_code}")

                payload = response.json()
                if not isinstance(payload, dict):
                    raise HTTPException(502, "Réponse FRED inattendue")
                releases = payload.get("release_dates")
                if not isinstance(releases, list):
                    raise HTTPException(502, "Réponse FRED inattendue")
                reached_older_dates = False
                for release in releases:
                    if not isinstance(release, dict):
                        continue
                    event = _to_event(release)
                    if not event:
                        continue
                    release_date = event["time"][:10]
                    if release_date < from_date:
                        reached_older_dates = True
                        break
                    if release_date <= to_date:
                        events.append(event)

                offset += len(releases)
                if reached_older_dates or not releases or offset >= int(payload.get("count", offset)):
                    break
    except HTTPException:
        raise
    except (httpx.HTTPError, ValueError, TypeError):
        # Avoid including the request URL in the error: it contains the API key.
        raise HTTPException(502, "FRED inaccessible ou réponse invalide") from None

    events.sort(key=lambda event: (event["time"], event["event"]))
    _cache[cache_key] = (now, events)
    return events
