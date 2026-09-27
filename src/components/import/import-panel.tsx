"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { FormMessage, SubmitButton } from "@/components/ui/form";
import { buttonClass, Table, Td, Th } from "@/components/ui/primitives";
import { importCsv } from "@/lib/actions/import";
import type { ActionState } from "@/lib/action-state";

export function ImportPanel({ kind, back }: { kind: string; back: string }) {
  const [state, action] = useActionState(importCsv, {} as ActionState);
  const [fileKey, setFileKey] = useState(0);
  const preview = state.data?.preview as Record<string, unknown>[] | undefined;
  const columns = state.data?.columns as string[] | undefined;
  const imported = state.data?.imported as number | undefined;
  return (
    <form action={action} key={imported ? fileKey : undefined}>
      <input type="hidden" name="kind" value={kind} />
      <input
        type="file"
        name="file"
        accept=".csv,text/csv"
        required
        aria-label="CSV file"
        onChange={() => setFileKey((k) => k + 1)}
        className="block w-full text-sm text-muted file:mr-4 file:rounded-md file:border file:border-line file:bg-surface-3 file:px-4 file:py-2 file:text-sm file:text-fg"
      />
      <div className="mt-4 flex flex-wrap gap-2">
        <SubmitButton name="mode" value="preview" variant="outline">Validate & preview</SubmitButton>
        {Boolean(state.data?.valid) && <SubmitButton name="mode" value="import">Import now</SubmitButton>}
        {imported !== undefined && <Link href={back} className={buttonClass("ghost")}>View imported records →</Link>}
      </div>
      <FormMessage state={state} />
      {state.errors?.__list && <pre className="mt-3 max-h-64 overflow-auto rounded-md border border-line bg-surface-2 p-3 text-xs text-danger">{state.errors.__list}</pre>}
      {preview && columns && (
        <div className="mt-6">
          <h3 className="mb-2 text-xs uppercase tracking-[0.16em] text-faint">Preview (first rows)</h3>
          <Table>
            <thead><tr>{columns.map((c) => <Th key={c}>{c}</Th>)}</tr></thead>
            <tbody>{preview.map((r, i) => <tr key={i}>{columns.map((c) => <Td key={c} className="text-xs">{Array.isArray(r[c]) ? (r[c] as string[]).join(", ") : String(r[c] ?? "")}</Td>)}</tr>)}</tbody>
          </Table>
        </div>
      )}
    </form>
  );
}
