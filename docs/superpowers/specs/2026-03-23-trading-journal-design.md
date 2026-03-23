# Trading Journal — Spec Design
**Date :** 2026-03-23
**Révision :** v2 (post-review)
**Statut :** En attente d'approbation finale

---

## 1. Contexte & Objectif

Application web de journal de trading personnel connectée à MetaTrader 5 (MT5) sur Mac via un Expert Advisor (EA) MQL5. Capture automatique de tous les trades (ouverts et fermés) et affichage d'un dashboard complet de performance.

**Broker :** XM.com
**Plateforme :** MT5 natif macOS
**Utilisateur :** unique, accès multi-appareils (Mac + mobile).

---

## 2. Architecture

### Stack

| Couche | Technologie | Hébergement | Coût |
|--------|-------------|-------------|------|
| Backend | FastAPI (Python 3.12) | Render (free tier) | 0$ |
| Base de données | PostgreSQL | Supabase (free tier, 500MB) | 0$ |
| Auth | Supabase Auth (JWT) | Supabase | 0$ |
| Frontend | React 18 + Vite + TailwindCSS | Vercel (free tier) | 0$ |
| State management | Zustand | — | 0$ |
| Graphiques | Recharts | — | 0$ |
| PDF export | WeasyPrint | backend Render | 0$ |
| Icons/UI | SVG customs (aucune lib d'icônes) | — | — |

**Coût total : $0/mois**

### Flux de données

```
MT5 (Mac)
  └── EA MQL5
        └── HTTPS POST /api/trades/ingest (X-API-Key header)
              └── FastAPI (Render)
                    ├── Valide la clé API (SHA-256 hash comparison)
                    ├── Enrichit le trade (P&L net, R:R, durée, session)
                    ├── Upsert sur ticket (open → closed)
                    └── Supabase PostgreSQL (RLS activé)
                          └── React Dashboard (Vercel)
                                └── FastAPI REST API (JWT Bearer token)
```

### Contrainte Render free tier

Le service dort après 15 min d'inactivité (cold start ~30s). Non critique : l'EA retry 3x. Le critère `< 5s` s'applique **quand le serveur est chaud**. Un ping keepalive via UptimeRobot (free) sera configuré pour maintenir le service éveillé pendant les sessions de trading.

---

## 3. Authentification & Sécurité

### Dashboard web (utilisateur)

- Auth déléguée **entièrement à Supabase Auth côté client** : le frontend appelle directement le SDK Supabase (`supabase.auth.signInWithPassword`).
- Supabase retourne un `access_token` JWT signé.
- Le frontend passe ce JWT dans le header `Authorization: Bearer <token>` à chaque appel FastAPI.
- FastAPI vérifie la signature JWT avec la clé publique Supabase (JWKS) — aucun `SECRET_KEY` applicatif nécessaire.
- **Pas de proxy `/api/auth/login` FastAPI** : l'auth est 100% Supabase SDK.

### EA → Backend (clé API)

- L'EA envoie `X-API-Key: <clé_brute>` dans le header HTTPS.
- **HTTPS obligatoire** : Render fournit TLS automatiquement. L'EA doit utiliser `https://`.
- La clé brute est hashée en SHA-256 (hex) et comparée au champ `api_key_hash` de `accounts`. Jamais stockée en clair.
- **Rotation** : endpoint `POST /api/accounts/{id}/rotate-key` génère une nouvelle clé et retourne la valeur brute une seule fois.
- Expiration : pas d'expiry automatique (usage personnel), rotation manuelle.

### CORS

FastAPI configure `CORSMiddleware` avec :
- `allow_origins` : URL Vercel de production + `http://localhost:5173` (dev)
- `allow_credentials` : `False` (JWT en Bearer header, pas en cookie)
- `allow_methods` : `["GET", "POST", "PATCH", "DELETE"]`

### Row Level Security (Supabase)

Toutes les tables ont une colonne `user_id UUID REFERENCES auth.users(id) NOT NULL`. Les politiques RLS restreignent chaque ligne à `auth.uid() = user_id`. Le backend FastAPI utilise Supabase avec le rôle `service_role` (clé secrète) qui bypass RLS — RLS protège uniquement les accès directs à Supabase depuis le client.

---

## 4. EA MQL5 (Collecteur)

Fichier unique `TradeLogEA.mq5`, ~100 lignes.

**Événements capturés :**
- `OnTradeTransaction(TRADE_TRANSACTION_DEAL_ADD)` : trade exécuté (ouverture ou fermeture)
- `OnTick` : mise à jour floating P&L toutes les 60s si position ouverte (optionnel, activable)

**Payload HTTPS POST `/api/trades/ingest` :**
```json
{
  "ticket": 123456789,
  "symbol": "XAUUSD",
  "type": "buy",
  "volume": 0.100,
  "open_price": 2024.01,
  "close_price": 2024.38,
  "sl": 2023.50,
  "tp": 2025.00,
  "open_time": "2026-03-23T09:15:00Z",
  "close_time": "2026-03-23T11:29:00Z",
  "profit": 33.70,
  "commission": -0.70,
  "swap": 0.00,
  "magic": 12345,
  "comment": "breakout",
  "status": "closed"
}
```

Pour un trade **ouvert** : `close_price`, `close_time` sont `null`. `status = "open"`.

**Comportement upsert :** l'endpoint fait un `INSERT ... ON CONFLICT (ticket) DO UPDATE`. Ainsi :
1. Première réception : `status=open` → INSERT
2. Fermeture du trade : `status=closed` → UPDATE avec `close_price`, `close_time`, `profit` etc.

**Paramètres EA configurables :**
- `ServerURL` : `https://tradelog.onrender.com` (exemple)
- `ApiKey` : clé secrète brute (stockée dans les paramètres MT5, non dans l'EA compilé)
- `RetryAttempts` : 3 (backoff 1s, 3s, 9s)
- `SendFloatingPnl` : false (défaut)

**Types MT5 supportés :** `buy`, `sell`, `buy_limit`, `sell_limit`, `buy_stop`, `sell_stop`, `buy_stop_limit`, `sell_stop_limit`. Le champ `type` est `VARCHAR(20)`.

---

## 5. Backend FastAPI

### Endpoints

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| POST | `/api/trades/ingest` | API Key | Réception trade depuis EA (upsert) |
| GET | `/api/trades` | JWT | Liste paginée + filtres (symbol, date, session, status, direction) |
| GET | `/api/trades/{id}` | JWT | Détail d'un trade |
| PATCH | `/api/trades/{id}` | JWT | Mise à jour note/tags/psy_score |
| POST | `/api/trades/{id}/screenshot` | JWT | Upload screenshot → Supabase Storage (multipart/form-data, JPEG/PNG/WEBP, max 10MB) |
| GET | `/api/stats/summary?account_id=` | JWT | KPIs globaux (P&L, win rate, R:R, drawdown, profit factor, expected value, Sharpe) |
| GET | `/api/stats/by-symbol?account_id=` | JWT | P&L + win rate par paire |
| GET | `/api/stats/by-session?account_id=` | JWT | London / NY / Asia |
| GET | `/api/stats/equity-curve?account_id=` | JWT | Série temporelle equity (calculée à la volée depuis `trades`) |
| GET | `/api/stats/heatmap?account_id=` | JWT | P&L agrégé par heure UTC × jour semaine |
| GET | `/api/stats/calendar?account_id=` | JWT | P&L net par date du mois |
| GET | `/api/stats/streaks?account_id=` | JWT | Streaks wins/losses max et courant |
| GET | `/api/accounts` | JWT | Liste des comptes |
| POST | `/api/accounts` | JWT | Créer un compte (génère clé API, retourne valeur brute une seule fois) |
| GET | `/api/accounts/{id}` | JWT | Détail compte |
| PATCH | `/api/accounts/{id}` | JWT | Modifier compte |
| POST | `/api/accounts/{id}/rotate-key` | JWT | Régénérer la clé API EA |
| GET | `/api/notes?date=` | JWT | Notes du journal libre par date (global user, pas de filtre account_id — voir Section 6) |
| POST | `/api/notes` | JWT | Créer une note |
| PATCH | `/api/notes/{id}` | JWT | Modifier une note |
| DELETE | `/api/notes/{id}` | JWT | Supprimer une note |
| GET | `/api/alerts?account_id=` | JWT | Liste des alertes configurées |
| POST | `/api/alerts` | JWT | Créer une alerte |
| DELETE | `/api/alerts/{id}` | JWT | Supprimer une alerte |
| GET | `/api/export/pdf?account_id=&month=2026-03` | JWT | Génère et retourne rapport PDF mensuel (binary download) |
| GET | `/api/calculator/lots?risk_pct=&sl_pips=&account_id=` | JWT | Calcul lots (côté backend pour récupérer capital depuis DB) |

### Calculs effectués à l'ingestion (trade `closed`)

- **P&L net** = `profit + commission + swap`
- **R:R réalisé** = `abs(close_price - open_price) / abs(open_price - sl)` (si sl != 0)
- **Durée** = `close_time - open_time` en minutes
- **Session** : priorité à la session la plus active — overlap London/NY (13h–16h UTC) → classé "overlap" (valeur distincte), pas London ni NY seul
  - Asia : 00h–08h UTC
  - London : 08h–13h UTC
  - Overlap : 13h–16h UTC
  - NY : 16h–21h UTC
  - Off-hours : 21h–24h UTC

### Calcul Sharpe simplifié

`Sharpe = (mean_daily_pnl - risk_free_rate_daily) / std_daily_pnl`
- `risk_free_rate_daily = 0` (simplifié, noté tel quel dans l'UI)
- Calculé sur les 30 derniers jours glissants avec au minimum 10 jours de données

### Equity curve (calculée à la volée)

Pas de scheduler ni de table `daily_snapshots`. L'equity est reconstituée à chaque appel `/api/stats/equity-curve` :
1. Récupérer tous les trades `closed` de l'`account_id`, triés par `close_time`
2. Somme cumulée de `pnl_net` + `initial_capital`
3. Retourner la série `[{date, equity, drawdown_pct}]`

Drawdown correct : `drawdown_pct = (peak_equity - equity) / peak_equity * 100`
`peak_equity` = max de l'equity cumulée jusqu'au point courant.

### Alertes — déclenchement

Les alertes sont vérifiées **automatiquement après chaque ingestion réussie** dans le handler `POST /api/trades/ingest`. Si le drawdown journalier dépasse le seuil ou si le streak de pertes atteint le threshold, un email est envoyé via **Resend API** (free tier : 3 000 emails/mois). Champ `last_triggered_at` mis à jour pour éviter le re-déclenchement le même jour.

### PDF export

- Bibliothèque : **WeasyPrint** (HTML → PDF côté serveur)
- Contenu : equity curve (image SVG), tableau stats du mois, top 5 trades, worst 5 trades
- Paramètre : `month=YYYY-MM`
- Réponse : `Content-Type: application/pdf`, binary download

---

## 6. Base de données (Supabase PostgreSQL)

### Règle générale

Toutes les tables ont `user_id UUID REFERENCES auth.users(id) NOT NULL` et une politique RLS `auth.uid() = user_id`. Le backend bypass RLS via `service_role`.

### Tables

**`accounts`**
```sql
id               UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id          UUID REFERENCES auth.users(id) NOT NULL
name             VARCHAR(100)
broker           VARCHAR(50)
account_number   VARCHAR(50)
initial_capital  DECIMAL(12,2)
currency         VARCHAR(3) DEFAULT 'USD'
is_live          BOOLEAN DEFAULT true
api_key_hash     TEXT NOT NULL          -- SHA-256 hex de la clé brute
created_at       TIMESTAMPTZ DEFAULT now()
```

**`trades`**
```sql
id               UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id          UUID REFERENCES auth.users(id) NOT NULL
account_id       UUID REFERENCES accounts(id) NOT NULL
ticket           BIGINT NOT NULL
UNIQUE(account_id, ticket)             -- un ticket est unique par compte
symbol           VARCHAR(20) NOT NULL
type             VARCHAR(20) NOT NULL  -- 'buy'|'sell'|'buy_limit'|etc.
volume           DECIMAL(10,3) NOT NULL
open_price       DECIMAL(12,5)
close_price      DECIMAL(12,5)
sl               DECIMAL(12,5)
tp               DECIMAL(12,5)
open_time        TIMESTAMPTZ
close_time       TIMESTAMPTZ
profit           DECIMAL(10,2)
commission       DECIMAL(10,2)
swap             DECIMAL(10,2)
pnl_net          DECIMAL(10,2)        -- calculé à l'ingestion
rr_realized      DECIMAL(6,3)        -- calculé à l'ingestion
duration_min     INTEGER             -- calculé à l'ingestion
session          VARCHAR(12)         -- 'asia'|'london'|'overlap'|'ny'|'off'
status           VARCHAR(10) NOT NULL DEFAULT 'open'  -- 'open'|'closed'
-- Champs manuels (mis à jour via PATCH)
note             TEXT
tags             TEXT[]
psy_score        SMALLINT CHECK (psy_score BETWEEN 1 AND 5)
screenshot_url   TEXT
magic            INTEGER             -- magic number EA (audit, non filtré par défaut)
comment          VARCHAR(255)
created_at       TIMESTAMPTZ DEFAULT now()
updated_at       TIMESTAMPTZ DEFAULT now()

-- Index
INDEX ON trades (account_id, open_time DESC)
INDEX ON trades (account_id, symbol)
INDEX ON trades (account_id, status)
INDEX ON trades (account_id, session)
INDEX ON trades (account_id, close_time DESC)
```

**`notes`**

Les notes sont **globales par utilisateur** (non liées à un compte spécifique) : un journal de trading est une réflexion personnelle indépendante du compte live ou demo. Pas de `account_id` sur cette table — c'est un choix délibéré.

```sql
id               UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id          UUID REFERENCES auth.users(id) NOT NULL
date             DATE NOT NULL
content          TEXT NOT NULL
created_at       TIMESTAMPTZ DEFAULT now()
updated_at       TIMESTAMPTZ DEFAULT now()
UNIQUE(user_id, date)
```

**`alerts`**
```sql
id               UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id          UUID REFERENCES auth.users(id) NOT NULL
account_id       UUID REFERENCES accounts(id) NOT NULL
type             VARCHAR(30) NOT NULL   -- 'daily_drawdown'|'loss_streak'
threshold        DECIMAL(6,2) NOT NULL  -- % pour drawdown, N pour streak
email            VARCHAR(255) NOT NULL
active           BOOLEAN DEFAULT true
last_triggered_at TIMESTAMPTZ           -- pour éviter re-déclenchement
created_at       TIMESTAMPTZ DEFAULT now()
```

**`alert_history`**

Accès via join sur `alerts(id)` → `user_id`. Politique RLS : `EXISTS (SELECT 1 FROM alerts WHERE alerts.id = alert_history.alert_id AND alerts.user_id = auth.uid())`.

```sql
id               UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id          UUID REFERENCES auth.users(id) NOT NULL   -- dénormalisé pour RLS direct
alert_id         UUID REFERENCES alerts(id)
triggered_at     TIMESTAMPTZ DEFAULT now()
payload          JSONB                  -- valeur qui a déclenché l'alerte
```

---

## 7. Frontend React

### Pages & Navigation

```
/login                  → Login via Supabase Auth SDK
/dashboard              → KPIs + equity curve + P&L par paire + derniers trades
/journal                → Table trades, filtres, pagination
/journal/:id            → Détail trade + note + tags + psy_score + screenshot
/stats                  → Heatmap + sessions + distribution + streaks
/performance            → Equity curve + drawdown overlay + comparaison mensuelle
/calendar               → Cases P&L par jour du mois
/notes                  → Journal libre (une note par date)
/settings               → Config EA, alertes, objectifs, export PDF, gestion comptes
```

### Sélecteur de compte actif

Un `Zustand` store conserve `activeAccountId`. Toutes les requêtes API envoient `?account_id=<id>`. La sidebar affiche le compte actif et permet de switcher (dropdown). L'`account_id` est inféré à l'ingestion depuis la clé API (lookup dans `accounts` par `api_key_hash`).

### Calculateur de position

Page `/settings` ou widget flottant. Appelle `GET /api/calculator/lots` avec `risk_pct`, `sl_pips`. Le backend récupère `initial_capital` depuis `accounts` et retourne `lots`. Formule :
```
lot_size = (capital × risk_pct / 100) / (sl_pips × pip_value_per_lot)
```
`pip_value_per_lot` est une table statique côté backend (dict Python) :

```python
PIP_VALUES = {
    # Paires USD quote : pip = 0.0001, lot = 100 000 unités → $10/pip/lot
    "EURUSD": 10.0, "GBPUSD": 10.0, "AUDUSD": 10.0, "NZDUSD": 10.0,
    # Paires USD base : pip value en quote, converti en USD
    "USDJPY": 9.09,   # ~$1000/0.01pip/lot, variable — valeur approx fixe
    "USDCHF": 10.0,
    "USDCAD": 7.69,
    # Cross : approximations fixes
    "EURGBP": 12.5, "EURJPY": 6.8,
    # XAUUSD : 1 pip = 0.01, lot = 100 oz → $1/pip/lot
    "XAUUSD": 1.0,
    # Indices (US30, NAS100 etc.) : non supportés v1
}
# Fallback pour symbole inconnu : retourner {"error": "symbol_not_supported"}
```

Pour les paires à pip value variable (USDJPY, USDCAD), la valeur est une approximation fixe documentée comme telle dans l'UI.

### Features trade replay

**Simplification :** pas de données OHLC. Le "replay" est une vue statique montrant :
- Prix d'entrée, SL, TP, prix de sortie sur une règle verticale normalisée
- Pas de chart de prix historiques (hors scope v1)

### Design System

**Typographie :** Inter (Variable), `-apple-system` fallback
- `tabular-nums` sur tous les chiffres financiers
- Titres de page : weight 800, letter-spacing -0.8px

**Couleurs :**
```
Background app      : #F2F2F7
Card white          : #FFFFFF
Card dark (KPI hero): #0A0A0A
Text primary        : #000000
Text secondary      : #3C3C43
Text tertiary       : #8E8E93
Separator           : #E5E5EA
Positive            : #28A745
Negative            : #E8342A
Live/Active         : #34C759
```

**Composants custom (SVG, aucune lib d'icônes) :**
- Logo mark candlestick géométrique SVG
- Segmented control style macOS
- Live pill animée (dot CSS pulsant)
- Badges BUY/SELL avec micro-flèche SVG
- Badges WIN/LOSS (noir plein / gris neutre)
- Cards KPI hero dark + cards white
- Barres graphe avec gloss subtle

**Layout :**
- Sidebar fixe 214px + Main scrollable
- Grid 8px base unit
- Border radius : 10px nav, 14px account card, 16px cards

---

## 8. Features

### Auto-sync MT5
- EA push HTTPS temps réel sur chaque `DEAL_ADD`
- Upsert sur `(account_id, ticket)` — gère open→closed
- Retry 3x (1s / 3s / 9s)
- Live dot animé sidebar (dernier ping < 5min)

### Analytics
- **Heatmap** : P&L moyen par heure UTC (0–23) × jour semaine (Lu–Di)
- **Equity curve** + zone drawdown colorée (calculé à la volée)
- **Distribution P&L** : histogramme par bucket de $50
- **Sessions** : Asia / London / Overlap / NY — win rate + P&L + nb trades
- **Streaks** : max wins, max losses, streak actuel
- **Profit Factor**, **Expected Value**, **Sharpe simplifié** (risk-free = 0, affiché avec mention)

### Journal enrichi
- Upload screenshot PNG/JPEG/WEBP max 10MB → Supabase Storage (bucket `screenshots`)
- Tags libres (array)
- Score psychologique 1–5
- Note textuelle
- Vue statique entry/SL/TP/exit sur règle verticale normalisée

### Outils
- **Calculateur lots** : widget dans Settings + accessible depuis journal
- **Alertes email** via Resend : drawdown journalier > X%, N pertes consécutives
- **Export PDF mensuel** : WeasyPrint, binary download
- **Calendrier** : P&L net par jour, coloré vert/rouge
- **Multi-comptes** : live + demo, switch dans sidebar

---

## 9. Variables d'environnement

### Backend (Render)
```
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # bypass RLS
SUPABASE_JWT_SECRET=...            # pour vérifier les JWT frontend
RESEND_API_KEY=re_...              # emails d'alerte
CORS_ORIGINS=https://tradelog.vercel.app
```

### Frontend (Vercel)
```
VITE_API_URL=https://tradelog.onrender.com
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...     # clé publique anon
```

### Local (`.env.example` à la racine backend et frontend)
Les mêmes variables avec valeurs vides ou locales.

---

## 10. Structure des dossiers

```
trading-journal/
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   ├── .env.example
│   ├── routers/
│   │   ├── trades.py
│   │   ├── stats.py
│   │   ├── accounts.py
│   │   ├── notes.py
│   │   ├── alerts.py
│   │   ├── calculator.py
│   │   └── export.py
│   ├── models/
│   │   ├── trade.py
│   │   ├── account.py
│   │   ├── note.py
│   │   └── alert.py
│   ├── services/
│   │   ├── calculator.py     # P&L, R:R, session, drawdown, Sharpe
│   │   ├── pdf.py            # WeasyPrint
│   │   ├── alerts.py         # Resend email
│   │   ├── auth.py           # JWT verification (Supabase JWKS)
│   │   └── storage.py        # Supabase Storage (screenshots)
│   └── db/
│       └── supabase.py
├── frontend/
│   ├── .env.example
│   └── src/
│       ├── pages/
│       │   ├── Login.tsx
│       │   ├── Dashboard.tsx
│       │   ├── Journal.tsx
│       │   ├── TradeDetail.tsx
│       │   ├── Stats.tsx
│       │   ├── Performance.tsx
│       │   ├── Calendar.tsx
│       │   ├── Notes.tsx
│       │   └── Settings.tsx
│       ├── components/
│       │   ├── ui/             # design system components
│       │   ├── charts/         # Recharts wrappers
│       │   └── layout/         # Sidebar, Topbar
│       ├── lib/
│       │   ├── api.ts
│       │   ├── supabase.ts
│       │   └── formatters.ts
│       └── stores/
│           └── account.ts      # Zustand : activeAccountId
├── ea/
│   └── TradeLogEA.mq5
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql
└── docs/
    └── superpowers/specs/
        └── 2026-03-23-trading-journal-design.md
```

---

## 11. Déploiement

1. Créer projet Supabase → exécuter `001_initial_schema.sql` → activer RLS
2. Push `backend/` GitHub → connecter à Render (web service Python, free)
3. Configurer variables d'env Render (Section 9)
4. Push `frontend/` → connecter à Vercel (auto-deploy)
5. Configurer variables d'env Vercel (Section 9)
6. Dans MT5 : copier `TradeLogEA.mq5` → Experts → compiler → attacher au chart avec `ServerURL` + `ApiKey`
7. Configurer UptimeRobot pour pinger `https://tradelog.onrender.com/health` toutes les 10min

---

## 12. Critères de succès

- [ ] Chaque trade MT5 apparaît dans le journal < 5s (serveur chaud)
- [ ] Dashboard charge < 1.5s
- [ ] Accessible et fonctionnel sur mobile (responsive)
- [ ] Coût hébergement : 0$/mois
- [ ] EA installable en < 5 minutes dans MT5
- [ ] Screenshot uploadable depuis le détail d'un trade
- [ ] Alerte email reçue en < 2min après dépassement de seuil
