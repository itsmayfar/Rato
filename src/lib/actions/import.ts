"use server";

import { revalidatePath } from "next/cache";
import { count, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { fail, ok, type ActionState } from "@/lib/action-state";
import { getProfile, getSettings } from "@/lib/context";
import { parseCSVObjects } from "@/lib/csv";
import { db } from "@/lib/db";
import { analyticsRecords, contacts, rightsRecords, tracks, transactions } from "@/lib/db/schema";
import { parseFieldValue, type FieldValue } from "@/lib/fields";
import { IMPORT_KINDS, mapHeaders, type ImportKind } from "@/lib/import-kinds";

const MAX_ROWS = 5000;
const nn = (v: FieldValue | undefined) => (v === "" || v === undefined ? null : v);

export async function importCsv(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const kind = String(form.get("kind") ?? "") as ImportKind;
  const cfg = IMPORT_KINDS[kind];
  if (!cfg) return fail("Unknown import type.");
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return fail("Choose a CSV file.");
  if (file.size > 1.8 * 1024 * 1024) return fail("CSV files must be smaller than 1.8 MB. Split larger files.");
  const { headers, rows } = parseCSVObjects(await file.text());
  if (!rows.length) return fail("The file has no data rows.");
  if (rows.length > MAX_ROWS) return fail(`At most ${MAX_ROWS} rows per import.`);
  const mapping = mapHeaders(headers, cfg.defs);
  const missingRequired = cfg.defs.filter((d) => d.required && ![...mapping.values()].includes(d.key));
  if (missingRequired.length) return fail(`Missing required column(s): ${missingRequired.map((d) => d.key).join(", ")}.`);

  const parsedRows: Record<string, FieldValue>[] = [];
  const errors: string[] = [];
  rows.forEach((row, i) => {
    const out: Record<string, FieldValue> = {};
    for (const [header, key] of mapping) {
      const def = cfg.defs.find((d) => d.key === key)!;
      const raw = row[header] ?? "";
      const res = parseFieldValue(def.type === "boolean" ? def : def, def.type === "boolean" ? (/^(1|true|yes|y)$/i.test(raw) ? "true" : "false") : raw);
      if (res.ok) out[key] = res.value;
      else errors.push(`Row ${i + 2}: ${res.error}`);
    }
    parsedRows.push(out);
  });
  const unmapped = headers.filter((h) => !mapping.has(h));
  if (errors.length) return fail(`No records were imported. Fix ${errors.length} problem(s) and try again.`, { __list: errors.slice(0, 50).join("\n") });

  if (form.get("mode") !== "import") {
    return ok(`${parsedRows.length} row(s) are valid and ready to import.${unmapped.length ? ` Ignored columns: ${unmapped.join(", ")}.` : ""}`, {
      preview: parsedRows.slice(0, 5),
      columns: [...new Set(mapping.values())],
      valid: true,
    });
  }

  const settings = await getSettings(user.id);
  let inserted = 0;
  await db.transaction(async (tx) => {
    if (kind === "tracks") {
      const profile = await getProfile(user.id);
      const [{ n }] = await tx.select({ n: count() }).from(tracks).where(eq(tracks.userId, user.id));
      let seq = n;
      for (const r of parsedRows) {
        seq++;
        const [row] = await tx
          .insert(tracks)
          .values({
            userId: user.id,
            projectCode: (nn(r.projectCode) as string) ?? `MF-${String(seq).padStart(3, "0")}-${Date.now().toString(36).slice(-3)}`,
            title: r.title as string,
            status: (nn(r.status) as string) ?? "Idea",
            primaryArtist: (nn(r.primaryArtist) as string) ?? profile.artistName,
            featuredArtists: (r.featuredArtists as string[]) ?? [],
            genre: nn(r.genre) as string | null,
            subgenre: nn(r.subgenre) as string | null,
            bpm: nn(r.bpm) as number | null,
            musicalKey: nn(r.musicalKey) as string | null,
            mood: nn(r.mood) as string | null,
            language: nn(r.language) as string | null,
            durationSec: nn(r.durationSec) as number | null,
            explicit: (nn(r.explicit) as string) ?? "unknown",
            hasCollaborators: (nn(r.hasCollaborators) as string) ?? "unknown",
            isrc: nn(r.isrc) as string | null,
            plannedReleaseDate: nn(r.plannedReleaseDate) as string | null,
            actualReleaseDate: nn(r.actualReleaseDate) as string | null,
            lyrics: nn(r.lyrics) as string | null,
            productionNotes: nn(r.productionNotes) as string | null,
          })
          .returning({ id: tracks.id });
        await tx.insert(rightsRecords).values({ userId: user.id, trackId: row.id });
        inserted++;
      }
    } else if (kind === "transactions") {
      for (const r of parsedRows) {
        const currency = (r.currency as string) ?? settings.currency;
        const fxRate = nn(r.fxRate) as number | null;
        await tx.insert(transactions).values({
          userId: user.id,
          kind: r.kind as string,
          category: r.category as string,
          description: r.description as string,
          amount: r.amount as number,
          currency,
          baseAmount: currency === settings.currency ? null : fxRate ? Math.round((r.amount as number) * fxRate * 100) / 100 : null,
          fxRate,
          fxSource: nn(r.fxSource) as string | null,
          fxDate: nn(r.fxDate) as string | null,
          date: r.date as string,
          nature: (nn(r.nature) as string) ?? "actual",
          paymentStatus: (nn(r.paymentStatus) as string) ?? "paid",
          counterparty: nn(r.counterparty) as string | null,
          notes: nn(r.notes) as string | null,
        });
        inserted++;
      }
    } else if (kind === "contacts") {
      for (const r of parsedRows) {
        await tx.insert(contacts).values({
          userId: user.id,
          name: r.name as string,
          organization: nn(r.organization) as string | null,
          role: nn(r.role) as string | null,
          category: (nn(r.category) as string) ?? "Other",
          pipelineStatus: (nn(r.pipelineStatus) as string) ?? "potential",
          email: nn(r.email) as string | null,
          phone: nn(r.phone) as string | null,
          website: nn(r.website) as string | null,
          socials: Object.fromEntries(([["instagram", r.instagram], ["other", r.soundcloud]] as const).filter(([, v]) => v).map(([k, v]) => [k, String(v)])),
          location: nn(r.location) as string | null,
          isTeamMember: Boolean(r.isTeamMember),
          lastContactDate: nn(r.lastContactDate) as string | null,
          nextFollowUpDate: nn(r.nextFollowUpDate) as string | null,
          notes: nn(r.notes) as string | null,
        });
        inserted++;
      }
    } else if (kind === "analytics") {
      for (const r of parsedRows) {
        await tx.insert(analyticsRecords).values({
          userId: user.id,
          metric: r.metric as string,
          value: r.value as number,
          platform: r.platform as string,
          periodStart: nn(r.periodStart) as string | null,
          periodEnd: r.periodEnd as string,
          source: "csv",
          verification: (nn(r.verification) as string) ?? "manual",
          notes: nn(r.notes) as string | null,
        });
        inserted++;
      }
    }
  });
  await audit(user.id, "import.csv", kind, null, `Imported ${inserted} ${kind} from ${file.name}`);
  revalidatePath("/", "layout");
  return ok(`Imported ${inserted} record(s).`, { imported: inserted });
}
