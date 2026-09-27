import "server-only";
import { and, eq, inArray, isNotNull, like } from "drizzle-orm";
import { db } from "../db";
import { tasks } from "../db/schema";
import { loadContextUncached } from "../context";
import { evaluateCampaign, evaluateRelease, summarize } from "../info/engine";
import { OPEN_TASK_STATUSES } from "../constants";
import type { TaskTemplate } from "../workflow/phases";
import { addDays } from "../utils";

type NewTask = typeof tasks.$inferInsert;

/** Insert generated tasks, skipping any whose sourceKey already exists. Returns number created. */
export async function insertGeneratedTasks(userId: string, list: Omit<NewTask, "userId">[]) {
  if (!list.length) return 0;
  const rows = await db
    .insert(tasks)
    .values(list.map((t) => ({ ...t, userId })))
    .onConflictDoNothing({ target: [tasks.userId, tasks.sourceKey] })
    .returning({ id: tasks.id });
  return rows.length;
}

export function templateTasks(
  templates: TaskTemplate[],
  prefix: string,
  base: Partial<NewTask>,
): Omit<NewTask, "userId">[] {
  return templates.map((t) => ({
    title: t.title,
    description: t.description ?? null,
    priority: t.priority ?? "medium",
    completionCriteria: t.completionCriteria ?? null,
    status: "planned",
    source: "template",
    sourceKey: `${prefix}:${t.key}`,
    ...base,
  }));
}

/**
 * Keep "collect missing information" tasks in sync with the information engine:
 * one task per upcoming release / active campaign with missing required items.
 * When the engine verifies the information is complete the task is completed
 * (completion is verified by stored data, never assumed).
 */
export async function syncInformationTasks(userId: string, windowDays = 60) {
  const ctx = await loadContextUncached(userId);
  const wanted = new Map<string, Omit<NewTask, "userId">>();

  for (const r of ctx.releases) {
    if (["Released", "Post-release review", "Archived"].includes(r.status)) continue;
    if (r.releaseDate && r.releaseDate > addDays(ctx.today, windowDays)) continue;
    const s = summarize(evaluateRelease(ctx, r));
    if (!s.missingRequired) continue;
    wanted.set(`info:release:${r.id}`, {
      title: `Provide missing information for “${r.title}”`,
      description: `Required: ${s.blocking.map((b) => (b.entityType === "track" ? `${b.label} (${b.entityLabel})` : b.label)).join(", ")}.`,
      releaseId: r.id,
      phaseKey: "release",
      priority: r.releaseDate && r.releaseDate <= addDays(ctx.today, 21) ? "high" : "medium",
      status: "waiting_info",
      dueDate: r.releaseDate ? addDays(r.releaseDate, -28) : null,
      source: "information",
      sourceKey: `info:release:${r.id}`,
      completionCriteria: "The information engine reports no missing required items for this release.",
    });
  }
  for (const c of ctx.campaigns) {
    if (!["Planning", "Ready", "Active"].includes(c.status)) continue;
    const s = summarize(evaluateCampaign(ctx, c));
    if (!s.missingRequired) continue;
    wanted.set(`info:campaign:${c.id}`, {
      title: `Complete the strategy for campaign “${c.name}”`,
      description: `Required: ${s.blocking.map((b) => b.label).join(", ")}.`,
      campaignId: c.id,
      releaseId: c.releaseId,
      phaseKey: "marketing",
      priority: "medium",
      status: "waiting_info",
      dueDate: c.startDate ? addDays(c.startDate, -7) : null,
      source: "information",
      sourceKey: `info:campaign:${c.id}`,
      completionCriteria: "All required campaign information is complete.",
    });
  }

  const existing = await db
    .select({ id: tasks.id, sourceKey: tasks.sourceKey, status: tasks.status })
    .from(tasks)
    .where(and(eq(tasks.userId, userId), isNotNull(tasks.sourceKey), like(tasks.sourceKey, "info:%")));

  // Create missing ones / refresh descriptions of open ones
  const existingKeys = new Set(existing.map((e) => e.sourceKey));
  await insertGeneratedTasks(
    userId,
    Array.from(wanted.values()).filter((t) => !existingKeys.has(t.sourceKey!)),
  );
  for (const e of existing) {
    const w = wanted.get(e.sourceKey!);
    if (w && OPEN_TASK_STATUSES.includes(e.status)) {
      await db.update(tasks).set({ description: w.description, priority: w.priority }).where(eq(tasks.id, e.id));
    } else if (w && e.status === "completed") {
      // information went missing again → reopen
      await db.update(tasks).set({ status: "waiting_info", completedAt: null, description: w.description }).where(eq(tasks.id, e.id));
    }
  }
  // Verified complete → complete the task
  const resolved = existing.filter((e) => !wanted.has(e.sourceKey!) && OPEN_TASK_STATUSES.includes(e.status)).map((e) => e.id);
  if (resolved.length) {
    await db
      .update(tasks)
      .set({ status: "completed", completedAt: new Date(), notes: "Completed automatically: the required information is now saved and verified." })
      .where(and(eq(tasks.userId, userId), inArray(tasks.id, resolved)));
  }
}
