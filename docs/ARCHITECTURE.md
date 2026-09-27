# Architecture

## Stack

| Layer | Choice |
|---|---|
| App | Next.js 16 (App Router, React Server Components, Server Actions), React 19, TypeScript |
| Styling | Tailwind CSS v4 with design tokens (`src/app/globals.css`), bundled Outfit / JetBrains Mono fonts |
| Data | PostgreSQL + Drizzle ORM (`src/lib/db/schema.ts`, migrations in `drizzle/`) |
| Auth | Email + password (scrypt), hashed session tokens in the DB, httpOnly cookies |
| Validation | Shared field definitions (`src/lib/fields.ts`) used by forms, server actions and the information engine; zod for auth |
| Files | Streaming upload route → private storage directory, authenticated download route |
| Charts | Recharts (validated colour palette, table view for every chart) |
| AI | `@anthropic-ai/sdk`, server-side tool loop |
| Tests | Vitest (unit + PostgreSQL integration), playwright-core smoke tests |

## Layout

```
src/
  app/(auth)/            login, signup
  app/(app)/             every authenticated section (19 + Information Center, search, notifications)
  app/api/               upload, files, export (CSV/JSON/ICS), cron
  components/            ui/ (design system), shell/, info/ (question flow), feature components
  lib/
    db/                  schema + client
    info/                requirement registry, engine (pure), store (writes), questions
    workflow/            10 phase definitions + evaluation (pure), phase state
    releases/            checklist engine (pure), persistence
    recommendations.ts   “What should I do next?” (pure)
    finance.ts, rights.ts, csv.ts, search.ts   pure domain logic
    automations/         kinds, defaults, engine
    ai/                  config, tools, loop, offline mode, proposal applier
    integrations/        registry, API syncers
    actions/             server actions (all start with requireUser)
    context.ts           loads the complete business context for a user
```

## Core design

**Pure engines over a business context.** `loadContext(userId)` loads one artist’s data once per request. The information engine, phases, checklists, recommendations, finance and search are pure functions of that context — deterministic, fast and unit-tested without a database.

**Information engine.** `info/registry.ts` defines each requirement (entity, path, validation, why it matters, staleness). `info/engine.ts` evaluates status per field plus derived checks (approved master, splits = 100 %, samples, agreements, artwork…). `info_field_meta` stores overrides (not applicable / needs confirmation), provenance (`user`, `assistant`, `import`, `integration`) and the previous value. The `QuestionFlow` component asks only what’s missing, and `answerQuestions` writes only values that actually changed.

**Checklists.** Release checklist items are generated from the release type and wizard preferences. *Auto* items are verified live from data (they can’t be ticked manually); *external* items (submission, pitching, publishing) require explicit confirmation. Deadlines are recalculated when the release date changes.

**Generated tasks** use a unique `(user_id, source_key)` so they are never duplicated. “Missing information” tasks complete themselves only when the engine verifies the data; all other tasks require the user.

## Data model (main tables)

`users`, `sessions`, `user_settings`, `artist_profiles` (identity columns + JSON sections for goals, music identity, catalog summary, business, team, workflow prefs), `platform_links`, `goals`, `tracks`, `track_versions`, `track_collaborators`, `feedback_notes`, `rights_records`, `ownership_splits`, `releases`, `release_tracks`, `checklist_items`, `release_reviews`, `campaigns`, `ad_campaigns`, `content_items`, `tasks`, `task_dependencies`, `projects`, `milestones`, `phase_states`, `info_field_meta`, `contacts`, `outreach_records`, `transactions`, `budgets`, `documents`, `analytics_records`, `playlist_placements`, `integrations`, `notifications`, `automation_rules`, `automation_logs`, `ai_conversations`, `ai_messages`, `ai_proposed_actions`, `ai_usage`, `audit_logs`.

Every business row has `user_id` (FK, cascade on account deletion) and is always queried with it. Money is `numeric` with its currency; converted amounts keep rate, source and date. Date-only values are `date` strings. Status columns are text so users can add custom statuses. `is_demo` marks sample data.

## Security

- Every page and server action calls `requireUser()`; the proxy only performs an optimistic redirect.
- Every query is scoped by `user_id`; foreign ids from forms are checked with `assertOwned`.
- Server-action files export only actions that take form data (no helpers callable with arbitrary user ids).
- Passwords: scrypt; sessions: 32-byte random tokens, stored as SHA-256; login throttling.
- Uploads: size-limited streaming, generated storage keys, path-traversal guard, SHA-256 checksum. Downloads are owner-only, sandboxed with a strict CSP and `nosniff`; only safe media types render inline.
- CSV exports neutralise spreadsheet formula injection.
- Security headers (`X-Frame-Options`, `nosniff`, `Referrer-Policy`) from the proxy.
- Audit log for authentication, financial, legal/rights, deletion, approval and data export events. Secrets and passwords are never logged.
