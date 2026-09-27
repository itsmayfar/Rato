/**
 * Form definitions for every entity. Server actions validate with these exact
 * definitions; pages add dynamic options (e.g. lists of tracks) with `withOptions`.
 */
import {
  CAMPAIGN_OBJECTIVES,
  CAMPAIGN_STATUSES,
  CAMPAIGN_TEMPLATES,
  CHANNELS,
  COLLABORATOR_ROLES,
  CONTACT_CATEGORIES,
  CONTENT_FORMATS,
  CONTENT_PLATFORMS,
  CONTENT_STAGES,
  DISTRIBUTORS,
  DOCUMENT_CATEGORIES,
  EXPENSE_CATEGORIES,
  GENRES,
  INCOME_CATEGORIES,
  METRICS,
  MUSICAL_KEYS,
  OUTREACH_KINDS,
  PAYMENT_STATUSES,
  PIPELINE_STATUSES,
  PLATFORMS,
  PRIORITIES,
  RELEASE_STATUSES,
  RELEASE_TYPES,
  RIGHTS_STATUS_OPTIONS,
  TASK_STATUSES,
  TRACK_STATUSES,
  TX_NATURES,
  VERIFICATION,
  VERSION_KINDS,
} from "./constants";
import { CURRENCIES, type FieldDef, type Option } from "./fields";
import { PHASES } from "./workflow/phases";

const rel = (key: string, label: string): FieldDef => ({ key, label, type: "select", allowCustom: true, options: [] });

export function withOptions(defs: readonly FieldDef[], options: Record<string, readonly Option[]>): FieldDef[] {
  return defs.map((d) => (options[d.key] ? { ...d, options: options[d.key], allowCustom: false } : d));
}

export const PHASE_OPTIONS = PHASES.map((p) => ({ value: p.key, label: `${p.number}. ${p.title}` }));

export const TRACK_FIELDS: FieldDef[] = [
  { key: "title", label: "Track title", type: "text", required: true, maxLength: 200 },
  { key: "projectCode", label: "Internal project ID", type: "text", help: "Leave empty to generate one (MF-001…)", maxLength: 40 },
  { key: "status", label: "Status", type: "select", options: TRACK_STATUSES, allowCustom: true, required: true },
  { key: "primaryArtist", label: "Primary artist", type: "text" },
  { key: "featuredArtists", label: "Featured artists", type: "tags" },
  { key: "genre", label: "Genre", type: "select", options: GENRES, allowCustom: true },
  { key: "subgenre", label: "Subgenre", type: "text" },
  { key: "bpm", label: "BPM", type: "number", min: 20, max: 300 },
  { key: "musicalKey", label: "Musical key", type: "select", options: MUSICAL_KEYS },
  { key: "mood", label: "Mood", type: "text" },
  { key: "language", label: "Language", type: "text", help: "“Instrumental” if there are no lyrics" },
  { key: "durationSec", label: "Duration", type: "duration" },
  { key: "explicit", label: "Explicit content", type: "tristate" },
  { key: "hasCollaborators", label: "Collaborators involved?", type: "tristate" },
  { key: "isrc", label: "ISRC", type: "text", maxLength: 15 },
  { key: "plannedReleaseDate", label: "Planned release date", type: "date" },
  { key: "actualReleaseDate", label: "Actual release date", type: "date" },
  { key: "lyrics", label: "Lyrics", type: "textarea" },
  { key: "productionNotes", label: "Production notes", type: "textarea" },
];

export const VERSION_FIELDS: FieldDef[] = [
  { key: "kind", label: "Type", type: "select", options: VERSION_KINDS, required: true },
  { key: "label", label: "Label", type: "text", required: true, placeholder: "e.g. Mix v3, Master (final)" },
  { key: "externalUrl", label: "Link (cloud storage, Dropbox…)", type: "url" },
  { key: "notes", label: "Notes", type: "textarea" },
];

export const COLLABORATOR_FIELDS: FieldDef[] = [
  { key: "name", label: "Name", type: "text", required: true },
  { key: "role", label: "Role", type: "select", options: COLLABORATOR_ROLES, allowCustom: true, required: true },
  rel("contactId", "Linked contact"),
  { key: "credited", label: "Credited on release", type: "boolean", placeholder: "Credit this person on the release" },
  { key: "notes", label: "Notes", type: "text" },
];

export const SPLIT_FIELDS: FieldDef[] = [
  { key: "rightType", label: "Right", type: "select", required: true, options: [{ value: "composition", label: "Composition (publishing)" }, { value: "master", label: "Master recording" }] },
  { key: "holderName", label: "Rights holder", type: "text", required: true },
  { key: "role", label: "Role", type: "text", placeholder: "Songwriter, producer, label…" },
  { key: "percentage", label: "Share", type: "percent", required: true, min: 0.001, important: true },
  rel("contactId", "Linked contact"),
  rel("agreementDocumentId", "Agreement / split sheet"),
  { key: "confirmed", label: "Confirmed by the rights holder", type: "boolean", placeholder: "Confirmed by the rights holder (e.g. signed split sheet)" },
  { key: "notes", label: "Notes", type: "text" },
];

export const RIGHTS_FIELDS: FieldDef[] = [
  { key: "samplesUsed", label: "Samples used?", type: "select", options: RIGHTS_STATUS_OPTIONS.samplesUsed, required: true },
  { key: "sampleDetails", label: "Sample details", type: "textarea", help: "Source, library, licence terms" },
  { key: "sampleLicenseStatus", label: "Sample licence", type: "select", options: RIGHTS_STATUS_OPTIONS.sampleLicenseStatus, required: true },
  { key: "agreementStatus", label: "Collaboration agreement", type: "select", options: RIGHTS_STATUS_OPTIONS.agreementStatus, required: true },
  { key: "copyrightRegistration", label: "Copyright registration", type: "select", options: RIGHTS_STATUS_OPTIONS.registration, required: true, help: "Only mark as registered once you have confirmation." },
  { key: "proRegistration", label: "PRO / collecting society registration", type: "select", options: RIGHTS_STATUS_OPTIONS.registration, required: true },
  { key: "royaltyCollection", label: "Royalty collection set up", type: "select", options: RIGHTS_STATUS_OPTIONS.registration, required: true },
  { key: "collectionServices", label: "Collection services", type: "text", placeholder: "GEMA, PRS, SoundExchange, publishing admin…" },
  { key: "openQuestions", label: "Unresolved questions", type: "textarea" },
  { key: "notes", label: "Notes", type: "textarea" },
];

export const RELEASE_FIELDS: FieldDef[] = [
  { key: "title", label: "Release title", type: "text", required: true },
  { key: "releaseType", label: "Release type", type: "select", options: RELEASE_TYPES, required: true },
  { key: "status", label: "Status", type: "select", options: RELEASE_STATUSES, allowCustom: true, required: true },
  { key: "primaryArtist", label: "Primary artist", type: "text" },
  { key: "featuredArtists", label: "Featured artists", type: "tags" },
  { key: "releaseDate", label: "Release date", type: "date" },
  { key: "releaseDateConfirmed", label: "Release date confirmed", type: "boolean", placeholder: "Release date is confirmed" },
  { key: "submissionDeadline", label: "Distributor submission deadline", type: "date" },
  { key: "distributor", label: "Distributor", type: "select", options: DISTRIBUTORS, allowCustom: true },
  { key: "genre", label: "Genre", type: "select", options: GENRES, allowCustom: true },
  { key: "language", label: "Language", type: "text" },
  { key: "explicit", label: "Explicit", type: "tristate" },
  { key: "upc", label: "UPC / EAN", type: "text" },
  { key: "preSaveUrl", label: "Pre-save link", type: "url" },
  { key: "smartLinkUrl", label: "Smart link", type: "url" },
  { key: "strategy", label: "Release strategy", type: "textarea" },
  { key: "notes", label: "Notes & issues", type: "textarea" },
];

export const CAMPAIGN_FIELDS: FieldDef[] = [
  { key: "name", label: "Campaign name", type: "text", required: true },
  rel("releaseId", "Release"),
  rel("trackId", "Track being promoted"),
  { key: "template", label: "Campaign plan template", type: "select", options: CAMPAIGN_TEMPLATES },
  { key: "objective", label: "Objective", type: "select", options: CAMPAIGN_OBJECTIVES, allowCustom: true },
  { key: "status", label: "Status", type: "select", options: CAMPAIGN_STATUSES, required: true },
  { key: "startDate", label: "Start date", type: "date" },
  { key: "endDate", label: "End date", type: "date" },
  { key: "budget", label: "Budget", type: "money", important: true },
  { key: "currency", label: "Currency", type: "currency" },
  { key: "channels", label: "Channels", type: "multiselect", options: CHANNELS },
  { key: "targetAudience", label: "Target audience", type: "textarea" },
  { key: "message", label: "Main promotional message", type: "textarea" },
  { key: "creativeDirection", label: "Creative direction", type: "textarea" },
  { key: "contentStrategy", label: "Content strategy", type: "textarea" },
  { key: "outreachStrategy", label: "Outreach strategy", type: "textarea" },
  { key: "successMetrics", label: "Success metrics", type: "textarea" },
  { key: "results", label: "Results (recorded)", type: "textarea" },
  { key: "notes", label: "Notes", type: "textarea" },
];

export const AD_FIELDS: FieldDef[] = [
  { key: "platform", label: "Platform", type: "select", options: ["Meta (Instagram/Facebook)", "TikTok", "YouTube / Google", "Spotify Marquee", "Spotify Showcase", "Other"], allowCustom: true, required: true },
  { key: "name", label: "Ad name", type: "text", required: true },
  { key: "plannedSpend", label: "Planned spend", type: "money", required: true, important: true },
  { key: "currency", label: "Currency", type: "currency" },
  { key: "startDate", label: "Start", type: "date" },
  { key: "endDate", label: "End", type: "date" },
  { key: "targeting", label: "Audience targeting notes", type: "textarea" },
  { key: "creativeNotes", label: "Creative assets", type: "textarea" },
];

export const AD_RESULT_FIELDS: FieldDef[] = [
  { key: "actualSpend", label: "Actual spend", type: "money", important: true },
  { key: "impressions", label: "Impressions", type: "number", min: 0 },
  { key: "clicks", label: "Clicks", type: "number", min: 0 },
  { key: "conversions", label: "Conversions", type: "number", min: 0 },
  { key: "resultLabel", label: "What counts as a result", type: "text", placeholder: "e.g. Spotify link clicks" },
  { key: "notes", label: "Recorded outcome", type: "textarea" },
];

export const CONTENT_FIELDS: FieldDef[] = [
  { key: "title", label: "Title", type: "text", required: true },
  rel("campaignId", "Campaign"),
  rel("trackId", "Track"),
  { key: "platform", label: "Platform", type: "select", options: CONTENT_PLATFORMS, allowCustom: true },
  { key: "format", label: "Format", type: "select", options: CONTENT_FORMATS, allowCustom: true },
  { key: "stage", label: "Stage", type: "select", options: CONTENT_STAGES, allowCustom: true, required: true },
  { key: "plannedDate", label: "Planned publication date", type: "date" },
  { key: "plannedTime", label: "Time", type: "text", placeholder: "18:00" },
  { key: "responsible", label: "Responsible person", type: "text" },
  { key: "caption", label: "Caption", type: "textarea" },
  { key: "hashtags", label: "Hashtags", type: "text" },
  { key: "callToAction", label: "Call to action", type: "text" },
  { key: "script", label: "Script / concept", type: "textarea" },
  { key: "assetUrl", label: "Asset location (link)", type: "url" },
  { key: "publishedUrl", label: "Published post link", type: "url" },
  { key: "notes", label: "Notes", type: "textarea" },
];

export const TASK_FIELDS: FieldDef[] = [
  { key: "title", label: "Title", type: "text", required: true, maxLength: 300 },
  { key: "status", label: "Status", type: "select", options: TASK_STATUSES, required: true },
  { key: "priority", label: "Priority", type: "select", options: PRIORITIES, required: true },
  { key: "dueDate", label: "Due date", type: "date" },
  { key: "startDate", label: "Start date", type: "date" },
  { key: "assignee", label: "Assigned to", type: "text" },
  rel("projectId", "Project"),
  rel("trackId", "Track"),
  rel("releaseId", "Release"),
  rel("campaignId", "Campaign"),
  { key: "phaseKey", label: "Phase", type: "select", options: PHASE_OPTIONS },
  { key: "estimatedMinutes", label: "Estimated duration (minutes)", type: "number", min: 0 },
  { key: "actualMinutes", label: "Actual duration (minutes)", type: "number", min: 0 },
  { key: "recurrence", label: "Repeats", type: "select", options: [{ value: "weekly", label: "Weekly" }, { value: "monthly", label: "Monthly" }, { value: "quarterly", label: "Quarterly" }] },
  { key: "description", label: "Description", type: "textarea" },
  { key: "completionCriteria", label: "Completion criteria", type: "textarea" },
  { key: "notes", label: "Notes", type: "textarea" },
];

export const PROJECT_FIELDS: FieldDef[] = [
  { key: "name", label: "Project name", type: "text", required: true },
  {
    key: "kind",
    label: "Type",
    type: "select",
    required: true,
    options: [
      { value: "general", label: "General" },
      { value: "release", label: "Release" },
      { value: "campaign", label: "Campaign" },
      { value: "strategy", label: "Strategy" },
      { value: "live", label: "Live / DJ" },
      { value: "merch", label: "Merchandise" },
      { value: "website", label: "Website" },
    ],
  },
  { key: "status", label: "Status", type: "select", required: true, options: ["planning", "active", "on_hold", "completed", "archived"].map((v) => ({ value: v, label: v.replace("_", " ").replace(/^\w/, (c) => c.toUpperCase()) })) },
  { key: "phaseKey", label: "Phase", type: "select", options: PHASE_OPTIONS },
  { key: "startDate", label: "Start date", type: "date" },
  { key: "targetDate", label: "Target date", type: "date" },
  { key: "budget", label: "Budget (EUR)", type: "money", important: true },
  rel("goalId", "Related goal"),
  { key: "description", label: "Description", type: "textarea" },
];

export const GOAL_FIELDS: FieldDef[] = [
  { key: "title", label: "Goal", type: "text", required: true },
  {
    key: "category",
    label: "Category",
    type: "select",
    required: true,
    options: ["career", "audience", "streaming", "revenue", "release", "marketing", "performance", "collaboration", "business"].map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) })),
  },
  {
    key: "horizon",
    label: "Horizon",
    type: "select",
    required: true,
    options: [
      { value: "short", label: "Short term" },
      { value: "medium", label: "Medium term" },
      { value: "long", label: "Long term" },
      { value: "quarterly", label: "Quarterly" },
      { value: "annual", label: "Annual" },
    ],
  },
  { key: "metric", label: "Measured by", type: "text", placeholder: "Spotify monthly listeners" },
  { key: "targetValue", label: "Target value", type: "number" },
  { key: "currentValue", label: "Current value", type: "number" },
  { key: "unit", label: "Unit", type: "text", placeholder: "listeners, EUR, shows…" },
  { key: "deadline", label: "Deadline", type: "date" },
  { key: "status", label: "Status", type: "select", required: true, options: ["active", "achieved", "paused", "dropped"].map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) })) },
  { key: "notes", label: "Notes", type: "textarea" },
];

export const CONTACT_FIELDS: FieldDef[] = [
  { key: "name", label: "Name", type: "text", required: true },
  { key: "organization", label: "Organization", type: "text" },
  { key: "role", label: "Role", type: "text" },
  { key: "category", label: "Category", type: "select", options: CONTACT_CATEGORIES, required: true },
  { key: "pipelineStatus", label: "Relationship / outreach status", type: "select", options: PIPELINE_STATUSES, required: true },
  { key: "email", label: "Email", type: "email" },
  { key: "phone", label: "Phone", type: "text" },
  { key: "website", label: "Website", type: "url" },
  { key: "instagram", label: "Instagram", type: "text", placeholder: "@handle or link" },
  { key: "soundcloud", label: "SoundCloud / other", type: "text" },
  { key: "location", label: "Location", type: "text" },
  { key: "isTeamMember", label: "Team member", type: "boolean", placeholder: "Part of my current team / collaborators" },
  { key: "lastContactDate", label: "Last contact", type: "date" },
  { key: "nextFollowUpDate", label: "Next follow-up", type: "date" },
  { key: "notes", label: "Notes", type: "textarea" },
];

export const OUTREACH_FIELDS: FieldDef[] = [
  { key: "date", label: "Date", type: "date", required: true },
  { key: "kind", label: "Type", type: "select", options: OUTREACH_KINDS, required: true },
  { key: "channel", label: "Channel", type: "select", options: ["email", "instagram", "phone", "in person", "other"], required: true },
  { key: "status", label: "Status", type: "select", required: true, options: [{ value: "draft", label: "Draft (not sent)" }, { value: "sent", label: "Sent (confirmed by me)" }, { value: "replied", label: "Replied" }, { value: "no_reply", label: "No reply" }] },
  { key: "subject", label: "Subject", type: "text" },
  { key: "message", label: "Message", type: "textarea" },
  { key: "notes", label: "Notes", type: "textarea" },
];

export const TRANSACTION_FIELDS: FieldDef[] = [
  { key: "kind", label: "Type", type: "select", required: true, options: [{ value: "income", label: "Income" }, { value: "expense", label: "Expense" }] },
  { key: "category", label: "Category", type: "select", options: [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES], allowCustom: true, required: true },
  { key: "description", label: "Description", type: "text", required: true },
  { key: "amount", label: "Amount", type: "money", required: true, important: true },
  { key: "currency", label: "Currency", type: "currency", required: true },
  { key: "date", label: "Date", type: "date", required: true },
  { key: "nature", label: "Nature", type: "select", options: TX_NATURES, required: true, help: "Only “actual” values appear in actual revenue and expense totals." },
  { key: "paymentStatus", label: "Payment status", type: "select", options: PAYMENT_STATUSES, required: true },
  { key: "counterparty", label: "Paid to / received from", type: "text" },
  { key: "fxRate", label: "Exchange rate to base currency", type: "number", min: 0, help: "Only for foreign currencies: 1 unit = ? base currency" },
  { key: "fxSource", label: "Exchange rate source", type: "text", placeholder: "ECB reference rate" },
  { key: "fxDate", label: "Exchange rate date", type: "date" },
  rel("trackId", "Track"),
  rel("releaseId", "Release"),
  rel("campaignId", "Campaign"),
  rel("projectId", "Project"),
  rel("documentId", "Receipt / invoice"),
  { key: "notes", label: "Notes", type: "textarea" },
];

export const BUDGET_FIELDS: FieldDef[] = [
  { key: "name", label: "Budget name", type: "text", required: true },
  {
    key: "scope",
    label: "Scope",
    type: "select",
    required: true,
    options: [
      { value: "monthly", label: "Monthly operations" },
      { value: "release", label: "Release" },
      { value: "campaign", label: "Campaign" },
      { value: "project", label: "Project" },
      { value: "merch", label: "Merchandise" },
      { value: "other", label: "Other" },
    ],
  },
  { key: "amount", label: "Amount", type: "money", required: true, important: true },
  { key: "currency", label: "Currency", type: "currency", required: true },
  { key: "category", label: "Only this expense category", type: "select", options: EXPENSE_CATEGORIES },
  { key: "periodStart", label: "Period start", type: "date" },
  { key: "periodEnd", label: "Period end", type: "date" },
  rel("releaseId", "Release"),
  rel("campaignId", "Campaign"),
  rel("projectId", "Project"),
  { key: "notes", label: "Notes", type: "textarea" },
];

export const DOCUMENT_FIELDS: FieldDef[] = [
  { key: "title", label: "Title", type: "text", required: true },
  { key: "category", label: "Category", type: "select", options: DOCUMENT_CATEGORIES, required: true },
  { key: "tags", label: "Tags", type: "tags" },
  { key: "externalUrl", label: "External link (instead of upload)", type: "url" },
  rel("trackId", "Track"),
  rel("releaseId", "Release"),
  rel("campaignId", "Campaign"),
  rel("contactId", "Contact"),
  { key: "sensitive", label: "Sensitive", type: "boolean", placeholder: "Sensitive (hidden from search previews and the AI assistant)" },
  { key: "notes", label: "Notes", type: "textarea" },
];

export const ANALYTICS_FIELDS: FieldDef[] = [
  { key: "metric", label: "Metric", type: "select", options: METRICS, required: true },
  { key: "value", label: "Value", type: "number", required: true, min: 0 },
  { key: "platform", label: "Platform / source", type: "select", options: [...PLATFORMS, "Meta Ads", "TikTok Ads", "Google Ads", "Distributor", "Other"], allowCustom: true, required: true },
  { key: "periodStart", label: "Period start", type: "date" },
  { key: "periodEnd", label: "Period end (or date)", type: "date", required: true },
  { key: "verification", label: "Verification", type: "select", options: VERIFICATION, required: true },
  rel("trackId", "Track"),
  rel("releaseId", "Release"),
  rel("campaignId", "Campaign"),
  { key: "notes", label: "Notes", type: "text" },
];

export const PLACEMENT_FIELDS: FieldDef[] = [
  { key: "playlistName", label: "Playlist", type: "text", required: true },
  { key: "platform", label: "Platform", type: "select", options: ["Spotify", "Apple Music", "YouTube Music", "Deezer", "SoundCloud", "Amazon Music", "Other"], allowCustom: true, required: true },
  rel("trackId", "Track"),
  { key: "curator", label: "Curator", type: "text" },
  { key: "followers", label: "Playlist followers", type: "number", min: 0 },
  { key: "addedDate", label: "Added", type: "date" },
  { key: "removedDate", label: "Removed", type: "date" },
  { key: "url", label: "Link", type: "url" },
  { key: "verification", label: "Verification", type: "select", options: VERIFICATION, required: true },
];

export const REVIEW_FIELDS: FieldDef[] = [
  { key: "summary", label: "Performance summary (from recorded data)", type: "textarea", required: true },
  { key: "lessons", label: "Lessons learned", type: "textarea" },
  { key: "followUps", label: "Follow-up actions", type: "textarea", help: "One per line — each becomes a task." },
];

export const MILESTONE_FIELDS: FieldDef[] = [
  { key: "title", label: "Milestone", type: "text", required: true },
  { key: "dueDate", label: "Due", type: "date" },
];

export const FEEDBACK_FIELDS: FieldDef[] = [
  { key: "source", label: "From", type: "text", required: true, placeholder: "Mix engineer, friend, A&R…" },
  { key: "note", label: "Feedback", type: "textarea", required: true },
];

export const SETTINGS_FIELDS: FieldDef[] = [
  { key: "currency", label: "Base currency", type: "select", options: CURRENCIES, required: true, help: "Totals and reports use this currency." },
  { key: "timezone", label: "Time zone", type: "text", required: true, help: "IANA name, e.g. Europe/Berlin" },
  { key: "language", label: "Language", type: "select", options: [{ value: "en", label: "English" }], required: true },
  { key: "theme", label: "Theme", type: "select", options: [{ value: "dark", label: "Dark (default)" }, { value: "light", label: "Light" }], required: true },
];
