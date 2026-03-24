# Installation locale — Trading Journal

## Prérequis

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows / Mac / Linux)
- Un compte [Supabase](https://supabase.com) gratuit

---

## Étape 1 — Cloner le projet

```bash
git clone https://github.com/wxlly00/trading-journal.git
cd trading-journal
```

## Étape 2 — Configurer Supabase

1. Crée un projet sur [supabase.com](https://supabase.com) (gratuit)
2. Va dans **Settings → API** et copie :
   - **Project URL** → `SUPABASE_URL` et `VITE_SUPABASE_URL`
   - **anon public** → `VITE_SUPABASE_ANON_KEY`
   - **service_role secret** → `SUPABASE_SERVICE_ROLE_KEY`
3. Va dans **SQL Editor** et exécute le fichier `supabase/schema.sql`
   Le fichier est dans `supabase/migrations/001_initial_schema.sql`

## Étape 3 — Créer le fichier `.env`

```bash
cp .env.example .env
```

Ouvre `.env` et remplace les valeurs par les tiennes.

## Étape 4 — Lancer l'application

```bash
docker compose up --build
```

> La première fois, ça prend ~2-3 minutes (téléchargement des images).

Ouvre ensuite **http://localhost** dans ton navigateur. ✓

---

## Commandes utiles

```bash
# Démarrer en arrière-plan
docker compose up -d --build

# Arrêter
docker compose down

# Voir les logs
docker compose logs -f

# Reconstruire après une mise à jour du code
docker compose up --build
```

---

## Mise à jour

```bash
git pull
docker compose up --build
```

---

## Résolution de problèmes

| Problème | Solution |
|----------|----------|
| Port 80 déjà utilisé | Changer `"80:80"` en `"8080:80"` dans `docker-compose.yml` puis ouvrir http://localhost:8080 |
| Erreur de connexion Supabase | Vérifier les clés dans `.env` |
| Page blanche | Vérifier `docker compose logs frontend` |
