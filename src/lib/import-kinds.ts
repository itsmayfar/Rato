import type { FieldDef } from "./fields";
import { ANALYTICS_FIELDS, CONTACT_FIELDS, TRACK_FIELDS, TRANSACTION_FIELDS } from "./forms";

const noRel = (defs: FieldDef[]) => defs.filter((d) => !d.key.endsWith("Id"));

export const IMPORT_KINDS = {
  tracks: {
    title: "Import tracks",
    description: "Add existing and unreleased tracks to the Music Catalog.",
    defs: TRACK_FIELDS.map((d) => (d.key === "status" ? { ...d, required: false } : d)),
    back: "/catalog",
  },
  transactions: {
    title: "Import financial records",
    description: "Income and expenses, e.g. a distributor royalty statement or bank export. Amounts must be positive; use the “kind” column for income/expense.",
    defs: noRel(TRANSACTION_FIELDS),
    back: "/finances",
  },
  contacts: {
    title: "Import contacts",
    description: "Producers, labels, curators, promoters and other business contacts.",
    defs: CONTACT_FIELDS,
    back: "/contacts",
  },
  analytics: {
    title: "Import audience & performance data",
    description: "Metrics exported from Spotify for Artists, YouTube Studio, ads managers or your distributor. Imported values are marked with their source (CSV).",
    defs: noRel(ANALYTICS_FIELDS),
    back: "/analytics",
  },
} as const;

export type ImportKind = keyof typeof IMPORT_KINDS;

export function normalizeHeader(h: string) {
  return h.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Map CSV headers to field keys by key or label (case/spacing insensitive). */
export function mapHeaders(headers: string[], defs: readonly FieldDef[]) {
  const map = new Map<string, string>();
  for (const h of headers) {
    const n = normalizeHeader(h);
    const def = defs.find((d) => normalizeHeader(d.key) === n || normalizeHeader(d.label) === n);
    if (def) map.set(h, def.key);
  }
  return map;
}
