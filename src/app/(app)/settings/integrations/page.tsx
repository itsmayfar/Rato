import Link from "next/link";
import { eq } from "drizzle-orm";
import { CheckCircle2, CircleOff, KeyRound } from "lucide-react";
import { ConfirmAction, InlineAction } from "@/components/ui/form";
import { FormModal } from "@/components/ui/form-modal";
import { Badge, Card, KeyValue, PageHeader } from "@/components/ui/primitives";
import { connectIntegration, disconnectIntegration, syncIntegrationNow } from "@/lib/actions/integrations";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { integrations } from "@/lib/db/schema";
import { INTEGRATIONS } from "@/lib/integrations/registry";
import { credentialsPresent } from "@/lib/integrations/sync";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Integrations" };

export default async function IntegrationsPage() {
  const user = await requireUser();
  const rows = await db.select().from(integrations).where(eq(integrations.userId, user.id));
  return (
    <div>
      <PageHeader
        eyebrow="Settings"
        title="Integrations"
        purpose="Official APIs and authorised access only. A service is shown as connected only when it really is; where no usable API exists, a manual workflow or import is provided instead."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        {INTEGRATIONS.map((i) => {
          const row = rows.find((r) => r.service === i.key);
          const creds = credentialsPresent(i.credentials);
          const connected = i.mode === "api" && Boolean(row?.enabled) && creds;
          const status = i.mode === "manual" ? "Manual workflow" : !creds ? "Credentials missing" : connected ? "Connected" : "Not connected";
          return (
            <Card key={i.key}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm">{i.name}</h2>
                  <p className="mt-0.5 text-xs text-muted">{i.purpose}</p>
                </div>
                <Badge tone={connected ? "success" : i.mode === "manual" ? "neutral" : creds ? "inactive" : "warning"}>
                  {connected ? <CheckCircle2 className="h-3 w-3" /> : i.mode === "api" && !creds ? <KeyRound className="h-3 w-3" /> : <CircleOff className="h-3 w-3" />} {status}
                </Badge>
              </div>
              <div className="mt-4">
                <KeyValue
                  items={[
                    { label: "Permissions", value: i.permissions },
                    { label: "Capabilities", value: i.capabilities.join(" · ") },
                    ...(i.credentials.length ? [{ label: "Server credentials", value: <code className="text-[11px]">{i.credentials.join(", ")}</code> }] : []),
                    ...(i.mode === "api" ? [{ label: "Last successful sync", value: formatDateTime(row?.lastSyncAt) }] : []),
                  ]}
                />
              </div>
              {row?.lastError && <p className="mt-3 text-xs text-danger">Last error: {row.lastError}</p>}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {i.mode === "api" && creds && (
                  <FormModal
                    label={connected ? "Settings" : "Connect"}
                    title={`Connect ${i.name}`}
                    action={connectIntegration}
                    defs={i.configFields.map((f) => ({ key: f.key, label: f.label, type: "text" as const, required: true, help: f.help }))}
                    values={row?.config}
                    hidden={{ service: i.key }}
                    variant={connected ? "ghost" : "primary"}
                    size="sm"
                    wide={false}
                    columns={1}
                  />
                )}
                {connected && <InlineAction action={syncIntegrationNow} fields={{ service: i.key }} variant="outline">Sync now</InlineAction>}
                {row?.enabled && <ConfirmAction action={disconnectIntegration} fields={{ service: i.key }} label="Disconnect" title={`Disconnect ${i.name}?`} message="Synced data is kept. You can reconnect at any time." size="sm" variant="ghost" />}
                {i.mode === "api" && !creds && <span className="text-xs text-faint">Add the credentials to the server environment to enable. See docs/INTEGRATIONS.md.</span>}
                {i.key === "calendar" ? (
                  <a href={i.manual.href} className="text-xs text-accent-strong hover:underline">{i.manual.label} →</a>
                ) : (
                  <Link href={i.manual.href} className="text-xs text-accent-strong hover:underline">{i.manual.label} →</Link>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
