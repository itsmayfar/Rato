import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { checklistItems, releaseReviews, releases } from "../db/schema";
import { REVIEW_PERIODS } from "../constants";
import { addDays } from "../utils";
import { EXECUTION_CHECKLIST, dueDateFor, templatesFor, type ReleasePrefs } from "./checklist";

/**
 * Create checklist items that apply to the release (idempotent) and remove
 * pending items that no longer apply after preference / type changes.
 * Due dates follow the release date.
 */
export async function syncReleaseChecklist(userId: string, releaseId: string) {
  const [release] = await db.select().from(releases).where(and(eq(releases.id, releaseId), eq(releases.userId, userId)));
  if (!release) throw new Error("Release not found");
  const prefs = (release.preferences ?? {}) as ReleasePrefs;
  const templates = templatesFor(release, prefs);
  const existing = await db
    .select()
    .from(checklistItems)
    .where(and(eq(checklistItems.parentType, "release"), eq(checklistItems.parentId, releaseId), eq(checklistItems.userId, userId)));
  const keys = new Set(templates.map((t) => t.key));

  for (const [i, t] of templates.entries()) {
    const due = dueDateFor(release.releaseDate, t.offsetDays);
    const current = existing.find((e) => e.key === t.key);
    if (!current) {
      await db.insert(checklistItems).values({
        userId,
        parentType: "release",
        parentId: releaseId,
        key: t.key,
        label: t.label,
        description: t.description,
        required: t.required,
        external: t.external,
        auto: t.auto,
        dueDate: due,
        sortOrder: i,
      });
    } else if (current.dueDate !== due || current.sortOrder !== i) {
      await db.update(checklistItems).set({ dueDate: due, sortOrder: i }).where(eq(checklistItems.id, current.id));
    }
  }
  // Remove items that no longer apply (only if the user hasn't acted on them)
  for (const e of existing) {
    if (!keys.has(e.key) && e.status === "pending") await db.delete(checklistItems).where(eq(checklistItems.id, e.id));
  }
}

/** Create the release-day checklist (Phase 7). */
export async function ensureExecutionChecklist(userId: string, releaseId: string) {
  const [release] = await db.select().from(releases).where(and(eq(releases.id, releaseId), eq(releases.userId, userId)));
  if (!release) throw new Error("Release not found");
  const values = EXECUTION_CHECKLIST.map((t, i) => ({
    userId,
    parentType: "execution",
    parentId: releaseId,
    key: t.key,
    label: t.label,
    description: t.description,
    required: t.required,
    external: t.external,
    auto: false,
    dueDate: release.releaseDate,
    sortOrder: i,
  }));
  await db.insert(checklistItems).values(values).onConflictDoNothing();
}

/** Schedule the post-release review periods (24 h, 7, 30, 90 days). */
export async function scheduleReviews(userId: string, releaseId: string, releaseDate: string) {
  const existing = await db.select().from(releaseReviews).where(eq(releaseReviews.releaseId, releaseId));
  const have = new Set(existing.map((e) => e.period));
  const missing = REVIEW_PERIODS.filter((p) => !have.has(p.key));
  if (missing.length) {
    await db.insert(releaseReviews).values(missing.map((p) => ({ userId, releaseId, period: p.key, dueDate: addDays(releaseDate, p.days) })));
  }
}
