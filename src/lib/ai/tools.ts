import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db";
import { aiProposedActions, analyticsRecords } from "../db/schema";
import { OPEN_TASK_STATUSES } from "../constants";
import { monthRange, previousMonth, summarizePeriod } from "../finance";
import { evaluateAll, evaluateCampaign, evaluateProfile, evaluateRelease, evaluateTrack, summarize, type InfoItem } from "../info/engine";
import { getRequirement } from "../info/registry";
import { buildRecommendations } from "../recommendations";
import { checklistProgress, effectiveChecklist } from "../releases/checklist";
import { summarizeSplits, splitsByType } from "../rights";
import type { BusinessContext } from "../types";
import { PHASES, phaseStatus } from "../workflow/phases";

/**
 * Tools the assistant can call. Read tools return stored data only.
 * Write tools never change data: they record a proposal the artist must approve.
 */
export const READ_TOOLS: Anthropic.Beta.BetaTool[] = [
  { name: "get_business_overview", description: "Artist profile basics, counts of tracks/releases/campaigns/tasks, phase statuses and the ranked next actions. Call this first for broad questions.", input_schema: { type: "object", properties: {}, additionalProperties: false } },
  { name: "get_profile", description: "The saved artist profile: identity, brand, goals, music identity, catalog summary, business setup, team and tools. Legal name is excluded.", input_schema: { type: "object", properties: {}, additionalProperties: false } },
  { name: "get_missing_information", description: "Required information that is missing, unconfirmed, invalid or outdated, optionally limited to one area.", input_schema: { type: "object", properties: { area: { type: "string", enum: ["all", "profile", "platform", "track", "release", "campaign"] } }, additionalProperties: false } },
  { name: "list_tracks", description: "All tracks in the catalog with status, metadata summary and linked releases.", input_schema: { type: "object", properties: {}, additionalProperties: false } },
  { name: "get_track", description: "Full detail of one track including versions, credits, ownership splits, rights status and missing information.", input_schema: { type: "object", properties: { track_id: { type: "string" } }, required: ["track_id"], additionalProperties: false } },
  { name: "list_releases", description: "All releases with date, status, checklist progress and missing information count.", input_schema: { type: "object", properties: {}, additionalProperties: false } },
  { name: "get_release", description: "Full detail of one release: tracks, checklist items with due dates and status, missing information, reviews and campaigns.", input_schema: { type: "object", properties: { release_id: { type: "string" } }, required: ["release_id"], additionalProperties: false } },
  { name: "list_tasks", description: "Tasks, filtered by scope.", input_schema: { type: "object", properties: { scope: { type: "string", enum: ["open", "overdue", "due_this_week", "completed", "all"] } }, additionalProperties: false } },
  { name: "list_campaigns", description: "Marketing campaigns with objective, dates, budget, ads, content counts and missing strategy items.", input_schema: { type: "object", properties: {}, additionalProperties: false } },
  { name: "list_content", description: "Content items (posts, videos, artwork) with platform, stage, approval and planned date.", input_schema: { type: "object", properties: { campaign_id: { type: "string" } }, additionalProperties: false } },
  { name: "list_contacts", description: "Contacts with category, organisation, pipeline status and follow-up dates.", input_schema: { type: "object", properties: {}, additionalProperties: false } },
  { name: "get_finance_summary", description: "Actual income and expenses for a month (YYYY-MM), outstanding payments, and budgets. Only recorded data; demo records excluded.", input_schema: { type: "object", properties: { month: { type: "string", description: "YYYY-MM; defaults to the current month" } }, additionalProperties: false } },
  { name: "get_analytics", description: "Recorded audience/performance metrics with source, period and verification status.", input_schema: { type: "object", properties: { metric: { type: "string" } }, additionalProperties: false } },
  { name: "get_phase", description: "Status, checks, blockers and next action for one of the ten workflow phases.", input_schema: { type: "object", properties: { phase: { type: "string", enum: PHASES.map((p) => p.key) } }, required: ["phase"], additionalProperties: false } },
];

export const PROPOSAL_TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: "propose_tasks",
    description: "Propose one or more tasks. Nothing is created until the artist approves. Link tasks to existing records by id when relevant.",
    input_schema: {
      type: "object",
      properties: {
        summary: { type: "string", description: "One sentence shown on the approval card." },
        tasks: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              description: { type: "string" },
              due_date: { type: "string", description: "YYYY-MM-DD" },
              priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
              phase: { type: "string", enum: PHASES.map((p) => p.key) },
              track_id: { type: "string" },
              release_id: { type: "string" },
              campaign_id: { type: "string" },
            },
            required: ["title"],
            additionalProperties: false,
          },
        },
      },
      required: ["summary", "tasks"],
      additionalProperties: false,
    },
  },
  {
    name: "propose_release",
    description: "Propose creating a release project. Only use track ids that exist.",
    input_schema: {
      type: "object",
      properties: {
        summary: { type: "string" },
        title: { type: "string" },
        release_type: { type: "string", enum: ["single", "ep", "album", "remix", "compilation"] },
        track_ids: { type: "array", items: { type: "string" } },
        release_date: { type: "string", description: "YYYY-MM-DD, only if the artist stated it" },
        distributor: { type: "string" },
      },
      required: ["summary", "title", "release_type", "track_ids"],
      additionalProperties: false,
    },
  },
  {
    name: "propose_information",
    description: "Propose saving information the artist told you in this conversation (never invent values). Each field is validated before saving.",
    input_schema: {
      type: "object",
      properties: {
        summary: { type: "string" },
        fields: {
          type: "array",
          items: {
            type: "object",
            properties: {
              entity: { type: "string", enum: ["profile", "track", "release", "campaign"] },
              entity_id: { type: "string", description: "Required for track, release and campaign." },
              key: { type: "string", description: "Field key from get_missing_information, e.g. bio, goals.shortTerm, bpm, releaseDate." },
              value: { type: "string", description: "Value as text; lists comma separated." },
            },
            required: ["entity", "key", "value"],
            additionalProperties: false,
          },
        },
      },
      required: ["summary", "fields"],
      additionalProperties: false,
    },
  },
  {
    name: "propose_content",
    description: "Propose content drafts (captions, video concepts) as content items in the Content Studio. They stay unapproved drafts.",
    input_schema: {
      type: "object",
      properties: {
        summary: { type: "string" },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              platform: { type: "string" },
              format: { type: "string" },
              caption: { type: "string" },
              hashtags: { type: "string" },
              call_to_action: { type: "string" },
              script: { type: "string" },
              planned_date: { type: "string", description: "YYYY-MM-DD" },
              campaign_id: { type: "string" },
              track_id: { type: "string" },
            },
            required: ["title"],
            additionalProperties: false,
          },
        },
      },
      required: ["summary", "items"],
      additionalProperties: false,
    },
  },
  {
    name: "propose_outreach_draft",
    description: "Save an outreach message draft for an existing contact. It is never sent; the artist sends it themselves.",
    input_schema: {
      type: "object",
      properties: {
        summary: { type: "string" },
        contact_id: { type: "string" },
        kind: { type: "string", enum: ["collaboration", "dj_promo", "booking", "label_submission", "playlist", "press", "follow_up", "partnership", "other"] },
        subject: { type: "string" },
        message: { type: "string" },
      },
      required: ["summary", "contact_id", "kind", "subject", "message"],
      additionalProperties: false,
    },
  },
  {
    name: "propose_campaign",
    description: "Propose a marketing campaign draft (status Planning). Budget only if the artist stated it.",
    input_schema: {
      type: "object",
      properties: {
        summary: { type: "string" },
        name: { type: "string" },
        release_id: { type: "string" },
        template: { type: "string", enum: ["pre_release", "release_week", "post_release", "music_video", "audience_growth", "merch", "branding"] },
        objective: { type: "string" },
        target_audience: { type: "string" },
        message: { type: "string" },
        start_date: { type: "string" },
        end_date: { type: "string" },
        success_metrics: { type: "string" },
      },
      required: ["summary", "name"],
      additionalProperties: false,
    },
  },
];

export const ALL_TOOLS = [...READ_TOOLS, ...PROPOSAL_TOOLS];

const PROPOSAL_KIND: Record<string, string> = {
  propose_tasks: "create_tasks",
  propose_release: "create_release",
  propose_information: "save_info",
  propose_content: "create_content",
  propose_outreach_draft: "draft_outreach",
  propose_campaign: "create_campaign",
};

function infoLine(i: InfoItem) {
  return { area: i.entityType, entity_id: i.entityId, entity: i.entityLabel, key: i.key, label: i.label, status: i.status, required: i.required, editable: i.editable, note: i.message };
}

function profileView(ctx: BusinessContext) {
  const p = ctx.profile;
  return {
    artistName: p.artistName, bio: p.bio, country: p.country, city: p.city, contactEmail: p.contactEmail, website: p.website,
    genres: p.genres, artisticDirection: p.artisticDirection, brandConcept: p.brandConcept, brandPhrase: p.brandPhrase, visualIdentity: p.visualIdentity,
    languages: p.languages, careerStage: p.careerStage, goals: p.goals, musicIdentity: p.musicIdentity, catalogSummary: p.catalogSummary,
    business: p.business, team: p.team, workflowPrefs: p.workflowPrefs,
    platforms: Object.fromEntries(ctx.platformLinks.map((l) => [l.platform, l.url])),
    measurableGoals: ctx.goals.map((g) => ({ title: g.title, horizon: g.horizon, metric: g.metric, target: g.targetValue, current: g.currentValue, unit: g.unit, deadline: g.deadline, status: g.status })),
  };
}

/** Execute a read tool against the stored business data. */
export async function runReadTool(ctx: BusinessContext, name: string, input: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case "get_business_overview":
      return {
        today: ctx.today,
        artist: ctx.profile.artistName,
        careerStage: ctx.profile.careerStage,
        onboardingCompleted: Boolean(ctx.profile.onboardingCompletedAt),
        counts: {
          tracks: ctx.tracks.length,
          releasesUpcoming: ctx.releases.filter((r) => !["Released", "Post-release review", "Archived"].includes(r.status)).length,
          campaignsActive: ctx.campaigns.filter((c) => ["Planning", "Ready", "Active"].includes(c.status)).length,
          openTasks: ctx.tasks.filter((t) => OPEN_TASK_STATUSES.includes(t.status)).length,
          overdueTasks: ctx.tasks.filter((t) => OPEN_TASK_STATUSES.includes(t.status) && t.dueDate && t.dueDate < ctx.today).length,
          contacts: ctx.contacts.length,
          financialRecords: ctx.transactions.filter((t) => !t.isDemo).length,
          analyticsRecords: ctx.analyticsCount,
        },
        phases: PHASES.map((p) => { const ev = p.evaluate(ctx); return { key: p.key, title: p.title, status: phaseStatus(ctx, p.key), progress: ev.progress, criteriaMet: ev.criteriaMet, next: ev.nextAction?.label }; }),
        nextActions: buildRecommendations(ctx, 5).map((r) => ({ title: r.title, why: r.why, needs: r.requiredInfo, link: r.href })),
        requiredInformation: (() => { const s = summarize(evaluateAll(ctx)); return { percentComplete: s.percent, missingRequired: s.missingRequired }; })(),
      };
    case "get_profile":
      return profileView(ctx);
    case "get_missing_information": {
      const area = (input.area as string) ?? "all";
      const items = evaluateAll(ctx).filter((i) => i.status !== "complete" && i.status !== "not_applicable" && (area === "all" || i.entityType === area));
      return { count: items.length, items: items.slice(0, 80).map(infoLine) };
    }
    case "list_tracks":
      return ctx.tracks.map((t) => ({
        id: t.id, code: t.projectCode, title: t.title, status: t.status, stage: t.workflowStage, genre: t.genre, bpm: t.bpm, key: t.musicalKey,
        releases: t.releaseIds.map((id) => ctx.releases.find((r) => r.id === id)?.title), missingRequired: summarize(evaluateTrack(ctx, t)).missingRequired, demo: t.isDemo || undefined,
      }));
    case "get_track": {
      const t = ctx.tracks.find((x) => x.id === input.track_id);
      if (!t) return { error: "No track with that id. Use list_tracks." };
      const { composition, master } = splitsByType(t.splits);
      return {
        ...{ id: t.id, code: t.projectCode, title: t.title, status: t.status, stage: t.workflowStage, primaryArtist: t.primaryArtist, featured: t.featuredArtists, genre: t.genre, subgenre: t.subgenre, bpm: t.bpm, key: t.musicalKey, mood: t.mood, language: t.language, durationSec: t.durationSec, explicit: t.explicit, isrc: t.isrc, plannedReleaseDate: t.plannedReleaseDate, actualReleaseDate: t.actualReleaseDate, productionNotes: t.productionNotes },
        versions: t.versions.map((v) => ({ kind: v.kind, label: v.label, approved: v.approved })),
        collaborators: t.collaborators.map((c) => ({ name: c.name, role: c.role, credited: c.credited })),
        splits: { composition: summarizeSplits(composition), master: summarizeSplits(master), holders: t.splits.map((s) => ({ right: s.rightType, holder: s.holderName, percent: s.percentage, confirmed: s.confirmed })) },
        rights: t.rights && { samplesUsed: t.rights.samplesUsed, sampleLicense: t.rights.sampleLicenseStatus, agreement: t.rights.agreementStatus, copyright: t.rights.copyrightRegistration, pro: t.rights.proRegistration, collection: t.rights.royaltyCollection, openQuestions: t.rights.openQuestions },
        openFeedback: t.feedback.filter((f) => !f.resolved).map((f) => `${f.source}: ${f.note}`),
        missing: evaluateTrack(ctx, t, { forRelease: t.releaseIds.length > 0 }).filter((i) => i.status !== "complete" && i.status !== "not_applicable").map(infoLine),
      };
    }
    case "list_releases":
      return ctx.releases.map((r) => {
        const p = checklistProgress(effectiveChecklist(ctx, r));
        return { id: r.id, title: r.title, type: r.releaseType, date: r.releaseDate, dateConfirmed: r.releaseDateConfirmed, status: r.status, distributor: r.distributor, checklist: `${p.done}/${p.total}`, missingRequired: summarize(evaluateRelease(ctx, r)).missingRequired, demo: r.isDemo || undefined };
      });
    case "get_release": {
      const r = ctx.releases.find((x) => x.id === input.release_id);
      if (!r) return { error: "No release with that id. Use list_releases." };
      return {
        id: r.id, title: r.title, type: r.releaseType, date: r.releaseDate, dateConfirmed: r.releaseDateConfirmed, status: r.status, distributor: r.distributor, strategy: r.strategy, notes: r.notes,
        tracks: r.trackIds.map((id) => ({ id, title: ctx.tracks.find((t) => t.id === id)?.title })),
        checklist: effectiveChecklist(ctx, r).map((i) => ({ step: i.label, status: i.effectiveStatus, due: i.dueDate, overdue: i.overdue, autoVerified: i.auto, externalAction: i.external })),
        releaseDay: r.execution.map((i) => ({ step: i.label, status: i.status })),
        reviews: r.reviews.map((v) => ({ period: v.period, due: v.dueDate, status: v.status, summary: v.summary })),
        campaigns: ctx.campaigns.filter((c) => c.releaseId === r.id).map((c) => ({ id: c.id, name: c.name, status: c.status })),
        missing: evaluateRelease(ctx, r).filter((i) => i.status !== "complete" && i.status !== "not_applicable").map(infoLine),
      };
    }
    case "list_tasks": {
      const scope = (input.scope as string) ?? "open";
      const week = new Date(`${ctx.today}T00:00:00Z`);
      week.setUTCDate(week.getUTCDate() + 7);
      const weekIso = week.toISOString().slice(0, 10);
      const list = ctx.tasks.filter((t) => {
        const open = OPEN_TASK_STATUSES.includes(t.status);
        if (scope === "open") return open;
        if (scope === "overdue") return open && t.dueDate && t.dueDate < ctx.today;
        if (scope === "due_this_week") return open && t.dueDate && t.dueDate <= weekIso;
        if (scope === "completed") return t.status === "completed";
        return true;
      });
      return list.slice(0, 60).map((t) => ({ id: t.id, title: t.title, status: t.status, priority: t.priority, due: t.dueDate, phase: t.phaseKey, origin: t.source }));
    }
    case "list_campaigns":
      return ctx.campaigns.map((c) => ({
        id: c.id, name: c.name, status: c.status, objective: c.objective, start: c.startDate, end: c.endDate, budget: c.budget, currency: c.currency, channels: c.channels,
        release: ctx.releases.find((r) => r.id === c.releaseId)?.title, ads: c.ads.map((a) => ({ name: a.name, status: a.status, planned: a.plannedSpend, actual: a.actualSpend })),
        content: ctx.content.filter((x) => x.campaignId === c.id).length, missingRequired: summarize(evaluateCampaign(ctx, c)).missingRequired, results: c.results,
      }));
    case "list_content":
      return ctx.content.filter((c) => !input.campaign_id || c.campaignId === input.campaign_id).slice(0, 60).map((c) => ({ id: c.id, title: c.title, platform: c.platform, format: c.format, stage: c.stage, approval: c.approvalStatus, planned: c.plannedDate, caption: c.caption, metrics: Object.keys(c.metrics ?? {}).length ? c.metrics : undefined }));
    case "list_contacts":
      return ctx.contacts.map((c) => ({ id: c.id, name: c.name, category: c.category, organization: c.organization, role: c.role, pipeline: c.pipelineStatus, lastContact: c.lastContactDate, nextFollowUp: c.nextFollowUpDate, team: c.isTeamMember }));
    case "get_finance_summary": {
      const month = typeof input.month === "string" && /^\d{4}-\d{2}$/.test(input.month) ? input.month : ctx.today.slice(0, 7);
      const s = summarizePeriod(ctx.transactions, ctx.settings.currency, ...monthRange(month));
      const prev = summarizePeriod(ctx.transactions, ctx.settings.currency, ...monthRange(previousMonth(month)));
      return {
        currency: ctx.settings.currency, month, note: "Actual recorded values only. Estimates/forecasts listed separately. Foreign-currency records without an exchange rate are excluded and counted as unconverted.",
        actual: { income: s.income.amount, expenses: s.expenses.amount, net: s.net, royalties: s.royalties.amount, marketing: s.marketing.amount, unconvertedRecords: s.income.unconverted + s.expenses.unconverted },
        previousMonth: { income: prev.income.amount, expenses: prev.expenses.amount, net: prev.net },
        outstandingIncome: s.outstandingIncome.amount, estimatedIncome: s.estimatedIncome.amount, forecastIncome: s.forecastIncome.amount,
        monthlyBudget: ctx.profile.business?.monthlyBudget ?? null, recordsInMonth: s.count,
        budgets: ctx.budgets.filter((b) => !b.isDemo).map((b) => ({ name: b.name, scope: b.scope, amount: b.amount, currency: b.currency })),
      };
    }
    case "get_analytics": {
      const rows = await db.select().from(analyticsRecords).where(and(eq(analyticsRecords.userId, ctx.userId), ...(input.metric ? [eq(analyticsRecords.metric, String(input.metric))] : []))).orderBy(desc(analyticsRecords.periodEnd)).limit(60);
      return { count: rows.length, records: rows.map((r) => ({ metric: r.metric, value: r.value, platform: r.platform, periodStart: r.periodStart, periodEnd: r.periodEnd, source: r.source, verification: r.isDemo ? "DEMO DATA" : r.verification })) };
    }
    case "get_phase": {
      const p = PHASES.find((x) => x.key === input.phase);
      if (!p) return { error: "Unknown phase" };
      const ev = p.evaluate(ctx);
      return { title: p.title, objective: p.objective, status: phaseStatus(ctx, p.key), completionCriteria: p.completionCriteria, progress: ev.progress, criteriaMet: ev.criteriaMet, checks: ev.checks, blockers: ev.blockers, nextAction: ev.nextAction };
    }
  }
  return { error: `Unknown tool ${name}` };
}

/** Validate a proposal's references and record it as pending. Returns text for the model. */
export async function recordProposal(ctx: BusinessContext, conversationId: string, name: string, input: Record<string, unknown>) {
  const kind = PROPOSAL_KIND[name];
  if (!kind) return { error: "Unknown proposal tool" };
  const ids = {
    track: new Set(ctx.tracks.map((t) => t.id)),
    release: new Set(ctx.releases.map((r) => r.id)),
    campaign: new Set(ctx.campaigns.map((c) => c.id)),
    contact: new Set(ctx.contacts.map((c) => c.id)),
  };
  const bad: string[] = [];
  const check = (set: Set<string>, v: unknown, label: string) => {
    if (v && !set.has(String(v))) bad.push(`${label} ${v} does not exist`);
  };
  if (name === "propose_tasks") for (const t of (input.tasks as Record<string, unknown>[]) ?? []) { check(ids.track, t.track_id, "track"); check(ids.release, t.release_id, "release"); check(ids.campaign, t.campaign_id, "campaign"); }
  if (name === "propose_release") for (const t of (input.track_ids as string[]) ?? []) check(ids.track, t, "track");
  if (name === "propose_outreach_draft") check(ids.contact, input.contact_id, "contact");
  if (name === "propose_campaign") check(ids.release, input.release_id, "release");
  if (name === "propose_content") for (const c of (input.items as Record<string, unknown>[]) ?? []) { check(ids.campaign, c.campaign_id, "campaign"); check(ids.track, c.track_id, "track"); }
  if (name === "propose_information") {
    for (const f of (input.fields as Record<string, string>[]) ?? []) {
      const req = getRequirement(`${f.entity}.${f.key}`);
      if (!req) bad.push(`unknown field ${f.entity}.${f.key}`);
      if (f.entity !== "profile") check(ids[f.entity as "track" | "release" | "campaign"] ?? new Set(), f.entity_id, f.entity);
      if (f.key === "legalName") bad.push("legal name must be entered by the artist directly");
    }
  }
  if (bad.length) return { error: `Proposal rejected: ${bad.join("; ")}. Fix the ids/fields and try again.` };
  const [row] = await db
    .insert(aiProposedActions)
    .values({ userId: ctx.userId, conversationId, kind, summary: String(input.summary ?? name).slice(0, 300), payload: input, status: "pending" })
    .returning({ id: aiProposedActions.id });
  return { status: "pending_approval", proposal_id: row.id, note: "Recorded as a proposal. Nothing has been created or changed. The artist must approve it in the chat." };
}

export { profileView };
