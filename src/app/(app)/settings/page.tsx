import { ActionForm, FieldGrid, SubmitButton } from "@/components/ui/form";
import { Card, CardHeader, LinkButton, PageHeader } from "@/components/ui/primitives";
import { saveGeneralSettings, saveWorkflowSettings } from "@/lib/actions/settings";
import { requireUser } from "@/lib/auth";
import { CONTENT_STAGES, RELEASE_STATUSES, TRACK_STATUSES, TRACK_WORKFLOW } from "@/lib/constants";
import { getSettings } from "@/lib/context";
import { SETTINGS_FIELDS } from "@/lib/forms";

export const metadata = { title: "Settings" };

const NOTIFY = [
  { key: "deadlines", label: "Deadline reminders" },
  { key: "overdue", label: "Overdue tasks" },
  { key: "missing_info", label: "Missing information alerts" },
  { key: "summaries", label: "Weekly & monthly summaries" },
  { key: "reviews", label: "Review reminders" },
  { key: "follow_ups", label: "Contact follow-ups" },
];

export default async function SettingsPage() {
  const user = await requireUser();
  const s = await getSettings(user.id);
  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader eyebrow="Settings" title="General & workflow" purpose="Preferences for currency, time zone, theme, notifications and customisable workflow statuses. Profile and brand identity are edited in My Artist Profile." actions={<LinkButton href="/profile" variant="outline">Artist profile & brand</LinkButton>} />
      <Card>
        <CardHeader title="General" />
        <ActionForm action={saveGeneralSettings}>
          <FieldGrid defs={SETTINGS_FIELDS} values={s as unknown as Record<string, unknown>} />
          <fieldset className="mt-6">
            <legend className="mb-2 text-xs uppercase tracking-[0.12em] text-muted">Notifications</legend>
            <div className="grid gap-2 md:grid-cols-2">
              {NOTIFY.map((n) => (
                <label key={n.key} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name={`notify_${n.key}`} defaultChecked={s.notificationPrefs?.[n.key] !== false} className="accent-[var(--accent)]" />
                  {n.label}
                </label>
              ))}
            </div>
          </fieldset>
          <SubmitButton className="mt-6">Save settings</SubmitButton>
        </ActionForm>
      </Card>
      <Card>
        <CardHeader title="Workflow customisation" description="Add your own statuses on top of the defaults, and customise the track workflow timeline. Comma separated." />
        <ActionForm action={saveWorkflowSettings}>
          <FieldGrid
            columns={1}
            defs={[
              { key: "trackStatuses", label: "Additional track statuses", type: "tags", help: `Defaults: ${TRACK_STATUSES.join(", ")}` },
              { key: "releaseStatuses", label: "Additional release statuses", type: "tags", help: `Defaults: ${RELEASE_STATUSES.join(", ")}` },
              { key: "contentStages", label: "Additional content stages", type: "tags", help: `Defaults: ${CONTENT_STAGES.join(", ")}` },
              { key: "trackWorkflow", label: "Track workflow stages (replaces the default)", type: "tags", help: `Leave empty for: ${TRACK_WORKFLOW.join(" → ")}` },
            ]}
            values={{ trackStatuses: s.customStatuses.track ?? [], releaseStatuses: s.customStatuses.release ?? [], contentStages: s.customStatuses.content ?? [], trackWorkflow: s.trackWorkflow }}
          />
          <SubmitButton className="mt-6">Save workflow settings</SubmitButton>
        </ActionForm>
      </Card>
    </div>
  );
}
