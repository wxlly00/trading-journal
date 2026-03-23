from fastapi import APIRouter, Depends, HTTPException
from core.security import get_current_user
from db.supabase import get_client
from services.calculator import calc_lot_size, PIP_VALUES

router = APIRouter(prefix="/api/calculator", tags=["calculator"])


@router.get("/lots")
async def get_lots(account_id: str, risk_pct: float, sl_pips: float, symbol: str, user: dict = Depends(get_current_user)):
    db = get_client()
    acc = db.table("accounts").select("initial_capital").eq("id", account_id).eq("user_id", user["sub"]).execute()
    if not acc.data:
        raise HTTPException(404, "Account not found")
    lots = calc_lot_size(float(acc.data[0]["initial_capital"]), risk_pct, sl_pips, symbol)
    if lots is None:
        raise HTTPException(400, f"Symbol non supporté. Supportés: {list(PIP_VALUES.keys())}")
    return {"lots": lots, "symbol": symbol, "risk_pct": risk_pct, "sl_pips": sl_pips}
