import { describe, expect, it } from "vitest";
import { evaluateProfile, evaluateRelease, evaluateTrack, summarize } from "@/lib/info/engine";
import { summarizeSplits } from "@/lib/rights";
import { effectiveChecklist, templatesFor } from "@/lib/releases/checklist";
import { buildRecommendations } from "@/lib/recommendations";
import { PHASES, recommendedPhase } from "@/lib/workflow/phases";
import type { ChecklistItem } from "@/lib/types";
import { makeContext, makeRelease, makeTrack, master, rights, split } from "./fixtures";

describe("split validation", () => {
  it("flags totals that are not 100%", () => {
    expect(summarizeSplits([]).status).toBe("missing");
    expect(summarizeSplits([{ holderName: "A", percentage: 60, confirmed: true }]).status).toBe("under");
    const over = summarizeSplits([
      { holderName: "A", percentage: 60, confirmed: true },
      { holderName: "B", percentage: 50, confirmed: true },
    ]);
    expect(over.status).toBe("over");
    expect(over.issues[0]).toMatch(/110%/);
  });
  it("requires confirmation from every holder", () => {
    const s = summarizeSplits([
      { holderName: "A", percentage: 50, confirmed: true },
      { holderName: "B", percentage: 50, confirmed: false },
    ]);
    expect(s.status).toBe("unconfirmed");
    expect(summarizeSplits([{ holderName: "A", percentage: 100, confirmed: true }]).status).toBe("complete");
  });
  it("handles fractional thirds", () => {
    const s = summarizeSplits([
      { holderName: "A", percentage: 33.334, confirmed: true },
      { holderName: "B", percentage: 33.333, confirmed: true },
      { holderName: "C", percentage: 33.333, confirmed: true },
    ]);
    expect(s.status).toBe("complete");
  });
  it("detects duplicate holders", () => {
    const s = summarizeSplits([
      { holderName: "MayFar", percentage: 50, confirmed: true },
      { holderName: "mayfar ", percentage: 50, confirmed: true },
    ]);
    expect(s.issues.join()).toMatch(/Duplicate/);
  });
});

describe("information engine", () => {
  it("reports every required profile field as missing on an empty profile", () => {
    const ctx = makeContext();
    const s = summarize(evaluateProfile(ctx, ["identity"]));
    expect(s.missingRequired).toBeGreaterThan(5);
    expect(s.blocking.map((b) => b.key)).toContain("artistName");
  });

  it("respects not-applicable overrides and marks stale values outdated", () => {
    const ctx = makeContext({
      profile: { ...makeContext().profile, business: { monthlyBudget: 300 } },
      infoMeta: [
        {
          id: "m1",
          userId: "u1",
          entityType: "profile",
          entityId: "p1",
          fieldKey: "business.monthlyBudget",
          override: null,
          source: "user",
          previousValue: null,
          confirmedAt: null,
          updatedAt: new Date("2026-01-01T00:00:00Z"),
        },
        {
          id: "m2",
          userId: "u1",
          entityType: "profile",
          entityId: "p1",
          fieldKey: "legalName",
          override: "not_applicable",
          source: "user",
          previousValue: null,
          confirmedAt: null,
          updatedAt: new Date(),
        },
      ],
    });
    const items = evaluateProfile(ctx);
    expect(items.find((i) => i.key === "business.monthlyBudget")!.status).toBe("outdated");
    expect(items.find((i) => i.key === "legalName")!.status).toBe("not_applicable");
  });

  it("treats 'unknown' tristate answers as missing and flags stored invalid values", () => {
    const t = makeTrack({ explicit: "unknown", bpm: 999 });
    const items = evaluateTrack(makeContext({ tracks: [t] }), t);
    expect(items.find((i) => i.key === "explicit")!.status).toBe("missing");
    expect(items.find((i) => i.key === "bpm")!.status).toBe("invalid");
  });

  it("never assumes ownership: rights are missing until documented", () => {
    const t = makeTrack();
    const items = evaluateTrack(makeContext({ tracks: [t] }), t);
    expect(items.find((i) => i.key === "compositionSplits")!.status).toBe("missing");
    expect(items.find((i) => i.key === "masterSplits")!.status).toBe("missing");
    expect(items.find((i) => i.key === "samples")!.status).toBe("missing");
  });

  it("marks lyrics not applicable for instrumentals and required for vocal tracks on release", () => {
    const inst = makeTrack();
    const vocal = makeTrack({ language: "English" });
    const ctx = makeContext({ tracks: [inst, vocal] });
    expect(evaluateTrack(ctx, inst, { forRelease: true }).find((i) => i.key === "lyrics")!.status).toBe("not_applicable");
    const lyr = evaluateTrack(ctx, vocal, { forRelease: true }).find((i) => i.key === "lyrics")!;
    expect(lyr.required).toBe(true);
    expect(lyr.status).toBe("missing");
  });

  it("asks only for missing release information (reuses stored data)", () => {
    const t = makeTrack();
    const r = makeRelease({ trackIds: [t.id], distributor: "DistroKid" });
    const ctx = makeContext({ tracks: [{ ...t, releaseIds: [r.id] }], releases: [r] });
    const missing = summarize(evaluateRelease(ctx, r)).blocking.map((b) => b.key);
    expect(missing).not.toContain("title");
    expect(missing).not.toContain("distributor");
    expect(missing).toContain("coverArtwork");
    expect(missing).toContain("finalMaster");
  });
});

function stored(releaseId: string, keys: { key: string; auto: boolean; status?: string }[]): ChecklistItem[] {
  return keys.map((k, i) => ({
    id: `c${i}`,
    userId: "u1",
    parentType: "release",
    parentId: releaseId,
    key: k.key,
    label: k.key,
    description: null,
    required: true,
    external: false,
    status: k.status ?? "pending",
    auto: k.auto,
    dueDate: "2026-09-01",
    confirmedAt: null,
    sortOrder: i,
    createdAt: new Date(),
    updatedAt: new Date(),
  }));
}

describe("release checklist", () => {
  it("only includes steps relevant to the release type and preferences", () => {
    const single = templatesFor({ releaseType: "single" }, { campaign: false }).map((t) => t.key);
    expect(single).not.toContain("tracklist");
    expect(single).not.toContain("campaign");
    expect(single).not.toContain("dj_promo");
    const ep = templatesFor({ releaseType: "ep" }, { campaign: true, djPromo: true }).map((t) => t.key);
    expect(ep).toContain("tracklist");
    expect(ep).toContain("campaign");
    expect(ep).toContain("dj_promo");
  });

  it("verifies auto items from data and keeps manual items as the user set them", () => {
    const t = makeTrack({ versions: [master("x")] });
    t.versions[0].trackId = t.id;
    const r = makeRelease({ trackIds: [t.id], distributor: "DistroKid" });
    const items = stored(r.id, [
      { key: "final_master", auto: true },
      { key: "distributor", auto: true },
      { key: "artwork", auto: true },
      { key: "submission", auto: false },
    ]);
    const ctx = makeContext({ tracks: [t], releases: [r] });
    const eff = effectiveChecklist(ctx, r, items);
    expect(eff.find((i) => i.key === "final_master")!.effectiveStatus).toBe("done");
    expect(eff.find((i) => i.key === "distributor")!.effectiveStatus).toBe("done");
    expect(eff.find((i) => i.key === "artwork")!.effectiveStatus).toBe("pending");
    expect(eff.find((i) => i.key === "artwork")!.overdue).toBe(true);
    expect(eff.find((i) => i.key === "submission")!.effectiveStatus).toBe("pending");
  });
});

describe("phases and recommendations", () => {
  it("recommends starting with the foundation on an empty account", () => {
    const ctx = makeContext();
    expect(recommendedPhase(ctx).key).toBe("foundation");
    const recs = buildRecommendations(ctx);
    expect(recs.length).toBeGreaterThan(0);
    expect(recs[0].id).toBe("onboarding:identity");
    for (const r of recs) {
      expect(r.why.length).toBeGreaterThan(0);
      expect(r.href.startsWith("/")).toBe(true);
    }
  });

  it("every phase evaluates without throwing and reports a next action when incomplete", () => {
    const ctx = makeContext();
    for (const p of PHASES) {
      const ev = p.evaluate(ctx);
      expect(ev.progress).toBeGreaterThanOrEqual(0);
      if (!ev.criteriaMet) expect(ev.nextAction).not.toBeNull();
    }
  });

  it("rights phase is complete when splits, samples and agreements are documented", () => {
    const t = makeTrack();
    const full = {
      ...t,
      splits: [split(t.id, "composition", "MayFar", 100), split(t.id, "master", "MayFar", 100)],
      rights: rights(t.id),
    };
    const ctx = makeContext({ tracks: [full] });
    expect(PHASES.find((p) => p.key === "rights")!.evaluate(ctx).criteriaMet).toBe(true);
    const broken = { ...full, splits: [split(t.id, "composition", "MayFar", 80), split(t.id, "master", "MayFar", 100)] };
    const ev = PHASES.find((p) => p.key === "rights")!.evaluate(makeContext({ tracks: [broken] }));
    expect(ev.criteriaMet).toBe(false);
    const recs = buildRecommendations(makeContext({ tracks: [broken] }));
    expect(recs.some((r) => r.id === `rights:${t.id}`)).toBe(true);
  });

  it("surfaces overdue tasks with the reason", () => {
    const ctx = makeContext({
      tasks: [
        {
          id: "t1",
          userId: "u1",
          title: "Send stems to mix engineer",
          description: null,
          projectId: null,
          trackId: null,
          releaseId: null,
          campaignId: null,
          contactId: null,
          phaseKey: null,
          priority: "high",
          status: "planned",
          dueDate: "2026-09-20",
          startDate: null,
          assignee: null,
          estimatedMinutes: 30,
          actualMinutes: null,
          notes: null,
          completionCriteria: null,
          source: "manual",
          sourceKey: null,
          recurrence: null,
          completedAt: null,
          isDemo: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    });
    const rec = buildRecommendations(ctx).find((r) => r.id === "task:t1");
    expect(rec?.why).toMatch(/Overdue by 7/);
  });
});
