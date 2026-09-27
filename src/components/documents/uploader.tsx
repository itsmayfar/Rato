"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload } from "lucide-react";
import { FieldInput } from "@/components/ui/form";
import { buttonClass } from "@/components/ui/primitives";
import { DOCUMENT_CATEGORIES } from "@/lib/constants";
import type { Option } from "@/lib/fields";
import { uploadFile } from "./upload-field";

/** Upload one or more files with category and links. */
export function DocumentUploader({ defaults, options, replaces }: { defaults: Record<string, string | undefined>; options: Record<string, readonly Option[]>; replaces?: string }) {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const [state, setState] = useState<{ busy: boolean; msg?: string; error?: boolean; pct?: number }>({ busy: false });
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const files = (fd.getAll("files") as File[]).filter((f) => f.size > 0);
    if (!files.length) return setState({ busy: false, msg: "Choose at least one file.", error: true });
    setState({ busy: true, pct: 0 });
    try {
      for (const [i, f] of files.entries()) {
        await uploadFile(
          f,
          {
            category: String(fd.get("category") ?? "other"),
            title: files.length === 1 ? String(fd.get("title") ?? "") || undefined : undefined,
            trackId: String(fd.get("trackId") ?? "") || undefined,
            releaseId: String(fd.get("releaseId") ?? "") || undefined,
            campaignId: String(fd.get("campaignId") ?? "") || undefined,
            sensitive: fd.get("sensitive") === "true" ? "1" : undefined,
            replaces,
          },
          (pct) => setState({ busy: true, pct: Math.round(((i + pct / 100) / files.length) * 100) }),
        );
      }
      setState({ busy: false, msg: `${files.length} file(s) uploaded.` });
      form.current?.reset();
      router.refresh();
    } catch (err) {
      setState({ busy: false, msg: (err as Error).message, error: true });
    }
  }
  return (
    <form ref={form} onSubmit={onSubmit} className="space-y-4">
      <input type="file" name="files" multiple={!replaces} aria-label="Files" className="block w-full text-sm text-muted file:mr-4 file:rounded-md file:border file:border-line file:bg-surface-3 file:px-4 file:py-2 file:text-sm file:text-fg" />
      {!replaces && (
        <div className="grid gap-4 md:grid-cols-2">
          <FieldInput def={{ key: "title", label: "Title (single file)", type: "text" }} />
          <FieldInput def={{ key: "category", label: "Category", type: "select", options: DOCUMENT_CATEGORIES, required: true }} value={defaults.category ?? "other"} />
          <FieldInput def={{ key: "trackId", label: "Track", type: "select", options: options.trackId }} value={defaults.trackId} />
          <FieldInput def={{ key: "releaseId", label: "Release", type: "select", options: options.releaseId }} value={defaults.releaseId} />
          <FieldInput def={{ key: "campaignId", label: "Campaign", type: "select", options: options.campaignId }} value={defaults.campaignId} />
          <FieldInput def={{ key: "sensitive", label: "Sensitive", type: "boolean", placeholder: "Sensitive (contracts, invoices, IDs)" }} value={["contract", "invoice", "receipt", "split_sheet"].includes(defaults.category ?? "")} />
        </div>
      )}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={state.busy} className={buttonClass("primary")}>
          {state.busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {replaces ? "Upload new version" : "Upload"}
        </button>
        {state.busy && <span className="text-xs text-muted">{state.pct}%</span>}
        {state.msg && <span className={state.error ? "text-xs text-danger" : "text-xs text-success"} role="status">{state.msg}</span>}
      </div>
    </form>
  );
}
