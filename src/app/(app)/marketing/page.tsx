import Link from "next/link";
import { Megaphone, Plus } from "lucide-react";
import { Card, DemoBadge, EmptyState, LinkButton, PageHeader, Progress, Stat, StatusBadge, Table, Td, Th } from "@/components/ui/primitives";
import { requireUser } from "@/lib/auth";
import { loadContext } from "@/lib/context";
import { budgetUsage } from "@/lib/finance";
import { evaluateCampaign, summarize } from "@/lib/info/engine";
import { formatDate, formatMoney } from "@/lib/utils";

export const metadata = { title: "Marketing & Promotion" };

export default async function MarketingPage() {
  const user = await requireUser();
  const ctx = await loadContext(user.id);
  const cur = ctx.settings.currency;
  const active = ctx.campaigns.filter((c) => c.status !== "Archived");
  const ads = ctx.campaigns.flatMap((c) => c.ads);
  const planned = ads.filter((a) => a.currency === cur).reduce((s, a) => s + Number(a.plannedSpend ?? 0), 0);
  const approved = ads.filter((a) => a.currency === cur && a.status !== "draft").reduce((s, a) => s + Number(a.plannedSpend ?? 0), 0);
  const spent = ads.filter((a) => a.currency === cur).reduce((s, a) => s + Number(a.actualSpend ?? 0), 0);
  return (
    <div>
      <PageHeader
        eyebrow="Marketing & Promotion"
        title="Campaigns"
        purpose="Strategies for each release: objective, audience, budget, timeline, channels, content and measurable results. Money is never spent and nothing is published without your explicit approval."
        actions={<LinkButton href="/marketing/new" variant="primary"><Plus className="h-4 w-4" /> New campaign</LinkButton>}
      />
      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <Card><Stat label="Active campaigns" value={active.filter((c) => c.status === "Active").length} hint={`${active.length} total`} /></Card>
        <Card><Stat label="Planned ad spend" value={formatMoney(planned, cur)} /></Card>
        <Card><Stat label="Approved ad spend" value={formatMoney(approved, cur)} /></Card>
        <Card><Stat label="Recorded ad spend" value={formatMoney(spent, cur)} hint="Manually recorded results" /></Card>
      </div>
      {active.length ? (
        <Table>
          <thead><tr><Th>Campaign</Th><Th>Release</Th><Th>Dates</Th><Th>Status</Th><Th>Budget used</Th><Th>Content</Th><Th>Strategy</Th></tr></thead>
          <tbody>
            {active.map((c) => {
              const s = summarize(evaluateCampaign(ctx, c));
              const usage = c.budget ? budgetUsage({ amount: c.budget, currency: c.currency, campaignId: c.id, releaseId: null, projectId: null, category: null, periodStart: null, periodEnd: null } as never, ctx.transactions, cur) : null;
              const content = ctx.content.filter((x) => x.campaignId === c.id);
              return (
                <tr key={c.id} className="hover:bg-surface-2">
                  <Td><Link href={`/marketing/${c.id}`} className="hover:text-accent-strong">{c.name}</Link> {c.isDemo && <DemoBadge />}<div className="text-xs text-faint">{c.objective ?? "No objective"}</div></Td>
                  <Td className="text-xs">{c.releaseId ? <Link href={`/releases/${c.releaseId}`} className="hover:text-fg">{ctx.releases.find((r) => r.id === c.releaseId)?.title}</Link> : "—"}</Td>
                  <Td className="text-xs text-muted">{c.startDate ? `${formatDate(c.startDate)} – ${formatDate(c.endDate)}` : "—"}</Td>
                  <Td><StatusBadge status={c.status} /></Td>
                  <Td className="w-40 text-xs">{usage ? <><span className={usage.over ? "text-danger" : "text-muted"}>{formatMoney(usage.spent, c.currency)} / {formatMoney(c.budget, c.currency)}</span><Progress value={usage.percent} tone={usage.over ? "danger" : "accent"} className="mt-1" /></> : <span className="text-faint">No budget</span>}</Td>
                  <Td className="text-xs text-muted">{content.length} item(s)</Td>
                  <Td>{s.missingRequired ? <span className="text-xs text-warning">{s.missingRequired} missing</span> : <span className="text-xs text-success">Complete</span>}</Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      ) : (
        <EmptyState icon={<Megaphone className="h-8 w-8" />} title="No campaigns yet." description="Create a campaign to plan your next release promotion." action={<LinkButton href="/marketing/new" variant="primary">Create campaign</LinkButton>} />
      )}
    </div>
  );
}
