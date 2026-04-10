import uuid
import csv
import io
import random
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from core.security import get_current_user, verify_api_key
from db.supabase import get_client
from services.calculator import enrich_trade, calc_rr
from services.storage import upload_screenshot

router = APIRouter(prefix="/api/trades", tags=["trades"])


_INGEST_ALLOWED = {
    "ticket", "symbol", "type", "open_time", "close_time",
    "open_price", "close_price", "volume", "profit", "commission",
    "swap", "sl", "tp", "status", "magic", "comment",
}

@router.post("/ingest")
async def ingest_trade(payload: dict, account: dict = Depends(verify_api_key)):
    db = get_client()
    # Allowlist fields to prevent mass-assignment from rogue EA scripts
    data = {k: payload[k] for k in _INGEST_ALLOWED if k in payload}
    data["account_id"] = account["id"]
    data["user_id"] = account["user_id"]
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


@router.post("/create")
async def create_trade(payload: dict, user: dict = Depends(get_current_user)):
    db = get_client()

    account_id = payload.get("account_id")
    if not account_id:
        raise HTTPException(400, "account_id requis")

    acc = db.table("accounts").select("id").eq("id", account_id).eq("user_id", user["sub"]).execute()
    if not acc.data:
        raise HTTPException(403, "Compte introuvable")

    allowed = [
        "account_id", "symbol", "type", "open_time", "close_time",
        "open_price", "close_price", "volume", "profit", "commission",
        "swap", "sl", "tp", "status", "note",
    ]
    data: dict = {k: payload[k] for k in allowed if k in payload}
    data["user_id"] = user["sub"]
    data["account_id"] = account_id
    # Ticket fictif négatif pour les trades saisis manuellement
    if "ticket" not in data:
        data["ticket"] = -random.randint(1, 2_147_483_647)
    data = enrich_trade(data)

    result = db.table("trades").insert(data).execute()
    if not result.data:
        raise HTTPException(500, "Échec de la création")

    trade = result.data[0]
    trade.setdefault("lots", trade.get("volume"))
    return trade


@router.get("")
async def list_trades(
    account_id: str,
    symbol: str | None = None,
    status: str | None = None,
    session: str | None = None,
    direction: str | None = None,
    result: str | None = None,
    from_: str | None = Query(default=None, alias="from"),
    to: str | None = None,
    offset: int = 0,
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
    if from_:
        q = q.gte("close_time", from_)
    if to:
        q = q.lte("close_time", to)
    if result == "win":
        q = q.gt("pnl_net", 0)
    elif result == "loss":
        q = q.lt("pnl_net", 0)
    q = q.order("open_time", desc=True).range(offset, offset + limit - 1)
    trades = q.execute().data
    for t in trades:
        t.setdefault("lots", t.get("volume"))
    return trades


@router.get("/search")
async def search_trades(q: str = "", user: dict = Depends(get_current_user)):
    if not q or len(q) < 2:
        return []
    # Sanitize: alphanumeric + space + common FX chars only (prevents PostgREST injection)
    import re
    q_safe = re.sub(r"[^a-zA-Z0-9 _/\-]", "", q)[:50]
    if not q_safe:
        return []
    db = get_client()
    acc_res = db.table("accounts").select("id").eq("user_id", user["sub"]).execute()
    account_ids = [a["id"] for a in acc_res.data]
    if not account_ids:
        return []
    res = (
        db.table("trades")
        .select("id,symbol,type,profit,open_time,account_id")
        .in_("account_id", account_ids)
        .or_(f"symbol.ilike.%{q_safe}%,note.ilike.%{q_safe}%")
        .order("open_time", desc=True)
        .limit(20)
        .execute()
    )
    return res.data


@router.get("/{trade_id}")
async def get_trade(trade_id: str, user: dict = Depends(get_current_user)):
    db = get_client()
    r = db.table("trades").select("*").eq("id", trade_id).eq("user_id", user["sub"]).execute()
    if not r.data:
        raise HTTPException(404)
    trade = r.data[0]
    trade.setdefault("lots", trade.get("volume"))
    return trade


@router.patch("/{trade_id}")
async def update_trade(trade_id: str, payload: dict, user: dict = Depends(get_current_user)):
    db = get_client()
    data = {}
    if "note" in payload:
        data["note"] = payload["note"]
    if "psy_score" in payload:
        data["psy_score"] = payload["psy_score"]
    if "tags" in payload:
        data["tags"] = payload["tags"]
    if "tag" in payload:
        data["tags"] = [payload["tag"]] if payload["tag"] else []
    if "sl" in payload:
        data["sl"] = payload["sl"]
    if "tp" in payload:
        data["tp"] = payload["tp"]

    # Recalculate R:R when SL is updated
    if "sl" in payload and payload["sl"] is not None:
        r = db.table("trades").select("type, open_price, close_price").eq("id", trade_id).eq("user_id", user["sub"]).execute()
        if r.data:
            t = r.data[0]
            if t.get("open_price") and t.get("close_price"):
                data["rr_realized"] = calc_rr(
                    t.get("type", "buy"),
                    float(t["open_price"]),
                    float(t["close_price"]),
                    float(payload["sl"]),
                )

    if data:
        db.table("trades").update(data).eq("id", trade_id).eq("user_id", user["sub"]).execute()
    return {"ok": True}


def _parse_mt5_time(s: str) -> str | None:
    """Parse MT5 datetime formats to ISO."""
    for fmt in ("%Y.%m.%d %H:%M:%S", "%Y.%m.%d %H:%M", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(s.strip(), fmt).replace(tzinfo=timezone.utc).isoformat()
        except ValueError:
            pass
    return None


def _parse_mt5_csv(content: str) -> list[dict]:
    """Parse MT5 account history CSV (deals format, tab or semicolon separated)."""
    lines = [l for l in content.splitlines() if l.strip() and not l.startswith('#')]
    if not lines:
        return []

    delim = '\t' if '\t' in lines[0] else (';' if ';' in lines[0] else ',')
    reader = csv.DictReader(lines, delimiter=delim)

    deals: list[dict] = []
    for row in reader:
        row = {k.strip().lower(): v.strip() for k, v in row.items() if k}
        t = row.get('type', row.get('deal type', '')).lower()
        if t in ('balance', 'credit', 'deposit', 'withdrawal', ''):
            continue
        deals.append(row)

    positions: dict[str, dict] = {}
    trades: list[dict] = []

    for d in deals:
        direction = d.get('dir', d.get('direction', d.get('entry', ''))).lower()
        order_id = d.get('order', d.get('position', d.get('deal', '')))
        symbol = d.get('symbol', '')
        trade_type = d.get('type', 'buy').lower()
        volume = float(d.get('volume', 0) or 0)
        price = float(d.get('price', 0) or 0)
        commission = float(d.get('commission', 0) or 0)
        swap = float(d.get('swap', 0) or 0)
        profit = float(d.get('profit', 0) or 0)
        sl = float(d.get('sl', d.get('s/l', 0)) or 0)
        tp = float(d.get('tp', d.get('t/p', 0)) or 0)
        deal_time = _parse_mt5_time(d.get('time', ''))
        ticket = int(d.get('deal', d.get('order', 0)) or 0)

        if 'in' in direction or direction == 'entry':
            positions[order_id] = {
                'ticket': ticket, 'symbol': symbol, 'type': trade_type,
                'volume': volume, 'open_price': price, 'open_time': deal_time,
                'sl': sl or None, 'tp': tp or None,
                'commission': commission, 'status': 'open',
            }
        elif 'out' in direction or direction == 'exit':
            pos = positions.pop(order_id, None)
            if pos:
                total_commission = pos.get('commission', 0) + commission
                trade = {**pos,
                    'close_price': price, 'close_time': deal_time,
                    'profit': profit, 'commission': total_commission,
                    'swap': swap, 'status': 'closed',
                }
                trades.append(enrich_trade(trade))
            else:
                trades.append(enrich_trade({
                    'ticket': ticket, 'symbol': symbol, 'type': trade_type,
                    'volume': volume, 'open_price': price, 'close_price': price,
                    'open_time': deal_time, 'close_time': deal_time,
                    'profit': profit, 'commission': commission, 'swap': swap,
                    'sl': sl or None, 'tp': tp or None, 'status': 'closed',
                }))

    for pos in positions.values():
        trades.append(pos)

    return trades


@router.post("/import")
async def import_trades(
    account_id: str = Form(...),
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    db = get_client()
    acc = db.table("accounts").select("id").eq("id", account_id).eq("user_id", user["sub"]).execute()
    if not acc.data:
        raise HTTPException(403, "Compte non trouvé")

    content = (await file.read()).decode("utf-8", errors="ignore")
    trades = _parse_mt5_csv(content)
    if not trades:
        raise HTTPException(400, "Aucun trade trouvé dans le fichier")

    imported = 0
    skipped = 0
    for t in trades:
        ticket = t.get("ticket")
        if ticket:
            existing = db.table("trades").select("id").eq("account_id", account_id).eq("ticket", ticket).execute()
            if existing.data:
                skipped += 1
                continue
        t["account_id"] = account_id
        t["user_id"] = user["sub"]
        db.table("trades").insert(t).execute()
        imported += 1

    return {"imported": imported, "skipped": skipped, "total": len(trades)}


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
