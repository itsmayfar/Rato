import Link from "next/link";
import { Plus, Upload, Users } from "lucide-react";
import { InlineAction, filterClass, inputClass } from "@/components/ui/form";
import { Badge, DemoBadge, EmptyState, LinkButton, LinkTabs, PageHeader, Table, Td, Th } from "@/components/ui/primitives";
import { setPipelineStatus } from "@/lib/actions/contacts";
import { requireUser } from "@/lib/auth";
import { CONTACT_CATEGORIES, PIPELINE_STATUSES } from "@/lib/constants";
import { loadContext } from "@/lib/context";
import { cn, formatDate } from "@/lib/utils";

export const metadata = { title: "Contacts & Networking" };

export default async function ContactsPage({ searchParams }: { searchParams: Promise<{ view?: string; q?: string; category?: string }> }) {
  const user = await requireUser();
  const ctx = await loadContext(user.id);
  const sp = await searchParams;
  const view = sp.view === "pipeline" || sp.view === "followups" ? sp.view : "list";
  const q = (sp.q ?? "").toLowerCase();
  let list = ctx.contacts.filter((c) => (!q || `${c.name} ${c.organization ?? ""} ${c.role ?? ""} ${c.location ?? ""}`.toLowerCase().includes(q)) && (!sp.category || c.category === sp.category));
  if (view === "followups") list = list.filter((c) => c.nextFollowUpDate && !["closed", "archived"].includes(c.pipelineStatus)).sort((a, b) => a.nextFollowUpDate!.localeCompare(b.nextFollowUpDate!));
  const label = (v: string) => PIPELINE_STATUSES.find((s) => s.value === v)?.label ?? v;
  return (
    <div>
      <PageHeader
        eyebrow="Contacts & Networking"
        title="People & opportunities"
        purpose="Collaborators, labels, curators, promoters and partners — with an outreach pipeline and follow-ups. Messages are drafted here but always sent by you."
        actions={<><LinkButton href="/import/contacts" variant="ghost"><Upload className="h-4 w-4" /> Import</LinkButton><LinkButton href="/contacts/new" variant="primary"><Plus className="h-4 w-4" /> Add contact</LinkButton></>}
      />
      <LinkTabs active={view} tabs={[{ key: "list", label: "All contacts", href: "/contacts" }, { key: "pipeline", label: "Outreach pipeline", href: "/contacts?view=pipeline" }, { key: "followups", label: "Follow-ups", href: "/contacts?view=followups" }]} />
      <form className="mb-5 flex flex-wrap gap-2" role="search">
        <input type="hidden" name="view" value={view} />
        <input name="q" defaultValue={sp.q} placeholder="Search name, organisation, role…" className={cn(filterClass, "w-64")} aria-label="Search contacts" />
        <select name="category" defaultValue={sp.category ?? ""} className={filterClass} aria-label="Category"><option value="">All categories</option>{CONTACT_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
        <button className="rounded-md border border-line px-3 text-sm text-muted hover:text-fg" type="submit">Apply</button>
      </form>
      {!ctx.contacts.length ? (
        <EmptyState icon={<Users className="h-8 w-8" />} title="No contacts yet." description="Add collaborators, labels, curators and promoters to track relationships and outreach." action={<LinkButton href="/contacts/new" variant="primary">Add contact</LinkButton>} />
      ) : view === "pipeline" ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {PIPELINE_STATUSES.filter((s) => s.value !== "archived").map((s, idx, arr) => {
            const col = list.filter((c) => c.pipelineStatus === s.value);
            return (
              <section key={s.value} className="w-60 shrink-0" aria-label={s.label}>
                <h2 className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.12em] text-muted">{s.label} <Badge>{col.length}</Badge></h2>
                <ul className="space-y-2">
                  {col.map((c) => (
                    <li key={c.id} className="rounded-md border border-line bg-surface p-3">
                      <Link href={`/contacts/${c.id}`} className="block text-sm hover:text-accent-strong">{c.name}</Link>
                      <div className="text-[11px] text-faint">{[c.category, c.organization].filter(Boolean).join(" · ")}</div>
                      {c.nextFollowUpDate && <div className={cn("mt-1 text-[11px]", c.nextFollowUpDate <= ctx.today ? "text-warning" : "text-faint")}>Follow up {formatDate(c.nextFollowUpDate)}</div>}
                      {idx < arr.length - 1 && <InlineAction action={setPipelineStatus} fields={{ id: c.id, status: arr[idx + 1].value }} className="mt-1" title={`Move to ${arr[idx + 1].label}`}>→ {arr[idx + 1].label}</InlineAction>}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      ) : list.length ? (
        <Table>
          <thead><tr><Th>Name</Th><Th>Category</Th><Th>Organisation / role</Th><Th>Status</Th><Th>Last contact</Th><Th>Next follow-up</Th></tr></thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.id} className="hover:bg-surface-2">
                <Td><Link href={`/contacts/${c.id}`} className="hover:text-accent-strong">{c.name}</Link> {c.isTeamMember && <Badge tone="accent">team</Badge>} {c.isDemo && <DemoBadge />}<div className="text-xs text-faint">{c.email ?? c.location}</div></Td>
                <Td className="text-xs">{c.category}</Td>
                <Td className="text-xs text-muted">{[c.organization, c.role].filter(Boolean).join(" · ") || "—"}</Td>
                <Td className="text-xs">{label(c.pipelineStatus)}</Td>
                <Td className="text-xs text-muted">{formatDate(c.lastContactDate)}</Td>
                <Td className={cn("text-xs", c.nextFollowUpDate && c.nextFollowUpDate <= ctx.today ? "text-warning" : "text-muted")}>{formatDate(c.nextFollowUpDate)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <EmptyState compact title={view === "followups" ? "No follow-ups scheduled." : "No contacts match."} />
      )}
    </div>
  );
}
