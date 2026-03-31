from fastapi import APIRouter, Depends
from core.security import get_current_user
from db.supabase import get_client

router = APIRouter(prefix="/api/checklist", tags=["checklist"])


@router.get("/items")
async def list_items(user: dict = Depends(get_current_user)):
    db = get_client()
    return db.table("checklist_items").select("*").eq("user_id", user["sub"]).order("position").execute().data


@router.post("/items")
async def create_item(payload: dict, user: dict = Depends(get_current_user)):
    db = get_client()
    existing = db.table("checklist_items").select("id").eq("user_id", user["sub"]).execute()
    data = {
        "user_id": user["sub"],
        "label": payload["label"],
        "position": len(existing.data),
    }
    return db.table("checklist_items").insert(data).execute().data[0]


@router.patch("/items/{item_id}")
async def update_item(item_id: str, payload: dict, user: dict = Depends(get_current_user)):
    db = get_client()
    data = {}
    if "label" in payload:
        data["label"] = payload["label"]
    if "position" in payload:
        data["position"] = payload["position"]
    db.table("checklist_items").update(data).eq("id", item_id).eq("user_id", user["sub"]).execute()
    return {"ok": True}


@router.delete("/items/{item_id}")
async def delete_item(item_id: str, user: dict = Depends(get_current_user)):
    db = get_client()
    db.table("checklist_items").delete().eq("id", item_id).eq("user_id", user["sub"]).execute()
    return {"ok": True}


@router.get("/trades/{trade_id}")
async def get_trade_checklist(trade_id: str, user: dict = Depends(get_current_user)):
    db = get_client()
    return db.table("trade_checklist").select("*").eq("trade_id", trade_id).eq("user_id", user["sub"]).execute().data


@router.post("/trades/{trade_id}")
async def save_trade_checklist(trade_id: str, payload: dict, user: dict = Depends(get_current_user)):
    """payload: { checks: { item_id: bool } }"""
    db = get_client()
    checks: dict = payload.get("checks", {})
    for item_id, checked in checks.items():
        existing = db.table("trade_checklist").select("id").eq("trade_id", trade_id).eq("item_id", item_id).execute()
        if existing.data:
            db.table("trade_checklist").update({"checked": checked}).eq("id", existing.data[0]["id"]).execute()
        else:
            db.table("trade_checklist").insert({
                "trade_id": trade_id,
                "item_id": item_id,
                "user_id": user["sub"],
                "checked": checked,
            }).execute()
    return {"ok": True}
