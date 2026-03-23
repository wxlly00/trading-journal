from fastapi import APIRouter, Depends
from core.security import get_current_user
from db.supabase import get_client

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


@router.get("")
async def list_alerts(account_id: str, user: dict = Depends(get_current_user)):
    db = get_client()
    return db.table("alerts").select("*").eq("account_id", account_id).eq("user_id", user["sub"]).execute().data


@router.post("")
async def create_alert(payload: dict, user: dict = Depends(get_current_user)):
    db = get_client()
    data = {**payload, "user_id": user["sub"]}
    return db.table("alerts").insert(data).execute().data[0]


@router.delete("/{alert_id}")
async def delete_alert(alert_id: str, user: dict = Depends(get_current_user)):
    db = get_client()
    db.table("alerts").delete().eq("id", alert_id).eq("user_id", user["sub"]).execute()
    return {"ok": True}
