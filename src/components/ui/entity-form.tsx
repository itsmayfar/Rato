"use client";

import type { ReactNode } from "react";
import type { ActionState } from "@/lib/action-state";
import type { FieldDef } from "@/lib/fields";
import { ActionForm, FieldGrid, SubmitButton } from "./form";

/** Standard create/edit form for an entity described by field definitions. */
export function EntityForm({
  action,
  defs,
  values,
  hidden,
  submitLabel = "Save",
  columns = 2,
  footer,
  resetOnSuccess,
  onSuccess,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  defs: readonly FieldDef[];
  values?: Record<string, unknown>;
  hidden?: Record<string, string | undefined | null>;
  submitLabel?: string;
  columns?: 1 | 2 | 3;
  footer?: ReactNode;
  resetOnSuccess?: boolean;
  onSuccess?: () => void;
}) {
  return (
    <ActionForm action={action} resetOnSuccess={resetOnSuccess} onSuccess={onSuccess}>
      {hidden &&
        Object.entries(hidden).map(([k, v]) => (v !== undefined && v !== null ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      <FieldGrid defs={defs} values={values} columns={columns} />
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <SubmitButton>{submitLabel}</SubmitButton>
        {footer}
      </div>
    </ActionForm>
  );
}
