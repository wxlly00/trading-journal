from fastapi import APIRouter, Depends
from core.security import get_current_user
from db.supabase import get_client

router = APIRouter(prefix="/api", tags=["playbook"])


# ─── Learning entries ─────────────────────────────────────────────────────────

@router.get("/learning")
async def list_learning(account_id: str | None = None, user: dict = Depends(get_current_user)):
    db = get_client()
    q = db.table("learning_entries").select("*").eq("user_id", user["sub"])
    return q.order("created_at", desc=True).execute().data


@router.post("/learning")
async def create_learning(payload: dict, user: dict = Depends(get_current_user)):
    db = get_client()
    data = {
        "title": payload["title"],
        "content": payload.get("content", ""),
        "tags": payload.get("tags", []),
        "user_id": user["sub"],
    }
    return db.table("learning_entries").insert(data).execute().data[0]


@router.patch("/learning/{entry_id}")
async def update_learning(entry_id: str, payload: dict, user: dict = Depends(get_current_user)):
    db = get_client()
    data = {}
    if "title" in payload:
        data["title"] = payload["title"]
    if "content" in payload:
        data["content"] = payload["content"]
    if "tags" in payload:
        data["tags"] = payload["tags"]
    r = db.table("learning_entries").update(data).eq("id", entry_id).eq("user_id", user["sub"]).execute()
    return r.data[0] if r.data else {"ok": True}


@router.delete("/learning/{entry_id}")
async def delete_learning(entry_id: str, user: dict = Depends(get_current_user)):
    db = get_client()
    db.table("learning_entries").delete().eq("id", entry_id).eq("user_id", user["sub"]).execute()
    return {"ok": True}


# ─── Drawings ─────────────────────────────────────────────────────────────────

def _drawing_to_api(row: dict) -> dict:
    """Map DB columns (elements, app_state) to frontend shape (data)."""
    return {
        **{k: v for k, v in row.items() if k not in ("elements", "app_state")},
        "data": {
            "elements": row.get("elements") or [],
            "appState": row.get("app_state") or {},
        },
    }


@router.get("/drawings")
async def list_drawings(account_id: str | None = None, user: dict = Depends(get_current_user)):
    db = get_client()
    rows = db.table("drawings").select("id,title,tags,created_at,updated_at").eq("user_id", user["sub"]).order("updated_at", desc=True).execute().data
    return [{"id": r["id"], "title": r["title"], "tags": r.get("tags"), "created_at": r["created_at"]} for r in rows]


@router.post("/drawings")
async def create_drawing(payload: dict, user: dict = Depends(get_current_user)):
    db = get_client()
    raw_data = payload.get("data") or {}
    data = {
        "title": payload.get("title", "Sans titre"),
        "elements": raw_data.get("elements", []),
        "app_state": raw_data.get("appState", {}),
        "tags": payload.get("tags", []),
        "user_id": user["sub"],
    }
    row = db.table("drawings").insert(data).execute().data[0]
    return _drawing_to_api(row)


@router.get("/drawings/{drawing_id}")
async def get_drawing(drawing_id: str, user: dict = Depends(get_current_user)):
    db = get_client()
    r = db.table("drawings").select("*").eq("id", drawing_id).eq("user_id", user["sub"]).execute()
    if not r.data:
        return {}
    return _drawing_to_api(r.data[0])


@router.patch("/drawings/{drawing_id}")
async def update_drawing(drawing_id: str, payload: dict, user: dict = Depends(get_current_user)):
    db = get_client()
    data = {}
    if "title" in payload:
        data["title"] = payload["title"]
    if "data" in payload:
        raw = payload["data"] or {}
        data["elements"] = raw.get("elements", [])
        data["app_state"] = raw.get("appState", {})
    r = db.table("drawings").update(data).eq("id", drawing_id).eq("user_id", user["sub"]).execute()
    return _drawing_to_api(r.data[0]) if r.data else {"ok": True}


@router.delete("/drawings/{drawing_id}")
async def delete_drawing(drawing_id: str, user: dict = Depends(get_current_user)):
    db = get_client()
    db.table("drawings").delete().eq("id", drawing_id).eq("user_id", user["sub"]).execute()
    return {"ok": True}
