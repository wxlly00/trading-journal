from datetime import datetime, timezone

PIP_VALUES = {
    "EURUSD": 10.0, "GBPUSD": 10.0, "AUDUSD": 10.0, "NZDUSD": 10.0,
    "USDJPY": 9.09, "USDCHF": 10.0, "USDCAD": 7.69,
    "EURGBP": 12.5, "EURJPY": 6.8,
    "XAUUSD": 1.0,
}

def get_session(open_time: datetime) -> str:
    h = open_time.hour
    if 0 <= h < 8:
        return "asia"
    if 8 <= h < 13:
        return "london"
    if 13 <= h < 16:
        return "overlap"
    if 16 <= h < 21:
        return "ny"
    return "off"

def calc_rr(type_: str, open_price: float, close_price: float, sl: float) -> float | None:
    if not sl or sl == 0:
        return None
    if type_ == "buy":
        gain = close_price - open_price
        risk = open_price - sl
    else:
        gain = open_price - close_price
        risk = sl - open_price
    if risk <= 0:
        return None
    return round(gain / risk, 3)

def calc_duration(open_time: datetime, close_time: datetime) -> int:
    return int((close_time - open_time).total_seconds() / 60)

def _parse_dt(s: str) -> datetime | None:
    """Parse ISO or MT5 datetime string to datetime."""
    if not s:
        return None
    s = s.strip().rstrip("Z").replace("Z", "")
    for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S", "%Y.%m.%d %H:%M:%S", "%Y.%m.%d %H:%M"):
        try:
            return datetime.strptime(s, fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            pass
    try:
        return datetime.fromisoformat(s).replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def enrich_trade(data: dict) -> dict:
    profit = data.get("profit", 0) or 0
    commission = data.get("commission", 0) or 0
    swap = data.get("swap", 0) or 0
    data["pnl_net"] = round(profit + commission + swap, 2)

    ot = _parse_dt(data.get("open_time", ""))
    if ot:
        data["open_time"] = ot.isoformat()
        data["session"] = get_session(ot)

    ct = _parse_dt(data.get("close_time", ""))
    if ct:
        data["close_time"] = ct.isoformat()

    if ot and ct:
        data["duration_min"] = calc_duration(ot, ct)

    if data.get("close_price") and data.get("open_price") and data.get("sl"):
        data["rr_realized"] = calc_rr(
            data.get("type", "buy"),
            float(data["open_price"]),
            float(data["close_price"]),
            float(data["sl"])
        )
    return data

def calc_equity_curve(trades: list[dict], initial_capital: float) -> list[dict]:
    equity = initial_capital
    peak = initial_capital
    result = []
    for t in sorted(trades, key=lambda x: x.get("close_time") or ""):
        equity += t.get("pnl_net") or 0
        peak = max(peak, equity)
        dd = round((peak - equity) / peak * 100, 2) if peak > 0 else 0
        result.append({
            "date": t.get("close_time"),
            "equity": round(equity, 2),
            "drawdown_pct": dd
        })
    return result

def calc_sharpe(daily_pnls: list[float]) -> float | None:
    if len(daily_pnls) < 10:
        return None
    mean = sum(daily_pnls) / len(daily_pnls)
    variance = sum((x - mean) ** 2 for x in daily_pnls) / len(daily_pnls)
    std = variance ** 0.5
    if std == 0:
        return None
    return round(mean / std, 2)

def calc_lot_size(capital: float, risk_pct: float, sl_pips: float, symbol: str) -> float | None:
    pip_val = PIP_VALUES.get(symbol.upper())
    if not pip_val or sl_pips <= 0:
        return None
    risk_amount = capital * risk_pct / 100
    lots = risk_amount / (sl_pips * pip_val)
    return round(lots, 2)
