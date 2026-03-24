import os
from fastapi import APIRouter, Depends, HTTPException
from core.security import get_current_user
from db.supabase import get_client

router = APIRouter(prefix="/api/ai", tags=["ai"])


@router.post("/analyze")
async def analyze_trades(user: dict = Depends(get_current_user)):
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        raise HTTPException(503, "Clé API Anthropic non configurée")

    db = get_client()
    acc_res = db.table("accounts").select("id").eq("user_id", user["sub"]).execute()
    account_ids = [a["id"] for a in acc_res.data]
    if not account_ids:
        return {"analysis": "Aucun compte trouvé."}

    trades_res = (
        db.table("trades")
        .select("symbol,type,open_time,close_time,profit,rr_realized,session,tag,psy_score,duration_min")
        .in_("account_id", account_ids)
        .eq("status", "closed")
        .order("open_time", desc=True)
        .limit(100)
        .execute()
    )
    trades = trades_res.data
    if not trades:
        return {"analysis": "Aucun trade fermé trouvé pour analyser."}

    total_pnl = sum(float(t.get("profit") or 0) for t in trades)
    wins = [t for t in trades if float(t.get("profit") or 0) > 0]
    losses = [t for t in trades if float(t.get("profit") or 0) < 0]
    win_rate = len(wins) / len(trades) * 100 if trades else 0

    symbols: dict[str, float] = {}
    sessions: dict[str, float] = {}
    for t in trades:
        s = t.get("symbol") or "?"
        symbols[s] = symbols.get(s, 0.0) + float(t.get("profit") or 0)
        sess = t.get("session") or "unknown"
        sessions[sess] = sessions.get(sess, 0.0) + float(t.get("profit") or 0)

    top_symbols = dict(sorted(symbols.items(), key=lambda x: x[1], reverse=True)[:8])

    prompt = f"""Tu es un analyste de trading expérimenté. Analyse les données de trading suivantes et fournis des insights actionnables en français.

RÉSUMÉ ({len(trades)} derniers trades clôturés) :
- P&L total : {total_pnl:.2f}
- Taux de réussite : {win_rate:.1f}% ({len(wins)} gagnants / {len(losses)} perdants)
- P&L par symbole : {top_symbols}
- P&L par session : {sessions}

DONNÉES DÉTAILLÉES (50 derniers trades) :
{trades[:50]}

Fournis une analyse structurée en markdown avec ces sections exactes :
## Points forts
(ce que le trader fait bien)

## Axes d'amélioration
(les principales faiblesses)

## Patterns détectés
(heures/sessions/symboles les plus rentables)

## Recommandations
(3-5 actions concrètes et spécifiques à mettre en place)

Sois direct, pratique et concis. Maximum 500 mots."""

    try:
        import anthropic
        client = anthropic.Anthropic(api_key=api_key)
        message = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1500,
            messages=[{"role": "user", "content": prompt}],
        )
        return {"analysis": message.content[0].text}
    except Exception as e:
        raise HTTPException(500, f"Erreur API: {str(e)}")
