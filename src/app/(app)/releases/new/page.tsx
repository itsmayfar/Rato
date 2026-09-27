import { ReleaseWizard } from "@/components/releases/release-wizard";
import { PageHeader } from "@/components/ui/primitives";
import { requireUser } from "@/lib/auth";
import { loadContext } from "@/lib/context";
import { hasApprovedMaster } from "@/lib/info/engine";
import { addDays } from "@/lib/utils";

export const metadata = { title: "New release" };

export default async function NewReleasePage({ searchParams }: { searchParams: Promise<{ track?: string }> }) {
  const user = await requireUser();
  const ctx = await loadContext(user.id);
  const { track } = await searchParams;
  const weeks = ctx.profile.workflowPrefs?.releasePlanningWeeks ?? 6;
  return (
    <div className="max-w-4xl">
      <PageHeader eyebrow="Release Manager" title="New release" purpose="A release project with a checklist tailored to its type and your preferences. Information already in your profile and catalog is reused." />
      <ReleaseWizard
        preselected={track}
        tracks={ctx.tracks
          .filter((t) => t.status !== "Archived" && !t.actualReleaseDate)
          .map((t) => ({ id: t.id, title: t.title, status: t.status, hasMaster: hasApprovedMaster(t), released: Boolean(t.actualReleaseDate) }))}
        defaults={{
          artist: ctx.profile.artistName ?? "",
          distributor: ctx.profile.catalogSummary?.distributors?.[0] ?? ctx.profile.workflowPrefs?.distributionServices?.[0] ?? "",
          releaseDate: "",
        }}
      />
      <p className="mt-4 text-xs text-faint">Tip: your planning period is {weeks} weeks — a release on {addDays(ctx.today, weeks * 7)} would keep every deadline comfortable.</p>
    </div>
  );
}
