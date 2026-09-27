import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { Trash2, X } from "lucide-react";
import { TaskForm } from "@/components/tasks/task-form";
import { ActionForm, ConfirmAction, InlineAction, SubmitButton, inputClass } from "@/components/ui/form";
import { Badge, Card, CardHeader, KeyValue, LinkButton, PageHeader, StatusBadge } from "@/components/ui/primitives";
import { addDependency, deleteTask, removeDependency } from "@/lib/actions/tasks";
import { requireUser } from "@/lib/auth";
import { OPEN_TASK_STATUSES, TASK_STATUSES } from "@/lib/constants";
import { loadContext } from "@/lib/context";
import { db } from "@/lib/db";
import { taskDependencies } from "@/lib/db/schema";
import { TASK_FIELDS, withOptions } from "@/lib/forms";
import { relationOptions } from "@/lib/task-options";
import { formatDateTime, titleCase } from "@/lib/utils";

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const ctx = await loadContext(user.id);
  const task = ctx.tasks.find((t) => t.id === id);
  if (!task) notFound();
  const deps = await db.select().from(taskDependencies).where(eq(taskDependencies.taskId, id));
  const dependents = await db.select().from(taskDependencies).where(eq(taskDependencies.dependsOnId, id));
  const byId = (x: string) => ctx.tasks.find((t) => t.id === x);
  const links = [
    task.releaseId && { label: "Release", href: `/releases/${task.releaseId}`, text: ctx.releases.find((r) => r.id === task.releaseId)?.title },
    task.trackId && { label: "Track", href: `/catalog/${task.trackId}`, text: ctx.tracks.find((r) => r.id === task.trackId)?.title },
    task.campaignId && { label: "Campaign", href: `/marketing/${task.campaignId}`, text: ctx.campaigns.find((r) => r.id === task.campaignId)?.name },
    task.projectId && { label: "Project", href: `/tasks/projects/${task.projectId}`, text: ctx.projects.find((r) => r.id === task.projectId)?.name },
    task.phaseKey && { label: "Phase", href: `/workflow/${task.phaseKey}`, text: titleCase(task.phaseKey) },
  ].filter(Boolean) as { label: string; href: string; text?: string }[];

  return (
    <div>
      <PageHeader
        eyebrow={<Link href="/tasks" className="hover:text-fg">Tasks</Link>}
        title={task.title}
        purpose={task.description ?? undefined}
        actions={
          <>
            <StatusBadge status={task.status} label={TASK_STATUSES.find((s) => s.value === task.status)?.label} />
            <ConfirmAction action={deleteTask} fields={{ id }} label="Delete" title="Delete this task?" message="The task is removed permanently. Consider “Cancelled” to keep it in the project history." confirmLabel="Delete" size="md" icon={<Trash2 className="h-4 w-4" />} />
          </>
        }
      />
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Task" />
          <TaskForm id={id} defs={withOptions(TASK_FIELDS, relationOptions(ctx))} values={task as unknown as Record<string, unknown>} />
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Connected to" />
            {links.length ? (
              <ul className="space-y-2 text-sm">{links.map((l) => <li key={l.label}><span className="text-faint">{l.label}: </span><Link href={l.href} className="hover:text-accent-strong">{l.text ?? "—"}</Link></li>)}</ul>
            ) : (
              <p className="text-sm text-muted">Not connected. Link it to a project, track, release or campaign.</p>
            )}
          </Card>
          <Card>
            <CardHeader title="Depends on" description="The task can’t be completed until these are done." />
            <ul className="mb-4 space-y-2">
              {deps.map((d) => {
                const t = byId(d.dependsOnId);
                return (
                  <li key={d.dependsOnId} className="flex items-center justify-between gap-2 text-sm">
                    <Link href={`/tasks/${d.dependsOnId}`} className={t && OPEN_TASK_STATUSES.includes(t.status) ? "hover:text-accent-strong" : "text-faint line-through"}>{t?.title ?? "Deleted task"}</Link>
                    <InlineAction action={removeDependency} fields={{ taskId: id, dependsOnId: d.dependsOnId }} size="icon" title="Remove dependency"><X className="h-3.5 w-3.5" /></InlineAction>
                  </li>
                );
              })}
              {!deps.length && <li className="text-sm text-muted">No dependencies.</li>}
            </ul>
            <ActionForm action={addDependency} className="flex gap-2">
              <input type="hidden" name="taskId" value={id} />
              <select name="dependsOnId" className={inputClass} aria-label="Add dependency">
                {ctx.tasks.filter((t) => t.id !== id && OPEN_TASK_STATUSES.includes(t.status) && !deps.some((d) => d.dependsOnId === t.id)).map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
              </select>
              <SubmitButton variant="outline">Add</SubmitButton>
            </ActionForm>
            {dependents.length > 0 && <p className="mt-4 text-xs text-faint">Blocking: {dependents.map((d) => byId(d.taskId)?.title).filter(Boolean).join(", ")}</p>}
          </Card>
          <Card>
            <CardHeader title="History" />
            <KeyValue
              items={[
                { label: "Created", value: formatDateTime(task.createdAt) },
                { label: "Updated", value: formatDateTime(task.updatedAt) },
                { label: "Completed", value: formatDateTime(task.completedAt) },
                { label: "Origin", value: <Badge>{task.source === "information" ? "Missing information" : task.source === "template" ? "Workflow template" : titleCase(task.source)}</Badge> },
              ]}
            />
            {task.notes && <p className="mt-4 whitespace-pre-line text-xs text-muted">{task.notes}</p>}
          </Card>
          <LinkButton href="/tasks" variant="ghost" size="sm">← All tasks</LinkButton>
        </div>
      </div>
    </div>
  );
}
