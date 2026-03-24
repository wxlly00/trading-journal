import os
import time
import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from core.security import get_current_user

router = APIRouter(prefix="/api/eco-calendar", tags=["eco_calendar"])

# Simple in-memory cache: {cache_key: (timestamp, data)}
_cache: dict[str, tuple[float, list]] = {}
_CACHE_TTL = 1800  # 30 minutes


@router.get("")
async def get_eco_calendar(
    from_date: str = Query(..., alias="from"),
    to_date: str = Query(..., alias="to"),
    user: dict = Depends(get_current_user),
):
    api_key = os.environ.get("FINNHUB_API_KEY", "")
    if not api_key:
        raise HTTPException(503, "FINNHUB_API_KEY non configurée")

    cache_key = f"{from_date}_{to_date}"
    now = time.time()
    if cache_key in _cache:
        ts, data = _cache[cache_key]
        if now - ts < _CACHE_TTL:
            return data

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(
                "https://finnhub.io/api/v1/calendar/economic",
                params={"from": from_date, "to": to_date, "token": api_key},
            )
        if r.status_code == 401:
            raise HTTPException(401, "Clé Finnhub invalide")
        if r.status_code != 200:
            raise HTTPException(502, f"Erreur Finnhub: {r.status_code}")
        events = r.json().get("economicCalendar", [])
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(502, f"Finnhub inaccessible: {str(e)}")

    _cache[cache_key] = (now, events)
    return events
