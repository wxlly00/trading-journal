import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from core.security import get_current_user, verify_api_key
from db.supabase import get_client
from services.calculator import enrich_trade
from services.storage import upload_screenshot

router = APIRouter(prefix="/api/trades", tags=["trades"])


@router.post("/ingest")
async def ingest_trade(payload: dict, account: dict = Depends(verify_api_key)):
    db = get_client()
    data = {**payload, "account_id": account["id"], "user_id": account["user_id"]}
    if data.get("status") == "closed":
        data = enrich_trade(data)

    existing = db.table("trades").select("id").eq("account_id", account["id"]).eq("ticket", data["ticket"]).execute()
    if existing.data:
        trade_id = existing.data[0]["id"]
        db.table("trades").update(data).eq("id", trade_id).execute()
    else:
        db.table("trades").insert(data).execute()

    try:
        from services.alerts import check_alerts
        await check_alerts(account["id"], account["user_id"])
    except Exception:
        pass

    return {"ok": True}


@router.get("")
async def list_trades(
    account_id: str,
    symbol: str | None = None,
    status: str | None = None,
    session: str | None = None,
    direction: str | None = None,
    page: int = 1,
    limit: int = 50,
    user: dict = Depends(get_current_user),
):
    db = get_client()
    q = db.table("trades").select("*").eq("account_id", account_id).eq("user_id", user["sub"])
    if symbol:
        q = q.eq("symbol", symbol)
    if status:
        q = q.eq("status", status)
    if session:
        q = q.eq("session", session)
    if direction:
        q = q.eq("type", direction)
    q = q.order("open_time", desc=True).range((page - 1) * limit, page * limit - 1)
    return q.execute().data


@router.get("/{trade_id}")
async def get_trade(trade_id: str, user: dict = Depends(get_current_user)):
    db = get_client()
    r = db.table("trades").select("*").eq("id", trade_id).eq("user_id", user["sub"]).execute()
    if not r.data:
        raise HTTPException(404)
    return r.data[0]


@router.patch("/{trade_id}")
async def update_trade(trade_id: str, payload: dict, user: dict = Depends(get_current_user)):
    db = get_client()
    allowed = {"note", "tags", "psy_score"}
    data = {k: v for k, v in payload.items() if k in allowed}
    db.table("trades").update(data).eq("id", trade_id).eq("user_id", user["sub"]).execute()
    return {"ok": True}


@router.post("/{trade_id}/screenshot")
async def upload_screenshot_endpoint(
    trade_id: str,
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    if file.content_type not in ("image/jpeg", "image/png", "image/webp"):
        raise HTTPException(400, "Format non supporté (JPEG/PNG/WEBP)")
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(400, "Fichier trop grand (max 10MB)")
    url = upload_screenshot(user["sub"], trade_id, content, file.content_type, file.filename or "screenshot.jpg")
    db = get_client()
    db.table("trades").update({"screenshot_url": url}).eq("id", trade_id).eq("user_id", user["sub"]).execute()
    return {"url": url}
