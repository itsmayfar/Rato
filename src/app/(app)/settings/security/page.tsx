import { desc, eq } from "drizzle-orm";
import { ActionForm, InlineAction, SubmitButton } from "@/components/ui/form";
import { Badge, Card, CardHeader, PageHeader, Table, Td, Th } from "@/components/ui/primitives";
import { changePassword, revokeSession } from "@/lib/actions/settings";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { auditLogs, sessions } from "@/lib/db/schema";
import { formatDateTime } from "@/lib/utils";
import { PasswordFields } from "./password-fields";

export const metadata = { title: "Security" };

export default async function SecurityPage() {
  const user = await requireUser();
  const list = await db.select().from(sessions).where(eq(sessions.userId, user.id)).orderBy(desc(sessions.lastSeenAt));
  const logs = await db.select().from(auditLogs).where(eq(auditLogs.userId, user.id)).orderBy(desc(auditLogs.createdAt)).limit(100);
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Settings" title="Security" purpose={`Signed in as ${user.email}. Passwords are hashed with scrypt; session tokens are stored only as hashes; every business record is private to your account.`} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Change password" />
          <ActionForm action={changePassword} resetOnSuccess className="space-y-3">
            <PasswordFields />
            <SubmitButton>Change password</SubmitButton>
          </ActionForm>
        </Card>
        <Card>
          <CardHeader title="Active sessions" />
          <ul className="divide-y divide-line">
            {list.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <div className="truncate text-xs text-muted">{s.userAgent ?? "Unknown device"}</div>
                  <div className="text-[11px] text-faint">Last active {formatDateTime(s.lastSeenAt)} · expires {formatDateTime(s.expiresAt)}</div>
                </div>
                {s.id === user.sessionId ? <Badge tone="success">This device</Badge> : <InlineAction action={revokeSession} fields={{ id: s.id }}>Sign out</InlineAction>}
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <Card>
        <CardHeader title="Audit log" description="Important actions (latest 100). Passwords and secrets are never logged." />
        <Table>
          <thead><tr><Th>Time</Th><Th>Action</Th><Th>Record</Th><Th>Summary</Th></tr></thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <Td className="whitespace-nowrap text-xs text-muted">{formatDateTime(l.createdAt)}</Td>
                <Td className="text-xs"><code>{l.action}</code></Td>
                <Td className="text-xs text-muted">{l.entityType}</Td>
                <Td className="text-xs">{l.summary}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
