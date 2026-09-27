import { CampaignForm } from "@/components/marketing/campaign-form";
import { Card, Notice, PageHeader } from "@/components/ui/primitives";
import { requireUser } from "@/lib/auth";
import { loadContext } from "@/lib/context";
import { CAMPAIGN_FIELDS, withOptions } from "@/lib/forms";
import { relationOptions } from "@/lib/task-options";
import { addDays } from "@/lib/utils";

export const metadata = { title: "New campaign" };

export default async function NewCampaign({ searchParams }: { searchParams: Promise<{ release?: string; track?: string }> }) {
  const user = await requireUser();
  const ctx = await loadContext(user.id);
  const sp = await searchParams;
  const release = ctx.releases.find((r) => r.id === sp.release);
  const opts = relationOptions(ctx);
  return (
    <div className="max-w-4xl">
      <PageHeader eyebrow="Marketing & Promotion" title="New campaign" purpose="Choose a plan template to generate tasks and content placeholders on a timeline. Audience and message default from your profile." />
      <Notice className="mb-6">Templates only create tasks and drafts. Publishing and advertising always remain manual and require your approval.</Notice>
      <Card>
        <CampaignForm
          defs={withOptions(CAMPAIGN_FIELDS, { releaseId: opts.releaseId, trackId: opts.trackId }).filter((d) => d.key !== "results")}
          values={{
            name: release ? `${release.title} — release campaign` : "",
            releaseId: release?.id ?? "",
            trackId: sp.track ?? release?.trackIds[0] ?? "",
            template: release ? "pre_release" : "audience_growth",
            objective: release ? "Promote a release" : "Build an audience",
            status: "Planning",
            currency: ctx.settings.currency,
            startDate: release?.releaseDate ? addDays(release.releaseDate, -28) : ctx.today,
            endDate: release?.releaseDate ? addDays(release.releaseDate, 30) : addDays(ctx.today, 60),
            budget: ctx.profile.business?.marketingBudget ?? "",
            targetAudience: ctx.profile.musicIdentity?.targetAudience ?? "",
            creativeDirection: [ctx.profile.brandConcept, ctx.profile.visualIdentity].filter(Boolean).join(" — "),
            channels: ctx.profile.musicIdentity?.mainPlatforms?.filter((p) => ["Instagram", "TikTok", "YouTube", "Spotify", "SoundCloud", "Facebook"].includes(p)) ?? [],
          }}
        />
      </Card>
    </div>
  );
}
