import type { BusinessContext } from "./types";
import { evaluateProfile } from "./info/engine";
import { displayValue } from "./fields";
import { getRequirement } from "./info/registry";

export type SearchHit = { type: string; title: string; subtitle?: string; href: string };

/**
 * Search across the business. Sensitive documents match by title only and
 * never expose notes; financial records match on description/counterparty.
 */
export function searchContext(ctx: BusinessContext, docs: { id: string; title: string; fileName: string | null; tags: string[]; notes: string | null; sensitive: boolean; category: string }[], query: string): SearchHit[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const has = (...v: (string | null | undefined)[]) => v.some((x) => x?.toLowerCase().includes(q));
  const hits: SearchHit[] = [];
  for (const t of ctx.tracks) if (has(t.title, t.projectCode, t.genre, t.mood, t.isrc, t.lyrics, t.productionNotes, ...t.featuredArtists)) hits.push({ type: "Track", title: t.title, subtitle: `${t.projectCode} · ${t.status}`, href: `/catalog/${t.id}` });
  for (const r of ctx.releases) if (has(r.title, r.distributor, r.upc, r.notes, r.strategy)) hits.push({ type: "Release", title: r.title, subtitle: `${r.status}${r.releaseDate ? ` · ${r.releaseDate}` : ""}`, href: `/releases/${r.id}` });
  for (const p of ctx.projects) if (has(p.name, p.description)) hits.push({ type: "Project", title: p.name, subtitle: p.status, href: `/tasks/projects/${p.id}` });
  for (const t of ctx.tasks) if (has(t.title, t.description, t.notes)) hits.push({ type: "Task", title: t.title, subtitle: t.status.replace("_", " "), href: `/tasks/${t.id}` });
  for (const c of ctx.contacts) if (has(c.name, c.organization, c.role, c.email, c.location, c.notes)) hits.push({ type: "Contact", title: c.name, subtitle: [c.category, c.organization].filter(Boolean).join(" · "), href: `/contacts/${c.id}` });
  for (const c of ctx.campaigns) if (has(c.name, c.objective, c.message, c.notes)) hits.push({ type: "Campaign", title: c.name, subtitle: c.status, href: `/marketing/${c.id}` });
  for (const c of ctx.content) if (has(c.title, c.caption, c.hashtags, c.script)) hits.push({ type: "Content", title: c.title, subtitle: [c.platform, c.stage].filter(Boolean).join(" · "), href: `/content/${c.id}` });
  for (const d of docs) if (d.sensitive ? has(d.title) : has(d.title, d.fileName, d.notes, ...d.tags)) hits.push({ type: "Document", title: d.title, subtitle: d.sensitive ? "Sensitive" : d.category, href: `/documents?doc=${d.id}` });
  for (const t of ctx.transactions) if (has(t.description, t.counterparty, t.category)) hits.push({ type: "Financial record", title: t.description, subtitle: `${t.kind} · ${t.date}`, href: `/finances/${t.id}` });
  for (const g of ctx.goals) if (has(g.title, g.metric, g.notes)) hits.push({ type: "Goal", title: g.title, subtitle: g.horizon, href: "/business?tab=goals" });
  for (const i of evaluateProfile(ctx)) {
    if (!i.requirementId || i.status !== "complete") continue;
    const req = getRequirement(i.requirementId)!;
    const v = displayValue(req, i.value);
    if (has(v, i.label) && req.key !== "legalName") hits.push({ type: "Saved information", title: i.label, subtitle: v.length > 90 ? `${v.slice(0, 90)}…` : v, href: i.href });
  }
  return hits.slice(0, 200);
}
