import "server-only";
import { cache } from "react";
import { count, eq, inArray } from "drizzle-orm";
import { db } from "./db";
import * as s from "./db/schema";
import type { BusinessContext } from "./types";
import { todayISO } from "./utils";

/** Ensure the per-user singleton rows exist (settings & profile). */
export async function ensureUserRows(userId: string) {
  await db.insert(s.userSettings).values({ userId }).onConflictDoNothing();
  await db.insert(s.artistProfiles).values({ userId }).onConflictDoNothing();
}

export async function getSettings(userId: string) {
  let [row] = await db.select().from(s.userSettings).where(eq(s.userSettings.userId, userId)).limit(1);
  if (!row) {
    await ensureUserRows(userId);
    [row] = await db.select().from(s.userSettings).where(eq(s.userSettings.userId, userId)).limit(1);
  }
  return row;
}

export async function getProfile(userId: string) {
  let [row] = await db.select().from(s.artistProfiles).where(eq(s.artistProfiles.userId, userId)).limit(1);
  if (!row) {
    await ensureUserRows(userId);
    [row] = await db.select().from(s.artistProfiles).where(eq(s.artistProfiles.userId, userId)).limit(1);
  }
  return row;
}

/**
 * Load the complete business context for a user. The data set of a single
 * artist is small, so loading it once per request keeps every engine simple,
 * consistent and pure. Use `loadContext` (memoised per request) for reads and
 * `loadContextUncached` after mutations within the same request.
 */
export async function loadContextUncached(userId: string): Promise<BusinessContext> {
  const settings = await getSettings(userId);
  const profile = await getProfile(userId);
  const byUser = <T extends { userId: unknown }>(t: T) => eq((t as unknown as typeof s.tracks).userId, userId);

  const [
    platformLinks,
    goals,
    tracks,
    versions,
    collaborators,
    splits,
    rights,
    feedback,
    releases,
    releaseTracks,
    checklist,
    reviews,
    campaigns,
    ads,
    content,
    tasks,
    projects,
    contacts,
    transactions,
    budgets,
    documents,
    phaseStates,
    infoMeta,
    analytics,
  ] = await Promise.all([
    db.select().from(s.platformLinks).where(byUser(s.platformLinks)),
    db.select().from(s.goals).where(byUser(s.goals)),
    db.select().from(s.tracks).where(byUser(s.tracks)).orderBy(s.tracks.createdAt),
    db.select().from(s.trackVersions).where(byUser(s.trackVersions)).orderBy(s.trackVersions.createdAt),
    db.select().from(s.trackCollaborators).where(byUser(s.trackCollaborators)),
    db.select().from(s.ownershipSplits).where(byUser(s.ownershipSplits)),
    db.select().from(s.rightsRecords).where(byUser(s.rightsRecords)),
    db.select().from(s.feedbackNotes).where(byUser(s.feedbackNotes)).orderBy(s.feedbackNotes.createdAt),
    db.select().from(s.releases).where(byUser(s.releases)).orderBy(s.releases.releaseDate),
    db
      .select({ releaseId: s.releaseTracks.releaseId, trackId: s.releaseTracks.trackId, position: s.releaseTracks.position })
      .from(s.releaseTracks)
      .innerJoin(s.releases, eq(s.releases.id, s.releaseTracks.releaseId))
      .where(eq(s.releases.userId, userId))
      .orderBy(s.releaseTracks.position),
    db.select().from(s.checklistItems).where(byUser(s.checklistItems)).orderBy(s.checklistItems.sortOrder),
    db.select().from(s.releaseReviews).where(byUser(s.releaseReviews)).orderBy(s.releaseReviews.dueDate),
    db.select().from(s.campaigns).where(byUser(s.campaigns)).orderBy(s.campaigns.startDate),
    db.select().from(s.adCampaigns).where(byUser(s.adCampaigns)),
    db.select().from(s.contentItems).where(byUser(s.contentItems)).orderBy(s.contentItems.plannedDate),
    db.select().from(s.tasks).where(byUser(s.tasks)).orderBy(s.tasks.dueDate),
    db.select().from(s.projects).where(byUser(s.projects)),
    db.select().from(s.contacts).where(byUser(s.contacts)).orderBy(s.contacts.name),
    db.select().from(s.transactions).where(byUser(s.transactions)).orderBy(s.transactions.date),
    db.select().from(s.budgets).where(byUser(s.budgets)),
    db
      .select({
        id: s.documents.id,
        title: s.documents.title,
        category: s.documents.category,
        trackId: s.documents.trackId,
        releaseId: s.documents.releaseId,
        campaignId: s.documents.campaignId,
        sensitive: s.documents.sensitive,
        isLatest: s.documents.isLatest,
        createdAt: s.documents.createdAt,
      })
      .from(s.documents)
      .where(byUser(s.documents)),
    db.select().from(s.phaseStates).where(byUser(s.phaseStates)),
    db.select().from(s.infoFieldMeta).where(byUser(s.infoFieldMeta)),
    db.select({ n: count() }).from(s.analyticsRecords).where(byUser(s.analyticsRecords)),
  ]);

  return {
    today: todayISO(settings.timezone),
    userId,
    settings,
    profile,
    platformLinks,
    goals,
    tracks: tracks.map((t) => ({
      ...t,
      versions: versions.filter((v) => v.trackId === t.id),
      collaborators: collaborators.filter((c) => c.trackId === t.id),
      splits: splits.filter((sp) => sp.trackId === t.id),
      rights: rights.find((r) => r.trackId === t.id) ?? null,
      feedback: feedback.filter((f) => f.trackId === t.id),
      releaseIds: releaseTracks.filter((rt) => rt.trackId === t.id).map((rt) => rt.releaseId),
    })),
    releases: releases.map((r) => ({
      ...r,
      trackIds: releaseTracks.filter((rt) => rt.releaseId === r.id).map((rt) => rt.trackId),
      checklist: checklist.filter((c) => c.parentType === "release" && c.parentId === r.id),
      execution: checklist.filter((c) => c.parentType === "execution" && c.parentId === r.id),
      reviews: reviews.filter((rv) => rv.releaseId === r.id),
    })),
    campaigns: campaigns.map((c) => ({ ...c, ads: ads.filter((a) => a.campaignId === c.id) })),
    content,
    tasks,
    projects,
    contacts,
    transactions,
    budgets,
    documents,
    phaseStates,
    infoMeta,
    analyticsCount: analytics[0]?.n ?? 0,
  };
}

export const loadContext = cache(loadContextUncached);

/** Verify that every id belongs to the user (defence against forged form values). */
export async function assertOwned(
  table: typeof s.tracks | typeof s.releases | typeof s.campaigns | typeof s.contacts | typeof s.projects | typeof s.documents,
  userId: string,
  ids: (string | null | undefined)[],
) {
  const list = ids.filter((x): x is string => Boolean(x));
  if (!list.length) return;
  const rows = await db.select({ id: table.id, userId: table.userId }).from(table).where(inArray(table.id, list));
  if (rows.length !== new Set(list).size || rows.some((r) => r.userId !== userId)) {
    throw new Error("Referenced record not found.");
  }
}
