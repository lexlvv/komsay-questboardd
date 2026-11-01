# KOMSAY Questboard (Vercel edition)

Rebuild of the PHP/MySQL admin panel so it runs free on Vercel. Vercel cannot run PHP or MySQL, so this version uses:

| Layer | Technology |
|---|---|
| Pages | Static HTML/CSS/JS in `public/` |
| Backend | Vercel serverless functions in `api/` (Node.js) |
| Database | PostgreSQL on Supabase or Neon (free tier) |

Features kept from the original: admin login, dashboard, participants (search, add, add/deduct points with the insufficient-points check, print rankings), reports (distribution, monthly trend), history log, and the public leaderboard at `/` (auto-refreshes every minute). Admin is at `/admin`.

One change: the public leaderboard no longer shows participant emails. Ask your adviser before restoring them (Data Privacy Act, RA 10173).

```
public/   index.html (public board), admin.html, admin.js, styles.css, icon.jpg
api/      [...route].js (all endpoints), _lib.js (database + session helpers)
db/       schema.sql
```

## 1. Create the database (Supabase)

1. Sign up at https://supabase.com and create a project. Save the database password.
2. Open **SQL Editor**, paste all of `db/schema.sql`, and click **Run**.
3. Click **Connect** at the top and copy the **Transaction pooler** connection string (port 6543). Replace `[YOUR-PASSWORD]` with your password. This is your `DATABASE_URL`.

(Neon works too: create a project and copy its connection string.)

## 2. Push to GitHub

```bash
git init
git add .
git commit -m "KOMSAY Questboard"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/komsay-questboard.git
git push -u origin main
```

## 3. Deploy on Vercel

1. Go to https://vercel.com, sign in with GitHub, then **Add New → Project** and import the repository.
2. Leave **Framework Preset** as Other and leave the build settings empty.
3. Open **Environment Variables** and add:
   - `DATABASE_URL` = your connection string
   - `SESSION_SECRET` = a long random string (generate one with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
4. Click **Deploy**. Then open `https://YOUR-PROJECT.vercel.app/admin`.

## Admin login

`schema.sql` creates the same admin account as your old database (`csso.comrecs.2025@gmail.com`) with the same password hash, so the old password still works. To change it, generate a new hash and update the table in the Supabase SQL Editor:

```bash
npm install
node -e "console.log(require('bcryptjs').hashSync('NEW-PASSWORD', 10))"
```
```sql
update admins set password_hash = 'PASTE-HASH-HERE' where email = 'csso.comrecs.2025@gmail.com';
```

## Move your existing data

Export each MySQL table to CSV (phpMyAdmin → Export) and import `participants` and `point_transactions` through Supabase **Table Editor → Import data from CSV**. Import participants first so the IDs match.

## Run locally (optional)

```bash
npm install
npm i -g vercel
cp .env.example .env     # fill in the values
vercel dev
```

## Troubleshooting

- **Login says "Server error":** check `DATABASE_URL` and `SESSION_SECRET` in Vercel → Settings → Environment Variables, then redeploy.
- **Connection errors on Supabase:** use the pooler connection string (port 6543), not the direct one.
- **404 on /admin:** `vercel.json` must be at the repository root with `public/` next to it.
