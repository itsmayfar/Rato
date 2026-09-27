import Link from "next/link";
import { Disc3, Plus } from "lucide-react";
import { Calendar, type CalEvent } from "@/components/ui/calendar";
import { DemoBadge, EmptyState, LinkButton, LinkTabs, PageHeader, Progress, StatusBadge, Table, Td, Th } from "@/components/ui/primitives";
import { requireUser } from "@/lib/auth";
import { RELEASE_TYPES } from "@/lib/constants";
import { loadContext } from "@/lib/context";
import { evaluateRelease, summarize } from "@/lib/info/engine";
import { checklistProgress, effectiveChecklist, suggestReleaseStatus } from "@/lib/releases/checklist";
import { daysBetween, formatDate } from "@/lib/utils";

export const metadata = { title: "Release Manager" };

export default async function ReleasesPage({ searchParams }: { searchParams: Promise<{ view?: string; date?: string; status?: string }> }) {
  const user = await requireUser();
  const ctx = await loadContext(user.id);
  const sp = await searchParams;
  const tab = sp.view ? "calendar" : "list";
  const list = ctx.releases.filter((r) => (sp.status ? r.status === sp.status : r.status !== "Archived"));

  const events: CalEvent[] = [];
  for (const r of ctx.releases.filter((r) => r.status !== "Archived")) {
    if (r.releaseDate) events.push({ date: r.releaseDate, label: `◆ ${r.title}`, href: `/releases/${r.id}`, tone: "accent", meta: "Release date" });
    if (r.submissionDeadline) events.push({ date: r.submissionDeadline, label: `Submit: ${r.title}`, href: `/releases/${r.id}`, tone: "warning", meta: "Submission deadline" });
    for (const i of effectiveChecklist(ctx, r).filter((i) => i.dueDate && i.effectiveStatus === "pending" && i.key !== "release_day"))
      events.push({ date: i.dueDate!, label: `${r.title}: ${i.label}`, href: `/releases/${r.id}`, tone: i.overdue ? "danger" : "neutral", meta: "Checklist" });
    for (const v of r.reviews) events.push({ date: v.dueDate, label: `${v.period} review: ${r.title}`, href: `/releases/${r.id}?tab=performance`, tone: v.status === "completed" ? "success" : "info", meta: "Review" });
  }
  for (const c of ctx.campaigns.filter((c) => c.startDate && c.status !== "Archived")) events.push({ date: c.startDate!, label: `Campaign starts: ${c.name}`, href: `/marketing/${c.id}`, tone: "info", meta: "Campaign" });
  for (const c of ctx.content.filter((c) => c.plannedDate && c.campaignId && !["Published", "Analyzed", "Archived"].includes(c.stage)))
    events.push({ date: c.plannedDate!, label: `Content: ${c.title}`, href: `/content/${c.id}`, tone: "neutral", meta: "Content deadline" });

  return (
    <div>
      <PageHeader
        eyebrow="Release Manager"
        title="Releases"
        purpose="Plan and run multiple releases in parallel. Each release has a tailored checklist, deadlines scheduled back from its release date, and a release-day and post-release workflow."
        actions={<LinkButton href="/releases/new" variant="primary"><Plus className="h-4 w-4" /> New release</LinkButton>}
      />
      <LinkTabs active={tab} tabs={[{ key: "list", label: "Releases", href: "/releases" }, { key: "calendar", label: "Release calendar", href: "/releases?view=month" }]} />
      {tab === "calendar" ? (
        <Calendar events={events} view={sp.view === "week" ? "week" : sp.view === "list" ? "list" : "month"} anchor={sp.date ?? ctx.today} today={ctx.today} basePath="/releases" />
      ) : list.length ? (
        <Table>
          <thead><tr><Th>Release</Th><Th>Type</Th><Th>Date</Th><Th>Status</Th><Th>Checklist</Th><Th>Information</Th><Th>Distributor</Th></tr></thead>
          <tbody>
            {list.map((r) => {
              const prog = checklistProgress(effectiveChecklist(ctx, r));
              const info = summarize(evaluateRelease(ctx, r));
              const suggested = suggestReleaseStatus(ctx, r);
              const d = r.releaseDate ? daysBetween(ctx.today, r.releaseDate) : null;
              return (
                <tr key={r.id} className="hover:bg-surface-2">
                  <Td>
                    <Link href={`/releases/${r.id}`} className="hover:text-accent-strong">{r.title}</Link> {r.isDemo && <DemoBadge />}
                    <div className="text-xs text-faint">{r.trackIds.length} track(s)</div>
                  </Td>
                  <Td className="text-xs">{RELEASE_TYPES.find((t) => t.value === r.releaseType)?.label}</Td>
                  <Td className="text-xs">{r.releaseDate ? <>{formatDate(r.releaseDate)}<div className="text-faint">{d! > 0 ? `in ${d} days` : d === 0 ? "today" : `${-d!} days ago`}{!r.releaseDateConfirmed && " · unconfirmed"}</div></> : <span className="text-warning">No date</span>}</Td>
                  <Td><StatusBadge status={r.status} tone={r.status === "Released" ? "success" : "accent"} />{suggested !== r.status && <div className="mt-1 text-[11px] text-faint">Suggested: {suggested}</div>}</Td>
                  <Td className="w-40"><div className="text-xs text-muted">{prog.done}/{prog.total}</div><Progress value={prog.percent} className="mt-1" /></Td>
                  <Td>{info.missingRequired ? <Link href={`/releases/${r.id}/questions`} className="text-xs text-warning hover:underline">{info.missingRequired} missing</Link> : <span className="text-xs text-success">Complete</span>}</Td>
                  <Td className="text-xs text-muted">{r.distributor ?? "—"}</Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      ) : (
        <EmptyState icon={<Disc3 className="h-8 w-8" />} title="No releases yet." description="Create your first release to start organising your music distribution and promotion." action={<LinkButton href="/releases/new" variant="primary">Create release</LinkButton>} />
      )}
    </div>
  );
}
