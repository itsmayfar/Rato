"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, ChevronDown, Info } from "lucide-react";
import { FieldInput, FormMessage, Modal, SubmitButton } from "@/components/ui/form";
import { Badge, buttonClass } from "@/components/ui/primitives";
import { answerQuestions } from "@/lib/actions/info";
import type { ActionState } from "@/lib/action-state";
import { displayValue, parseFieldValue, type FieldDef } from "@/lib/fields";
import { cn, toneFor } from "@/lib/utils";

export type QuestionItem = {
  name: string; // entity__id__key
  entityType: string;
  entityLabel: string;
  key: string;
  def: FieldDef;
  value: unknown;
  status: "complete" | "missing" | "needs_confirmation" | "invalid" | "outdated" | "not_applicable";
  message?: string;
  required: boolean;
  group: string;
  groupTitle: string;
  groupDescription?: string;
};

export type DerivedCheck = { label: string; status: QuestionItem["status"]; href: string; message?: string; entityLabel: string; why?: string };

const STATUS_TEXT: Record<QuestionItem["status"], string> = {
  complete: "Saved",
  missing: "Missing",
  needs_confirmation: "Needs confirmation",
  invalid: "Invalid",
  outdated: "Outdated",
  not_applicable: "Not applicable",
};

const ErrorsFromState = ({ state, name }: { state: ActionState; name: string }) =>
  state.errors?.[name] ? <p className="mt-1 text-xs text-danger">{state.errors[name]}</p> : null;

/**
 * Asks only for what is missing (by default), explains why it matters,
 * lets optional questions be skipped or marked not applicable, and shows a
 * confirmation summary before important (legal/financial) changes are applied.
 */
export function QuestionFlow({
  items,
  derived = [],
  submitLabel = "Save answers",
  next,
  skipAction,
  intro,
  showEntity,
  extraHidden,
  initiallyShowAll,
}: {
  items: QuestionItem[];
  derived?: DerivedCheck[];
  submitLabel?: string;
  next?: string;
  skipAction?: React.ReactNode;
  intro?: React.ReactNode;
  showEntity?: boolean;
  extraHidden?: Record<string, string>;
  initiallyShowAll?: boolean;
}) {
  const [state, formAction] = useActionState(answerQuestions, {} as ActionState);
  const [showAll, setShowAll] = useState(Boolean(initiallyShowAll));
  const [review, setReview] = useState<{ label: string; from: string; to: string }[] | null>(null);
  const approved = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);

  const open = items.filter((i) => i.status !== "complete" && i.status !== "not_applicable");
  const visible = (i: QuestionItem) => showAll || (i.status !== "complete" && i.status !== "not_applicable");

  const groups = useMemo(() => {
    const map = new Map<string, { title: string; description?: string; items: QuestionItem[] }>();
    for (const i of items) {
      const gk = showEntity ? `${i.entityLabel}|${i.group}` : i.group;
      if (!map.has(gk))
        map.set(gk, { title: showEntity ? `${i.groupTitle} — ${i.entityLabel}` : i.groupTitle, description: i.groupDescription, items: [] });
      map.get(gk)!.items.push(i);
    }
    return Array.from(map.values());
  }, [items, showEntity]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (approved.current) {
      approved.current = false;
      return;
    }
    const fd = new FormData(e.currentTarget);
    const changes: { label: string; from: string; to: string }[] = [];
    for (const i of items) {
      if (!i.def.important) continue;
      const field = `f__${i.name}`;
      if (fd.get(`na__${i.name}`) === "on") {
        changes.push({ label: i.def.label, from: displayValue(i.def, i.value), to: "Not applicable" });
        continue;
      }
      if (!fd.has(field)) continue;
      const raw = i.def.type === "multiselect" ? fd.getAll(field).map(String) : String(fd.get(field) ?? "");
      const parsed = parseFieldValue({ ...i.def, required: false }, raw);
      if (!parsed.ok) continue; // server will report the error
      const before = displayValue(i.def, i.value);
      const after = displayValue(i.def, parsed.value);
      if (before !== after) changes.push({ label: i.def.label, from: before, to: after });
    }
    if (changes.length) {
      e.preventDefault();
      setReview(changes);
    }
  }

  if (!items.length && !derived.length) return null;

  return (
    <div>
      {intro}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {open.length ? (
            <>
              <span className="text-fg">{open.filter((i) => i.required).length}</span> required question{open.filter((i) => i.required).length === 1 ? "" : "s"} open
              {open.some((i) => !i.required) && <> · {open.filter((i) => !i.required).length} optional</>}
              {items.length - open.length > 0 && <> · {items.length - open.length} already saved and reused</>}.
            </>
          ) : (
            <span className="flex items-center gap-2 text-success">
              <Check className="h-4 w-4" /> Everything in this section is answered.
            </span>
          )}
        </p>
        {items.length > open.length && (
          <button type="button" onClick={() => setShowAll((v) => !v)} className={buttonClass("ghost", "sm")}>
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showAll && "rotate-180")} />
            {showAll ? "Show only open questions" : "Show saved answers too"}
          </button>
        )}
      </div>

      <form ref={formRef} action={formAction} onSubmit={onSubmit} noValidate>
        {next && <input type="hidden" name="__next" value={next} />}
        {extraHidden && Object.entries(extraHidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        <div className="space-y-8">
          {groups.map((g) => {
            const anyVisible = g.items.some(visible);
            if (!anyVisible) return null;
            return (
              <fieldset key={g.title} className="rounded-lg border border-line bg-surface p-5">
                <legend className="px-2 text-xs uppercase tracking-[0.16em] text-muted">{g.title}</legend>
                {g.description && <p className="-mt-1 mb-4 text-sm text-faint">{g.description}</p>}
                <div className="grid grid-cols-1 gap-x-6 gap-y-6 md:grid-cols-2">
                  {g.items.map((i) => (
                    <div
                      key={i.name}
                      className={cn(
                        "min-w-0",
                        !visible(i) && "hidden",
                        (i.def.type === "textarea" || i.def.type === "multiselect") && "md:col-span-2",
                      )}
                    >
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <Badge tone={toneFor(i.status)}>{STATUS_TEXT[i.status]}</Badge>
                        {i.def.important && <Badge tone="warning">Confirm before saving</Badge>}
                      </div>
                      <FieldInput def={{ ...i.def, required: i.required }} value={i.value} name={`f__${i.name}`} />
                      <ErrorsFromState state={state} name={`f__${i.name}`} />
                      {i.def.why && (
                        <p className="mt-1.5 flex items-start gap-1.5 text-xs text-faint">
                          <Info className="mt-0.5 h-3 w-3 shrink-0" /> {i.def.why}
                        </p>
                      )}
                      {i.message && <p className="mt-1 text-xs text-warning">{i.message}</p>}
                      <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted">
                        {!i.required && i.status !== "complete" && (
                          <label className="flex cursor-pointer items-center gap-1.5">
                            <input type="checkbox" name={`na__${i.name}`} className="accent-[var(--accent)]" defaultChecked={i.status === "not_applicable"} />
                            Not applicable
                          </label>
                        )}
                        {(i.status === "needs_confirmation" || i.status === "outdated") && (
                          <label className="flex cursor-pointer items-center gap-1.5">
                            <input type="checkbox" name={`confirm__${i.name}`} className="accent-[var(--accent)]" />
                            Current value is still correct
                          </label>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </fieldset>
            );
          })}
        </div>

        {derived.length > 0 && (
          <div className="mt-8 rounded-lg border border-line bg-surface p-5">
            <h3 className="mb-3 text-xs uppercase tracking-[0.16em] text-muted">Also required — completed elsewhere</h3>
            <ul className="divide-y divide-line">
              {derived.map((d) => (
                <li key={`${d.entityLabel}-${d.label}`} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <Badge tone={toneFor(d.status)}>{STATUS_TEXT[d.status]}</Badge>
                      <span>{d.label}</span>
                      {showEntity && <span className="text-faint">· {d.entityLabel}</span>}
                    </div>
                    {(d.message || d.why) && <p className="mt-0.5 text-xs text-faint">{d.message ?? d.why}</p>}
                  </div>
                  {d.status !== "complete" && d.status !== "not_applicable" && (
                    <Link href={d.href} className={buttonClass("outline", "sm")}>
                      Resolve <ArrowRight className="h-3 w-3" />
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          {items.length > 0 && <SubmitButton>{submitLabel}</SubmitButton>}
          {skipAction}
        </div>
        <FormMessage state={state} />
      </form>

      <Modal open={Boolean(review)} onClose={() => setReview(null)} title="Confirm important changes">
        <p className="text-sm text-muted">These fields affect legal or financial records. Please check them before they are saved.</p>
        <ul className="mt-4 space-y-3">
          {review?.map((c) => (
            <li key={c.label} className="rounded-md border border-line bg-surface-2 p-3 text-sm">
              <div className="text-xs uppercase tracking-[0.12em] text-faint">{c.label}</div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="text-muted line-through decoration-faint">{c.from}</span>
                <ArrowRight className="h-3 w-3 text-faint" />
                <span className="text-fg">{c.to}</span>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className={buttonClass("ghost")} onClick={() => setReview(null)}>
            Go back
          </button>
          <button
            type="button"
            className={buttonClass("primary")}
            onClick={() => {
              setReview(null);
              approved.current = true;
              formRef.current?.requestSubmit();
            }}
          >
            Apply changes
          </button>
        </div>
      </Modal>
    </div>
  );
}
