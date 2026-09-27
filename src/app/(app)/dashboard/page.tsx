import Link from "next/link";
import { AlertTriangle, ArrowRight, BarChart3, Coins, Disc3, Megaphone, Sparkles, Target } from "lucide-react";
import { TaskRow } from "@/components/tasks/task-row";
import { Badge, Card, CardHeader, EmptyState, LinkButton, Notice, PageHeader, Progress, Stat, StatusBadge } from "@/components/ui/primitives";
import { requireUser } from "@/lib/auth";
import { runAutomations } from "@/lib/automations/engine";
import { OPEN_TASK_STATUSES } from "@/lib/constants";
import { loadContext } from "@/lib/context";
import { db } from "@/lib/db";
import { analyticsRecords } from "@/lib/db/schema";
import { monthRange, summarizePeriod } from "@/lib/finance";
import { blockedByInformation, buildRecommendations } from "@/lib/recommendations";
import { checklistProgress, effectiveChecklist } from "@/lib/releases/checklist";
import { syncInformationTasks } from "@/lib/tasks/generate";
import { addDays, daysBetween, formatDate, formatMoney, formatNumber, titleCase } from "@/lib/utils";
import { PHASES, phaseStatus, recommendedPhase, releasedReleases, upcomingReleases } from "@/lib/workflow/phases";
import { and, desc, eq } from "drizzle-orm";
import { METRICS } from "@/lib/constants";

export const metadata = { title: "Dashboard" };

export default async function Dashboard() {
  const user = await requireUser();
  // Keep generated information tasks & scheduled automations current (idempotent, internal only)
  try {
    await syncInformationTasks(user.id);
    await runAutomations(user.id);
  } catch (err) {
    console.error("dashboard background sync failed", (err as Error).message);
  }
  const ctx = await loadContext(user.id);
  const { today, profile } = ctx;
  const cur = ctx.settings.currency;

  // A. Overview
  const phaseEvals = PHASES.map((p) => ({ p, ev: p.evaluate(ctx), status: phaseStatus(ctx, p.key) }));
  const completed = phaseEvals.filter((x) => x.status === "completed");
  const active = phaseEvals.filter((x) => x.status === "active");
  const current = recommendedPhase(ctx);
  const activeProjects = ctx.projects.filter((p) => p.status === "active" || p.status === "planning");
  const blockers = [
    ...blockedByInformation(ctx).map((b) => ({ label: `${b.label}: missing ${b.missing.slice(0, 3).join(", ")}${b.missing.length > 3 ? "…" : ""}`, href: b.href })),
    ...ctx.tasks.filter((t) => t.status === "blocked").map((t) => ({ label: `Blocked task: ${t.title}`, href: `/tasks/${t.id}` })),
  ].slice(0, 6);

  // B. Priorities
  const open = ctx.tasks.filter((t) => OPEN_TASK_STATUSES.includes(t.status));
  const overdue = open.filter((t) => t.dueDate && t.dueDate < today);
  const dueToday = open.filter((t) => t.dueDate === today);
  const waiting = open.filter((t) => t.status === "waiting_info" || t.status === "waiting_approval");
  const deadlines = [
    ...upcomingReleases(ctx).flatMap((r) =>
      effectiveChecklist(ctx, r)
        .filter((i) => i.effectiveStatus === "pending" && i.dueDate && i.dueDate <= addDays(today, 14))
        .map((i) => ({ date: i.dueDate!, label: `${r.title}: ${i.label}`, href: `/releases/${r.id}` })),
    ),
    ...upcomingReleases(ctx)
      .filter((r) => r.releaseDate && r.releaseDate >= today && r.releaseDate <= addDays(today, 30))
      .map((r) => ({ date: r.releaseDate!, label: `Release: ${r.title}`, href: `/releases/${r.id}` })),
  ]
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .slice(0, 6);

  // C. Releases
  const upcoming = upcomingReleases(ctx);
  const inProduction = ctx.tracks.filter((t) => !["Idea", "Finished", "Archived"].includes(t.status) && !t.actualReleaseDate);
  const recent = releasedReleases(ctx).filter((r) => r.releaseDate && r.releaseDate >= addDays(today, -60));
  const awaitingApproval = upcoming.filter((r) => r.status === "Ready for submission" || !r.coverApproved);

  // D. Marketing
  const activeCampaigns = ctx.campaigns.filter((c) => ["Planning", "Ready", "Active"].includes(c.status));
  const scheduled = ctx.content.filter((c) => c.stage === "Scheduled");
  const upcomingPosts = ctx.content
    .filter((c) => c.plannedDate && c.plannedDate >= today && !["Published", "Analyzed", "Archived"].includes(c.stage))
    .slice(0, 4);
  const adBudget = activeCampaigns.reduce((s, c) => s + (c.currency === cur ? Number(c.budget ?? 0) : 0), 0);
  const noAssets = activeCampaigns.filter((c) => !ctx.content.some((x) => x.campaignId === c.id));

  // E. Finances (real data only)
  const [from, to] = monthRange(today.slice(0, 7));
  const month = summarizePeriod(ctx.transactions, cur, from, to);
  const monthlyBudget = profile.business?.monthlyBudget ?? null;
  const allOutstanding = summarizePeriod(ctx.transactions, cur, "0000-01-01", "9999-12-31").outstandingIncome;

  // F. Audience (latest recorded values)
  const latest = await db
    .selectDistinctOn([analyticsRecords.metric, analyticsRecords.platform])
    .from(analyticsRecords)
    .where(and(eq(analyticsRecords.userId, user.id)))
    .orderBy(analyticsRecords.metric, analyticsRecords.platform, desc(analyticsRecords.periodEnd))
    .limit(8);

  // G. Recommendations
  const recs = buildRecommendations(ctx, 5);

  const greeting = profile.artistName ? `${profile.artistName}` : user.name;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={formatDate(today, "long")}
        title={<>Good to see you, {greeting}.</>}
        purpose="Your artist business at a glance: what needs attention today, what’s coming up, and the next best actions."
        actions={<LinkButton href="/assistant" variant="outline"><Sparkles className="h-4 w-4" /> Ask the assistant</LinkButton>}
      />

      {!profile.onboardingCompletedAt && (
        <Notice tone="warning" title="Finish setting up your business">
          A few questions about your identity, goals and catalog unlock tailored recommendations.{" "}
          <Link href="/onboarding" className="text-fg underline decoration-accent underline-offset-2">
            Continue onboarding →
          </Link>
        </Notice>
      )}

      {/* G. What should I do next? */}
      <Card className="border-accent/30">
        <CardHeader icon={<Target className="h-4 w-4" />} title="What should I do next?" description="Prioritised from your deadlines, blockers, missing information and goals." />
        {recs.length ? (
          <ol className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {recs.map((r, i) => (
              <li key={r.id} className="flex flex-col rounded-md border border-line bg-surface-2 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-accent-strong">0{i + 1}</span>
                  {r.effort && <span className="text-[11px] text-faint">{r.effort}</span>}
                </div>
                <div className="mt-1 text-sm text-fg">{r.title}</div>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  <span className="text-faint">Why: </span>
                  {r.why}
                </p>
                {r.requiredInfo.length > 0 && (
                  <p className="mt-1 text-xs text-faint">Needs: {r.requiredInfo.slice(0, 4).join(", ")}{r.requiredInfo.length > 4 ? "…" : ""}</p>
                )}
                <div className="mt-auto pt-3">
                  <LinkButton href={r.href} size="sm" variant="outline">
                    {r.actionLabel} <ArrowRight className="h-3 w-3" />
                  </LinkButton>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <EmptyState compact title="Nothing urgent right now." description="All tracked work is on schedule. Use the time to create." />
        )}
      </Card>

      <div className="grid gap-6 xl:grid-cols-3">
        {/* A. Business overview */}
        <Card className="xl:col-span-1">
          <CardHeader title="Business overview" action={<LinkButton href="/workflow" size="sm" variant="ghost">Phases</LinkButton>} />
          <div className="grid grid-cols-2 gap-5">
            <Stat label="Career stage" value={profile.careerStage ?? "—"} />
            <Stat label="Active projects" value={activeProjects.length} hint={`${ctx.releases.filter((r) => r.status !== "Archived").length} releases · ${ctx.campaigns.filter((c) => c.status !== "Archived").length} campaigns`} />
            <Stat label="Phases completed" value={`${completed.length}/10`} />
            <Stat label="Phases active" value={active.length} />
          </div>
          <div className="mt-5 rounded-md border border-line bg-surface-2 p-3">
            <div className="text-[11px] uppercase tracking-[0.16em] text-faint">Current focus</div>
            <Link href={current.href} className="mt-1 flex items-center justify-between text-sm hover:text-accent-strong">
              <span>
                Phase {current.number} · {current.title}
              </span>
              <span className="text-xs text-muted">{phaseEvals.find((x) => x.p.key === current.key)!.ev.progress}%</span>
            </Link>
            <Progress value={phaseEvals.find((x) => x.p.key === current.key)!.ev.progress} className="mt-2" />
          </div>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {phaseEvals.map(({ p, ev, status }) => (
              <Link
                key={p.key}
                href={p.href}
                title={`${p.number}. ${p.title} — ${status === "completed" ? "completed" : `${ev.progress}%`}`}
                className="flex h-7 w-7 items-center justify-center rounded border text-[11px] transition-colors hover:border-accent"
                style={{
                  borderColor: status === "completed" ? "var(--success)" : status === "active" ? "var(--accent-strong)" : "var(--border)",
                  color: status === "completed" ? "var(--success)" : status === "active" ? "var(--text)" : "var(--faint)",
                }}
              >
                {p.number}
              </Link>
            ))}
          </div>
          {blockers.length > 0 && (
            <div className="mt-5">
              <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-danger">
                <AlertTriangle className="h-3.5 w-3.5" /> Blockers
              </div>
              <ul className="space-y-1.5">
                {blockers.map((b) => (
                  <li key={b.label}>
                    <Link href={b.href} className="block truncate text-xs text-muted hover:text-fg" title={b.label}>
                      {b.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        {/* B. Today's priorities */}
        <Card className="xl:col-span-2">
          <CardHeader
            title="Today’s priorities"
            description={`${dueToday.length} due today · ${overdue.length} overdue · ${waiting.length} waiting for input`}
            action={<LinkButton href="/tasks/new" size="sm" variant="ghost">Add task</LinkButton>}
          />
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="mb-1 text-[11px] uppercase tracking-[0.16em] text-faint">Tasks</h3>
              {[...overdue, ...dueToday].length ? (
                <div className="divide-y divide-line">
                  {[...overdue, ...dueToday].slice(0, 7).map((t) => (
                    <TaskRow key={t.id} task={t} today={today} />
                  ))}
                </div>
              ) : open.length ? (
                <div className="divide-y divide-line">
                  <p className="pb-2 text-xs text-muted">Nothing due today. Next up:</p>
                  {open
                    .filter((t) => t.dueDate)
                    .slice(0, 4)
                    .map((t) => (
                      <TaskRow key={t.id} task={t} today={today} />
                    ))}
                </div>
              ) : (
                <EmptyState compact title="No open tasks." description="Tasks appear here from phases, releases, campaigns and missing information." />
              )}
              {waiting.length > 0 && (
                <>
                  <h3 className="mb-1 mt-5 text-[11px] uppercase tracking-[0.16em] text-faint">Waiting for your input</h3>
                  <div className="divide-y divide-line">
                    {waiting.slice(0, 4).map((t) => (
                      <TaskRow key={t.id} task={t} today={today} />
                    ))}
                  </div>
                </>
              )}
            </div>
            <div>
              <h3 className="mb-2 text-[11px] uppercase tracking-[0.16em] text-faint">Important deadlines (14 days)</h3>
              {deadlines.length ? (
                <ul className="space-y-2">
                  {deadlines.map((d) => {
                    const days = daysBetween(today, d.date);
                    return (
                      <li key={d.label + d.date} className="flex items-center gap-3 text-sm">
                        <span className={`w-16 shrink-0 text-xs ${days < 0 ? "text-danger" : days <= 3 ? "text-warning" : "text-muted"}`}>{formatDate(d.date)}</span>
                        <Link href={d.href} className="min-w-0 truncate hover:text-accent-strong">
                          {d.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-muted">No deadlines in the next two weeks.</p>
              )}
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* C. Releases */}
        <Card>
          <CardHeader icon={<Disc3 className="h-4 w-4" />} title="Releases" action={<LinkButton href="/releases" size="sm" variant="ghost">Release Manager</LinkButton>} />
          <div className="mb-4 grid grid-cols-3 gap-4">
            <Stat label="Upcoming" value={upcoming.length} />
            <Stat label="Tracks in production" value={inProduction.length} />
            <Stat label="Recently released" value={recent.length} />
          </div>
          {upcoming.length ? (
            <ul className="divide-y divide-line">
              {upcoming.slice(0, 5).map((r) => {
                const prog = checklistProgress(effectiveChecklist(ctx, r));
                return (
                  <li key={r.id} className="py-3">
                    <div className="flex items-center justify-between gap-3">
                      <Link href={`/releases/${r.id}`} className="min-w-0 truncate text-sm hover:text-accent-strong">
                        {r.title}
                      </Link>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-xs text-muted">{r.releaseDate ? formatDate(r.releaseDate) : "No date"}</span>
                        <StatusBadge status={r.status} />
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-3">
                      <Progress value={prog.percent} />
                      <span className="shrink-0 text-[11px] text-faint">
                        {prog.done}/{prog.total}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState compact title="No releases yet." description="Create your first release to start organising distribution and promotion." action={<LinkButton href="/releases/new" size="sm" variant="primary">Create release</LinkButton>} />
          )}
          {awaitingApproval.length > 0 && upcoming.length > 0 && (
            <p className="mt-3 text-xs text-warning">{awaitingApproval.length} release(s) awaiting approval (artwork or submission).</p>
          )}
          {recent.length > 0 && (
            <div className="mt-4 border-t border-line pt-3 text-xs text-muted">
              Recently published: {recent.map((r) => r.title).join(", ")}
              {ctx.campaigns.some((c) => c.template === "post_release" && c.status === "Active") && " · post-release campaign active"}
            </div>
          )}
        </Card>

        {/* D. Marketing */}
        <Card>
          <CardHeader icon={<Megaphone className="h-4 w-4" />} title="Marketing" action={<LinkButton href="/marketing" size="sm" variant="ghost">Campaigns</LinkButton>} />
          <div className="mb-4 grid grid-cols-3 gap-4">
            <Stat label="Active campaigns" value={activeCampaigns.length} />
            <Stat label="Scheduled content" value={scheduled.length} />
            <Stat label="Planned ad budget" value={adBudget ? formatMoney(adBudget, cur) : "—"} />
          </div>
          {upcomingPosts.length ? (
            <ul className="divide-y divide-line">
              {upcomingPosts.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <Link href={`/content/${c.id}`} className="min-w-0 truncate hover:text-accent-strong">
                    {c.title}
                  </Link>
                  <span className="flex shrink-0 items-center gap-2 text-xs text-muted">
                    {c.platform} · {formatDate(c.plannedDate)} <StatusBadge status={c.stage} />
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState compact title="No upcoming posts." description="Plan content in the Content Studio." action={<LinkButton href="/content/new" size="sm">Plan content</LinkButton>} />
          )}
          {noAssets.length > 0 && <p className="mt-3 text-xs text-warning">Missing promotional assets: {noAssets.map((c) => c.name).join(", ")}</p>}
        </Card>

        {/* E. Finances */}
        <Card>
          <CardHeader
            icon={<Coins className="h-4 w-4" />}
            title="Finances this month"
            description="Actual recorded values only."
            action={<LinkButton href="/finances" size="sm" variant="ghost">Finances</LinkButton>}
          />
          {month.count || monthlyBudget ? (
            <div className="grid grid-cols-2 gap-5 md:grid-cols-3">
              <Stat label="Income" value={formatMoney(month.income.amount, cur)} />
              <Stat label="Expenses" value={formatMoney(month.expenses.amount, cur)} />
              <Stat label="Marketing spend" value={formatMoney(month.marketing.amount, cur)} />
              <Stat label="Royalties recorded" value={formatMoney(month.royalties.amount, cur)} />
              <Stat label="Outstanding invoices" value={formatMoney(allOutstanding.amount, cur)} tone={allOutstanding.amount ? "warning" : undefined} />
              <Stat
                label="Available budget"
                value={monthlyBudget !== null && monthlyBudget !== undefined ? formatMoney(monthlyBudget - month.expenses.amount, cur) : "—"}
                hint={monthlyBudget ? `of ${formatMoney(monthlyBudget, cur)} monthly` : "Set a monthly budget"}
                tone={monthlyBudget && monthlyBudget - month.expenses.amount < 0 ? "danger" : undefined}
              />
            </div>
          ) : (
            <EmptyState compact title="No financial records yet." description="Add your first income or expense to start tracking your music business finances." action={<LinkButton href="/finances/new" size="sm">Add record</LinkButton>} />
          )}
          {month.income.unconverted + month.expenses.unconverted > 0 && (
            <p className="mt-3 text-xs text-warning">{month.income.unconverted + month.expenses.unconverted} foreign-currency record(s) without an exchange rate are not included.</p>
          )}
        </Card>

        {/* F. Audience */}
        <Card>
          <CardHeader icon={<BarChart3 className="h-4 w-4" />} title="Audience" action={<LinkButton href="/analytics" size="sm" variant="ghost">Analytics</LinkButton>} />
          {latest.length ? (
            <ul className="divide-y divide-line">
              {latest.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <div className="text-sm">
                      {METRICS.find((x) => x.value === m.metric)?.label ?? titleCase(m.metric)} <span className="text-faint">· {m.platform}</span>
                    </div>
                    <div className="text-[11px] text-faint">
                      {m.source === "api" ? "API" : m.source === "csv" ? "CSV import" : "Manual entry"} · {formatDate(m.periodEnd)}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-lg font-extralight">{formatNumber(m.value, 2)}</span>
                    <Badge tone={m.isDemo ? "info" : m.verification === "verified" ? "success" : m.verification === "estimated" ? "warning" : "neutral"}>
                      {m.isDemo ? "demo" : m.verification}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState compact title="No audience data recorded yet." description="Enter metrics manually, import a CSV, or connect an official API in Integrations." action={<LinkButton href="/analytics?add=1" size="sm">Record metrics</LinkButton>} />
          )}
        </Card>
      </div>
    </div>
  );
}
