import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { QuestionFlow } from "@/components/info/question-flow";
import { CampaignForm } from "@/components/marketing/campaign-form";
import { TaskRow } from "@/components/tasks/task-row";
import { ConfirmAction, InlineAction } from "@/components/ui/form";
import { FormModal } from "@/components/ui/form-modal";
import { Badge, Card, CardHeader, DemoBadge, EmptyState, LinkButton, Notice, PageHeader, Progress, Stat, StatusBadge, Table, Td, Th } from "@/components/ui/primitives";
import { deleteAd, deleteCampaign, recordAdResults, saveAd, setAdStatus } from "@/lib/actions/marketing";
import { requireUser } from "@/lib/auth";
import { loadContext } from "@/lib/context";
import { budgetUsage } from "@/lib/finance";
import { AD_FIELDS, AD_RESULT_FIELDS, CAMPAIGN_FIELDS, withOptions } from "@/lib/forms";
import { evaluateCampaign, summarize } from "@/lib/info/engine";
import { toQuestions } from "@/lib/info/questions";
import { CAMPAIGN_PLANS } from "@/lib/marketing/templates";
import { relationOptions } from "@/lib/task-options";
import { formatDate, formatMoney, formatNumber } from "@/lib/utils";

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const ctx = await loadContext(user.id);
  const c = ctx.campaigns.find((x) => x.id === id);
  if (!c) notFound();
  const items = evaluateCampaign(ctx, c);
  const s = summarize(items);
  const content = ctx.content.filter((x) => x.campaignId === id);
  const tasks = ctx.tasks.filter((t) => t.campaignId === id);
  const usage = budgetUsage({ amount: c.budget ?? 0, currency: c.currency, campaignId: c.id, releaseId: null, projectId: null, category: null, periodStart: null, periodEnd: null } as never, ctx.transactions, ctx.settings.currency);
  const approvedAds = c.ads.filter((a) => a.status !== "draft").reduce((sum, a) => sum + Number(a.plannedSpend ?? 0), 0);
  const opts = relationOptions(ctx);

  return (
    <div>
      <PageHeader
        eyebrow={<span className="flex items-center gap-2"><Link href="/marketing" className="hover:text-fg">Marketing</Link> / {c.template ? CAMPAIGN_PLANS[c.template]?.label : "Campaign"} {c.isDemo && <DemoBadge />}</span>}
        title={c.name}
        purpose={[c.objective, c.startDate && `${formatDate(c.startDate)} – ${formatDate(c.endDate)}`, c.releaseId && `for ${ctx.releases.find((r) => r.id === c.releaseId)?.title}`].filter(Boolean).join(" · ")}
        actions={
          <>
            <StatusBadge status={c.status} />
            <LinkButton href={`/content/new?campaign=${c.id}`} variant="outline"><Plus className="h-4 w-4" /> Content</LinkButton>
            <ConfirmAction action={deleteCampaign} fields={{ id }} label="Delete" title="Delete this campaign?" message="Ads plans are deleted; content and tasks are kept but unlinked." size="md" icon={<Trash2 className="h-4 w-4" />} />
          </>
        }
      />
      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <Card><Stat label="Budget" value={formatMoney(c.budget, c.currency)} /></Card>
        <Card><Stat label="Spent (recorded)" value={formatMoney(usage.spent, c.currency)} tone={usage.over ? "danger" : undefined} hint={c.budget ? <Progress value={usage.percent} tone={usage.over ? "danger" : "accent"} className="mt-2" /> : undefined} /></Card>
        <Card><Stat label="Approved ad spend" value={formatMoney(approvedAds, c.currency)} hint={c.budget && approvedAds > c.budget ? "Exceeds budget" : undefined} tone={c.budget && approvedAds > c.budget ? "warning" : undefined} /></Card>
        <Card><Stat label="Strategy" value={s.missingRequired ? `${s.missingRequired} missing` : "Complete"} tone={s.missingRequired ? "warning" : "success"} /></Card>
      </div>

      {s.missingRequired > 0 && (
        <Card className="mb-6">
          <CardHeader title="Complete the strategy" description="A campaign needs an objective, budget, timeline, assets and measurable indicators." />
          <QuestionFlow {...toQuestions(items)} />
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader
              title="Advertising"
              description="Ad plans start as drafts. Approving records your explicit decision to spend; you launch ads yourself in the ad platform. Results are entered manually unless a verified integration exists."
              action={<FormModal label="Plan ad" title="Plan an ad" action={saveAd} defs={AD_FIELDS} hidden={{ campaignId: c.id }} values={{ currency: c.currency, startDate: c.startDate, endDate: c.endDate }} variant="outline" size="sm" icon={<Plus className="h-3.5 w-3.5" />} />}
            />
            {c.ads.length ? (
              <Table>
                <thead><tr><Th>Ad</Th><Th>Planned</Th><Th>Status</Th><Th>Results (manual)</Th><Th /></tr></thead>
                <tbody>
                  {c.ads.map((a) => {
                    const cpr = a.actualSpend && a.conversions ? Number(a.actualSpend) / a.conversions : null;
                    return (
                      <tr key={a.id}>
                        <Td>{a.name}<div className="text-xs text-faint">{a.platform} · {formatDate(a.startDate)} – {formatDate(a.endDate)}</div></Td>
                        <Td className="text-xs">{formatMoney(a.plannedSpend, a.currency)}</Td>
                        <Td><StatusBadge status={a.status === "approved" ? "approved" : a.status} />{a.approvedAt && <div className="text-[10px] text-faint">approved {formatDate(a.approvedAt.toISOString())}</div>}</Td>
                        <Td className="text-xs text-muted">
                          {a.actualSpend !== null ? (
                            <>
                              {formatMoney(a.actualSpend, a.currency)} spent · {formatNumber(a.impressions)} impr. · {formatNumber(a.clicks)} clicks · {formatNumber(a.conversions)} {a.resultLabel ?? "results"}
                              {cpr !== null && <div>Cost per result {formatMoney(cpr, a.currency)}</div>}
                            </>
                          ) : "Not recorded"}
                        </Td>
                        <Td className="whitespace-nowrap text-right">
                          {a.status === "draft" && (
                            <ConfirmAction action={setAdStatus} fields={{ id: a.id, status: "approved" }} label="Approve spend" title={`Approve spending ${formatMoney(a.plannedSpend, a.currency)}?`} message={`You authorise up to ${formatMoney(a.plannedSpend, a.currency)} on ${a.platform}. The app does not launch ads or charge anything — you do that in the ad platform.`} confirmLabel="Approve spend" variant="outline" />
                          )}
                          {a.status === "approved" && <InlineAction action={setAdStatus} fields={{ id: a.id, status: "running" }}>Mark running</InlineAction>}
                          {a.status === "running" && <InlineAction action={setAdStatus} fields={{ id: a.id, status: "ended" }}>Mark ended</InlineAction>}
                          <FormModal
                            label="Results"
                            title="Record ad results"
                            action={recordAdResults}
                            defs={AD_RESULT_FIELDS}
                            hidden={{ id: a.id }}
                            values={a as unknown as Record<string, unknown>}
                            variant="ghost"
                            size="sm"
                            after={<label className="flex items-center gap-2 text-sm"><input type="checkbox" name="recordExpense" className="accent-[var(--accent)]" /> Also record the actual spend as an advertising expense in Finances</label>}
                          />
                          <FormModal label="Edit" title="Edit ad" action={saveAd} defs={AD_FIELDS} hidden={{ campaignId: c.id, id: a.id }} values={a as unknown as Record<string, unknown>} variant="ghost" size="sm" />
                          <ConfirmAction action={deleteAd} fields={{ id: a.id }} label="Remove" title="Remove this ad plan?" message="The ad plan and its recorded results are removed." size="icon" variant="ghost" icon={<Trash2 className="h-3.5 w-3.5" />} />
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            ) : (
              <EmptyState compact title="No ads planned." description="Paid ads are optional. Plan one to track spend against the budget." />
            )}
          </Card>
          <Card>
            <CardHeader title={`Content (${content.length})`} action={<LinkButton href={`/content?campaign=${c.id}`} size="sm" variant="ghost">Content Studio</LinkButton>} />
            {content.length ? (
              <ul className="divide-y divide-line">
                {content.map((x) => (
                  <li key={x.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <Link href={`/content/${x.id}`} className="min-w-0 truncate hover:text-accent-strong">{x.title}</Link>
                    <span className="flex shrink-0 items-center gap-2 text-xs text-muted">{x.platform} · {formatDate(x.plannedDate)} <StatusBadge status={x.stage} />{x.approvalStatus === "approved" && <Badge tone="success">approved</Badge>}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState compact title="No content yet." action={<LinkButton href={`/content/new?campaign=${c.id}`} size="sm">Plan content</LinkButton>} />
            )}
          </Card>
          <Card>
            <CardHeader title="Campaign details" />
            <CampaignForm id={c.id} defs={withOptions(CAMPAIGN_FIELDS, { releaseId: opts.releaseId, trackId: opts.trackId })} values={c as unknown as Record<string, unknown>} />
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Plan tasks" description={c.template ? `From “${CAMPAIGN_PLANS[c.template]?.label}”` : "No template applied"} />
            {tasks.length ? <div className="divide-y divide-line">{tasks.map((t) => <TaskRow key={t.id} task={t} today={ctx.today} />)}</div> : <p className="text-sm text-muted">No tasks.</p>}
          </Card>
          {c.endDate && c.endDate < ctx.today && !c.results && <Notice tone="warning" title="Campaign ended">Record the results and lessons learned in the campaign details.</Notice>}
        </div>
      </div>
    </div>
  );
}
