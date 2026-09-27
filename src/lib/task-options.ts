import type { BusinessContext } from "./types";

/** Dynamic select options for relation fields. */
export function relationOptions(ctx: BusinessContext) {
  return {
    projectId: ctx.projects.filter((p) => p.status !== "archived").map((p) => ({ value: p.id, label: p.name })),
    trackId: ctx.tracks.filter((t) => t.status !== "Archived").map((t) => ({ value: t.id, label: t.title })),
    releaseId: ctx.releases.filter((r) => r.status !== "Archived").map((r) => ({ value: r.id, label: r.title })),
    campaignId: ctx.campaigns.filter((c) => c.status !== "Archived").map((c) => ({ value: c.id, label: c.name })),
    contactId: ctx.contacts.map((c) => ({ value: c.id, label: c.name })),
    goalId: ctx.goals.map((g) => ({ value: g.id, label: g.title })),
    documentId: ctx.documents.filter((d) => d.isLatest).map((d) => ({ value: d.id, label: d.title })),
  };
}
