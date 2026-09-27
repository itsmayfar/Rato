"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { fail, ok, type ActionState } from "@/lib/action-state";
import { db } from "@/lib/db";
import { integrations } from "@/lib/db/schema";
import { getIntegration } from "@/lib/integrations/registry";
import { syncIntegration } from "@/lib/integrations/sync";

export async function connectIntegration(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const key = String(form.get("service") ?? "");
  const def = getIntegration(key);
  if (!def || def.mode !== "api") return fail("This service can’t be connected.");
  const config: Record<string, string> = {};
  for (const f of def.configFields) {
    const v = String(form.get(f.key) ?? "").trim().slice(0, 200);
    if (!v) return fail(`${f.label} is required.`, { [f.key]: "Required" });
    config[f.key] = v;
  }
  await db
    .insert(integrations)
    .values({ userId: user.id, service: key, config, enabled: true })
    .onConflictDoUpdate({ target: [integrations.userId, integrations.service], set: { config, enabled: true, lastError: null, updatedAt: new Date() } });
  await audit(user.id, "integration.connect", "integration", key, def.name);
  revalidatePath("/settings/integrations");
  return ok(`${def.name} connected. Run a sync to fetch data.`);
}

export async function disconnectIntegration(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const key = String(form.get("service") ?? "");
  await db.update(integrations).set({ enabled: false }).where(and(eq(integrations.userId, user.id), eq(integrations.service, key)));
  await audit(user.id, "integration.disconnect", "integration", key, key);
  revalidatePath("/settings/integrations");
  return ok("Disconnected. Previously synced data is kept.");
}

export async function syncIntegrationNow(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const key = String(form.get("service") ?? "");
  try {
    const n = await syncIntegration(user.id, key);
    revalidatePath("/", "layout");
    return ok(`Synced ${n} metric(s) from the official API.`);
  } catch (err) {
    revalidatePath("/settings/integrations");
    return fail((err as Error).message);
  }
}
