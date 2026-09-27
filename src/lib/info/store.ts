import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "../db";
import * as s from "../db/schema";
import type { FieldValue } from "../fields";
import { getPath } from "./engine";
import { getRequirement, type EntityType } from "./registry";

export type InfoChange = {
  entityType: EntityType;
  entityId: string;
  key: string;
  value?: FieldValue;
  /** Mark as not applicable instead of saving a value. */
  notApplicable?: boolean;
  /** Confirm the currently stored value (clears needs_confirmation / outdated). */
  confirmOnly?: boolean;
};

type Source = "user" | "assistant" | "import" | "estimate" | "integration";

const tableFor = {
  track: s.tracks,
  release: s.releases,
  campaign: s.campaigns,
} as const;

async function loadRecord(userId: string, entityType: EntityType, entityId: string): Promise<Record<string, unknown>> {
  if (entityType === "profile") {
    const [p] = await db.select().from(s.artistProfiles).where(and(eq(s.artistProfiles.id, entityId), eq(s.artistProfiles.userId, userId)));
    if (!p) throw new Error("Profile not found");
    return p as unknown as Record<string, unknown>;
  }
  if (entityType === "platform") {
    const links = await db.select().from(s.platformLinks).where(eq(s.platformLinks.userId, userId));
    return Object.fromEntries(links.map((l) => [l.platform, l.url]));
  }
  const table = tableFor[entityType];
  const [row] = await db.select().from(table).where(and(eq(table.id, entityId), eq(table.userId, userId)));
  if (!row) throw new Error(`${entityType} not found`);
  return row as unknown as Record<string, unknown>;
}

/**
 * Apply answers from the question engine. Values are validated by the caller
 * (parseFieldValue). Previous values are preserved in info_field_meta.
 */
export async function applyInfoChanges(userId: string, changes: InfoChange[], source: Source = "user") {
  // group by entity
  const groups = new Map<string, InfoChange[]>();
  for (const c of changes) {
    const k = `${c.entityType}|${c.entityId}`;
    groups.set(k, [...(groups.get(k) ?? []), c]);
  }

  await db.transaction(async (tx) => {
    for (const [k, list] of groups) {
      const [entityType, entityId] = k.split("|") as [EntityType, string];
      const record = await loadRecord(userId, entityType, entityId);
      const update: Record<string, unknown> = {};
      const jsonPatches: Record<string, Record<string, unknown>> = {};

      for (const c of list) {
        const req = getRequirement(`${entityType}.${c.key}`);
        if (!req) throw new Error(`Unknown field ${entityType}.${c.key}`);
        const previous = entityType === "platform" ? record[req.path] : getPath(record, req.path);

        if (!c.notApplicable && !c.confirmOnly) {
          if (entityType === "platform") {
            await tx
              .insert(s.platformLinks)
              .values({ userId, platform: req.path, url: (c.value as string) ?? null })
              .onConflictDoUpdate({
                target: [s.platformLinks.userId, s.platformLinks.platform],
                set: { url: (c.value as string) ?? null, updatedAt: new Date() },
              });
          } else {
            const [head, tail] = req.path.split(".", 2);
            if (tail) {
              jsonPatches[head] ??= { ...((record[head] as Record<string, unknown>) ?? {}) };
              jsonPatches[head][tail] = c.value ?? null;
            } else {
              update[head] = c.value ?? (req.type === "tristate" ? "unknown" : req.type === "tags" || req.type === "multiselect" ? [] : null);
            }
          }
        }

        const override = c.notApplicable ? "not_applicable" : null;
        await tx
          .insert(s.infoFieldMeta)
          .values({
            userId,
            entityType,
            entityId,
            fieldKey: c.key,
            override,
            source,
            previousValue: c.confirmOnly ? null : (previous ?? null),
            confirmedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [s.infoFieldMeta.userId, s.infoFieldMeta.entityType, s.infoFieldMeta.entityId, s.infoFieldMeta.fieldKey],
            set: {
              override,
              source: c.confirmOnly ? undefined : source,
              ...(c.confirmOnly ? {} : { previousValue: previous ?? null }),
              confirmedAt: new Date(),
              updatedAt: new Date(),
            },
          });
      }

      Object.assign(update, jsonPatches);
      if (Object.keys(update).length) {
        if (entityType === "profile") {
          await tx.update(s.artistProfiles).set(update).where(and(eq(s.artistProfiles.id, entityId), eq(s.artistProfiles.userId, userId)));
        } else if (entityType !== "platform") {
          const table = tableFor[entityType];
          await tx.update(table).set(update).where(and(eq(table.id, entityId), eq(table.userId, userId)));
        }
      }
    }
  });
}

/** Record that fields were edited through a regular form (keeps freshness tracking accurate). */
export async function touchInfoMeta(userId: string, entityType: EntityType, entityId: string, keys: string[], source: Source = "user") {
  for (const key of keys) {
    if (!getRequirement(`${entityType}.${key}`)) continue;
    await db
      .insert(s.infoFieldMeta)
      .values({ userId, entityType, entityId, fieldKey: key, source, confirmedAt: new Date() })
      .onConflictDoUpdate({
        target: [s.infoFieldMeta.userId, s.infoFieldMeta.entityType, s.infoFieldMeta.entityId, s.infoFieldMeta.fieldKey],
        set: { source, confirmedAt: new Date(), updatedAt: new Date(), override: null },
      });
  }
}

/** Flag a field for confirmation (e.g. values suggested by the assistant or imported). */
export async function flagNeedsConfirmation(userId: string, entityType: EntityType, entityId: string, key: string, source: Source) {
  await db
    .insert(s.infoFieldMeta)
    .values({ userId, entityType, entityId, fieldKey: key, override: "needs_confirmation", source })
    .onConflictDoUpdate({
      target: [s.infoFieldMeta.userId, s.infoFieldMeta.entityType, s.infoFieldMeta.entityId, s.infoFieldMeta.fieldKey],
      set: { override: "needs_confirmation", source, updatedAt: new Date() },
    });
}
