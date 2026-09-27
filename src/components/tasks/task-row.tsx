import Link from "next/link";
import { Check, Circle } from "lucide-react";
import { InlineAction } from "@/components/ui/form";
import { Badge } from "@/components/ui/primitives";
import { toggleTaskComplete } from "@/lib/actions/tasks";
import { TASK_STATUSES } from "@/lib/constants";
import type { Task } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

export function TaskRow({ task, today, context }: { task: Task; today: string; context?: string }) {
  const done = task.status === "completed";
  const overdue = !done && task.status !== "cancelled" && task.dueDate && task.dueDate < today;
  const statusLabel = TASK_STATUSES.find((s) => s.value === task.status)?.label ?? task.status;
  return (
    <div className="flex items-start gap-3 py-2.5">
      <InlineAction
        action={toggleTaskComplete}
        fields={{ id: task.id }}
        size="icon"
        className="-ml-2 -mt-1.5"
        title={done ? "Reopen task" : "Mark complete"}
      >
        {done ? <Check className="h-4 w-4 text-success" /> : <Circle className="h-4 w-4 text-faint hover:text-accent-strong" />}
      </InlineAction>
      <div className="min-w-0 flex-1">
        <Link href={`/tasks/${task.id}`} className={cn("block truncate text-sm hover:text-accent-strong", done && "text-faint line-through")}>
          {task.title}
        </Link>
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-faint">
          {task.dueDate && <span className={cn(overdue && "text-danger")}>{overdue ? "Overdue · " : "Due "}{formatDate(task.dueDate)}</span>}
          {context && <span>{context}</span>}
          {task.status !== "planned" && !done && <Badge tone={task.status === "blocked" ? "danger" : task.status.startsWith("waiting") ? "warning" : "neutral"}>{statusLabel}</Badge>}
          {(task.priority === "high" || task.priority === "urgent") && !done && <Badge tone={task.priority === "urgent" ? "danger" : "warning"}>{task.priority}</Badge>}
        </div>
      </div>
    </div>
  );
}
