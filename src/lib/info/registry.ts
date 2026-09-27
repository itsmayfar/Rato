/**
 * Information requirement registry.
 *
 * Each requirement describes one piece of business information: where it
 * lives (entity + path), how it's validated (FieldDef), why it's needed,
 * and how quickly it goes stale. Values stay in their entity tables;
 * the engine only reads/writes them through `path`.
 */
import type { FieldDef } from "../fields";
import {
  CAREER_STAGES,
  CHANNELS,
  CAMPAIGN_OBJECTIVES,
  COLLABORATOR_ROLES,
  DISTRIBUTORS,
  GENRES,
  INCOME_CATEGORIES,
  MUSICAL_KEYS,
  PLATFORMS,
  RELEASE_TYPES,
  WEEKDAYS,
} from "../constants";

export type EntityType = "profile" | "platform" | "track" | "release" | "campaign";

export interface Requirement extends FieldDef {
  /** Globally unique id: `${entity}.${key}` */
  id: string;
  entity: EntityType;
  /** Column name, or `jsonColumn.key` for profile sections, or platform name. */
  path: string;
  group: string;
  /** Days after which a saved value should be re-confirmed. */
  staleAfterDays?: number;
  /** "unknown" counts as missing for tristate fields unless this is false. */
  unknownIsMissing?: boolean;
}

function req(entity: EntityType, path: string, group: string, def: Omit<FieldDef, "key"> & Partial<Requirement>): Requirement {
  const key = path;
  return { id: `${entity}.${key}`, entity, path, group, key, ...def } as Requirement;
}

// ─── Artist profile (onboarding steps 1–3, 4, 6–8) ──────────────────────────

const P = (path: string, group: string, def: Omit<FieldDef, "key"> & Partial<Requirement>) => req("profile", path, group, def);

export const PROFILE_REQUIREMENTS: Requirement[] = [
  // Step 1 — identity
  P("artistName", "identity", { label: "Artist name", type: "text", required: true, maxLength: 120, why: "Used on every release, credit and message." }),
  P("legalName", "identity", {
    label: "Legal name",
    type: "text",
    important: true,
    why: "Only needed for contracts, split sheets and financial records. Never shown publicly.",
  }),
  P("bio", "identity", { label: "Artist biography", type: "textarea", required: true, maxLength: 4000, why: "Needed for press kits, distributor profiles and outreach." }),
  P("country", "identity", { label: "Country", type: "text", required: true, why: "Affects royalty collection societies, tax and booking territory." }),
  P("city", "identity", { label: "City", type: "text", why: "Useful for local bookings and press." }),
  P("contactEmail", "identity", { label: "Contact email", type: "email", required: true, why: "Used in outreach drafts, press kits and distributor forms." }),
  P("website", "identity", { label: "Website", type: "url" }),
  P("imageUrl", "identity", { label: "Artist image (URL)", type: "url", help: "Or upload in Documents & Assets and paste its link." }),
  P("logoUrl", "identity", { label: "Logo (URL)", type: "url" }),
  P("genres", "identity", { label: "Music genres", type: "multiselect", options: GENRES, required: true, why: "Drives metadata defaults, playlist targeting and content ideas." }),
  P("artisticDirection", "identity", { label: "Artistic direction", type: "textarea", why: "Keeps creative and marketing decisions consistent." }),
  P("brandConcept", "identity", { label: "Brand concept", type: "text", required: true, why: "The anchor for all visuals, captions and campaigns." }),
  P("brandPhrase", "identity", { label: "Brand phrase", type: "text" }),
  P("visualIdentity", "identity", { label: "Visual identity", type: "text", help: "Colours, typography, imagery." }),
  P("languages", "identity", { label: "Languages", type: "tags", help: "Languages you create and communicate in." }),
  P("careerStage", "identity", { label: "Career stage", type: "select", options: CAREER_STAGES, required: true, why: "Calibrates recommendations to where you are now." }),

  // Step 2 — goals
  P("goals.mainObjective", "goals", { label: "Main career objective", type: "textarea", required: true, why: "Every recommendation is ranked against this objective." }),
  P("goals.shortTerm", "goals", { label: "Short-term goals (next 3 months)", type: "textarea", required: true, staleAfterDays: 120 }),
  P("goals.mediumTerm", "goals", { label: "Medium-term goals (this year)", type: "textarea", staleAfterDays: 365 }),
  P("goals.longTerm", "goals", { label: "Long-term goals (3+ years)", type: "textarea" }),
  P("goals.audienceTarget", "goals", { label: "Desired audience size", type: "text", placeholder: "e.g. 10,000 monthly listeners by June" }),
  P("goals.streamingTarget", "goals", { label: "Streaming goals", type: "text" }),
  P("goals.releaseFrequency", "goals", {
    label: "Release frequency",
    type: "select",
    required: true,
    options: ["Every 4 weeks", "Every 6 weeks", "Every 2 months", "Quarterly", "Twice a year", "Yearly", "Irregular"],
    why: "Sets the rhythm for release planning and content calendars.",
  }),
  P("goals.marketingGoals", "goals", { label: "Marketing goals", type: "textarea" }),
  P("goals.revenueTarget", "goals", { label: "Revenue goals", type: "text", important: true }),
  P("goals.performanceGoals", "goals", { label: "Performance & DJ goals", type: "textarea" }),
  P("goals.collaborationGoals", "goals", { label: "Collaboration goals", type: "textarea" }),
  P("goals.businessGoals", "goals", { label: "Business development goals", type: "textarea" }),

  // Step 3 — music identity
  P("musicIdentity.mainGenres", "music", { label: "Main genres", type: "multiselect", options: GENRES, required: true }),
  P("musicIdentity.secondaryGenres", "music", { label: "Secondary genres", type: "multiselect", options: GENRES }),
  P("musicIdentity.bpmRange", "music", { label: "Preferred BPM range", type: "text", placeholder: "120–126" }),
  P("musicIdentity.influences", "music", { label: "Musical influences", type: "textarea" }),
  P("musicIdentity.productionStyle", "music", { label: "Production style", type: "textarea" }),
  P("musicIdentity.vocalPreferences", "music", { label: "Vocal preferences", type: "text" }),
  P("musicIdentity.mood", "music", { label: "Mood & emotional direction", type: "text", required: true, why: "Shapes artwork, captions and playlist pitching." }),
  P("musicIdentity.targetAudience", "music", { label: "Target audience", type: "textarea", required: true, why: "Needed for campaign targeting and outreach." }),
  P("musicIdentity.mainPlatforms", "music", { label: "Main platforms", type: "multiselect", options: PLATFORMS, required: true }),
  P("musicIdentity.releaseFormats", "music", { label: "Preferred release formats", type: "multiselect", options: RELEASE_TYPES.map((r) => r.label) }),

  // Step 4 — existing catalog
  P("catalogSummary.releasedCount", "catalog", { label: "Tracks released so far", type: "number", required: true, min: 0 }),
  P("catalogSummary.unreleasedCount", "catalog", { label: "Unreleased tracks", type: "number", required: true, min: 0 }),
  P("catalogSummary.inProduction", "catalog", { label: "Tracks currently in production", type: "textarea", help: "Titles or working names." }),
  P("catalogSummary.readyForRelease", "catalog", { label: "Tracks ready for release", type: "textarea" }),
  P("catalogSummary.hasCollaborations", "catalog", { label: "Are there collaborations?", type: "tristate", required: true }),
  P("catalogSummary.hasContracts", "catalog", { label: "Existing contracts or rights agreements?", type: "tristate", required: true, important: true }),
  P("catalogSummary.distributors", "catalog", { label: "Distributors currently used", type: "tags" }),

  // Step 6 — business & finances (never required during onboarding)
  P("business.monthlyBudget", "business", { label: "Available monthly budget (EUR)", type: "money", important: true, staleAfterDays: 90, why: "Lets the system check campaign plans against what you can spend." }),
  P("business.marketingBudget", "business", { label: "Monthly marketing budget (EUR)", type: "money", important: true, staleAfterDays: 90 }),
  P("business.monthlyExpenses", "business", { label: "Monthly business expenses (EUR)", type: "money", important: true, staleAfterDays: 90 }),
  P("business.revenueSources", "business", { label: "Current revenue sources", type: "multiselect", options: INCOME_CATEGORIES }),
  P("business.subscriptions", "business", { label: "Existing subscriptions", type: "textarea", help: "Software, distributor plans, sample libraries…" }),
  P("business.distributorCosts", "business", { label: "Distributor costs per year (EUR)", type: "money", important: true }),
  P("business.productionExpenses", "business", { label: "Production expenses per month (EUR)", type: "money", important: true }),
  P("business.advertisingExpenses", "business", { label: "Advertising expenses per month (EUR)", type: "money", important: true }),
  P("business.financialTargets", "business", { label: "Desired financial targets", type: "textarea", important: true }),

  // Step 7 — team
  P("team.summary", "team", { label: "Current team & collaborators", type: "textarea", help: "Add people individually in Contacts; summarise here." }),
  P("team.roles", "team", {
    label: "Roles already covered",
    type: "multiselect",
    options: ["Manager", ...COLLABORATOR_ROLES, "Designer", "Video editor", "PR", "Booking agent", "Label", "Publisher"],
  }),

  // Step 8 — tools & workflow
  P("workflowPrefs.productionSoftware", "tools", { label: "Music production software", type: "tags", placeholder: "Ableton Live, Logic Pro" }),
  P("workflowPrefs.distributionServices", "tools", { label: "Distribution services", type: "tags" }),
  P("workflowPrefs.designTools", "tools", { label: "Design tools", type: "tags" }),
  P("workflowPrefs.aiTools", "tools", { label: "AI tools", type: "tags" }),
  P("workflowPrefs.pmTools", "tools", { label: "Project management tools", type: "tags" }),
  P("workflowPrefs.workdays", "tools", { label: "Preferred workdays", type: "multiselect", options: WEEKDAYS }),
  P("workflowPrefs.workingHours", "tools", { label: "Available working hours", type: "text", placeholder: "e.g. 10:00–16:00, ~20 h/week" }),
  P("workflowPrefs.reminderFrequency", "tools", { label: "Reminder frequency", type: "select", options: ["Daily", "Every 2 days", "Weekly", "Only urgent"] }),
  P("workflowPrefs.releasePlanningWeeks", "tools", {
    label: "Release planning period (weeks before release)",
    type: "number",
    min: 1,
    max: 52,
    why: "Used to schedule checklist deadlines backwards from release dates.",
  }),
];

// Step 5 — platforms (stored in platform_links)
export const PLATFORM_REQUIREMENTS: Requirement[] = PLATFORMS.map((p) =>
  req("platform", p, "platforms", {
    label: `${p} profile link`,
    type: "url",
    required: p === "Spotify" || p === "Instagram",
    staleAfterDays: 365,
    why: p === "Spotify" ? "Needed for pre-saves, pitching and analytics." : undefined,
  }),
);

// ─── Track metadata ─────────────────────────────────────────────────────────

const T = (path: string, group: string, def: Omit<FieldDef, "key"> & Partial<Requirement>) => req("track", path, group, def);

export const TRACK_REQUIREMENTS: Requirement[] = [
  T("title", "metadata", { label: "Track title", type: "text", required: true, maxLength: 200 }),
  T("primaryArtist", "metadata", { label: "Primary artist", type: "text", required: true }),
  T("featuredArtists", "metadata", { label: "Featured artists", type: "tags" }),
  T("genre", "metadata", { label: "Genre", type: "select", options: GENRES, allowCustom: true, required: true, why: "Required by distributors and DSP metadata." }),
  T("subgenre", "metadata", { label: "Subgenre", type: "text" }),
  T("bpm", "metadata", { label: "BPM", type: "number", min: 20, max: 300, required: true, why: "DJ stores (Beatport) and DJ promo lists require it." }),
  T("musicalKey", "metadata", { label: "Musical key", type: "select", options: MUSICAL_KEYS, required: true }),
  T("mood", "metadata", { label: "Mood", type: "text" }),
  T("language", "metadata", { label: "Language", type: "text", required: true, help: "Use “Instrumental” if there are no lyrics.", why: "Distributors require the lyrics language." }),
  T("durationSec", "metadata", { label: "Duration", type: "duration", required: true }),
  T("explicit", "metadata", { label: "Explicit content", type: "tristate", required: true, why: "Mandatory flag for every DSP.", unknownIsMissing: true }),
  T("isrc", "metadata", { label: "ISRC", type: "text", help: "Often assigned by your distributor.", maxLength: 15 }),
  T("lyrics", "metadata", { label: "Lyrics", type: "textarea" }),
  T("hasCollaborators", "credits", {
    label: "Does this track involve collaborators?",
    type: "tristate",
    required: true,
    why: "Collaborators change credits, splits and required agreements.",
    unknownIsMissing: true,
  }),
  T("plannedReleaseDate", "planning", { label: "Planned release date", type: "date" }),
];

// ─── Release ────────────────────────────────────────────────────────────────

const R = (path: string, group: string, def: Omit<FieldDef, "key"> & Partial<Requirement>) => req("release", path, group, def);

export const RELEASE_REQUIREMENTS: Requirement[] = [
  R("title", "release", { label: "Release title", type: "text", required: true }),
  R("releaseType", "release", { label: "Release type", type: "select", options: RELEASE_TYPES, required: true }),
  R("primaryArtist", "release", { label: "Primary artist", type: "text", required: true }),
  R("featuredArtists", "release", { label: "Featured artists", type: "tags" }),
  R("releaseDate", "release", {
    label: "Release date",
    type: "date",
    required: true,
    why: "Every deadline in the checklist is scheduled backwards from this date.",
  }),
  R("genre", "release", { label: "Primary genre", type: "select", options: GENRES, allowCustom: true, required: true }),
  R("language", "release", { label: "Language", type: "text", required: true }),
  R("explicit", "release", { label: "Explicit content", type: "tristate", required: true, unknownIsMissing: true }),
  R("distributor", "distribution", {
    label: "Distributor",
    type: "select",
    options: DISTRIBUTORS,
    allowCustom: true,
    required: true,
    why: "Determines submission lead time and metadata rules.",
  }),
  R("upc", "distribution", { label: "UPC / EAN", type: "text", help: "Usually assigned by the distributor." }),
  R("strategy", "strategy", { label: "Release strategy", type: "textarea", why: "Summarises the story and goals of this release for the campaign." }),
  R("preSaveUrl", "promotion", { label: "Pre-save link", type: "url" }),
  R("smartLinkUrl", "promotion", { label: "Smart link", type: "url" }),
];

// ─── Campaign ───────────────────────────────────────────────────────────────

const C = (path: string, group: string, def: Omit<FieldDef, "key"> & Partial<Requirement>) => req("campaign", path, group, def);

export const CAMPAIGN_REQUIREMENTS: Requirement[] = [
  C("name", "campaign", { label: "Campaign name", type: "text", required: true }),
  C("objective", "campaign", { label: "Objective", type: "select", options: CAMPAIGN_OBJECTIVES, allowCustom: true, required: true }),
  C("targetAudience", "campaign", { label: "Target audience", type: "textarea", required: true }),
  C("startDate", "campaign", { label: "Start date", type: "date", required: true }),
  C("endDate", "campaign", { label: "End date", type: "date", required: true }),
  C("budget", "campaign", { label: "Budget", type: "money", required: true, important: true, why: "Spending is tracked against this budget." }),
  C("channels", "strategy", { label: "Marketing channels", type: "multiselect", options: CHANNELS, required: true }),
  C("creativeDirection", "strategy", { label: "Creative direction", type: "textarea" }),
  C("message", "strategy", { label: "Main promotional message", type: "textarea", required: true }),
  C("contentStrategy", "strategy", { label: "Content strategy", type: "textarea" }),
  C("outreachStrategy", "strategy", { label: "Outreach strategy", type: "textarea" }),
  C("successMetrics", "strategy", { label: "Success metrics", type: "textarea", required: true, why: "Without measurable indicators the campaign cannot be reviewed." }),
];

export const ALL_REQUIREMENTS: Requirement[] = [
  ...PROFILE_REQUIREMENTS,
  ...PLATFORM_REQUIREMENTS,
  ...TRACK_REQUIREMENTS,
  ...RELEASE_REQUIREMENTS,
  ...CAMPAIGN_REQUIREMENTS,
];

const byId = new Map(ALL_REQUIREMENTS.map((r) => [r.id, r]));
export function getRequirement(id: string) {
  return byId.get(id);
}

export const GROUP_LABELS: Record<string, { title: string; description: string }> = {
  identity: { title: "Artist identity", description: "Who you are as an artist and how you present yourself." },
  goals: { title: "Artist goals", description: "What you want to achieve and by when." },
  music: { title: "Music identity", description: "Your sound, audience and preferred formats." },
  catalog: { title: "Existing music catalog", description: "What already exists and where it is distributed." },
  platforms: { title: "Platforms & accounts", description: "Public profile links (connections are managed in Integrations)." },
  business: { title: "Business & financial setup", description: "Budget and costs. Optional — share what you’re comfortable with." },
  team: { title: "Team & collaborators", description: "Who helps you today." },
  tools: { title: "Tools & workflow preferences", description: "How and when you like to work." },
  metadata: { title: "Track metadata", description: "Information distributors and stores require." },
  credits: { title: "Credits", description: "Who contributed to the track." },
  planning: { title: "Planning", description: "" },
  release: { title: "Release basics", description: "Core release information." },
  distribution: { title: "Distribution", description: "How the release reaches stores." },
  strategy: { title: "Strategy", description: "" },
  promotion: { title: "Promotion links", description: "" },
  campaign: { title: "Campaign basics", description: "" },
};

/** Onboarding steps in order. */
export const ONBOARDING_STEPS = ["identity", "goals", "music", "catalog", "platforms", "business", "team", "tools"] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export function requirementsForGroup(group: string): Requirement[] {
  return ALL_REQUIREMENTS.filter((r) => r.group === group && (r.entity === "profile" || r.entity === "platform"));
}
