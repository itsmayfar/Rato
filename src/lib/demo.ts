import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "./db";
import * as s from "./db/schema";
import { addDays, todayISO } from "./utils";
import { syncReleaseChecklist } from "./releases/store";

const D = "[Demo] ";

/**
 * Clearly labelled sample data for exploring the app. Every record is marked
 * is_demo and titled "[Demo] …"; financial totals and reports exclude it.
 */
export async function seedDemoData(userId: string) {
  const today = todayISO();
  const existing = await db.select({ id: s.tracks.id }).from(s.tracks).where(and(eq(s.tracks.userId, userId), eq(s.tracks.isDemo, true)));
  if (existing.length) return false;

  const [t1] = await db.insert(s.tracks).values({ userId, isDemo: true, projectCode: "DEMO-001", title: `${D}Afterglow`, primaryArtist: "MayFar", genre: "Melodic Techno", bpm: 123, musicalKey: "F minor", mood: "Melancholic, driving", language: "Instrumental", durationSec: 402, explicit: "no", status: "Finished", workflowStage: "Rights Review", hasCollaborators: "yes" }).returning({ id: s.tracks.id });
  const [t2] = await db.insert(s.tracks).values({ userId, isDemo: true, projectCode: "DEMO-002", title: `${D}Glass Heart`, primaryArtist: "MayFar", genre: "Progressive House", bpm: 122, status: "Mixing", workflowStage: "Mixing", explicit: "unknown", hasCollaborators: "unknown" }).returning({ id: s.tracks.id });
  await db.insert(s.rightsRecords).values([{ userId, trackId: t1.id, samplesUsed: "none", sampleLicenseStatus: "not_needed", agreementStatus: "sent" }, { userId, trackId: t2.id }]);
  await db.insert(s.trackVersions).values({ userId, trackId: t1.id, kind: "master", label: "Master v2 (demo)", externalUrl: "https://example.com/demo-master", approved: true, approvedAt: new Date() });
  await db.insert(s.trackCollaborators).values({ userId, trackId: t1.id, name: "Demo Vocalist", role: "Vocalist", credited: true });
  await db.insert(s.ownershipSplits).values([
    { userId, trackId: t1.id, rightType: "composition", holderName: "MayFar (demo)", percentage: 70, confirmed: true },
    { userId, trackId: t1.id, rightType: "composition", holderName: "Demo Vocalist", percentage: 30, confirmed: false },
    { userId, trackId: t1.id, rightType: "master", holderName: "MayFar (demo)", percentage: 100, confirmed: true },
  ]);
  const [project] = await db.insert(s.projects).values({ userId, isDemo: true, name: `${D}Release: Afterglow`, kind: "release", phaseKey: "release", status: "active" }).returning({ id: s.projects.id });
  const [rel] = await db.insert(s.releases).values({ userId, isDemo: true, title: `${D}Afterglow`, releaseType: "single", primaryArtist: "MayFar", releaseDate: addDays(today, 24), distributor: "DistroKid", genre: "Melodic Techno", language: "Instrumental", explicit: "no", status: "In preparation", preferences: { campaign: true, pitching: true }, projectId: project.id }).returning({ id: s.releases.id });
  await db.insert(s.releaseTracks).values({ releaseId: rel.id, trackId: t1.id, position: 1 });
  await syncReleaseChecklist(userId, rel.id);
  const [camp] = await db.insert(s.campaigns).values({ userId, isDemo: true, name: `${D}Afterglow launch`, releaseId: rel.id, trackId: t1.id, template: "pre_release", objective: "Promote a release", targetAudience: "Melodic techno listeners 20–35, Berlin / Amsterdam / Lisbon", budget: 250, startDate: addDays(today, -3), endDate: addDays(today, 40), channels: ["Instagram", "TikTok", "Playlist pitching"], message: "Sound becomes feeling — Afterglow, out soon.", successMetrics: "1,000 pre-saves; 50 playlist adds", status: "Active" }).returning({ id: s.campaigns.id });
  await db.insert(s.contentItems).values([
    { userId, isDemo: true, title: `${D}Teaser clip — Afterglow`, campaignId: camp.id, trackId: t1.id, platform: "Instagram", format: "Instagram Reel", caption: "Something is glowing. 🔴", stage: "Review", approvalStatus: "pending", plannedDate: addDays(today, 3) },
    { userId, isDemo: true, title: `${D}Studio session`, campaignId: camp.id, trackId: t1.id, platform: "TikTok", format: "Behind the scenes", stage: "Idea", plannedDate: addDays(today, 8) },
  ]);
  await db.insert(s.tasks).values([
    { userId, isDemo: true, title: `${D}Send split sheet to vocalist`, trackId: t1.id, phaseKey: "rights", priority: "high", status: "planned", dueDate: addDays(today, -1) },
    { userId, isDemo: true, title: `${D}Finish mix of Glass Heart`, trackId: t2.id, phaseKey: "production", priority: "medium", status: "in_progress", dueDate: addDays(today, 5) },
  ]);
  await db.insert(s.contacts).values([
    { userId, isDemo: true, name: `${D}Label A&R`, organization: "Example Records", category: "Label", pipelineStatus: "ready", nextFollowUpDate: addDays(today, 2) },
    { userId, isDemo: true, name: `${D}Playlist curator`, category: "Playlist curator", pipelineStatus: "contacted", lastContactDate: addDays(today, -6), nextFollowUpDate: today },
  ]);
  await db.insert(s.transactions).values([
    { userId, isDemo: true, kind: "expense", category: "Mixing and mastering", description: `${D}Mastering Afterglow`, amount: 90, currency: "EUR", date: addDays(today, -10), trackId: t1.id },
    { userId, isDemo: true, kind: "income", category: "Streaming royalties", description: `${D}Distributor statement`, amount: 42.5, currency: "EUR", date: addDays(today, -5) },
  ]);
  await db.insert(s.analyticsRecords).values([
    { userId, isDemo: true, metric: "monthly_listeners", value: 1850, platform: "Spotify", periodEnd: addDays(today, -30), source: "manual", verification: "manual", notes: "Demo value" },
    { userId, isDemo: true, metric: "monthly_listeners", value: 2140, platform: "Spotify", periodEnd: addDays(today, -15), source: "manual", verification: "manual", notes: "Demo value" },
    { userId, isDemo: true, metric: "monthly_listeners", value: 2390, platform: "Spotify", periodEnd: today, source: "manual", verification: "manual", notes: "Demo value" },
  ]);
  await db.insert(s.goals).values({ userId, isDemo: true, title: `${D}5,000 monthly listeners`, category: "audience", horizon: "quarterly", metric: "Spotify monthly listeners", targetValue: 5000, currentValue: 2390, unit: "listeners", deadline: addDays(today, 90) });
  return true;
}

/** Remove every demo record (and the children that cascade from them). */
export async function removeDemoData(userId: string) {
  const demoReleases = await db.select({ id: s.releases.id }).from(s.releases).where(and(eq(s.releases.userId, userId), eq(s.releases.isDemo, true)));
  if (demoReleases.length) await db.delete(s.checklistItems).where(and(eq(s.checklistItems.userId, userId), inArray(s.checklistItems.parentId, demoReleases.map((r) => r.id))));
  const tables = [s.contentItems, s.tasks, s.transactions, s.budgets, s.analyticsRecords, s.playlistPlacements, s.campaigns, s.releases, s.tracks, s.contacts, s.goals, s.projects, s.documents] as const;
  let n = 0;
  for (const t of tables) {
    const rows = await db.delete(t).where(and(eq((t as typeof s.tracks).userId, userId), eq((t as typeof s.tracks).isDemo, true))).returning({ id: (t as typeof s.tracks).id });
    n += rows.length;
  }
  return n;
}
