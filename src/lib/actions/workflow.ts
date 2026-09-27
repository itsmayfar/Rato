"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { fail, ok, type ActionState } from "@/lib/action-state";
import { db } from "@/lib/db";
import { artistProfiles } from "@/lib/db/schema";
import { loadContext } from "@/lib/context";
import { ONBOARDING_STEPS } from "@/lib/info/registry";
import { markOnboardingStep } from "@/lib/profile";
import { getPhase, PHASES } from "@/lib/workflow/phases";
import { setPhaseStatus, startPhase } from "@/lib/workflow/state";

export async function startPhaseAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const key = String(form.get("phase") ?? "");
  if (!getPhase(key)) return fail("Unknown phase.");
  const created = await startPhase(user.id, key);
  await audit(user.id, "phase.start", "phase", key, `Started phase ${key}`);
  revalidatePath("/", "layout");
  return ok(created ? `Phase started. ${created} task(s) created from the phase template.` : "Phase started. Its tasks already exist.");
}

export async function setPhaseStatusAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const key = String(form.get("phase") ?? "");
  const status = String(form.get("status") ?? "");
  const phase = getPhase(key);
  if (!phase || !["active", "completed", "paused", "not_started"].includes(status)) return fail("Invalid request.");
  if (status === "completed") {
    const ctx = await loadContext(user.id);
    const ev = phase.evaluate(ctx);
    if (!ev.criteriaMet && form.get("override") !== "yes") {
      return fail("The completion criteria are not met yet. Resolve the open checks, or confirm that you want to close the phase anyway.");
    }
  }
  await setPhaseStatus(user.id, key, status as "active");
  await audit(user.id, `phase.${status}`, "phase", key, `Phase ${phase.title} → ${status}`);
  revalidatePath("/", "layout");
  return ok(`Phase marked ${status.replace("_", " ")}.`);
}

export async function skipOnboardingStep(form: FormData) {
  const user = await requireUser();
  const step = String(form.get("__step") ?? form.get("step") ?? "");
  if (!(ONBOARDING_STEPS as readonly string[]).includes(step)) return;
  await markOnboardingStep(user.id, step, "skipped");
  const idx = ONBOARDING_STEPS.indexOf(step as (typeof ONBOARDING_STEPS)[number]);
  const next = ONBOARDING_STEPS[idx + 1];
  revalidatePath("/", "layout");
  redirect(next ? `/onboarding?step=${next}` : "/onboarding?step=finish");
}

/** Finish onboarding: start the foundation phase and create the first tasks. */
export async function completeOnboarding() {
  const user = await requireUser();
  await db.update(artistProfiles).set({ onboardingCompletedAt: new Date() }).where(eq(artistProfiles.userId, user.id));
  await startPhase(user.id, PHASES[0].key);
  await audit(user.id, "onboarding.complete", "profile", null, "Onboarding completed");
  revalidatePath("/", "layout");
  redirect("/onboarding/summary");
}
