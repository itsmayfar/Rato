import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { Card, PageHeader, Progress, StatusBadge } from "@/components/ui/primitives";
import { requireUser } from "@/lib/auth";
import { loadContext } from "@/lib/context";
import { cn } from "@/lib/utils";
import { PHASES, phaseStatus, recommendedPhase } from "@/lib/workflow/phases";

export const metadata = { title: "Workflow Phases" };

export default async function WorkflowPage() {
  const user = await requireUser();
  const ctx = await loadContext(user.id);
  const rec = recommendedPhase(ctx);
  return (
    <div>
      <PageHeader
        eyebrow="Workflow Phases"
        title="The ten phases of the business"
        purpose="Each phase has required information, tasks, dependencies and completion criteria. Work on several phases in parallel — the system shows what’s done, what blocks progress, and the next action."
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {PHASES.map((p) => {
          const ev = p.evaluate(ctx);
          const status = phaseStatus(ctx, p.key);
          return (
            <Link key={p.key} href={p.href} className="group">
              <Card className={cn("h-full transition-colors group-hover:border-line-strong", p.key === rec.key && "border-accent/60")}>
                <div className="flex items-center justify-between">
                  <span className="text-xs tracking-[0.2em] text-accent-strong">PHASE {String(p.number).padStart(2, "0")}</span>
                  <span className="flex items-center gap-2">
                    {p.key === rec.key && <span className="text-[10px] uppercase tracking-[0.14em] text-accent-strong">Recommended</span>}
                    <StatusBadge status={status} />
                  </span>
                </div>
                <h2 className="mt-2 text-lg font-extralight">{p.title}</h2>
                <p className="mt-1 text-xs leading-relaxed text-muted">{p.objective}</p>
                <div className="mt-4 flex items-center gap-3">
                  <Progress value={ev.progress} tone={ev.criteriaMet ? "success" : "accent"} />
                  <span className="text-xs text-muted">{ev.progress}%</span>
                </div>
                <p className="mt-3 text-[11px] text-faint">{ev.scope}</p>
                <div className="mt-3 flex items-center gap-1.5 text-xs text-fg">
                  {ev.criteriaMet ? <><Check className="h-3.5 w-3.5 text-success" /> Completion criteria met</> : <><ArrowRight className="h-3.5 w-3.5 text-accent-strong" /> {ev.nextAction?.label}</>}
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
