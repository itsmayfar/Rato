"use client";

import { EntityForm } from "@/components/ui/entity-form";
import { createTrack, updateTrack } from "@/lib/actions/catalog";
import type { FieldDef } from "@/lib/fields";

export function TrackForm({ defs, values, id }: { defs: FieldDef[]; values?: Record<string, unknown>; id?: string }) {
  return <EntityForm action={id ? updateTrack : createTrack} defs={defs} values={values} hidden={{ id }} submitLabel={id ? "Save track" : "Create track"} />;
}
