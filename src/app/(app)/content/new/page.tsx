import { ContentForm } from "@/components/content/content-form";
import { Card, PageHeader } from "@/components/ui/primitives";
import { requireUser } from "@/lib/auth";
import { CONTENT_STAGES } from "@/lib/constants";
import { loadContext } from "@/lib/context";
import { CONTENT_FIELDS, withOptions } from "@/lib/forms";
import { relationOptions } from "@/lib/task-options";

export const metadata = { title: "New content" };

export default async function NewContent({ searchParams }: { searchParams: Promise<{ campaign?: string; track?: string; date?: string }> }) {
  const user = await requireUser();
  const ctx = await loadContext(user.id);
  const sp = await searchParams;
  const opts = relationOptions(ctx);
  const camp = ctx.campaigns.find((c) => c.id === sp.campaign);
  return (
    <div className="max-w-4xl">
      <PageHeader eyebrow="Content Studio" title="New content item" purpose="New items start as drafts. Request approval when ready — only approved content can be scheduled or published." />
      <Card>
        <ContentForm
          defs={withOptions(CONTENT_FIELDS, { campaignId: opts.campaignId, trackId: opts.trackId, stage: CONTENT_STAGES.filter((s) => !["Approved", "Scheduled", "Published", "Analyzed"].includes(s)) }).filter((d) => d.key !== "publishedUrl")}
          values={{ stage: "Idea", campaignId: sp.campaign ?? "", trackId: sp.track ?? camp?.trackId ?? "", plannedDate: sp.date ?? "", callToAction: camp?.releaseId ? "Listen now — link in bio" : "" }}
        />
      </Card>
    </div>
  );
}
