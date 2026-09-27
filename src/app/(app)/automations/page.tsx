import { desc, eq } from "drizzle-orm";
import { Play } from "lucide-react";
import { ActionForm, InlineAction, SubmitButton, filterClass } from "@/components/ui/form";
import { Badge, Card, CardHeader, Notice, PageHeader, Table, Td, Th } from "@/components/ui/primitives";
import { runAutomationNow, updateAutomationRule } from "@/lib/actions/system";
import { requireUser } from "@/lib/auth";
import { ensureDefaultAutomations } from "@/lib/automations/defaults";
import { AUTOMATION_KINDS, type AutomationKind } from "@/lib/automations/kinds";
import { db } from "@/lib/db";
import { automationLogs, automationRules } from "@/lib/db/schema";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Automations" };

export default async function AutomationsPage() {
  const user = await requireUser();
  await ensureDefaultAutomations(user.id);
  const rules = await db.select().from(automationRules).where(eq(automationRules.userId, user.id)).orderBy(automationRules.createdAt);
  const logs = await db.select().from(automationLogs).where(eq(automationLogs.userId, user.id)).orderBy(desc(automationLogs.triggeredAt)).limit(60);
  return (
    <div>
      <PageHeader
        eyebrow="Automations"
        title="Reminders, alerts & recurring work"
        purpose="Automations run once per schedule when you open the dashboard, or from an external scheduler via the cron endpoint. They only create notifications, tasks and checklists inside the app — they never spend money, publish, send messages, delete data or change legal or financial records."
        actions={<InlineAction action={runAutomationNow} fields={{}} variant="primary" size="md"><Play className="h-4 w-4" /> Run all now</InlineAction>}
      />
      <Notice className="mb-6" title="Approval">Turn on “Requires approval” to hold a rule until you run it manually. Every run is logged with its actual result — nothing is reported as done unless it executed.</Notice>
      <div className="grid gap-4 lg:grid-cols-2">
        {rules.map((r) => {
          const kind = AUTOMATION_KINDS[r.kind as AutomationKind];
          const cond = r.conditions as Record<string, number>;
          const actions = r.actions as Record<string, boolean>;
          return (
            <Card key={r.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm">{r.name}</h2>
                  <p className="mt-0.5 text-xs text-muted">{kind?.description}</p>
                </div>
                <Badge tone={r.enabled ? "success" : "inactive"}>{r.enabled ? "On" : "Off"}</Badge>
              </div>
              <ActionForm action={updateAutomationRule} className="mt-4">
                <input type="hidden" name="id" value={r.id} />
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  <label className="flex items-center gap-2"><input type="checkbox" name="enabled" defaultChecked={r.enabled} className="accent-[var(--accent)]" /> Enabled</label>
                  <label className="flex items-center gap-2"><input type="checkbox" name="notify" defaultChecked={actions.notify !== false} className="accent-[var(--accent)]" /> Notify</label>
                  {"createTasks" in actions && (
                    <label className="flex items-center gap-2"><input type="hidden" name="createTasksPresent" value="1" /><input type="checkbox" name="createTasks" defaultChecked={actions.createTasks} className="accent-[var(--accent)]" /> Create tasks</label>
                  )}
                  <label className="flex items-center gap-2"><input type="checkbox" name="requiresApproval" defaultChecked={r.requiresApproval} className="accent-[var(--accent)]" /> Requires approval</label>
                  <select name="schedule" defaultValue={r.schedule} className={filterClass} aria-label="Schedule">
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                  {"daysAhead" in cond && <label className="flex items-center gap-2 text-xs text-muted">Days ahead <input name="daysAhead" defaultValue={cond.daysAhead} className={`${filterClass} w-16`} inputMode="numeric" /></label>}
                  {"withinDays" in cond && <label className="flex items-center gap-2 text-xs text-muted">Within days <input name="withinDays" defaultValue={cond.withinDays} className={`${filterClass} w-16`} inputMode="numeric" /></label>}
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <SubmitButton size="sm" variant="outline">Save</SubmitButton>
                  <span className="text-[11px] text-faint">Trigger: {r.trigger} · last run {formatDateTime(r.lastRunAt)}</span>
                </div>
              </ActionForm>
              <div className="mt-2"><InlineAction action={runAutomationNow} fields={{ id: r.id }}><Play className="h-3 w-3" /> Run now</InlineAction></div>
            </Card>
          );
        })}
      </div>
      <Card className="mt-6">
        <CardHeader title="Execution log" description="Most recent 60 runs" />
        {logs.length ? (
          <Table>
            <thead><tr><Th>Time</Th><Th>Automation</Th><Th>Result</Th><Th>Approval</Th><Th>Details</Th></tr></thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <Td className="whitespace-nowrap text-xs text-muted">{formatDateTime(l.triggeredAt)}</Td>
                  <Td className="text-xs">{l.ruleName}</Td>
                  <Td><Badge tone={l.result === "success" ? "success" : l.result === "error" ? "danger" : "warning"}>{l.result.replace("_", " ")}</Badge></Td>
                  <Td className="text-xs text-muted">{l.approvalStatus.replace("_", " ")}</Td>
                  <Td className="text-xs text-muted">{l.error ? <span className="text-danger">{l.error}</span> : l.details}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <p className="text-sm text-muted">No runs yet.</p>
        )}
      </Card>
    </div>
  );
}
