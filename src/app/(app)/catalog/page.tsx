import Link from "next/link";
import { Music2, Plus, Upload } from "lucide-react";
import { Badge, DemoBadge, EmptyState, LinkButton, PageHeader, Progress, Table, Td, Th } from "@/components/ui/primitives";
import { inputClass } from "@/components/ui/form";
import { requireUser } from "@/lib/auth";
import { TRACK_STATUSES, TRACK_WORKFLOW } from "@/lib/constants";
import { loadContext } from "@/lib/context";
import { evaluateTrack, summarize } from "@/lib/info/engine";
import type { TrackFull } from "@/lib/types";
import { formatDate, formatDuration, toneFor } from "@/lib/utils";

export const metadata = { title: "Music Catalog" };

type SP = { q?: string; status?: string; genre?: string; sort?: string; group?: string };

export default async function CatalogPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser();
  const ctx = await loadContext(user.id);
  const sp = await searchParams;
  const q = (sp.q ?? "").toLowerCase().trim();
  const workflow = ctx.settings.trackWorkflow.length ? ctx.settings.trackWorkflow : TRACK_WORKFLOW;
  const statuses = [...TRACK_STATUSES, ...(ctx.settings.customStatuses.track ?? [])];

  let list = ctx.tracks.filter(
    (t) =>
      (!q || [t.title, t.projectCode, t.genre, t.mood, t.primaryArtist, ...t.featuredArtists].some((v) => v?.toLowerCase().includes(q))) &&
      (!sp.status || t.status === sp.status) &&
      (!sp.genre || t.genre === sp.genre),
  );
  const sorters: Record<string, (a: TrackFull, b: TrackFull) => number> = {
    title: (a, b) => a.title.localeCompare(b.title),
    updated: (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
    bpm: (a, b) => Number(a.bpm ?? 0) - Number(b.bpm ?? 0),
    status: (a, b) => statuses.indexOf(a.status) - statuses.indexOf(b.status),
    release: (a, b) => (a.plannedReleaseDate ?? "9999").localeCompare(b.plannedReleaseDate ?? "9999"),
  };
  list = [...list].sort(sorters[sp.sort ?? "updated"] ?? sorters.updated);
  const genres = Array.from(new Set(ctx.tracks.map((t) => t.genre).filter(Boolean))) as string[];
  const groupKey = sp.group === "status" || sp.group === "genre" ? sp.group : null;
  const groups = groupKey
    ? Array.from(new Set(list.map((t) => (groupKey === "status" ? t.status : t.genre) ?? "—"))).map((g) => ({
        name: g,
        items: list.filter((t) => ((groupKey === "status" ? t.status : t.genre) ?? "—") === g),
      }))
    : [{ name: "", items: list }];

  return (
    <div>
      <PageHeader
        eyebrow="Music Catalog"
        title="Every track, from idea to master"
        purpose="Each track holds its metadata, audio versions, credits, rights and connections to releases, campaigns, tasks and finances."
        actions={
          <>
            <LinkButton href="/catalog/import" variant="ghost"><Upload className="h-4 w-4" /> Import CSV</LinkButton>
            <LinkButton href="/catalog/new" variant="primary"><Plus className="h-4 w-4" /> New track</LinkButton>
          </>
        }
      />
      {ctx.tracks.length === 0 ? (
        <EmptyState
          icon={<Music2 className="h-8 w-8" />}
          title="Your catalog is empty."
          description="Add a track — even just an idea — to start tracking production, rights and releases."
          action={<LinkButton href="/catalog/new" variant="primary">Add your first track</LinkButton>}
        />
      ) : (
        <>
          <form className="mb-5 grid gap-3 md:grid-cols-[1fr_repeat(4,auto)]" role="search">
            <input name="q" defaultValue={sp.q} placeholder="Search title, ID, genre, mood, artist…" className={inputClass} aria-label="Search catalog" />
            <select name="status" defaultValue={sp.status ?? ""} className={inputClass} aria-label="Filter by status">
              <option value="">All statuses</option>
              {statuses.map((s) => <option key={s}>{s}</option>)}
            </select>
            <select name="genre" defaultValue={sp.genre ?? ""} className={inputClass} aria-label="Filter by genre">
              <option value="">All genres</option>
              {genres.map((g) => <option key={g}>{g}</option>)}
            </select>
            <select name="sort" defaultValue={sp.sort ?? "updated"} className={inputClass} aria-label="Sort">
              <option value="updated">Recently updated</option>
              <option value="title">Title</option>
              <option value="status">Status</option>
              <option value="bpm">BPM</option>
              <option value="release">Planned release</option>
            </select>
            <div className="flex gap-2">
              <select name="group" defaultValue={sp.group ?? ""} className={inputClass} aria-label="Group">
                <option value="">No grouping</option>
                <option value="status">Group by status</option>
                <option value="genre">Group by genre</option>
              </select>
              <button className="rounded-md border border-line px-3 text-sm text-muted hover:text-fg" type="submit">Apply</button>
            </div>
          </form>
          {list.length === 0 && <EmptyState compact title="No tracks match these filters." action={<LinkButton href="/catalog" size="sm">Clear filters</LinkButton>} />}
          {groups.map((g) =>
            g.items.length ? (
              <div key={g.name} className="mb-6">
                {g.name && <h2 className="mb-2 text-xs uppercase tracking-[0.16em] text-muted">{g.name} <span className="text-faint">· {g.items.length}</span></h2>}
                <Table>
                  <thead>
                    <tr>
                      <Th>Track</Th>
                      <Th>Status</Th>
                      <Th>Workflow</Th>
                      <Th>Genre · BPM · Key</Th>
                      <Th>Length</Th>
                      <Th>Info</Th>
                      <Th>Release</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.items.map((t) => {
                      const s = summarize(evaluateTrack(ctx, t, { forRelease: t.releaseIds.length > 0 }));
                      const stageIdx = Math.max(0, workflow.indexOf(t.workflowStage));
                      return (
                        <tr key={t.id} className="hover:bg-surface-2">
                          <Td>
                            <Link href={`/catalog/${t.id}`} className="hover:text-accent-strong">{t.title}</Link>
                            <div className="flex items-center gap-2 text-xs text-faint">{t.projectCode}{t.featuredArtists.length > 0 && ` · feat. ${t.featuredArtists.join(", ")}`}{t.isDemo && <DemoBadge />}</div>
                          </Td>
                          <Td><Badge tone={toneFor(t.status === "Finished" ? "complete" : t.status === "Archived" ? "archived" : "active")}>{t.status}</Badge></Td>
                          <Td className="w-40">
                            <div className="text-xs text-muted">{t.workflowStage}</div>
                            <Progress value={stageIdx + 1} max={workflow.length} className="mt-1" />
                          </Td>
                          <Td className="text-xs text-muted">{[t.genre, t.bpm && `${t.bpm} BPM`, t.musicalKey].filter(Boolean).join(" · ") || "—"}</Td>
                          <Td className="text-xs text-muted">{formatDuration(t.durationSec)}</Td>
                          <Td>{s.missingRequired ? <Badge tone="warning">{s.missingRequired} missing</Badge> : <Badge tone="success">Complete</Badge>}</Td>
                          <Td className="text-xs text-muted">{t.actualReleaseDate ? `Released ${formatDate(t.actualReleaseDate)}` : t.plannedReleaseDate ? `Planned ${formatDate(t.plannedReleaseDate)}` : "—"}</Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </div>
            ) : null,
          )}
        </>
      )}
    </div>
  );
}
