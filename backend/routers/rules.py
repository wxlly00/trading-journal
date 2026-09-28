from fastapi import APIRouter, Depends, HTTPException
from core.security import get_current_user
from db.supabase import get_client

router = APIRouter(prefix="/api/rules", tags=["rules"])


def _owned_trade(db, trade_id: str, user_id: str):
    result = db.table("trades").select("id").eq("id", trade_id).eq("user_id", user_id).execute()
    if not result.data:
        raise HTTPException(404, "Trade introuvable")


def _owned_rule(db, rule_id: str, user_id: str):
    result = db.table("trading_rules").select("id,violations").eq("id", rule_id).eq("user_id", user_id).execute()
    if not result.data:
        raise HTTPException(404, "Règle introuvable")
    return result.data[0]


def _all_rows(query):
    """PostgREST limits result pages; include every trade in the comparison."""
    rows = []
    start = 0
    while True:
        page = query.range(start, start + 999).execute().data
        rows.extend(page)
        if len(page) < 1000:
            return rows
        start += 1000


def _summary(trades, violated_ids):
    groups = {"with_violation": [], "without_violation": []}
    for trade in trades:
        if trade.get("pnl_net") is None or not trade.get("close_time"):
            continue
        group = "with_violation" if trade["id"] in violated_ids else "without_violation"
        groups[group].append(float(trade["pnl_net"]))
    return {
        key: {
            "count": len(values),
            "pnl_net": round(sum(values), 2),
            "average_pnl_net": round(sum(values) / len(values), 2) if values else None,
        }
        for key, values in groups.items()
    }


@router.get("")
async def list_rules(user: dict = Depends(get_current_user)):
    db = get_client()
    return db.table("trading_rules").select("*").eq("user_id", user["sub"]).order("created_at").execute().data


@router.post("")
async def create_rule(payload: dict, user: dict = Depends(get_current_user)):
    db = get_client()
    data = {
        "user_id": user["sub"],
        "title": payload["title"],
        "description": payload.get("description", ""),
        "category": payload.get("category", "general"),
        "violations": 0,
    }
    return db.table("trading_rules").insert(data).execute().data[0]


@router.get("/violations/trade/{trade_id}")
async def list_trade_violations(trade_id: str, user: dict = Depends(get_current_user)):
    db = get_client()
    _owned_trade(db, trade_id, user["sub"])
    return db.table("rule_violations").select("id,rule_id,trade_id,note,created_at").eq("trade_id", trade_id).eq("user_id", user["sub"]).execute().data


@router.delete("/violations/{violation_id}")
async def delete_violation(violation_id: str, user: dict = Depends(get_current_user)):
    db = get_client()
    found = db.table("rule_violations").select("id,rule_id").eq("id", violation_id).eq("user_id", user["sub"]).execute().data
    if not found:
        raise HTTPException(404, "Violation introuvable")
    rule_id = found[0]["rule_id"]
    db.table("rule_violations").delete().eq("id", violation_id).eq("user_id", user["sub"]).execute()
    rule = db.table("trading_rules").select("violations").eq("id", rule_id).eq("user_id", user["sub"]).execute().data
    if rule:
        count = max(0, (rule[0].get("violations") or 0) - 1)
        db.table("trading_rules").update({"violations": count}).eq("id", rule_id).eq("user_id", user["sub"]).execute()
    return {"ok": True}


@router.get("/impact")
async def rules_impact(account_id: str, user: dict = Depends(get_current_user)):
    db = get_client()
    account = db.table("accounts").select("id").eq("id", account_id).eq("user_id", user["sub"]).execute().data
    if not account:
        raise HTTPException(404, "Compte introuvable")

    trades = _all_rows(db.table("trades").select("id,pnl_net,close_time").eq("account_id", account_id).eq("user_id", user["sub"]).not_.is_("close_time", "null").order("id"))
    violated_ids = set()
    for offset in range(0, len(trades), 200):
        ids = [trade["id"] for trade in trades[offset:offset + 200]]
        violations = _all_rows(db.table("rule_violations").select("trade_id").eq("user_id", user["sub"]).in_("trade_id", ids).order("id"))
        violated_ids.update(row["trade_id"] for row in violations)
    return _summary(trades, violated_ids)


@router.patch("/{rule_id}")
async def update_rule(rule_id: str, payload: dict, user: dict = Depends(get_current_user)):
    db = get_client()
    data = {}
    if "title" in payload:
        data["title"] = payload["title"]
    if "description" in payload:
        data["description"] = payload["description"]
    if "category" in payload:
        data["category"] = payload["category"]
    if "active" in payload:
        data["active"] = payload["active"]
    db.table("trading_rules").update(data).eq("id", rule_id).eq("user_id", user["sub"]).execute()
    return {"ok": True}


@router.post("/{rule_id}/violation")
async def record_violation(rule_id: str, payload: dict, user: dict = Depends(get_current_user)):
    db = get_client()
    rule = _owned_rule(db, rule_id, user["sub"])
    trade_id = payload.get("trade_id")
    if not trade_id:
        raise HTTPException(400, "trade_id requis")
    _owned_trade(db, trade_id, user["sub"])
    existing = db.table("rule_violations").select("id").eq("rule_id", rule_id).eq("trade_id", trade_id).eq("user_id", user["sub"]).execute().data
    if existing:
        return {"ok": True, "id": existing[0]["id"], "violations": rule.get("violations") or 0}
    created = db.table("rule_violations").insert({
        "rule_id": rule_id,
        "trade_id": trade_id,
        "user_id": user["sub"],
        "note": payload.get("note", ""),
    }).execute().data[0]
    count = (rule.get("violations") or 0) + 1
    db.table("trading_rules").update({"violations": count}).eq("id", rule_id).eq("user_id", user["sub"]).execute()
    return {"ok": True, "id": created["id"], "violations": count}


@router.delete("/{rule_id}")
async def delete_rule(rule_id: str, user: dict = Depends(get_current_user)):
    db = get_client()
    db.table("trading_rules").delete().eq("id", rule_id).eq("user_id", user["sub"]).execute()
    return {"ok": True}


@router.get("/stats")
async def rules_stats(user: dict = Depends(get_current_user)):
    db = get_client()
    rules = db.table("trading_rules").select("*").eq("user_id", user["sub"]).execute().data
    total_violations = sum(r.get("violations") or 0 for r in rules)
    most_broken = sorted(rules, key=lambda r: r.get("violations") or 0, reverse=True)[:3]
    return {
        "total_rules": len(rules),
        "total_violations": total_violations,
        "most_broken": most_broken,
    }
