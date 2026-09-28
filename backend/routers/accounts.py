from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException
from core.security import get_current_user, generate_api_key, verify_api_key
from db.supabase import get_client

router = APIRouter(prefix="/api/accounts", tags=["accounts"])


@router.post("/heartbeat")
async def mt5_heartbeat(account: dict = Depends(verify_api_key)):
    """The EA calls this once a minute even when no trades are opened."""
    db = get_client()
    db.table("accounts").update({"last_seen_at": datetime.now(timezone.utc).isoformat()}).eq("id", account["id"]).execute()
    return {"ok": True}


@router.get("")
async def list_accounts(user: dict = Depends(get_current_user)):
    db = get_client()
    return db.table("accounts").select("id,name,broker,account_number,initial_capital,currency,is_live,created_at").eq("user_id", user["sub"]).execute().data


@router.post("")
async def create_account(payload: dict, user: dict = Depends(get_current_user)):
    db = get_client()
    raw_key, key_hash = generate_api_key()
    data = {**payload, "user_id": user["sub"], "api_key_hash": key_hash}
    r = db.table("accounts").insert(data).execute()
    return {**r.data[0], "api_key": raw_key}


@router.get("/{account_id}")
async def get_account(account_id: str, user: dict = Depends(get_current_user)):
    db = get_client()
    r = db.table("accounts").select("id,name,broker,account_number,initial_capital,currency,is_live").eq("id", account_id).eq("user_id", user["sub"]).execute()
    return r.data[0] if r.data else {}


@router.get("/{account_id}/mt5-status")
async def get_mt5_status(account_id: str, user: dict = Depends(get_current_user)):
    db = get_client()
    r = (db.table("accounts")
         .select("last_seen_at,imported_trades_count")
         .eq("id", account_id)
         .eq("user_id", user["sub"])
         .execute())
    if not r.data:
        raise HTTPException(status_code=404, detail="Compte introuvable")
    account = r.data[0]
    last_seen_at = account["last_seen_at"]
    state = "never_connected"
    if last_seen_at:
        last_seen = datetime.fromisoformat(last_seen_at.replace("Z", "+00:00"))
        state = "active" if datetime.now(timezone.utc) - last_seen <= timedelta(minutes=3) else "inactive"
    return {
        "state": state,
        "last_seen_at": last_seen_at,
        "imported_trades_count": account["imported_trades_count"],
    }


@router.patch("/{account_id}")
async def update_account(account_id: str, payload: dict, user: dict = Depends(get_current_user)):
    db = get_client()
    allowed = {"name", "broker", "account_number", "initial_capital", "currency", "is_live"}
    data = {k: v for k, v in payload.items() if k in allowed}
    db.table("accounts").update(data).eq("id", account_id).eq("user_id", user["sub"]).execute()
    return {"ok": True}


@router.post("/{account_id}/rotate-key")
async def rotate_key(account_id: str, user: dict = Depends(get_current_user)):
    db = get_client()
    raw_key, key_hash = generate_api_key()
    db.table("accounts").update({"api_key_hash": key_hash}).eq("id", account_id).eq("user_id", user["sub"]).execute()
    return {"api_key": raw_key}
