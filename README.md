# MAYFAR Artist Manager

**Sound becomes feeling.** An AI-assisted music business operating system for **MayFar** — an independent electronic artist and producer. It organises the whole artist business in one place: production, rights, releases, marketing, content, audience, finances, contacts, tasks and long-term strategy — and continuously works out what is missing and what to do next.

Dark-first, black / red / white, responsive from phone to desktop.

## What it does

| Area | Highlights |
|---|---|
| **Dashboard** | “What should I do next?” (ranked, with *why*, effort and required info), today’s priorities, deadlines, blockers, releases, marketing, finances and audience at a glance |
| **Information engine** | Every piece of business information has a definition, validation, status (*complete / missing / needs confirmation / invalid / outdated / not applicable*), source and history. Workflows ask **only** for what’s missing, explain why, allow skip / N/A, and show a confirmation summary before legal or financial changes |
| **Onboarding** | 8 steps (identity, goals, music identity, catalog, platforms, business, team, tools), resumable, then generates the first tasks and recommended phase |
| **10 workflow phases** | Foundation → Production → Rights → Release planning → Marketing → Content → Release execution → Post-release growth → Finances → Career strategy. Each has required info, template tasks, live checks, blockers, completion criteria and a next action |
| **Music catalog** | Tracks with metadata, customisable workflow timeline, audio/asset versions (secure uploads, approvals), credits, feedback and connections |
| **Rights & royalties** | Composition and master splits validated to 100 %, confirmations, samples & licences, agreements, registrations — ownership is never assumed |
| **Release Manager** | Wizard that reuses stored data, a checklist tailored to release type and preferences (auto-verified vs. external steps), deadlines scheduled back from the release date, release-day checklist, 24 h / 7 / 30 / 90-day reviews, calendar (month / week / list) |
| **Marketing & content** | Campaigns from plan templates, ad plans that require explicit spend approval, content pipeline with approval gates, social planner calendar (day / week / month / list) |
| **Audience & analytics** | Manual, CSV and official-API data only — every value shows its source, period and verification. Charts with table views |
| **Finances** | Income / expenses with original currency and recorded FX rate, actual vs. estimated vs. forecast kept apart, budgets vs. actual, receipts |
| **Contacts** | Categories, outreach pipeline, follow-ups, drafts (never auto-sent) |
| **Tasks & projects** | List, board, calendar and timeline views; dependencies; recurring tasks; milestones |
| **Documents** | Private, versioned document library linked to tracks / releases / campaigns; sensitive flag |
| **AI assistant** | Claude-powered, reads only stored data through tools, proposes tasks / releases / campaigns / drafts that you approve. Works in offline mode without an API key |
| **Automations** | Deadline, overdue, missing-info, release-prep, content, review and follow-up reminders; weekly/monthly summaries; recurring tasks; execution log; approval option |
| **Reports** | 10 reports with date / track / campaign filters, CSV export, print-to-PDF |
| **Data** | CSV import/export, full JSON backup & transactional restore, `.ics` calendar export, clearly labelled demo data, audit log |

## Quick start (local)

Requirements: **Node.js 20+** and **PostgreSQL 14+**.

```bash
cp .env.example .env          # then edit DATABASE_URL if needed
npm install
createdb mayfar               # or use any empty PostgreSQL database
npm run db:migrate
npm run dev                   # http://localhost:3000
```

Open the app, create the owner account (the first sign-up is always allowed) and follow onboarding. Optional: load sample data from **Settings → Data & backup → Load demo data**.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` / `build` / `start` | Develop, build, run in production |
| `npm run db:migrate` | Apply database migrations |
| `npm run db:generate` | Create a migration after changing `src/lib/db/schema.ts` |
| `npm test` | Unit + integration tests (integration tests use `TEST_DATABASE_URL`) |
| `npm run test:e2e` / `test:e2e:mobile` | Browser smoke test against a running server (`BASE_URL`) |
| `npm run typecheck` | TypeScript check |
| `npm run automations:run` | Run due automations for all users (for cron) |
| `npm run demo:seed -- <email>` / `demo:remove -- <email>` | Load / remove labelled demo data |

## Documentation

- [Setup & configuration](docs/SETUP.md) — environment variables, database, local development
- [Deployment, backup & recovery](docs/DEPLOYMENT.md)
- [AI assistant](docs/AI.md)
- [Integrations](docs/INTEGRATIONS.md)
- [Architecture](docs/ARCHITECTURE.md) — structure, data model, engines, security
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [Status & roadmap](docs/STATUS.md) — what’s complete, known limitations, next steps

## Principles the software enforces

- Never invents facts, statistics, financial results or completed actions.
- Actual, estimated and forecast values are always labelled; demo data never mixes with real reports.
- Nothing is published, sent, spent, registered or deleted without explicit confirmation.
- External steps (distribution submission, publishing, ad spend) are only marked done when you confirm them.
- The app remains fully functional without any AI provider or external integration.
