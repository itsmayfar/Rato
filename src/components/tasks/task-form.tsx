"use client";

import { EntityForm } from "@/components/ui/entity-form";
import { createTask, updateTask } from "@/lib/actions/tasks";
import type { FieldDef } from "@/lib/fields";

export function TaskForm({ defs, values, id }: { defs: FieldDef[]; values?: Record<string, unknown>; id?: string }) {
  return <EntityForm action={id ? updateTask : createTask} defs={defs} values={values} hidden={{ id }} submitLabel={id ? "Save task" : "Create task"} />;
}
