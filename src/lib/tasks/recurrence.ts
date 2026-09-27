import "server-only";
import { db } from "../db";
import { tasks } from "../db/schema";
import { addDays } from "../utils";

export function nextDue(due: string, recurrence: string) {
  if (recurrence === "weekly") return addDays(due, 7);
  const d = new Date(`${due}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + (recurrence === "quarterly" ? 3 : 1));
  return d.toISOString().slice(0, 10);
}

/** Create the next occurrence of a recurring task (idempotent via sourceKey). */
export async function scheduleNextOccurrence(userId: string, t: typeof tasks.$inferSelect) {
  if (!t.recurrence || !t.dueDate) return;
  const due = nextDue(t.dueDate, t.recurrence);
  const rootKey = t.sourceKey?.startsWith("recur:") ? t.sourceKey.split(":")[1] : t.id;
  await db
    .insert(tasks)
    .values({
      userId,
      title: t.title,
      description: t.description,
      priority: t.priority,
      status: "planned",
      dueDate: due,
      projectId: t.projectId,
      trackId: t.trackId,
      releaseId: t.releaseId,
      campaignId: t.campaignId,
      phaseKey: t.phaseKey,
      assignee: t.assignee,
      estimatedMinutes: t.estimatedMinutes,
      completionCriteria: t.completionCriteria,
      recurrence: t.recurrence,
      source: "automation",
      sourceKey: `recur:${rootKey}:${due}`,
    })
    .onConflictDoNothing({ target: [tasks.userId, tasks.sourceKey] });
}

