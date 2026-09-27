/**
 * Release checklist engine (pure).
 *
 * Items are generated from the release type and the preferences chosen in the
 * release wizard — irrelevant steps are never added. "Auto" items are verified
 * from stored data; "external" items describe actions outside the app and are
 * only completed when the user explicitly confirms them.
 */
import { evaluateRelease, evaluateTrack, hasApprovedMaster, isResolved } from "../info/engine";
import type { BusinessContext, ChecklistItem, ReleaseFull } from "../types";
import { addDays } from "../utils";

export type ReleasePrefs = {
  campaign?: boolean;
  presave?: boolean;
  pitching?: boolean;
  djPromo?: boolean;
  musicVideo?: boolean;
};

export const PREFERENCE_LABELS: Record<keyof ReleasePrefs, string> = {
  campaign: "Run a promotional campaign",
  presave: "Use a pre-save link",
  pitching: "Pitch to editorial playlists",
  djPromo: "Send DJ promo",
  musicVideo: "Release a music video",
};

export interface ChecklistTemplate {
  key: string;
  label: string;
  description: string;
  /** Days relative to the release date (negative = before). */
  offsetDays: number;
  auto: boolean;
  external: boolean;
  required: boolean;
  appliesTo?: (release: Pick<ReleaseFull, "releaseType">, prefs: ReleasePrefs) => boolean;
  /** For auto items: is the condition satisfied by stored data? */
  check?: (ctx: BusinessContext, release: ReleaseFull) => boolean;
}

const tracksOf = (ctx: BusinessContext, r: ReleaseFull) => ctx.tracks.filter((t) => r.trackIds.includes(t.id));
const multiTrack = (r: Pick<ReleaseFull, "releaseType">) => ["ep", "album", "compilation"].includes(r.releaseType);
const campaignsFor = (ctx: BusinessContext, r: ReleaseFull) => ctx.campaigns.filter((c) => c.releaseId === r.id && c.status !== "Archived");
const contentFor = (ctx: BusinessContext, r: ReleaseFull) => {
  const camps = new Set(campaignsFor(ctx, r).map((c) => c.id));
  return ctx.content.filter((x) => (x.campaignId && camps.has(x.campaignId)) || (x.trackId && r.trackIds.includes(x.trackId)));
};

export const RELEASE_CHECKLIST: ChecklistTemplate[] = [
  {
    key: "tracks_linked",
    label: "Tracks linked",
    description: "At least one catalog track is attached to this release.",
    offsetDays: -42,
    auto: true,
    external: false,
    required: true,
    check: (_, r) => r.trackIds.length > 0,
  },
  {
    key: "tracklist",
    label: "Tracklist order confirmed",
    description: "Confirm the running order of all tracks.",
    offsetDays: -35,
    auto: false,
    external: false,
    required: true,
    appliesTo: (r) => multiTrack(r),
  },
  {
    key: "final_master",
    label: "Final master approved",
    description: "Every track has an approved master version.",
    offsetDays: -35,
    auto: true,
    external: false,
    required: true,
    check: (ctx, r) => tracksOf(ctx, r).length > 0 && tracksOf(ctx, r).every(hasApprovedMaster),
  },
  {
    key: "artwork",
    label: "Artwork approved",
    description: "Cover artwork uploaded (3000×3000 px) and approved.",
    offsetDays: -35,
    auto: true,
    external: false,
    required: true,
    check: (_, r) => Boolean(r.coverDocumentId && r.coverApproved),
  },
  {
    key: "metadata",
    label: "Metadata checked",
    description: "Release and track metadata complete and valid.",
    offsetDays: -30,
    auto: true,
    external: false,
    required: true,
    check: (ctx, r) =>
      evaluateRelease(ctx, r, { includeTracks: false })
        .filter((i) => i.editable && i.required)
        .every(isResolved) &&
      tracksOf(ctx, r).every((t) =>
        evaluateTrack(ctx, t, { forRelease: true })
          .filter((i) => i.group === "metadata" && i.required)
          .every(isResolved),
      ),
  },
  {
    key: "credits",
    label: "Credits verified",
    description: "Collaborators and roles are documented for every track.",
    offsetDays: -30,
    auto: true,
    external: false,
    required: true,
    check: (ctx, r) =>
      tracksOf(ctx, r).length > 0 &&
      tracksOf(ctx, r).every((t) => t.hasCollaborators === "no" || (t.hasCollaborators === "yes" && t.collaborators.length > 0)),
  },
  {
    key: "ownership",
    label: "Ownership information checked",
    description: "Composition and master splits total 100%, samples and agreements documented.",
    offsetDays: -30,
    auto: true,
    external: false,
    required: true,
    check: (ctx, r) =>
      tracksOf(ctx, r).length > 0 &&
      tracksOf(ctx, r).every((t) =>
        evaluateTrack(ctx, t)
          .filter((i) => i.group === "rights" && i.required)
          .every(isResolved),
      ),
  },
  {
    key: "distributor",
    label: "Distributor selected",
    description: "Choose how the release reaches stores.",
    offsetDays: -35,
    auto: true,
    external: false,
    required: true,
    check: (_, r) => Boolean(r.distributor),
  },
  {
    key: "date_confirmed",
    label: "Release date confirmed",
    description: "Lock the release date so every deadline can be scheduled.",
    offsetDays: -35,
    auto: true,
    external: false,
    required: true,
    check: (_, r) => Boolean(r.releaseDate && r.releaseDateConfirmed),
  },
  {
    key: "submission",
    label: "Distribution submission completed",
    description: "Upload audio, artwork and metadata to your distributor. Confirm only once the distributor has accepted the upload.",
    offsetDays: -28,
    auto: false,
    external: true,
    required: true,
  },
  {
    key: "editorial_pitch",
    label: "Editorial playlist pitch submitted",
    description: "Pitch the release in Spotify for Artists (needs at least 7 days before release; 3–4 weeks is better).",
    offsetDays: -21,
    auto: false,
    external: true,
    required: false,
    appliesTo: (_, p) => Boolean(p.pitching),
  },
  {
    key: "presave",
    label: "Pre-save link live",
    description: "Pre-save link saved in the release.",
    offsetDays: -21,
    auto: true,
    external: false,
    required: false,
    appliesTo: (_, p) => Boolean(p.presave),
    check: (_, r) => Boolean(r.preSaveUrl),
  },
  {
    key: "campaign",
    label: "Campaign connected",
    description: "A promotional campaign is linked to this release.",
    offsetDays: -28,
    auto: true,
    external: false,
    required: true,
    appliesTo: (_, p) => p.campaign !== false,
    check: (ctx, r) => campaignsFor(ctx, r).length > 0,
  },
  {
    key: "promo_materials",
    label: "Promotional materials prepared",
    description: "At least one content item for this release is approved or scheduled.",
    offsetDays: -7,
    auto: true,
    external: false,
    required: true,
    appliesTo: (_, p) => p.campaign !== false,
    check: (ctx, r) => contentFor(ctx, r).some((x) => ["Approved", "Scheduled", "Published", "Analyzed"].includes(x.stage)),
  },
  {
    key: "social_scheduled",
    label: "Social media content scheduled",
    description: "Release-week posts are scheduled in the planner.",
    offsetDays: -3,
    auto: true,
    external: false,
    required: false,
    appliesTo: (_, p) => p.campaign !== false,
    check: (ctx, r) => contentFor(ctx, r).some((x) => ["Scheduled", "Published", "Analyzed"].includes(x.stage)),
  },
  {
    key: "dj_promo",
    label: "DJ promo sent",
    description: "Send the promo to your DJ list. Confirm once actually sent.",
    offsetDays: -14,
    auto: false,
    external: true,
    required: false,
    appliesTo: (_, p) => Boolean(p.djPromo),
  },
  {
    key: "music_video",
    label: "Music video ready",
    description: "Final video exported and uploaded (unlisted/scheduled).",
    offsetDays: -7,
    auto: false,
    external: false,
    required: false,
    appliesTo: (_, p) => Boolean(p.musicVideo),
  },
  {
    key: "release_day",
    label: "Release-day checklist completed",
    description: "All release-day checks confirmed.",
    offsetDays: 1,
    auto: true,
    external: false,
    required: true,
    check: (_, r) => r.execution.length > 0 && r.execution.every((i) => i.status !== "pending"),
  },
  {
    key: "post_release_review",
    label: "Post-release review",
    description: "The 7-day review is completed using recorded data.",
    offsetDays: 8,
    auto: true,
    external: false,
    required: true,
    check: (_, r) => r.reviews.some((v) => v.period === "7d" && v.status === "completed"),
  },
];

export const EXECUTION_CHECKLIST: Omit<ChecklistTemplate, "offsetDays">[] = [
  { key: "verify_live", label: "Verify the release is live", description: "Open each store and confirm the release is available.", auto: false, external: true, required: true },
  { key: "check_links", label: "Check streaming platform links", description: "Smart link, pre-save redirect and store links all resolve.", auto: false, external: true, required: true },
  { key: "confirm_artwork", label: "Confirm artwork and credits", description: "Cover, title, featured artists and credits display correctly.", auto: false, external: true, required: true },
  { key: "announce", label: "Publish release announcements", description: "Post the approved announcement content.", auto: false, external: true, required: true },
  { key: "ads", label: "Activate approved advertising campaigns", description: "Only ads you approved in the campaign — never automatically.", auto: false, external: true, required: false },
  { key: "notify", label: "Notify collaborators", description: "Let everyone involved know the release is out.", auto: false, external: true, required: true },
  { key: "promo_messages", label: "Send promotional messages", description: "Newsletter, DMs to supporters, DJ follow-ups where appropriate.", auto: false, external: true, required: false },
  { key: "website", label: "Update the artist website", description: "Add the release and links.", auto: false, external: true, required: false },
  { key: "content", label: "Publish planned content", description: "Release-day posts from the content calendar.", auto: false, external: true, required: true },
  { key: "issues", label: "Monitor technical issues", description: "Record any problems (wrong metadata, missing store, audio issues) in the release notes.", auto: false, external: true, required: true },
  { key: "metrics", label: "Record initial performance metrics", description: "Add first-day numbers in Audience & Analytics.", auto: false, external: false, required: true },
];

export function templatesFor(release: Pick<ReleaseFull, "releaseType">, prefs: ReleasePrefs) {
  return RELEASE_CHECKLIST.filter((t) => !t.appliesTo || t.appliesTo(release, prefs));
}

export type EffectiveItem = ChecklistItem & { effectiveStatus: "done" | "pending" | "not_applicable"; overdue: boolean; verified: boolean };

/** Combine stored items with live verification for auto items. */
export function effectiveChecklist(ctx: BusinessContext, release: ReleaseFull, items: ChecklistItem[] = release.checklist): EffectiveItem[] {
  return items.map((item) => {
    const tpl = RELEASE_CHECKLIST.find((t) => t.key === item.key);
    let status: EffectiveItem["effectiveStatus"] = item.status === "done" ? "done" : item.status === "not_applicable" ? "not_applicable" : "pending";
    let verified = false;
    if (item.auto && tpl?.check && status !== "not_applicable") {
      verified = tpl.check(ctx, release);
      status = verified ? "done" : "pending";
    }
    const overdue = status === "pending" && Boolean(item.dueDate && item.dueDate < ctx.today);
    return { ...item, effectiveStatus: status, overdue, verified };
  });
}

export function checklistProgress(items: EffectiveItem[]) {
  const relevant = items.filter((i) => i.effectiveStatus !== "not_applicable");
  const done = relevant.filter((i) => i.effectiveStatus === "done").length;
  return { done, total: relevant.length, percent: relevant.length ? Math.round((done / relevant.length) * 100) : 0 };
}

export function dueDateFor(releaseDate: string | null, offsetDays: number) {
  return releaseDate ? addDays(releaseDate, offsetDays) : null;
}

/** Suggested status from the release's data and checklist (the user can still set it manually). */
export function suggestReleaseStatus(ctx: BusinessContext, release: ReleaseFull): string {
  if (["Released", "Post-release review", "Archived"].includes(release.status)) return release.status;
  const items = effectiveChecklist(ctx, release);
  const submitted = items.find((i) => i.key === "submission")?.effectiveStatus === "done";
  if (submitted) return release.releaseDate && release.releaseDateConfirmed ? "Scheduled" : "Submitted";
  const blocking = items.filter(
    (i) => i.required && i.effectiveStatus === "pending" && ["tracks_linked", "final_master", "artwork", "metadata", "credits", "ownership", "distributor", "date_confirmed", "tracklist"].includes(i.key),
  );
  if (!blocking.length) return "Ready for submission";
  const missingInfo = evaluateRelease(ctx, release).some((i) => i.required && i.status === "missing");
  return missingInfo ? "Awaiting information" : "In preparation";
}
