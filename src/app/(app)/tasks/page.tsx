import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckSquare, Plus } from "lucide-react";
import { TaskRow } from "@/components/tasks/task-row";
import { Calendar, type CalEvent } from "@/components/ui/calendar";
import { InlineAction, filterClass, inputClass } from "@/components/ui/form";
import { Badge, EmptyState, LinkButton, LinkTabs, PageHeader } from "@/components/ui/primitives";
import { setTaskStatus } from "@/lib/actions/tasks";
import { requireUser } from "@/lib/auth";
import { OPEN_TASK_STATUSES, PRIORITIES, PRIORITY_RANK, TASK_STATUSES } from "@/lib/constants";
import { loadContext } from "@/lib/context";
import { PHASE_OPTIONS } from "@/lib/forms";
import { syncInformationTasks } from "@/lib/tasks/generate";
import type { Task } from "@/lib/types";
import { addDays, cn, daysBetween, formatDate } from "@/lib/utils";

export const metadata = { title: "Tasks & Projects" };

type SP = { view?: string; filter?: string; phase?: string; project?: string; release?: string; priority?: string; group?: string; q?: string; date?: string; cal?: string };

const KANBAN = ["backlog", "planned", "in_progress", "waiting_info", "waiting_approval", "blocked", "completed"];

export default async function TasksPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser();
  await syncInformationTasks(user.id);
  const ctx = await loadContext(user.id);
  const sp = await searchParams;
  const view = ["list", "kanban", "calendar", "timeline"].includes(sp.view ?? "") ? sp.view! : "list";
  const q = (sp.q ?? "").toLowerCase();
  const filter = sp.filter ?? "open";

  let list = ctx.tasks.filter((t) => {
    if (q && !`${t.title} ${t.description ?? ""}`.toLowerCase().includes(q)) return false;
    if (sp.phase && t.phaseKey !== sp.phase) return false;
    if (sp.project && t.projectId !== sp.project) return false;
    if (sp.release && t.releaseId !== sp.release) return false;
    if (sp.priority && t.priority !== sp.priority) return false;
    if (filter === "open" && view !== "kanban") return OPEN_TASK_STATUSES.includes(t.status);
    if (filter === "overdue") return OPEN_TASK_STATUSES.includes(t.status) && Boolean(t.dueDate && t.dueDate < ctx.today);
    if (filter === "mine") return OPEN_TASK_STATUSES.includes(t.status) && (!t.assignee || t.assignee.toLowerCase() === user.name.toLowerCase() || t.assignee.toLowerCase() === "me");
    if (filter === "completed") return t.status === "completed" || t.status === "cancelled";
    return true;
  });
  list = [...list].sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") || (PRIORITY_RANK[b.priority] ?? 0) - (PRIORITY_RANK[a.priority] ?? 0));

  const qs = (over: Partial<SP>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...over })) if (v) p.set(k, v);
    return `/tasks?${p.toString()}`;
  };
  const ctxLabel = (t: Task) =>
    [
      t.releaseId && ctx.releases.find((r) => r.id === t.releaseId)?.title,
      t.trackId && ctx.tracks.find((r) => r.id === t.trackId)?.title,
      t.campaignId && ctx.campaigns.find((r) => r.id === t.campaignId)?.name,
      t.projectId && ctx.projects.find((r) => r.id === t.projectId)?.name,
      t.phaseKey && PHASE_OPTIONS.find((p) => p.value === t.phaseKey)?.label,
    ]
      .filter((x, i, arr): x is string => Boolean(x) && arr.indexOf(x) === i)
      .join(" · ");

  const groupBy = sp.group ?? "none";
  const groupName = (t: Task) =>
    groupBy === "phase" ? (PHASE_OPTIONS.find((p) => p.value === t.phaseKey)?.label ?? "No phase")
    : groupBy === "project" ? (ctx.projects.find((p) => p.id === t.projectId)?.name ?? "No project")
    : groupBy === "release" ? (ctx.releases.find((p) => p.id === t.releaseId)?.title ?? "No release")
    : groupBy === "priority" ? (PRIORITIES.find((p) => p.value === t.priority)?.label ?? t.priority)
    : "";
  const groups = Array.from(new Set(list.map(groupName))).map((g) => ({ g, items: list.filter((t) => groupName(t) === g) }));

  return (
    <div>
      <PageHeader
        eyebrow="Tasks & Projects"
        title="Tasks"
        purpose="Every task has a purpose, a status and a link to a project, track, release, campaign or phase. Generated tasks never complete themselves unless the underlying data verifies it."
        actions={
          <>
            <LinkButton href="/tasks/projects" variant="outline">Projects</LinkButton>
            <LinkButton href="/tasks/new" variant="primary"><Plus className="h-4 w-4" /> New task</LinkButton>
          </>
        }
      />
      <LinkTabs
        active={view}
        tabs={[
          { key: "list", label: "List", href: qs({ view: "list" }) },
          { key: "kanban", label: "Board", href: qs({ view: "kanban" }) },
          { key: "calendar", label: "Calendar", href: qs({ view: "calendar" }) },
          { key: "timeline", label: "Timeline", href: qs({ view: "timeline" }) },
        ]}
      />
      <form className="mb-5 flex flex-wrap gap-2" role="search">
        <input type="hidden" name="view" value={view} />
        <input name="q" defaultValue={sp.q} placeholder="Search tasks" className={cn(filterClass, "w-48")} aria-label="Search tasks" />
        <select name="filter" defaultValue={filter} className={filterClass} aria-label="Filter">
          <option value="open">Open tasks</option>
          <option value="mine">My tasks</option>
          <option value="overdue">Overdue</option>
          <option value="completed">Completed / cancelled</option>
          <option value="all">All</option>
        </select>
        <select name="phase" defaultValue={sp.phase ?? ""} className={filterClass} aria-label="Phase">
          <option value="">All phases</option>
          {PHASE_OPTIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
        <select name="project" defaultValue={sp.project ?? ""} className={filterClass} aria-label="Project">
          <option value="">All projects</option>
          {ctx.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select name="release" defaultValue={sp.release ?? ""} className={filterClass} aria-label="Release">
          <option value="">All releases</option>
          {ctx.releases.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>
        <select name="priority" defaultValue={sp.priority ?? ""} className={filterClass} aria-label="Priority">
          <option value="">Any priority</option>
          {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
        {view === "list" && (
          <select name="group" defaultValue={groupBy} className={filterClass} aria-label="Group by">
            <option value="none">No grouping</option>
            <option value="phase">By phase</option>
            <option value="project">By project</option>
            <option value="release">By release</option>
            <option value="priority">By priority</option>
          </select>
        )}
        <button type="submit" className="rounded-md border border-line px-3 text-sm text-muted hover:text-fg">Apply</button>
      </form>

      {!ctx.tasks.length ? (
        <EmptyState icon={<CheckSquare className="h-8 w-8" />} title="No tasks yet." description="Tasks are created from phases, tracks, releases, campaigns and missing information — or add your own." action={<LinkButton href="/tasks/new" variant="primary">Add task</LinkButton>} />
      ) : view === "list" ? (
        list.length ? (
          groups.map(({ g, items }) => (
            <section key={g} className="mb-6">
              {g && <h2 className="mb-1 text-xs uppercase tracking-[0.16em] text-muted">{g} <span className="text-faint">· {items.length}</span></h2>}
              <div className="divide-y divide-line rounded-lg border border-line bg-surface px-4">
                {items.map((t) => <TaskRow key={t.id} task={t} today={ctx.today} context={ctxLabel(t)} />)}
              </div>
            </section>
          ))
        ) : (
          <EmptyState compact title="No tasks match." />
        )
      ) : view === "kanban" ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {KANBAN.map((status, idx) => {
            const col = list.filter((t) => t.status === status);
            const label = TASK_STATUSES.find((s) => s.value === status)!.label;
            return (
              <section key={status} className="w-72 shrink-0" aria-label={label}>
                <h2 className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.14em] text-muted">{label} <Badge>{col.length}</Badge></h2>
                <ul className="space-y-2">
                  {col.slice(0, 40).map((t) => (
                    <li key={t.id} className="rounded-md border border-line bg-surface p-3">
                      <Link href={`/tasks/${t.id}`} className="block text-sm hover:text-accent-strong">{t.title}</Link>
                      <div className="mt-1 text-[11px] text-faint">{[t.dueDate && `Due ${formatDate(t.dueDate)}`, ctxLabel(t)].filter(Boolean).join(" · ")}</div>
                      <div className="mt-2 flex justify-between">
                        {idx > 0 ? <InlineAction action={setTaskStatus} fields={{ id: t.id, status: KANBAN[idx - 1] }} size="icon" title={`Move to ${KANBAN[idx - 1]}`}><ArrowLeft className="h-3.5 w-3.5" /></InlineAction> : <span />}
                        {idx < KANBAN.length - 1 && <InlineAction action={setTaskStatus} fields={{ id: t.id, status: KANBAN[idx + 1] }} size="icon" title={`Move to ${KANBAN[idx + 1]}`}><ArrowRight className="h-3.5 w-3.5" /></InlineAction>}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      ) : view === "calendar" ? (
        <Calendar
          events={list.filter((t) => t.dueDate).map<CalEvent>((t) => ({ date: t.dueDate!, label: t.title, href: `/tasks/${t.id}`, tone: t.status === "completed" ? "success" : t.dueDate! < ctx.today && OPEN_TASK_STATUSES.includes(t.status) ? "danger" : t.priority === "urgent" || t.priority === "high" ? "warning" : "accent" }))}
          view={sp.cal === "week" ? "week" : sp.cal === "list" ? "list" : "month"}
          anchor={sp.date ?? ctx.today}
          today={ctx.today}
          basePath="/tasks"
          params={{ view: "calendar", filter }}
          viewParam="cal"
        />
      ) : (
        <Timeline tasks={list.filter((t) => t.dueDate || t.startDate)} today={ctx.today} label={ctxLabel} />
      )}
    </div>
  );
}

function Timeline({ tasks, today, label }: { tasks: Task[]; today: string; label: (t: Task) => string }) {
  const start = addDays(today, -7);
  const days = 56;
  const pct = (d: string) => Math.max(0, Math.min(100, (daysBetween(start, d) / days) * 100));
  const weeks = Array.from({ length: days / 7 }, (_, i) => addDays(start, i * 7));
  if (!tasks.length) return <EmptyState compact title="No tasks with dates in this range." description="Give tasks a start and due date to see them on the timeline." />;
  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <div className="min-w-[900px]">
        <div className="grid grid-cols-[260px_1fr] border-b border-line bg-surface-2 text-[11px] text-faint">
          <div className="px-3 py-2 uppercase tracking-[0.14em]">Task</div>
          <div className="relative">
            {weeks.map((w) => <span key={w} className="absolute top-2" style={{ left: `${pct(w)}%` }}>{formatDate(w)}</span>)}
          </div>
        </div>
        {tasks.slice(0, 80).map((t) => {
          const s = t.startDate ?? addDays(t.dueDate!, -1);
          const e = t.dueDate ?? addDays(t.startDate!, 1);
          const left = pct(s < start ? start : s);
          const width = Math.max(1.2, pct(e) - left);
          const overdue = OPEN_TASK_STATUSES.includes(t.status) && t.dueDate && t.dueDate < today;
          return (
            <div key={t.id} className="grid grid-cols-[260px_1fr] border-b border-line last:border-0">
              <div className="truncate px-3 py-2 text-sm">
                <Link href={`/tasks/${t.id}`} className="hover:text-accent-strong">{t.title}</Link>
                <div className="truncate text-[11px] text-faint">{label(t)}</div>
              </div>
              <div className="relative">
                <span className="absolute inset-y-0 w-px bg-accent-strong/60" style={{ left: `${pct(today)}%` }} aria-hidden />
                <span
                  className={cn("absolute top-1/2 h-2.5 -translate-y-1/2 rounded-full", t.status === "completed" ? "bg-success/70" : overdue ? "bg-danger" : "bg-accent")}
                  style={{ left: `${left}%`, width: `${width}%` }}
                  title={`${formatDate(s)} → ${formatDate(e)}`}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
