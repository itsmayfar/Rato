@AGENTS.md

# MAYFAR Artist Manager — conventions

- Stack: Next.js 16 App Router + Server Actions, Drizzle/PostgreSQL, Tailwind v4 tokens. Read `docs/ARCHITECTURE.md` first.
- Every page and server action starts with `requireUser()`; every query is scoped by `userId`; ids from forms go through `assertOwned`.
- `"use server"` files export only actions `(prev: ActionState, form: FormData)`. Put helpers that take a `userId` in `server-only` modules, never in action files.
- Validation lives in field definitions (`src/lib/fields.ts`, `src/lib/forms.ts`, `src/lib/info/registry.ts`) — reuse them for forms and server parsing.
- Domain logic stays pure over `BusinessContext` (`src/lib/context.ts`) and is unit-tested in `tests/`.
- Never fabricate data; label estimates; external actions need explicit user confirmation; demo rows (`is_demo`) never count in finance totals.
- Schema change → `npm run db:generate -- --name <change>` and commit the SQL.
- Before pushing: `npm run typecheck && npm test && npm run build`.
