from datetime import datetime, timezone, date as date_type
from db.supabase import get_client


async def check_alerts(account_id: str, user_id: str) -> None:
    db = get_client()
    alerts = db.table("alerts").select("*").eq("account_id", account_id).eq("user_id", user_id).eq("active", True).execute().data
    if not alerts:
        return

    today = date_type.today().isoformat()
    trades_today = db.table("trades").select("pnl_net").eq("account_id", account_id).eq("user_id", user_id).eq("status", "closed").gte("close_time", f"{today}T00:00:00Z").execute().data
    daily_pnl = sum(t.get("pnl_net") or 0 for t in trades_today)
    acc = db.table("accounts").select("initial_capital").eq("id", account_id).execute()
    capital = float(acc.data[0]["initial_capital"]) if acc.data else 10000.0
    daily_dd_pct = abs(min(daily_pnl, 0)) / capital * 100 if daily_pnl < 0 else 0

    all_trades = db.table("trades").select("pnl_net,close_time").eq("account_id", account_id).eq("status", "closed").order("close_time", desc=True).limit(20).execute().data
    cur_loss = 0
    for t in all_trades:
        if (t.get("pnl_net") or 0) < 0:
            cur_loss += 1
        else:
            break

    for alert in alerts:
        last = alert.get("last_triggered_at")
        if last and last[:10] == today:
            continue
        triggered = False
        payload: dict = {}
        if alert["type"] == "daily_drawdown" and daily_dd_pct >= alert["threshold"]:
            triggered = True
            payload = {"daily_drawdown_pct": round(daily_dd_pct, 2)}
        elif alert["type"] == "loss_streak" and cur_loss >= alert["threshold"]:
            triggered = True
            payload = {"loss_streak": cur_loss}
        if triggered:
            await _send_email(alert["email"], alert["type"], payload)
            db.table("alerts").update({"last_triggered_at": datetime.now(timezone.utc).isoformat()}).eq("id", alert["id"]).execute()
            db.table("alert_history").insert({"alert_id": alert["id"], "user_id": user_id, "payload": payload}).execute()


async def _send_email(email: str, alert_type: str, payload: dict) -> None:
    try:
        import resend
        from core.config import settings
        resend.api_key = settings.resend_api_key
        subject = "TradeLog — Alerte drawdown" if "drawdown" in alert_type else "TradeLog — Série de pertes"
        html = f"<p><strong>Alerte :</strong> {alert_type}</p><pre>{payload}</pre>"
        resend.Emails.send({"from": "alerts@tradelog.app", "to": email, "subject": subject, "html": html})
    except Exception:
        pass
