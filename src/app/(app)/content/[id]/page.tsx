import Link from "next/link";
import { notFound } from "next/navigation";
import { Sparkles, Trash2 } from "lucide-react";
import { ContentForm } from "@/components/content/content-form";
import { ConfirmAction, InlineAction } from "@/components/ui/form";
import { FormModal } from "@/components/ui/form-modal";
import { Badge, Card, CardHeader, DemoBadge, KeyValue, LinkButton, Notice, PageHeader, StatusBadge } from "@/components/ui/primitives";
import { deleteContent, markPublished, recordContentMetrics, setContentApproval } from "@/lib/actions/marketing";
import { requireUser } from "@/lib/auth";
import { CONTENT_STAGES } from "@/lib/constants";
import { loadContext } from "@/lib/context";
import { CONTENT_FIELDS, withOptions } from "@/lib/forms";
import { relationOptions } from "@/lib/task-options";
import { formatDate, formatDateTime, formatNumber, titleCase } from "@/lib/utils";

const METRIC_KEYS = ["views", "likes", "comments", "shares", "saves", "reach", "linkClicks"];

export default async function ContentItemPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const ctx = await loadContext(user.id);
  const c = ctx.content.find((x) => x.id === id);
  if (!c) notFound();
  const opts = relationOptions(ctx);
  const stages = [...CONTENT_STAGES, ...(ctx.settings.customStatuses.content ?? [])].filter((s) => s !== "Published" || c.stage === "Published");
  const camp = ctx.campaigns.find((x) => x.id === c.campaignId);
  const prompt = encodeURIComponent(`Draft a ${c.platform ?? "social media"} caption with hashtags and a call to action for my content item "${c.title}"${camp ? ` in the campaign "${camp.name}"` : ""}.`);
  return (
    <div>
      <PageHeader
        eyebrow={<span className="flex items-center gap-2"><Link href="/content" className="hover:text-fg">Content Studio</Link> {c.isDemo && <DemoBadge />}</span>}
        title={c.title}
        purpose={[c.platform, c.format, c.plannedDate && `planned ${formatDate(c.plannedDate)}${c.plannedTime ? ` ${c.plannedTime}` : ""}`, camp && `campaign: ${camp.name}`].filter(Boolean).join(" · ")}
        actions={
          <>
            <StatusBadge status={c.stage} />
            <LinkButton href={`/assistant?q=${prompt}`} variant="outline"><Sparkles className="h-4 w-4" /> Draft caption</LinkButton>
            <ConfirmAction action={deleteContent} fields={{ id }} label="Delete" title="Delete this content item?" message="This cannot be undone." size="md" icon={<Trash2 className="h-4 w-4" />} />
          </>
        }
      />
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Content" />
          <ContentForm id={c.id} defs={withOptions(CONTENT_FIELDS, { campaignId: opts.campaignId, trackId: opts.trackId, stage: stages })} values={c as unknown as Record<string, unknown>} />
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Approval" description="Nothing is published without your approval." />
            <div className="mb-4">
              <Badge tone={c.approvalStatus === "approved" ? "success" : c.approvalStatus === "pending" ? "warning" : c.approvalStatus === "changes_requested" ? "danger" : "neutral"}>{titleCase(c.approvalStatus)}</Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              {c.approvalStatus !== "pending" && c.approvalStatus !== "approved" && <InlineAction action={setContentApproval} fields={{ id, decision: "request" }} variant="outline">Ready for review</InlineAction>}
              {c.approvalStatus !== "approved" && (
                <ConfirmAction action={setContentApproval} fields={{ id, decision: "approve" }} label="Approve" title="Approve for publication?" message="You confirm the caption, asset and timing are final. You still publish it yourself." confirmLabel="Approve" variant="primary" />
              )}
              {c.approvalStatus !== "changes_requested" && <InlineAction action={setContentApproval} fields={{ id, decision: "changes" }}>Request changes</InlineAction>}
            </div>
          </Card>
          <Card>
            <CardHeader title="Publication" />
            {c.publishedAt ? (
              <KeyValue items={[{ label: "Published", value: formatDateTime(c.publishedAt) }, { label: "Link", value: c.publishedUrl ? <a href={c.publishedUrl} target="_blank" rel="noopener noreferrer" className="underline">{c.publishedUrl}</a> : "—" }]} />
            ) : c.approvalStatus === "approved" ? (
              <FormModal
                label="Mark as published"
                title="Confirm publication"
                description="Confirm only after you have posted it on the platform."
                action={markPublished}
                defs={[{ key: "publishedUrl", label: "Link to the post", type: "url" }]}
                hidden={{ id }}
                variant="primary"
                wide={false}
                columns={1}
                submitLabel="Confirm published"
              />
            ) : (
              <Notice>Approve the content first.</Notice>
            )}
          </Card>
          <Card>
            <CardHeader title="Performance" description={c.metricsSource ?? "No data recorded"} />
            {Object.keys(c.metrics ?? {}).length ? (
              <KeyValue items={Object.entries(c.metrics).map(([k, v]) => ({ label: titleCase(k), value: formatNumber(v) }))} />
            ) : (
              <p className="text-sm text-muted">Record numbers from the platform’s insights after publishing.</p>
            )}
            {c.publishedAt && (
              <div className="mt-4">
                <FormModal
                  label="Record metrics"
                  title="Record performance (manual)"
                  action={recordContentMetrics}
                  defs={METRIC_KEYS.map((k) => ({ key: k, label: titleCase(k), type: "number" as const, min: 0 }))}
                  values={c.metrics}
                  hidden={{ id }}
                  variant="outline"
                  size="sm"
                />
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
