import { TrackForm } from "@/components/catalog/track-form";
import { Card, PageHeader } from "@/components/ui/primitives";
import { requireUser } from "@/lib/auth";
import { TRACK_STATUSES } from "@/lib/constants";
import { getProfile, getSettings } from "@/lib/context";
import { TRACK_FIELDS, withOptions } from "@/lib/forms";

export const metadata = { title: "New track" };

export default async function NewTrackPage() {
  const user = await requireUser();
  const [profile, settings] = await Promise.all([getProfile(user.id), getSettings(user.id)]);
  const defs = withOptions(TRACK_FIELDS, { status: [...TRACK_STATUSES, ...(settings.customStatuses.track ?? [])] }).filter(
    (d) => !["actualReleaseDate", "lyrics"].includes(d.key),
  );
  return (
    <div className="max-w-4xl">
      <PageHeader
        eyebrow="Music Catalog"
        title="New track"
        purpose="Only the title is required. Everything else can be added as the track develops — missing details are tracked for you."
      />
      <Card>
        <TrackForm
          defs={defs}
          values={{
            status: "Idea",
            primaryArtist: profile.artistName ?? "",
            genre: profile.musicIdentity?.mainGenres?.[0] ?? profile.genres[0] ?? "",
            explicit: "unknown",
            hasCollaborators: "unknown",
          }}
        />
      </Card>
    </div>
  );
}
