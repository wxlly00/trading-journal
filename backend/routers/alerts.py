from fastapi import APIRouter, Depends
from core.security import get_current_user
from db.supabase import get_client

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


def _to_api(row: dict) -> dict:
    """Map DB row to API response (active -> enabled)."""
    return {**row, "enabled": row.get("active", True)}


@router.get("")
async def list_alerts(account_id: str, user: dict = Depends(get_current_user)):
    db = get_client()
    rows = db.table("alerts").select("*").eq("account_id", account_id).eq("user_id", user["sub"]).execute().data
    return [_to_api(r) for r in rows]


@router.post("")
async def create_alert(payload: dict, user: dict = Depends(get_current_user)):
    db = get_client()
    data = {
        "account_id": payload["account_id"],
        "type": payload["type"],
        "threshold": payload["threshold"],
        "email": payload.get("email", ""),
        "active": payload.get("enabled", True),
        "user_id": user["sub"],
    }
    row = db.table("alerts").insert(data).execute().data[0]
    return _to_api(row)


@router.patch("/{alert_id}")
async def update_alert(alert_id: str, payload: dict, user: dict = Depends(get_current_user)):
    db = get_client()
    data = {}
    if "enabled" in payload:
        data["active"] = payload["enabled"]
    if "threshold" in payload:
        data["threshold"] = payload["threshold"]
    if data:
        db.table("alerts").update(data).eq("id", alert_id).eq("user_id", user["sub"]).execute()
    return {"ok": True}


@router.delete("/{alert_id}")
async def delete_alert(alert_id: str, user: dict = Depends(get_current_user)):
    db = get_client()
    db.table("alerts").delete().eq("id", alert_id).eq("user_id", user["sub"]).execute()
    return {"ok": True}
