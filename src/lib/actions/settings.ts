"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, ne } from "drizzle-orm";
import { cookies } from "next/headers";
import { destroySession, hashPassword, requireUser, verifyPassword } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { fail, ok, type ActionState } from "@/lib/action-state";
import { restoreBackup } from "@/lib/backup";
import { db } from "@/lib/db";
import { aiConversations, analyticsRecords, notifications, sessions, tasks, userSettings, users } from "@/lib/db/schema";
import { removeDemoData, seedDemoData } from "@/lib/demo";
import { parseForm } from "@/lib/fields";
import { SETTINGS_FIELDS } from "@/lib/forms";
import { removeObject } from "@/lib/storage";
import { documents } from "@/lib/db/schema";


export async function saveGeneralSettings(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = parseForm(SETTINGS_FIELDS, form);
  if (!parsed.ok) return fail("Check the highlighted fields.", parsed.errors);
  const tz = parsed.data.timezone as string;
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
  } catch {
    return fail("Unknown time zone.", { timezone: "Use an IANA name like Europe/Berlin" });
  }
  const prefs: Record<string, boolean> = {};
  for (const k of ["deadlines", "overdue", "missing_info", "summaries", "reviews", "follow_ups"]) prefs[k] = form.get(`notify_${k}`) === "on";
  await db
    .update(userSettings)
    .set({ currency: parsed.data.currency as string, timezone: tz, language: parsed.data.language as string, theme: parsed.data.theme as string, notificationPrefs: prefs })
    .where(eq(userSettings.userId, user.id));
  await audit(user.id, "settings.update", "settings", null, "General settings");
  revalidatePath("/", "layout");
  return ok("Settings saved.");
}

export async function saveWorkflowSettings(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const list = (k: string) =>
    Array.from(new Set(String(form.get(k) ?? "").split(",").map((s) => s.trim().slice(0, 40)).filter(Boolean))).slice(0, 20);
  const trackWorkflow = list("trackWorkflow");
  if (trackWorkflow.length === 1) return fail("A workflow needs at least two stages (or leave it empty for the default).", { trackWorkflow: "At least two stages" });
  await db
    .update(userSettings)
    .set({ customStatuses: { track: list("trackStatuses"), release: list("releaseStatuses"), content: list("contentStages") }, trackWorkflow })
    .where(eq(userSettings.userId, user.id));
  revalidatePath("/", "layout");
  return ok("Workflow settings saved.");
}

export async function changePassword(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const current = String(form.get("current") ?? "");
  const next = String(form.get("next") ?? "");
  if (next.length < 10) return fail("Use at least 10 characters.", { next: "At least 10 characters" });
  if (next !== String(form.get("confirm") ?? "")) return fail("Passwords do not match.", { confirm: "Doesn’t match" });
  const [row] = await db.select().from(users).where(eq(users.id, user.id));
  if (!(await verifyPassword(current, row.passwordHash))) return fail("Current password is incorrect.", { current: "Incorrect" });
  await db.update(users).set({ passwordHash: await hashPassword(next) }).where(eq(users.id, user.id));
  await db.delete(sessions).where(and(eq(sessions.userId, user.id), ne(sessions.id, user.sessionId)));
  await audit(user.id, "auth.password_change", "user", user.id, "Password changed; other sessions signed out");
  return ok("Password changed. Other sessions were signed out.");
}

export async function revokeSession(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = String(form.get("id") ?? "");
  if (id === user.sessionId) return fail("Use Sign out for the current session.");
  await db.delete(sessions).where(and(eq(sessions.id, id), eq(sessions.userId, user.id)));
  await audit(user.id, "auth.session_revoke", "session", null, "Session revoked");
  revalidatePath("/settings/security");
  return ok("Session signed out.");
}

export async function restoreBackupAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) return fail("Choose a backup file.");
  if (form.get("confirm") !== "REPLACE") return fail("Type REPLACE to confirm that current data will be replaced.", { confirm: "Type REPLACE" });
  let backup: unknown;
  try {
    backup = JSON.parse(await file.text());
  } catch {
    return fail("The file is not valid JSON.");
  }
  try {
    const counts = await restoreBackup(user.id, backup as Parameters<typeof restoreBackup>[1]);
    await audit(user.id, "data.restore", "backup", null, `Restored backup from ${file.name}`, counts);
  } catch (err) {
    return fail(`Restore failed — nothing was changed. ${(err as Error).message}`);
  }
  revalidatePath("/", "layout");
  return ok("Backup restored.");
}

export async function loadDemoData(_: ActionState, __: FormData): Promise<ActionState> {
  const user = await requireUser();
  const created = await seedDemoData(user.id);
  await audit(user.id, "demo.load", "demo", null, "Demo data loaded");
  revalidatePath("/", "layout");
  return ok(created ? "Demo data loaded. Every sample record is labelled [Demo]." : "Demo data is already loaded.");
}

export async function removeDemoDataAction(_: ActionState, __: FormData): Promise<ActionState> {
  const user = await requireUser();
  const n = await removeDemoData(user.id);
  await audit(user.id, "demo.remove", "demo", null, `Removed ${n} demo records`);
  revalidatePath("/", "layout");
  return ok(`Removed ${n} demo record(s).`);
}

export async function deleteRecords(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const kind = String(form.get("kind") ?? "");
  let n = 0;
  if (kind === "completed_tasks") n = (await db.delete(tasks).where(and(eq(tasks.userId, user.id), eq(tasks.status, "completed"))).returning({ id: tasks.id })).length;
  else if (kind === "notifications") n = (await db.delete(notifications).where(eq(notifications.userId, user.id)).returning({ id: notifications.id })).length;
  else if (kind === "conversations") n = (await db.delete(aiConversations).where(eq(aiConversations.userId, user.id)).returning({ id: aiConversations.id })).length;
  else if (kind === "analytics") n = (await db.delete(analyticsRecords).where(eq(analyticsRecords.userId, user.id)).returning({ id: analyticsRecords.id })).length;
  else return fail("Unknown record type.");
  await audit(user.id, "data.delete", kind, null, `Deleted ${n} record(s)`);
  revalidatePath("/", "layout");
  return ok(`Deleted ${n} record(s).`);
}

export async function deleteAccount(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const [row] = await db.select().from(users).where(eq(users.id, user.id));
  if (!(await verifyPassword(String(form.get("password") ?? ""), row.passwordHash))) return fail("Password is incorrect.", { password: "Incorrect" });
  if (form.get("confirm") !== "DELETE") return fail("Type DELETE to confirm.", { confirm: "Type DELETE" });
  const files = await db.select({ key: documents.storageKey }).from(documents).where(eq(documents.userId, user.id));
  for (const f of files) if (f.key) await removeObject(f.key).catch(() => {});
  await destroySession();
  await db.delete(users).where(eq(users.id, user.id)); // cascades to every owned record
  (await cookies()).delete("mayfar_sidebar");
  redirect("/signup");
}

