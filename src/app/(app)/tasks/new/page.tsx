import { TaskForm } from "@/components/tasks/task-form";
import { Card, PageHeader } from "@/components/ui/primitives";
import { requireUser } from "@/lib/auth";
import { loadContext } from "@/lib/context";
import { TASK_FIELDS, withOptions } from "@/lib/forms";
import { relationOptions } from "@/lib/task-options";

export const metadata = { title: "New task" };

export default async function NewTask({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  const ctx = await loadContext(user.id);
  const sp = await searchParams;
  return (
    <div className="max-w-4xl">
      <PageHeader eyebrow="Tasks & Projects" title="New task" purpose="Give the task a clear purpose and connect it to what it moves forward." />
      <Card>
        <TaskForm
          defs={withOptions(TASK_FIELDS, relationOptions(ctx))}
          values={{ status: "planned", priority: "medium", trackId: sp.track, releaseId: sp.release, campaignId: sp.campaign, projectId: sp.project, phaseKey: sp.phase, dueDate: sp.due }}
        />
      </Card>
    </div>
  );
}
