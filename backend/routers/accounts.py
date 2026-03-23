from fastapi import APIRouter, Depends
from core.security import get_current_user, generate_api_key
from db.supabase import get_client

router = APIRouter(prefix="/api/accounts", tags=["accounts"])


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
