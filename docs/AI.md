# AI assistant

## Enabling it

Set on the server and restart:

```bash
ANTHROPIC_API_KEY=sk-ant-...     # from console.anthropic.com (paid API account)
AI_MODEL=claude-opus-5           # optional; any Claude model ID
AI_DAILY_REQUEST_LIMIT=200       # optional
```

**Settings → AI** shows the provider, model, whether a key is present (never the key itself), usage per day, errors, and an optional cost estimate (`AI_PRICE_INPUT_PER_MTOK` / `AI_PRICE_OUTPUT_PER_MTOK`).

Without a key the assistant runs in **offline mode**: it answers common questions (priorities, missing information, releases, overdue tasks, finances, overview) directly from stored data and never generates new text. Everything else in the app works the same.

## How it works

`src/lib/ai/assistant.ts` runs a manual tool-use loop with the Anthropic TypeScript SDK (server-side only):

- **Read tools** (`src/lib/ai/tools.ts`) return stored data: overview, profile (legal name excluded), missing information, tracks, releases with checklists, tasks, campaigns, content, contacts, finances (actual values only, demo excluded), analytics with source/verification, phase status. Sensitive documents are never exposed.
- **Proposal tools** (`propose_tasks`, `propose_release`, `propose_information`, `propose_content`, `propose_outreach_draft`, `propose_campaign`) **never change data**. They validate the referenced ids/fields and store a *pending proposal*. You approve or reject each one in the chat; only then `src/lib/ai/apply.ts` re-validates and writes it (tagged with source `assistant`).
- Adaptive thinking, `effort: medium`, prompt caching, and server-side refusal fallbacks (`AI_REFUSAL_FALLBACK=default`) are enabled. Refusals and errors are handled and shown as plain messages; usage and errors are recorded per day.
- The system prompt forbids inventing data, claiming external actions, and giving legal/tax advice, and asks for the *current situation → what’s missing → next step → why → recommended action → approval* structure.

## Guarantees

| The assistant can | The assistant cannot |
|---|---|
| Read your saved data | Access external services or the internet |
| Identify missing information and ask for it | Publish, send, spend, register or delete anything |
| Draft plans, tasks, captions, emails, campaigns | Change data without your approval |
| Save information you told it — after approval | Enter legal names, ownership splits or financial records |

## Other providers

The provider is selected by `AI_PROVIDER`; only `anthropic` is implemented. To add one, implement the same loop (tools are plain JSON Schemas) in a new module and switch on `aiConfig().provider` in `src/lib/actions/assistant.ts`.
