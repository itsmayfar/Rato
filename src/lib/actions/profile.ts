"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { fail, ok, type ActionState } from "@/lib/action-state";
import { db } from "@/lib/db";
import { goals } from "@/lib/db/schema";
import { parseForm } from "@/lib/fields";
import { GOAL_FIELDS } from "@/lib/forms";

const nn = (v: unknown) => (v === "" || v === undefined ? null : v);

export async function saveGoal(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = String(form.get("id") ?? "");
  const parsed = parseForm(GOAL_FIELDS, form);
  if (!parsed.ok) return fail("Check the highlighted fields.", parsed.errors);
  const d = parsed.data;
  const values = {
    title: d.title as string,
    category: d.category as string,
    horizon: d.horizon as string,
    metric: nn(d.metric) as string | null,
    targetValue: nn(d.targetValue) as number | null,
    currentValue: nn(d.currentValue) as number | null,
    unit: nn(d.unit) as string | null,
    deadline: nn(d.deadline) as string | null,
    status: d.status as string,
    notes: nn(d.notes) as string | null,
  };
  if (id) {
    const res = await db.update(goals).set(values).where(and(eq(goals.id, id), eq(goals.userId, user.id))).returning({ id: goals.id });
    if (!res.length) return fail("Goal not found.");
    await audit(user.id, "goal.update", "goal", id, values.title);
  } else {
    const [row] = await db.insert(goals).values({ ...values, userId: user.id }).returning({ id: goals.id });
    await audit(user.id, "goal.create", "goal", row.id, values.title);
  }
  revalidatePath("/", "layout");
  return ok("Goal saved.");
}

export async function deleteGoal(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = String(form.get("id") ?? "");
  const [g] = await db.delete(goals).where(and(eq(goals.id, id), eq(goals.userId, user.id))).returning({ title: goals.title });
  if (!g) return fail("Goal not found.");
  await audit(user.id, "goal.delete", "goal", id, g.title);
  revalidatePath("/", "layout");
  return ok("Goal deleted.");
}
