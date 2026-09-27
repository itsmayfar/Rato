import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { Mail, Plus, Sparkles, Trash2 } from "lucide-react";
import { ContactForm } from "@/components/marketing/contact-form";
import { ConfirmAction } from "@/components/ui/form";
import { FormModal } from "@/components/ui/form-modal";
import { Badge, Card, CardHeader, EmptyState, LinkButton, PageHeader, StatusBadge } from "@/components/ui/primitives";
import { deleteContact, saveOutreach } from "@/lib/actions/contacts";
import { requireUser } from "@/lib/auth";
import { OUTREACH_KINDS, PIPELINE_STATUSES } from "@/lib/constants";
import { loadContext } from "@/lib/context";
import { db } from "@/lib/db";
import { outreachRecords } from "@/lib/db/schema";
import { OUTREACH_FIELDS } from "@/lib/forms";
import { formatDate } from "@/lib/utils";

export default async function ContactPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const ctx = await loadContext(user.id);
  const c = ctx.contacts.find((x) => x.id === id);
  if (!c) notFound();
  const outreach = await db.select().from(outreachRecords).where(and(eq(outreachRecords.contactId, id), eq(outreachRecords.userId, user.id))).orderBy(desc(outreachRecords.date));
  const credits = ctx.tracks.filter((t) => t.collaborators.some((x) => x.contactId === id));
  const prompt = encodeURIComponent(`Draft an outreach email to ${c.name}${c.organization ? ` (${c.organization})` : ""}, category ${c.category}. Use my artist profile and my next release if relevant.`);
  return (
    <div>
      <PageHeader
        eyebrow={<Link href="/contacts" className="hover:text-fg">Contacts</Link>}
        title={c.name}
        purpose={[c.role, c.organization, c.category, c.location].filter(Boolean).join(" · ")}
        actions={
          <>
            <StatusBadge status={c.pipelineStatus} label={PIPELINE_STATUSES.find((s) => s.value === c.pipelineStatus)?.label} />
            <LinkButton href={`/assistant?q=${prompt}`} variant="outline"><Sparkles className="h-4 w-4" /> Draft message</LinkButton>
            <ConfirmAction action={deleteContact} fields={{ id }} label="Delete" title={`Delete ${c.name}?`} message="The contact and its outreach history are deleted. Track credits keep the name." size="md" icon={<Trash2 className="h-4 w-4" />} />
          </>
        }
      />
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Contact details" />
          <ContactForm id={id} values={{ ...c, instagram: c.socials.instagram, soundcloud: c.socials.other } as Record<string, unknown>} />
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Outreach history"
              action={<FormModal label="Log outreach" title="Log outreach or save a draft" description="Drafts are never sent. Mark as “Sent” only after you’ve sent it yourself." action={saveOutreach} defs={OUTREACH_FIELDS} hidden={{ contactId: id }} values={{ date: ctx.today, status: "draft", channel: "email", kind: "collaboration" }} size="sm" variant="outline" icon={<Plus className="h-3.5 w-3.5" />} />}
            />
            {outreach.length ? (
              <ul className="space-y-3">
                {outreach.map((o) => (
                  <li key={o.id} className="rounded-md border border-line p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span>{o.subject ?? OUTREACH_KINDS.find((k) => k.value === o.kind)?.label}</span>
                      <StatusBadge status={o.status} />
                    </div>
                    <div className="text-[11px] text-faint">{formatDate(o.date)} · {o.channel}{o.draftedByAi && " · AI draft"}</div>
                    {o.message && <p className="mt-2 line-clamp-4 whitespace-pre-line text-xs text-muted">{o.message}</p>}
                    <div className="mt-2 flex flex-wrap gap-2">
                      {o.status === "draft" && c.email && o.channel === "email" && (
                        <a className="inline-flex items-center gap-1 text-xs text-accent-strong hover:underline" href={`mailto:${c.email}?subject=${encodeURIComponent(o.subject ?? "")}&body=${encodeURIComponent(o.message ?? "")}`}>
                          <Mail className="h-3 w-3" /> Open in email app
                        </a>
                      )}
                      <FormModal label="Edit" title="Edit outreach" action={saveOutreach} defs={OUTREACH_FIELDS} hidden={{ contactId: id, id: o.id }} values={o as unknown as Record<string, unknown>} size="sm" variant="ghost" />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState compact title="No outreach yet." />
            )}
          </Card>
          {credits.length > 0 && (
            <Card>
              <CardHeader title="Credited on" />
              <ul className="space-y-1.5 text-sm">{credits.map((t) => <li key={t.id}><Link href={`/catalog/${t.id}?tab=credits`} className="hover:text-accent-strong">{t.title}</Link> <Badge>{t.collaborators.find((x) => x.contactId === id)?.role}</Badge></li>)}</ul>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
