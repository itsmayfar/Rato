import Link from "next/link";
import { Check, Circle, Minus, ShieldCheck } from "lucide-react";
import { ConfirmAction, InlineAction } from "@/components/ui/form";
import { Badge } from "@/components/ui/primitives";
import { setChecklistStatus } from "@/lib/actions/releases";
import type { EffectiveItem } from "@/lib/releases/checklist";
import { cn, daysBetween, formatDate } from "@/lib/utils";

export function ChecklistView({ items, resolveHref, today }: { items: EffectiveItem[]; resolveHref: (key: string) => string; today: string }) {
  return (
    <ul className="divide-y divide-line">
      {items.map((i) => {
        const done = i.effectiveStatus === "done";
        const na = i.effectiveStatus === "not_applicable";
        const d = i.dueDate ? daysBetween(today, i.dueDate) : null;
        return (
          <li key={i.id} className="flex flex-col gap-3 py-3 md:flex-row md:items-center">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <span className="mt-0.5">
                {done ? <Check className="h-4 w-4 text-success" /> : na ? <Minus className="h-4 w-4 text-faint" /> : <Circle className={cn("h-4 w-4", i.overdue ? "text-danger" : "text-faint")} />}
              </span>
              <div className="min-w-0">
                <div className={cn("flex flex-wrap items-center gap-2 text-sm", (done || na) && "text-muted", na && "line-through")}>
                  {i.label}
                  {!i.required && <Badge tone="inactive">optional</Badge>}
                  {i.auto && <Badge tone={done ? "success" : "neutral"}><ShieldCheck className="h-3 w-3" /> {done ? "verified from data" : "auto-verified"}</Badge>}
                  {i.external && <Badge tone="info">external action</Badge>}
                </div>
                {i.description && <p className="mt-0.5 text-xs text-faint">{i.description}</p>}
                {i.confirmedAt && done && !i.auto && <p className="mt-0.5 text-[11px] text-success">Confirmed {formatDate(i.confirmedAt.toISOString())}</p>}
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2 pl-7 md:pl-0">
              {i.dueDate && !done && !na && (
                <span className={cn("text-xs", i.overdue ? "text-danger" : d !== null && d <= 7 ? "text-warning" : "text-faint")}>
                  {i.overdue ? `Overdue (${formatDate(i.dueDate)})` : `Due ${formatDate(i.dueDate)}`}
                </span>
              )}
              {i.auto && !done && !na && (
                <Link href={resolveHref(i.key)} className="text-xs text-accent-strong hover:underline">Resolve →</Link>
              )}
              {!i.auto && !done && !na &&
                (i.external ? (
                  <ConfirmAction
                    action={setChecklistStatus}
                    fields={{ id: i.id, status: "done" }}
                    label="Confirm done"
                    title={`Confirm: ${i.label}`}
                    message="This step happens outside the app. Confirm only if you have actually completed it — the system never marks external actions complete on its own."
                    confirmLabel="Yes, it’s done"
                    variant="outline"
                  />
                ) : (
                  <InlineAction action={setChecklistStatus} fields={{ id: i.id, status: "done" }} variant="outline">Mark done</InlineAction>
                ))}
              {(done && !i.auto) || na ? (
                <InlineAction action={setChecklistStatus} fields={{ id: i.id, status: "pending" }}>Reopen</InlineAction>
              ) : null}
              {!done && !na && (
                <InlineAction action={setChecklistStatus} fields={{ id: i.id, status: "not_applicable" }} title="Not applicable">N/A</InlineAction>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
