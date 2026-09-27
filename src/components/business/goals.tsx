"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { EntityForm } from "@/components/ui/entity-form";
import { ConfirmAction, ModalButton } from "@/components/ui/form";
import { Badge, EmptyState, Progress } from "@/components/ui/primitives";
import { deleteGoal, saveGoal } from "@/lib/actions/profile";
import { GOAL_FIELDS } from "@/lib/forms";
import type { Goal } from "@/lib/types";
import { formatDate, formatNumber, titleCase, toneFor } from "@/lib/utils";

export function GoalsManager({ goals, today }: { goals: Goal[]; today: string }) {
  return (
    <div>
      <div className="mb-4 flex justify-end">
        <ModalButton label="Add goal" title="New goal" variant="primary" icon={<Plus className="h-4 w-4" />} wide>
          {(close) => <EntityForm action={saveGoal} defs={GOAL_FIELDS} values={{ status: "active", category: "career", horizon: "quarterly" }} onSuccess={close} />}
        </ModalButton>
      </div>
      {goals.length ? (
        <ul className="grid gap-4 md:grid-cols-2">
          {goals.map((g) => {
            const measurable = g.targetValue !== null && g.currentValue !== null;
            const overdue = g.deadline && g.deadline < today && g.status === "active";
            return (
              <li key={g.id} className="rounded-lg border border-line bg-surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap gap-1.5">
                      <Badge>{titleCase(g.horizon)}</Badge>
                      <Badge>{titleCase(g.category)}</Badge>
                      <Badge tone={toneFor(g.status)}>{titleCase(g.status)}</Badge>
                      {g.isDemo && <Badge tone="info">DEMO</Badge>}
                    </div>
                    <h3 className="mt-2 text-sm">{g.title}</h3>
                    {g.metric && <p className="text-xs text-faint">Measured by {g.metric}</p>}
                  </div>
                  <div className="flex shrink-0">
                    <ModalButton label={<Pencil className="h-3.5 w-3.5" />} title="Edit goal" variant="ghost" size="sm" wide>
                      {(close) => <EntityForm action={saveGoal} defs={GOAL_FIELDS} values={g} hidden={{ id: g.id }} onSuccess={close} />}
                    </ModalButton>
                    <ConfirmAction action={deleteGoal} fields={{ id: g.id }} label="Delete" title="Delete this goal?" message={`“${g.title}” will be removed.`} size="icon" variant="ghost" icon={<Trash2 className="h-3.5 w-3.5" />} />
                  </div>
                </div>
                {measurable && (
                  <div className="mt-3">
                    <div className="mb-1 flex justify-between text-xs text-muted">
                      <span>
                        {formatNumber(g.currentValue)} / {formatNumber(g.targetValue)} {g.unit}
                      </span>
                      <span>{Math.round((Number(g.currentValue) / Math.max(1, Number(g.targetValue))) * 100)}%</span>
                    </div>
                    <Progress value={Number(g.currentValue)} max={Number(g.targetValue)} tone={g.status === "achieved" ? "success" : "accent"} />
                  </div>
                )}
                {g.deadline && <p className={`mt-2 text-xs ${overdue ? "text-danger" : "text-faint"}`}>Deadline {formatDate(g.deadline)}</p>}
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState title="No measurable goals yet." description="Turn your ambitions into targets with a metric and a deadline, e.g. “10,000 monthly listeners by June”." />
      )}
    </div>
  );
}
