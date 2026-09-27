/**
 * MAYFAR ARTIST MANAGER — relational data model.
 *
 * Conventions
 * - Every business record belongs to a user (`user_id`) and every query is scoped by it.
 * - Date-only values (deadlines, release dates) are stored as `date` strings (YYYY-MM-DD)
 *   so they never shift across time zones. Instants use `timestamptz`.
 * - Money is stored as numeric with its original currency; converted values keep the
 *   exchange rate, its source and date.
 * - Status columns are text (validated in the app) so users can add custom statuses.
 * - `is_demo` marks clearly-labelled sample data that can be removed in one step.
 */
import { relations, sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());
const owner = () =>
  uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" });
const money = (name: string) => numeric(name, { precision: 14, scale: 2, mode: "number" });
const isDemo = () => boolean("is_demo").notNull().default(false);

// ─── Identity & access ──────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("owner"), // owner | collaborator (future)
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(), // sha256 of the cookie token — raw token never stored
    userId: owner(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const userSettings = pgTable("user_settings", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  currency: text("currency").notNull().default("EUR"),
  timezone: text("timezone").notNull().default("Europe/Berlin"),
  dateFormat: text("date_format").notNull().default("dd MMM yyyy"),
  language: text("language").notNull().default("en"),
  theme: text("theme").notNull().default("dark"),
  notificationPrefs: jsonb("notification_prefs").$type<Record<string, boolean>>().notNull().default({}),
  /** Custom status lists per entity kind, e.g. { track: ["Idea", "Sketch"] } */
  customStatuses: jsonb("custom_statuses").$type<Record<string, string[]>>().notNull().default({}),
  /** Custom track workflow stages (ordered). Empty = default workflow. */
  trackWorkflow: jsonb("track_workflow").$type<string[]>().notNull().default([]),
  updatedAt: updatedAt(),
});

// ─── Artist profile & goals ─────────────────────────────────────────────────

export type GoalsSection = Partial<{
  mainObjective: string;
  shortTerm: string;
  mediumTerm: string;
  longTerm: string;
  audienceTarget: string;
  streamingTarget: string;
  releaseFrequency: string;
  marketingGoals: string;
  revenueTarget: string;
  performanceGoals: string;
  collaborationGoals: string;
  businessGoals: string;
}>;
export type MusicIdentitySection = Partial<{
  mainGenres: string[];
  secondaryGenres: string[];
  bpmRange: string;
  influences: string;
  productionStyle: string;
  vocalPreferences: string;
  mood: string;
  targetAudience: string;
  mainPlatforms: string[];
  releaseFormats: string[];
}>;
export type CatalogSummarySection = Partial<{
  releasedCount: number;
  unreleasedCount: number;
  inProduction: string;
  readyForRelease: string;
  hasCollaborations: string;
  hasContracts: string;
  distributors: string[];
}>;
export type BusinessSection = Partial<{
  monthlyBudget: number;
  marketingBudget: number;
  monthlyExpenses: number;
  revenueSources: string[];
  subscriptions: string;
  distributorCosts: number;
  productionExpenses: number;
  advertisingExpenses: number;
  financialTargets: string;
}>;
export type TeamSection = Partial<{ summary: string; roles: string[] }>;
export type WorkflowPrefsSection = Partial<{
  productionSoftware: string[];
  distributionServices: string[];
  designTools: string[];
  aiTools: string[];
  pmTools: string[];
  workdays: string[];
  workingHours: string;
  reminderFrequency: string;
  releasePlanningWeeks: number;
}>;

export const artistProfiles = pgTable("artist_profiles", {
  id: id(),
  userId: owner().unique(),
  artistName: text("artist_name"),
  legalName: text("legal_name"),
  bio: text("bio"),
  country: text("country"),
  city: text("city"),
  contactEmail: text("contact_email"),
  website: text("website"),
  imageUrl: text("image_url"),
  logoUrl: text("logo_url"),
  genres: text("genres").array().notNull().default(sql`'{}'::text[]`),
  artisticDirection: text("artistic_direction"),
  brandConcept: text("brand_concept"),
  brandPhrase: text("brand_phrase"),
  visualIdentity: text("visual_identity"),
  languages: text("languages").array().notNull().default(sql`'{}'::text[]`),
  careerStage: text("career_stage"),
  goals: jsonb("goals").$type<GoalsSection>().notNull().default({}),
  musicIdentity: jsonb("music_identity").$type<MusicIdentitySection>().notNull().default({}),
  catalogSummary: jsonb("catalog_summary").$type<CatalogSummarySection>().notNull().default({}),
  business: jsonb("business").$type<BusinessSection>().notNull().default({}),
  team: jsonb("team").$type<TeamSection>().notNull().default({}),
  workflowPrefs: jsonb("workflow_prefs").$type<WorkflowPrefsSection>().notNull().default({}),
  /** Onboarding steps the user has saved or skipped. */
  onboardingSteps: jsonb("onboarding_steps").$type<Record<string, "saved" | "skipped">>().notNull().default({}),
  onboardingCompletedAt: timestamp("onboarding_completed_at", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** Public profile links (separate from authorized integrations). */
export const platformLinks = pgTable(
  "platform_links",
  {
    id: id(),
    userId: owner(),
    platform: text("platform").notNull(),
    url: text("url"),
    handle: text("handle"),
    accountId: text("account_id"),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("platform_links_user_platform").on(t.userId, t.platform)],
);

export const goals = pgTable(
  "goals",
  {
    id: id(),
    userId: owner(),
    title: text("title").notNull(),
    category: text("category").notNull().default("career"), // career | audience | streaming | revenue | release | marketing | performance | collaboration | business
    horizon: text("horizon").notNull().default("short"), // short | medium | long | quarterly | annual
    metric: text("metric"),
    targetValue: numeric("target_value", { precision: 16, scale: 2, mode: "number" }),
    currentValue: numeric("current_value", { precision: 16, scale: 2, mode: "number" }),
    unit: text("unit"),
    deadline: date("deadline", { mode: "string" }),
    status: text("status").notNull().default("active"), // active | achieved | paused | dropped
    notes: text("notes"),
    isDemo: isDemo(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("goals_user_idx").on(t.userId)],
);

// ─── Contacts & collaborators ───────────────────────────────────────────────

export const contacts = pgTable(
  "contacts",
  {
    id: id(),
    userId: owner(),
    name: text("name").notNull(),
    organization: text("organization"),
    role: text("role"),
    category: text("category").notNull().default("other"),
    email: text("email"),
    phone: text("phone"),
    website: text("website"),
    socials: jsonb("socials").$type<Record<string, string>>().notNull().default({}),
    location: text("location"),
    isTeamMember: boolean("is_team_member").notNull().default(false),
    pipelineStatus: text("pipeline_status").notNull().default("potential"),
    lastContactDate: date("last_contact_date", { mode: "string" }),
    nextFollowUpDate: date("next_follow_up_date", { mode: "string" }),
    notes: text("notes"),
    isDemo: isDemo(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("contacts_user_idx").on(t.userId)],
);

export const outreachRecords = pgTable(
  "outreach_records",
  {
    id: id(),
    userId: owner(),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    date: date("date", { mode: "string" }).notNull(),
    channel: text("channel").notNull().default("email"),
    kind: text("kind").notNull().default("other"), // collaboration | dj_promo | booking | label_submission | follow_up | partnership | other
    subject: text("subject"),
    message: text("message"),
    /** draft | sent (confirmed by user) | replied | no_reply */
    status: text("status").notNull().default("draft"),
    draftedByAi: boolean("drafted_by_ai").notNull().default(false),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("outreach_contact_idx").on(t.contactId)],
);

// ─── Projects ───────────────────────────────────────────────────────────────

export const projects = pgTable(
  "projects",
  {
    id: id(),
    userId: owner(),
    name: text("name").notNull(),
    description: text("description"),
    kind: text("kind").notNull().default("general"), // general | release | campaign | strategy | merch | live | website
    phaseKey: text("phase_key"),
    status: text("status").notNull().default("active"), // planning | active | on_hold | completed | archived
    startDate: date("start_date", { mode: "string" }),
    targetDate: date("target_date", { mode: "string" }),
    budget: money("budget"),
    goalId: uuid("goal_id").references(() => goals.id, { onDelete: "set null" }),
    isDemo: isDemo(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("projects_user_idx").on(t.userId)],
);

export const milestones = pgTable("milestones", {
  id: id(),
  userId: owner(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  dueDate: date("due_date", { mode: "string" }),
  done: boolean("done").notNull().default(false),
  createdAt: createdAt(),
});

// ─── Music catalog ──────────────────────────────────────────────────────────

export const tracks = pgTable(
  "tracks",
  {
    id: id(),
    userId: owner(),
    projectCode: text("project_code").notNull(),
    title: text("title").notNull(),
    primaryArtist: text("primary_artist"),
    featuredArtists: text("featured_artists").array().notNull().default(sql`'{}'::text[]`),
    genre: text("genre"),
    subgenre: text("subgenre"),
    bpm: numeric("bpm", { precision: 6, scale: 2, mode: "number" }),
    musicalKey: text("musical_key"),
    mood: text("mood"),
    language: text("language"),
    durationSec: integer("duration_sec"),
    isrc: text("isrc"),
    lyrics: text("lyrics"),
    productionNotes: text("production_notes"),
    explicit: text("explicit").notNull().default("unknown"), // yes | no | unknown
    status: text("status").notNull().default("Idea"),
    workflowStage: text("workflow_stage").notNull().default("Idea"),
    plannedReleaseDate: date("planned_release_date", { mode: "string" }),
    actualReleaseDate: date("actual_release_date", { mode: "string" }),
    /** Known collaborator situation: none | yes | unknown */
    hasCollaborators: text("has_collaborators").notNull().default("unknown"),
    isDemo: isDemo(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("tracks_user_idx").on(t.userId), uniqueIndex("tracks_user_code").on(t.userId, t.projectCode)],
);

/** Audio & creative asset versions of a track. Files live in object storage (documents). */
export const trackVersions = pgTable(
  "track_versions",
  {
    id: id(),
    userId: owner(),
    trackId: uuid("track_id")
      .notNull()
      .references(() => tracks.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // demo | project | stems | vocals | instrumental | mix | master | artwork | clip | video | reference
    label: text("label").notNull(),
    documentId: uuid("document_id").references((): AnyPgColumn => documents.id, { onDelete: "set null" }),
    externalUrl: text("external_url"),
    notes: text("notes"),
    approved: boolean("approved").notNull().default(false),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("track_versions_track_idx").on(t.trackId)],
);

export const trackCollaborators = pgTable(
  "track_collaborators",
  {
    id: id(),
    userId: owner(),
    trackId: uuid("track_id")
      .notNull()
      .references(() => tracks.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    role: text("role").notNull(), // producer | co-producer | vocalist | songwriter | lyricist | mix engineer | mastering engineer | featured artist | musician
    credited: boolean("credited").notNull().default(true),
    notes: text("notes"),
    createdAt: createdAt(),
  },
  (t) => [index("track_collab_track_idx").on(t.trackId)],
);

export const feedbackNotes = pgTable("feedback_notes", {
  id: id(),
  userId: owner(),
  trackId: uuid("track_id")
    .notNull()
    .references(() => tracks.id, { onDelete: "cascade" }),
  source: text("source").notNull(),
  note: text("note").notNull(),
  resolved: boolean("resolved").notNull().default(false),
  createdAt: createdAt(),
});

// ─── Rights & royalties ─────────────────────────────────────────────────────

/** One rights record per track: registrations, samples, agreements. */
export const rightsRecords = pgTable("rights_records", {
  id: id(),
  userId: owner(),
  trackId: uuid("track_id")
    .notNull()
    .unique()
    .references(() => tracks.id, { onDelete: "cascade" }),
  /** unknown | none | yes */
  samplesUsed: text("samples_used").notNull().default("unknown"),
  sampleDetails: text("sample_details"),
  /** not_needed | missing | requested | cleared */
  sampleLicenseStatus: text("sample_license_status").notNull().default("not_needed"),
  /** unknown | not_needed | draft | sent | signed */
  agreementStatus: text("agreement_status").notNull().default("unknown"),
  /** not_started | in_progress | registered (only when user confirms) */
  copyrightRegistration: text("copyright_registration").notNull().default("not_started"),
  proRegistration: text("pro_registration").notNull().default("not_started"),
  royaltyCollection: text("royalty_collection").notNull().default("not_started"),
  collectionServices: text("collection_services"),
  openQuestions: text("open_questions"),
  notes: text("notes"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const ownershipSplits = pgTable(
  "ownership_splits",
  {
    id: id(),
    userId: owner(),
    trackId: uuid("track_id")
      .notNull()
      .references(() => tracks.id, { onDelete: "cascade" }),
    rightType: text("right_type").notNull(), // composition | master
    holderName: text("holder_name").notNull(),
    contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "set null" }),
    role: text("role"),
    percentage: numeric("percentage", { precision: 6, scale: 3, mode: "number" }).notNull(),
    confirmed: boolean("confirmed").notNull().default(false),
    agreementDocumentId: uuid("agreement_document_id").references((): AnyPgColumn => documents.id, { onDelete: "set null" }),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("splits_track_idx").on(t.trackId)],
);

// ─── Releases ───────────────────────────────────────────────────────────────

export const releases = pgTable(
  "releases",
  {
    id: id(),
    userId: owner(),
    title: text("title").notNull(),
    releaseType: text("release_type").notNull().default("single"), // single | ep | album | remix | compilation
    primaryArtist: text("primary_artist"),
    featuredArtists: text("featured_artists").array().notNull().default(sql`'{}'::text[]`),
    releaseDate: date("release_date", { mode: "string" }),
    releaseDateConfirmed: boolean("release_date_confirmed").notNull().default(false),
    submissionDeadline: date("submission_deadline", { mode: "string" }),
    status: text("status").notNull().default("Planning"),
    distributor: text("distributor"),
    upc: text("upc"),
    genre: text("genre"),
    language: text("language"),
    explicit: text("explicit").notNull().default("unknown"),
    strategy: text("strategy"),
    coverDocumentId: uuid("cover_document_id").references((): AnyPgColumn => documents.id, { onDelete: "set null" }),
    coverApproved: boolean("cover_approved").notNull().default(false),
    preSaveUrl: text("pre_save_url"),
    smartLinkUrl: text("smart_link_url"),
    promoLinks: jsonb("promo_links").$type<Record<string, string>>().notNull().default({}),
    /** Checklist preferences chosen in the wizard (e.g. wants campaign, pre-save). */
    preferences: jsonb("preferences").$type<Record<string, boolean>>().notNull().default({}),
    notes: text("notes"),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    isDemo: isDemo(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("releases_user_idx").on(t.userId), index("releases_date_idx").on(t.releaseDate)],
);

export const releaseTracks = pgTable(
  "release_tracks",
  {
    releaseId: uuid("release_id")
      .notNull()
      .references(() => releases.id, { onDelete: "cascade" }),
    trackId: uuid("track_id")
      .notNull()
      .references(() => tracks.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(1),
  },
  (t) => [primaryKey({ columns: [t.releaseId, t.trackId] })],
);

/** Generic checklist items for releases, release-day execution and phases. */
export const checklistItems = pgTable(
  "checklist_items",
  {
    id: id(),
    userId: owner(),
    parentType: text("parent_type").notNull(), // release | execution | phase | campaign
    parentId: text("parent_id").notNull(),
    key: text("key").notNull(),
    label: text("label").notNull(),
    description: text("description"),
    required: boolean("required").notNull().default(true),
    /** Items whose completion is an action outside the app need explicit user confirmation. */
    external: boolean("external").notNull().default(false),
    /** pending | done | not_applicable */
    status: text("status").notNull().default("pending"),
    /** Auto items are derived from stored data; manual items are ticked by the user. */
    auto: boolean("auto").notNull().default(false),
    dueDate: date("due_date", { mode: "string" }),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("checklist_parent_idx").on(t.parentType, t.parentId),
    uniqueIndex("checklist_parent_key").on(t.parentType, t.parentId, t.key),
  ],
);

export const releaseReviews = pgTable(
  "release_reviews",
  {
    id: id(),
    userId: owner(),
    releaseId: uuid("release_id")
      .notNull()
      .references(() => releases.id, { onDelete: "cascade" }),
    period: text("period").notNull(), // 24h | 7d | 30d | 90d | custom label
    dueDate: date("due_date", { mode: "string" }).notNull(),
    status: text("status").notNull().default("pending"), // pending | completed | skipped
    summary: text("summary"),
    lessons: text("lessons"),
    followUps: text("follow_ups"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("reviews_release_idx").on(t.releaseId)],
);

// ─── Marketing & content ────────────────────────────────────────────────────

export const campaigns = pgTable(
  "campaigns",
  {
    id: id(),
    userId: owner(),
    name: text("name").notNull(),
    releaseId: uuid("release_id").references(() => releases.id, { onDelete: "set null" }),
    trackId: uuid("track_id").references(() => tracks.id, { onDelete: "set null" }),
    template: text("template"), // pre_release | release_week | post_release | music_video | audience_growth | merch | branding
    objective: text("objective"),
    targetAudience: text("target_audience"),
    budget: money("budget"),
    currency: text("currency").notNull().default("EUR"),
    startDate: date("start_date", { mode: "string" }),
    endDate: date("end_date", { mode: "string" }),
    channels: text("channels").array().notNull().default(sql`'{}'::text[]`),
    creativeDirection: text("creative_direction"),
    message: text("message"),
    contentStrategy: text("content_strategy"),
    outreachStrategy: text("outreach_strategy"),
    successMetrics: text("success_metrics"),
    status: text("status").notNull().default("Planning"), // Planning | Ready | Active | Paused | Completed | Archived
    results: text("results"),
    notes: text("notes"),
    isDemo: isDemo(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("campaigns_user_idx").on(t.userId)],
);

export const adCampaigns = pgTable(
  "ad_campaigns",
  {
    id: id(),
    userId: owner(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    platform: text("platform").notNull(),
    name: text("name").notNull(),
    plannedSpend: money("planned_spend"),
    actualSpend: money("actual_spend"),
    currency: text("currency").notNull().default("EUR"),
    startDate: date("start_date", { mode: "string" }),
    endDate: date("end_date", { mode: "string" }),
    targeting: text("targeting"),
    creativeNotes: text("creative_notes"),
    impressions: integer("impressions"),
    clicks: integer("clicks"),
    conversions: integer("conversions"),
    resultLabel: text("result_label"),
    /** Spending requires explicit approval: draft | approved | running | ended */
    status: text("status").notNull().default("draft"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    dataSource: text("data_source").notNull().default("manual"),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("ads_campaign_idx").on(t.campaignId)],
);

export const contentItems = pgTable(
  "content_items",
  {
    id: id(),
    userId: owner(),
    title: text("title").notNull(),
    campaignId: uuid("campaign_id").references(() => campaigns.id, { onDelete: "set null" }),
    trackId: uuid("track_id").references(() => tracks.id, { onDelete: "set null" }),
    platform: text("platform"),
    format: text("format"),
    caption: text("caption"),
    hashtags: text("hashtags"),
    callToAction: text("call_to_action"),
    script: text("script"),
    assetUrl: text("asset_url"),
    documentId: uuid("document_id").references((): AnyPgColumn => documents.id, { onDelete: "set null" }),
    plannedDate: date("planned_date", { mode: "string" }),
    plannedTime: text("planned_time"),
    stage: text("stage").notNull().default("Idea"),
    approvalStatus: text("approval_status").notNull().default("not_requested"), // not_requested | pending | approved | changes_requested
    responsible: text("responsible"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    publishedUrl: text("published_url"),
    metrics: jsonb("metrics").$type<Record<string, number>>().notNull().default({}),
    metricsSource: text("metrics_source"),
    notes: text("notes"),
    isDemo: isDemo(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("content_user_idx").on(t.userId), index("content_date_idx").on(t.plannedDate)],
);

// ─── Tasks ──────────────────────────────────────────────────────────────────

export const tasks = pgTable(
  "tasks",
  {
    id: id(),
    userId: owner(),
    title: text("title").notNull(),
    description: text("description"),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    trackId: uuid("track_id").references(() => tracks.id, { onDelete: "set null" }),
    releaseId: uuid("release_id").references(() => releases.id, { onDelete: "set null" }),
    campaignId: uuid("campaign_id").references(() => campaigns.id, { onDelete: "set null" }),
    contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "set null" }),
    phaseKey: text("phase_key"),
    priority: text("priority").notNull().default("medium"), // low | medium | high | urgent
    status: text("status").notNull().default("planned"),
    dueDate: date("due_date", { mode: "string" }),
    startDate: date("start_date", { mode: "string" }),
    assignee: text("assignee"),
    estimatedMinutes: integer("estimated_minutes"),
    actualMinutes: integer("actual_minutes"),
    notes: text("notes"),
    completionCriteria: text("completion_criteria"),
    /** manual | template | information | automation | assistant */
    source: text("source").notNull().default("manual"),
    /** Stable key for generated tasks so they are never duplicated. */
    sourceKey: text("source_key"),
    recurrence: text("recurrence"), // weekly | monthly | quarterly
    completedAt: timestamp("completed_at", { withTimezone: true }),
    isDemo: isDemo(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("tasks_user_idx").on(t.userId),
    index("tasks_due_idx").on(t.dueDate),
    uniqueIndex("tasks_user_source_key").on(t.userId, t.sourceKey),
  ],
);

export const taskDependencies = pgTable(
  "task_dependencies",
  {
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    dependsOnId: uuid("depends_on_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.taskId, t.dependsOnId] })],
);

// ─── Workflow phases & information engine ───────────────────────────────────

/** Per-user state of each business phase (definitions live in code: lib/workflow). */
export const phaseStates = pgTable(
  "phase_states",
  {
    id: id(),
    userId: owner(),
    phaseKey: text("phase_key").notNull(),
    status: text("status").notNull().default("not_started"), // not_started | active | completed | paused
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    notes: text("notes"),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("phase_states_user_phase").on(t.userId, t.phaseKey)],
);

/**
 * Metadata for individual information fields (requirement definitions live in code).
 * Values themselves stay in their entity tables — this table only records
 * status overrides (not applicable / needs confirmation), provenance and history.
 */
export const infoFieldMeta = pgTable(
  "info_field_meta",
  {
    id: id(),
    userId: owner(),
    entityType: text("entity_type").notNull(), // profile | track | release | campaign | business
    entityId: text("entity_id").notNull(),
    fieldKey: text("field_key").notNull(),
    /** not_applicable | needs_confirmation | null */
    override: text("override"),
    /** user | assistant | import | estimate | integration */
    source: text("source").notNull().default("user"),
    previousValue: jsonb("previous_value"),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("info_meta_field").on(t.userId, t.entityType, t.entityId, t.fieldKey)],
);

// ─── Finances ───────────────────────────────────────────────────────────────

export const transactions = pgTable(
  "transactions",
  {
    id: id(),
    userId: owner(),
    kind: text("kind").notNull(), // income | expense
    category: text("category").notNull(),
    description: text("description").notNull(),
    amount: money("amount").notNull(),
    currency: text("currency").notNull().default("EUR"),
    /** Converted amount in the user's base currency, only when a rate is known. */
    baseAmount: money("base_amount"),
    fxRate: numeric("fx_rate", { precision: 14, scale: 6, mode: "number" }),
    fxSource: text("fx_source"),
    fxDate: date("fx_date", { mode: "string" }),
    date: date("date", { mode: "string" }).notNull(),
    /** actual | estimated | forecast */
    nature: text("nature").notNull().default("actual"),
    /** paid | pending | overdue | cancelled */
    paymentStatus: text("payment_status").notNull().default("paid"),
    counterparty: text("counterparty"),
    trackId: uuid("track_id").references(() => tracks.id, { onDelete: "set null" }),
    releaseId: uuid("release_id").references(() => releases.id, { onDelete: "set null" }),
    campaignId: uuid("campaign_id").references(() => campaigns.id, { onDelete: "set null" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    documentId: uuid("document_id").references((): AnyPgColumn => documents.id, { onDelete: "set null" }),
    notes: text("notes"),
    isDemo: isDemo(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("tx_user_date_idx").on(t.userId, t.date)],
);

export const budgets = pgTable(
  "budgets",
  {
    id: id(),
    userId: owner(),
    name: text("name").notNull(),
    scope: text("scope").notNull().default("monthly"), // monthly | release | campaign | project | merch | other
    category: text("category"),
    amount: money("amount").notNull(),
    currency: text("currency").notNull().default("EUR"),
    periodStart: date("period_start", { mode: "string" }),
    periodEnd: date("period_end", { mode: "string" }),
    releaseId: uuid("release_id").references(() => releases.id, { onDelete: "cascade" }),
    campaignId: uuid("campaign_id").references(() => campaigns.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
    notes: text("notes"),
    isDemo: isDemo(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("budgets_user_idx").on(t.userId)],
);

// ─── Documents & assets ─────────────────────────────────────────────────────

export const documents = pgTable(
  "documents",
  {
    id: id(),
    userId: owner(),
    title: text("title").notNull(),
    category: text("category").notNull().default("other"),
    tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
    storageKey: text("storage_key"),
    externalUrl: text("external_url"),
    fileName: text("file_name"),
    mimeType: text("mime_type"),
    sizeBytes: integer("size_bytes"),
    checksum: text("checksum"),
    version: integer("version").notNull().default(1),
    /** Previous version of the same document (version chain). */
    previousVersionId: uuid("previous_version_id"),
    isLatest: boolean("is_latest").notNull().default(true),
    sensitive: boolean("sensitive").notNull().default(false),
    trackId: uuid("track_id").references(() => tracks.id, { onDelete: "set null" }),
    releaseId: uuid("release_id").references(() => releases.id, { onDelete: "set null" }),
    campaignId: uuid("campaign_id").references(() => campaigns.id, { onDelete: "set null" }),
    contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "set null" }),
    notes: text("notes"),
    isDemo: isDemo(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("documents_user_idx").on(t.userId)],
);

// ─── Analytics ──────────────────────────────────────────────────────────────

export const analyticsRecords = pgTable(
  "analytics_records",
  {
    id: id(),
    userId: owner(),
    metric: text("metric").notNull(), // monthly_listeners | streams | followers | saves | playlist_adds | reach | engagement | video_views | ctr | ad_spend | conversions | revenue | profile_visits
    value: numeric("value", { precision: 18, scale: 4, mode: "number" }).notNull(),
    platform: text("platform").notNull(),
    periodStart: date("period_start", { mode: "string" }),
    periodEnd: date("period_end", { mode: "string" }).notNull(),
    /** manual | csv | api */
    source: text("source").notNull().default("manual"),
    /** verified | manual | estimated */
    verification: text("verification").notNull().default("manual"),
    trackId: uuid("track_id").references(() => tracks.id, { onDelete: "set null" }),
    releaseId: uuid("release_id").references(() => releases.id, { onDelete: "set null" }),
    campaignId: uuid("campaign_id").references(() => campaigns.id, { onDelete: "set null" }),
    notes: text("notes"),
    isDemo: isDemo(),
    recordedAt: createdAt(),
  },
  (t) => [index("analytics_user_metric_idx").on(t.userId, t.metric, t.periodEnd)],
);

export const playlistPlacements = pgTable("playlist_placements", {
  id: id(),
  userId: owner(),
  trackId: uuid("track_id").references(() => tracks.id, { onDelete: "set null" }),
  playlistName: text("playlist_name").notNull(),
  platform: text("platform").notNull(),
  curator: text("curator"),
  followers: integer("followers"),
  addedDate: date("added_date", { mode: "string" }),
  removedDate: date("removed_date", { mode: "string" }),
  url: text("url"),
  verification: text("verification").notNull().default("manual"),
  isDemo: isDemo(),
  createdAt: createdAt(),
});

// ─── Integrations, notifications, automations ───────────────────────────────

export const integrations = pgTable(
  "integrations",
  {
    id: id(),
    userId: owner(),
    service: text("service").notNull(),
    /** Non-secret configuration (e.g. Spotify artist ID). Secrets stay in env vars. */
    config: jsonb("config").$type<Record<string, string>>().notNull().default({}),
    enabled: boolean("enabled").notNull().default(false),
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    lastError: text("last_error"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("integrations_user_service").on(t.userId, t.service)],
);

export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    userId: owner(),
    kind: text("kind").notNull(), // deadline | overdue | missing_info | summary | review | follow_up | automation | system
    title: text("title").notNull(),
    body: text("body"),
    link: text("link"),
    dedupeKey: text("dedupe_key"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("notifications_user_idx").on(t.userId), uniqueIndex("notifications_dedupe").on(t.userId, t.dedupeKey)],
);

export const automationRules = pgTable(
  "automation_rules",
  {
    id: id(),
    userId: owner(),
    name: text("name").notNull(),
    kind: text("kind").notNull(), // see lib/automations
    trigger: text("trigger").notNull().default("schedule"), // schedule | event
    schedule: text("schedule").notNull().default("daily"), // daily | weekly | monthly
    conditions: jsonb("conditions").$type<Record<string, unknown>>().notNull().default({}),
    actions: jsonb("actions").$type<Record<string, unknown>>().notNull().default({}),
    enabled: boolean("enabled").notNull().default(true),
    /** Actions with external effects are never executed without approval. */
    requiresApproval: boolean("requires_approval").notNull().default(false),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("automation_user_idx").on(t.userId)],
);

export const automationLogs = pgTable(
  "automation_logs",
  {
    id: id(),
    userId: owner(),
    ruleId: uuid("rule_id").references(() => automationRules.id, { onDelete: "set null" }),
    ruleName: text("rule_name").notNull(),
    triggeredAt: timestamp("triggered_at", { withTimezone: true }).notNull().defaultNow(),
    action: text("action").notNull(),
    result: text("result").notNull(), // success | skipped | error | awaiting_approval
    details: text("details"),
    error: text("error"),
    approvalStatus: text("approval_status").notNull().default("not_required"),
  },
  (t) => [index("automation_logs_user_idx").on(t.userId, t.triggeredAt)],
);

// ─── AI assistant ───────────────────────────────────────────────────────────

export const aiConversations = pgTable("ai_conversations", {
  id: id(),
  userId: owner(),
  title: text("title").notNull().default("New conversation"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const aiMessages = pgTable(
  "ai_messages",
  {
    id: id(),
    userId: owner(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => aiConversations.id, { onDelete: "cascade" }),
    role: text("role").notNull(), // user | assistant
    content: text("content").notNull(),
    /** Tool calls made while producing this message (for transparency). */
    toolLog: jsonb("tool_log").$type<{ name: string; input: unknown; summary: string }[]>().notNull().default([]),
    mode: text("mode").notNull().default("ai"), // ai | offline
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    createdAt: createdAt(),
  },
  (t) => [index("ai_messages_conv_idx").on(t.conversationId, t.createdAt)],
);

/** Actions the assistant proposes; nothing is applied until the user approves. */
export const aiProposedActions = pgTable(
  "ai_proposed_actions",
  {
    id: id(),
    userId: owner(),
    conversationId: uuid("conversation_id").references(() => aiConversations.id, { onDelete: "cascade" }),
    messageId: uuid("message_id").references(() => aiMessages.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // create_task | create_tasks | create_release | save_info | create_content | draft_outreach | create_campaign
    summary: text("summary").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    status: text("status").notNull().default("pending"), // pending | approved | rejected | failed
    resultNote: text("result_note"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("ai_actions_user_idx").on(t.userId, t.status)],
);

export const aiUsage = pgTable(
  "ai_usage",
  {
    id: id(),
    userId: owner(),
    day: date("day", { mode: "string" }).notNull(),
    requests: integer("requests").notNull().default(0),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    errors: integer("errors").notNull().default(0),
  },
  (t) => [uniqueIndex("ai_usage_user_day").on(t.userId, t.day)],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: id(),
    userId: owner(),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    summary: text("summary"),
    details: jsonb("details"),
    createdAt: createdAt(),
  },
  (t) => [index("audit_user_idx").on(t.userId, t.createdAt)],
);

// ─── Relations (for relational queries) ─────────────────────────────────────

export const tracksRelations = relations(tracks, ({ many, one }) => ({
  versions: many(trackVersions),
  collaborators: many(trackCollaborators),
  splits: many(ownershipSplits),
  rights: one(rightsRecords, { fields: [tracks.id], references: [rightsRecords.trackId] }),
  releaseLinks: many(releaseTracks),
  feedback: many(feedbackNotes),
}));
export const trackVersionsRelations = relations(trackVersions, ({ one }) => ({
  track: one(tracks, { fields: [trackVersions.trackId], references: [tracks.id] }),
  document: one(documents, { fields: [trackVersions.documentId], references: [documents.id] }),
}));
export const trackCollaboratorsRelations = relations(trackCollaborators, ({ one }) => ({
  track: one(tracks, { fields: [trackCollaborators.trackId], references: [tracks.id] }),
  contact: one(contacts, { fields: [trackCollaborators.contactId], references: [contacts.id] }),
}));
export const ownershipSplitsRelations = relations(ownershipSplits, ({ one }) => ({
  track: one(tracks, { fields: [ownershipSplits.trackId], references: [tracks.id] }),
}));
export const rightsRecordsRelations = relations(rightsRecords, ({ one }) => ({
  track: one(tracks, { fields: [rightsRecords.trackId], references: [tracks.id] }),
}));
export const feedbackRelations = relations(feedbackNotes, ({ one }) => ({
  track: one(tracks, { fields: [feedbackNotes.trackId], references: [tracks.id] }),
}));
export const releasesRelations = relations(releases, ({ many }) => ({
  trackLinks: many(releaseTracks),
  reviews: many(releaseReviews),
  campaigns: many(campaigns),
}));
export const releaseTracksRelations = relations(releaseTracks, ({ one }) => ({
  release: one(releases, { fields: [releaseTracks.releaseId], references: [releases.id] }),
  track: one(tracks, { fields: [releaseTracks.trackId], references: [tracks.id] }),
}));
export const releaseReviewsRelations = relations(releaseReviews, ({ one }) => ({
  release: one(releases, { fields: [releaseReviews.releaseId], references: [releases.id] }),
}));
export const campaignsRelations = relations(campaigns, ({ one, many }) => ({
  release: one(releases, { fields: [campaigns.releaseId], references: [releases.id] }),
  track: one(tracks, { fields: [campaigns.trackId], references: [tracks.id] }),
  ads: many(adCampaigns),
  content: many(contentItems),
}));
export const adCampaignsRelations = relations(adCampaigns, ({ one }) => ({
  campaign: one(campaigns, { fields: [adCampaigns.campaignId], references: [campaigns.id] }),
}));
export const contentItemsRelations = relations(contentItems, ({ one }) => ({
  campaign: one(campaigns, { fields: [contentItems.campaignId], references: [campaigns.id] }),
  track: one(tracks, { fields: [contentItems.trackId], references: [tracks.id] }),
}));
export const contactsRelations = relations(contacts, ({ many }) => ({
  outreach: many(outreachRecords),
}));
export const outreachRelations = relations(outreachRecords, ({ one }) => ({
  contact: one(contacts, { fields: [outreachRecords.contactId], references: [contacts.id] }),
}));
export const projectsRelations = relations(projects, ({ many }) => ({
  milestones: many(milestones),
  tasks: many(tasks),
}));
export const milestonesRelations = relations(milestones, ({ one }) => ({
  project: one(projects, { fields: [milestones.projectId], references: [projects.id] }),
}));
export const tasksRelations = relations(tasks, ({ one }) => ({
  project: one(projects, { fields: [tasks.projectId], references: [projects.id] }),
  track: one(tracks, { fields: [tasks.trackId], references: [tracks.id] }),
  release: one(releases, { fields: [tasks.releaseId], references: [releases.id] }),
  campaign: one(campaigns, { fields: [tasks.campaignId], references: [campaigns.id] }),
}));
export const aiConversationsRelations = relations(aiConversations, ({ many }) => ({
  messages: many(aiMessages),
}));
export const aiMessagesRelations = relations(aiMessages, ({ one }) => ({
  conversation: one(aiConversations, { fields: [aiMessages.conversationId], references: [aiConversations.id] }),
}));
