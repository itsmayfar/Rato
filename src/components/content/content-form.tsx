"use client";

import { EntityForm } from "@/components/ui/entity-form";
import { saveContent } from "@/lib/actions/marketing";
import type { FieldDef } from "@/lib/fields";

export function ContentForm({ defs, values, id }: { defs: FieldDef[]; values?: Record<string, unknown>; id?: string }) {
  return <EntityForm action={saveContent} defs={defs} values={values} hidden={{ id }} submitLabel={id ? "Save content" : "Create content item"} />;
}
