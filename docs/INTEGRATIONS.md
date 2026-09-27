# Integrations

Only official APIs and authorised access are used. A service is shown as **Connected** only when its server credentials exist, you connected it, and it is enabled. Every synced value is stored as `source: api, verification: verified`; failures are recorded and shown, never hidden.

| Service | Status | Needs | What it does |
|---|---|---|---|
| **Spotify Web API** | Implemented | Spotify developer app → `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` (free) + your artist ID | Client-credentials access to public artist data: followers, popularity index |
| **YouTube Data API v3** | Implemented | Google Cloud API key → `YOUTUBE_API_KEY` (free quota) + channel ID | Subscribers, lifetime views |
| Spotify for Artists | Manual | — | No public API. Export CSVs from the dashboard → *Import CSV* (Audience & Analytics) |
| Instagram / TikTok | Manual | — | Graph / business APIs require app review. Record metrics manually or import CSV |
| Distributors | Manual | — | No artist APIs. Import royalty statements as CSV; confirm submissions in the release checklist |
| Google / Apple Calendar | Export | — | `.ics` download with releases, checklist deadlines, tasks and content |
| Email | Manual | — | Outreach drafts open in your email app (`mailto:`); sending is always yours to confirm |
| Cloud storage | Links | — | Store Dropbox/Drive links on documents and track versions |
| Claude (Anthropic) | Implemented | `ANTHROPIC_API_KEY` (paid) | See [AI.md](AI.md) |

## Setting up Spotify

1. Create an app at developer.spotify.com/dashboard (any redirect URI; it isn’t used).
2. Put the client ID and secret in the server environment and restart.
3. Settings → Integrations → Spotify Web API → **Connect**, paste your artist ID (`open.spotify.com/artist/<ID>`), then **Sync now**.

Note: Spotify has been restricting Web API fields for newer apps. If a field is not returned, the sync reports it instead of inventing values.

## Setting up YouTube

1. In Google Cloud Console enable *YouTube Data API v3* and create an API key (restrict it to that API).
2. Set `YOUTUBE_API_KEY`, restart, connect with your channel ID (`UC…`), sync.

## Adding an integration

Add a definition to `src/lib/integrations/registry.ts` and, for API syncs, a syncer in `src/lib/integrations/sync.ts` that returns `{ metric, value, platform }[]`. Keep secrets in environment variables; store only non-secret configuration (IDs) in the `integrations` table.
