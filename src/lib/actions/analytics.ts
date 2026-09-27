"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { fail, ok, type ActionState } from "@/lib/action-state";
import { assertOwned } from "@/lib/context";
import { db } from "@/lib/db";
import { analyticsRecords, campaigns, playlistPlacements, releases, tracks } from "@/lib/db/schema";
import { parseForm } from "@/lib/fields";
import { ANALYTICS_FIELDS, PLACEMENT_FIELDS } from "@/lib/forms";

const nn = <T,>(v: T) => (v === "" || v === undefined ? null : v);

export async function saveMetric(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = parseForm(ANALYTICS_FIELDS, form);
  if (!parsed.ok) return fail("Check the highlighted fields.", parsed.errors);
  const d = parsed.data;
  if (d.periodStart && (d.periodStart as string) > (d.periodEnd as string)) return fail("The period start is after its end.", { periodStart: "After end" });
  // Manual entries can never claim to be verified by an API
  if (d.verification === "verified" && form.get("confirmVerified") !== "on") {
    return fail("Confirm the value was copied from an official source (e.g. Spotify for Artists), or choose “Manually entered”.", { verification: "Confirmation required" });
  }
  try {
    await assertOwned(tracks, user.id, [d.trackId as string]);
    await assertOwned(releases, user.id, [d.releaseId as string]);
    await assertOwned(campaigns, user.id, [d.campaignId as string]);
  } catch {
    return fail("Linked record not found.");
  }
  await db.insert(analyticsRecords).values({
    userId: user.id,
    metric: d.metric as string,
    value: d.value as number,
    platform: d.platform as string,
    periodStart: nn(d.periodStart) as string | null,
    periodEnd: d.periodEnd as string,
    source: "manual",
    verification: d.verification as string,
    trackId: nn(d.trackId) as string | null,
    releaseId: nn(d.releaseId) as string | null,
    campaignId: nn(d.campaignId) as string | null,
    notes: nn(d.notes) as string | null,
  });
  revalidatePath("/", "layout");
  return ok("Metric recorded.");
}

export async function deleteMetric(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = String(form.get("id") ?? "");
  const [m] = await db.delete(analyticsRecords).where(and(eq(analyticsRecords.id, id), eq(analyticsRecords.userId, user.id))).returning();
  if (!m) return fail("Record not found.");
  await audit(user.id, "analytics.delete", "analytics", id, `${m.metric} ${m.value} (${m.platform}, ${m.periodEnd})`);
  revalidatePath("/analytics");
  return ok("Record deleted.");
}

export async function savePlacement(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = String(form.get("id") ?? "");
  const parsed = parseForm(PLACEMENT_FIELDS, form);
  if (!parsed.ok) return fail("Check the highlighted fields.", parsed.errors);
  const d = parsed.data;
  try {
    await assertOwned(tracks, user.id, [d.trackId as string]);
  } catch {
    return fail("Track not found.");
  }
  const values = {
    playlistName: d.playlistName as string,
    platform: d.platform as string,
    trackId: nn(d.trackId) as string | null,
    curator: nn(d.curator) as string | null,
    followers: nn(d.followers) as number | null,
    addedDate: nn(d.addedDate) as string | null,
    removedDate: nn(d.removedDate) as string | null,
    url: nn(d.url) as string | null,
    verification: d.verification as string,
  };
  if (id) await db.update(playlistPlacements).set(values).where(and(eq(playlistPlacements.id, id), eq(playlistPlacements.userId, user.id)));
  else await db.insert(playlistPlacements).values({ ...values, userId: user.id });
  revalidatePath("/analytics");
  return ok("Playlist placement saved.");
}

export async function deletePlacement(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = String(form.get("id") ?? "");
  await db.delete(playlistPlacements).where(and(eq(playlistPlacements.id, id), eq(playlistPlacements.userId, user.id)));
  revalidatePath("/analytics");
  return ok("Removed.");
}
