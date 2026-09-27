import Link from "next/link";
import { ArrowLeft, ArrowRight, Clapperboard, Plus } from "lucide-react";
import { InlineAction, filterClass, inputClass } from "@/components/ui/form";
import { Badge, DemoBadge, EmptyState, LinkButton, PageHeader } from "@/components/ui/primitives";
import { setContentStage } from "@/lib/actions/marketing";
import { requireUser } from "@/lib/auth";
import { CONTENT_PLATFORMS, CONTENT_STAGES } from "@/lib/constants";
import { loadContext } from "@/lib/context";
import { cn, formatDate, isBlank } from "@/lib/utils";

export const metadata = { title: "Content Studio" };

const APPROVAL: Record<string, { label: string; tone: "neutral" | "warning" | "success" | "danger" }> = {
  not_requested: { label: "draft", tone: "neutral" },
  pending: { label: "awaiting approval", tone: "warning" },
  approved: { label: "approved", tone: "success" },
  changes_requested: { label: "changes requested", tone: "danger" },
};

export default async function ContentPage({ searchParams }: { searchParams: Promise<{ campaign?: string; platform?: string; track?: string; approval?: string }> }) {
  const user = await requireUser();
  const ctx = await loadContext(user.id);
  const sp = await searchParams;
  const stages = [...CONTENT_STAGES.filter((s) => s !== "Archived"), ...(ctx.settings.customStatuses.content ?? [])];
  const list = ctx.content.filter(
    (c) => (!sp.campaign || c.campaignId === sp.campaign) && (!sp.platform || c.platform === sp.platform) && (!sp.track || c.trackId === sp.track) && (!sp.approval || c.approvalStatus === sp.approval),
  );
  return (
    <div>
      <PageHeader
        eyebrow="Content Studio"
        title="Content pipeline"
        purpose="Idea → Script → Asset → Editing → Review → Approved → Scheduled → Published → Analyzed. Content is never published without your approval, and publishing is always done by you."
        actions={
          <>
            <LinkButton href="/planner" variant="outline">Calendar</LinkButton>
            <LinkButton href={`/content/new${sp.campaign ? `?campaign=${sp.campaign}` : ""}`} variant="primary"><Plus className="h-4 w-4" /> New content</LinkButton>
          </>
        }
      />
      <form className="mb-5 flex flex-wrap gap-2" role="search">
        <select name="campaign" defaultValue={sp.campaign ?? ""} className={filterClass} aria-label="Campaign">
          <option value="">All campaigns</option>
          {ctx.campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select name="platform" defaultValue={sp.platform ?? ""} className={filterClass} aria-label="Platform">
          <option value="">All platforms</option>
          {CONTENT_PLATFORMS.map((p) => <option key={p}>{p}</option>)}
        </select>
        <select name="track" defaultValue={sp.track ?? ""} className={filterClass} aria-label="Track">
          <option value="">All tracks</option>
          {ctx.tracks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
        </select>
        <select name="approval" defaultValue={sp.approval ?? ""} className={filterClass} aria-label="Approval">
          <option value="">Any approval</option>
          <option value="pending">Awaiting approval</option>
          <option value="approved">Approved</option>
          <option value="changes_requested">Changes requested</option>
          <option value="not_requested">Draft</option>
        </select>
        <button className="rounded-md border border-line px-3 text-sm text-muted hover:text-fg" type="submit">Apply</button>
      </form>
      {!ctx.content.length ? (
        <EmptyState icon={<Clapperboard className="h-8 w-8" />} title="No content yet." description="Plan reels, teasers, Canvas, announcements and behind-the-scenes content. Campaign templates also create content ideas." action={<LinkButton href="/content/new" variant="primary">Plan content</LinkButton>} />
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {stages.map((stage, idx) => {
            const col = list.filter((c) => c.stage === stage);
            return (
              <section key={stage} className="w-64 shrink-0" aria-label={stage}>
                <h2 className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.14em] text-muted">{stage} <Badge>{col.length}</Badge></h2>
                <ul className="space-y-2">
                  {col.map((c) => {
                    const needsApproval = ["Approved", "Scheduled", "Published", "Analyzed"].includes(stages[idx + 1] ?? "") && c.approvalStatus !== "approved";
                    return (
                      <li key={c.id} className="rounded-md border border-line bg-surface p-3">
                        <Link href={`/content/${c.id}`} className="block text-sm hover:text-accent-strong">{c.title}</Link>
                        <div className="mt-1 text-[11px] text-faint">{[c.platform, c.format, c.plannedDate && formatDate(c.plannedDate)].filter(Boolean).join(" · ")}</div>
                        <div className="mt-2 flex flex-wrap gap-1">
                          <Badge tone={APPROVAL[c.approvalStatus]?.tone ?? "neutral"}>{APPROVAL[c.approvalStatus]?.label ?? c.approvalStatus}</Badge>
                          {isBlank(c.caption) && stage !== "Idea" && <Badge tone="warning">no caption</Badge>}
                          {c.isDemo && <DemoBadge />}
                        </div>
                        <div className="mt-2 flex justify-between">
                          {idx > 0 ? <InlineAction action={setContentStage} fields={{ id: c.id, stage: stages[idx - 1] }} size="icon" title={`Back to ${stages[idx - 1]}`}><ArrowLeft className="h-3.5 w-3.5" /></InlineAction> : <span />}
                          {idx < stages.length - 1 && stages[idx + 1] !== "Published" && !needsApproval && (
                            <InlineAction action={setContentStage} fields={{ id: c.id, stage: stages[idx + 1] }} size="icon" title={`Move to ${stages[idx + 1]}`}><ArrowRight className="h-3.5 w-3.5" /></InlineAction>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
