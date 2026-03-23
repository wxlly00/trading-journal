import hashlib
import secrets
from jose import jwt, JWTError
from fastapi import HTTPException, Security, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from core.config import settings
from db.supabase import get_client

bearer = HTTPBearer()

def hash_api_key(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()

def generate_api_key() -> tuple[str, str]:
    raw = secrets.token_urlsafe(32)
    return raw, hash_api_key(raw)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Security(bearer)) -> dict:
    token = credentials.credentials
    try:
        db = get_client()
        user = db.auth.get_user(token)
        if not user or not user.user:
            raise HTTPException(status_code=401, detail="Invalid token")
        return {"sub": user.user.id, "email": user.user.email}
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

async def verify_api_key(x_api_key: str = Header(...)) -> dict:
    db = get_client()
    key_hash = hash_api_key(x_api_key)
    result = db.table("accounts").select("*").eq("api_key_hash", key_hash).execute()
    if not result.data:
        raise HTTPException(status_code=401, detail="Invalid API key")
    return result.data[0]
