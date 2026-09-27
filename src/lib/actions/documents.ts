"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { fail, ok, type ActionState } from "@/lib/action-state";
import { assertOwned } from "@/lib/context";
import { db } from "@/lib/db";
import { campaigns, contacts, documents, releases, tracks } from "@/lib/db/schema";
import { parseForm } from "@/lib/fields";
import { DOCUMENT_FIELDS } from "@/lib/forms";
import { removeObject } from "@/lib/storage";

const nn = <T,>(v: T) => (v === "" || v === undefined ? null : v);

export async function saveDocument(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = String(form.get("id") ?? "");
  const parsed = parseForm(DOCUMENT_FIELDS, form);
  if (!parsed.ok) return fail("Check the highlighted fields.", parsed.errors);
  const d = parsed.data;
  try {
    await assertOwned(tracks, user.id, [d.trackId as string]);
    await assertOwned(releases, user.id, [d.releaseId as string]);
    await assertOwned(campaigns, user.id, [d.campaignId as string]);
    await assertOwned(contacts, user.id, [d.contactId as string]);
  } catch {
    return fail("Linked record not found.");
  }
  const values = {
    title: d.title as string,
    category: d.category as string,
    tags: (d.tags as string[]) ?? [],
    externalUrl: nn(d.externalUrl) as string | null,
    trackId: nn(d.trackId) as string | null,
    releaseId: nn(d.releaseId) as string | null,
    campaignId: nn(d.campaignId) as string | null,
    contactId: nn(d.contactId) as string | null,
    sensitive: Boolean(d.sensitive),
    notes: nn(d.notes) as string | null,
  };
  if (id) {
    const res = await db.update(documents).set(values).where(and(eq(documents.id, id), eq(documents.userId, user.id))).returning({ id: documents.id });
    if (!res.length) return fail("Document not found.");
    revalidatePath("/", "layout");
    return ok("Document saved.");
  }
  if (!values.externalUrl) return fail("Add a link, or upload a file instead.", { externalUrl: "Required for link documents" });
  await db.insert(documents).values({ ...values, userId: user.id });
  await audit(user.id, "document.link", "document", null, values.title);
  revalidatePath("/", "layout");
  return ok("Link saved.");
}

export async function deleteDocument(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = String(form.get("id") ?? "");
  const [doc] = await db.delete(documents).where(and(eq(documents.id, id), eq(documents.userId, user.id))).returning();
  if (!doc) return fail("Document not found.");
  if (doc.storageKey) await removeObject(doc.storageKey).catch(() => {});
  // previous version becomes the latest again
  if (doc.previousVersionId) await db.update(documents).set({ isLatest: true }).where(and(eq(documents.id, doc.previousVersionId), eq(documents.userId, user.id)));
  await audit(user.id, "document.delete", "document", id, `${doc.title} v${doc.version}`);
  revalidatePath("/", "layout");
  return ok("Document deleted.");
}
