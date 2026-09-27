/**
 * Information engine (pure).
 *
 * Given the business context, determine for every relevant piece of
 * information whether it is complete, missing, needs confirmation, invalid,
 * outdated or not applicable — and where to fix it.
 */
import { parseFieldValue, toInputValue } from "../fields";
import { summarizeSplits, splitsByType } from "../rights";
import type { BusinessContext, CampaignFull, InfoMeta, ReleaseFull, TrackFull } from "../types";
import { daysBetween, isBlank } from "../utils";
import {
  CAMPAIGN_REQUIREMENTS,
  PLATFORM_REQUIREMENTS,
  PROFILE_REQUIREMENTS,
  RELEASE_REQUIREMENTS,
  TRACK_REQUIREMENTS,
  type EntityType,
  type Requirement,
} from "./registry";

export type InfoStatus = "complete" | "missing" | "needs_confirmation" | "invalid" | "outdated" | "not_applicable";

export const STATUS_LABEL: Record<InfoStatus, string> = {
  complete: "Complete",
  missing: "Missing",
  needs_confirmation: "Needs confirmation",
  invalid: "Invalid",
  outdated: "Outdated",
  not_applicable: "Not applicable",
};

export interface InfoItem {
  /** Unique per entity instance. */
  uid: string;
  requirementId?: string;
  entityType: EntityType;
  entityId: string;
  entityLabel: string;
  key: string;
  label: string;
  group: string;
  why?: string;
  required: boolean;
  status: InfoStatus;
  value?: unknown;
  message?: string;
  source?: string;
  updatedAt?: Date | null;
  /** Editable through the question engine (field) vs. derived check (link). */
  editable: boolean;
  href: string;
}

export function getPath(record: Record<string, unknown>, path: string): unknown {
  const [head, tail] = path.split(".", 2);
  const v = record[head];
  if (tail === undefined) return v;
  return v && typeof v === "object" ? (v as Record<string, unknown>)[tail] : undefined;
}

function metaKey(entityType: string, entityId: string, key: string) {
  return `${entityType}:${entityId}:${key}`;
}

export function metaIndex(meta: InfoMeta[]) {
  return new Map(meta.map((m) => [metaKey(m.entityType, m.entityId, m.fieldKey), m]));
}

/** Evaluate one field value against its requirement. */
export function evaluateField(
  req: Requirement,
  value: unknown,
  meta: InfoMeta | undefined,
  today: string,
  requiredOverride?: boolean,
): { status: InfoStatus; message?: string } {
  if (meta?.override === "not_applicable") return { status: "not_applicable" };
  const unknownMissing = req.type === "tristate" && (req.unknownIsMissing ?? true) && (value === "unknown" || isBlank(value));
  if (isBlank(value) || unknownMissing) return { status: "missing" };
  // Re-validate stored values (imports/older data may not satisfy current rules)
  if (req.type !== "boolean" && req.type !== "multiselect") {
    const parsed = parseFieldValue({ ...req, required: requiredOverride ?? req.required }, toInputValue(req, value));
    if (!parsed.ok) return { status: "invalid", message: parsed.error };
  }
  if (meta?.override === "needs_confirmation") return { status: "needs_confirmation" };
  if (req.staleAfterDays && meta?.updatedAt) {
    const updated = meta.updatedAt.toISOString().slice(0, 10);
    if (daysBetween(updated, today) > req.staleAfterDays)
      return { status: "outdated", message: `Last confirmed ${daysBetween(updated, today)} days ago.` };
  }
  return { status: "complete" };
}

function fieldItems(
  ctx: BusinessContext,
  reqs: Requirement[],
  entityType: EntityType,
  entityId: string,
  entityLabel: string,
  record: Record<string, unknown>,
  href: string,
  requiredFor?: (r: Requirement) => boolean,
): InfoItem[] {
  const idx = metaIndex(ctx.infoMeta);
  return reqs.map((r) => {
    const value = entityType === "platform" ? record[r.path] : getPath(record, r.path);
    const meta = idx.get(metaKey(entityType, entityId, r.key));
    const required = requiredFor ? requiredFor(r) : Boolean(r.required);
    const { status, message } = evaluateField(r, value, meta, ctx.today, required);
    return {
      uid: metaKey(entityType, entityId, r.key),
      requirementId: r.id,
      entityType,
      entityId,
      entityLabel,
      key: r.key,
      label: r.label,
      group: r.group,
      why: r.why,
      required,
      status,
      value,
      message,
      source: meta?.source,
      updatedAt: meta?.updatedAt ?? null,
      editable: true,
      href,
    };
  });
}

function derived(
  entityType: EntityType,
  entityId: string,
  entityLabel: string,
  key: string,
  label: string,
  status: InfoStatus,
  href: string,
  opts: { why?: string; message?: string; required?: boolean; group?: string } = {},
): InfoItem {
  return {
    uid: `${entityType}:${entityId}:${key}`,
    entityType,
    entityId,
    entityLabel,
    key,
    label,
    group: opts.group ?? "checks",
    why: opts.why,
    required: opts.required ?? true,
    status,
    message: opts.message,
    editable: false,
    href,
  };
}

// ─── Profile ────────────────────────────────────────────────────────────────

export function evaluateProfile(ctx: BusinessContext, groups?: string[]): InfoItem[] {
  const p = ctx.profile as unknown as Record<string, unknown>;
  const reqs = groups ? PROFILE_REQUIREMENTS.filter((r) => groups.includes(r.group)) : PROFILE_REQUIREMENTS;
  const items = fieldItems(ctx, reqs, "profile", ctx.profile.id, "Artist profile", p, "/profile");
  if (!groups || groups.includes("platforms")) {
    const links: Record<string, unknown> = {};
    for (const l of ctx.platformLinks) links[l.platform] = l.url;
    items.push(...fieldItems(ctx, PLATFORM_REQUIREMENTS, "platform", ctx.profile.id, "Platforms", links, "/business?tab=platforms"));
  }
  return items;
}

// ─── Tracks ─────────────────────────────────────────────────────────────────

export function isInstrumental(track: Pick<TrackFull, "language">) {
  return Boolean(track.language && /instrumental/i.test(track.language));
}

export function hasApprovedMaster(track: TrackFull) {
  return track.versions.some((v) => v.kind === "master" && v.approved);
}

export function evaluateTrack(ctx: BusinessContext, track: TrackFull, opts: { forRelease?: boolean } = {}): InfoItem[] {
  const href = `/catalog/${track.id}`;
  const label = track.title;
  const items = fieldItems(ctx, TRACK_REQUIREMENTS, "track", track.id, label, track as unknown as Record<string, unknown>, href, (r) => {
    if (r.key === "lyrics") return Boolean(opts.forRelease && track.language && !isInstrumental(track));
    if (r.key === "plannedReleaseDate") return false;
    return Boolean(r.required);
  });
  // lyrics are not applicable for instrumentals
  for (const it of items) if (it.key === "lyrics" && isInstrumental(track) && it.status === "missing") it.status = "not_applicable";

  const masters = track.versions.filter((v) => v.kind === "master");
  items.push(
    derived(
      "track",
      track.id,
      label,
      "finalMaster",
      "Approved final master",
      hasApprovedMaster(track) ? "complete" : masters.length ? "needs_confirmation" : "missing",
      `${href}?tab=assets`,
      {
        group: "audio",
        why: "Distributors need the approved final audio file.",
        message: masters.length && !hasApprovedMaster(track) ? "A master exists but hasn’t been approved." : undefined,
      },
    ),
  );

  // Credits
  if (track.hasCollaborators === "yes") {
    items.push(
      derived("track", track.id, label, "collaborators", "Collaborators and roles listed", track.collaborators.length ? "complete" : "missing", `${href}?tab=credits`, {
        group: "credits",
        why: "Every contributor must be credited correctly.",
      }),
    );
  }

  // Rights
  const { composition, master } = splitsByType(track.splits);
  for (const [key, list, name] of [
    ["compositionSplits", composition, "Composition (publishing) splits"],
    ["masterSplits", master, "Master recording ownership"],
  ] as const) {
    const sum = summarizeSplits(list);
    const status: InfoStatus =
      sum.status === "missing"
        ? "missing"
        : sum.status === "complete"
          ? "complete"
          : sum.status === "unconfirmed" && !sum.issues.length
            ? "needs_confirmation"
            : "invalid";
    items.push(
      derived("track", track.id, label, key, name, status, `${href}?tab=rights`, {
        group: "rights",
        why: "Ownership must be documented before release — it is never assumed.",
        message: sum.issues.join(" ") || (sum.unconfirmed ? `${sum.unconfirmed} share(s) not yet confirmed by the rights holder.` : undefined),
      }),
    );
  }

  const r = track.rights;
  const samplesStatus: InfoStatus =
    !r || r.samplesUsed === "unknown"
      ? "missing"
      : r.samplesUsed === "none"
        ? "complete"
        : r.sampleLicenseStatus === "cleared"
          ? "complete"
          : "invalid";
  items.push(
    derived("track", track.id, label, "samples", "Sample usage & licences", samplesStatus, `${href}?tab=rights`, {
      group: "rights",
      why: "Uncleared samples can get a release taken down.",
      message: samplesStatus === "invalid" ? "Samples are used but the licence is not cleared." : undefined,
    }),
  );

  const agreementStatus: InfoStatus =
    track.hasCollaborators === "no"
      ? "not_applicable"
      : track.hasCollaborators === "unknown"
        ? "missing"
        : !r || r.agreementStatus === "unknown"
          ? "missing"
          : r.agreementStatus === "signed" || r.agreementStatus === "not_needed"
            ? "complete"
            : "needs_confirmation";
  items.push(
    derived("track", track.id, label, "agreement", "Collaboration agreement", agreementStatus, `${href}?tab=rights`, {
      group: "rights",
      why: "A signed agreement documents who owns what.",
      message: agreementStatus === "needs_confirmation" ? `Agreement is ${r?.agreementStatus}.` : undefined,
      required: track.hasCollaborators !== "no",
    }),
  );
  return items;
}

// ─── Releases ───────────────────────────────────────────────────────────────

export function evaluateRelease(ctx: BusinessContext, release: ReleaseFull, opts: { includeTracks?: boolean } = {}): InfoItem[] {
  const href = `/releases/${release.id}`;
  const label = release.title;
  const items = fieldItems(ctx, RELEASE_REQUIREMENTS, "release", release.id, label, release as unknown as Record<string, unknown>, href, (r) => {
    if (r.key === "preSaveUrl") return Boolean(release.preferences?.presave);
    return Boolean(r.required);
  });
  items.push(
    derived("release", release.id, label, "tracks", "Tracks linked to the release", release.trackIds.length ? "complete" : "missing", href, {
      group: "release",
      why: "A release needs at least one track from your catalog.",
    }),
  );
  items.push(
    derived(
      "release",
      release.id,
      label,
      "coverArtwork",
      "Cover artwork (approved)",
      release.coverDocumentId ? (release.coverApproved ? "complete" : "needs_confirmation") : "missing",
      `${href}?tab=assets`,
      { group: "assets", why: "Every store requires a 3000×3000 px cover image." },
    ),
  );
  items.push(
    derived("release", release.id, label, "dateConfirmed", "Release date confirmed", release.releaseDateConfirmed ? "complete" : release.releaseDate ? "needs_confirmation" : "missing", href, {
      group: "release",
    }),
  );
  if (opts.includeTracks !== false) {
    for (const tid of release.trackIds) {
      const t = ctx.tracks.find((x) => x.id === tid);
      if (t) items.push(...evaluateTrack(ctx, t, { forRelease: true }).filter((i) => i.required || i.status !== "missing"));
    }
  }
  return items;
}

// ─── Campaigns ──────────────────────────────────────────────────────────────

export function evaluateCampaign(ctx: BusinessContext, c: CampaignFull): InfoItem[] {
  const href = `/marketing/${c.id}`;
  const items = fieldItems(ctx, CAMPAIGN_REQUIREMENTS, "campaign", c.id, c.name, c as unknown as Record<string, unknown>, href);
  if (c.startDate && c.endDate && c.endDate < c.startDate) {
    const end = items.find((i) => i.key === "endDate");
    if (end) {
      end.status = "invalid";
      end.message = "End date is before the start date.";
    }
  }
  const assets = ctx.content.filter((x) => x.campaignId === c.id);
  items.push(
    derived("campaign", c.id, c.name, "content", "Promotional content planned", assets.length ? "complete" : "missing", `/content?campaign=${c.id}`, {
      group: "assets",
      why: "A campaign needs content to publish.",
    }),
  );
  return items;
}

// ─── Summaries ──────────────────────────────────────────────────────────────

export interface InfoSummary {
  total: number;
  requiredTotal: number;
  requiredComplete: number;
  missingRequired: number;
  counts: Record<InfoStatus, number>;
  percent: number;
  /** Items that block progress: required and not complete / not applicable. */
  blocking: InfoItem[];
}

export function isResolved(i: InfoItem) {
  return i.status === "complete" || i.status === "not_applicable";
}

export function summarize(items: InfoItem[]): InfoSummary {
  const counts: Record<InfoStatus, number> = {
    complete: 0,
    missing: 0,
    needs_confirmation: 0,
    invalid: 0,
    outdated: 0,
    not_applicable: 0,
  };
  for (const i of items) counts[i.status]++;
  const required = items.filter((i) => i.required && i.status !== "not_applicable");
  const requiredComplete = required.filter((i) => i.status === "complete").length;
  const blocking = required.filter((i) => !isResolved(i));
  return {
    total: items.length,
    requiredTotal: required.length,
    requiredComplete,
    missingRequired: blocking.length,
    counts,
    percent: required.length ? Math.round((requiredComplete / required.length) * 100) : 100,
    blocking,
  };
}

/** Every item the Information Center shows. */
export function evaluateAll(ctx: BusinessContext): InfoItem[] {
  const items = [...evaluateProfile(ctx)];
  for (const t of ctx.tracks) if (t.status !== "Archived") items.push(...evaluateTrack(ctx, t, { forRelease: t.releaseIds.length > 0 }));
  for (const r of ctx.releases) if (r.status !== "Archived") items.push(...evaluateRelease(ctx, r, { includeTracks: false }));
  for (const c of ctx.campaigns) if (c.status !== "Archived") items.push(...evaluateCampaign(ctx, c));
  return items;
}
