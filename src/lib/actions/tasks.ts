"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { fail, ok, type ActionState } from "@/lib/action-state";
import { OPEN_TASK_STATUSES } from "@/lib/constants";
import { assertOwned } from "@/lib/context";
import { db } from "@/lib/db";
import { campaigns, goals, milestones, projects, releases, taskDependencies, tasks, tracks } from "@/lib/db/schema";
import { parseForm } from "@/lib/fields";
import { MILESTONE_FIELDS, PROJECT_FIELDS, TASK_FIELDS } from "@/lib/forms";
import { scheduleNextOccurrence } from "@/lib/tasks/recurrence";

const nn = (v: unknown) => (v === "" || v === undefined ? null : v);

async function checkRefs(userId: string, d: Record<string, unknown>) {
  await assertOwned(projects, userId, [d.projectId as string]);
  await assertOwned(tracks, userId, [d.trackId as string]);
  await assertOwned(releases, userId, [d.releaseId as string]);
  await assertOwned(campaigns, userId, [d.campaignId as string]);
}

function taskValues(d: Record<string, unknown>) {
  return {
    title: d.title as string,
    description: nn(d.description) as string | null,
    status: d.status as string,
    priority: d.priority as string,
    dueDate: nn(d.dueDate) as string | null,
    startDate: nn(d.startDate) as string | null,
    assignee: nn(d.assignee) as string | null,
    projectId: nn(d.projectId) as string | null,
    trackId: nn(d.trackId) as string | null,
    releaseId: nn(d.releaseId) as string | null,
    campaignId: nn(d.campaignId) as string | null,
    phaseKey: nn(d.phaseKey) as string | null,
    estimatedMinutes: nn(d.estimatedMinutes) as number | null,
    actualMinutes: nn(d.actualMinutes) as number | null,
    recurrence: nn(d.recurrence) as string | null,
    completionCriteria: nn(d.completionCriteria) as string | null,
    notes: nn(d.notes) as string | null,
  };
}

export async function createTask(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = parseForm(TASK_FIELDS, form);
  if (!parsed.ok) return fail("Check the highlighted fields.", parsed.errors);
  try {
    await checkRefs(user.id, parsed.data);
  } catch {
    return fail("A linked record could not be found.");
  }
  const values = taskValues(parsed.data);
  const [row] = await db
    .insert(tasks)
    .values({ ...values, userId: user.id, source: "manual", completedAt: values.status === "completed" ? new Date() : null })
    .returning({ id: tasks.id });
  await audit(user.id, "task.create", "task", row.id, values.title);
  revalidatePath("/", "layout");
  if (form.get("__stay") === "1") return ok("Task added.");
  redirect(`/tasks/${row.id}`);
}

export async function updateTask(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = String(form.get("id") ?? "");
  const parsed = parseForm(TASK_FIELDS, form);
  if (!parsed.ok) return fail("Check the highlighted fields.", parsed.errors);
  try {
    await checkRefs(user.id, parsed.data);
  } catch {
    return fail("A linked record could not be found.");
  }
  const [existing] = await db.select().from(tasks).where(and(eq(tasks.id, id), eq(tasks.userId, user.id)));
  if (!existing) return fail("Task not found.");
  const values = taskValues(parsed.data);
  if (values.status === "completed" && existing.status !== "completed") {
    const blockers = await openDependencies(id);
    if (blockers.length) return fail(`Complete the dependencies first: ${blockers.map((b) => b.title).join(", ")}.`);
  }
  await db
    .update(tasks)
    .set({
      ...values,
      completedAt: values.status === "completed" ? (existing.completedAt ?? new Date()) : null,
    })
    .where(and(eq(tasks.id, id), eq(tasks.userId, user.id)));
  if (values.status === "completed" && existing.status !== "completed") await scheduleNextOccurrence(user.id, { ...existing, ...values });
  await audit(user.id, "task.update", "task", id, values.title);
  revalidatePath("/", "layout");
  return ok("Task saved.");
}

async function openDependencies(taskId: string) {
  const deps = await db
    .select({ id: tasks.id, title: tasks.title, status: tasks.status })
    .from(taskDependencies)
    .innerJoin(tasks, eq(tasks.id, taskDependencies.dependsOnId))
    .where(eq(taskDependencies.taskId, taskId));
  return deps.filter((d) => OPEN_TASK_STATUSES.includes(d.status));
}

/** Explicit user action: mark a task complete (or reopen it). */
export async function toggleTaskComplete(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = String(form.get("id") ?? "");
  const [t] = await db.select().from(tasks).where(and(eq(tasks.id, id), eq(tasks.userId, user.id)));
  if (!t) return fail("Task not found.");
  const completing = t.status !== "completed";
  if (completing) {
    const blockers = await openDependencies(id);
    if (blockers.length) return fail(`Waiting on: ${blockers.map((b) => b.title).join(", ")}`);
  }
  await db
    .update(tasks)
    .set({ status: completing ? "completed" : "planned", completedAt: completing ? new Date() : null })
    .where(eq(tasks.id, id));
  if (completing) await scheduleNextOccurrence(user.id, t);
  await audit(user.id, completing ? "task.complete" : "task.reopen", "task", id, t.title);
  revalidatePath("/", "layout");
  return ok(completing ? "Task completed." : "Task reopened.");
}

export async function setTaskStatus(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = String(form.get("id") ?? "");
  const status = String(form.get("status") ?? "");
  const valid = [...OPEN_TASK_STATUSES, "completed", "cancelled"];
  if (!valid.includes(status)) return fail("Invalid status.");
  const [t] = await db.select().from(tasks).where(and(eq(tasks.id, id), eq(tasks.userId, user.id)));
  if (!t) return fail("Task not found.");
  if (status === "completed") {
    const blockers = await openDependencies(id);
    if (blockers.length) return fail(`Waiting on: ${blockers.map((b) => b.title).join(", ")}`);
  }
  await db.update(tasks).set({ status, completedAt: status === "completed" ? new Date() : null }).where(eq(tasks.id, id));
  if (status === "completed" && t.status !== "completed") await scheduleNextOccurrence(user.id, t);
  revalidatePath("/", "layout");
  return ok("Status updated.");
}

export async function deleteTask(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = String(form.get("id") ?? "");
  const [t] = await db.delete(tasks).where(and(eq(tasks.id, id), eq(tasks.userId, user.id))).returning({ title: tasks.title });
  if (!t) return fail("Task not found.");
  await audit(user.id, "task.delete", "task", id, t.title);
  revalidatePath("/", "layout");
  redirect("/tasks");
}

export async function addDependency(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const taskId = String(form.get("taskId") ?? "");
  const dependsOnId = String(form.get("dependsOnId") ?? "");
  if (!dependsOnId || taskId === dependsOnId) return fail("Choose another task.");
  const owned = await db.select({ id: tasks.id }).from(tasks).where(and(eq(tasks.userId, user.id), inArray(tasks.id, [taskId, dependsOnId])));
  if (owned.length !== 2) return fail("Task not found.");
  // prevent cycles: dependsOn must not (transitively) depend on taskId
  const all = await db
    .select()
    .from(taskDependencies)
    .innerJoin(tasks, eq(tasks.id, taskDependencies.taskId))
    .where(eq(tasks.userId, user.id));
  const graph = new Map<string, string[]>();
  for (const { task_dependencies: d } of all) graph.set(d.taskId, [...(graph.get(d.taskId) ?? []), d.dependsOnId]);
  const stack = [dependsOnId];
  const seen = new Set<string>();
  while (stack.length) {
    const n = stack.pop()!;
    if (n === taskId) return fail("That would create a circular dependency.");
    if (seen.has(n)) continue;
    seen.add(n);
    stack.push(...(graph.get(n) ?? []));
  }
  await db.insert(taskDependencies).values({ taskId, dependsOnId }).onConflictDoNothing();
  revalidatePath(`/tasks/${taskId}`);
  return ok("Dependency added.");
}

export async function removeDependency(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const taskId = String(form.get("taskId") ?? "");
  const dependsOnId = String(form.get("dependsOnId") ?? "");
  const [t] = await db.select({ id: tasks.id }).from(tasks).where(and(eq(tasks.id, taskId), eq(tasks.userId, user.id)));
  if (!t) return fail("Task not found.");
  await db.delete(taskDependencies).where(and(eq(taskDependencies.taskId, taskId), eq(taskDependencies.dependsOnId, dependsOnId)));
  revalidatePath(`/tasks/${taskId}`);
  return ok("Dependency removed.");
}

// ─── Projects ───────────────────────────────────────────────────────────────

function projectValues(d: Record<string, unknown>) {
  return {
    name: d.name as string,
    kind: d.kind as string,
    status: d.status as string,
    phaseKey: nn(d.phaseKey) as string | null,
    startDate: nn(d.startDate) as string | null,
    targetDate: nn(d.targetDate) as string | null,
    budget: nn(d.budget) as number | null,
    goalId: nn(d.goalId) as string | null,
    description: nn(d.description) as string | null,
  };
}

export async function saveProject(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = String(form.get("id") ?? "");
  const parsed = parseForm(PROJECT_FIELDS, form);
  if (!parsed.ok) return fail("Check the highlighted fields.", parsed.errors);
  const values = projectValues(parsed.data);
  if (values.goalId) {
    const [g] = await db.select({ id: goals.id }).from(goals).where(and(eq(goals.id, values.goalId), eq(goals.userId, user.id)));
    if (!g) return fail("Goal not found.");
  }
  if (id) {
    const res = await db.update(projects).set(values).where(and(eq(projects.id, id), eq(projects.userId, user.id))).returning({ id: projects.id });
    if (!res.length) return fail("Project not found.");
    await audit(user.id, "project.update", "project", id, values.name);
    revalidatePath("/", "layout");
    return ok("Project saved.");
  }
  const [row] = await db.insert(projects).values({ ...values, userId: user.id }).returning({ id: projects.id });
  await audit(user.id, "project.create", "project", row.id, values.name);
  revalidatePath("/", "layout");
  redirect(`/tasks/projects/${row.id}`);
}

export async function deleteProject(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = String(form.get("id") ?? "");
  const [p] = await db.delete(projects).where(and(eq(projects.id, id), eq(projects.userId, user.id))).returning({ name: projects.name });
  if (!p) return fail("Project not found.");
  await audit(user.id, "project.delete", "project", id, p.name);
  revalidatePath("/", "layout");
  redirect("/tasks/projects");
}

export async function addMilestone(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const projectId = String(form.get("projectId") ?? "");
  const parsed = parseForm(MILESTONE_FIELDS, form);
  if (!parsed.ok) return fail("Check the fields.", parsed.errors);
  try {
    await assertOwned(projects, user.id, [projectId]);
  } catch {
    return fail("Project not found.");
  }
  await db.insert(milestones).values({ userId: user.id, projectId, title: parsed.data.title as string, dueDate: nn(parsed.data.dueDate) as string | null });
  revalidatePath(`/tasks/projects/${projectId}`);
  return ok("Milestone added.");
}

export async function toggleMilestone(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = String(form.get("id") ?? "");
  const [m] = await db.select().from(milestones).where(and(eq(milestones.id, id), eq(milestones.userId, user.id)));
  if (!m) return fail("Milestone not found.");
  await db.update(milestones).set({ done: !m.done }).where(eq(milestones.id, id));
  revalidatePath(`/tasks/projects/${m.projectId}`);
  return ok();
}
