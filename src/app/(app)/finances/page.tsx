import Link from "next/link";
import { Download, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { BarsChart, LineSeriesChart } from "@/components/charts/charts";
import { ConfirmAction, filterClass } from "@/components/ui/form";
import { FormModal } from "@/components/ui/form-modal";
import { Badge, Card, CardHeader, DemoBadge, EmptyState, LinkButton, LinkTabs, Notice, PageHeader, Progress, Stat, Table, Td, Th } from "@/components/ui/primitives";
import { deleteBudget, saveBudget } from "@/lib/actions/finance";
import { requireUser } from "@/lib/auth";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/lib/constants";
import { loadContext } from "@/lib/context";
import { budgetUsage, byCategory, lastNMonths, monthRange, monthlySeries, summarizePeriod, toBase } from "@/lib/finance";
import { BUDGET_FIELDS, withOptions } from "@/lib/forms";
import { relationOptions } from "@/lib/task-options";
import { formatDate, formatMoney, formatMonth, titleCase } from "@/lib/utils";

export const metadata = { title: "Finances" };

type SP = { tab?: string; month?: string; kind?: string; status?: string; nature?: string; category?: string };

export default async function FinancesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser();
  const ctx = await loadContext(user.id);
  const sp = await searchParams;
  const tab = sp.tab === "ledger" || sp.tab === "budgets" ? sp.tab : sp.status ? "ledger" : "overview";
  const cur = ctx.settings.currency;
  const month = sp.month && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : ctx.today.slice(0, 7);
  const [from, to] = monthRange(month);
  const s = summarizePeriod(ctx.transactions, cur, from, to);
  const year = summarizePeriod(ctx.transactions, cur, `${month.slice(0, 4)}-01-01`, `${month.slice(0, 4)}-12-31`);
  const series = monthlySeries(ctx.transactions, cur, lastNMonths(ctx.today, 12));
  const demoCount = ctx.transactions.filter((t) => t.isDemo).length;
  const opts = relationOptions(ctx);

  const ledger = ctx.transactions
    .filter((t) => (!sp.kind || t.kind === sp.kind) && (!sp.status || t.paymentStatus === sp.status) && (!sp.nature || t.nature === sp.nature) && (!sp.category || t.category === sp.category) && (!sp.month || t.date.startsWith(sp.month)))
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div>
      <PageHeader
        eyebrow="Finances"
        title="Money in, money out"
        purpose={`Actual, estimated and forecast values are kept separate. Totals use actual records in ${cur}; foreign amounts count only when an exchange rate was recorded. Not tax or accounting advice.`}
        actions={
          <>
            <LinkButton href="/import/transactions" variant="ghost"><Upload className="h-4 w-4" /> Import</LinkButton>
            <a href="/api/export/transactions" className="inline-flex h-9 items-center gap-2 rounded-md px-4 text-sm text-muted hover:bg-surface-3 hover:text-fg"><Download className="h-4 w-4" /> CSV</a>
            <LinkButton href="/finances/new?kind=income" variant="outline"><Plus className="h-4 w-4" /> Income</LinkButton>
            <LinkButton href="/finances/new?kind=expense" variant="primary"><Plus className="h-4 w-4" /> Expense</LinkButton>
          </>
        }
      />
      {demoCount > 0 && <Notice tone="info" className="mb-6">{demoCount} demo record(s) are shown in the ledger with a DEMO badge and are excluded from every total and report.</Notice>}
      <LinkTabs active={tab} tabs={[{ key: "overview", label: "Overview", href: "/finances" }, { key: "ledger", label: "Ledger", href: "/finances?tab=ledger" }, { key: "budgets", label: "Budgets", href: "/finances?tab=budgets" }]} />

      {tab === "overview" && (
        <>
          <form className="mb-4 flex items-center gap-2">
            <label htmlFor="month" className="text-xs text-muted">Month</label>
            <input id="month" type="month" name="month" defaultValue={month} className={filterClass} />
            <button className="rounded-md border border-line px-3 py-1.5 text-sm text-muted hover:text-fg" type="submit">Show</button>
            <Link href={`/reports/finance?month=${month}`} className="ml-auto text-xs text-muted hover:text-fg">Monthly report →</Link>
          </form>
          <div className="mb-6 grid gap-4 md:grid-cols-3 xl:grid-cols-6">
            <Card><Stat label={`Income · ${formatMonth(month)}`} value={formatMoney(s.income.amount, cur)} /></Card>
            <Card><Stat label="Expenses" value={formatMoney(s.expenses.amount, cur)} /></Card>
            <Card><Stat label="Net" value={formatMoney(s.net, cur)} tone={s.net < 0 ? "danger" : "success"} /></Card>
            <Card><Stat label="Outstanding income" value={formatMoney(s.outstandingIncome.amount, cur)} /></Card>
            <Card><Stat label="Estimated income" value={formatMoney(s.estimatedIncome.amount, cur)} hint="Not included in actuals" /></Card>
            <Card><Stat label={`Net ${month.slice(0, 4)} (actual)`} value={formatMoney(year.net, cur)} /></Card>
          </div>
          {s.income.unconverted + s.expenses.unconverted > 0 && <Notice tone="warning" className="mb-6">{s.income.unconverted + s.expenses.unconverted} record(s) in another currency have no exchange rate and are excluded from these totals.</Notice>}
          {series.some((x) => x.income || x.expenses) ? (
            <div className="grid gap-6 xl:grid-cols-2">
              <Card><BarsChart title="Actual income vs. expenses (12 months)" currency={cur} rows={series.map((x) => ({ x: formatMonth(x.month), income: x.income, expenses: x.expenses }))} series={[{ key: "income", label: "Income", color: "1" }, { key: "expenses", label: "Expenses", color: "2" }]} /></Card>
              <Card><LineSeriesChart title="Cumulative net cash flow (12 months)" currency={cur} xLabel="Month" rows={series.map((x) => ({ x: formatMonth(x.month), cumulative: x.cumulative }))} series={[{ key: "cumulative", label: "Cumulative net", color: "2" }]} /></Card>
            </div>
          ) : (
            <EmptyState title="No financial records yet." description="Add your first income or expense to start tracking your music business finances." action={<LinkButton href="/finances/new" variant="primary">Add record</LinkButton>} />
          )}
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            {(["income", "expense"] as const).map((k) => {
              const rows = byCategory(ctx.transactions, cur, k, from, to);
              return (
                <Card key={k}>
                  <CardHeader title={`${k === "income" ? "Income" : "Expenses"} by category · ${formatMonth(month)}`} />
                  {rows.length ? (
                    <ul className="space-y-2">
                      {rows.map((r) => (
                        <li key={r.category}>
                          <div className="flex justify-between text-sm"><span>{r.category}</span><span className="tabular-nums">{formatMoney(r.amount, cur)}</span></div>
                          <Progress value={r.amount} max={rows[0].amount} className="mt-1" tone={k === "income" ? "success" : "accent"} />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted">No actual {k} records this month.</p>
                  )}
                </Card>
              );
            })}
          </div>
        </>
      )}

      {tab === "ledger" && (
        <>
          <form className="mb-4 flex flex-wrap gap-2">
            <input type="hidden" name="tab" value="ledger" />
            <select name="kind" defaultValue={sp.kind ?? ""} className={filterClass} aria-label="Type"><option value="">Income & expenses</option><option value="income">Income</option><option value="expense">Expenses</option></select>
            <select name="nature" defaultValue={sp.nature ?? ""} className={filterClass} aria-label="Nature"><option value="">Actual, estimated & forecast</option><option value="actual">Actual</option><option value="estimated">Estimated</option><option value="forecast">Forecast</option></select>
            <select name="status" defaultValue={sp.status ?? ""} className={filterClass} aria-label="Payment status"><option value="">Any payment status</option><option value="paid">Paid</option><option value="pending">Pending</option><option value="overdue">Overdue</option><option value="cancelled">Cancelled</option></select>
            <select name="category" defaultValue={sp.category ?? ""} className={filterClass} aria-label="Category"><option value="">All categories</option>{[...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES].map((c) => <option key={c}>{c}</option>)}</select>
            <input type="month" name="month" defaultValue={sp.month ?? ""} className={filterClass} aria-label="Month" />
            <button className="rounded-md border border-line px-3 text-sm text-muted hover:text-fg" type="submit">Apply</button>
          </form>
          {ledger.length ? (
            <Table>
              <thead><tr><Th>Date</Th><Th>Description</Th><Th>Category</Th><Th>Nature</Th><Th>Status</Th><Th className="text-right">Amount</Th><Th className="text-right">In {cur}</Th></tr></thead>
              <tbody>
                {ledger.map((t) => {
                  const base = toBase(t, cur);
                  return (
                    <tr key={t.id} className="hover:bg-surface-2">
                      <Td className="text-xs text-muted">{formatDate(t.date)}</Td>
                      <Td><Link href={`/finances/${t.id}`} className="hover:text-accent-strong">{t.description}</Link> {t.isDemo && <DemoBadge />}{t.documentId && <span className="ml-1 text-[10px] text-faint">📎</span>}<div className="text-xs text-faint">{t.counterparty}</div></Td>
                      <Td className="text-xs">{t.category}</Td>
                      <Td><Badge tone={t.nature === "actual" ? "neutral" : t.nature === "estimated" ? "warning" : "info"}>{t.nature}</Badge></Td>
                      <Td><Badge tone={t.paymentStatus === "paid" ? "success" : t.paymentStatus === "overdue" ? "danger" : t.paymentStatus === "pending" ? "warning" : "inactive"}>{t.paymentStatus}</Badge></Td>
                      <Td className={`text-right tabular-nums ${t.kind === "expense" ? "text-muted" : ""}`}>{t.kind === "expense" ? "−" : "+"}{formatMoney(t.amount, t.currency)}</Td>
                      <Td className="text-right text-xs tabular-nums text-muted">{base === null ? <span className="text-warning" title="No exchange rate recorded">not converted</span> : t.currency === cur ? "—" : <span title={`Rate ${t.fxRate} · ${t.fxSource} · ${t.fxDate}`}>{formatMoney(base, cur)}</span>}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          ) : (
            <EmptyState compact title="No records match." />
          )}
        </>
      )}

      {tab === "budgets" && (
        <>
          <div className="mb-4 flex justify-end">
            <FormModal label="New budget" title="New budget" action={saveBudget} defs={withOptions(BUDGET_FIELDS, { releaseId: opts.releaseId, campaignId: opts.campaignId, projectId: opts.projectId })} values={{ scope: "monthly", currency: cur, periodStart: `${ctx.today.slice(0, 7)}-01` }} variant="primary" icon={<Plus className="h-4 w-4" />} />
          </div>
          {ctx.budgets.length ? (
            <div className="grid gap-4 md:grid-cols-2">
              {ctx.budgets.map((b) => {
                const u = budgetUsage(b, ctx.transactions, cur);
                return (
                  <Card key={b.id}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm">{b.name} {b.isDemo && <DemoBadge />}</div>
                        <div className="text-xs text-faint">{titleCase(b.scope)}{b.category ? ` · ${b.category}` : ""}{b.periodStart ? ` · ${formatDate(b.periodStart)} – ${formatDate(b.periodEnd)}` : ""}</div>
                      </div>
                      <div className="flex">
                        <FormModal label="Edit" title="Edit budget" action={saveBudget} defs={withOptions(BUDGET_FIELDS, { releaseId: opts.releaseId, campaignId: opts.campaignId, projectId: opts.projectId })} values={b as unknown as Record<string, unknown>} hidden={{ id: b.id }} variant="ghost" size="icon" icon={<Pencil className="h-3.5 w-3.5" />} />
                        <ConfirmAction action={deleteBudget} fields={{ id: b.id }} label="Delete" title="Delete this budget?" message="Only the budget is removed; financial records remain." size="icon" variant="ghost" icon={<Trash2 className="h-3.5 w-3.5" />} />
                      </div>
                    </div>
                    <div className="mt-4 flex justify-between text-sm"><span>{formatMoney(u.spent, b.currency)} of {formatMoney(b.amount, b.currency)}</span><span className={u.over ? "text-danger" : "text-muted"}>{u.over ? `${formatMoney(-u.remaining, b.currency)} over` : `${formatMoney(u.remaining, b.currency)} left`}</span></div>
                    <Progress value={u.percent} tone={u.over ? "danger" : u.percent > 80 ? "warning" : "accent"} className="mt-2" />
                    {u.unconverted > 0 && <p className="mt-2 text-xs text-warning">{u.unconverted} record(s) in another currency not included.</p>}
                  </Card>
                );
              })}
            </div>
          ) : (
            <EmptyState title="No budgets yet." description="Create monthly, release or campaign budgets to compare plans against actual spending." />
          )}
        </>
      )}
    </div>
  );
}
