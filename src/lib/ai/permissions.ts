/**
 * What the assistant may create without asking first. Each kind matches a
 * proposal kind. Off by default: every proposal waits for the artist's approval.
 * Spending money, publishing, sending, legal names, ownership splits and
 * financial records are never on this list.
 */
export const AI_PERMISSIONS = [
  { kind: "create_tasks", label: "Create tasks", help: "To-dos with due dates, linked to releases, tracks or campaigns." },
  { kind: "create_content", label: "Add content drafts", help: "Post ideas and captions in the Content Studio (never published automatically)." },
  { kind: "draft_outreach", label: "Save outreach drafts", help: "Message drafts for contacts (never sent automatically)." },
  { kind: "create_campaign", label: "Create campaigns", help: "Campaign plans. Ad spend still needs your approval in the campaign." },
  { kind: "create_release", label: "Create releases", help: "New releases in planning, with their checklist." },
  { kind: "save_info", label: "Save information you told it", help: "Profile, track and release details you gave in the chat (never legal names)." },
] as const;

export type AiPermissionKind = (typeof AI_PERMISSIONS)[number]["kind"];

export function canAutoCreate(perms: Record<string, boolean> | null | undefined, kind: string): boolean {
  return AI_PERMISSIONS.some((p) => p.kind === kind) && perms?.[kind] === true;
}

export function allowedKinds(perms: Record<string, boolean> | null | undefined): AiPermissionKind[] {
  return AI_PERMISSIONS.filter((p) => perms?.[p.kind] === true).map((p) => p.kind);
}
