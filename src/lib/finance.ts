/**
 * Financial calculations (pure). Only real records count: demo rows are
 * excluded and actual / estimated / forecast values are never mixed.
 * Amounts in other currencies are only included when a conversion rate was
 * recorded; otherwise they are reported as "unconverted".
 */
import type { Budget, Transaction } from "./types";

export type Money = { amount: number; unconverted: number };

type Tx = Pick<
  Transaction,
  "kind" | "category" | "amount" | "currency" | "baseAmount" | "date" | "nature" | "paymentStatus" | "isDemo" | "campaignId" | "releaseId" | "trackId" | "projectId"
>;

export const MARKETING_CATEGORIES = new Set(["Advertising"]);
export const ROYALTY_CATEGORIES = new Set(["Streaming royalties", "Publishing royalties"]);

/** Amount in base currency, or null when no conversion is recorded. */
export function toBase(tx: Pick<Tx, "amount" | "currency" | "baseAmount">, base: string): number | null {
  if (tx.currency === base) return Number(tx.amount);
  if (tx.baseAmount !== null && tx.baseAmount !== undefined) return Number(tx.baseAmount);
  return null;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function sum(list: Tx[], base: string): Money {
  let amount = 0;
  let unconverted = 0;
  for (const t of list) {
    const v = toBase(t, base);
    if (v === null) unconverted++;
    else amount += v;
  }
  return { amount: r2(amount), unconverted };
}

export function realOnly<T extends Pick<Tx, "isDemo" | "paymentStatus">>(list: T[]) {
  return list.filter((t) => !t.isDemo && t.paymentStatus !== "cancelled");
}

export interface PeriodSummary {
  income: Money;
  expenses: Money;
  net: number;
  royalties: Money;
  marketing: Money;
  outstandingIncome: Money;
  unpaidExpenses: Money;
  estimatedIncome: Money;
  forecastIncome: Money;
  forecastExpenses: Money;
  count: number;
}

export function summarizePeriod(all: Tx[], base: string, from: string, to: string): PeriodSummary {
  const inPeriod = realOnly(all).filter((t) => t.date >= from && t.date <= to);
  const actual = inPeriod.filter((t) => t.nature === "actual");
  const income = actual.filter((t) => t.kind === "income");
  const expenses = actual.filter((t) => t.kind === "expense");
  const inc = sum(income, base);
  const exp = sum(expenses, base);
  return {
    income: inc,
    expenses: exp,
    net: r2(inc.amount - exp.amount),
    royalties: sum(income.filter((t) => ROYALTY_CATEGORIES.has(t.category)), base),
    marketing: sum(expenses.filter((t) => MARKETING_CATEGORIES.has(t.category) || t.campaignId), base),
    outstandingIncome: sum(income.filter((t) => t.paymentStatus === "pending" || t.paymentStatus === "overdue"), base),
    unpaidExpenses: sum(expenses.filter((t) => t.paymentStatus === "pending" || t.paymentStatus === "overdue"), base),
    estimatedIncome: sum(inPeriod.filter((t) => t.kind === "income" && t.nature === "estimated"), base),
    forecastIncome: sum(inPeriod.filter((t) => t.kind === "income" && t.nature === "forecast"), base),
    forecastExpenses: sum(inPeriod.filter((t) => t.kind === "expense" && t.nature === "forecast"), base),
    count: inPeriod.length,
  };
}

export function monthRange(month: string): [string, string] {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return [`${month}-01`, `${month}-${String(last).padStart(2, "0")}`];
}

export function previousMonth(month: string) {
  const [y, m] = month.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

/** Month-by-month actual income/expense series (for charts & cash-flow). */
export function monthlySeries(all: Tx[], base: string, months: string[]) {
  let cumulative = 0;
  return months.map((month) => {
    const [from, to] = monthRange(month);
    const s = summarizePeriod(all, base, from, to);
    cumulative = r2(cumulative + s.net);
    return { month, income: s.income.amount, expenses: s.expenses.amount, net: s.net, cumulative };
  });
}

export function lastNMonths(today: string, n: number) {
  const out: string[] = [];
  let m = today.slice(0, 7);
  for (let i = 0; i < n; i++) {
    out.unshift(m);
    m = previousMonth(m);
  }
  return out;
}

export function byCategory(all: Tx[], base: string, kind: "income" | "expense", from: string, to: string) {
  const map = new Map<string, number>();
  for (const t of realOnly(all).filter((t) => t.kind === kind && t.nature === "actual" && t.date >= from && t.date <= to)) {
    const v = toBase(t, base);
    if (v === null) continue;
    map.set(t.category, r2((map.get(t.category) ?? 0) + v));
  }
  return Array.from(map.entries())
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);
}

/** Budget vs. actual spending (actual expenses only, same currency as the budget or converted). */
export function budgetUsage(budget: Budget, all: Tx[], base: string) {
  const expenses = realOnly(all).filter((t) => {
    if (t.kind !== "expense" || t.nature !== "actual") return false;
    if (budget.releaseId) return t.releaseId === budget.releaseId;
    if (budget.campaignId) return t.campaignId === budget.campaignId;
    if (budget.projectId) return t.projectId === budget.projectId;
    if (budget.category && t.category !== budget.category) return false;
    if (budget.periodStart && t.date < budget.periodStart) return false;
    if (budget.periodEnd && t.date > budget.periodEnd) return false;
    return true;
  });
  const cur = budget.currency || base;
  const spent = sum(expenses, cur);
  const amount = Number(budget.amount);
  return {
    spent: spent.amount,
    unconverted: spent.unconverted,
    remaining: r2(amount - spent.amount),
    percent: amount > 0 ? Math.round((spent.amount / amount) * 100) : 0,
    over: spent.amount > amount,
  };
}

/** Income minus expenses linked to a track / release / campaign (actual only). */
export function profitability(all: Tx[], base: string, key: "trackId" | "releaseId" | "campaignId" | "projectId", id: string) {
  const linked = realOnly(all).filter((t) => t[key] === id && t.nature === "actual");
  const inc = sum(linked.filter((t) => t.kind === "income"), base);
  const exp = sum(linked.filter((t) => t.kind === "expense"), base);
  return { income: inc.amount, expenses: exp.amount, net: r2(inc.amount - exp.amount), unconverted: inc.unconverted + exp.unconverted, count: linked.length };
}
