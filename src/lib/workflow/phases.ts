/**
 * The ten business phases. Definitions live in code; per-user state lives in
 * `phase_states`. `evaluate` is pure: it inspects the business context and
 * reports checks, blockers, completion and the next action.
 */
import { OPEN_TASK_STATUSES } from "../constants";
import { evaluateCampaign, evaluateProfile, evaluateRelease, evaluateTrack, hasApprovedMaster, isResolved, summarize } from "../info/engine";
import type { BusinessContext, ReleaseFull, TrackFull } from "../types";
import { addDays, isBlank } from "../utils";

export interface PhaseCheck {
  label: string;
  done: boolean;
  detail?: string;
  href?: string;
  /** Required for the completion criteria. */
  required: boolean;
}

export interface PhaseEvaluation {
  checks: PhaseCheck[];
  progress: number;
  criteriaMet: boolean;
  blockers: string[];
  nextAction: { label: string; href: string; why: string } | null;
  /** Short line describing what the phase currently covers. */
  scope: string;
}

export interface TaskTemplate {
  key: string;
  title: string;
  description?: string;
  priority?: "low" | "medium" | "high" | "urgent";
  completionCriteria?: string;
}

export interface PhaseDef {
  key: string;
  number: number;
  title: string;
  objective: string;
  description: string;
  requiredInfo: string[];
  optionalInfo: string[];
  completionCriteria: string;
  dependsOn: string[];
  tasks: TaskTemplate[];
  href: string;
  evaluate: (ctx: BusinessContext) => PhaseEvaluation;
}

// ─── helpers ────────────────────────────────────────────────────────────────

const RELEASED = new Set(["Released", "Post-release review", "Archived"]);

export function upcomingReleases(ctx: BusinessContext): ReleaseFull[] {
  return ctx.releases.filter((r) => !RELEASED.has(r.status));
}
export function releasedReleases(ctx: BusinessContext): ReleaseFull[] {
  return ctx.releases.filter((r) => r.status === "Released" || r.status === "Post-release review");
}
export function activeTracks(ctx: BusinessContext): TrackFull[] {
  return ctx.tracks.filter((t) => t.status !== "Archived" && t.status !== "Finished" && !t.actualReleaseDate);
}
/** Tracks heading to release: linked to an upcoming release or marked finished but unreleased. */
export function tracksForRelease(ctx: BusinessContext): TrackFull[] {
  const upcoming = new Set(upcomingReleases(ctx).map((r) => r.id));
  return ctx.tracks.filter(
    (t) => t.status !== "Archived" && (t.releaseIds.some((id) => upcoming.has(id)) || (t.status === "Finished" && !t.actualReleaseDate)),
  );
}

function finish(checks: PhaseCheck[], scope: string, next: PhaseEvaluation["nextAction"], extraBlockers: string[] = []): PhaseEvaluation {
  const required = checks.filter((c) => c.required);
  const done = required.filter((c) => c.done).length;
  const progress = required.length ? Math.round((done / required.length) * 100) : 0;
  const criteriaMet = required.length > 0 && done === required.length;
  const firstOpen = checks.find((c) => c.required && !c.done);
  const nextAction =
    next ??
    (firstOpen
      ? {
          label: firstOpen.label,
          href: firstOpen.href ?? "#",
          why: firstOpen.detail ? `${firstOpen.detail} — required to complete this phase.` : "Required to complete this phase.",
        }
      : null);
  return {
    checks,
    progress,
    criteriaMet,
    blockers: [...extraBlockers, ...checks.filter((c) => c.required && !c.done && c.detail).map((c) => `${c.label}: ${c.detail}`)].slice(0, 8),
    nextAction,
    scope,
  };
}

function groupDone(ctx: BusinessContext, groups: string[]) {
  const s = summarize(evaluateProfile(ctx, groups));
  return { done: s.missingRequired === 0, missing: s.missingRequired, s };
}

// ─── Phase definitions ──────────────────────────────────────────────────────

export const PHASES: PhaseDef[] = [
  {
    key: "foundation",
    number: 1,
    title: "Artist Foundation",
    objective: "Establish the complete foundation of the artist business.",
    description:
      "Profile, brand, musical direction, goals, platforms, tools, a basic budget, your collaborators and an organised catalog — the base every other phase builds on.",
    requiredInfo: ["Artist identity", "Career goals", "Music identity", "Spotify & Instagram links", "Existing catalog summary"],
    optionalInfo: ["Budget and costs", "Team", "Tools & workflow preferences"],
    completionCriteria: "The artist profile contains the required information and the initial business structure is organised.",
    dependsOn: [],
    href: "/workflow/foundation",
    tasks: [
      { key: "profile", title: "Complete the artist profile", priority: "high", completionCriteria: "All required identity fields are complete." },
      { key: "brand", title: "Define brand identity (concept, phrase, visual identity)" },
      { key: "direction", title: "Define musical direction and target audience" },
      { key: "goals", title: "Set measurable career goals with deadlines" },
      { key: "streaming", title: "Organise streaming profiles (Spotify, Apple Music, Beatport…)" },
      { key: "social", title: "Organise social media accounts" },
      { key: "tools", title: "List existing tools and subscriptions" },
      { key: "budget", title: "Establish a basic monthly budget" },
      { key: "collaborators", title: "Add current collaborators to Contacts" },
      { key: "catalog", title: "Add existing tracks to the Music Catalog" },
    ],
    evaluate(ctx) {
      const id = groupDone(ctx, ["identity"]);
      const goals = groupDone(ctx, ["goals"]);
      const music = groupDone(ctx, ["music"]);
      const platforms = groupDone(ctx, ["platforms"]);
      const catalog = groupDone(ctx, ["catalog"]);
      const budgetSet = !isBlank(ctx.profile.business?.monthlyBudget) || ctx.budgets.some((b) => b.scope === "monthly");
      const teamKnown =
        ctx.contacts.some((c) => c.isTeamMember) ||
        !isBlank(ctx.profile.team?.summary) ||
        ctx.profile.onboardingSteps?.team === "saved";
      const toolsKnown = Boolean(ctx.profile.workflowPrefs && Object.values(ctx.profile.workflowPrefs).some((v) => !isBlank(v)));
      const expected = (ctx.profile.catalogSummary?.releasedCount ?? 0) + (ctx.profile.catalogSummary?.unreleasedCount ?? 0);
      const catalogOrganised = ctx.tracks.length > 0 || (catalog.done && expected === 0);
      const measurableGoal = ctx.goals.some((g) => g.targetValue !== null && g.deadline);
      const checks: PhaseCheck[] = [
        { label: "Artist identity complete", done: id.done, detail: id.missing ? `${id.missing} required field(s) missing` : undefined, href: "/onboarding?step=identity", required: true },
        { label: "Career goals defined", done: goals.done, detail: goals.missing ? `${goals.missing} missing` : undefined, href: "/onboarding?step=goals", required: true },
        { label: "Music identity defined", done: music.done, detail: music.missing ? `${music.missing} missing` : undefined, href: "/onboarding?step=music", required: true },
        { label: "Streaming & social profiles organised", done: platforms.done, detail: platforms.missing ? `${platforms.missing} link(s) missing` : undefined, href: "/onboarding?step=platforms", required: true },
        { label: "Existing catalog summarised", done: catalog.done, href: "/onboarding?step=catalog", required: true },
        {
          label: "Catalog organised in the app",
          done: catalogOrganised,
          detail: catalogOrganised ? undefined : expected ? `You reported ${expected} track(s); ${ctx.tracks.length} added.` : "Add your tracks.",
          href: "/catalog/new",
          required: true,
        },
        { label: "Basic budget established", done: budgetSet, href: "/onboarding?step=business", required: true },
        { label: "Current collaborators identified", done: teamKnown, href: "/onboarding?step=team", required: false },
        { label: "Tools & subscriptions listed", done: toolsKnown, href: "/onboarding?step=tools", required: false },
        { label: "At least one measurable goal with a deadline", done: measurableGoal, href: "/business?tab=goals", required: false },
      ];
      return finish(checks, "Your artist profile and business foundations.", null);
    },
  },
  {
    key: "production",
    number: 2,
    title: "Music Production",
    objective: "Manage the creation of music from the initial idea to the final master.",
    description: "Ideas, project files, arrangement, lyrics, vocals, collaborations, feedback, mixing and mastering — through to an approved final master.",
    requiredInfo: ["Track title", "Status", "Approved final master (to finish)"],
    optionalInfo: ["Project files", "Stems", "Lyrics", "Feedback notes"],
    completionCriteria: "The track has approved final audio, required metadata and enough information to proceed.",
    dependsOn: ["foundation"],
    href: "/workflow/production",
    tasks: [
      { key: "ideas", title: "Capture new track ideas in the catalog" },
      { key: "files", title: "Organise project files and stems" },
      { key: "arrangement", title: "Develop melodies and arrangements" },
      { key: "lyrics", title: "Write and organise lyrics" },
      { key: "vocals", title: "Plan and record vocals" },
      { key: "collab", title: "Coordinate collaborations and document roles" },
      { key: "feedback", title: "Collect and resolve feedback" },
      { key: "mix", title: "Organise mixing" },
      { key: "master", title: "Organise mastering" },
      { key: "review", title: "Review and approve the final master", priority: "high" },
    ],
    evaluate(ctx) {
      const inProd = activeTracks(ctx);
      const finished = ctx.tracks.filter((t) => t.status === "Finished" || t.actualReleaseDate);
      const finishedWithoutMaster = ctx.tracks.filter((t) => t.status === "Finished" && !hasApprovedMaster(t));
      const readyTracks = finished.filter((t) => {
        if (!hasApprovedMaster(t)) return false;
        return evaluateTrack(ctx, t).filter((i) => i.group === "metadata" && i.required).every(isResolved);
      });
      const openFeedback = ctx.tracks.reduce((n, t) => n + t.feedback.filter((f) => !f.resolved).length, 0);
      const checks: PhaseCheck[] = [
        { label: "Tracks captured in the catalog", done: ctx.tracks.length > 0, href: "/catalog/new", required: true },
        {
          label: "Finished tracks have an approved master",
          done: finished.length > 0 && finishedWithoutMaster.length === 0,
          detail: finishedWithoutMaster.length ? `${finishedWithoutMaster.map((t) => t.title).join(", ")}` : finished.length ? undefined : "No finished tracks yet.",
          href: finishedWithoutMaster[0] ? `/catalog/${finishedWithoutMaster[0].id}?tab=assets` : "/catalog",
          required: true,
        },
        {
          label: "At least one track ready for the next workflow (master + metadata)",
          done: readyTracks.length > 0,
          detail: readyTracks.length ? `${readyTracks.length} ready` : "Complete metadata and approve a master.",
          href: "/catalog",
          required: true,
        },
        { label: `${inProd.length} track(s) in progress are tracked with a status`, done: true, href: "/catalog", required: false },
        {
          label: "Open feedback resolved",
          done: openFeedback === 0,
          detail: openFeedback ? `${openFeedback} open note(s)` : undefined,
          href: "/catalog",
          required: false,
        },
      ];
      return finish(checks, `${inProd.length} in production · ${finished.length} finished`, null);
    },
  },
  {
    key: "rights",
    number: 3,
    title: "Rights & Legal Preparation",
    objective: "Organise ownership, credits, permissions and rights documentation.",
    description:
      "Songwriters, producers, composition and master ownership, splits, performer credits, samples, agreements, registrations and royalty collection — documented, never assumed.",
    requiredInfo: ["Composition splits (100%)", "Master ownership (100%)", "Sample status", "Collaboration agreements (if collaborators)"],
    optionalInfo: ["Copyright / PRO registration status", "Royalty collection services"],
    completionCriteria: "Required ownership information and permissions are documented for the planned releases.",
    dependsOn: ["production"],
    href: "/workflow/rights",
    tasks: [
      { key: "writers", title: "Identify songwriters and producers for each track" },
      { key: "composition", title: "Record composition ownership and splits", priority: "high" },
      { key: "master", title: "Record master ownership", priority: "high" },
      { key: "credits", title: "Track performer credits" },
      { key: "samples", title: "Document sample usage and licences" },
      { key: "agreements", title: "Organise collaboration agreements / split sheets" },
      { key: "registration", title: "Track copyright and PRO registration status" },
      { key: "collection", title: "Set up royalty collection" },
    ],
    evaluate(ctx) {
      const list = tracksForRelease(ctx);
      const perTrack = list.map((t) => {
        const items = evaluateTrack(ctx, t).filter((i) => i.group === "rights" || i.group === "credits");
        return { t, open: items.filter((i) => i.required && !isResolved(i)) };
      });
      const checks: PhaseCheck[] = perTrack.map(({ t, open }) => ({
        label: `Rights documented — ${t.title}`,
        done: open.length === 0,
        detail: open.length ? open.map((o) => o.label).join(", ") : undefined,
        href: `/catalog/${t.id}?tab=rights`,
        required: true,
      }));
      if (!checks.length)
        checks.push({ label: "No tracks heading to release yet", done: false, detail: "Finish a track or link one to a release.", href: "/catalog", required: true });
      return finish(checks, `${list.length} track(s) heading to release`, null);
    },
  },
  {
    key: "release",
    number: 4,
    title: "Release Planning",
    objective: "Prepare each track for release.",
    description: "Release projects with metadata, artwork, credits, ownership, distributor, dates and a checklist tailored to the release type.",
    requiredInfo: ["Release title, type, date", "Linked tracks", "Distributor", "Cover artwork", "Metadata"],
    optionalInfo: ["Pre-save and smart links", "UPC", "Strategy notes"],
    completionCriteria: "All required release information is complete and the release is submitted or prepared for distribution.",
    dependsOn: ["production", "rights"],
    href: "/workflow/release",
    tasks: [
      { key: "create", title: "Create a release project", priority: "high" },
      { key: "metadata", title: "Check release metadata" },
      { key: "artwork", title: "Finalise and approve cover artwork" },
      { key: "credits", title: "Verify credits" },
      { key: "distributor", title: "Choose the distributor" },
      { key: "submit", title: "Submit to the distributor", priority: "high" },
      { key: "date", title: "Confirm the release date" },
    ],
    evaluate(ctx) {
      const list = upcomingReleases(ctx);
      const checks: PhaseCheck[] = list.map((r) => {
        const s = summarize(evaluateRelease(ctx, r));
        const openChecklist = r.checklist.filter((c) => c.required && c.status === "pending" && !c.auto && c.key !== "post_release_review" && c.key !== "release_day").length;
        return {
          label: `${r.title} — information & checklist`,
          done: s.missingRequired === 0 && openChecklist === 0,
          detail: [s.missingRequired ? `${s.missingRequired} item(s) missing` : "", openChecklist ? `${openChecklist} checklist step(s) open` : ""].filter(Boolean).join(", ") || undefined,
          href: `/releases/${r.id}`,
          required: true,
        };
      });
      if (!list.length) checks.push({ label: "Create your next release", done: false, detail: "No upcoming releases.", href: "/releases/new", required: true });
      return finish(checks, `${list.length} upcoming release(s)`, null);
    },
  },
  {
    key: "marketing",
    number: 5,
    title: "Marketing Strategy",
    objective: "Create a complete marketing strategy for each release.",
    description: "Campaigns with objective, audience, budget, timeline, channels, message, content and outreach strategy, and measurable success metrics.",
    requiredInfo: ["Campaign objective", "Audience", "Budget", "Timeline", "Channels", "Message", "Success metrics"],
    optionalInfo: ["Creative direction", "Outreach strategy", "Advertising plans"],
    completionCriteria: "Each campaign has a defined objective, budget, timeline, promotional assets and measurable indicators.",
    dependsOn: ["release"],
    href: "/workflow/marketing",
    tasks: [
      { key: "campaign", title: "Create a campaign for the next release", priority: "high" },
      { key: "audience", title: "Define target audience and objective" },
      { key: "budget", title: "Set the campaign budget" },
      { key: "channels", title: "Choose channels and content strategy" },
      { key: "metrics", title: "Define success metrics" },
      { key: "outreach", title: "Plan outreach (playlists, press, DJs)" },
    ],
    evaluate(ctx) {
      const list = upcomingReleases(ctx);
      const checks: PhaseCheck[] = list.map((r) => {
        const camps = ctx.campaigns.filter((c) => c.releaseId === r.id && c.status !== "Archived");
        if (!camps.length) return { label: `${r.title} — campaign`, done: false, detail: "No campaign connected.", href: `/marketing/new?release=${r.id}`, required: true };
        const worst = camps.map((c) => summarize(evaluateCampaign(ctx, c))).sort((a, b) => b.missingRequired - a.missingRequired)[0];
        return {
          label: `${r.title} — campaign strategy`,
          done: worst.missingRequired === 0,
          detail: worst.missingRequired ? `${worst.missingRequired} item(s) missing` : undefined,
          href: `/marketing/${camps[0].id}`,
          required: true,
        };
      });
      if (!list.length) checks.push({ label: "Plan a release to market", done: false, href: "/releases/new", required: true });
      return finish(checks, `${ctx.campaigns.filter((c) => c.status !== "Archived").length} campaign(s)`, null);
    },
  },
  {
    key: "content",
    number: 6,
    title: "Content Production",
    objective: "Create and organise all promotional content.",
    description: "Reels, TikToks, Shorts, Canvas, artwork, teasers, behind-the-scenes, announcements, captions and calls to action.",
    requiredInfo: ["Content items per campaign", "Platform & format", "Planned dates", "Captions", "Approval"],
    optionalInfo: ["Scripts", "Hashtags", "Performance data"],
    completionCriteria: "The required content assets for each active campaign are prepared and organised.",
    dependsOn: ["marketing"],
    href: "/workflow/content",
    tasks: [
      { key: "ideas", title: "Brainstorm content ideas for the campaign" },
      { key: "teaser", title: "Produce teaser clips" },
      { key: "canvas", title: "Create Spotify Canvas" },
      { key: "bts", title: "Film behind-the-scenes / studio content" },
      { key: "captions", title: "Write captions and calls to action" },
      { key: "approve", title: "Approve content before publication" },
      { key: "schedule", title: "Schedule content in the planner" },
    ],
    evaluate(ctx) {
      const camps = ctx.campaigns.filter((c) => c.status === "Planning" || c.status === "Ready" || c.status === "Active");
      const ready = new Set(["Approved", "Scheduled", "Published", "Analyzed"]);
      const checks: PhaseCheck[] = camps.map((c) => {
        const items = ctx.content.filter((x) => x.campaignId === c.id);
        const readyCount = items.filter((x) => ready.has(x.stage)).length;
        const noCaption = items.filter((x) => isBlank(x.caption) && x.stage !== "Idea").length;
        return {
          label: `${c.name} — content`,
          done: items.length > 0 && readyCount === items.length,
          detail: items.length ? `${readyCount}/${items.length} ready${noCaption ? `, ${noCaption} without caption` : ""}` : "No content planned.",
          href: `/content?campaign=${c.id}`,
          required: true,
        };
      });
      if (!camps.length) checks.push({ label: "No active campaigns", done: false, detail: "Create a campaign first.", href: "/marketing/new", required: true });
      return finish(checks, `${ctx.content.length} content item(s)`, null);
    },
  },
  {
    key: "execution",
    number: 7,
    title: "Release Execution",
    objective: "Coordinate all release-day activities.",
    description: "Verify the release is live, check links, artwork and credits, publish announcements, activate approved ads, notify collaborators and record first metrics.",
    requiredInfo: ["Release-day checklist confirmations"],
    optionalInfo: ["Issues encountered"],
    completionCriteria: "The release has been checked, planned activities executed or documented, and outstanding issues recorded.",
    dependsOn: ["release", "content"],
    href: "/workflow/execution",
    tasks: [
      { key: "live", title: "Verify the release is live on all stores" },
      { key: "announce", title: "Publish the release announcement" },
      { key: "notify", title: "Notify collaborators" },
      { key: "metrics", title: "Record initial performance metrics" },
    ],
    evaluate(ctx) {
      const window = ctx.releases.filter(
        (r) => r.releaseDate && r.status !== "Archived" && r.releaseDate <= addDays(ctx.today, 7) && r.releaseDate >= addDays(ctx.today, -30),
      );
      const checks: PhaseCheck[] = window.map((r) => {
        const items = r.execution;
        const open = items.filter((i) => i.status === "pending").length;
        return {
          label: `${r.title} — release day`,
          done: items.length > 0 && open === 0,
          detail: items.length ? (open ? `${open} step(s) open` : undefined) : "Release-day checklist not started.",
          href: `/releases/${r.id}?tab=execution`,
          required: true,
        };
      });
      if (!window.length) checks.push({ label: "No release within the next 7 days", done: false, detail: "This phase activates around release day.", href: "/releases", required: true });
      return finish(checks, `${window.length} release(s) around release day`, null);
    },
  },
  {
    key: "growth",
    number: 8,
    title: "Post-Release Growth",
    objective: "Track performance and coordinate follow-up promotion.",
    description: "Review periods at 24 h, 7, 30 and 90 days using recorded data only; lessons learned and follow-up actions.",
    requiredInfo: ["Performance data (manual, CSV or API)", "Review notes"],
    optionalInfo: ["Campaign comparisons"],
    completionCriteria: "The release has been reviewed using available data and follow-up actions are documented.",
    dependsOn: ["execution"],
    href: "/workflow/growth",
    tasks: [
      { key: "data", title: "Record streaming and social metrics" },
      { key: "review", title: "Complete the scheduled release reviews" },
      { key: "followup", title: "Plan follow-up promotion" },
      { key: "lessons", title: "Document lessons learned" },
    ],
    evaluate(ctx) {
      const list = releasedReleases(ctx);
      const checks: PhaseCheck[] = [];
      for (const r of list) {
        const due = r.reviews.filter((v) => v.dueDate <= ctx.today);
        const openDue = due.filter((v) => v.status === "pending");
        checks.push({
          label: `${r.title} — reviews`,
          done: r.reviews.length > 0 && openDue.length === 0,
          detail: r.reviews.length ? (openDue.length ? `${openDue.length} review(s) due` : `${due.length}/${r.reviews.length} done`) : "No review periods scheduled.",
          href: `/releases/${r.id}?tab=performance`,
          required: true,
        });
      }
      checks.push({ label: "Performance data recorded", done: ctx.analyticsCount > 0, href: "/analytics", required: list.length > 0 });
      if (!list.length) checks.push({ label: "No released releases yet", done: false, href: "/releases", required: true });
      return finish(checks, `${list.length} released release(s)`, null);
    },
  },
  {
    key: "finances",
    number: 9,
    title: "Business & Finances",
    objective: "Manage the financial operation of the artist business.",
    description: "Income, royalties, expenses, budgets and reports — actual, estimated and forecast values clearly separated.",
    requiredInfo: ["Income and expense records", "Budgets"],
    optionalInfo: ["Receipts and invoices", "Currency conversions"],
    completionCriteria: "Financial records are organised and the relevant reporting period has been reviewed.",
    dependsOn: ["foundation"],
    href: "/workflow/finances",
    tasks: [
      { key: "record", title: "Record this month's income and expenses" },
      { key: "receipts", title: "Attach receipts and invoices" },
      { key: "budget", title: "Set monthly and release budgets" },
      { key: "review", title: "Review the monthly financial report", priority: "high" },
    ],
    evaluate(ctx) {
      const real = ctx.transactions.filter((t) => !t.isDemo);
      const overdue = real.filter((t) => t.paymentStatus === "overdue");
      const month = ctx.today.slice(0, 7);
      const checks: PhaseCheck[] = [
        { label: "Income and expenses recorded", done: real.length > 0, href: "/finances/new", required: true },
        { label: "Budgets defined", done: ctx.budgets.some((b) => !b.isDemo), href: "/finances?tab=budgets", required: true },
        {
          label: "No overdue payments",
          done: overdue.length === 0,
          detail: overdue.length ? `${overdue.length} overdue` : undefined,
          href: "/finances?status=overdue",
          required: true,
        },
        {
          label: `Current month has records (${month})`,
          done: real.some((t) => t.date.startsWith(month)),
          href: "/finances",
          required: false,
        },
        {
          label: "Expenses have receipts attached",
          done: real.filter((t) => t.kind === "expense").every((t) => t.documentId),
          href: "/finances",
          required: false,
        },
      ];
      return finish(checks, `${real.length} financial record(s)`, null);
    },
  },
  {
    key: "career",
    number: 10,
    title: "Career Growth & Strategy",
    objective: "Develop the long-term career and business opportunities.",
    description: "DJ and live opportunities, bookings, collaborations, labels, publishing, brand partnerships, merchandise, website and new revenue streams.",
    requiredInfo: ["Quarterly or annual goals", "Strategic projects", "Opportunities in the contact pipeline"],
    optionalInfo: ["Milestones", "Budgets per initiative"],
    completionCriteria: "Goals, current opportunities and next strategic actions are documented and organised.",
    dependsOn: ["foundation"],
    href: "/workflow/career",
    tasks: [
      { key: "quarterly", title: "Set quarterly goals" },
      { key: "annual", title: "Set annual goals" },
      { key: "dj", title: "Research DJ and live opportunities" },
      { key: "labels", title: "Build a label outreach shortlist" },
      { key: "collabs", title: "Identify collaboration targets" },
      { key: "merch", title: "Evaluate merchandise options" },
      { key: "website", title: "Plan website development" },
    ],
    evaluate(ctx) {
      const strategic = ctx.goals.filter((g) => (g.horizon === "quarterly" || g.horizon === "annual") && g.status === "active");
      const projects = ctx.projects.filter((p) => ["strategy", "live", "merch", "website"].includes(p.kind) && p.status !== "archived");
      const opportunities = ctx.contacts.filter((c) => ["ready", "contacted", "waiting", "follow_up", "discussion", "confirmed"].includes(c.pipelineStatus));
      const nextActions = ctx.tasks.filter((t) => t.phaseKey === "career" && OPEN_TASK_STATUSES.includes(t.status));
      const checks: PhaseCheck[] = [
        { label: "Quarterly or annual goals set", done: strategic.length > 0, href: "/business?tab=goals", required: true },
        { label: "Strategic projects defined", done: projects.length > 0, href: "/tasks/projects?new=strategy", required: true },
        { label: "Opportunities tracked in the pipeline", done: opportunities.length > 0, href: "/contacts?view=pipeline", required: true },
        { label: "Next strategic actions planned", done: nextActions.length > 0, href: "/tasks/new?phase=career", required: true },
      ];
      return finish(checks, `${strategic.length} strategic goal(s) · ${opportunities.length} opportunit${opportunities.length === 1 ? "y" : "ies"}`, null);
    },
  },
];

export function getPhase(key: string) {
  return PHASES.find((p) => p.key === key);
}

export type PhaseStatus = "not_started" | "active" | "completed" | "paused";

export function phaseStatus(ctx: BusinessContext, key: string): PhaseStatus {
  return (ctx.phaseStates.find((p) => p.phaseKey === key)?.status as PhaseStatus) ?? "not_started";
}

/** Suggest the phase to work on next: first incomplete phase whose dependencies are complete or in progress. */
export function recommendedPhase(ctx: BusinessContext): PhaseDef {
  const evals = new Map(PHASES.map((p) => [p.key, p.evaluate(ctx)]));
  const isDone = (k: string) => phaseStatus(ctx, k) === "completed" || evals.get(k)!.criteriaMet;
  for (const p of PHASES) {
    if (isDone(p.key)) continue;
    if (p.dependsOn.every((d) => isDone(d) || phaseStatus(ctx, d) === "active")) return p;
  }
  return PHASES[0];
}
