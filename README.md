# TradingJournal

Journal de trading connecté à MetaTrader 5 via EA MQL5.

## Stack
- **Backend**: FastAPI + Supabase (PostgreSQL)
- **Frontend**: React 18 + Vite + TypeScript + TailwindCSS
- **EA**: MQL5 (MT5)
- **Hébergement**: Render (backend) + Vercel (frontend)

## Installation

### 1. Supabase
1. Créer un projet sur supabase.com
2. Exécuter `supabase/migrations/001_initial_schema.sql`
3. Récupérer URL, anon key, service_role key, JWT secret

### 2. Backend (Render)
1. Connecter le repo GitHub
2. Build: `pip install -r backend/requirements.txt`
3. Start: `cd backend && uvicorn main:app --host 0.0.0.0 --port $PORT`
4. Ajouter les variables d'environnement

### 3. Frontend (Vercel)
1. Connecter le repo GitHub
2. Ajouter les variables d'environnement Supabase + API URL

### 4. EA MetaTrader 5
1. Copier `ea/TradeLogEA.mq5` dans `MQL5/Experts/`
2. Compiler dans MetaEditor
3. Attacher à un graphique
4. Configurer `ApiUrl` et `ApiKey`

## Développement local

```bash
# Backend
cd backend
pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --reload

# Frontend
cd frontend
npm install
cp .env.example .env.local
npm run dev
```
