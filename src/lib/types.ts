import type { InferSelectModel } from "drizzle-orm";
import type * as s from "./db/schema";

export type User = InferSelectModel<typeof s.users>;
export type Settings = InferSelectModel<typeof s.userSettings>;
export type Profile = InferSelectModel<typeof s.artistProfiles>;
export type PlatformLink = InferSelectModel<typeof s.platformLinks>;
export type Goal = InferSelectModel<typeof s.goals>;
export type Contact = InferSelectModel<typeof s.contacts>;
export type Outreach = InferSelectModel<typeof s.outreachRecords>;
export type Project = InferSelectModel<typeof s.projects>;
export type Milestone = InferSelectModel<typeof s.milestones>;
export type Track = InferSelectModel<typeof s.tracks>;
export type TrackVersion = InferSelectModel<typeof s.trackVersions>;
export type TrackCollaborator = InferSelectModel<typeof s.trackCollaborators>;
export type FeedbackNote = InferSelectModel<typeof s.feedbackNotes>;
export type RightsRecord = InferSelectModel<typeof s.rightsRecords>;
export type Split = InferSelectModel<typeof s.ownershipSplits>;
export type Release = InferSelectModel<typeof s.releases>;
export type ChecklistItem = InferSelectModel<typeof s.checklistItems>;
export type ReleaseReview = InferSelectModel<typeof s.releaseReviews>;
export type Campaign = InferSelectModel<typeof s.campaigns>;
export type AdCampaign = InferSelectModel<typeof s.adCampaigns>;
export type ContentItem = InferSelectModel<typeof s.contentItems>;
export type Task = InferSelectModel<typeof s.tasks>;
export type PhaseState = InferSelectModel<typeof s.phaseStates>;
export type InfoMeta = InferSelectModel<typeof s.infoFieldMeta>;
export type Transaction = InferSelectModel<typeof s.transactions>;
export type Budget = InferSelectModel<typeof s.budgets>;
export type Document = InferSelectModel<typeof s.documents>;
export type AnalyticsRecord = InferSelectModel<typeof s.analyticsRecords>;
export type Notification = InferSelectModel<typeof s.notifications>;
export type AutomationRule = InferSelectModel<typeof s.automationRules>;

export type TrackFull = Track & {
  versions: TrackVersion[];
  collaborators: TrackCollaborator[];
  splits: Split[];
  rights: RightsRecord | null;
  feedback: FeedbackNote[];
  releaseIds: string[];
};

export type ReleaseFull = Release & {
  trackIds: string[];
  checklist: ChecklistItem[];
  execution: ChecklistItem[];
  reviews: ReleaseReview[];
};

export type CampaignFull = Campaign & { ads: AdCampaign[] };

/** Everything the engines need to reason about the business. */
export interface BusinessContext {
  today: string;
  userId: string;
  settings: Settings;
  profile: Profile;
  platformLinks: PlatformLink[];
  goals: Goal[];
  tracks: TrackFull[];
  releases: ReleaseFull[];
  campaigns: CampaignFull[];
  content: ContentItem[];
  tasks: Task[];
  projects: Project[];
  contacts: Contact[];
  transactions: Transaction[];
  budgets: Budget[];
  documents: Pick<Document, "id" | "title" | "category" | "trackId" | "releaseId" | "campaignId" | "sensitive" | "isLatest" | "createdAt">[];
  phaseStates: PhaseState[];
  infoMeta: InfoMeta[];
  analyticsCount: number;
}
