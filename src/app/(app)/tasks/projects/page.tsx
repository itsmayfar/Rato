import Link from "next/link";
import { Plus } from "lucide-react";
import { FormModal } from "@/components/ui/form-modal";
import { Badge, EmptyState, LinkButton, PageHeader, Progress, StatusBadge } from "@/components/ui/primitives";
import { saveProject } from "@/lib/actions/tasks";
import { requireUser } from "@/lib/auth";
import { OPEN_TASK_STATUSES } from "@/lib/constants";
import { loadContext } from "@/lib/context";
import { PROJECT_FIELDS, withOptions } from "@/lib/forms";
import { relationOptions } from "@/lib/task-options";
import { formatDate, formatMoney, titleCase } from "@/lib/utils";

export const metadata = { title: "Projects" };

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const user = await requireUser();
  const ctx = await loadContext(user.id);
  const { new: kind } = await searchParams;
  const newButton = (
    <FormModal label="New project" title="New project" action={saveProject} defs={withOptions(PROJECT_FIELDS, { goalId: relationOptions(ctx).goalId })} values={{ kind: kind ?? "general", status: "active" }} variant="primary" icon={<Plus className="h-4 w-4" />} />
  );
  return (
    <div>
      <PageHeader
        eyebrow="Tasks & Projects"
        title="Projects"
        purpose="Group tasks, milestones and budgets around a goal — a release, a campaign, a DJ season, merch or your website."
        actions={<><LinkButton href="/tasks" variant="ghost">Tasks</LinkButton>{newButton}</>}
      />
      {ctx.projects.length ? (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {ctx.projects.map((p) => {
            const tasks = ctx.tasks.filter((t) => t.projectId === p.id || (p.kind === "release" && ctx.releases.some((r) => r.projectId === p.id && r.id === t.releaseId)));
            const done = tasks.filter((t) => t.status === "completed").length;
            return (
              <li key={p.id} className="rounded-lg border border-line bg-surface p-5">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/tasks/projects/${p.id}`} className="text-sm hover:text-accent-strong">{p.name}</Link>
                  <StatusBadge status={p.status} />
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5"><Badge>{titleCase(p.kind)}</Badge>{p.isDemo && <Badge tone="info">DEMO</Badge>}</div>
                <div className="mt-4 flex justify-between text-xs text-muted"><span>{done}/{tasks.length} tasks</span><span>{p.targetDate ? `Target ${formatDate(p.targetDate)}` : ""}</span></div>
                <Progress value={done} max={Math.max(1, tasks.length)} className="mt-1" />
                {p.budget !== null && <p className="mt-2 text-xs text-faint">Budget {formatMoney(p.budget, ctx.settings.currency)}</p>}
                <p className="mt-1 text-xs text-faint">{tasks.filter((t) => OPEN_TASK_STATUSES.includes(t.status)).length} open</p>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState title="No projects yet." description="Release projects are created automatically with each release. Create others for strategy, live shows, merch or your website." action={newButton} />
      )}
    </div>
  );
}
