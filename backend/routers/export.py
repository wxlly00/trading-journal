from fastapi import APIRouter, Depends, Response
from core.security import get_current_user
from db.supabase import get_client
from services.calculator import calc_equity_curve

router = APIRouter(prefix="/api/export", tags=["export"])


@router.get("/pdf")
async def export_pdf(account_id: str, month: str, user: dict = Depends(get_current_user)):
    db = get_client()
    trades = db.table("trades").select("*").eq("account_id", account_id).eq("user_id", user["sub"]).eq("status", "closed").gte("close_time", f"{month}-01T00:00:00Z").lte("close_time", f"{month}-31T23:59:59Z").execute().data
    acc_r = db.table("accounts").select("*").eq("id", account_id).execute()
    acc = acc_r.data[0] if acc_r.data else {}

    wins = [t for t in trades if (t.get("pnl_net") or 0) > 0]
    losses = [t for t in trades if (t.get("pnl_net") or 0) <= 0]
    total_pnl = sum(t.get("pnl_net") or 0 for t in trades)
    top5 = sorted(trades, key=lambda x: x.get("pnl_net") or 0, reverse=True)[:5]
    worst5 = sorted(trades, key=lambda x: x.get("pnl_net") or 0)[:5]

    def trade_row(t: dict, css_class: str) -> str:
        return f"<tr><td>{t.get('symbol','')}</td><td>{t.get('type','')}</td><td class='{css_class}'>${t.get('pnl_net',0):.2f}</td><td>{t.get('rr_realized') or ''}</td></tr>"

    html = f"""<!DOCTYPE html><html><head><meta charset="utf-8">
    <style>body{{font-family:Arial,sans-serif;font-size:12px;margin:40px;color:#111}}
    h1{{font-size:22px;margin-bottom:4px}}h2{{font-size:15px;margin-top:24px}}
    table{{width:100%;border-collapse:collapse;margin-top:8px}}
    th,td{{border:1px solid #e5e5e5;padding:7px 10px;text-align:left}}th{{background:#f5f5f5;font-weight:600}}
    .pos{{color:#28A745;font-weight:700}}.neg{{color:#E8342A;font-weight:700}}</style></head><body>
    <h1>Rapport mensuel — {month}</h1>
    <p style="color:#666">Compte : {acc.get('name','')} &nbsp;|&nbsp; Capital initial : ${acc.get('initial_capital','')}</p>
    <h2>Résumé</h2>
    <table><tr><th>Trades</th><th>Wins</th><th>Losses</th><th>P&L Net</th></tr>
    <tr><td>{len(trades)}</td><td>{len(wins)}</td><td>{len(losses)}</td>
    <td class="{'pos' if total_pnl>=0 else 'neg'}">${total_pnl:.2f}</td></tr></table>
    <h2>Top 5 trades</h2><table><tr><th>Paire</th><th>Direction</th><th>P&L</th><th>R:R</th></tr>
    {''.join(trade_row(t,'pos') for t in top5)}</table>
    <h2>Worst 5 trades</h2><table><tr><th>Paire</th><th>Direction</th><th>P&L</th><th>R:R</th></tr>
    {''.join(trade_row(t,'neg') for t in worst5)}</table>
    </body></html>"""

    try:
        from weasyprint import HTML
        pdf = HTML(string=html).write_pdf()
        return Response(content=pdf, media_type="application/pdf",
                        headers={"Content-Disposition": f"attachment; filename=tradelog-{month}.pdf"})
    except Exception:
        return Response(content=html, media_type="text/html")
