# Trading Journal — Spec Design
**Date :** 2026-03-23
**Statut :** Approuvé par l'utilisateur

---

## 1. Contexte & Objectif

Application web de journal de trading personnel, connectée à MetaTrader 5 (MT5) sur Mac via un Expert Advisor (EA) MQL5. L'objectif est de capturer automatiquement tous les trades (ouverts et fermés) et d'afficher un dashboard complet de performance.

**Broker :** XM.com
**Plateforme :** MT5 natif macOS
**Utilisateur unique**, accès multi-appareils (Mac + mobile).

---

## 2. Architecture

### Stack

| Couche | Technologie | Hébergement | Coût |
|--------|-------------|-------------|------|
| Backend | FastAPI (Python 3.12) | Render (free tier) | 0$ |
| Base de données | PostgreSQL | Supabase (free tier, 500MB) | 0$ |
| Auth | Supabase Auth (JWT) | Supabase | 0$ |
| Frontend | React 18 + Vite + TailwindCSS | Vercel (free tier) | 0$ |
| Graphiques | Recharts | — | 0$ |
| Icons/UI | SVG customs (aucune lib d'icônes) | — | — |

**Coût total : $0/mois**

### Flux de données

```
MT5 (Mac)
  └── EA MQL5
        └── HTTP POST /api/trades/ingest (clé API secrète dans header)
              └── FastAPI (Render)
                    ├── Valide & enrichit le trade (P&L, R:R, durée, session)
                    └── Supabase PostgreSQL
                          └── React Dashboard (Vercel)
                                └── FastAPI REST API (auth JWT)
```

### Contrainte Render free tier

Le service Render dort après 15 min d'inactivité (cold start ~30s). Non critique : le journal ne bloque pas l'exécution des trades MT5. L'EA implémente un retry automatique (3 tentatives, backoff exponentiel).

---

## 3. Authentification

- **Dashboard web** : email + mot de passe via Supabase Auth, token JWT stocké en `httpOnly cookie`.
- **EA → Backend** : clé API secrète (header `X-API-Key`), configurée une fois dans les paramètres de l'EA.
- Pas de multi-utilisateurs : un seul compte.

---

## 4. EA MQL5 (Collecteur)

Fichier unique `TradeLogEA.mq5`, ~80 lignes.

**Événements capturés :**
- `OnTradeTransaction` : ouverture / fermeture / modification de position
- `OnTick` (optionnel) : mise à jour du P&L flottant toutes les 30s si position ouverte

**Payload HTTP POST `/api/trades/ingest` :**
```json
{
  "ticket": 123456789,
  "symbol": "XAUUSD",
  "type": "buy",
  "volume": 0.10,
  "open_price": 2024.01,
  "close_price": 2024.38,
  "sl": 2023.50,
  "tp": 2025.00,
  "open_time": "2026-03-23T09:15:00Z",
  "close_time": "2026-03-23T11:29:00Z",
  "profit": 33.70,
  "commission": -0.70,
  "swap": 0.00,
  "magic": 0,
  "comment": "breakout",
  "status": "closed"
}
```

**Paramètres EA configurables :**
- `ServerURL` : URL Render (ex: `https://tradelog.onrender.com`)
- `ApiKey` : clé secrète
- `RetryAttempts` : 3 (défaut)

---

## 5. Backend FastAPI

### Endpoints

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| POST | `/api/trades/ingest` | API Key | Réception trade depuis EA |
| GET | `/api/trades` | JWT | Liste paginée avec filtres |
| GET | `/api/trades/{id}` | JWT | Détail d'un trade |
| PATCH | `/api/trades/{id}` | JWT | Mise à jour note/tags/score |
| GET | `/api/stats/summary` | JWT | KPIs globaux |
| GET | `/api/stats/by-symbol` | JWT | P&L par paire |
| GET | `/api/stats/by-session` | JWT | London / NY / Asia |
| GET | `/api/stats/equity-curve` | JWT | Données courbe d'équité |
| GET | `/api/stats/heatmap` | JWT | P&L par heure × jour |
| GET | `/api/stats/calendar` | JWT | P&L par jour du mois |
| POST | `/api/auth/login` | — | Login (délégué Supabase) |
| POST | `/api/alerts/check` | JWT | Vérif drawdown journalier |
| POST | `/api/export/pdf` | JWT | Génère rapport PDF mensuel |
| GET | `/api/accounts` | JWT | Liste des comptes MT5 |

### Calculs effectués à l'ingestion

- **P&L net** = profit + commission + swap
- **R:R réalisé** = (close_price - open_price) / (open_price - sl) pour BUY
- **Durée** = close_time - open_time
- **Session** = déterminée par l'heure UTC d'ouverture (Asia: 0-8h, London: 8-16h, NY: 13-21h)
- **Drawdown journalier** = somme des trades perdants du jour / capital initial

---

## 6. Base de données (Supabase PostgreSQL)

### Tables

**`trades`**
```sql
id            UUID PRIMARY KEY DEFAULT gen_random_uuid()
ticket        BIGINT UNIQUE NOT NULL
symbol        VARCHAR(20)
type          VARCHAR(4)  -- 'buy' | 'sell'
volume        DECIMAL(10,2)
open_price    DECIMAL(12,5)
close_price   DECIMAL(12,5)
sl            DECIMAL(12,5)
tp            DECIMAL(12,5)
open_time     TIMESTAMPTZ
close_time    TIMESTAMPTZ
profit        DECIMAL(10,2)
commission    DECIMAL(10,2)
swap          DECIMAL(10,2)
pnl_net       DECIMAL(10,2)   -- calculé
rr_realized   DECIMAL(6,2)    -- calculé
duration_min  INTEGER          -- calculé
session       VARCHAR(10)      -- calculé
status        VARCHAR(10)      -- 'open' | 'closed'
-- Champs manuels
note          TEXT
tags          TEXT[]
psy_score     SMALLINT        -- 1-5
screenshot_url TEXT
magic         INTEGER
comment       VARCHAR(255)
account_id    UUID REFERENCES accounts(id)
created_at    TIMESTAMPTZ DEFAULT now()
```

**`accounts`**
```sql
id            UUID PRIMARY KEY DEFAULT gen_random_uuid()
name          VARCHAR(100)     -- ex: "XM Live #123456"
broker        VARCHAR(50)
account_number VARCHAR(50)
initial_capital DECIMAL(12,2)
currency      VARCHAR(3) DEFAULT 'USD'
is_live       BOOLEAN DEFAULT true
api_key_hash  TEXT             -- hash de la clé EA
created_at    TIMESTAMPTZ DEFAULT now()
```

**`daily_snapshots`**
```sql
id            UUID PRIMARY KEY DEFAULT gen_random_uuid()
account_id    UUID REFERENCES accounts(id)
date          DATE
trades_count  INTEGER
wins          INTEGER
losses        INTEGER
pnl_gross     DECIMAL(10,2)
pnl_net       DECIMAL(10,2)
drawdown_pct  DECIMAL(6,2)
equity        DECIMAL(12,2)
created_at    TIMESTAMPTZ DEFAULT now()
UNIQUE(account_id, date)
```

**`alerts`**
```sql
id            UUID PRIMARY KEY DEFAULT gen_random_uuid()
account_id    UUID REFERENCES accounts(id)
type          VARCHAR(30)      -- 'daily_drawdown' | 'loss_streak'
threshold     DECIMAL(6,2)
email         VARCHAR(255)
active        BOOLEAN DEFAULT true
```

---

## 7. Frontend React

### Pages & Navigation

```
/ (redirect → /dashboard)
/login
/dashboard          → KPIs + équité + P&L par paire + derniers trades
/journal            → Table complète, filtres, pagination
/journal/:id        → Détail trade + note + tags + screenshot
/stats              → Heatmap + sessions + distribution + streaks
/performance        → Equity curve + drawdown + monthly comparison
/calendar           → Vue calendrier P&L par jour
/notes              → Journal libre (texte libre par date)
/settings           → Config EA, alertes, objectifs, export PDF
```

### Design System

**Typographie :** Inter (Variable), `-apple-system` fallback
- `tabular-nums` sur tous les chiffres financiers
- Titres de page : 800, -0.8px letter-spacing

**Couleurs :**
```
Background app     : #F2F2F7
Card               : #FFFFFF
Card dark (KPI 1)  : #0A0A0A
Text primary       : #000000
Text secondary     : #3C3C43
Text tertiary      : #8E8E93
Separator          : #E5E5EA
Positive (P&L)     : #28A745
Negative (P&L)     : #E8342A
Live/Active        : #34C759
```

**Composants custom (SVG, aucune lib d'icônes) :**
- Logo mark : chandelier géométrique SVG
- Segmented control style macOS
- Live pill animée (dot pulsant CSS)
- Badges directionnels BUY/SELL avec micro-flèche SVG
- Badges résultat WIN/LOSS (noir plein / gris neutre)
- Cards KPI (première dark hero, reste white)
- Barres de graphe custom avec gloss subtle

**Layout :**
- Sidebar fixe 214px + Main scrollable
- Grid 8px base unit
- Border radius : 10px (nav), 14px (account card), 16px (cards KPI/contenu)

---

## 8. Features Premium

### Auto-sync MT5
- EA push temps réel sur chaque transaction
- Retry 3x avec backoff exponentiel
- Statut EA visible dans sidebar (live dot animé)

### Analytics avancés
- **Heatmap P&L** : heure (0-23h) × jour semaine (Lu-Di), intensité couleur
- **Equity curve** avec overlay zone drawdown colorée
- **Distribution P&L** : histogramme des trades par bucket $
- **Sessions** : London / NY / Asia — win rate + P&L + volume par session
- **Streaks** : max wins consécutifs, max losses consécutifs, streak actuel
- **Profit factor**, **Expected value**, **Sharpe ratio** simplifié

### Journal enrichi (par trade)
- Upload screenshot (chart MT5) → stocké Supabase Storage
- Tags de setup libres (ex: "breakout", "OB", "FVG", "retest")
- Score psychologique 1-5 (confiance avant trade)
- Note textuelle longue
- Vue replay basique (entrée/sortie sur mini-chart à prix)

### Outils
- **Calculateur de position** intégré : capital × risk% → lots selon SL en pips
- **Alertes email** : drawdown journalier > X%, série de N pertes consécutives
- **Export PDF** rapport mensuel (equity curve + stats + top/worst trades)
- **Vue calendrier** : case par jour colorée par P&L net du jour
- **Multi-comptes** : gérer live + demo sur le même dashboard

---

## 9. Setup & Déploiement

### Développement local
```bash
# Backend
cd backend && pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Frontend
cd frontend && npm install
npm run dev
```

### Production
1. Push `backend/` sur GitHub → connecter à Render (service web, free)
2. Variables d'env Render : `SUPABASE_URL`, `SUPABASE_KEY`, `SECRET_KEY`
3. Push `frontend/` → connecter à Vercel (auto-deploy)
4. Variable d'env Vercel : `VITE_API_URL=https://tradelog.onrender.com`
5. Configurer EA dans MT5 : `ServerURL` + `ApiKey`

### Structure des dossiers

```
trading-journal/
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   ├── routers/
│   │   ├── trades.py
│   │   ├── stats.py
│   │   ├── auth.py
│   │   ├── alerts.py
│   │   └── export.py
│   ├── models/
│   │   ├── trade.py
│   │   └── account.py
│   ├── services/
│   │   ├── calculator.py   # P&L, R:R, session, drawdown
│   │   ├── pdf.py
│   │   └── alerts.py
│   └── db/
│       └── supabase.py
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Journal.tsx
│   │   │   ├── TradeDetail.tsx
│   │   │   ├── Stats.tsx
│   │   │   ├── Performance.tsx
│   │   │   ├── Calendar.tsx
│   │   │   ├── Notes.tsx
│   │   │   └── Settings.tsx
│   │   ├── components/
│   │   │   ├── ui/          # composants design system
│   │   │   ├── charts/      # wrappers Recharts
│   │   │   └── layout/      # Sidebar, Topbar
│   │   ├── lib/
│   │   │   ├── api.ts       # client API
│   │   │   └── formatters.ts
│   │   └── stores/          # Zustand
├── ea/
│   └── TradeLogEA.mq5
└── docs/
    └── superpowers/specs/
        └── 2026-03-23-trading-journal-design.md
```

---

## 10. Critères de succès

- [ ] Chaque trade MT5 apparaît dans le journal < 5s après fermeture
- [ ] Dashboard charge < 1s (données pré-agrégées côté backend)
- [ ] Accessible et fonctionnel sur mobile (responsive)
- [ ] Zéro coût d'hébergement mensuel
- [ ] EA installable en < 5 minutes dans MT5
