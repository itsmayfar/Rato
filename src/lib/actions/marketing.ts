"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { fail, ok, type ActionState } from "@/lib/action-state";
import { assertOwned, getSettings } from "@/lib/context";
import { db } from "@/lib/db";
import { adCampaigns, campaigns, contentItems, releases, tracks, transactions } from "@/lib/db/schema";
import { parseForm, type FieldValue } from "@/lib/fields";
import { AD_FIELDS, AD_RESULT_FIELDS, CAMPAIGN_FIELDS, CONTENT_FIELDS } from "@/lib/forms";
import { touchInfoMeta } from "@/lib/info/store";
import { CAMPAIGN_PLANS } from "@/lib/marketing/templates";
import { syncReleaseChecklist } from "@/lib/releases/store";
import { insertGeneratedTasks, syncInformationTasks } from "@/lib/tasks/generate";
import { addDays, todayISO } from "@/lib/utils";

const nn = <T,>(v: T) => (v === "" || v === undefined ? null : v);

function campaignValues(d: Record<string, FieldValue>) {
  return {
    name: d.name as string,
    releaseId: nn(d.releaseId) as string | null,
    trackId: nn(d.trackId) as string | null,
    template: nn(d.template) as string | null,
    objective: nn(d.objective) as string | null,
    status: d.status as string,
    startDate: nn(d.startDate) as string | null,
    endDate: nn(d.endDate) as string | null,
    budget: nn(d.budget) as number | null,
    currency: (nn(d.currency) as string) ?? "EUR",
    channels: (d.channels as string[]) ?? [],
    targetAudience: nn(d.targetAudience) as string | null,
    message: nn(d.message) as string | null,
    creativeDirection: nn(d.creativeDirection) as string | null,
    contentStrategy: nn(d.contentStrategy) as string | null,
    outreachStrategy: nn(d.outreachStrategy) as string | null,
    successMetrics: nn(d.successMetrics) as string | null,
    results: nn(d.results) as string | null,
    notes: nn(d.notes) as string | null,
  };
}

async function checkRefs(userId: string, v: { releaseId: string | null; trackId: string | null }) {
  await assertOwned(releases, userId, [v.releaseId]);
  await assertOwned(tracks, userId, [v.trackId]);
}

/** Create tasks (and optional content placeholders) from a campaign plan template. */
async function applyPlan(userId: string, campaignId: string) {
  const [c] = await db.select().from(campaigns).where(eq(campaigns.id, campaignId));
  if (!c?.template || !CAMPAIGN_PLANS[c.template]) return 0;
  const plan = CAMPAIGN_PLANS[c.template];
  let anchor = c.startDate;
  if (plan.anchor === "release" && c.releaseId) {
    const [r] = await db.select({ d: releases.releaseDate }).from(releases).where(eq(releases.id, c.releaseId));
    anchor = r?.d ?? anchor;
  }
  const created = await insertGeneratedTasks(
    userId,
    plan.steps.map((s) => ({
      title: s.title,
      campaignId,
      releaseId: c.releaseId,
      trackId: c.trackId,
      phaseKey: s.phase === "execution" ? "execution" : s.phase,
      priority: "medium",
      status: "planned",
      dueDate: anchor ? addDays(anchor, s.offset) : null,
      source: "template",
      sourceKey: `campaign:${campaignId}:${s.key}`,
    })),
  );
  // Content placeholders (ideas) for steps that produce content
  const existing = await db.select({ title: contentItems.title }).from(contentItems).where(eq(contentItems.campaignId, campaignId));
  const have = new Set(existing.map((e) => e.title));
  const content = plan.steps.filter((s) => s.content && !have.has(s.title));
  if (content.length) {
    await db.insert(contentItems).values(
      content.map((s) => ({
        userId,
        title: s.title,
        campaignId,
        trackId: c.trackId,
        platform: s.content!.platform,
        format: s.content!.format,
        stage: "Idea",
        plannedDate: anchor ? addDays(anchor, s.offset) : null,
      })),
    );
  }
  return created;
}

export async function saveCampaign(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = String(form.get("id") ?? "");
  const parsed = parseForm(CAMPAIGN_FIELDS, form);
  if (!parsed.ok) return fail("Check the highlighted fields.", parsed.errors);
  const v = campaignValues(parsed.data);
  if (v.startDate && v.endDate && v.endDate < v.startDate) return fail("The end date is before the start date.", { endDate: "Must be after the start date." });
  try {
    await checkRefs(user.id, v);
  } catch {
    return fail("Linked record not found.");
  }
  if (!v.trackId && v.releaseId) {
    const [rt] = await db.query.releaseTracks.findMany({ where: (rt, { eq }) => eq(rt.releaseId, v.releaseId!), limit: 1 });
    v.trackId = rt?.trackId ?? null;
  }
  let campaignId = id;
  if (id) {
    const [current] = await db.select().from(campaigns).where(and(eq(campaigns.id, id), eq(campaigns.userId, user.id)));
    if (!current) return fail("Campaign not found.");
    await db.update(campaigns).set(v).where(eq(campaigns.id, id));
    const changed = Object.keys(v).filter((k) => JSON.stringify(v[k as keyof typeof v]) !== JSON.stringify(current[k as keyof typeof current]));
    await touchInfoMeta(user.id, "campaign", id, changed);
    if (v.template && v.template !== current.template) await applyPlan(user.id, id);
  } else {
    const [row] = await db.insert(campaigns).values({ ...v, userId: user.id }).returning({ id: campaigns.id });
    campaignId = row.id;
    await touchInfoMeta(user.id, "campaign", row.id, Object.keys(v).filter((k) => v[k as keyof typeof v] !== null));
    await applyPlan(user.id, row.id);
  }
  if (v.releaseId) await syncReleaseChecklist(user.id, v.releaseId);
  await syncInformationTasks(user.id);
  await audit(user.id, id ? "campaign.update" : "campaign.create", "campaign", campaignId, v.name);
  revalidatePath("/", "layout");
  if (!id) redirect(`/marketing/${campaignId}`);
  return ok("Campaign saved.");
}

export async function deleteCampaign(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = String(form.get("id") ?? "");
  const [c] = await db.delete(campaigns).where(and(eq(campaigns.id, id), eq(campaigns.userId, user.id))).returning({ name: campaigns.name });
  if (!c) return fail("Campaign not found.");
  await audit(user.id, "campaign.delete", "campaign", id, c.name);
  revalidatePath("/", "layout");
  redirect("/marketing");
}

// ─── Advertising (spend requires explicit approval) ─────────────────────────

async function ownCampaign(userId: string, id: string) {
  const [c] = await db.select().from(campaigns).where(and(eq(campaigns.id, id), eq(campaigns.userId, userId)));
  return c;
}

export async function saveAd(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const campaignId = String(form.get("campaignId") ?? "");
  const id = String(form.get("id") ?? "");
  if (!(await ownCampaign(user.id, campaignId))) return fail("Campaign not found.");
  const parsed = parseForm(AD_FIELDS, form);
  if (!parsed.ok) return fail("Check the highlighted fields.", parsed.errors);
  const d = parsed.data;
  const values = {
    platform: d.platform as string,
    name: d.name as string,
    plannedSpend: d.plannedSpend as number,
    currency: (nn(d.currency) as string) ?? "EUR",
    startDate: nn(d.startDate) as string | null,
    endDate: nn(d.endDate) as string | null,
    targeting: nn(d.targeting) as string | null,
    creativeNotes: nn(d.creativeNotes) as string | null,
  };
  if (id) {
    const [ad] = await db.select().from(adCampaigns).where(and(eq(adCampaigns.id, id), eq(adCampaigns.userId, user.id)));
    if (!ad) return fail("Ad not found.");
    // Changing the spend of an approved ad requires re-approval
    const resetApproval = ad.status !== "draft" && ad.plannedSpend !== values.plannedSpend;
    await db.update(adCampaigns).set({ ...values, ...(resetApproval ? { status: "draft", approvedAt: null } : {}) }).where(eq(adCampaigns.id, id));
    revalidatePath(`/marketing/${campaignId}`);
    return ok(resetApproval ? "Saved. The spend changed, so the ad needs approval again." : "Ad saved.");
  }
  await db.insert(adCampaigns).values({ ...values, userId: user.id, campaignId, status: "draft" });
  await audit(user.id, "ad.create", "campaign", campaignId, `${values.name} (${values.plannedSpend} ${values.currency}, draft)`);
  revalidatePath(`/marketing/${campaignId}`);
  return ok("Ad plan saved as draft. Approve the spend before running it.");
}

export async function setAdStatus(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = String(form.get("id") ?? "");
  const status = String(form.get("status") ?? "");
  const [ad] = await db.select().from(adCampaigns).where(and(eq(adCampaigns.id, id), eq(adCampaigns.userId, user.id)));
  if (!ad) return fail("Ad not found.");
  if (!["draft", "approved", "running", "ended"].includes(status)) return fail("Invalid status.");
  if (status === "running" && ad.status !== "approved" && ad.status !== "running") return fail("Approve the spend before marking the ad as running.");
  await db
    .update(adCampaigns)
    .set({ status, ...(status === "approved" ? { approvedAt: new Date() } : status === "draft" ? { approvedAt: null } : {}) })
    .where(eq(adCampaigns.id, id));
  await audit(user.id, `ad.${status}`, "campaign", ad.campaignId, `${ad.name}: ${status} (planned ${ad.plannedSpend} ${ad.currency})`);
  revalidatePath(`/marketing/${ad.campaignId}`);
  return ok(status === "approved" ? "Spend approved. You still launch the ad yourself in the ad platform." : `Ad marked ${status}.`);
}

export async function recordAdResults(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = String(form.get("id") ?? "");
  const [ad] = await db.select().from(adCampaigns).where(and(eq(adCampaigns.id, id), eq(adCampaigns.userId, user.id)));
  if (!ad) return fail("Ad not found.");
  const parsed = parseForm(AD_RESULT_FIELDS, form);
  if (!parsed.ok) return fail("Check the fields.", parsed.errors);
  const d = parsed.data;
  await db
    .update(adCampaigns)
    .set({
      actualSpend: nn(d.actualSpend) as number | null,
      impressions: nn(d.impressions) as number | null,
      clicks: nn(d.clicks) as number | null,
      conversions: nn(d.conversions) as number | null,
      resultLabel: nn(d.resultLabel) as string | null,
      notes: nn(d.notes) as string | null,
      dataSource: "manual",
    })
    .where(eq(adCampaigns.id, id));
  if (form.get("recordExpense") === "on" && d.actualSpend) {
    const [c] = await db.select().from(campaigns).where(eq(campaigns.id, ad.campaignId));
    const settings = await getSettings(user.id);
    await db.insert(transactions).values({
      userId: user.id,
      kind: "expense",
      category: "Advertising",
      description: `${ad.platform}: ${ad.name}`,
      amount: d.actualSpend as number,
      currency: ad.currency,
      date: ad.endDate ?? todayISO(settings.timezone),
      nature: "actual",
      paymentStatus: "paid",
      campaignId: ad.campaignId,
      releaseId: c?.releaseId ?? null,
      notes: "Recorded from ad results",
    });
  }
  await audit(user.id, "ad.results", "campaign", ad.campaignId, ad.name);
  revalidatePath("/", "layout");
  return ok("Results recorded (manual entry).");
}

export async function deleteAd(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = String(form.get("id") ?? "");
  const [ad] = await db.delete(adCampaigns).where(and(eq(adCampaigns.id, id), eq(adCampaigns.userId, user.id))).returning({ campaignId: adCampaigns.campaignId });
  if (!ad) return fail("Ad not found.");
  revalidatePath(`/marketing/${ad.campaignId}`);
  return ok("Ad removed.");
}

// ─── Content ────────────────────────────────────────────────────────────────

function contentValues(d: Record<string, FieldValue>) {
  return {
    title: d.title as string,
    campaignId: nn(d.campaignId) as string | null,
    trackId: nn(d.trackId) as string | null,
    platform: nn(d.platform) as string | null,
    format: nn(d.format) as string | null,
    stage: d.stage as string,
    plannedDate: nn(d.plannedDate) as string | null,
    plannedTime: nn(d.plannedTime) as string | null,
    responsible: nn(d.responsible) as string | null,
    caption: nn(d.caption) as string | null,
    hashtags: nn(d.hashtags) as string | null,
    callToAction: nn(d.callToAction) as string | null,
    script: nn(d.script) as string | null,
    assetUrl: nn(d.assetUrl) as string | null,
    publishedUrl: nn(d.publishedUrl) as string | null,
    notes: nn(d.notes) as string | null,
  };
}

export async function saveContent(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = String(form.get("id") ?? "");
  const parsed = parseForm(CONTENT_FIELDS, form);
  if (!parsed.ok) return fail("Check the highlighted fields.", parsed.errors);
  const v = contentValues(parsed.data);
  try {
    await assertOwned(campaigns, user.id, [v.campaignId]);
    await assertOwned(tracks, user.id, [v.trackId]);
  } catch {
    return fail("Linked record not found.");
  }
  const documentId = nn(String(form.get("documentId") ?? "")) as string | null;
  if (id) {
    const [cur] = await db.select().from(contentItems).where(and(eq(contentItems.id, id), eq(contentItems.userId, user.id)));
    if (!cur) return fail("Content not found.");
    if (["Scheduled", "Published", "Analyzed"].includes(v.stage) && cur.approvalStatus !== "approved") {
      return fail("Approve the content before scheduling or publishing it.", { stage: "Needs approval first" });
    }
    if (v.stage === "Published" && cur.stage !== "Published") return fail("Use “Mark as published” to confirm publication.", { stage: "Use Mark as published" });
    // Substantive edits after approval require re-approval
    const edited = cur.approvalStatus === "approved" && (cur.caption !== v.caption || cur.assetUrl !== v.assetUrl || cur.script !== v.script);
    await db
      .update(contentItems)
      .set({ ...v, ...(documentId ? { documentId } : {}), ...(edited ? { approvalStatus: "pending", stage: ["Scheduled", "Approved"].includes(v.stage) ? "Review" : v.stage } : {}) })
      .where(eq(contentItems.id, id));
    revalidatePath("/", "layout");
    return ok(edited ? "Saved. The content changed after approval, so it needs approval again." : "Content saved.");
  }
  if (["Approved", "Scheduled", "Published", "Analyzed"].includes(v.stage)) v.stage = "Review";
  const [row] = await db.insert(contentItems).values({ ...v, documentId, userId: user.id }).returning({ id: contentItems.id });
  await audit(user.id, "content.create", "content", row.id, v.title);
  revalidatePath("/", "layout");
  redirect(`/content/${row.id}`);
}

export async function setContentApproval(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = String(form.get("id") ?? "");
  const decision = String(form.get("decision") ?? "");
  const [c] = await db.select().from(contentItems).where(and(eq(contentItems.id, id), eq(contentItems.userId, user.id)));
  if (!c) return fail("Content not found.");
  const map: Record<string, { approvalStatus: string; stage?: string }> = {
    request: { approvalStatus: "pending", stage: "Review" },
    approve: { approvalStatus: "approved", stage: "Approved" },
    changes: { approvalStatus: "changes_requested", stage: "Editing" },
  };
  if (!map[decision]) return fail("Invalid decision.");
  await db.update(contentItems).set(map[decision]).where(eq(contentItems.id, id));
  await audit(user.id, `content.${decision}`, "content", id, c.title);
  revalidatePath("/", "layout");
  return ok(decision === "approve" ? "Approved for publication." : decision === "request" ? "Sent for approval." : "Changes requested.");
}

export async function setContentStage(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = String(form.get("id") ?? "");
  const stage = String(form.get("stage") ?? "").slice(0, 40);
  const [c] = await db.select().from(contentItems).where(and(eq(contentItems.id, id), eq(contentItems.userId, user.id)));
  if (!c) return fail("Content not found.");
  if (["Approved", "Scheduled", "Published", "Analyzed"].includes(stage) && c.approvalStatus !== "approved") return fail("Needs your approval first.");
  if (stage === "Published") return fail("Use “Mark as published” to confirm publication.");
  await db.update(contentItems).set({ stage }).where(eq(contentItems.id, id));
  revalidatePath("/", "layout");
  return ok();
}

/** The user confirms they published the post themselves. */
export async function markPublished(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = String(form.get("id") ?? "");
  const [c] = await db.select().from(contentItems).where(and(eq(contentItems.id, id), eq(contentItems.userId, user.id)));
  if (!c) return fail("Content not found.");
  if (c.approvalStatus !== "approved") return fail("Only approved content can be marked as published.");
  const url = String(form.get("publishedUrl") ?? "").trim();
  await db.update(contentItems).set({ stage: "Published", publishedAt: new Date(), publishedUrl: url || c.publishedUrl }).where(eq(contentItems.id, id));
  await audit(user.id, "content.published", "content", id, c.title);
  revalidatePath("/", "layout");
  return ok("Marked as published.");
}

export async function recordContentMetrics(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = String(form.get("id") ?? "");
  const [c] = await db.select().from(contentItems).where(and(eq(contentItems.id, id), eq(contentItems.userId, user.id)));
  if (!c) return fail("Content not found.");
  const metrics: Record<string, number> = {};
  for (const k of ["views", "likes", "comments", "shares", "saves", "reach", "linkClicks"]) {
    const raw = String(form.get(k) ?? "").trim();
    if (!raw) continue;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) return fail(`${k} must be a positive number.`, { [k]: "Invalid number" });
    metrics[k] = n;
  }
  await db.update(contentItems).set({ metrics, metricsSource: `Manual entry · ${todayISO()}`, stage: c.stage === "Published" ? "Analyzed" : c.stage }).where(eq(contentItems.id, id));
  revalidatePath(`/content/${id}`);
  return ok("Performance recorded.");
}

export async function deleteContent(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = String(form.get("id") ?? "");
  const [c] = await db.delete(contentItems).where(and(eq(contentItems.id, id), eq(contentItems.userId, user.id))).returning({ title: contentItems.title });
  if (!c) return fail("Content not found.");
  revalidatePath("/", "layout");
  redirect("/content");
}
