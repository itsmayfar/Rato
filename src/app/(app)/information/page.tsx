import Link from "next/link";
import { QuestionFlow } from "@/components/info/question-flow";
import { filterClass } from "@/components/ui/form";
import { Badge, Card, CardHeader, EmptyState, PageHeader, Progress, Stat } from "@/components/ui/primitives";
import { requireUser } from "@/lib/auth";
import { loadContext } from "@/lib/context";
import { STATUS_LABEL, evaluateAll, evaluateRelease, summarize, type InfoStatus } from "@/lib/info/engine";
import { toQuestions } from "@/lib/info/questions";
import { addDays, toneFor } from "@/lib/utils";
import { upcomingReleases } from "@/lib/workflow/phases";

export const metadata = { title: "Information Center" };

type SP = { status?: string; entity?: string };
const ENTITY_LABEL: Record<string, string> = { profile: "Artist profile", platform: "Platforms", track: "Tracks", release: "Releases", campaign: "Campaigns" };

export default async function InformationCenter({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser();
  const ctx = await loadContext(user.id);
  const sp = await searchParams;
  const all = evaluateAll(ctx);
  const s = summarize(all);
  const status = (Object.keys(STATUS_LABEL) as InfoStatus[]).includes(sp.status as InfoStatus) ? (sp.status as InfoStatus) : undefined;
  const filtered = all.filter((i) => (!status ? i.status !== "complete" && i.status !== "not_applicable" : i.status === status) && (!sp.entity || i.entityType === sp.entity));
  const soon = upcomingReleases(ctx).filter((r) => !r.releaseDate || r.releaseDate <= addDays(ctx.today, 60));
  const upcomingNeeds = soon.flatMap((r) => summarize(evaluateRelease(ctx, r)).blocking.map((b) => ({ r, b })));
  const q = toQuestions(filtered);

  return (
    <div>
      <PageHeader
        eyebrow="Information Center"
        title="Everything the business knows — and what it doesn’t yet"
        purpose="Every piece of saved information with its status and source. Missing, unconfirmed, invalid and outdated items can be fixed right here; derived checks link to where they’re resolved."
      />
      <div className="mb-6 grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <Card className="xl:col-span-2">
          <Stat label="Required information complete" value={`${s.percent}%`} hint={`${s.requiredComplete} of ${s.requiredTotal}`} />
          <Progress value={s.percent} className="mt-3" />
        </Card>
        {(["missing", "needs_confirmation", "invalid", "outdated"] as const).map((k) => (
          <Link key={k} href={`/information?status=${k}${sp.entity ? `&entity=${sp.entity}` : ""}`}>
            <Card className={status === k ? "border-accent/60" : "hover:border-line-strong"}>
              <Stat label={STATUS_LABEL[k]} value={s.counts[k]} tone={s.counts[k] ? (k === "missing" || k === "invalid" ? "danger" : "warning") : undefined} />
            </Card>
          </Link>
        ))}
      </div>

      {upcomingNeeds.length > 0 && (
        <Card className="mb-6">
          <CardHeader title="Needed for upcoming releases" description="Required information blocking releases in the next 60 days." />
          <ul className="grid gap-2 md:grid-cols-2">
            {upcomingNeeds.slice(0, 12).map(({ r, b }) => (
              <li key={`${r.id}-${b.uid}`} className="flex items-center justify-between gap-2 text-sm">
                <Link href={b.editable ? `/releases/${r.id}/questions` : b.href} className="min-w-0 truncate hover:text-accent-strong">
                  {b.label} <span className="text-faint">· {b.entityType === "track" ? b.entityLabel : r.title}</span>
                </Link>
                <Badge tone={toneFor(b.status)}>{STATUS_LABEL[b.status]}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <form className="mb-5 flex flex-wrap gap-2">
        <select name="status" defaultValue={status ?? ""} className={filterClass} aria-label="Status">
          <option value="">Everything that needs attention</option>
          {(Object.keys(STATUS_LABEL) as InfoStatus[]).map((k) => <option key={k} value={k}>{STATUS_LABEL[k]} ({s.counts[k]})</option>)}
        </select>
        <select name="entity" defaultValue={sp.entity ?? ""} className={filterClass} aria-label="Area">
          <option value="">All areas</option>
          {Object.entries(ENTITY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button className="rounded-md border border-line px-3 text-sm text-muted hover:text-fg" type="submit">Apply</button>
      </form>

      {filtered.length ? (
        <QuestionFlow key={`${status}-${sp.entity}`} {...q} showEntity initiallyShowAll submitLabel="Save changes" />
      ) : (
        <EmptyState title={status ? `Nothing with status “${STATUS_LABEL[status]}”.` : "Nothing needs attention."} description="All tracked information in this area is complete or marked not applicable." />
      )}
      <p className="mt-6 text-xs text-faint">
        Sources: values you entered are marked “user”; imports and integrations are recorded as such. Suggestions from the assistant are only saved after you approve them.
      </p>
    </div>
  );
}
