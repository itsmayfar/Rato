import { desc, eq } from "drizzle-orm";
import { Badge, Card, CardHeader, KeyValue, Notice, PageHeader, Table, Td, Th } from "@/components/ui/primitives";
import { aiConfig } from "@/lib/ai/config";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { aiUsage } from "@/lib/db/schema";
import { formatDate, formatMoney, formatNumber } from "@/lib/utils";

export const metadata = { title: "AI settings" };

export default async function AiSettingsPage() {
  const user = await requireUser();
  const cfg = aiConfig();
  const usage = await db.select().from(aiUsage).where(eq(aiUsage.userId, user.id)).orderBy(desc(aiUsage.day)).limit(30);
  const tin = usage.reduce((s, u) => s + u.inputTokens, 0);
  const tout = usage.reduce((s, u) => s + u.outputTokens, 0);
  const cost = cfg.priceIn && cfg.priceOut ? (tin / 1e6) * cfg.priceIn + (tout / 1e6) * cfg.priceOut : null;
  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader eyebrow="Settings" title="AI provider" purpose="The assistant runs on the server. API keys are read from environment variables only and never reach the browser." />
      <Card>
        <CardHeader title="Configuration" action={<Badge tone={cfg.configured ? "success" : "warning"}>{cfg.configured ? "Configured" : "Not configured — offline mode"}</Badge>} />
        <KeyValue
          items={[
            { label: "Provider", value: cfg.provider === "anthropic" ? "Anthropic (Claude)" : `${cfg.provider} (unsupported)` },
            { label: "Model", value: <code>{cfg.model}</code> },
            { label: "API key", value: cfg.configured ? "Set on the server (hidden)" : "Missing — set ANTHROPIC_API_KEY" },
            { label: "Refusal fallback", value: cfg.fallbacks ? "Server-side fallback enabled (AI_REFUSAL_FALLBACK=default)" : "Off" },
            { label: "Daily request limit", value: formatNumber(cfg.dailyLimit) },
          ]}
        />
        <Notice className="mt-6" title="How to configure">
          Set <code>ANTHROPIC_API_KEY</code> (and optionally <code>AI_MODEL</code>, <code>AI_DAILY_REQUEST_LIMIT</code>) in the server environment and restart. Without a key, every standard workflow, checklist and form keeps working and the assistant answers from stored data.
        </Notice>
      </Card>
      <Card>
        <CardHeader title="Usage (last 30 days)" description={cost !== null ? `Estimated cost ${formatMoney(cost, "USD")} at the configured per-token prices (estimate).` : "Set AI_PRICE_INPUT_PER_MTOK / AI_PRICE_OUTPUT_PER_MTOK for a cost estimate."} />
        {usage.length ? (
          <Table>
            <thead><tr><Th>Day</Th><Th>Requests</Th><Th>Input tokens</Th><Th>Output tokens</Th><Th>Errors</Th></tr></thead>
            <tbody>{usage.map((u) => <tr key={u.id}><Td className="text-xs">{formatDate(u.day)}</Td><Td>{u.requests}</Td><Td className="text-xs">{formatNumber(u.inputTokens)}</Td><Td className="text-xs">{formatNumber(u.outputTokens)}</Td><Td className={u.errors ? "text-danger" : ""}>{u.errors}</Td></tr>)}</tbody>
          </Table>
        ) : (
          <p className="text-sm text-muted">No AI requests yet.</p>
        )}
      </Card>
    </div>
  );
}
