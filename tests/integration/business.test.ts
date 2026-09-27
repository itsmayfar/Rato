import { afterAll, describe, expect, it } from "vitest";
import { and, eq, like } from "drizzle-orm";
import { db } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { assertOwned, loadContextUncached } from "@/lib/context";
import { applyInfoChanges } from "@/lib/info/store";
import { evaluateProfile, evaluateRelease, summarize } from "@/lib/info/engine";
import { effectiveChecklist } from "@/lib/releases/checklist";
import { ensureExecutionChecklist, scheduleReviews, syncReleaseChecklist } from "@/lib/releases/store";
import { syncInformationTasks } from "@/lib/tasks/generate";
import { runAutomations } from "@/lib/automations/engine";
import { ensureDefaultAutomations } from "@/lib/automations/defaults";
import { exportBackup, restoreBackup } from "@/lib/backup";
import { removeDemoData, seedDemoData } from "@/lib/demo";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { addDays, todayISO } from "@/lib/utils";
import { createUser, hasDb } from "./helpers";

const created: string[] = [];
async function user() {
  const id = await createUser();
  created.push(id);
  return id;
}

afterAll(async () => {
  for (const id of created) await db.delete(s.users).where(eq(s.users.id, id));
});

describe.skipIf(!hasDb)("information store", () => {
  it("saves profile answers, keeps the previous value and reflects status", async () => {
    const uid = await user();
    let ctx = await loadContextUncached(uid);
    expect(evaluateProfile(ctx, ["identity"]).find((i) => i.key === "artistName")!.status).toBe("missing");
    await applyInfoChanges(uid, [
      { entityType: "profile", entityId: ctx.profile.id, key: "artistName", value: "MayFar" },
      { entityType: "profile", entityId: ctx.profile.id, key: "goals.mainObjective", value: "Build a global audience" },
      { entityType: "profile", entityId: ctx.profile.id, key: "legalName", notApplicable: true },
      { entityType: "platform", entityId: ctx.profile.id, key: "Spotify", value: "https://open.spotify.com/artist/abc" },
    ]);
    ctx = await loadContextUncached(uid);
    expect(ctx.profile.artistName).toBe("MayFar");
    expect(ctx.profile.goals.mainObjective).toBe("Build a global audience");
    expect(ctx.platformLinks[0].url).toContain("spotify");
    const items = evaluateProfile(ctx);
    expect(items.find((i) => i.key === "artistName")!.status).toBe("complete");
    expect(items.find((i) => i.key === "legalName")!.status).toBe("not_applicable");
    expect(items.find((i) => i.key === "Spotify")!.status).toBe("complete");

    await applyInfoChanges(uid, [{ entityType: "profile", entityId: ctx.profile.id, key: "artistName", value: "MAYFAR" }]);
    const [meta] = await db.select().from(s.infoFieldMeta).where(and(eq(s.infoFieldMeta.userId, uid), eq(s.infoFieldMeta.fieldKey, "artistName")));
    expect(meta.previousValue).toBe("MayFar");
  });
});

describe.skipIf(!hasDb)("release lifecycle", () => {
  it("creates a tailored checklist, reschedules with the date, and schedules reviews", async () => {
    const uid = await user();
    const [t] = await db.insert(s.tracks).values({ userId: uid, title: "Nightfall", projectCode: "MF-001" }).returning();
    const date = addDays(todayISO(), 40);
    const [r] = await db.insert(s.releases).values({ userId: uid, title: "Nightfall", releaseType: "single", releaseDate: date, preferences: { campaign: false } }).returning();
    await db.insert(s.releaseTracks).values({ releaseId: r.id, trackId: t.id });
    await syncReleaseChecklist(uid, r.id);
    let items = await db.select().from(s.checklistItems).where(eq(s.checklistItems.parentId, r.id));
    const keys = items.map((i) => i.key);
    expect(keys).toContain("submission");
    expect(keys).not.toContain("campaign");
    expect(keys).not.toContain("tracklist");
    expect(items.find((i) => i.key === "submission")!.dueDate).toBe(addDays(date, -28));

    // enabling campaign adds steps; moving the date moves deadlines
    const newDate = addDays(date, 7);
    await db.update(s.releases).set({ preferences: { campaign: true }, releaseDate: newDate }).where(eq(s.releases.id, r.id));
    await syncReleaseChecklist(uid, r.id);
    items = await db.select().from(s.checklistItems).where(eq(s.checklistItems.parentId, r.id));
    expect(items.map((i) => i.key)).toContain("campaign");
    expect(items.find((i) => i.key === "submission")!.dueDate).toBe(addDays(newDate, -28));

    // auto items are verified from data, not ticked
    const ctx = await loadContextUncached(uid);
    const rel = ctx.releases.find((x) => x.id === r.id)!;
    expect(effectiveChecklist(ctx, rel).find((i) => i.key === "tracks_linked")!.effectiveStatus).toBe("done");
    expect(effectiveChecklist(ctx, rel).find((i) => i.key === "final_master")!.effectiveStatus).toBe("pending");
    expect(summarize(evaluateRelease(ctx, rel)).missingRequired).toBeGreaterThan(0);

    await ensureExecutionChecklist(uid, r.id);
    await ensureExecutionChecklist(uid, r.id); // idempotent
    const exec = await db.select().from(s.checklistItems).where(and(eq(s.checklistItems.parentId, r.id), eq(s.checklistItems.parentType, "execution")));
    expect(exec.length).toBe(11);
    expect(exec.every((e) => e.status === "pending")).toBe(true);

    await scheduleReviews(uid, r.id, newDate);
    await scheduleReviews(uid, r.id, newDate);
    const reviews = await db.select().from(s.releaseReviews).where(eq(s.releaseReviews.releaseId, r.id));
    expect(reviews.map((v) => v.period).sort()).toEqual(["24h", "30d", "7d", "90d"]);
  });
});

describe.skipIf(!hasDb)("generated information tasks", () => {
  it("creates one task per release with missing info and completes it when the data is verified", async () => {
    const uid = await user();
    const [r] = await db.insert(s.releases).values({ userId: uid, title: "Glass Heart", releaseType: "single", releaseDate: addDays(todayISO(), 20) }).returning();
    await syncInformationTasks(uid);
    await syncInformationTasks(uid); // no duplicates
    let tasks = await db.select().from(s.tasks).where(and(eq(s.tasks.userId, uid), like(s.tasks.sourceKey, "info:release:%")));
    expect(tasks).toHaveLength(1);
    expect(tasks[0].status).toBe("waiting_info");

    // resolve: fill fields, link a finished track with rights documented, approve artwork + master
    const [t] = await db
      .insert(s.tracks)
      .values({ userId: uid, title: "Glass Heart", projectCode: "X-1", primaryArtist: "MayFar", genre: "Techno", bpm: 124, musicalKey: "A minor", language: "Instrumental", durationSec: 300, explicit: "no", hasCollaborators: "no" })
      .returning();
    await db.insert(s.releaseTracks).values({ releaseId: r.id, trackId: t.id });
    await db.insert(s.trackVersions).values({ userId: uid, trackId: t.id, kind: "master", label: "M", approved: true });
    await db.insert(s.rightsRecords).values({ userId: uid, trackId: t.id, samplesUsed: "none", agreementStatus: "not_needed" });
    await db.insert(s.ownershipSplits).values([
      { userId: uid, trackId: t.id, rightType: "composition", holderName: "MayFar", percentage: 100, confirmed: true },
      { userId: uid, trackId: t.id, rightType: "master", holderName: "MayFar", percentage: 100, confirmed: true },
    ]);
    const [doc] = await db.insert(s.documents).values({ userId: uid, title: "Cover" }).returning();
    await db
      .update(s.releases)
      .set({ primaryArtist: "MayFar", genre: "Techno", language: "Instrumental", explicit: "no", distributor: "DistroKid", releaseDateConfirmed: true, coverDocumentId: doc.id, coverApproved: true })
      .where(eq(s.releases.id, r.id));
    await syncInformationTasks(uid);
    tasks = await db.select().from(s.tasks).where(and(eq(s.tasks.userId, uid), like(s.tasks.sourceKey, "info:release:%")));
    expect(tasks[0].status).toBe("completed");
  });
});

describe.skipIf(!hasDb)("automations", () => {
  it("creates deduplicated notifications, logs runs and holds rules that need approval", async () => {
    const uid = await user();
    await ensureDefaultAutomations(uid);
    await db.insert(s.tasks).values({ userId: uid, title: "Overdue thing", status: "planned", dueDate: addDays(todayISO(), -2) });
    const first = await runAutomations(uid, { force: true });
    expect(first.every((r) => r.result === "success")).toBe(true);
    const overdue = await db.select().from(s.notifications).where(and(eq(s.notifications.userId, uid), eq(s.notifications.kind, "overdue")));
    expect(overdue).toHaveLength(1);
    await runAutomations(uid, { force: true });
    expect(await db.select().from(s.notifications).where(and(eq(s.notifications.userId, uid), eq(s.notifications.kind, "overdue")))).toHaveLength(1);
    // not due again the same day
    expect(await runAutomations(uid)).toHaveLength(0);

    const [rule] = await db.select().from(s.automationRules).where(and(eq(s.automationRules.userId, uid), eq(s.automationRules.kind, "weekly_summary")));
    await db.update(s.automationRules).set({ requiresApproval: true }).where(eq(s.automationRules.id, rule.id));
    const held = await runAutomations(uid, { ruleId: rule.id, force: true });
    expect(held[0].result).toBe("awaiting_approval");
    const approved = await runAutomations(uid, { ruleId: rule.id, force: true, approved: true });
    expect(approved[0].result).toBe("success");
    const logs = await db.select().from(s.automationLogs).where(eq(s.automationLogs.userId, uid));
    expect(logs.some((l) => l.result === "awaiting_approval")).toBe(true);
  });
});

describe.skipIf(!hasDb)("data isolation, backup and demo data", () => {
  it("never exposes one user's records to another", async () => {
    const a = await user();
    const b = await user();
    const [t] = await db.insert(s.tracks).values({ userId: a, title: "Private", projectCode: "P-1" }).returning();
    const ctxB = await loadContextUncached(b);
    expect(ctxB.tracks.find((x) => x.id === t.id)).toBeUndefined();
    await expect(assertOwned(s.tracks, b, [t.id])).rejects.toThrow();
    await expect(assertOwned(s.tracks, a, [t.id])).resolves.toBeUndefined();
  });

  it("round-trips a full backup", async () => {
    const uid = await user();
    const [t] = await db.insert(s.tracks).values({ userId: uid, title: "Backup me", projectCode: "B-1" }).returning();
    const [doc] = await db.insert(s.documents).values({ userId: uid, title: "Split sheet", trackId: t.id }).returning();
    await db.insert(s.ownershipSplits).values({ userId: uid, trackId: t.id, rightType: "master", holderName: "MayFar", percentage: 100, agreementDocumentId: doc.id });
    const [r] = await db.insert(s.releases).values({ userId: uid, title: "R", coverDocumentId: doc.id }).returning();
    await db.insert(s.releaseTracks).values({ releaseId: r.id, trackId: t.id });
    await db.insert(s.transactions).values({ userId: uid, kind: "income", category: "Licensing", description: "Sync fee", amount: 500, date: todayISO() });
    const backup = JSON.parse(JSON.stringify(await exportBackup(uid)));
    await db.delete(s.tracks).where(eq(s.tracks.userId, uid));
    await db.delete(s.transactions).where(eq(s.transactions.userId, uid));
    await restoreBackup(uid, backup);
    const ctx = await loadContextUncached(uid);
    expect(ctx.tracks.map((x) => x.title)).toEqual(["Backup me"]);
    expect(ctx.tracks[0].splits[0].agreementDocumentId).toBe(doc.id);
    expect(ctx.releases[0].trackIds).toEqual([t.id]);
    expect(ctx.documents[0].trackId).toBe(t.id);
    expect(ctx.transactions[0].amount).toBe(500);
    await expect(restoreBackup(uid, { app: "other" } as never)).rejects.toThrow();
  });

  it("keeps demo data separate and removable", async () => {
    const uid = await user();
    await db.insert(s.transactions).values({ userId: uid, kind: "expense", category: "Software", description: "Real", amount: 10, date: todayISO() });
    expect(await seedDemoData(uid)).toBe(true);
    expect(await seedDemoData(uid)).toBe(false);
    let ctx = await loadContextUncached(uid);
    expect(ctx.tracks.every((t) => t.isDemo && t.title.startsWith("[Demo]"))).toBe(true);
    const removed = await removeDemoData(uid);
    expect(removed).toBeGreaterThan(5);
    ctx = await loadContextUncached(uid);
    expect(ctx.tracks).toHaveLength(0);
    expect(ctx.transactions.map((t) => t.description)).toEqual(["Real"]);
  });
});

describe("password hashing", () => {
  it("verifies correct passwords and rejects wrong ones", async () => {
    const h = await hashPassword("correct horse battery");
    expect(h.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("correct horse battery", h)).toBe(true);
    expect(await verifyPassword("wrong", h)).toBe(false);
    expect(await verifyPassword("x", "garbage")).toBe(false);
  });
});
