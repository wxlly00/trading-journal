# Trading Journal

Journal de trading personnel avec connexion automatique à MetaTrader 5.

**Fonctionnalités :**
- Suivi automatique des trades via un EA MetaTrader 5
- Statistiques détaillées (win rate, drawdown, facteur de profit…)
- Calendrier économique intégré (Finnhub)
- Analyse IA de tes performances (Claude)
- Notes vocales sur chaque trade
- Recherche globale, animations, mode sombre

---

## Option 1 — Utiliser la version en ligne (recommandé)

Aucune installation. Tu crées un compte, c'est tout.

**Lien :** [tradingjournal-app-ten.vercel.app](https://tradingjournal-app-ten.vercel.app)

1. Clique sur **"Créer un compte"**
2. Entre ton email et un mot de passe
3. Confirme ton email (vérifie tes spams)
4. C'est prêt — ton journal est vide et t'appartient

> Tes données sont isolées des autres utilisateurs. Seul l'administrateur du serveur a accès à la base de données.

---

## Option 2 — Installer sur ta machine (auto-hébergé)

Tu veux tes propres données sur ton propre serveur. Il faut :

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (gratuit)
- Un compte [Supabase](https://supabase.com) gratuit
- 15 minutes

### Étape 1 — Télécharger le projet

```bash
git clone https://github.com/wxlly00/trading-journal.git
cd trading-journal
```

> Pas de Git ? Télécharge le ZIP sur GitHub → bouton vert **"Code"** → **"Download ZIP"**, puis décompresse.

### Étape 2 — Créer ta base de données Supabase

1. Va sur [supabase.com](https://supabase.com) → **"Start your project"** → crée un compte
2. Clique **"New project"**, choisis un nom et un mot de passe (retiens-le)
3. Attends ~2 minutes que le projet démarre
4. Va dans **SQL Editor** (menu gauche)
5. Clique **"New query"**, copie-colle le contenu du fichier `supabase/migrations/001_initial_schema.sql`, puis clique **"Run"**
6. Va dans **Settings → API** et copie ces 3 valeurs :

| Ce que tu cherches | Où c'est |
|---|---|
| **Project URL** | Settings → API → Project URL |
| **anon public** | Settings → API → Project API keys |
| **service_role** | Settings → API → Project API keys (clique "Reveal") |

### Étape 3 — Configurer l'application

```bash
cp .env.example .env
```

Ouvre le fichier `.env` avec un éditeur de texte (Notepad, VS Code…) et remplace :

```env
SUPABASE_URL=https://TONPROJET.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...  ← colle la service_role ici

VITE_SUPABASE_URL=https://TONPROJET.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...    ← colle l'anon public ici

CORS_ORIGINS=http://localhost
```

### Étape 4 — Lancer l'application

```bash
docker compose up --build
```

La première fois, ça télécharge les images (~2-3 minutes).

Ouvre ensuite **http://localhost** dans ton navigateur.

Pour arrêter :

```bash
docker compose down
```

Pour relancer plus tard (sans rebuild) :

```bash
docker compose up
```

---

## Connecter MetaTrader 5 (import automatique des trades)

L'EA envoie tes trades directement dans le journal à chaque ouverture/fermeture.

### Installation de l'EA

1. Dans MetaTrader 5, ouvre **MetaEditor** (F4 ou menu Outils)
2. Dans MetaEditor : **Fichier → Ouvrir** → navigate jusqu'à `ea/TradeLogEA.mq5`
3. Clique **Compiler** (F7) — vérifie qu'il n'y a pas d'erreurs en bas
4. Retourne dans MT5, ouvre un graphique (n'importe quelle paire)
5. Dans le **Navigateur** (Ctrl+N), rubrique **Expert Advisors** → double-clique sur **TradeLogEA**
6. Dans l'onglet **Inputs**, configure :

| Paramètre | Valeur |
|---|---|
| `ApiUrl` | `https://tradingjournal-api.vercel.app` (ou `http://localhost:8000` en local) |
| `ApiKey` | Ton token JWT (récupère-le dans l'app → Paramètres → API Key) |

7. Coche **"Autoriser le trading automatisé"** → OK

Les trades s'importent désormais automatiquement.

---

## Mise à jour

```bash
git pull
docker compose up --build
```

---

## Problèmes fréquents

| Problème | Solution |
|---|---|
| La page ne s'ouvre pas | Vérifie que Docker Desktop est bien lancé |
| Port 80 déjà utilisé | Dans `docker-compose.yml`, remplace `"80:80"` par `"8080:80"`, puis va sur http://localhost:8080 |
| Erreur "Invalid API key" | Vérifie les clés dans `.env` — pas d'espaces avant/après |
| Email de confirmation pas reçu | Vérifie les spams, ou dans Supabase → Authentication → désactive "Confirm email" pour les tests |
| L'EA ne se connecte pas | Dans MT5 → Outils → Options → Expert Advisors → coche "Autoriser les requêtes Web" et ajoute ton domaine |

---

## Stack technique

| Couche | Technologie |
|---|---|
| Frontend | React 18 + Vite + TypeScript + TailwindCSS |
| Backend | FastAPI (Python) |
| Base de données | PostgreSQL via Supabase |
| Auth | Supabase Auth |
| Hébergement | Vercel (frontend + backend) |
| EA | MQL5 (MetaTrader 5) |
