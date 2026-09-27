import { Download, Upload } from "lucide-react";
import { ActionForm, ConfirmAction, FieldInput, SubmitButton } from "@/components/ui/form";
import { Card, CardHeader, LinkButton, Notice, PageHeader } from "@/components/ui/primitives";
import { deleteAccount, deleteRecords, loadDemoData, removeDemoDataAction, restoreBackupAction } from "@/lib/actions/settings";
import { requireUser } from "@/lib/auth";

export const metadata = { title: "Data & backup" };

const EXPORTS = [
  ["tracks", "Tracks"],
  ["releases", "Releases"],
  ["tasks", "Tasks"],
  ["campaigns", "Campaigns"],
  ["content", "Content"],
  ["contacts", "Contacts"],
  ["transactions", "Financial records"],
  ["analytics", "Analytics"],
];

export default async function DataPage() {
  await requireUser();
  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader eyebrow="Settings" title="Data & backup" purpose="Export, back up, restore, import and delete your data. Your data belongs to you." />
      <Card>
        <CardHeader title="Full backup (JSON)" description="Every record in your account. Uploaded files are not inside the JSON — back up the storage directory separately (see docs)." />
        <div className="flex flex-wrap gap-2">
          <a href="/api/export/backup.json" className="inline-flex h-9 items-center gap-2 rounded-md bg-accent px-4 text-sm text-white hover:bg-accent-strong"><Download className="h-4 w-4" /> Download backup</a>
          <a href="/api/export/calendar.ics" className="inline-flex h-9 items-center gap-2 rounded-md border border-line px-4 text-sm text-muted hover:text-fg"><Download className="h-4 w-4" /> Calendar (.ics)</a>
        </div>
        <h3 className="mb-2 mt-6 text-xs uppercase tracking-[0.12em] text-muted">Restore a backup</h3>
        <Notice tone="warning" className="mb-4">Restoring replaces all current business data in this account with the backup. It runs in one transaction — if anything fails, nothing changes.</Notice>
        <ActionForm action={restoreBackupAction} className="space-y-3">
          <input type="file" name="file" accept="application/json,.json" aria-label="Backup file" className="block w-full text-sm text-muted file:mr-4 file:rounded-md file:border file:border-line file:bg-surface-3 file:px-4 file:py-2 file:text-sm file:text-fg" />
          <div className="max-w-xs"><FieldInput def={{ key: "confirm", label: "Type REPLACE to confirm", type: "text", required: true }} /></div>
          <SubmitButton variant="danger"><Upload className="h-4 w-4" /> Restore backup</SubmitButton>
        </ActionForm>
      </Card>
      <Card>
        <CardHeader title="CSV exports" />
        <div className="flex flex-wrap gap-2">
          {EXPORTS.map(([k, label]) => (
            <a key={k} href={`/api/export/${k}`} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line px-3 text-xs text-muted hover:text-fg"><Download className="h-3.5 w-3.5" /> {label}</a>
          ))}
        </div>
        <h3 className="mb-2 mt-6 text-xs uppercase tracking-[0.12em] text-muted">CSV imports</h3>
        <div className="flex flex-wrap gap-2">
          <LinkButton href="/import/tracks" size="sm" variant="outline">Tracks</LinkButton>
          <LinkButton href="/import/transactions" size="sm" variant="outline">Financial records</LinkButton>
          <LinkButton href="/import/contacts" size="sm" variant="outline">Contacts</LinkButton>
          <LinkButton href="/import/analytics" size="sm" variant="outline">Analytics</LinkButton>
        </div>
      </Card>
      <Card>
        <CardHeader title="Demo data" description="Clearly labelled [Demo] sample records to explore the app. Kept apart from real data: excluded from financial totals and reports, and removable in one step." />
        <div className="flex flex-wrap gap-2">
          <ConfirmAction action={loadDemoData} fields={{}} label="Load demo data" title="Load demo data?" message="Adds sample tracks, a release, a campaign, tasks, contacts, finances and metrics — all labelled [Demo]. Nothing real is changed." confirmLabel="Load" variant="outline" size="md" />
          <ConfirmAction action={removeDemoDataAction} fields={{}} label="Remove demo data" title="Remove all demo data?" message="Deletes every record marked as demo. Your real records are untouched." confirmLabel="Remove" size="md" />
        </div>
      </Card>
      <Card>
        <CardHeader title="Delete selected records" />
        <div className="flex flex-wrap gap-2">
          {[
            ["completed_tasks", "Completed tasks"],
            ["notifications", "All notifications"],
            ["conversations", "Assistant conversations"],
            ["analytics", "All analytics records"],
          ].map(([k, label]) => (
            <ConfirmAction key={k} action={deleteRecords} fields={{ kind: k }} label={label} title={`Delete ${label.toLowerCase()}?`} message="This cannot be undone. Download a backup first if you might need them." confirmLabel="Delete" size="md" />
          ))}
        </div>
      </Card>
      <Card className="border-danger/40">
        <CardHeader title="Delete account" description="Permanently deletes your account, every record and every uploaded file." />
        <ActionForm action={deleteAccount} className="grid max-w-md gap-3">
          <label className="text-xs uppercase tracking-[0.12em] text-muted" htmlFor="del-pw">Password</label>
          <input id="del-pw" name="password" type="password" autoComplete="current-password" className="rounded-md border border-line bg-surface-2 px-3 py-2 text-sm" />
          <FieldInput def={{ key: "confirm", label: "Type DELETE to confirm", type: "text", required: true }} />
          <SubmitButton variant="danger">Delete my account</SubmitButton>
        </ActionForm>
      </Card>
    </div>
  );
}
