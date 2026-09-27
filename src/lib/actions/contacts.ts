"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { fail, ok, type ActionState } from "@/lib/action-state";
import { db } from "@/lib/db";
import { contacts, outreachRecords } from "@/lib/db/schema";
import { parseForm } from "@/lib/fields";
import { CONTACT_FIELDS, OUTREACH_FIELDS } from "@/lib/forms";
import { PIPELINE_STATUSES } from "@/lib/constants";

const nn = <T,>(v: T) => (v === "" || v === undefined ? null : v);

export async function saveContact(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = String(form.get("id") ?? "");
  const parsed = parseForm(CONTACT_FIELDS, form);
  if (!parsed.ok) return fail("Check the highlighted fields.", parsed.errors);
  const d = parsed.data;
  const socials: Record<string, string> = {};
  if (d.instagram) socials.instagram = d.instagram as string;
  if (d.soundcloud) socials.other = d.soundcloud as string;
  const values = {
    name: d.name as string,
    organization: nn(d.organization) as string | null,
    role: nn(d.role) as string | null,
    category: d.category as string,
    pipelineStatus: d.pipelineStatus as string,
    email: nn(d.email) as string | null,
    phone: nn(d.phone) as string | null,
    website: nn(d.website) as string | null,
    socials,
    location: nn(d.location) as string | null,
    isTeamMember: Boolean(d.isTeamMember),
    lastContactDate: nn(d.lastContactDate) as string | null,
    nextFollowUpDate: nn(d.nextFollowUpDate) as string | null,
    notes: nn(d.notes) as string | null,
  };
  if (id) {
    const res = await db.update(contacts).set(values).where(and(eq(contacts.id, id), eq(contacts.userId, user.id))).returning({ id: contacts.id });
    if (!res.length) return fail("Contact not found.");
    revalidatePath("/", "layout");
    return ok("Contact saved.");
  }
  const [row] = await db.insert(contacts).values({ ...values, userId: user.id }).returning({ id: contacts.id });
  await audit(user.id, "contact.create", "contact", row.id, values.name);
  revalidatePath("/", "layout");
  redirect(`/contacts/${row.id}`);
}

export async function setPipelineStatus(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = String(form.get("id") ?? "");
  const status = String(form.get("status") ?? "");
  if (!PIPELINE_STATUSES.some((s) => s.value === status)) return fail("Invalid status.");
  const res = await db.update(contacts).set({ pipelineStatus: status }).where(and(eq(contacts.id, id), eq(contacts.userId, user.id))).returning({ id: contacts.id });
  if (!res.length) return fail("Contact not found.");
  revalidatePath("/contacts");
  return ok();
}

export async function deleteContact(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = String(form.get("id") ?? "");
  const [c] = await db.delete(contacts).where(and(eq(contacts.id, id), eq(contacts.userId, user.id))).returning({ name: contacts.name });
  if (!c) return fail("Contact not found.");
  await audit(user.id, "contact.delete", "contact", id, c.name);
  revalidatePath("/", "layout");
  redirect("/contacts");
}

/**
 * Record an outreach message. The app never sends messages: "sent" means the
 * user confirms they sent it themselves (e.g. via their email client).
 */
export async function saveOutreach(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const contactId = String(form.get("contactId") ?? "");
  const id = String(form.get("id") ?? "");
  const [contact] = await db.select().from(contacts).where(and(eq(contacts.id, contactId), eq(contacts.userId, user.id)));
  if (!contact) return fail("Contact not found.");
  const parsed = parseForm(OUTREACH_FIELDS, form);
  if (!parsed.ok) return fail("Check the highlighted fields.", parsed.errors);
  const d = parsed.data;
  const values = {
    date: d.date as string,
    kind: d.kind as string,
    channel: d.channel as string,
    status: d.status as string,
    subject: nn(d.subject) as string | null,
    message: nn(d.message) as string | null,
    notes: nn(d.notes) as string | null,
  };
  if (id) {
    const res = await db.update(outreachRecords).set(values).where(and(eq(outreachRecords.id, id), eq(outreachRecords.userId, user.id))).returning({ id: outreachRecords.id });
    if (!res.length) return fail("Outreach not found.");
  } else {
    await db.insert(outreachRecords).values({ ...values, userId: user.id, contactId, draftedByAi: form.get("draftedByAi") === "1" });
  }
  if (values.status === "sent" || values.status === "replied") {
    const pipeline = values.status === "replied" ? "discussion" : ["potential", "researching", "ready"].includes(contact.pipelineStatus) ? "waiting" : contact.pipelineStatus;
    await db.update(contacts).set({ lastContactDate: values.date, pipelineStatus: pipeline }).where(eq(contacts.id, contactId));
  }
  await audit(user.id, `outreach.${values.status}`, "contact", contactId, values.subject ?? values.kind);
  revalidatePath(`/contacts/${contactId}`);
  return ok(values.status === "draft" ? "Draft saved. Nothing has been sent." : "Outreach recorded.");
}
