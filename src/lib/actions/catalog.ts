"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, count, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { fail, ok, type ActionState } from "@/lib/action-state";
import { assertOwned, getProfile } from "@/lib/context";
import { db } from "@/lib/db";
import { contacts, documents, feedbackNotes, ownershipSplits, rightsRecords, trackCollaborators, trackVersions, tracks } from "@/lib/db/schema";
import { parseForm, type FieldValue } from "@/lib/fields";
import { COLLABORATOR_FIELDS, FEEDBACK_FIELDS, RIGHTS_FIELDS, SPLIT_FIELDS, TRACK_FIELDS, VERSION_FIELDS } from "@/lib/forms";
import { touchInfoMeta } from "@/lib/info/store";
import { insertGeneratedTasks } from "@/lib/tasks/generate";

const nn = <T,>(v: T) => (v === "" || v === undefined ? null : v);

async function nextProjectCode(userId: string) {
  const [{ n }] = await db.select({ n: count() }).from(tracks).where(eq(tracks.userId, userId));
  return `MF-${String(n + 1).padStart(3, "0")}`;
}

function trackValues(d: Record<string, FieldValue>) {
  return {
    title: d.title as string,
    status: d.status as string,
    primaryArtist: nn(d.primaryArtist) as string | null,
    featuredArtists: (d.featuredArtists as string[]) ?? [],
    genre: nn(d.genre) as string | null,
    subgenre: nn(d.subgenre) as string | null,
    bpm: nn(d.bpm) as number | null,
    musicalKey: nn(d.musicalKey) as string | null,
    mood: nn(d.mood) as string | null,
    language: nn(d.language) as string | null,
    durationSec: nn(d.durationSec) as number | null,
    explicit: (nn(d.explicit) as string) ?? "unknown",
    hasCollaborators: (nn(d.hasCollaborators) as string) ?? "unknown",
    isrc: nn(d.isrc) as string | null,
    plannedReleaseDate: nn(d.plannedReleaseDate) as string | null,
    actualReleaseDate: nn(d.actualReleaseDate) as string | null,
    lyrics: nn(d.lyrics) as string | null,
    productionNotes: nn(d.productionNotes) as string | null,
  };
}

/** Tasks created automatically for a new track, depending on where it stands. */
function trackTemplateTasks(trackId: string, title: string, status: string) {
  const early = ["Idea", "Demo", "In production", "Arrangement", "Recording"].includes(status);
  const list = [
    early && { key: "produce", title: `Develop “${title}” to a finished mix`, phaseKey: "production", priority: "medium" },
    status !== "Finished" && { key: "master", title: `Get an approved master for “${title}”`, phaseKey: "production", priority: "medium" },
    { key: "credits", title: `Document credits and collaborators for “${title}”`, phaseKey: "rights", priority: "medium" },
    { key: "splits", title: `Record composition and master ownership for “${title}”`, phaseKey: "rights", priority: "high", completionCriteria: "Both split types total 100% and are confirmed." },
    status === "Finished" && { key: "release", title: `Plan a release for “${title}”`, phaseKey: "release", priority: "medium" },
  ].filter(Boolean) as { key: string; title: string; phaseKey: string; priority: string; completionCriteria?: string }[];
  return list.map((t) => ({
    title: t.title,
    phaseKey: t.phaseKey,
    priority: t.priority,
    completionCriteria: t.completionCriteria ?? null,
    trackId,
    status: "planned",
    source: "template",
    sourceKey: `track:${trackId}:${t.key}`,
  }));
}

export async function createTrack(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = parseForm(TRACK_FIELDS, form);
  if (!parsed.ok) return fail("Check the highlighted fields.", parsed.errors);
  const values = trackValues(parsed.data);
  const profile = await getProfile(user.id);
  values.primaryArtist ??= profile.artistName;
  let projectCode = (parsed.data.projectCode as string | null) ?? (await nextProjectCode(user.id));
  const existing = await db.select({ id: tracks.id }).from(tracks).where(and(eq(tracks.userId, user.id), eq(tracks.projectCode, projectCode)));
  if (existing.length) {
    if (parsed.data.projectCode) return fail("That project ID is already used.", { projectCode: "Already used." });
    projectCode = `${projectCode}-${Date.now().toString(36).slice(-3)}`;
  }
  const [row] = await db
    .insert(tracks)
    .values({ ...values, userId: user.id, projectCode, workflowStage: values.status === "Finished" ? "Rights Review" : values.status === "Idea" ? "Idea" : "Production" })
    .returning({ id: tracks.id });
  await db.insert(rightsRecords).values({ userId: user.id, trackId: row.id });
  await insertGeneratedTasks(user.id, trackTemplateTasks(row.id, values.title, values.status));
  await touchInfoMeta(user.id, "track", row.id, Object.keys(values).filter((k) => values[k as keyof typeof values] !== null));
  await audit(user.id, "track.create", "track", row.id, values.title);
  revalidatePath("/", "layout");
  redirect(`/catalog/${row.id}`);
}

export async function updateTrack(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = String(form.get("id") ?? "");
  const parsed = parseForm(TRACK_FIELDS, form);
  if (!parsed.ok) return fail("Check the highlighted fields.", parsed.errors);
  const [current] = await db.select().from(tracks).where(and(eq(tracks.id, id), eq(tracks.userId, user.id)));
  if (!current) return fail("Track not found.");
  const values = trackValues(parsed.data);
  const code = (parsed.data.projectCode as string | null) ?? current.projectCode;
  if (code !== current.projectCode) {
    const dupe = await db.select({ id: tracks.id }).from(tracks).where(and(eq(tracks.userId, user.id), eq(tracks.projectCode, code)));
    if (dupe.length) return fail("That project ID is already used.", { projectCode: "Already used." });
  }
  await db.update(tracks).set({ ...values, projectCode: code }).where(and(eq(tracks.id, id), eq(tracks.userId, user.id)));
  const changed = Object.keys(values).filter((k) => JSON.stringify(values[k as keyof typeof values]) !== JSON.stringify(current[k as keyof typeof current]));
  await touchInfoMeta(user.id, "track", id, changed);
  await audit(user.id, "track.update", "track", id, values.title, { changed });
  revalidatePath("/", "layout");
  return ok("Track saved.");
}

export async function setWorkflowStage(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = String(form.get("id") ?? "");
  const stage = String(form.get("stage") ?? "").slice(0, 60);
  if (!stage) return fail("Choose a stage.");
  const res = await db.update(tracks).set({ workflowStage: stage }).where(and(eq(tracks.id, id), eq(tracks.userId, user.id))).returning({ id: tracks.id });
  if (!res.length) return fail("Track not found.");
  revalidatePath(`/catalog/${id}`);
  return ok(`Stage set to ${stage}.`);
}

export async function deleteTrack(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = String(form.get("id") ?? "");
  const [t] = await db.delete(tracks).where(and(eq(tracks.id, id), eq(tracks.userId, user.id))).returning({ title: tracks.title });
  if (!t) return fail("Track not found.");
  await audit(user.id, "track.delete", "track", id, t.title);
  revalidatePath("/", "layout");
  redirect("/catalog");
}

// ─── Versions ───────────────────────────────────────────────────────────────

async function ownTrack(userId: string, trackId: string) {
  const [t] = await db.select({ id: tracks.id, title: tracks.title }).from(tracks).where(and(eq(tracks.id, trackId), eq(tracks.userId, userId)));
  return t;
}

export async function addVersion(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const trackId = String(form.get("trackId") ?? "");
  if (!(await ownTrack(user.id, trackId))) return fail("Track not found.");
  const parsed = parseForm(VERSION_FIELDS, form);
  if (!parsed.ok) return fail("Check the highlighted fields.", parsed.errors);
  const documentId = nn(String(form.get("documentId") ?? "")) as string | null;
  if (!documentId && !parsed.data.externalUrl) return fail("Upload a file or add a link.");
  if (documentId) {
    try {
      await assertOwned(documents, user.id, [documentId]);
    } catch {
      return fail("Uploaded file not found.");
    }
  }
  await db.insert(trackVersions).values({
    userId: user.id,
    trackId,
    kind: parsed.data.kind as string,
    label: parsed.data.label as string,
    externalUrl: nn(parsed.data.externalUrl) as string | null,
    notes: nn(parsed.data.notes) as string | null,
    documentId,
  });
  await audit(user.id, "track.version.add", "track", trackId, parsed.data.label as string);
  revalidatePath(`/catalog/${trackId}`);
  return ok("Version added.");
}

/** Approving a master is an explicit, confirmed decision by the artist. */
export async function setVersionApproval(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = String(form.get("id") ?? "");
  const approve = form.get("approve") === "1";
  const [v] = await db
    .update(trackVersions)
    .set({ approved: approve, approvedAt: approve ? new Date() : null })
    .where(and(eq(trackVersions.id, id), eq(trackVersions.userId, user.id)))
    .returning({ trackId: trackVersions.trackId, label: trackVersions.label });
  if (!v) return fail("Version not found.");
  await audit(user.id, approve ? "track.version.approve" : "track.version.unapprove", "track", v.trackId, v.label);
  revalidatePath("/", "layout");
  return ok(approve ? "Version approved." : "Approval removed.");
}

export async function deleteVersion(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = String(form.get("id") ?? "");
  const [v] = await db.delete(trackVersions).where(and(eq(trackVersions.id, id), eq(trackVersions.userId, user.id))).returning({ trackId: trackVersions.trackId });
  if (!v) return fail("Version not found.");
  revalidatePath(`/catalog/${v.trackId}`);
  return ok("Version removed. The uploaded file stays in Documents.");
}

// ─── Collaborators ──────────────────────────────────────────────────────────

export async function addCollaborator(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const trackId = String(form.get("trackId") ?? "");
  if (!(await ownTrack(user.id, trackId))) return fail("Track not found.");
  const parsed = parseForm(COLLABORATOR_FIELDS, form);
  if (!parsed.ok) return fail("Check the highlighted fields.", parsed.errors);
  const contactId = nn(parsed.data.contactId) as string | null;
  try {
    await assertOwned(contacts, user.id, [contactId]);
  } catch {
    return fail("Contact not found.");
  }
  await db.insert(trackCollaborators).values({
    userId: user.id,
    trackId,
    contactId,
    name: parsed.data.name as string,
    role: parsed.data.role as string,
    credited: Boolean(parsed.data.credited),
    notes: nn(parsed.data.notes) as string | null,
  });
  // Adding a collaborator answers the "collaborators involved?" question
  await db.update(tracks).set({ hasCollaborators: "yes" }).where(and(eq(tracks.id, trackId), eq(tracks.hasCollaborators, "unknown")));
  await audit(user.id, "track.collaborator.add", "track", trackId, `${parsed.data.name} (${parsed.data.role})`);
  revalidatePath("/", "layout");
  return ok("Collaborator added.");
}

export async function removeCollaborator(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = String(form.get("id") ?? "");
  const [c] = await db.delete(trackCollaborators).where(and(eq(trackCollaborators.id, id), eq(trackCollaborators.userId, user.id))).returning({ trackId: trackCollaborators.trackId });
  if (!c) return fail("Collaborator not found.");
  revalidatePath(`/catalog/${c.trackId}`);
  return ok("Collaborator removed.");
}

// ─── Rights ─────────────────────────────────────────────────────────────────

export async function saveRights(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const trackId = String(form.get("trackId") ?? "");
  const track = await ownTrack(user.id, trackId);
  if (!track) return fail("Track not found.");
  const parsed = parseForm(RIGHTS_FIELDS, form);
  if (!parsed.ok) return fail("Check the highlighted fields.", parsed.errors);
  const d = parsed.data;
  if (d.samplesUsed === "none" && d.sampleLicenseStatus !== "not_needed") d.sampleLicenseStatus = "not_needed";
  if (d.samplesUsed === "yes" && d.sampleLicenseStatus === "not_needed") {
    return fail("Samples are used — record the licence status.", { sampleLicenseStatus: "A licence status is required when samples are used." });
  }
  const values = {
    samplesUsed: d.samplesUsed as string,
    sampleDetails: nn(d.sampleDetails) as string | null,
    sampleLicenseStatus: d.sampleLicenseStatus as string,
    agreementStatus: d.agreementStatus as string,
    copyrightRegistration: d.copyrightRegistration as string,
    proRegistration: d.proRegistration as string,
    royaltyCollection: d.royaltyCollection as string,
    collectionServices: nn(d.collectionServices) as string | null,
    openQuestions: nn(d.openQuestions) as string | null,
    notes: nn(d.notes) as string | null,
  };
  await db
    .insert(rightsRecords)
    .values({ ...values, userId: user.id, trackId })
    .onConflictDoUpdate({ target: rightsRecords.trackId, set: { ...values, updatedAt: new Date() } });
  await audit(user.id, "rights.update", "track", trackId, `Rights record for ${track.title}`, values);
  revalidatePath("/", "layout");
  return ok("Rights information saved.");
}

export async function saveSplit(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const trackId = String(form.get("trackId") ?? "");
  const id = String(form.get("id") ?? "");
  const track = await ownTrack(user.id, trackId);
  if (!track) return fail("Track not found.");
  const parsed = parseForm(SPLIT_FIELDS, form);
  if (!parsed.ok) return fail("Check the highlighted fields.", parsed.errors);
  const d = parsed.data;
  const contactId = nn(d.contactId) as string | null;
  const agreementDocumentId = nn(d.agreementDocumentId) as string | null;
  try {
    await assertOwned(contacts, user.id, [contactId]);
    await assertOwned(documents, user.id, [agreementDocumentId]);
  } catch {
    return fail("Linked record not found.");
  }
  const values = {
    rightType: d.rightType as string,
    holderName: d.holderName as string,
    role: nn(d.role) as string | null,
    percentage: d.percentage as number,
    contactId,
    agreementDocumentId,
    confirmed: Boolean(d.confirmed),
    notes: nn(d.notes) as string | null,
  };
  // Validate the resulting total for this right type
  const others = (await db.select().from(ownershipSplits).where(and(eq(ownershipSplits.trackId, trackId), eq(ownershipSplits.rightType, values.rightType)))).filter(
    (s) => s.id !== id,
  );
  const total = Math.round((others.reduce((s, x) => s + Number(x.percentage), 0) + values.percentage) * 1000) / 1000;
  if (total > 100) return fail(`That would make ${values.rightType} shares total ${total}%. Shares cannot exceed 100%.`, { percentage: `Max ${Math.round((100 - (total - values.percentage)) * 1000) / 1000}%` });
  if (others.some((o) => o.holderName.trim().toLowerCase() === values.holderName.trim().toLowerCase())) {
    return fail(`${values.holderName} already has a ${values.rightType} share. Edit that entry instead.`, { holderName: "Duplicate holder." });
  }
  if (id) {
    const res = await db.update(ownershipSplits).set(values).where(and(eq(ownershipSplits.id, id), eq(ownershipSplits.userId, user.id))).returning({ id: ownershipSplits.id });
    if (!res.length) return fail("Split not found.");
  } else {
    await db.insert(ownershipSplits).values({ ...values, userId: user.id, trackId });
  }
  await audit(user.id, id ? "split.update" : "split.create", "track", trackId, `${values.rightType}: ${values.holderName} ${values.percentage}%`, values);
  revalidatePath("/", "layout");
  return ok(total === 100 ? `Saved. ${values.rightType === "master" ? "Master" : "Composition"} shares now total 100%.` : `Saved. ${values.rightType} shares total ${total}% — ${Math.round((100 - total) * 1000) / 1000}% unassigned.`);
}

export async function deleteSplit(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = String(form.get("id") ?? "");
  const [s] = await db.delete(ownershipSplits).where(and(eq(ownershipSplits.id, id), eq(ownershipSplits.userId, user.id))).returning();
  if (!s) return fail("Split not found.");
  await audit(user.id, "split.delete", "track", s.trackId, `${s.rightType}: ${s.holderName} ${s.percentage}%`);
  revalidatePath("/", "layout");
  return ok("Share removed.");
}

// ─── Feedback ───────────────────────────────────────────────────────────────

export async function addFeedback(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const trackId = String(form.get("trackId") ?? "");
  if (!(await ownTrack(user.id, trackId))) return fail("Track not found.");
  const parsed = parseForm(FEEDBACK_FIELDS, form);
  if (!parsed.ok) return fail("Check the fields.", parsed.errors);
  await db.insert(feedbackNotes).values({ userId: user.id, trackId, source: parsed.data.source as string, note: parsed.data.note as string });
  revalidatePath(`/catalog/${trackId}`);
  return ok("Feedback saved.");
}

export async function toggleFeedback(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = String(form.get("id") ?? "");
  const [f] = await db.select().from(feedbackNotes).where(and(eq(feedbackNotes.id, id), eq(feedbackNotes.userId, user.id)));
  if (!f) return fail("Not found.");
  await db.update(feedbackNotes).set({ resolved: !f.resolved }).where(eq(feedbackNotes.id, id));
  revalidatePath(`/catalog/${f.trackId}`);
  return ok();
}
