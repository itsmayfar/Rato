import "server-only";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { automationRules } from "../db/schema";
import { AUTOMATION_KINDS, type AutomationKind } from "./kinds";

/** Create the built-in automation rules for a user (idempotent). */
export async function ensureDefaultAutomations(userId: string) {
  const existing = await db.select({ kind: automationRules.kind }).from(automationRules).where(eq(automationRules.userId, userId));
  const have = new Set(existing.map((e) => e.kind));
  const missing = (Object.keys(AUTOMATION_KINDS) as AutomationKind[]).filter((k) => !have.has(k));
  if (!missing.length) return;
  await db.insert(automationRules).values(
    missing.map((kind) => ({
      userId,
      name: AUTOMATION_KINDS[kind].label,
      kind,
      trigger: "schedule",
      schedule: AUTOMATION_KINDS[kind].defaultSchedule,
      conditions: { ...AUTOMATION_KINDS[kind].conditions },
      actions: { notify: true, createTasks: kind === "missing_info" || kind === "recurring_tasks" },
      enabled: true,
      requiresApproval: false,
    })),
  );
}
