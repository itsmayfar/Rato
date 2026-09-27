/**
 * "What should I do next?" — ranks a small set of concrete actions from the
 * stored business data. Pure and deterministic; the AI assistant builds on it
 * but never replaces it.
 */
import { OPEN_TASK_STATUSES, PRIORITY_RANK } from "./constants";
import { evaluateProfile, evaluateRelease, evaluateTrack, isResolved, summarize } from "./info/engine";
import { GROUP_LABELS, ONBOARDING_STEPS } from "./info/registry";
import { effectiveChecklist } from "./releases/checklist";
import type { BusinessContext, Task } from "./types";
import { addDays, daysBetween, formatDate } from "./utils";
import { recommendedPhase, tracksForRelease, upcomingReleases } from "./workflow/phases";

export interface Recommendation {
  id: string;
  title: string;
  why: string;
  effort?: string;
  requiredInfo: string[];
  href: string;
  actionLabel: string;
  score: number;
  category: "setup" | "task" | "release" | "rights" | "marketing" | "content" | "finance" | "network" | "review" | "strategy";
}

function urgency(days: number) {
  if (days < 0) return 40;
  if (days <= 3) return 30;
  if (days <= 7) return 22;
  if (days <= 14) return 15;
  if (days <= 30) return 8;
  return 2;
}

export function isOverdue(t: Pick<Task, "status" | "dueDate">, today: string) {
  return OPEN_TASK_STATUSES.includes(t.status) && Boolean(t.dueDate && t.dueDate < today);
}

export function buildRecommendations(ctx: BusinessContext, limit = 5): Recommendation[] {
  const recs: Recommendation[] = [];
  const today = ctx.today;

  // 1. Foundation information
  for (const step of ONBOARDING_STEPS) {
    const s = summarize(evaluateProfile(ctx, [step]));
    if (s.missingRequired > 0 && ctx.profile.onboardingSteps?.[step] !== "skipped") {
      recs.push({
        id: `onboarding:${step}`,
        title: `Complete “${GROUP_LABELS[step].title}”`,
        why: step === "identity" ? "Your identity is reused on every release, credit and message." : "Recommendations and plans depend on this information.",
        effort: `~${Math.max(3, s.missingRequired * 2)} min`,
        requiredInfo: s.blocking.map((b) => b.label).slice(0, 5),
        href: `/onboarding?step=${step}`,
        actionLabel: "Answer questions",
        score: step === "identity" ? 70 : 45,
        category: "setup",
      });
      break; // one onboarding recommendation at a time
    }
  }

  // 2. Overdue & due-soon tasks
  // Information tasks are represented by the richer "provide missing information" recommendations below
  const open = ctx.tasks.filter((t) => OPEN_TASK_STATUSES.includes(t.status) && t.status !== "blocked" && t.source !== "information");
  const dueSoon = open
    .filter((t) => t.dueDate && t.dueDate <= addDays(today, 3))
    .sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1) || (PRIORITY_RANK[b.priority] ?? 0) - (PRIORITY_RANK[a.priority] ?? 0));
  for (const t of dueSoon.slice(0, 2)) {
    const d = daysBetween(today, t.dueDate!);
    recs.push({
      id: `task:${t.id}`,
      title: t.title,
      why: d < 0 ? `Overdue by ${-d} day(s).` : d === 0 ? "Due today." : `Due ${formatDate(t.dueDate)}.`,
      effort: t.estimatedMinutes ? `~${t.estimatedMinutes} min` : undefined,
      requiredInfo: [],
      href: `/tasks/${t.id}`,
      actionLabel: "Open task",
      score: 35 + urgency(d) + (PRIORITY_RANK[t.priority] ?? 1) * 3,
      category: "task",
    });
  }

  // 3. Releases: missing info and the next checklist step
  for (const r of upcomingReleases(ctx)) {
    const days = r.releaseDate ? daysBetween(today, r.releaseDate) : 60;
    const info = summarize(evaluateRelease(ctx, r));
    if (info.missingRequired) {
      recs.push({
        id: `release-info:${r.id}`,
        title: `Provide missing information for “${r.title}”`,
        why: `${info.missingRequired} required item(s) block the release checklist${r.releaseDate ? ` (release ${formatDate(r.releaseDate)})` : ""}.`,
        effort: `~${Math.max(5, info.missingRequired * 3)} min`,
        requiredInfo: info.blocking.map((b) => (b.entityType === "track" ? `${b.label} (${b.entityLabel})` : b.label)).slice(0, 6),
        href: `/releases/${r.id}/questions`,
        actionLabel: "Answer questions",
        score: 40 + urgency(days),
        category: "release",
      });
    }
    const next = effectiveChecklist(ctx, r)
      .filter((i) => i.effectiveStatus === "pending" && i.required && !i.auto)
      .sort((a, b) => ((a.dueDate ?? "9999") < (b.dueDate ?? "9999") ? -1 : 1))[0];
    if (next) {
      const d = next.dueDate ? daysBetween(today, next.dueDate) : days;
      recs.push({
        id: `release-step:${r.id}:${next.key}`,
        title: `${r.title}: ${next.label}`,
        why: next.dueDate ? (d < 0 ? `Was due ${formatDate(next.dueDate)}.` : `Due ${formatDate(next.dueDate)} to keep the release on schedule.`) : "Next open step of the release checklist.",
        requiredInfo: [],
        href: `/releases/${r.id}`,
        actionLabel: "Open checklist",
        score: 30 + urgency(d),
        category: "release",
      });
    }
    if (r.releaseDate && days <= 7 && days >= -1 && r.execution.length === 0) {
      recs.push({
        id: `execution:${r.id}`,
        title: `Prepare the release-day checklist for “${r.title}”`,
        why: `Release is ${days <= 0 ? "today" : `in ${days} day(s)`}.`,
        requiredInfo: [],
        href: `/releases/${r.id}?tab=execution`,
        actionLabel: "Start checklist",
        score: 60,
        category: "release",
      });
    }
  }

  // 4. Rights problems on tracks heading to release
  for (const t of tracksForRelease(ctx)) {
    const bad = evaluateTrack(ctx, t).filter((i) => i.group === "rights" && i.required && (i.status === "invalid" || i.status === "missing"));
    if (bad.length) {
      recs.push({
        id: `rights:${t.id}`,
        title: `Document rights for “${t.title}”`,
        why: bad.some((b) => b.status === "invalid") ? bad.find((b) => b.status === "invalid")!.message ?? "Rights information conflicts." : "Ownership must be documented before release.",
        requiredInfo: bad.map((b) => b.label),
        href: `/catalog/${t.id}?tab=rights`,
        actionLabel: "Open rights",
        score: 38 + (bad.some((b) => b.status === "invalid") ? 10 : 0),
        category: "rights",
      });
    }
  }

  // 5. Finished tracks without a release
  const finishedUnreleased = ctx.tracks.filter((t) => t.status === "Finished" && !t.releaseIds.length && !t.actualReleaseDate);
  if (finishedUnreleased.length) {
    recs.push({
      id: "create-release",
      title: `Plan a release for “${finishedUnreleased[0].title}”`,
      why: "The track is finished but has no release project yet.",
      requiredInfo: ["Release date", "Distributor", "Cover artwork"],
      href: `/releases/new?track=${finishedUnreleased[0].id}`,
      actionLabel: "Create release",
      score: 32,
      category: "release",
    });
  }
  if (!ctx.tracks.length) {
    recs.push({
      id: "first-track",
      title: "Add your first track to the catalog",
      why: "Releases, rights, campaigns and content all connect to tracks.",
      effort: "~5 min",
      requiredInfo: ["Track title", "Status"],
      href: "/catalog/new",
      actionLabel: "Add track",
      score: 50,
      category: "setup",
    });
  }

  // 6. Reviews due
  for (const r of ctx.releases) {
    for (const v of r.reviews.filter((v) => v.status === "pending" && v.dueDate <= today)) {
      recs.push({
        id: `review:${v.id}`,
        title: `Complete the ${v.period} review for “${r.title}”`,
        why: "Record the numbers while they’re fresh and decide follow-up promotion.",
        requiredInfo: ["Recorded metrics for the period"],
        href: `/releases/${r.id}?tab=performance`,
        actionLabel: "Start review",
        score: 34 + urgency(daysBetween(today, v.dueDate)),
        category: "review",
      });
    }
  }

  // 7. Campaigns & content
  for (const c of ctx.campaigns.filter((c) => ["Planning", "Ready", "Active"].includes(c.status))) {
    const items = ctx.content.filter((x) => x.campaignId === c.id);
    const start = c.startDate ? daysBetween(today, c.startDate) : 30;
    if (!items.length) {
      recs.push({
        id: `content:${c.id}`,
        title: `Plan content for “${c.name}”`,
        why: start <= 14 ? `The campaign starts ${start <= 0 ? "now" : `in ${start} day(s)`} and has no content.` : "The campaign has no content yet.",
        requiredInfo: ["Platforms", "Formats", "Dates"],
        href: `/content/new?campaign=${c.id}`,
        actionLabel: "Add content",
        score: 22 + urgency(start),
        category: "content",
      });
    }
    const awaiting = items.filter((x) => x.approvalStatus === "pending");
    if (awaiting.length) {
      recs.push({
        id: `approve:${c.id}`,
        title: `Review ${awaiting.length} content item(s) awaiting approval`,
        why: "Content is never published without your approval.",
        requiredInfo: [],
        href: `/content?campaign=${c.id}&approval=pending`,
        actionLabel: "Review content",
        score: 28,
        category: "content",
      });
    }
  }

  // 8. Follow-ups
  const followUps = ctx.contacts.filter((c) => c.nextFollowUpDate && c.nextFollowUpDate <= today && !["closed", "archived"].includes(c.pipelineStatus));
  if (followUps.length) {
    recs.push({
      id: "followups",
      title: `Follow up with ${followUps.length === 1 ? followUps[0].name : `${followUps.length} contacts`}`,
      why: "Follow-up dates have been reached.",
      requiredInfo: [],
      href: "/contacts?view=followups",
      actionLabel: "Open contacts",
      score: 24,
      category: "network",
    });
  }

  // 9. Finances
  const overduePayments = ctx.transactions.filter((t) => !t.isDemo && t.paymentStatus === "overdue");
  if (overduePayments.length) {
    recs.push({
      id: "overdue-payments",
      title: `Resolve ${overduePayments.length} overdue payment(s)`,
      why: "Outstanding invoices affect your available budget.",
      requiredInfo: [],
      href: "/finances?status=overdue",
      actionLabel: "Open finances",
      score: 30,
      category: "finance",
    });
  }
  const outdated = evaluateProfile(ctx, ["business", "goals"]).filter((i) => i.status === "outdated");
  if (outdated.length) {
    recs.push({
      id: "outdated",
      title: "Re-confirm outdated business information",
      why: outdated.map((o) => `${o.label}: ${o.message}`).join(" "),
      effort: "~3 min",
      requiredInfo: outdated.map((o) => o.label),
      href: "/information?status=outdated",
      actionLabel: "Review",
      score: 18,
      category: "setup",
    });
  }

  // 10. Phase guidance as fallback
  const phase = recommendedPhase(ctx);
  const ev = phase.evaluate(ctx);
  const duplicatesSetup = ev.nextAction?.href.startsWith("/onboarding") && recs.some((r) => r.category === "setup");
  if (ev.nextAction && !duplicatesSetup) {
    recs.push({
      id: `phase:${phase.key}`,
      title: `${phase.title}: ${ev.nextAction.label}`,
      why: ev.nextAction.why,
      requiredInfo: [],
      href: ev.nextAction.href,
      actionLabel: "Continue phase",
      score: 20,
      category: "strategy",
    });
  }

  const seen = new Set<string>();
  return recs
    .sort((a, b) => b.score - a.score)
    .filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)))
    .slice(0, limit);
}

/** Tasks that are blocked by missing information (for the dashboard). */
export function blockedByInformation(ctx: BusinessContext) {
  const out: { label: string; href: string; missing: string[] }[] = [];
  for (const r of upcomingReleases(ctx)) {
    const s = summarize(evaluateRelease(ctx, r));
    if (s.missingRequired) out.push({ label: r.title, href: `/releases/${r.id}/questions`, missing: s.blocking.map((b) => b.label) });
  }
  return out;
}

export { isResolved };
