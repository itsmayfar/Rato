"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { fail, ok, type ActionState } from "@/lib/action-state";
import { runAutomations } from "@/lib/automations/engine";
import { db } from "@/lib/db";
import { automationRules, notifications } from "@/lib/db/schema";

export async function markNotificationRead(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = String(form.get("id") ?? "");
  await db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.id, id), eq(notifications.userId, user.id)));
  revalidatePath("/", "layout");
  return ok();
}

export async function markAllNotificationsRead(_: ActionState, __: FormData): Promise<ActionState> {
  const user = await requireUser();
  await db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.userId, user.id), isNull(notifications.readAt)));
  revalidatePath("/", "layout");
  return ok("All notifications marked as read.");
}

export async function clearReadNotifications(_: ActionState, __: FormData): Promise<ActionState> {
  const user = await requireUser();
  await db.delete(notifications).where(and(eq(notifications.userId, user.id), isNotNull(notifications.readAt)));
  revalidatePath("/notifications");
  return ok("Read notifications cleared.");
}

export async function updateAutomationRule(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = String(form.get("id") ?? "");
  const [rule] = await db.select().from(automationRules).where(and(eq(automationRules.id, id), eq(automationRules.userId, user.id)));
  if (!rule) return fail("Rule not found.");
  const schedule = String(form.get("schedule") ?? rule.schedule);
  if (!["daily", "weekly", "monthly"].includes(schedule)) return fail("Invalid schedule.");
  const conditions = { ...(rule.conditions as Record<string, unknown>) };
  for (const k of ["daysAhead", "withinDays"]) {
    const raw = form.get(k);
    if (raw === null) continue;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 0 || n > 365) return fail(`${k} must be a whole number between 0 and 365.`, { [k]: "0–365" });
    conditions[k] = n;
  }
  const actions = { ...(rule.actions as Record<string, unknown>), notify: form.get("notify") === "on", ...(form.has("createTasksPresent") ? { createTasks: form.get("createTasks") === "on" } : {}) };
  await db
    .update(automationRules)
    .set({ enabled: form.get("enabled") === "on", requiresApproval: form.get("requiresApproval") === "on", schedule, conditions, actions })
    .where(eq(automationRules.id, id));
  await audit(user.id, "automation.update", "automation", id, rule.name);
  revalidatePath("/automations");
  return ok("Automation saved.");
}

/** Running a rule manually counts as the user's approval for that run. */
export async function runAutomationNow(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = String(form.get("id") ?? "") || undefined;
  const results = await runAutomations(user.id, { ruleId: id, force: true, approved: true });
  revalidatePath("/", "layout");
  const errors = results.filter((r) => r.result === "error");
  if (errors.length) return fail(`${errors.length} automation(s) failed: ${errors.map((e) => `${e.name}: ${e.details}`).join("; ")}`);
  return ok(`${results.length} automation(s) ran. ${results.reduce((s, r) => s + r.created, 0)} new notification(s).`);
}
