import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { Download } from "lucide-react";
import { PrintButton } from "@/components/reports/print-button";
import { filterClass } from "@/components/ui/form";
import { Badge, Card, CardHeader, KeyValue, Notice, PageHeader, Progress, Stat, Table, Td, Th } from "@/components/ui/primitives";
import { requireUser } from "@/lib/auth";
import { METRICS, OPEN_TASK_STATUSES } from "@/lib/constants";
import { loadContext } from "@/lib/context";
import { db } from "@/lib/db";
import { analyticsRecords } from "@/lib/db/schema";
import { budgetUsage, byCategory, monthRange, realOnly, summarizePeriod, toBase } from "@/lib/finance";
import { evaluateProfile, evaluateRelease, evaluateTrack, isResolved, summarize } from "@/lib/info/engine";
import { checklistProgress, effectiveChecklist } from "@/lib/releases/checklist";
import { REPORTS, type ReportKey } from "@/lib/reports";
import { summarizeSplits, splitsByType } from "@/lib/rights";
import { formatDate, formatMoney, formatNumber, titleCase } from "@/lib/utils";
import { PHASES, phaseStatus } from "@/lib/workflow/phases";

type SP = { from?: string; to?: string; month?: string; track?: string; campaign?: string; quarter?: string };

function quarterRange(q: string): [string, string] {
  const [y, n] = q.split("-Q").map(Number);
  const startMonth = (n - 1) * 3 + 1;
  return [`${y}-${String(startMonth).padStart(2, "0")}-01`, monthRange(`${y}-${String(startMonth + 2).padStart(2, "0")}`)[1]];
}

export default async function ReportPage({ params, searchParams }: { params: Promise<{ type: string }>; searchParams: Promise<SP> }) {
  const user = await requireUser();
  const { type } = await params;
  const report = REPORTS.find((r) => r.key === type);
  if (!report) notFound();
  const ctx = await loadContext(user.id);
  const sp = await searchParams;
  const cur = ctx.settings.currency;
  const today = ctx.today;
  const currentQuarter = `${today.slice(0, 4)}-Q${Math.floor((Number(today.slice(5, 7)) - 1) / 3) + 1}`;
  let [from, to] = sp.month && /^\d{4}-\d{2}$/.test(sp.month) ? monthRange(sp.month) : [sp.from ?? `${today.slice(0, 4)}-01-01`, sp.to ?? today];
  if (type === "quarterly") [from, to] = quarterRange(sp.quarter && /^\d{4}-Q[1-4]$/.test(sp.quarter) ? sp.quarter : currentQuarter);
  const inRange = (d?: string | null) => Boolean(d && d >= from && d <= to);
  const key = type as ReportKey;

  const filters = (
    <form className="no-print mb-6 flex flex-wrap items-end gap-2">
      {key === "quarterly" ? (
        <select name="quarter" defaultValue={sp.quarter ?? currentQuarter} className={filterClass} aria-label="Quarter">
          {Array.from({ length: 8 }, (_, i) => {
            const y = Number(today.slice(0, 4)) - Math.floor(i / 4);
            const q = 4 - (i % 4);
            return `${y}-Q${q}`;
          }).map((q) => <option key={q}>{q}</option>)}
        </select>
      ) : (
        <>
          <label className="text-xs text-muted">From <input type="date" name="from" defaultValue={from} className={filterClass} /></label>
          <label className="text-xs text-muted">To <input type="date" name="to" defaultValue={to} className={filterClass} /></label>
          {(key === "catalog" || key === "audience" || key === "rights" || key === "content") && (
            <select name="track" defaultValue={sp.track ?? ""} className={filterClass} aria-label="Track"><option value="">All tracks</option>{ctx.tracks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}</select>
          )}
          {(key === "marketing" || key === "content") && (
            <select name="campaign" defaultValue={sp.campaign ?? ""} className={filterClass} aria-label="Campaign"><option value="">All campaigns</option>{ctx.campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          )}
        </>
      )}
      <button className="h-9 rounded-md border border-line px-3 text-sm text-muted hover:text-fg" type="submit">Apply</button>
    </form>
  );

  let body: React.ReactNode = null;

  if (key === "overview") {
    const prof = summarize(evaluateProfile(ctx));
    body = (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          <Card><Stat label="Profile information" value={`${prof.percent}%`} hint={`${prof.missingRequired} required missing`} /></Card>
          <Card><Stat label="Tracks" value={ctx.tracks.length} hint={`${ctx.tracks.filter((t) => t.actualReleaseDate).length} released`} /></Card>
          <Card><Stat label="Releases" value={ctx.releases.length} /></Card>
          <Card><Stat label="Open tasks" value={ctx.tasks.filter((t) => OPEN_TASK_STATUSES.includes(t.status)).length} /></Card>
        </div>
        <Card>
          <CardHeader title="Workflow phases" />
          <Table>
            <thead><tr><Th>Phase</Th><Th>Status</Th><Th>Progress</Th><Th>Next action</Th></tr></thead>
            <tbody>{PHASES.map((p) => { const ev = p.evaluate(ctx); return <tr key={p.key}><Td>{p.number}. {p.title}</Td><Td className="text-xs">{titleCase(phaseStatus(ctx, p.key))}</Td><Td className="w-40"><Progress value={ev.progress} /></Td><Td className="text-xs text-muted">{ev.criteriaMet ? "Criteria met" : ev.nextAction?.label}</Td></tr>; })}</tbody>
          </Table>
        </Card>
      </div>
    );
  } else if (key === "catalog") {
    const list = ctx.tracks.filter((t) => !sp.track || t.id === sp.track);
    body = (
      <Table>
        <thead><tr><Th>ID</Th><Th>Title</Th><Th>Status</Th><Th>Genre / BPM / key</Th><Th>Info</Th><Th>Rights</Th><Th>Released</Th></tr></thead>
        <tbody>
          {list.map((t) => {
            const items = evaluateTrack(ctx, t);
            const info = summarize(items.filter((i) => i.group === "metadata"));
            const rights = items.filter((i) => i.group === "rights" && i.required && !isResolved(i)).length;
            return <tr key={t.id}><Td className="text-xs">{t.projectCode}</Td><Td>{t.title}{t.isDemo && " (demo)"}</Td><Td className="text-xs">{t.status}</Td><Td className="text-xs">{[t.genre, t.bpm, t.musicalKey].filter(Boolean).join(" · ")}</Td><Td className="text-xs">{info.missingRequired ? `${info.missingRequired} missing` : "Complete"}</Td><Td className="text-xs">{rights ? `${rights} open` : "Documented"}</Td><Td className="text-xs">{formatDate(t.actualReleaseDate)}</Td></tr>;
          })}
        </tbody>
      </Table>
    );
  } else if (key === "releases") {
    const list = ctx.releases.filter((r) => !r.releaseDate || inRange(r.releaseDate) || r.releaseDate > today);
    body = (
      <Table>
        <thead><tr><Th>Release</Th><Th>Date</Th><Th>Status</Th><Th>Checklist</Th><Th>Missing info</Th><Th>Overdue steps</Th></tr></thead>
        <tbody>{list.map((r) => { const e = effectiveChecklist(ctx, r); const p = checklistProgress(e); return <tr key={r.id}><Td><Link href={`/releases/${r.id}`}>{r.title}</Link></Td><Td className="text-xs">{formatDate(r.releaseDate)}</Td><Td className="text-xs">{r.status}</Td><Td className="text-xs">{p.done}/{p.total}</Td><Td className="text-xs">{summarize(evaluateRelease(ctx, r)).missingRequired}</Td><Td className="text-xs">{e.filter((i) => i.overdue).length}</Td></tr>; })}</tbody>
      </Table>
    );
  } else if (key === "marketing") {
    const list = ctx.campaigns.filter((c) => (!sp.campaign || c.id === sp.campaign) && (!c.startDate || c.startDate <= to) && (!c.endDate || c.endDate >= from));
    body = (
      <Table>
        <thead><tr><Th>Campaign</Th><Th>Dates</Th><Th>Budget</Th><Th>Recorded spend</Th><Th>Ads approved</Th><Th>Content published</Th><Th>Results</Th></tr></thead>
        <tbody>{list.map((c) => { const u = budgetUsage({ amount: c.budget ?? 0, currency: c.currency, campaignId: c.id, releaseId: null, projectId: null, category: null, periodStart: null, periodEnd: null } as never, ctx.transactions, cur); const content = ctx.content.filter((x) => x.campaignId === c.id); return <tr key={c.id}><Td>{c.name}</Td><Td className="text-xs">{formatDate(c.startDate)} – {formatDate(c.endDate)}</Td><Td className="text-xs">{formatMoney(c.budget, c.currency)}</Td><Td className="text-xs">{formatMoney(u.spent, c.currency)}</Td><Td className="text-xs">{c.ads.filter((a) => a.status !== "draft").length}/{c.ads.length}</Td><Td className="text-xs">{content.filter((x) => x.publishedAt).length}/{content.length}</Td><Td className="max-w-xs text-xs text-muted">{c.results ?? "Not recorded"}</Td></tr>; })}</tbody>
      </Table>
    );
  } else if (key === "content") {
    const list = ctx.content.filter((c) => inRange(c.plannedDate) && (!sp.campaign || c.campaignId === sp.campaign) && (!sp.track || c.trackId === sp.track));
    body = (
      <Table>
        <thead><tr><Th>Date</Th><Th>Title</Th><Th>Platform / format</Th><Th>Stage</Th><Th>Approval</Th><Th>Recorded performance</Th></tr></thead>
        <tbody>{list.map((c) => <tr key={c.id}><Td className="text-xs">{formatDate(c.plannedDate)}</Td><Td>{c.title}</Td><Td className="text-xs">{c.platform} · {c.format}</Td><Td className="text-xs">{c.stage}</Td><Td className="text-xs">{titleCase(c.approvalStatus)}</Td><Td className="text-xs text-muted">{Object.keys(c.metrics ?? {}).length ? Object.entries(c.metrics).map(([k, v]) => `${k} ${formatNumber(v)}`).join(" · ") : "Not recorded"}</Td></tr>)}</tbody>
      </Table>
    );
  } else if (key === "audience") {
    const rows = (await db.select().from(analyticsRecords).where(eq(analyticsRecords.userId, user.id))).filter((r) => inRange(r.periodEnd) && (!sp.track || r.trackId === sp.track));
    const groups = Array.from(new Set(rows.map((r) => `${r.metric}|${r.platform}`))).map((g) => {
      const [metric, platform] = g.split("|");
      const list = rows.filter((r) => r.metric === metric && r.platform === platform).sort((a, b) => a.periodEnd.localeCompare(b.periodEnd));
      const first = Number(list[0].value);
      const last = Number(list[list.length - 1].value);
      return { metric, platform, first, last, n: list.length, firstDate: list[0].periodEnd, lastDate: list[list.length - 1].periodEnd, estimated: list.some((r) => r.verification === "estimated"), demo: list.some((r) => r.isDemo) };
    });
    body = groups.length ? (
      <Table>
        <thead><tr><Th>Metric</Th><Th>Platform</Th><Th>First value</Th><Th>Latest value</Th><Th>Change</Th><Th>Data points</Th><Th>Notes</Th></tr></thead>
        <tbody>{groups.map((g) => <tr key={g.metric + g.platform}><Td>{METRICS.find((m) => m.value === g.metric)?.label ?? g.metric}</Td><Td className="text-xs">{g.platform}</Td><Td className="text-xs">{formatNumber(g.first, 2)} <span className="text-faint">({formatDate(g.firstDate)})</span></Td><Td className="text-xs">{formatNumber(g.last, 2)} <span className="text-faint">({formatDate(g.lastDate)})</span></Td><Td className="text-xs">{g.n > 1 ? `${g.last - g.first >= 0 ? "+" : ""}${formatNumber(g.last - g.first, 2)}` : "—"}</Td><Td className="text-xs">{g.n}</Td><Td className="text-xs">{g.demo ? <Badge tone="info">demo data</Badge> : g.estimated ? <Badge tone="warning">includes estimates</Badge> : ""}</Td></tr>)}</tbody>
      </Table>
    ) : (
      <Notice>No metrics recorded in this period. Nothing has been estimated to fill the gap.</Notice>
    );
  } else if (key === "finance") {
    const s = summarizePeriod(ctx.transactions, cur, from, to);
    const outstanding = realOnly(ctx.transactions).filter((t) => (t.paymentStatus === "pending" || t.paymentStatus === "overdue") && t.nature === "actual");
    body = (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          <Card><Stat label="Actual income" value={formatMoney(s.income.amount, cur)} /></Card>
          <Card><Stat label="Actual expenses" value={formatMoney(s.expenses.amount, cur)} /></Card>
          <Card><Stat label="Net" value={formatMoney(s.net, cur)} tone={s.net < 0 ? "danger" : "success"} /></Card>
          <Card><Stat label="Estimated / forecast income" value={`${formatMoney(s.estimatedIncome.amount, cur)} / ${formatMoney(s.forecastIncome.amount, cur)}`} hint="Not included above" /></Card>
        </div>
        {s.income.unconverted + s.expenses.unconverted > 0 && <Notice tone="warning">{s.income.unconverted + s.expenses.unconverted} foreign-currency record(s) without an exchange rate are excluded.</Notice>}
        <div className="grid gap-6 md:grid-cols-2">
          {(["income", "expense"] as const).map((k) => (
            <Card key={k}>
              <CardHeader title={k === "income" ? "Income by category" : "Expenses by category"} />
              <Table><tbody>{byCategory(ctx.transactions, cur, k, from, to).map((r) => <tr key={r.category}><Td>{r.category}</Td><Td className="text-right tabular-nums">{formatMoney(r.amount, cur)}</Td></tr>)}</tbody></Table>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader title="Outstanding payments" />
          {outstanding.length ? <Table><thead><tr><Th>Date</Th><Th>Description</Th><Th>Type</Th><Th>Status</Th><Th className="text-right">Amount</Th></tr></thead><tbody>{outstanding.map((t) => <tr key={t.id}><Td className="text-xs">{formatDate(t.date)}</Td><Td>{t.description}</Td><Td className="text-xs">{t.kind}</Td><Td className="text-xs">{t.paymentStatus}</Td><Td className="text-right">{formatMoney(t.amount, t.currency)}</Td></tr>)}</tbody></Table> : <p className="text-sm text-muted">None.</p>}
        </Card>
        <Card>
          <CardHeader title="Budget vs. actual" />
          {ctx.budgets.filter((b) => !b.isDemo).length ? <Table><thead><tr><Th>Budget</Th><Th>Amount</Th><Th>Spent</Th><Th>Remaining</Th></tr></thead><tbody>{ctx.budgets.filter((b) => !b.isDemo).map((b) => { const u = budgetUsage(b, ctx.transactions, cur); return <tr key={b.id}><Td>{b.name}</Td><Td className="text-xs">{formatMoney(b.amount, b.currency)}</Td><Td className="text-xs">{formatMoney(u.spent, b.currency)}</Td><Td className={`text-xs ${u.over ? "text-danger" : ""}`}>{formatMoney(u.remaining, b.currency)}</Td></tr>; })}</tbody></Table> : <p className="text-sm text-muted">No budgets defined.</p>}
        </Card>
        <Card>
          <CardHeader title="Track-level profitability" description="Actual records linked to tracks (all time)" />
          <Table><thead><tr><Th>Track</Th><Th>Income</Th><Th>Expenses</Th><Th>Net</Th></tr></thead><tbody>{ctx.tracks.map((t) => { const linked = realOnly(ctx.transactions).filter((x) => x.trackId === t.id && x.nature === "actual"); if (!linked.length) return null; const inc = linked.filter((x) => x.kind === "income").reduce((a, x) => a + (toBase(x, cur) ?? 0), 0); const exp = linked.filter((x) => x.kind === "expense").reduce((a, x) => a + (toBase(x, cur) ?? 0), 0); return <tr key={t.id}><Td>{t.title}</Td><Td className="text-xs">{formatMoney(inc, cur)}</Td><Td className="text-xs">{formatMoney(exp, cur)}</Td><Td className="text-xs">{formatMoney(inc - exp, cur)}</Td></tr>; })}</tbody></Table>
        </Card>
        <p className="text-xs text-faint">This report summarises your records. It is not a tax calculation and does not certify compliance with accounting rules.</p>
      </div>
    );
  } else if (key === "rights") {
    const list = ctx.tracks.filter((t) => t.status !== "Archived" && (!sp.track || t.id === sp.track));
    body = (
      <Table>
        <thead><tr><Th>Track</Th><Th>Composition</Th><Th>Master</Th><Th>Samples</Th><Th>Agreement</Th><Th>Rights documents</Th><Th>Open questions</Th></tr></thead>
        <tbody>{list.map((t) => { const { composition, master } = splitsByType(t.splits); const c = summarizeSplits(composition); const m = summarizeSplits(master); const docs = ctx.documents.filter((d) => d.trackId === t.id && ["contract", "split_sheet", "license"].includes(d.category)).length; return <tr key={t.id}><Td>{t.title}</Td><Td className="text-xs">{c.count ? `${c.total}% (${c.count})` : "Missing"}{c.unconfirmed ? `, ${c.unconfirmed} unconfirmed` : ""}</Td><Td className="text-xs">{m.count ? `${m.total}% (${m.count})` : "Missing"}{m.unconfirmed ? `, ${m.unconfirmed} unconfirmed` : ""}</Td><Td className="text-xs">{t.rights?.samplesUsed ?? "unknown"}{t.rights?.samplesUsed === "yes" ? ` · ${t.rights.sampleLicenseStatus}` : ""}</Td><Td className="text-xs">{t.hasCollaborators === "no" ? "solo" : (t.rights?.agreementStatus ?? "unknown")}</Td><Td className="text-xs">{docs}</Td><Td className="max-w-xs text-xs text-muted">{t.rights?.openQuestions ?? ""}</Td></tr>; })}</tbody>
      </Table>
    );
  } else if (key === "tasks") {
    const completed = ctx.tasks.filter((t) => t.completedAt && inRange(t.completedAt.toISOString().slice(0, 10)));
    const overdue = ctx.tasks.filter((t) => OPEN_TASK_STATUSES.includes(t.status) && t.dueDate && t.dueDate < today);
    body = (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Card><Stat label="Completed in period" value={completed.length} /></Card>
          <Card><Stat label="Open" value={ctx.tasks.filter((t) => OPEN_TASK_STATUSES.includes(t.status)).length} /></Card>
          <Card><Stat label="Overdue" value={overdue.length} tone={overdue.length ? "danger" : undefined} /></Card>
        </div>
        <Table>
          <thead><tr><Th>Phase</Th><Th>Completed (period)</Th><Th>Open</Th><Th>Overdue</Th></tr></thead>
          <tbody>{[...PHASES.map((p) => ({ key: p.key as string | null, label: `${p.number}. ${p.title}` })), { key: null, label: "No phase" }].map((p) => <tr key={p.label}><Td>{p.label}</Td><Td className="text-xs">{completed.filter((t) => t.phaseKey === p.key).length}</Td><Td className="text-xs">{ctx.tasks.filter((t) => t.phaseKey === p.key && OPEN_TASK_STATUSES.includes(t.status)).length}</Td><Td className="text-xs">{overdue.filter((t) => t.phaseKey === p.key).length}</Td></tr>)}</tbody>
        </Table>
      </div>
    );
  } else if (key === "quarterly") {
    const fin = summarizePeriod(ctx.transactions, cur, from, to);
    const rels = ctx.releases.filter((r) => inRange(r.releaseDate));
    const reviews = ctx.releases.flatMap((r) => r.reviews.filter((v) => v.status === "completed" && v.completedAt && inRange(v.completedAt.toISOString().slice(0, 10))).map((v) => ({ r, v })));
    const goals = ctx.goals.filter((g) => g.horizon === "quarterly" || g.horizon === "annual" || inRange(g.deadline));
    body = (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          <Card><Stat label="Releases in quarter" value={rels.length} /></Card>
          <Card><Stat label="Tasks completed" value={ctx.tasks.filter((t) => t.completedAt && inRange(t.completedAt.toISOString().slice(0, 10))).length} /></Card>
          <Card><Stat label="Actual net" value={formatMoney(fin.net, cur)} /></Card>
          <Card><Stat label="Content published" value={ctx.content.filter((c) => c.publishedAt && inRange(c.publishedAt.toISOString().slice(0, 10))).length} /></Card>
        </div>
        <Card><CardHeader title="Goals" />{goals.length ? <Table><thead><tr><Th>Goal</Th><Th>Target</Th><Th>Current</Th><Th>Deadline</Th><Th>Status</Th></tr></thead><tbody>{goals.map((g) => <tr key={g.id}><Td>{g.title}</Td><Td className="text-xs">{formatNumber(g.targetValue)} {g.unit}</Td><Td className="text-xs">{formatNumber(g.currentValue)}</Td><Td className="text-xs">{formatDate(g.deadline)}</Td><Td className="text-xs">{g.status}</Td></tr>)}</tbody></Table> : <p className="text-sm text-muted">No goals for this period.</p>}</Card>
        <Card><CardHeader title="Lessons learned (from release reviews)" />{reviews.length ? <ul className="space-y-3 text-sm">{reviews.map(({ r, v }) => <li key={v.id}><span className="text-faint">{r.title} · {v.period}: </span>{v.lessons ?? v.summary}</li>)}</ul> : <p className="text-sm text-muted">No completed reviews in this quarter.</p>}</Card>
        <Card><CardHeader title="Next strategic actions" /><KeyValue items={PHASES.filter((p) => p.number >= 8).map((p) => ({ label: p.title, value: p.evaluate(ctx).nextAction?.label ?? "Criteria met" }))} /></Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow={<Link href="/reports" className="hover:text-fg">Reports</Link>}
        title={report.title}
        purpose={`${report.description} Period: ${formatDate(from, "long")} – ${formatDate(to, "long")}. Generated ${formatDate(today, "long")} from stored records.`}
        actions={
          <>
            {report.csv && <a href={`/api/export/${report.csv}`} className={"inline-flex h-9 items-center gap-2 rounded-md border border-line px-4 text-sm text-muted hover:text-fg"}><Download className="h-4 w-4" /> CSV</a>}
            <PrintButton />
          </>
        }
      />
      {ctx.transactions.some((t) => t.isDemo) && key === "finance" && <Notice tone="info" className="mb-4">Demo records are excluded from this report.</Notice>}
      {filters}
      {body}
    </div>
  );
}
