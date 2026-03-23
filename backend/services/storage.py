import uuid as uuid_lib
from db.supabase import get_client

BUCKET = "screenshots"

def upload_screenshot(user_id: str, trade_id: str, content: bytes, content_type: str, filename: str) -> str:
    db = get_client()
    ext = filename.rsplit(".", 1)[-1] if "." in filename else "jpg"
    path = f"{user_id}/{trade_id}/{uuid_lib.uuid4()}.{ext}"
    db.storage.from_(BUCKET).upload(path, content, {"content-type": content_type})
    return db.storage.from_(BUCKET).get_public_url(path)
