# Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `DATABASE_URL is not set` on start | Copy `.env.example` to `.env` and set `DATABASE_URL`. |
| `relation "users" does not exist` | Migrations weren’t applied: `npm run db:migrate`. |
| Can’t create an account (“Sign-up is disabled”) | An owner exists. Sign in, or set `ALLOW_SIGNUP=true` temporarily. |
| Signed out immediately in production over HTTP | Cookies are `Secure` in production. Use HTTPS, or `INSECURE_COOKIES=true` on a private network only. |
| Too many sign-in attempts | Throttling (8 failures / 15 min per IP + email). Wait 15 minutes. |
| Upload fails with “File is too large” | Raise `MAX_UPLOAD_MB` (and your reverse proxy’s body limit, e.g. nginx `client_max_body_size`). |
| “The file is missing from storage” | The DB references a file that isn’t in `STORAGE_DIR` (moved server / lost volume). Restore the storage backup. |
| Assistant says “offline mode” | No `ANTHROPIC_API_KEY` on the server. See [AI.md](AI.md). |
| Assistant: “rejected the API key” / “model was not found” | Check `ANTHROPIC_API_KEY` and `AI_MODEL`. Errors appear per day in Settings → AI. |
| Spotify/YouTube sync error | The message is shown on the integration card. Check credentials, the artist/channel ID, and API quotas. |
| Totals ignore some records | Foreign-currency records without an exchange rate, estimates/forecasts, cancelled and demo records are excluded from actual totals by design — the UI says how many. |
| A checklist step can’t be ticked | It’s *auto-verified*: complete the underlying data (e.g. approve the master) and it completes itself. |
| Automations never run | They run when the dashboard opens, or via `npm run automations:run` / the cron endpoint with `CRON_SECRET`. Check Automations → Execution log. |
| CSV import rejected | Nothing is imported unless every row is valid; the error list shows row numbers. Dates must be `YYYY-MM-DD`. |
| Integration tests skipped | Set `TEST_DATABASE_URL` to a separate empty database. |
