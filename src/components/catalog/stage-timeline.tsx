import { Check } from "lucide-react";
import { InlineAction } from "@/components/ui/form";
import { setWorkflowStage } from "@/lib/actions/catalog";
import { cn } from "@/lib/utils";

export function StageTimeline({ trackId, stages, current }: { trackId: string; stages: string[]; current: string }) {
  const idx = Math.max(0, stages.indexOf(current));
  return (
    <ol className="flex flex-wrap items-center gap-y-3" aria-label="Track workflow">
      {stages.map((s, i) => (
        <li key={s} className="flex items-center">
          <InlineAction action={setWorkflowStage} fields={{ id: trackId, stage: s }} variant="ghost" size="sm" title={`Set stage: ${s}`} className="">
            <span
              className={cn(
                "flex items-center gap-1.5 text-xs",
                i < idx && "text-success",
                i === idx && "text-fg",
                i > idx && "text-faint",
              )}
            >
              <span
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full border text-[10px]",
                  i < idx && "border-success/60",
                  i === idx && "border-accent-strong bg-accent text-white",
                  i > idx && "border-line",
                )}
              >
                {i < idx ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              {s}
            </span>
          </InlineAction>
          {i < stages.length - 1 && <span className={cn("mx-0.5 h-px w-3", i < idx ? "bg-success/50" : "bg-line")} aria-hidden />}
        </li>
      ))}
    </ol>
  );
}
