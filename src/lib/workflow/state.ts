import "server-only";
import { db } from "../db";
import { phaseStates } from "../db/schema";
import { insertGeneratedTasks, templateTasks } from "../tasks/generate";
import { getPhase, type PhaseStatus } from "./phases";

export async function setPhaseStatus(userId: string, phaseKey: string, status: PhaseStatus) {
  const now = new Date();
  await db
    .insert(phaseStates)
    .values({
      userId,
      phaseKey,
      status,
      startedAt: status === "active" ? now : null,
      completedAt: status === "completed" ? now : null,
    })
    .onConflictDoUpdate({
      target: [phaseStates.userId, phaseStates.phaseKey],
      set: {
        status,
        ...(status === "active" ? { startedAt: now, completedAt: null } : {}),
        ...(status === "completed" ? { completedAt: now } : {}),
        updatedAt: now,
      },
    });
}

/** Activate a phase and create its template tasks (never duplicated). */
export async function startPhase(userId: string, phaseKey: string) {
  const phase = getPhase(phaseKey);
  if (!phase) throw new Error("Unknown phase");
  await setPhaseStatus(userId, phaseKey, "active");
  return insertGeneratedTasks(userId, templateTasks(phase.tasks, `phase:${phase.key}`, { phaseKey: phase.key }));
}
