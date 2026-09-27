"use client";

import { useState, type ReactNode } from "react";
import type { ActionState } from "@/lib/action-state";
import type { FieldDef } from "@/lib/fields";
import { ActionForm, FieldGrid, Modal, SubmitButton } from "./form";
import { buttonClass } from "./primitives";

/** Button → modal with a field-definition form; closes when the action succeeds. */
export function FormModal({
  label,
  title,
  action,
  defs,
  values,
  hidden,
  before,
  after,
  submitLabel = "Save",
  variant = "secondary",
  size = "md",
  icon,
  wide = true,
  columns = 2,
  description,
}: {
  label: ReactNode;
  title: ReactNode;
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  defs: readonly FieldDef[];
  values?: Record<string, unknown>;
  hidden?: Record<string, string | null | undefined>;
  before?: ReactNode;
  after?: ReactNode;
  submitLabel?: string;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md" | "lg" | "icon";
  icon?: ReactNode;
  wide?: boolean;
  columns?: 1 | 2 | 3;
  description?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState(0);
  return (
    <>
      <button type="button" className={buttonClass(variant, size)} onClick={() => { setKey((k) => k + 1); setOpen(true); }} aria-label={typeof label === "string" ? label : typeof title === "string" ? title : undefined}>
        {icon}
        {size !== "icon" && label}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={title} wide={wide}>
        {description && <div className="mb-4 text-sm text-muted">{description}</div>}
        <ActionForm key={key} action={action} onSuccess={() => setOpen(false)}>
          {hidden && Object.entries(hidden).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
          {before && <div className="mb-4">{before}</div>}
          <FieldGrid defs={defs} values={values} columns={columns} />
          {after && <div className="mt-4">{after}</div>}
          <div className="mt-6 flex justify-end gap-2">
            <button type="button" className={buttonClass("ghost")} onClick={() => setOpen(false)}>
              Cancel
            </button>
            <SubmitButton>{submitLabel}</SubmitButton>
          </div>
        </ActionForm>
      </Modal>
    </>
  );
}
