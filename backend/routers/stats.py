from collections import defaultdict
from datetime import datetime
from fastapi import APIRouter, Depends
from core.security import get_current_user
from db.supabase import get_client
from services.calculator import calc_equity_curve, calc_sharpe

router = APIRouter(prefix="/api/stats", tags=["stats"])


def _closed_trades(db, account_id: str, user_id: str) -> list[dict]:
    return db.table("trades").select("*").eq("account_id", account_id).eq("user_id", user_id).eq("status", "closed").execute().data


@router.get("/summary")
async def summary(account_id: str, user: dict = Depends(get_current_user)):
    db = get_client()
    trades = _closed_trades(db, account_id, user["sub"])
    if not trades:
        return {"trades_count": 0}

    wins = [t for t in trades if (t.get("pnl_net") or 0) > 0]
    losses = [t for t in trades if (t.get("pnl_net") or 0) < 0]
    total_pnl = sum(t.get("pnl_net") or 0 for t in trades)
    win_rate = round(len(wins) / len(trades) * 100, 1)
    avg_win = round(sum(t["pnl_net"] for t in wins) / len(wins), 2) if wins else 0
    avg_loss = round(sum(t["pnl_net"] for t in losses) / len(losses), 2) if losses else 0
    gross_wins = abs(sum(t["pnl_net"] for t in wins))
    gross_losses = abs(sum(t["pnl_net"] for t in losses))
    profit_factor = round(gross_wins / gross_losses, 2) if gross_losses else None
    rr_vals = [t["rr_realized"] for t in trades if t.get("rr_realized")]
    avg_rr = round(sum(rr_vals) / len(rr_vals), 2) if rr_vals else None
    expected_value = round((win_rate / 100 * avg_win) + ((1 - win_rate / 100) * avg_loss), 2)

    daily: dict[str, float] = defaultdict(float)
    for t in trades:
        if t.get("close_time"):
            daily[t["close_time"][:10]] += t.get("pnl_net") or 0
    sharpe = calc_sharpe(list(daily.values()))

    acc = db.table("accounts").select("initial_capital").eq("id", account_id).execute()
    capital = float(acc.data[0]["initial_capital"]) if acc.data else 10000.0
    curve = calc_equity_curve(trades, capital)
    max_dd = max((p["drawdown_pct"] for p in curve), default=0)

    return {
        "trades_count": len(trades),
        "wins": len(wins),
        "losses": len(losses),
        "win_rate": win_rate,
        "total_pnl": round(total_pnl, 2),
        "avg_win": avg_win,
        "avg_loss": avg_loss,
        "profit_factor": profit_factor,
        "avg_rr": avg_rr,
        "expected_value": expected_value,
        "sharpe": sharpe,
        "max_drawdown_pct": round(max_dd, 2),
    }


@router.get("/by-symbol")
async def by_symbol(account_id: str, user: dict = Depends(get_current_user)):
    db = get_client()
    trades = _closed_trades(db, account_id, user["sub"])
    data: dict = defaultdict(lambda: {"pnl": 0.0, "wins": 0, "total": 0})
    for t in trades:
        s = t.get("symbol", "UNKNOWN")
        data[s]["pnl"] += t.get("pnl_net") or 0
        data[s]["total"] += 1
        if (t.get("pnl_net") or 0) > 0:
            data[s]["wins"] += 1
    return sorted(
        [{"symbol": k, "pnl": round(v["pnl"], 2), "win_rate": round(v["wins"] / v["total"] * 100, 1), "trades": v["total"]} for k, v in data.items()],
        key=lambda x: x["pnl"],
        reverse=True,
    )


@router.get("/by-session")
async def by_session(account_id: str, user: dict = Depends(get_current_user)):
    db = get_client()
    trades = _closed_trades(db, account_id, user["sub"])
    data: dict = defaultdict(lambda: {"pnl": 0.0, "wins": 0, "total": 0})
    for t in trades:
        s = t.get("session") or "off"
        data[s]["pnl"] += t.get("pnl_net") or 0
        data[s]["total"] += 1
        if (t.get("pnl_net") or 0) > 0:
            data[s]["wins"] += 1
    return [{"session": k, "pnl": round(v["pnl"], 2), "win_rate": round(v["wins"] / v["total"] * 100, 1) if v["total"] else 0, "trades": v["total"]} for k, v in data.items()]


@router.get("/equity-curve")
async def equity_curve(account_id: str, user: dict = Depends(get_current_user)):
    db = get_client()
    trades = _closed_trades(db, account_id, user["sub"])
    acc = db.table("accounts").select("initial_capital").eq("id", account_id).execute()
    capital = float(acc.data[0]["initial_capital"]) if acc.data else 10000.0
    return calc_equity_curve(trades, capital)


@router.get("/heatmap")
async def heatmap(account_id: str, user: dict = Depends(get_current_user)):
    db = get_client()
    trades = _closed_trades(db, account_id, user["sub"])
    data: dict = defaultdict(lambda: {"pnl": 0.0, "count": 0})
    for t in trades:
        if t.get("open_time"):
            dt = datetime.fromisoformat(t["open_time"].replace("Z", "+00:00"))
            key = f"{dt.weekday()}_{dt.hour}"
            data[key]["pnl"] += t.get("pnl_net") or 0
            data[key]["count"] += 1
    return [{"weekday": int(k.split("_")[0]), "hour": int(k.split("_")[1]), "pnl": round(v["pnl"], 2), "count": v["count"]} for k, v in data.items()]


@router.get("/calendar")
async def calendar(account_id: str, month: str | None = None, user: dict = Depends(get_current_user)):
    db = get_client()
    trades = _closed_trades(db, account_id, user["sub"])
    data: dict[str, float] = defaultdict(float)
    for t in trades:
        if t.get("close_time"):
            day = t["close_time"][:10]
            if month and not day.startswith(month):
                continue
            data[day] += t.get("pnl_net") or 0
    return [{"date": k, "pnl": round(v, 2)} for k, v in sorted(data.items())]


@router.get("/streaks")
async def streaks(account_id: str, user: dict = Depends(get_current_user)):
    db = get_client()
    trades = sorted(_closed_trades(db, account_id, user["sub"]), key=lambda x: x.get("close_time") or "")
    max_win = cur_win = max_loss = cur_loss = 0
    for t in trades:
        if (t.get("pnl_net") or 0) > 0:
            cur_win += 1
            cur_loss = 0
            max_win = max(max_win, cur_win)
        else:
            cur_loss += 1
            cur_win = 0
            max_loss = max(max_loss, cur_loss)
    return {"max_win_streak": max_win, "max_loss_streak": max_loss, "current_win": cur_win, "current_loss": cur_loss}
