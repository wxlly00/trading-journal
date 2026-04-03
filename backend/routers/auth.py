from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from db.supabase import get_client

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _to_email(username: str) -> str:
    """Convert username to internal fake email."""
    import re
    clean = re.sub(r"[^a-z0-9_]", "_", username.lower().strip())
    return f"{clean}@tj.app"


class RegisterBody(BaseModel):
    username: str
    password: str


@router.post("/register")
def register(body: RegisterBody):
    username = body.username.strip()

    if len(username) < 3:
        raise HTTPException(400, "Le pseudo doit faire au moins 3 caractères.")
    if not __import__("re").match(r"^[a-zA-Z0-9_]+$", username):
        raise HTTPException(400, "Pseudo : lettres, chiffres et _ uniquement.")
    if len(body.password) < 6:
        raise HTTPException(400, "Minimum 6 caractères.")

    email = _to_email(username)
    sb = get_client()

    try:
        # Admin API — crée l'user pré-confirmé, aucun email envoyé
        res = sb.auth.admin.create_user({
            "email": email,
            "password": body.password,
            "email_confirm": True,
            "user_metadata": {"username": username},
        })
        return {"ok": True, "email": email}
    except Exception as e:
        msg = str(e)
        if "already been registered" in msg or "already registered" in msg or "duplicate" in msg.lower():
            raise HTTPException(409, "Ce pseudo est déjà pris.")
        raise HTTPException(400, msg)
