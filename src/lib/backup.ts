import "server-only";
import { eq, inArray } from "drizzle-orm";
import { db } from "./db";
import * as s from "./db/schema";

/**
 * Tables included in a backup, in dependency order (parents first).
 * Join tables without user_id are handled separately.
 */
export const BACKUP_TABLES = [
  ["userSettings", s.userSettings],
  ["artistProfiles", s.artistProfiles],
  ["platformLinks", s.platformLinks],
  ["goals", s.goals],
  ["contacts", s.contacts],
  ["projects", s.projects],
  ["milestones", s.milestones],
  ["documents", s.documents],
  ["tracks", s.tracks],
  ["trackVersions", s.trackVersions],
  ["trackCollaborators", s.trackCollaborators],
  ["feedbackNotes", s.feedbackNotes],
  ["rightsRecords", s.rightsRecords],
  ["ownershipSplits", s.ownershipSplits],
  ["releases", s.releases],
  ["checklistItems", s.checklistItems],
  ["releaseReviews", s.releaseReviews],
  ["campaigns", s.campaigns],
  ["adCampaigns", s.adCampaigns],
  ["contentItems", s.contentItems],
  ["tasks", s.tasks],
  ["phaseStates", s.phaseStates],
  ["infoFieldMeta", s.infoFieldMeta],
  ["transactions", s.transactions],
  ["budgets", s.budgets],
  ["analyticsRecords", s.analyticsRecords],
  ["playlistPlacements", s.playlistPlacements],
  ["outreachRecords", s.outreachRecords],
  ["integrations", s.integrations],
  ["automationRules", s.automationRules],
  ["notifications", s.notifications],
] as const;

export const BACKUP_VERSION = 1;

export async function exportBackup(userId: string) {
  const data: Record<string, unknown[]> = {};
  for (const [name, table] of BACKUP_TABLES) {
    data[name] = await db.select().from(table).where(eq((table as typeof s.tracks).userId, userId));
  }
  const releaseIds = (data.releases as { id: string }[]).map((r) => r.id);
  data.releaseTracks = releaseIds.length ? await db.select().from(s.releaseTracks).where(inArray(s.releaseTracks.releaseId, releaseIds)) : [];
  const taskIds = (data.tasks as { id: string }[]).map((t) => t.id);
  data.taskDependencies = taskIds.length ? await db.select().from(s.taskDependencies).where(inArray(s.taskDependencies.taskId, taskIds)) : [];
  return { app: "mayfar-artist-manager", version: BACKUP_VERSION, exportedAt: new Date().toISOString(), note: "Uploaded files are not included; back up STORAGE_DIR separately.", data };
}

const TIMESTAMP_KEYS = /(At|^expiresAt)$/;

function revive(row: Record<string, unknown>, userId: string) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) out[k] = typeof v === "string" && TIMESTAMP_KEYS.test(k) ? new Date(v) : v;
  if ("userId" in out) out.userId = userId;
  return out;
}

/**
 * Restore a backup into the current account, replacing its business data.
 * Runs in one transaction: either everything is restored or nothing changes.
 */
export async function restoreBackup(userId: string, backup: { app?: string; version?: number; data?: Record<string, Record<string, unknown>[]> }) {
  if (backup.app !== "mayfar-artist-manager" || backup.version !== BACKUP_VERSION || !backup.data) throw new Error("This file is not a MAYFAR backup.");
  const data = backup.data;
  await db.transaction(async (tx) => {
    for (const [, table] of [...BACKUP_TABLES].reverse()) {
      await tx.delete(table).where(eq((table as typeof s.tracks).userId, userId));
    }
    // documents ↔ tracks/releases/campaigns/contacts reference each other:
    // insert documents without those links first, then restore the links.
    const DOC_LINKS = ["trackId", "releaseId", "campaignId", "contactId"] as const;
    for (const [name, table] of BACKUP_TABLES) {
      let rows = (data[name] ?? []).map((r) => revive(r, userId));
      if (name === "documents") rows = rows.map((r) => ({ ...r, ...Object.fromEntries(DOC_LINKS.map((k) => [k, null])) }));
      for (let i = 0; i < rows.length; i += 500) await tx.insert(table).values(rows.slice(i, i + 500) as never);
    }
    for (const d of data.documents ?? []) {
      const links = Object.fromEntries(DOC_LINKS.map((k) => [k, d[k] ?? null]));
      if (Object.values(links).some(Boolean)) await tx.update(s.documents).set(links).where(eq(s.documents.id, d.id as string));
    }
    const rt = data.releaseTracks ?? [];
    if (rt.length) await tx.insert(s.releaseTracks).values(rt as never);
    const td = data.taskDependencies ?? [];
    if (td.length) await tx.insert(s.taskDependencies).values(td as never);
  });
  return Object.fromEntries(BACKUP_TABLES.map(([name]) => [name, (data[name] ?? []).length]));
}
