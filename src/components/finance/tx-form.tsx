"use client";

import { UploadField } from "@/components/documents/upload-field";
import { ActionForm, FieldGrid, SubmitButton } from "@/components/ui/form";
import { saveTransaction } from "@/lib/actions/finance";
import type { FieldDef } from "@/lib/fields";

export function TransactionForm({ defs, values, id }: { defs: FieldDef[]; values?: Record<string, unknown>; id?: string }) {
  return (
    <ActionForm action={saveTransaction}>
      {id && <input type="hidden" name="id" value={id} />}
      <FieldGrid defs={defs} values={values} />
      <div className="mt-4">
        <p className="mb-2 text-xs uppercase tracking-[0.12em] text-muted">Receipt or invoice <span className="normal-case tracking-normal text-faint">optional</span></p>
        <UploadField name="uploadedDocumentId" params={{ category: values?.kind === "income" ? "invoice" : "receipt", sensitive: "1" }} label="Upload receipt / invoice" />
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <SubmitButton>{id ? "Save record" : "Save"}</SubmitButton>
        {!id && <SubmitButton variant="outline" name="__another" value="1">Save & add another</SubmitButton>}
      </div>
    </ActionForm>
  );
}
