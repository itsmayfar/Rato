import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { ExternalLink, FolderOpen, Link2, Lock, Trash2 } from "lucide-react";
import { DocumentUploader } from "@/components/documents/uploader";
import { ConfirmAction, filterClass } from "@/components/ui/form";
import { EntityForm } from "@/components/ui/entity-form";
import { FormModal } from "@/components/ui/form-modal";
import { Badge, Card, CardHeader, DemoBadge, EmptyState, KeyValue, PageHeader, Table, Td, Th, buttonClass } from "@/components/ui/primitives";
import { deleteDocument, saveDocument } from "@/lib/actions/documents";
import { requireUser } from "@/lib/auth";
import { DOCUMENT_CATEGORIES } from "@/lib/constants";
import { loadContext } from "@/lib/context";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { DOCUMENT_FIELDS, withOptions } from "@/lib/forms";
import { relationOptions } from "@/lib/task-options";
import { cn, formatDateTime, formatNumber } from "@/lib/utils";

export const metadata = { title: "Documents & Assets" };

type SP = { q?: string; category?: string; tag?: string; doc?: string; upload?: string; trackId?: string; releaseId?: string; campaignId?: string };

const catLabel = (c: string) => DOCUMENT_CATEGORIES.find((x) => x.value === c)?.label ?? c;
const size = (b: number | null) => (b === null ? "" : b > 1024 * 1024 ? `${formatNumber(b / 1024 / 1024, 1)} MB` : `${formatNumber(b / 1024, 0)} KB`);

export default async function DocumentsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser();
  const ctx = await loadContext(user.id);
  const sp = await searchParams;
  const all = await db.select().from(documents).where(eq(documents.userId, user.id)).orderBy(desc(documents.createdAt));
  const q = (sp.q ?? "").toLowerCase();
  const list = all.filter(
    (d) => d.isLatest && (!q || `${d.title} ${d.fileName ?? ""} ${d.tags.join(" ")} ${d.notes ?? ""}`.toLowerCase().includes(q)) && (!sp.category || d.category === sp.category) && (!sp.tag || d.tags.includes(sp.tag)),
  );
  const tags = Array.from(new Set(all.flatMap((d) => d.tags))).sort();
  const opts = relationOptions(ctx);
  const selected = sp.doc ? all.find((d) => d.id === sp.doc) : undefined;
  const versions = selected ? chain(all, selected) : [];
  const linkName = (d: (typeof all)[number]) =>
    [
      d.trackId && ctx.tracks.find((t) => t.id === d.trackId)?.title,
      d.releaseId && ctx.releases.find((t) => t.id === d.releaseId)?.title,
      d.campaignId && ctx.campaigns.find((t) => t.id === d.campaignId)?.name,
      d.contactId && ctx.contacts.find((t) => t.id === d.contactId)?.name,
    ]
      .filter(Boolean)
      .join(" · ");

  return (
    <div>
      <PageHeader
        eyebrow="Documents & Assets"
        title="Document library"
        purpose="Contracts, split sheets, licences, invoices, artwork, audio, lyrics and marketing assets — versioned and linked to tracks, releases and campaigns. Files are private to your account; sensitive documents are hidden from search previews and the AI assistant."
        actions={
          <FormModal label="Add link" title="Add a document link" description="For files stored elsewhere (Dropbox, Google Drive…)." action={saveDocument} defs={withOptions(DOCUMENT_FIELDS, opts)} values={{ category: "other" }} variant="outline" icon={<Link2 className="h-4 w-4" />} />
        }
      />
      <Card className={cn("mb-6", sp.upload && "border-accent/50")}>
        <CardHeader title="Upload" description={`Up to ${process.env.MAX_UPLOAD_MB ?? 200} MB per file. Audio, images, PDFs, project archives.`} />
        <DocumentUploader defaults={{ category: sp.category, trackId: sp.trackId, releaseId: sp.releaseId, campaignId: sp.campaignId }} options={opts} />
      </Card>

      {selected && (
        <Card className="mb-6 border-accent/40">
          <CardHeader
            title={<span className="flex items-center gap-2">{selected.sensitive && <Lock className="h-3.5 w-3.5" />}{selected.title}</span>}
            description={`${catLabel(selected.category)} · version ${selected.version}${selected.isLatest ? " (latest)" : ""}`}
            action={<Link href="/documents" className="text-xs text-muted hover:text-fg">Close</Link>}
          />
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              {selected.storageKey && selected.mimeType?.startsWith("image/") && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/files/${selected.id}`} alt={selected.title} className="max-h-64 rounded-md border border-line" />
              )}
              {selected.storageKey && selected.mimeType?.startsWith("audio/") && <audio controls preload="none" src={`/api/files/${selected.id}`} className="w-full" />}
              <KeyValue items={[{ label: "File", value: selected.fileName ?? (selected.externalUrl ? "External link" : "—") }, { label: "Size", value: size(selected.sizeBytes) || "—" }, { label: "Uploaded", value: formatDateTime(selected.createdAt) }, { label: "Checksum (SHA-256)", value: selected.checksum ? <code className="text-[10px]">{selected.checksum.slice(0, 16)}…</code> : "—" }, { label: "Linked to", value: linkName(selected) || "—" }]} />
              <div className="flex flex-wrap gap-2">
                {selected.storageKey && <a href={`/api/files/${selected.id}?download=1`} className={buttonClass("outline", "sm")}>Download</a>}
                {selected.externalUrl && <a href={selected.externalUrl} target="_blank" rel="noopener noreferrer" className={buttonClass("outline", "sm")}>Open link <ExternalLink className="h-3 w-3" /></a>}
                <ConfirmAction action={deleteDocument} fields={{ id: selected.id }} label="Delete version" title="Delete this document version?" message="The file is permanently removed from storage. Earlier versions remain." confirmLabel="Delete" icon={<Trash2 className="h-3.5 w-3.5" />} />
              </div>
              {selected.storageKey && selected.isLatest && (
                <div className="rounded-md border border-line p-4">
                  <p className="mb-3 text-xs uppercase tracking-[0.12em] text-muted">Upload a new version</p>
                  <DocumentUploader defaults={{}} options={opts} replaces={selected.id} />
                </div>
              )}
              {versions.length > 1 && (
                <div>
                  <p className="mb-2 text-xs uppercase tracking-[0.12em] text-muted">Version history</p>
                  <ul className="space-y-1 text-sm">{versions.map((v) => <li key={v.id}><Link href={`/documents?doc=${v.id}`} className={v.id === selected.id ? "text-fg" : "text-muted hover:text-fg"}>v{v.version} · {formatDateTime(v.createdAt)} · {v.fileName}</Link></li>)}</ul>
                </div>
              )}
            </div>
            <EntityForm action={saveDocument} defs={withOptions(DOCUMENT_FIELDS, opts)} values={selected as unknown as Record<string, unknown>} hidden={{ id: selected.id }} submitLabel="Save details" />
          </div>
        </Card>
      )}

      <form className="mb-4 flex flex-wrap gap-2" role="search">
        <input name="q" defaultValue={sp.q} placeholder="Search title, file, tags" className={cn(filterClass, "w-64")} aria-label="Search documents" />
        <select name="category" defaultValue={sp.category ?? ""} className={filterClass} aria-label="Category"><option value="">All categories</option>{DOCUMENT_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select>
        {tags.length > 0 && <select name="tag" defaultValue={sp.tag ?? ""} className={filterClass} aria-label="Tag"><option value="">All tags</option>{tags.map((t) => <option key={t}>{t}</option>)}</select>}
        <button className="rounded-md border border-line px-3 text-sm text-muted hover:text-fg" type="submit">Apply</button>
      </form>
      {list.length ? (
        <Table>
          <thead><tr><Th>Document</Th><Th>Category</Th><Th>Linked to</Th><Th>Size</Th><Th>Version</Th><Th>Added</Th></tr></thead>
          <tbody>
            {list.map((d) => (
              <tr key={d.id} className="hover:bg-surface-2">
                <Td>
                  <Link href={`/documents?doc=${d.id}`} className="inline-flex items-center gap-1.5 hover:text-accent-strong">{d.sensitive && <Lock className="h-3 w-3 text-faint" />}{d.title}</Link> {d.isDemo && <DemoBadge />}
                  <div className="flex flex-wrap gap-1">{d.tags.map((t) => <Badge key={t}>{t}</Badge>)}</div>
                </Td>
                <Td className="text-xs">{catLabel(d.category)}</Td>
                <Td className="text-xs text-muted">{linkName(d) || "—"}</Td>
                <Td className="text-xs text-muted">{d.externalUrl && !d.storageKey ? "link" : size(d.sizeBytes)}</Td>
                <Td className="text-xs">v{d.version}</Td>
                <Td className="text-xs text-muted">{formatDateTime(d.createdAt)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <EmptyState icon={<FolderOpen className="h-8 w-8" />} title={all.length ? "No documents match." : "No documents yet."} description="Upload contracts, split sheets, artwork and audio to keep everything in one place." />
      )}
    </div>
  );
}

function chain<T extends { id: string; previousVersionId: string | null }>(all: T[], start: T): T[] {
  // walk to the latest, then back through previous versions
  let latest = start;
  for (let guard = 0; guard < 100; guard++) {
    const next = all.find((d) => d.previousVersionId === latest.id);
    if (!next) break;
    latest = next;
  }
  const out: T[] = [];
  let cur: T | undefined = latest;
  for (let guard = 0; cur && guard < 100; guard++) {
    out.push(cur);
    cur = all.find((d) => d.id === cur!.previousVersionId);
  }
  return out;
}
