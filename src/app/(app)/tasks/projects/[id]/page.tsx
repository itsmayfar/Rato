import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { Check, Plus, Trash2 } from "lucide-react";
import { TaskRow } from "@/components/tasks/task-row";
import { ConfirmAction, InlineAction } from "@/components/ui/form";
import { EntityForm } from "@/components/ui/entity-form";
import { Card, CardHeader, EmptyState, KeyValue, LinkButton, PageHeader, Progress, StatusBadge } from "@/components/ui/primitives";
import { addMilestone, deleteProject, saveProject, toggleMilestone } from "@/lib/actions/tasks";
import { requireUser } from "@/lib/auth";
import { loadContext } from "@/lib/context";
import { db } from "@/lib/db";
import { milestones } from "@/lib/db/schema";
import { profitability } from "@/lib/finance";
import { MILESTONE_FIELDS, PROJECT_FIELDS, withOptions } from "@/lib/forms";
import { relationOptions } from "@/lib/task-options";
import { formatDate, formatMoney } from "@/lib/utils";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const ctx = await loadContext(user.id);
  const p = ctx.projects.find((x) => x.id === id);
  if (!p) notFound();
  const release = ctx.releases.find((r) => r.projectId === id);
  const tasks = ctx.tasks.filter((t) => t.projectId === id || (release && t.releaseId === release.id));
  const ms = await db.select().from(milestones).where(eq(milestones.projectId, id)).orderBy(milestones.dueDate);
  const fin = profitability(ctx.transactions, ctx.settings.currency, "projectId", id);
  const done = tasks.filter((t) => t.status === "completed").length;
  return (
    <div>
      <PageHeader
        eyebrow={<Link href="/tasks/projects" className="hover:text-fg">Projects</Link>}
        title={p.name}
        purpose={p.description ?? undefined}
        actions={
          <>
            <StatusBadge status={p.status} />
            {release && <LinkButton href={`/releases/${release.id}`} variant="outline">Open release</LinkButton>}
            <LinkButton href={`/tasks/new?project=${id}`} variant="primary"><Plus className="h-4 w-4" /> Add task</LinkButton>
            <ConfirmAction action={deleteProject} fields={{ id }} label="Delete" title="Delete this project?" message="Tasks stay but are no longer grouped under this project." size="md" icon={<Trash2 className="h-4 w-4" />} />
          </>
        }
      />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader title="Tasks" description={`${done}/${tasks.length} completed — completed tasks remain in the project history.`} />
            <Progress value={done} max={Math.max(1, tasks.length)} className="mb-3" />
            {tasks.length ? <div className="divide-y divide-line">{tasks.map((t) => <TaskRow key={t.id} task={t} today={ctx.today} />)}</div> : <EmptyState compact title="No tasks in this project." />}
          </Card>
          <Card>
            <CardHeader title="Project details" />
            <EntityForm action={saveProject} defs={withOptions(PROJECT_FIELDS, { goalId: relationOptions(ctx).goalId })} values={p as unknown as Record<string, unknown>} hidden={{ id }} />
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Milestones" />
            <ul className="mb-4 space-y-2">
              {ms.map((m) => (
                <li key={m.id} className="flex items-center gap-2 text-sm">
                  <InlineAction action={toggleMilestone} fields={{ id: m.id }} size="icon" title="Toggle">{m.done ? <Check className="h-4 w-4 text-success" /> : <span className="h-3.5 w-3.5 rounded-full border border-faint" />}</InlineAction>
                  <span className={m.done ? "text-faint line-through" : ""}>{m.title}</span>
                  <span className="ml-auto text-xs text-faint">{formatDate(m.dueDate)}</span>
                </li>
              ))}
              {!ms.length && <li className="text-sm text-muted">No milestones.</li>}
            </ul>
            <EntityForm action={addMilestone} defs={MILESTONE_FIELDS} hidden={{ projectId: id }} columns={1} submitLabel="Add milestone" resetOnSuccess />
          </Card>
          <Card>
            <CardHeader title="Budget & spending" description="Actual records linked to this project" />
            <KeyValue items={[{ label: "Budget", value: formatMoney(p.budget, ctx.settings.currency) }, { label: "Spent", value: formatMoney(fin.expenses, ctx.settings.currency) }, { label: "Income", value: formatMoney(fin.income, ctx.settings.currency) }, { label: "Remaining", value: p.budget !== null ? formatMoney(Number(p.budget) - fin.expenses, ctx.settings.currency) : "—" }]} />
          </Card>
        </div>
      </div>
    </div>
  );
}
