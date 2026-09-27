import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "./db";
import { artistProfiles } from "./db/schema";

export async function markOnboardingStep(userId: string, step: string, state: "saved" | "skipped") {
  await db
    .update(artistProfiles)
    .set({ onboardingSteps: sql`${artistProfiles.onboardingSteps} || ${JSON.stringify({ [step]: state })}::jsonb` })
    .where(eq(artistProfiles.userId, userId));
}
