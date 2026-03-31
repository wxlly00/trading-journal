from fastapi import APIRouter, Depends
from core.security import get_current_user
from db.supabase import get_client

router = APIRouter(prefix="/api/rules", tags=["rules"])


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
    rule = db.table("trading_rules").select("violations").eq("id", rule_id).eq("user_id", user["sub"]).execute()
    if not rule.data:
        return {"ok": False}
    new_count = (rule.data[0].get("violations") or 0) + 1
    db.table("trading_rules").update({"violations": new_count}).eq("id", rule_id).execute()
    trade_id = payload.get("trade_id")
    if trade_id:
        db.table("rule_violations").insert({
            "rule_id": rule_id,
            "trade_id": trade_id,
            "user_id": user["sub"],
            "note": payload.get("note", ""),
        }).execute()
    return {"ok": True, "violations": new_count}


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
