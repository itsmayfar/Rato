"use client";

import { EntityForm } from "@/components/ui/entity-form";
import { saveCampaign } from "@/lib/actions/marketing";
import type { FieldDef } from "@/lib/fields";

export function CampaignForm({ defs, values, id }: { defs: FieldDef[]; values?: Record<string, unknown>; id?: string }) {
  return <EntityForm action={saveCampaign} defs={defs} values={values} hidden={{ id }} submitLabel={id ? "Save campaign" : "Create campaign"} />;
}
