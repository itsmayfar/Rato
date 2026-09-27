"use client";

import { useRef, useState } from "react";
import { Check, Loader2, Upload } from "lucide-react";
import { buttonClass } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

export type UploadResult = { id: string; title: string; version: number; size: number };

export async function uploadFile(
  file: File,
  params: Record<string, string | undefined>,
  onProgress?: (pct: number) => void,
): Promise<UploadResult> {
  const q = new URLSearchParams({ name: file.name });
  for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/upload?${q.toString()}`);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      try {
        const body = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) resolve(body);
        else reject(new Error(body.error ?? "Upload failed."));
      } catch {
        reject(new Error("Upload failed."));
      }
    };
    xhr.onerror = () => reject(new Error("Network error during upload."));
    xhr.send(file);
  });
}

/**
 * File picker that uploads immediately (streaming, with progress) and stores
 * the resulting document id in a hidden input for the surrounding form.
 */
export function UploadField({
  name = "documentId",
  params,
  label = "Upload file",
  accept,
  onUploaded,
}: {
  name?: string;
  params: Record<string, string | undefined>;
  label?: string;
  accept?: string;
  onUploaded?: (r: UploadResult) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<{ status: "idle" | "uploading" | "done" | "error"; pct?: number; msg?: string; id?: string }>({ status: "idle" });
  return (
    <div>
      <input type="hidden" name={name} value={state.id ?? ""} />
      <input
        ref={input}
        type="file"
        className="sr-only"
        accept={accept}
        aria-label={label}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setState({ status: "uploading", pct: 0, msg: file.name });
          try {
            const r = await uploadFile(file, params, (pct) => setState((s) => ({ ...s, pct })));
            setState({ status: "done", id: r.id, msg: `${file.name} uploaded` });
            onUploaded?.(r);
          } catch (err) {
            setState({ status: "error", msg: (err as Error).message });
          }
        }}
      />
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={buttonClass("outline", "sm")} onClick={() => input.current?.click()} disabled={state.status === "uploading"}>
          {state.status === "uploading" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : state.status === "done" ? <Check className="h-3.5 w-3.5 text-success" /> : <Upload className="h-3.5 w-3.5" />}
          {state.status === "done" ? "Replace file" : label}
        </button>
        {state.msg && (
          <span className={cn("text-xs", state.status === "error" ? "text-danger" : "text-muted")}>
            {state.msg}
            {state.status === "uploading" && ` · ${state.pct ?? 0}%`}
          </span>
        )}
      </div>
    </div>
  );
}
