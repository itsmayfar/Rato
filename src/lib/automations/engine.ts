import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { automationLogs, automationRules, notifications } from "../db/schema";
import { loadContextUncached } from "../context";
import { OPEN_TASK_STATUSES } from "../constants";
import { evaluateRelease, summarize } from "../info/engine";
import { effectiveChecklist } from "../releases/checklist";
import { ensureExecutionChecklist } from "../releases/store";
import { monthRange, previousMonth, summarizePeriod } from "../finance";
import { buildRecommendations } from "../recommendations";
import { syncInformationTasks } from "../tasks/generate";
import { scheduleNextOccurrence } from "../tasks/recurrence";
import type { AutomationRule, BusinessContext } from "../types";
import { addDays, daysBetween, formatDate, formatMoney, todayISO } from "../utils";
import { upcomingReleases } from "../workflow/phases";
import type { AutomationKind } from "./kinds";

type Note = { kind: string; title: string; body?: string; link?: string; dedupeKey: string };
type Outcome = { notes: Note[]; details: string };

/** Is the rule due to run at `today`? */
export function isDue(rule: Pick<AutomationRule, "schedule" | "lastRunAt" | "enabled">, today: string, timeZone?: string) {
  if (!rule.enabled) return false;
  if (!rule.lastRunAt) return true;
  const last = todayISO(timeZone, rule.lastRunAt);
  if (rule.schedule === "weekly") return daysBetween(last, today) >= 7;
  if (rule.schedule === "monthly") return last.slice(0, 7) !== today.slice(0, 7);
  return last !== today;
}

function isoWeek(date: string) {
  const d = new Date(`${date}T00:00:00Z`);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((d.getTime() - firstThursday.getTime()) / 86_400_000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

async function execute(kind: AutomationKind, rule: AutomationRule, ctx: BusinessContext): Promise<Outcome> {
  const today = ctx.today;
  const cond = rule.conditions as Record<string, number>;
  const notes: Note[] = [];
  const open = ctx.tasks.filter((t) => OPEN_TASK_STATUSES.includes(t.status));

  switch (kind) {
    case "deadline_reminders": {
      const ahead = cond.daysAhead ?? 3;
      const horizon = addDays(today, ahead);
      for (const t of open.filter((t) => t.dueDate && t.dueDate >= today && t.dueDate <= horizon)) {
        notes.push({ kind: "deadline", title: `Due ${t.dueDate === today ? "today" : formatDate(t.dueDate)}: ${t.title}`, link: `/tasks/${t.id}`, dedupeKey: `deadline:task:${t.id}:${t.dueDate}` });
      }
      for (const r of upcomingReleases(ctx)) {
        for (const i of effectiveChecklist(ctx, r).filter((i) => i.effectiveStatus === "pending" && i.dueDate && i.dueDate >= today && i.dueDate <= horizon)) {
          notes.push({ kind: "deadline", title: `${r.title}: “${i.label}” due ${formatDate(i.dueDate)}`, link: `/releases/${r.id}`, dedupeKey: `deadline:check:${i.id}:${i.dueDate}` });
        }
      }
      return { notes, details: `${notes.length} upcoming deadline(s) within ${ahead} day(s).` };
    }
    case "overdue_tasks": {
      for (const t of open.filter((t) => t.dueDate && t.dueDate < today)) {
        notes.push({ kind: "overdue", title: `Overdue: ${t.title}`, body: `Was due ${formatDate(t.dueDate)}.`, link: `/tasks/${t.id}`, dedupeKey: `overdue:${t.id}:${t.dueDate}` });
      }
      return { notes, details: `${notes.length} overdue task(s).` };
    }
    case "missing_info": {
      const within = cond.withinDays ?? 45;
      if ((rule.actions as { createTasks?: boolean }).createTasks !== false) await syncInformationTasks(ctx.userId, within);
      for (const r of upcomingReleases(ctx).filter((r) => !r.releaseDate || r.releaseDate <= addDays(today, within))) {
        const s = summarize(evaluateRelease(ctx, r));
        if (s.missingRequired)
          notes.push({
            kind: "missing_info",
            title: `“${r.title}” is missing ${s.missingRequired} required item(s)`,
            body: s.blocking.slice(0, 5).map((b) => b.label).join(", "),
            link: `/releases/${r.id}/questions`,
            dedupeKey: `missing:release:${r.id}:${s.missingRequired}`,
          });
      }
      return { notes, details: `${notes.length} release(s) with missing information; information tasks synchronised.` };
    }
    case "weekly_summary": {
      const week = isoWeek(today);
      const horizon = addDays(today, 7);
      const dueThisWeek = open.filter((t) => t.dueDate && t.dueDate <= horizon).length;
      const overdue = open.filter((t) => t.dueDate && t.dueDate < today).length;
      const releasesSoon = upcomingReleases(ctx).filter((r) => r.releaseDate && r.releaseDate <= addDays(today, 30));
      const recs = buildRecommendations(ctx, 3);
      notes.push({
        kind: "summary",
        title: `Weekly summary · ${week}`,
        body: [
          `${dueThisWeek} task(s) due in the next 7 days, ${overdue} overdue.`,
          releasesSoon.length ? `Releases in the next 30 days: ${releasesSoon.map((r) => `${r.title} (${formatDate(r.releaseDate)})`).join(", ")}.` : "No releases in the next 30 days.",
          recs.length ? `Top priorities: ${recs.map((r) => r.title).join(" · ")}.` : "",
        ]
          .filter(Boolean)
          .join(" "),
        link: "/dashboard",
        dedupeKey: `weekly:${week}`,
      });
      return { notes, details: "Weekly summary created." };
    }
    case "monthly_finance": {
      const month = previousMonth(today.slice(0, 7));
      const [from, to] = monthRange(month);
      const s = summarizePeriod(ctx.transactions, ctx.settings.currency, from, to);
      const cur = ctx.settings.currency;
      notes.push({
        kind: "summary",
        title: `Financial summary · ${month}`,
        body: s.count
          ? `Actual income ${formatMoney(s.income.amount, cur)}, expenses ${formatMoney(s.expenses.amount, cur)}, net ${formatMoney(s.net, cur)}. Outstanding income ${formatMoney(s.outstandingIncome.amount, cur)}.${s.income.unconverted + s.expenses.unconverted ? ` ${s.income.unconverted + s.expenses.unconverted} record(s) in other currencies without a recorded rate are not included.` : ""}`
          : "No financial records for this month. Add income and expenses to get a real summary.",
        link: `/reports/finance?month=${month}`,
        dedupeKey: `finance:${month}`,
      });
      return { notes, details: `Summary for ${month} (${s.count} record(s)).` };
    }
    case "release_prep": {
      let created = 0;
      for (const r of upcomingReleases(ctx).filter((r) => r.releaseDate && daysBetween(today, r.releaseDate) <= 7 && daysBetween(today, r.releaseDate) >= -1)) {
        if (!r.execution.length) {
          await ensureExecutionChecklist(ctx.userId, r.id);
          created++;
        }
        const d = daysBetween(today, r.releaseDate!);
        notes.push({
          kind: "deadline",
          title: d <= 0 ? `Release day: ${r.title}` : `${r.title} releases in ${d} day(s)`,
          body: "The release-day checklist is ready. Confirm each step only after you’ve done it.",
          link: `/releases/${r.id}?tab=execution`,
          dedupeKey: `release-prep:${r.id}:${d <= 0 ? "day" : d <= 3 ? "3" : "7"}`,
        });
      }
      return { notes, details: `${notes.length} release(s) approaching; ${created} release-day checklist(s) created.` };
    }
    case "content_reminders": {
      const ahead = cond.daysAhead ?? 1;
      for (const c of ctx.content.filter((c) => c.plannedDate && c.plannedDate >= today && c.plannedDate <= addDays(today, ahead) && !["Published", "Analyzed", "Archived"].includes(c.stage))) {
        notes.push({
          kind: "deadline",
          title: `Content planned ${c.plannedDate === today ? "today" : formatDate(c.plannedDate)}: ${c.title}`,
          body: c.approvalStatus === "approved" ? "Approved and ready. Publish manually and mark it as published." : "Not approved yet — content is never published without your approval.",
          link: `/content/${c.id}`,
          dedupeKey: `content:${c.id}:${c.plannedDate}`,
        });
      }
      for (const c of ctx.content.filter((c) => c.approvalStatus === "pending")) {
        notes.push({ kind: "deadline", title: `Awaiting your approval: ${c.title}`, link: `/content/${c.id}`, dedupeKey: `approval:${c.id}` });
      }
      return { notes, details: `${notes.length} content reminder(s).` };
    }
    case "campaign_review": {
      for (const c of ctx.campaigns.filter((c) => c.endDate && c.endDate < today && ["Active", "Ready"].includes(c.status))) {
        notes.push({ kind: "review", title: `Campaign ended: review “${c.name}”`, body: "Record results and lessons learned.", link: `/marketing/${c.id}`, dedupeKey: `campaign-review:${c.id}` });
      }
      for (const r of ctx.releases) {
        for (const v of r.reviews.filter((v) => v.status === "pending" && v.dueDate <= today)) {
          notes.push({ kind: "review", title: `${v.period} review due: ${r.title}`, link: `/releases/${r.id}?tab=performance`, dedupeKey: `release-review:${v.id}` });
        }
      }
      return { notes, details: `${notes.length} review reminder(s).` };
    }
    case "recurring_tasks": {
      let n = 0;
      for (const t of ctx.tasks.filter((t) => t.recurrence && t.status === "completed")) {
        await scheduleNextOccurrence(ctx.userId, t);
        n++;
      }
      return { notes, details: `Checked ${n} completed recurring task(s); next occurrences exist.` };
    }
    case "follow_up_reminders": {
      for (const c of ctx.contacts.filter((c) => c.nextFollowUpDate && c.nextFollowUpDate <= today && !["closed", "archived"].includes(c.pipelineStatus))) {
        notes.push({ kind: "follow_up", title: `Follow up with ${c.name}`, body: c.organization ?? undefined, link: `/contacts/${c.id}`, dedupeKey: `followup:${c.id}:${c.nextFollowUpDate}` });
      }
      return { notes, details: `${notes.length} follow-up(s) due.` };
    }
  }
}

export type RunResult = { ruleId: string; name: string; result: "success" | "error" | "awaiting_approval" | "skipped"; details: string; created: number };

/**
 * Run due automation rules for a user. Built-in actions only create
 * notifications, tasks and checklists inside the app; nothing external is
 * ever sent, published or paid. Every run is logged with its real outcome.
 */
export async function runAutomations(userId: string, opts: { ruleId?: string; force?: boolean; approved?: boolean } = {}): Promise<RunResult[]> {
  const ctx = await loadContextUncached(userId);
  const rules = await db
    .select()
    .from(automationRules)
    .where(and(eq(automationRules.userId, userId), ...(opts.ruleId ? [eq(automationRules.id, opts.ruleId)] : [])));
  const results: RunResult[] = [];

  for (const rule of rules) {
    if (!opts.force && !isDue(rule, ctx.today, ctx.settings.timezone)) continue;
    if (!rule.enabled && !opts.force) continue;
    if (rule.requiresApproval && !opts.approved) {
      await db.insert(automationLogs).values({
        userId,
        ruleId: rule.id,
        ruleName: rule.name,
        action: rule.kind,
        result: "awaiting_approval",
        details: "This rule requires approval before it runs. Use “Run now” to approve this run.",
        approvalStatus: "pending",
      });
      await db.update(automationRules).set({ lastRunAt: new Date() }).where(eq(automationRules.id, rule.id));
      results.push({ ruleId: rule.id, name: rule.name, result: "awaiting_approval", details: "Waiting for approval", created: 0 });
      continue;
    }
    try {
      const out = await execute(rule.kind as AutomationKind, rule, ctx);
      let created = 0;
      if ((rule.actions as { notify?: boolean }).notify !== false && out.notes.length) {
        const rows = await db
          .insert(notifications)
          .values(out.notes.map((n) => ({ userId, ...n })))
          .onConflictDoNothing({ target: [notifications.userId, notifications.dedupeKey] })
          .returning({ id: notifications.id });
        created = rows.length;
      }
      await db.insert(automationLogs).values({
        userId,
        ruleId: rule.id,
        ruleName: rule.name,
        action: rule.kind,
        result: "success",
        details: `${out.details} ${created} new notification(s).`,
        approvalStatus: rule.requiresApproval ? "approved" : "not_required",
      });
      await db.update(automationRules).set({ lastRunAt: new Date() }).where(eq(automationRules.id, rule.id));
      results.push({ ruleId: rule.id, name: rule.name, result: "success", details: out.details, created });
    } catch (err) {
      const message = (err as Error).message ?? "Unknown error";
      await db.insert(automationLogs).values({ userId, ruleId: rule.id, ruleName: rule.name, action: rule.kind, result: "error", error: message.slice(0, 500) });
      results.push({ ruleId: rule.id, name: rule.name, result: "error", details: message, created: 0 });
    }
  }
  return results;
}
