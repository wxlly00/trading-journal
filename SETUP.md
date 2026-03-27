# Guide d'installation détaillé

> Ce guide est le complément de README.md pour l'installation locale (Option 2).

---

## Prérequis

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) — Windows / Mac / Linux
- Un compte [Supabase](https://supabase.com) gratuit
- Un compte [GitHub](https://github.com) (pour cloner le repo)

---

## Installation pas à pas

### 1. Installer Docker Desktop

Télécharge et installe Docker Desktop pour ton système :
- [Windows](https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe)
- [Mac (Apple Silicon)](https://desktop.docker.com/mac/main/arm64/Docker.dmg)
- [Mac (Intel)](https://desktop.docker.com/mac/main/amd64/Docker.dmg)

Lance Docker Desktop et attends la baleine verte en bas à gauche.

### 2. Cloner le projet

**Avec Git (terminal) :**
```bash
git clone https://github.com/wxlly00/trading-journal.git
cd trading-journal
```

**Sans Git :**
1. Va sur https://github.com/wxlly00/trading-journal
2. Bouton vert **Code** → **Download ZIP**
3. Décompresse le ZIP
4. Ouvre un terminal dans le dossier décompressé

### 3. Créer le projet Supabase

1. Va sur [supabase.com](https://supabase.com) → **Start your project**
2. **New project** → donne un nom, définis un mot de passe fort, choisis une région proche de toi
3. Attends que le projet démarre (~2 minutes, barre de progression)

**Créer les tables :**
1. Menu gauche → **SQL Editor**
2. **New query**
3. Ouvre le fichier `supabase/migrations/001_initial_schema.sql` dans un éditeur texte
4. Copie tout le contenu et colle-le dans l'éditeur SQL
5. Clique **Run** (ou Ctrl+Entrée)
6. Tu dois voir "Success. No rows returned"

**Récupérer les clés API :**
1. Menu gauche → **Settings** → **API**
2. Copie et note ces valeurs :
   - **Project URL** (ex: `https://abcdefghij.supabase.co`)
   - **anon public** (longue chaîne commençant par `eyJ`)
   - **service_role** (clique "Reveal" puis copie)

### 4. Configurer les variables d'environnement

Dans le dossier du projet :

```bash
cp .env.example .env
```

Ouvre `.env` avec un éditeur texte et remplis :

```env
SUPABASE_URL=https://TON_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI...

VITE_SUPABASE_URL=https://TON_REF.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI...

CORS_ORIGINS=http://localhost
```

> Ne mets pas d'espace autour du `=`. Ne mets pas les clés entre guillemets.

### 5. Lancer l'application

```bash
docker compose up --build
```

Première exécution : ~3-5 minutes (téléchargement des images Docker).

Quand tu vois `frontend_1 | ready in Xms`, ouvre http://localhost dans ton navigateur.

---

## Commandes utiles

```bash
# Lancer (en arrière-plan)
docker compose up -d

# Arrêter
docker compose down

# Voir les logs en temps réel
docker compose logs -f

# Logs d'un seul service
docker compose logs -f backend
docker compose logs -f frontend

# Reconstruire après modification du code
docker compose up --build
```

---

## Mise à jour vers une nouvelle version

```bash
git pull
docker compose up --build
```

---

## Résolution de problèmes

### La page ne charge pas

Vérifie que Docker Desktop est bien lancé (baleine verte dans la barre de tâches).

```bash
docker compose ps  # doit afficher les conteneurs "running"
```

### Port 80 déjà utilisé

Modifie `docker-compose.yml`, change :
```yaml
ports:
  - "80:80"
```
en :
```yaml
ports:
  - "8080:80"
```
Puis va sur http://localhost:8080

### Erreur "connection refused" ou page blanche

```bash
docker compose logs backend  # cherche les erreurs Python
docker compose logs frontend # cherche les erreurs Node
```

### Erreur Supabase "Invalid API key"

- Vérifie qu'il n'y a pas d'espace avant/après les clés dans `.env`
- La `service_role` key doit être révélée (bouton "Reveal") avant de la copier
- Recrée le fichier `.env` proprement : `cp .env.example .env`

### L'email de confirmation n'arrive pas

Pour les tests, désactive la confirmation email :
Supabase → **Authentication** → **Providers** → **Email** → désactive "Confirm email"

### Réinitialiser complètement

```bash
docker compose down -v  # supprime aussi les volumes
docker compose up --build
```
