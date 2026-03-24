from fastapi import APIRouter, Depends
from core.security import get_current_user
from db.supabase import get_client

router = APIRouter(prefix="/api/notes", tags=["notes"])


@router.get("")
async def list_notes(date: str | None = None, user: dict = Depends(get_current_user)):
    db = get_client()
    q = db.table("notes").select("*").eq("user_id", user["sub"])
    if date:
        q = q.eq("date", date)
    return q.order("date", desc=True).execute().data


@router.post("")
async def create_note(payload: dict, user: dict = Depends(get_current_user)):
    db = get_client()
    data = {
        "date": payload["date"],
        "content": payload.get("content", ""),
        "user_id": user["sub"],
    }
    r = db.table("notes").upsert(data, on_conflict="user_id,date").execute()
    return r.data[0]


@router.patch("/{note_id}")
async def update_note(note_id: str, payload: dict, user: dict = Depends(get_current_user)):
    db = get_client()
    r = db.table("notes").update({"content": payload.get("content")}).eq("id", note_id).eq("user_id", user["sub"]).execute()
    return r.data[0] if r.data else {"ok": True}


@router.delete("/{note_id}")
async def delete_note(note_id: str, user: dict = Depends(get_current_user)):
    db = get_client()
    db.table("notes").delete().eq("id", note_id).eq("user_id", user["sub"]).execute()
    return {"ok": True}
