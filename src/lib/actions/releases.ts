"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { fail, ok, type ActionState } from "@/lib/action-state";
import { getProfile } from "@/lib/context";
import { db } from "@/lib/db";
import { checklistItems, documents, projects, releaseReviews, releaseTracks, releases, rightsRecords, tracks } from "@/lib/db/schema";
import { parseFieldValue, parseForm, type FieldDef } from "@/lib/fields";
import { RELEASE_FIELDS, REVIEW_FIELDS } from "@/lib/forms";
import { touchInfoMeta } from "@/lib/info/store";
import { ensureExecutionChecklist, scheduleReviews, syncReleaseChecklist } from "@/lib/releases/store";
import { insertGeneratedTasks, syncInformationTasks } from "@/lib/tasks/generate";
import { RELEASE_TYPES } from "@/lib/constants";
import { todayISO } from "@/lib/utils";

const nn = <T,>(v: T) => (v === "" || v === undefined ? null : v);
const PREF_KEYS = ["campaign", "presave", "pitching", "djPromo", "musicVideo"] as const;

const WIZARD_FIELDS: FieldDef[] = [
  { key: "title", label: "Release title", type: "text", required: true, maxLength: 200 },
  { key: "releaseType", label: "Release type", type: "select", options: RELEASE_TYPES, required: true },
  { key: "primaryArtist", label: "Primary artist", type: "text" },
  { key: "featuredArtists", label: "Featured artists", type: "tags" },
  { key: "releaseDate", label: "Planned release date", type: "date" },
  { key: "distributor", label: "Distributor", type: "text" },
  { key: "strategy", label: "Release strategy", type: "textarea" },
  { key: "newTrackTitle", label: "New track title", type: "text" },
];

async function ownRelease(userId: string, id: string) {
  const [r] = await db.select().from(releases).where(and(eq(releases.id, id), eq(releases.userId, userId)));
  return r;
}

/** Release creation wizard: reuses profile and catalog data, then asks only for what's missing. */
export async function createRelease(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = parseForm(WIZARD_FIELDS, form);
  if (!parsed.ok) return fail("Check the highlighted fields.", parsed.errors);
  const d = parsed.data;
  const trackIds = form.getAll("trackIds").map(String).filter(Boolean);
  if (!trackIds.length && !d.newTrackTitle) return fail("Choose at least one track or name a new one.", { trackIds: "Required" });
  if (trackIds.length) {
    const owned = await db.select({ id: tracks.id }).from(tracks).where(and(eq(tracks.userId, user.id), inArray(tracks.id, trackIds)));
    if (owned.length !== new Set(trackIds).size) return fail("Track not found.");
  }
  if (d.releaseType === "single" && trackIds.length + (d.newTrackTitle ? 1 : 0) > 1) {
    return fail("A single has one track (plus optional versions). Choose EP or album for more tracks.", { releaseType: "Choose EP / album" });
  }
  const profile = await getProfile(user.id);
  const prefs = Object.fromEntries(PREF_KEYS.map((k) => [k, form.get(`pref_${k}`) === "on"]));
  const first = trackIds.length ? (await db.select().from(tracks).where(eq(tracks.id, trackIds[0])))[0] : null;

  const id = await db.transaction(async (tx) => {
    const allTrackIds = [...trackIds];
    if (d.newTrackTitle) {
      const [t] = await tx
        .insert(tracks)
        .values({ userId: user.id, title: d.newTrackTitle as string, projectCode: `MF-R${Date.now().toString(36).slice(-5).toUpperCase()}`, status: "In production", primaryArtist: profile.artistName, workflowStage: "Production" })
        .returning({ id: tracks.id });
      await tx.insert(rightsRecords).values({ userId: user.id, trackId: t.id });
      allTrackIds.push(t.id);
    }
    const [project] = await tx
      .insert(projects)
      .values({ userId: user.id, name: `Release: ${d.title}`, kind: "release", phaseKey: "release", status: "active", targetDate: nn(d.releaseDate) as string | null, startDate: todayISO() })
      .returning({ id: projects.id });
    const [r] = await tx
      .insert(releases)
      .values({
        userId: user.id,
        title: d.title as string,
        releaseType: d.releaseType as string,
        primaryArtist: (nn(d.primaryArtist) as string) ?? profile.artistName,
        featuredArtists: (d.featuredArtists as string[])?.length ? (d.featuredArtists as string[]) : (first?.featuredArtists ?? []),
        releaseDate: nn(d.releaseDate) as string | null,
        distributor: (nn(d.distributor) as string) ?? profile.catalogSummary?.distributors?.[0] ?? null,
        genre: first?.genre ?? profile.musicIdentity?.mainGenres?.[0] ?? null,
        language: first?.language ?? null,
        explicit: first?.explicit ?? "unknown",
        strategy: nn(d.strategy) as string | null,
        preferences: prefs,
        status: "Planning",
        projectId: project.id,
      })
      .returning({ id: releases.id });
    if (allTrackIds.length) await tx.insert(releaseTracks).values(allTrackIds.map((trackId, i) => ({ releaseId: r.id, trackId, position: i + 1 })));
    if (d.releaseDate) await tx.update(tracks).set({ plannedReleaseDate: d.releaseDate as string }).where(inArray(tracks.id, allTrackIds));
    return r.id;
  });
  await syncReleaseChecklist(user.id, id);
  await insertGeneratedTasks(user.id, [
    { title: `Complete the release checklist for “${d.title}”`, releaseId: id, phaseKey: "release", priority: "high", status: "planned", source: "template", sourceKey: `release:${id}:checklist`, completionCriteria: "All required checklist steps are verified or confirmed." },
    ...(prefs.campaign ? [{ title: `Create the marketing campaign for “${d.title}”`, releaseId: id, phaseKey: "marketing", priority: "medium", status: "planned", source: "template", sourceKey: `release:${id}:campaign` }] : []),
  ]);
  await syncInformationTasks(user.id);
  await audit(user.id, "release.create", "release", id, d.title as string);
  revalidatePath("/", "layout");
  redirect(`/releases/${id}/questions?new=1`);
}

export async function updateRelease(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = String(form.get("id") ?? "");
  const current = await ownRelease(user.id, id);
  if (!current) return fail("Release not found.");
  const parsed = parseForm(RELEASE_FIELDS, form);
  if (!parsed.ok) return fail("Check the highlighted fields.", parsed.errors);
  const d = parsed.data;
  const values = {
    title: d.title as string,
    releaseType: d.releaseType as string,
    status: d.status as string,
    primaryArtist: nn(d.primaryArtist) as string | null,
    featuredArtists: (d.featuredArtists as string[]) ?? [],
    releaseDate: nn(d.releaseDate) as string | null,
    releaseDateConfirmed: Boolean(d.releaseDate) && Boolean(d.releaseDateConfirmed),
    submissionDeadline: nn(d.submissionDeadline) as string | null,
    distributor: nn(d.distributor) as string | null,
    genre: nn(d.genre) as string | null,
    language: nn(d.language) as string | null,
    explicit: (nn(d.explicit) as string) ?? "unknown",
    upc: nn(d.upc) as string | null,
    preSaveUrl: nn(d.preSaveUrl) as string | null,
    smartLinkUrl: nn(d.smartLinkUrl) as string | null,
    strategy: nn(d.strategy) as string | null,
    notes: nn(d.notes) as string | null,
  };
  if (values.status === "Released" && current.status !== "Released") {
    return fail("Use “Mark as released” so the release is verified and reviews are scheduled.", { status: "Use the Mark as released button" });
  }
  await db.update(releases).set(values).where(eq(releases.id, id));
  if (values.releaseDate !== current.releaseDate) {
    const linked = await db.select({ trackId: releaseTracks.trackId }).from(releaseTracks).where(eq(releaseTracks.releaseId, id));
    if (linked.length && values.releaseDate) await db.update(tracks).set({ plannedReleaseDate: values.releaseDate }).where(inArray(tracks.id, linked.map((l) => l.trackId)));
  }
  await syncReleaseChecklist(user.id, id);
  const changed = Object.keys(values).filter((k) => JSON.stringify(values[k as keyof typeof values]) !== JSON.stringify(current[k as keyof typeof current]));
  await touchInfoMeta(user.id, "release", id, changed);
  await syncInformationTasks(user.id);
  await audit(user.id, "release.update", "release", id, values.title, { changed });
  revalidatePath("/", "layout");
  return ok("Release saved. Checklist deadlines updated.");
}

export async function updateReleasePreferences(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = String(form.get("id") ?? "");
  if (!(await ownRelease(user.id, id))) return fail("Release not found.");
  const prefs = Object.fromEntries(PREF_KEYS.map((k) => [k, form.get(`pref_${k}`) === "on"]));
  await db.update(releases).set({ preferences: prefs }).where(eq(releases.id, id));
  await syncReleaseChecklist(user.id, id);
  revalidatePath(`/releases/${id}`);
  return ok("Preferences saved. The checklist was adjusted.");
}

export async function linkTrack(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const releaseId = String(form.get("releaseId") ?? "");
  const trackId = String(form.get("trackId") ?? "");
  const r = await ownRelease(user.id, releaseId);
  const [t] = await db.select().from(tracks).where(and(eq(tracks.id, trackId), eq(tracks.userId, user.id)));
  if (!r || !t) return fail("Not found.");
  const existing = await db.select().from(releaseTracks).where(eq(releaseTracks.releaseId, releaseId));
  if (r.releaseType === "single" && existing.length >= 1) return fail("A single has one track. Change the release type to add more.");
  await db.insert(releaseTracks).values({ releaseId, trackId, position: existing.length + 1 }).onConflictDoNothing();
  if (r.releaseDate) await db.update(tracks).set({ plannedReleaseDate: r.releaseDate }).where(eq(tracks.id, trackId));
  revalidatePath("/", "layout");
  return ok(`“${t.title}” added.`);
}

export async function unlinkTrack(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const releaseId = String(form.get("releaseId") ?? "");
  const trackId = String(form.get("trackId") ?? "");
  if (!(await ownRelease(user.id, releaseId))) return fail("Release not found.");
  await db.delete(releaseTracks).where(and(eq(releaseTracks.releaseId, releaseId), eq(releaseTracks.trackId, trackId)));
  revalidatePath("/", "layout");
  return ok("Track removed from the release.");
}

export async function moveTrack(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const releaseId = String(form.get("releaseId") ?? "");
  const trackId = String(form.get("trackId") ?? "");
  const dir = form.get("dir") === "up" ? -1 : 1;
  if (!(await ownRelease(user.id, releaseId))) return fail("Release not found.");
  const list = await db.select().from(releaseTracks).where(eq(releaseTracks.releaseId, releaseId)).orderBy(releaseTracks.position);
  const i = list.findIndex((l) => l.trackId === trackId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return ok();
  [list[i], list[j]] = [list[j], list[i]];
  for (const [k, l] of list.entries()) await db.update(releaseTracks).set({ position: k + 1 }).where(and(eq(releaseTracks.releaseId, releaseId), eq(releaseTracks.trackId, l.trackId)));
  revalidatePath(`/releases/${releaseId}`);
  return ok();
}

/** Tick / untick a checklist step. External steps are confirmed explicitly in the UI. */
export async function setChecklistStatus(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = String(form.get("id") ?? "");
  const status = String(form.get("status") ?? "");
  if (!["done", "pending", "not_applicable"].includes(status)) return fail("Invalid status.");
  const [item] = await db.select().from(checklistItems).where(and(eq(checklistItems.id, id), eq(checklistItems.userId, user.id)));
  if (!item) return fail("Checklist item not found.");
  if (item.auto && status === "done") return fail("This step is verified automatically from your data. Complete the underlying information instead.");
  await db.update(checklistItems).set({ status, confirmedAt: status === "done" ? new Date() : null }).where(eq(checklistItems.id, id));
  await audit(user.id, `checklist.${status}`, item.parentType, item.parentId, item.label, { external: item.external });
  revalidatePath("/", "layout");
  return ok(status === "done" ? `“${item.label}” confirmed.` : status === "not_applicable" ? "Marked as not applicable." : "Reopened.");
}

export async function setCover(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = String(form.get("id") ?? "");
  const documentId = String(form.get("documentId") ?? "");
  if (!(await ownRelease(user.id, id))) return fail("Release not found.");
  const [doc] = await db.select().from(documents).where(and(eq(documents.id, documentId), eq(documents.userId, user.id)));
  if (!doc) return fail("Upload the artwork first.");
  if (doc.mimeType && !doc.mimeType.startsWith("image/")) return fail("Cover artwork must be an image (JPG or PNG).");
  await db.update(documents).set({ category: "artwork", releaseId: id }).where(eq(documents.id, documentId));
  await db.update(releases).set({ coverDocumentId: documentId, coverApproved: false }).where(eq(releases.id, id));
  await audit(user.id, "release.cover", "release", id, doc.title);
  revalidatePath("/", "layout");
  return ok("Artwork saved. Review and approve it when it’s final.");
}

export async function approveCover(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = String(form.get("id") ?? "");
  const approve = form.get("approve") === "1";
  const r = await ownRelease(user.id, id);
  if (!r?.coverDocumentId) return fail("No artwork uploaded.");
  await db.update(releases).set({ coverApproved: approve }).where(eq(releases.id, id));
  await audit(user.id, approve ? "release.cover.approve" : "release.cover.unapprove", "release", id, r.title);
  revalidatePath("/", "layout");
  return ok(approve ? "Artwork approved." : "Approval removed.");
}

export async function startExecution(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = String(form.get("id") ?? "");
  if (!(await ownRelease(user.id, id))) return fail("Release not found.");
  await ensureExecutionChecklist(user.id, id);
  revalidatePath(`/releases/${id}`);
  return ok("Release-day checklist created.");
}

/** Explicit confirmation that the release is live. Schedules review periods. */
export async function markReleased(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = String(form.get("id") ?? "");
  const r = await ownRelease(user.id, id);
  if (!r) return fail("Release not found.");
  const date = parseFieldValue({ key: "d", label: "Release date", type: "date", required: true }, String(form.get("releasedOn") ?? r.releaseDate ?? ""));
  if (!date.ok) return fail("Enter the actual release date.");
  const releasedOn = date.value as string;
  await db.update(releases).set({ status: "Released", releaseDate: releasedOn, releaseDateConfirmed: true }).where(eq(releases.id, id));
  const linked = await db.select({ trackId: releaseTracks.trackId }).from(releaseTracks).where(eq(releaseTracks.releaseId, id));
  if (linked.length) await db.update(tracks).set({ actualReleaseDate: releasedOn, workflowStage: "Performance Review" }).where(inArray(tracks.id, linked.map((l) => l.trackId)));
  await scheduleReviews(user.id, id, releasedOn);
  await ensureExecutionChecklist(user.id, id);
  await insertGeneratedTasks(user.id, [
    { title: `Record first performance metrics for “${r.title}”`, releaseId: id, phaseKey: "growth", priority: "high", status: "planned", source: "template", sourceKey: `release:${id}:metrics`, dueDate: releasedOn },
    { title: `Plan follow-up promotion for “${r.title}”`, releaseId: id, phaseKey: "growth", priority: "medium", status: "planned", source: "template", sourceKey: `release:${id}:followup` },
  ]);
  await audit(user.id, "release.released", "release", id, `${r.title} released on ${releasedOn}`);
  revalidatePath("/", "layout");
  return ok("Marked as released. Review periods (24 h, 7, 30, 90 days) are scheduled.");
}

export async function completeReview(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = String(form.get("id") ?? "");
  const parsed = parseForm(REVIEW_FIELDS, form);
  if (!parsed.ok) return fail("Check the fields.", parsed.errors);
  const [rv] = await db.select().from(releaseReviews).where(and(eq(releaseReviews.id, id), eq(releaseReviews.userId, user.id)));
  if (!rv) return fail("Review not found.");
  await db
    .update(releaseReviews)
    .set({ status: "completed", summary: parsed.data.summary as string, lessons: nn(parsed.data.lessons) as string | null, followUps: nn(parsed.data.followUps) as string | null, completedAt: new Date() })
    .where(eq(releaseReviews.id, id));
  const lines = String(parsed.data.followUps ?? "").split("\n").map((l) => l.replace(/^[-*•\d.)\s]+/, "").trim()).filter(Boolean);
  const created = await insertGeneratedTasks(
    user.id,
    lines.map((l, i) => ({ title: l.slice(0, 300), releaseId: rv.releaseId, phaseKey: "growth", priority: "medium", status: "planned", source: "template", sourceKey: `review:${id}:${i}` })),
  );
  await audit(user.id, "release.review", "release", rv.releaseId, `${rv.period} review completed`);
  revalidatePath("/", "layout");
  return ok(`Review saved.${created ? ` ${created} follow-up task(s) created.` : ""}`);
}

export async function addCustomReview(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const releaseId = String(form.get("releaseId") ?? "");
  const period = String(form.get("period") ?? "").trim().slice(0, 40);
  const due = parseFieldValue({ key: "d", label: "Due date", type: "date", required: true }, String(form.get("dueDate") ?? ""));
  if (!(await ownRelease(user.id, releaseId))) return fail("Release not found.");
  if (!period || !due.ok) return fail("Enter a label and a due date.");
  await db.insert(releaseReviews).values({ userId: user.id, releaseId, period, dueDate: due.value as string });
  revalidatePath(`/releases/${releaseId}`);
  return ok("Review period added.");
}

export async function deleteRelease(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = String(form.get("id") ?? "");
  const [r] = await db.delete(releases).where(and(eq(releases.id, id), eq(releases.userId, user.id))).returning({ title: releases.title });
  if (!r) return fail("Release not found.");
  await db.delete(checklistItems).where(and(eq(checklistItems.userId, user.id), eq(checklistItems.parentId, id)));
  await audit(user.id, "release.delete", "release", id, r.title);
  revalidatePath("/", "layout");
  redirect("/releases");
}
