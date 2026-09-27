import { OPEN_TASK_STATUSES } from "../constants";
import { monthRange, summarizePeriod } from "../finance";
import { evaluateAll, evaluateRelease, summarize } from "../info/engine";
import { buildRecommendations } from "../recommendations";
import { checklistProgress, effectiveChecklist } from "../releases/checklist";
import type { BusinessContext } from "../types";
import { formatDate, formatMoney } from "../utils";
import { upcomingReleases } from "../workflow/phases";

/**
 * Offline assistant: answers common questions deterministically from stored
 * data when no AI provider is configured. It never generates new content.
 */
export function offlineAnswer(ctx: BusinessContext, question: string): string {
  const q = question.toLowerCase();
  const cur = ctx.settings.currency;
  const lines: string[] = [];

  if (/(today|next|priorit|what should|focus)/.test(q)) {
    const recs = buildRecommendations(ctx, 5);
    lines.push("**Your next priorities** (from deadlines, blockers and missing information):");
    recs.forEach((r, i) => lines.push(`${i + 1}. **${r.title}** — ${r.why} [Open](${r.href})`));
    if (!recs.length) lines.push("Nothing urgent is tracked right now.");
    return lines.join("\n");
  }
  if (/(missing|incomplete|information|info)/.test(q)) {
    const items = evaluateAll(ctx).filter((i) => i.required && i.status !== "complete" && i.status !== "not_applicable");
    lines.push(`**${items.length} required item(s) need attention.**`);
    for (const i of items.slice(0, 12)) lines.push(`- ${i.label} · ${i.entityLabel} (${i.status.replace("_", " ")})`);
    if (items.length > 12) lines.push(`- …and ${items.length - 12} more in the [Information Center](/information).`);
    return lines.join("\n");
  }
  if (/(release)/.test(q)) {
    const list = upcomingReleases(ctx);
    if (!list.length) return "No upcoming releases. [Create a release](/releases/new) to start the checklist.";
    lines.push("**Upcoming releases:**");
    for (const r of list) {
      const p = checklistProgress(effectiveChecklist(ctx, r));
      const s = summarize(evaluateRelease(ctx, r));
      lines.push(`- **${r.title}** — ${r.releaseDate ? formatDate(r.releaseDate, "long") : "no date"} · ${r.status} · checklist ${p.done}/${p.total}${s.missingRequired ? ` · ${s.missingRequired} missing item(s)` : ""} [Open](/releases/${r.id})`);
    }
    return lines.join("\n");
  }
  if (/(overdue|task|to ?do)/.test(q)) {
    const open = ctx.tasks.filter((t) => OPEN_TASK_STATUSES.includes(t.status));
    const overdue = open.filter((t) => t.dueDate && t.dueDate < ctx.today);
    lines.push(`**${open.length} open task(s), ${overdue.length} overdue.**`);
    for (const t of [...overdue, ...open.filter((t) => !overdue.includes(t))].slice(0, 10)) lines.push(`- ${t.title}${t.dueDate ? ` — due ${formatDate(t.dueDate)}` : ""} [Open](/tasks/${t.id})`);
    return lines.join("\n");
  }
  if (/(money|financ|income|expense|budget|revenue|royalt)/.test(q)) {
    const s = summarizePeriod(ctx.transactions, cur, ...monthRange(ctx.today.slice(0, 7)));
    return [
      `**This month (actual recorded values, ${cur}):**`,
      `- Income: ${formatMoney(s.income.amount, cur)}`,
      `- Expenses: ${formatMoney(s.expenses.amount, cur)}`,
      `- Net: ${formatMoney(s.net, cur)}`,
      `- Outstanding income: ${formatMoney(s.outstandingIncome.amount, cur)}`,
      s.count ? "" : "No records this month yet — [add one](/finances/new).",
    ].filter(Boolean).join("\n");
  }
  if (/(summar|overview|status|how am i|business)/.test(q)) {
    const s = summarize(evaluateAll(ctx));
    return [
      `**${ctx.profile.artistName ?? "Your"} business overview**`,
      `- Required information: ${s.percent}% complete (${s.missingRequired} missing)`,
      `- Tracks: ${ctx.tracks.length} · upcoming releases: ${upcomingReleases(ctx).length} · active campaigns: ${ctx.campaigns.filter((c) => c.status === "Active").length}`,
      `- Open tasks: ${ctx.tasks.filter((t) => OPEN_TASK_STATUSES.includes(t.status)).length}`,
      `Ask “what should I do next?” for priorities.`,
    ].join("\n");
  }
  return [
    "I’m running in **offline mode** (no AI provider configured), so I can answer from your stored data but can’t draft new text.",
    "Try asking:",
    "- What should I do next?",
    "- What information is missing?",
    "- How are my releases doing?",
    "- Which tasks are overdue?",
    "- How are my finances this month?",
    "- Give me a business overview.",
    "",
    "To enable the full assistant, set `ANTHROPIC_API_KEY` on the server (see Settings → AI).",
  ].join("\n");
}
