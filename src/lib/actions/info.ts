"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { fail, ok, type ActionState } from "@/lib/action-state";
import { parseFieldValue, type FieldValue } from "@/lib/fields";
import { ONBOARDING_STEPS, getRequirement, type EntityType } from "@/lib/info/registry";
import { markOnboardingStep } from "@/lib/profile";
import { applyInfoChanges, type InfoChange } from "@/lib/info/store";
import { loadContext } from "@/lib/context";
import { getPath } from "@/lib/info/engine";
import { syncInformationTasks } from "@/lib/tasks/generate";

const ENTITY_TYPES = new Set<EntityType>(["profile", "platform", "track", "release", "campaign"]);

function same(a: unknown, b: unknown) {
  const norm = (v: unknown) => (v === undefined || v === "" || (Array.isArray(v) && v.length === 0) ? null : v);
  return JSON.stringify(norm(a)) === JSON.stringify(norm(b));
}

/**
 * Save answers from a QuestionFlow. Field names are `f__{entity}__{id}__{key}`,
 * `na__…` marks not applicable, `confirm__…` confirms the stored value.
 * Only changed values are written, so confirmations are never faked.
 */
export async function answerQuestions(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const ctx = await loadContext(user.id);
  const errors: Record<string, string> = {};
  const changes: InfoChange[] = [];
  const seen = new Set<string>();

  const currentValue = (entityType: EntityType, entityId: string, path: string): unknown => {
    if (entityType === "profile") return getPath(ctx.profile as unknown as Record<string, unknown>, path);
    if (entityType === "platform") return ctx.platformLinks.find((l) => l.platform === path)?.url ?? null;
    const rec =
      entityType === "track"
        ? ctx.tracks.find((t) => t.id === entityId)
        : entityType === "release"
          ? ctx.releases.find((r) => r.id === entityId)
          : ctx.campaigns.find((c) => c.id === entityId);
    if (!rec) throw new Error("Record not found");
    return getPath(rec as unknown as Record<string, unknown>, path);
  };

  for (const name of new Set(Array.from(form.keys()))) {
    const m = /^(f|na|confirm)__(profile|platform|track|release|campaign)__([0-9a-f-]+)__(.+)$/.exec(name);
    if (!m) continue;
    const [, kind, entityType, entityId, key] = m as unknown as [string, string, EntityType, string, string];
    if (!ENTITY_TYPES.has(entityType)) continue;
    const req = getRequirement(`${entityType}.${key}`);
    if (!req) continue;
    const uid = `${entityType}__${entityId}__${key}`;
    if (entityType === "profile" || entityType === "platform") {
      if (entityId !== ctx.profile.id) return fail("Invalid profile reference.");
    }
    const current = currentValue(entityType, entityId, req.path);

    if (kind === "na") {
      if (form.get(name) === "on") {
        changes.push({ entityType, entityId, key, notApplicable: true });
        seen.add(uid);
      }
      continue;
    }
    if (kind === "confirm") {
      if (form.get(name) === "on") changes.push({ entityType, entityId, key, confirmOnly: true });
      continue;
    }
    if (form.get(`na__${uid}`) === "on") continue;
    const raw = req.type === "multiselect" || req.type === "boolean" ? form.getAll(name).map(String) : String(form.get(name) ?? "");
    const parsed = parseFieldValue({ ...req, required: false }, raw);
    if (!parsed.ok) {
      errors[name] = parsed.error;
      continue;
    }
    const value: FieldValue = parsed.value;
    if (!same(value, current)) changes.push({ entityType, entityId, key, value });
  }

  if (Object.keys(errors).length) return fail("Some answers need attention.", errors);

  // Confirmations only make sense if the value isn't also being changed
  const changedKeys = new Set(changes.filter((c) => !c.confirmOnly).map((c) => `${c.entityType}:${c.entityId}:${c.key}`));
  const final = changes.filter((c) => !c.confirmOnly || !changedKeys.has(`${c.entityType}:${c.entityId}:${c.key}`));

  if (final.length) {
    await applyInfoChanges(user.id, final, "user");
    const important = final.filter((c) => getRequirement(`${c.entityType}.${c.key}`)?.important);
    await audit(user.id, "info.update", "information", null, `Updated ${final.length} field(s)`, {
      fields: final.map((c) => `${c.entityType}.${c.key}${c.notApplicable ? " (n/a)" : c.confirmOnly ? " (confirmed)" : ""}`),
      important: important.map((c) => `${c.entityType}.${c.key}`),
    });
    await syncInformationTasks(user.id);
  }
  const step = form.get("__step");
  if (typeof step === "string" && (ONBOARDING_STEPS as readonly string[]).includes(step)) {
    await markOnboardingStep(user.id, step, "saved");
  }
  revalidatePath("/", "layout");

  const next = form.get("__next");
  if (typeof next === "string" && next.startsWith("/") && !next.startsWith("//")) redirect(next);
  return ok(final.length ? `Saved ${final.length} answer${final.length === 1 ? "" : "s"}.` : "Nothing changed.");
}
