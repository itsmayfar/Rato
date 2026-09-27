import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowRight, Check, Circle } from "lucide-react";
import { TaskRow } from "@/components/tasks/task-row";
import { ConfirmAction, InlineAction } from "@/components/ui/form";
import { Card, CardHeader, EmptyState, LinkButton, Notice, PageHeader, Progress, StatusBadge } from "@/components/ui/primitives";
import { setPhaseStatusAction, startPhaseAction } from "@/lib/actions/workflow";
import { requireUser } from "@/lib/auth";
import { OPEN_TASK_STATUSES } from "@/lib/constants";
import { loadContext } from "@/lib/context";
import { formatDate, titleCase } from "@/lib/utils";
import { PHASES, getPhase, phaseStatus } from "@/lib/workflow/phases";

export default async function PhasePage({ params }: { params: Promise<{ phase: string }> }) {
  const user = await requireUser();
  const { phase: key } = await params;
  const phase = getPhase(key);
  if (!phase) notFound();
  const ctx = await loadContext(user.id);
  const ev = phase.evaluate(ctx);
  const status = phaseStatus(ctx, key);
  const state = ctx.phaseStates.find((s) => s.phaseKey === key);
  const tasks = ctx.tasks.filter((t) => t.phaseKey === key);
  const open = tasks.filter((t) => OPEN_TASK_STATUSES.includes(t.status));
  const projects = ctx.projects.filter((p) => p.phaseKey === key);
  const deps = phase.dependsOn.map((d) => getPhase(d)!).filter(Boolean);
  const prev = PHASES.find((p) => p.number === phase.number - 1);
  const next = PHASES.find((p) => p.number === phase.number + 1);

  return (
    <div>
      <PageHeader
        eyebrow={<Link href="/workflow" className="hover:text-fg">Phase {phase.number} of 10</Link>}
        title={phase.title}
        purpose={phase.description}
        actions={
          <>
            <StatusBadge status={status} />
            {status === "not_started" || status === "paused" ? (
              <InlineAction action={startPhaseAction} fields={{ phase: key }} variant="primary" size="md">{status === "paused" ? "Resume phase" : "Start phase"}</InlineAction>
            ) : status === "active" ? (
              <>
                <InlineAction action={setPhaseStatusAction} fields={{ phase: key, status: "paused" }} variant="ghost" size="md">Pause</InlineAction>
                {ev.criteriaMet ? (
                  <InlineAction action={setPhaseStatusAction} fields={{ phase: key, status: "completed" }} variant="primary" size="md">Mark complete</InlineAction>
                ) : (
                  <ConfirmAction action={setPhaseStatusAction} fields={{ phase: key, status: "completed", override: "yes" }} label="Close anyway" title="Close this phase with open checks?" message="The completion criteria are not met. Closing keeps all tasks and information; you can reopen the phase at any time." confirmLabel="Close phase" variant="outline" size="md" />
                )}
              </>
            ) : (
              <InlineAction action={setPhaseStatusAction} fields={{ phase: key, status: "active" }} variant="outline" size="md">Reopen</InlineAction>
            )}
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card className={ev.criteriaMet ? "border-success/40" : "border-accent/40"}>
            <CardHeader title="Next action" />
            {ev.criteriaMet ? (
              <p className="flex items-center gap-2 text-sm text-success"><Check className="h-4 w-4" /> Completion criteria met. {status !== "completed" && "You can mark the phase complete."}</p>
            ) : ev.nextAction ? (
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="text-sm">{ev.nextAction.label}</div>
                  <p className="mt-0.5 text-xs text-muted">{ev.nextAction.why}</p>
                </div>
                <LinkButton href={ev.nextAction.href} variant="primary">Go <ArrowRight className="h-4 w-4" /></LinkButton>
              </div>
            ) : null}
          </Card>
          <Card>
            <CardHeader title="Progress & checks" description={ev.scope} />
            <Progress value={ev.progress} tone={ev.criteriaMet ? "success" : "accent"} className="mb-4" />
            <ul className="divide-y divide-line">
              {ev.checks.map((c) => (
                <li key={c.label} className="flex items-start gap-3 py-2.5">
                  {c.done ? <Check className="mt-0.5 h-4 w-4 text-success" /> : <Circle className="mt-0.5 h-4 w-4 text-faint" />}
                  <div className="min-w-0 flex-1">
                    <div className={c.done ? "text-sm text-muted" : "text-sm"}>{c.label} {!c.required && <span className="text-[11px] text-faint">(optional)</span>}</div>
                    {c.detail && !c.done && <p className="text-xs text-faint">{c.detail}</p>}
                  </div>
                  {!c.done && c.href && <Link href={c.href} className="shrink-0 text-xs text-accent-strong hover:underline">Resolve →</Link>}
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardHeader title={`Tasks (${open.length} open)`} action={<LinkButton href={`/tasks/new?phase=${key}`} size="sm" variant="ghost">Add task</LinkButton>} />
            {tasks.length ? (
              <div className="divide-y divide-line">{[...open, ...tasks.filter((t) => !OPEN_TASK_STATUSES.includes(t.status))].slice(0, 30).map((t) => <TaskRow key={t.id} task={t} today={ctx.today} />)}</div>
            ) : (
              <EmptyState compact title="No tasks in this phase yet." description={status === "not_started" ? "Starting the phase creates its template tasks." : undefined} />
            )}
          </Card>
        </div>
        <div className="space-y-6">
          {ev.blockers.length > 0 && (
            <Card>
              <CardHeader title="Blockers" icon={<AlertTriangle className="h-4 w-4" />} />
              <ul className="space-y-1.5 text-xs text-muted">{ev.blockers.map((b) => <li key={b}>• {b}</li>)}</ul>
            </Card>
          )}
          <Card>
            <CardHeader title="Objective" />
            <p className="text-sm text-muted">{phase.objective}</p>
            <h3 className="mb-1 mt-4 text-[11px] uppercase tracking-[0.14em] text-faint">Completion criteria</h3>
            <p className="text-sm text-muted">{phase.completionCriteria}</p>
          </Card>
          <Card>
            <CardHeader title="Information" />
            <h3 className="mb-1 text-[11px] uppercase tracking-[0.14em] text-faint">Required</h3>
            <ul className="mb-3 space-y-1 text-sm">{phase.requiredInfo.map((i) => <li key={i}>• {i}</li>)}</ul>
            <h3 className="mb-1 text-[11px] uppercase tracking-[0.14em] text-faint">Optional</h3>
            <ul className="space-y-1 text-sm text-muted">{phase.optionalInfo.map((i) => <li key={i}>• {i}</li>)}</ul>
          </Card>
          <Card>
            <CardHeader title="Dependencies" />
            {deps.length ? (
              <ul className="space-y-1.5 text-sm">{deps.map((d) => <li key={d.key} className="flex justify-between gap-2"><Link href={d.href} className="hover:text-accent-strong">{d.number}. {d.title}</Link><StatusBadge status={phaseStatus(ctx, d.key)} /></li>)}</ul>
            ) : (
              <p className="text-sm text-muted">None — this is where the business starts.</p>
            )}
            <p className="mt-3 text-[11px] text-faint">Dependencies are guidance, not locks: phases can run in parallel.</p>
          </Card>
          {projects.length > 0 && (
            <Card>
              <CardHeader title="Projects" />
              <ul className="space-y-1.5 text-sm">{projects.map((p) => <li key={p.id}><Link href={`/tasks/projects/${p.id}`} className="hover:text-accent-strong">{p.name}</Link></li>)}</ul>
            </Card>
          )}
          {state && (
            <Notice>
              {state.startedAt && `Started ${formatDate(state.startedAt.toISOString())}. `}
              {state.completedAt && `Completed ${formatDate(state.completedAt.toISOString())}.`}
              {!state.startedAt && `Status: ${titleCase(state.status)}.`}
            </Notice>
          )}
          <div className="flex justify-between text-xs">
            {prev ? <Link href={prev.href} className="text-muted hover:text-fg">← {prev.title}</Link> : <span />}
            {next && <Link href={next.href} className="text-muted hover:text-fg">{next.title} →</Link>}
          </div>
        </div>
      </div>
    </div>
  );
}
