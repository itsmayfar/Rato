import Link from "next/link";
import { eq } from "drizzle-orm";
import { Search } from "lucide-react";
import { inputClass } from "@/components/ui/form";
import { Badge, EmptyState, PageHeader } from "@/components/ui/primitives";
import { requireUser } from "@/lib/auth";
import { loadContext } from "@/lib/context";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { searchContext } from "@/lib/search";

export const metadata = { title: "Search" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireUser();
  const { q = "" } = await searchParams;
  const ctx = await loadContext(user.id);
  const docs = await db.select({ id: documents.id, title: documents.title, fileName: documents.fileName, tags: documents.tags, notes: documents.notes, sensitive: documents.sensitive, category: documents.category }).from(documents).where(eq(documents.userId, user.id));
  const hits = searchContext(ctx, docs, q);
  const types = Array.from(new Set(hits.map((h) => h.type)));
  return (
    <div className="max-w-4xl">
      <PageHeader eyebrow="Search" title={q ? `Results for “${q}”` : "Search"} purpose="Tracks, releases, projects, tasks, contacts, campaigns, content, documents, financial records and saved information." />
      <form className="mb-6" role="search">
        <input name="q" defaultValue={q} autoFocus placeholder="Search everything…" className={inputClass} aria-label="Search" />
      </form>
      {!q ? null : hits.length ? (
        <div className="space-y-6">
          {types.map((t) => (
            <section key={t}>
              <h2 className="mb-2 text-xs uppercase tracking-[0.16em] text-muted">{t} <span className="text-faint">· {hits.filter((h) => h.type === t).length}</span></h2>
              <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
                {hits.filter((h) => h.type === t).map((h, i) => (
                  <li key={`${h.href}-${i}`}>
                    <Link href={h.href} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-surface-2">
                      <span className="min-w-0 truncate text-sm">{h.title}</span>
                      {h.subtitle && <Badge>{h.subtitle}</Badge>}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <EmptyState icon={<Search className="h-6 w-6" />} title="No results." description={q.length < 2 ? "Type at least two characters." : "Try a different word, or check the spelling."} />
      )}
    </div>
  );
}
