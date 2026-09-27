# Deployment, backup & recovery

## Deploying

The app is a standard Next.js 16 Node server with PostgreSQL and a local file directory.

```bash
npm ci
npm run db:migrate
npm run build
NODE_ENV=production npm start          # listens on PORT (default 3000)
```

Checklist:

- Serve over **HTTPS** (session cookies are `Secure` in production).
- `DATABASE_URL` points to a backed-up PostgreSQL instance.
- `STORAGE_DIR` is on **persistent** disk (not an ephemeral container filesystem). On serverless hosts without a persistent disk, mount a volume or replace `src/lib/storage.ts` with an S3-compatible adapter (it exposes only `putStream`, `getStream`, `removeObject`).
- Leave `ALLOW_SIGNUP=false` after creating the owner account.
- Optional scheduler: call automations daily. Automations also run lazily whenever the dashboard is opened.

  ```bash
  # cron, e.g. every day at 07:00
  curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://your-domain/api/cron/automations
  # or, on the server itself
  npm run automations:run
  ```

Hosting options that fit: a VPS (Docker or systemd) with local Postgres; Railway / Render / Fly.io with a volume and managed Postgres. Uploads bypass Next’s proxy body buffer, so large audio files stream straight to disk (limit `MAX_UPLOAD_MB`).

### Reverse proxy

If you put nginx in front, raise its body size limit to at least `MAX_UPLOAD_MB`, e.g. `client_max_body_size 250m;`.

## Backups

Two layers — use both:

1. **Database**: `pg_dump --format=custom "$DATABASE_URL" > mayfar-$(date +%F).dump` on a schedule; keep copies off-server.
2. **Files**: back up `STORAGE_DIR` (e.g. `rsync`, `restic`, or snapshots).

In-app, **Settings → Data & backup → Download backup** exports every record of your account as JSON (files excluded).

## Recovery

- **Whole instance**: `pg_restore --clean --dbname "$DATABASE_URL" mayfar-YYYY-MM-DD.dump`, restore `STORAGE_DIR`, start the app.
- **One account**: Settings → Data & backup → *Restore a backup* with a JSON export. The restore replaces that account’s data in a single transaction — if anything fails nothing changes. File references in the backup work as long as `STORAGE_DIR` still contains the files.

## Upgrades

```bash
git pull
npm ci
npm run db:migrate
npm run build && restart
```
