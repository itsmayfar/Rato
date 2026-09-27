import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { campaigns, contacts, contentItems, outreachRecords, releaseTracks, releases, projects, tasks, tracks } from "../db/schema";
import { getProfile } from "../context";
import { parseFieldValue } from "../fields";
import { getRequirement, type EntityType } from "../info/registry";
import { applyInfoChanges, type InfoChange } from "../info/store";
import { syncReleaseChecklist } from "../releases/store";
import { insertGeneratedTasks, syncInformationTasks } from "../tasks/generate";
import { isValidISODate, todayISO } from "../utils";

type P = Record<string, unknown>;
const date = (v: unknown) => (typeof v === "string" && isValidISODate(v) ? v : null);
const str = (v: unknown, max = 2000) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

async function owned(table: typeof tracks | typeof releases | typeof campaigns | typeof contacts, userId: string, id: unknown) {
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/.test(id)) return null;
  const t = table as typeof tracks;
  const [row] = await db.select({ id: t.id }).from(t).where(and(eq(t.id, id), eq(t.userId, userId)));
  return row?.id ?? null;
}

/** Apply an approved assistant proposal. Everything is re-validated here. */
export async function applyProposal(userId: string, proposalId: string, kind: string, payload: P): Promise<string> {
  switch (kind) {
    case "create_tasks": {
      const list = (payload.tasks as P[]) ?? [];
      const rows = [];
      for (const [i, t] of list.entries()) {
        const title = str(t.title, 300);
        if (!title) continue;
        rows.push({
          title,
          description: str(t.description),
          dueDate: date(t.due_date),
          priority: ["low", "medium", "high", "urgent"].includes(String(t.priority)) ? String(t.priority) : "medium",
          phaseKey: str(t.phase, 40),
          trackId: await owned(tracks, userId, t.track_id),
          releaseId: await owned(releases, userId, t.release_id),
          campaignId: await owned(campaigns, userId, t.campaign_id),
          status: "planned",
          source: "assistant",
          sourceKey: `ai:${proposalId}:${i}`,
        });
      }
      const n = await insertGeneratedTasks(userId, rows);
      return `${n} task(s) created.`;
    }
    case "create_release": {
      const title = str(payload.title, 200);
      if (!title) throw new Error("Missing title");
      const trackIds = [];
      for (const id of (payload.track_ids as string[]) ?? []) {
        const ok = await owned(tracks, userId, id);
        if (ok) trackIds.push(ok);
      }
      const profile = await getProfile(userId);
      const releaseType = ["single", "ep", "album", "remix", "compilation"].includes(String(payload.release_type)) ? String(payload.release_type) : "single";
      const [project] = await db.insert(projects).values({ userId, name: `Release: ${title}`, kind: "release", phaseKey: "release", status: "active", startDate: todayISO() }).returning({ id: projects.id });
      const [r] = await db
        .insert(releases)
        .values({ userId, title, releaseType, primaryArtist: profile.artistName, releaseDate: date(payload.release_date), distributor: str(payload.distributor, 100), preferences: { campaign: true, pitching: true }, projectId: project.id })
        .returning({ id: releases.id });
      if (trackIds.length) await db.insert(releaseTracks).values(trackIds.map((trackId, i) => ({ releaseId: r.id, trackId, position: i + 1 })));
      await syncReleaseChecklist(userId, r.id);
      await syncInformationTasks(userId);
      return `Release “${title}” created. Open it to answer the missing questions.|/releases/${r.id}/questions`;
    }
    case "save_info": {
      const changes: InfoChange[] = [];
      const errors: string[] = [];
      const profile = await getProfile(userId);
      for (const f of (payload.fields as P[]) ?? []) {
        const entity = String(f.entity) as EntityType;
        const req = getRequirement(`${entity}.${f.key}`);
        if (!req || req.key === "legalName") {
          errors.push(`${f.key}: not allowed`);
          continue;
        }
        const entityId = entity === "profile" ? profile.id : await owned(entity === "track" ? tracks : entity === "release" ? releases : campaigns, userId, f.entity_id);
        if (!entityId) {
          errors.push(`${req.label}: record not found`);
          continue;
        }
        const raw = String(f.value ?? "");
        const parsed = parseFieldValue({ ...req, required: true }, req.type === "multiselect" ? raw.split(",").map((s) => s.trim()) : raw);
        if (!parsed.ok) {
          errors.push(`${req.label}: ${parsed.error}`);
          continue;
        }
        changes.push({ entityType: entity, entityId, key: req.key, value: parsed.value });
      }
      if (changes.length) await applyInfoChanges(userId, changes, "assistant");
      await syncInformationTasks(userId);
      if (!changes.length) throw new Error(errors.join("; ") || "Nothing to save");
      return `Saved ${changes.length} field(s).${errors.length ? ` Skipped: ${errors.join("; ")}` : ""}`;
    }
    case "create_content": {
      let n = 0;
      for (const c of (payload.items as P[]) ?? []) {
        const title = str(c.title, 200);
        if (!title) continue;
        await db.insert(contentItems).values({
          userId,
          title,
          platform: str(c.platform, 60),
          format: str(c.format, 60),
          caption: str(c.caption, 4000),
          hashtags: str(c.hashtags, 500),
          callToAction: str(c.call_to_action, 300),
          script: str(c.script, 6000),
          plannedDate: date(c.planned_date),
          campaignId: await owned(campaigns, userId, c.campaign_id),
          trackId: await owned(tracks, userId, c.track_id),
          stage: c.caption ? "Script" : "Idea",
          approvalStatus: "not_requested",
          notes: "Drafted by the AI assistant — review before approving.",
        });
        n++;
      }
      return `${n} content draft(s) added to the Content Studio (not approved).`;
    }
    case "draft_outreach": {
      const contactId = await owned(contacts, userId, payload.contact_id);
      if (!contactId) throw new Error("Contact not found");
      await db.insert(outreachRecords).values({
        userId,
        contactId,
        date: todayISO(),
        kind: String(payload.kind ?? "other"),
        channel: "email",
        status: "draft",
        subject: str(payload.subject, 300),
        message: str(payload.message, 8000),
        draftedByAi: true,
      });
      return `Draft saved on the contact. It has not been sent.|/contacts/${contactId}`;
    }
    case "create_campaign": {
      const name = str(payload.name, 200);
      if (!name) throw new Error("Missing name");
      const releaseId = await owned(releases, userId, payload.release_id);
      let trackId: string | null = null;
      if (releaseId) {
        const [rt] = await db.select().from(releaseTracks).where(inArray(releaseTracks.releaseId, [releaseId])).limit(1);
        trackId = rt?.trackId ?? null;
      }
      const [c] = await db
        .insert(campaigns)
        .values({
          userId,
          name,
          releaseId,
          trackId,
          template: str(payload.template, 40),
          objective: str(payload.objective, 200),
          targetAudience: str(payload.target_audience),
          message: str(payload.message),
          startDate: date(payload.start_date),
          endDate: date(payload.end_date),
          successMetrics: str(payload.success_metrics),
          status: "Planning",
        })
        .returning({ id: campaigns.id });
      if (releaseId) await syncReleaseChecklist(userId, releaseId);
      await syncInformationTasks(userId);
      return `Campaign “${name}” created as a draft (Planning).|/marketing/${c.id}`;
    }
  }
  throw new Error("Unknown proposal type");
}
