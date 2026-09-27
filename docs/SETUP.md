# Setup & configuration

## Requirements

| Component | Version | Notes |
|---|---|---|
| Node.js | 20 or newer (22 LTS recommended) | |
| PostgreSQL | 14 or newer | Any managed Postgres works (Neon, Supabase, RDS, Railway…) |
| Disk | Space for uploads | Files are stored in `STORAGE_DIR` |

No paid service is required to run the application.

## Environment variables

Copy `.env.example` to `.env`. Only `DATABASE_URL` is required.

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `DATABASE_URL` | **yes** | — | PostgreSQL connection string |
| `ALLOW_SIGNUP` | no | `false` | Allow additional accounts after the first one (first sign-up is always allowed) |
| `STORAGE_DIR` | no | `./storage` | Directory for uploaded files (outside the web root; never served directly) |
| `MAX_UPLOAD_MB` | no | `200` | Maximum size per uploaded file |
| `AI_PROVIDER` | no | `anthropic` | AI provider (Anthropic Claude is implemented) |
| `ANTHROPIC_API_KEY` | no | — | Enables the full AI assistant. Without it the assistant runs in offline mode |
| `AI_MODEL` | no | `claude-opus-5` | Claude model ID |
| `AI_REFUSAL_FALLBACK` | no | `default` | `default` enables server-side refusal fallbacks, `off` disables |
| `AI_DAILY_REQUEST_LIMIT` | no | `200` | Assistant requests per user per day |
| `AI_PRICE_INPUT_PER_MTOK`, `AI_PRICE_OUTPUT_PER_MTOK` | no | — | Only for the cost *estimate* in Settings → AI |
| `CRON_SECRET` | no | — | Enables `POST /api/cron/automations` for an external scheduler |
| `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` | no | — | Spotify Web API sync (public artist data) |
| `YOUTUBE_API_KEY` | no | — | YouTube Data API sync (public channel statistics) |
| `TEST_DATABASE_URL` | tests only | — | Separate database for integration tests |
| `INSECURE_COOKIES` | no | — | Set `true` only when running a production build over plain HTTP on a private network |

Secrets are read on the server only. None is ever sent to the browser.

## Database

```bash
createdb mayfar
npm run db:migrate        # applies drizzle/*.sql
```

Changing the data model:

1. Edit `src/lib/db/schema.ts`.
2. `npm run db:generate -- --name describe_change` creates a new SQL migration in `drizzle/`.
3. Review the SQL, commit it, and run `npm run db:migrate` in every environment.

## Local development

```bash
npm install
npm run dev
```

- The first account created becomes the owner.
- Onboarding starts automatically; everything can be edited later.
- **Demo data**: Settings → Data & backup → *Load demo data* (every record is labelled `[Demo]` and removable).

## Tests

```bash
createdb mayfar_test
# set TEST_DATABASE_URL in .env
npm test                   # unit + integration (migrates the test DB automatically)
npm run build && ALLOW_SIGNUP=true npm start &
BASE_URL=http://localhost:3000 npm run test:e2e          # desktop smoke test
BASE_URL=http://localhost:3000 npm run test:e2e:mobile   # 390 px viewport, checks horizontal overflow
```

The e2e script uses `playwright-core` with an existing Chromium (`CHROMIUM_PATH`, default `/opt/pw-browsers/chromium`). Install one with `npx playwright install chromium` and point `CHROMIUM_PATH` at it if needed.
