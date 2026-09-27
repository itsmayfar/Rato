import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { ArrowDown, ArrowUp, Check, Plus, Rocket, Trash2 } from "lucide-react";
import { ChecklistView } from "@/components/releases/checklist";
import { UploadField } from "@/components/documents/upload-field";
import { ActionForm, ConfirmAction, InlineAction, SubmitButton, inputClass } from "@/components/ui/form";
import { EntityForm } from "@/components/ui/entity-form";
import { FormModal } from "@/components/ui/form-modal";
import { Badge, Card, CardHeader, DemoBadge, EmptyState, KeyValue, LinkButton, LinkTabs, Notice, PageHeader, Progress, Stat, StatusBadge } from "@/components/ui/primitives";
import {
  addCustomReview,
  approveCover,
  completeReview,
  deleteRelease,
  linkTrack,
  markReleased,
  moveTrack,
  setCover,
  startExecution,
  unlinkTrack,
  updateRelease,
  updateReleasePreferences,
} from "@/lib/actions/releases";
import { requireUser } from "@/lib/auth";
import { METRICS, RELEASE_STATUSES, RELEASE_TYPES, REVIEW_PERIODS } from "@/lib/constants";
import { loadContext } from "@/lib/context";
import { db } from "@/lib/db";
import { analyticsRecords } from "@/lib/db/schema";
import { profitability } from "@/lib/finance";
import { RELEASE_FIELDS, REVIEW_FIELDS, withOptions } from "@/lib/forms";
import { evaluateRelease, hasApprovedMaster, summarize } from "@/lib/info/engine";
import { PREFERENCE_LABELS, checklistProgress, effectiveChecklist, suggestReleaseStatus, type ReleasePrefs } from "@/lib/releases/checklist";
import { daysBetween, formatDate, formatMoney, formatNumber, titleCase } from "@/lib/utils";

const TABS = ["overview", "checklist", "execution", "performance", "assets"] as const;

export default async function ReleasePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const { tab: t } = await searchParams;
  const ctx = await loadContext(user.id);
  const r = ctx.releases.find((x) => x.id === id);
  if (!r) notFound();
  const tab = (TABS as readonly string[]).includes(t ?? "") ? (t as (typeof TABS)[number]) : "overview";
  const linked = r.trackIds.map((tid) => ctx.tracks.find((x) => x.id === tid)!).filter(Boolean);
  const checklist = effectiveChecklist(ctx, r);
  const prog = checklistProgress(checklist);
  const info = summarize(evaluateRelease(ctx, r));
  const suggested = suggestReleaseStatus(ctx, r);
  const camps = ctx.campaigns.filter((c) => c.releaseId === r.id);
  const days = r.releaseDate ? daysBetween(ctx.today, r.releaseDate) : null;
  const released = r.status === "Released" || r.status === "Post-release review";
  const cur = ctx.settings.currency;
  const cover = ctx.documents.find((d) => d.id === r.coverDocumentId);
  const prefs = (r.preferences ?? {}) as ReleasePrefs;

  const firstTrack = linked[0]?.id;
  const resolveHref = (key: string) =>
    ({
      tracks_linked: `/releases/${r.id}`,
      final_master: firstTrack ? `/catalog/${linked.find((x) => !hasApprovedMaster(x))?.id ?? firstTrack}?tab=assets` : `/releases/${r.id}`,
      artwork: `/releases/${r.id}?tab=assets`,
      metadata: `/releases/${r.id}/questions`,
      credits: `/releases/${r.id}/questions`,
      ownership: firstTrack ? `/catalog/${firstTrack}?tab=rights` : `/releases/${r.id}`,
      distributor: `/releases/${r.id}/questions`,
      date_confirmed: `/releases/${r.id}#details`,
      presave: `/releases/${r.id}#details`,
      campaign: `/marketing/new?release=${r.id}`,
      promo_materials: camps[0] ? `/content?campaign=${camps[0].id}` : `/marketing/new?release=${r.id}`,
      social_scheduled: `/planner`,
      release_day: `/releases/${r.id}?tab=execution`,
      post_release_review: `/releases/${r.id}?tab=performance`,
    })[key] ?? `/releases/${r.id}`;

  return (
    <div>
      <PageHeader
        eyebrow={<span className="flex items-center gap-2"><Link href="/releases" className="hover:text-fg">Release Manager</Link> / {RELEASE_TYPES.find((x) => x.value === r.releaseType)?.label} {r.isDemo && <DemoBadge />}</span>}
        title={r.title}
        purpose={`${r.primaryArtist ?? ""}${r.featuredArtists.length ? ` feat. ${r.featuredArtists.join(", ")}` : ""} · ${r.releaseDate ? `${formatDate(r.releaseDate, "long")}${days !== null ? (days > 0 ? ` (in ${days} days)` : days === 0 ? " (today)" : ` (${-days} days ago)`) : ""}` : "no release date yet"}${r.distributor ? ` · via ${r.distributor}` : ""}`}
        actions={
          <>
            <StatusBadge status={r.status} tone={released ? "success" : "accent"} />
            {!released && (
              <FormModal
                label="Mark as released"
                title="Confirm the release is live"
                description="Only confirm once you have checked the release is available in stores. This schedules the 24 h, 7, 30 and 90-day reviews."
                action={markReleased}
                defs={[{ key: "releasedOn", label: "Actual release date", type: "date", required: true }]}
                values={{ releasedOn: r.releaseDate ?? ctx.today }}
                hidden={{ id: r.id }}
                submitLabel="Confirm release"
                variant="primary"
                icon={<Rocket className="h-4 w-4" />}
                wide={false}
                columns={1}
              />
            )}
            <ConfirmAction action={deleteRelease} fields={{ id: r.id }} label="Delete" title="Delete this release?" message="The release, its checklist and reviews are deleted. Tracks, campaigns and documents are kept." confirmLabel="Delete release" size="md" icon={<Trash2 className="h-4 w-4" />} />
          </>
        }
      />

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <Card><Stat label="Checklist" value={`${prog.done}/${prog.total}`} hint={<Progress value={prog.percent} className="mt-2" />} /></Card>
        <Card><Stat label="Required information" value={info.missingRequired ? `${info.missingRequired} missing` : "Complete"} tone={info.missingRequired ? "warning" : "success"} hint={info.missingRequired ? <Link href={`/releases/${r.id}/questions`} className="hover:text-fg">Answer questions →</Link> : undefined} /></Card>
        <Card><Stat label="Suggested status" value={<span className="text-lg">{suggested}</span>} hint={suggested !== r.status ? `Currently “${r.status}”` : "Matches current status"} /></Card>
        <Card><Stat label="Overdue steps" value={checklist.filter((i) => i.overdue).length} tone={checklist.some((i) => i.overdue) ? "danger" : undefined} /></Card>
      </div>

      <LinkTabs active={tab} tabs={TABS.map((k) => ({ key: k, href: `/releases/${r.id}?tab=${k}`, label: k === "execution" ? "Release day" : titleCase(k) }))} />

      {tab === "overview" && (
        <div className="grid gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            <Card id="details">
              <CardHeader title="Release details" />
              <EntityForm
                action={updateRelease}
                defs={withOptions(RELEASE_FIELDS, { status: [...RELEASE_STATUSES, ...(ctx.settings.customStatuses.release ?? [])] })}
                values={r as unknown as Record<string, unknown>}
                hidden={{ id: r.id }}
                submitLabel="Save release"
              />
            </Card>
          </div>
          <div className="space-y-6">
            <Card>
              <CardHeader title="Tracks" description={r.releaseType === "single" ? "A single has one track." : "Running order"} />
              {linked.length ? (
                <ol className="space-y-2">
                  {linked.map((tr, i) => (
                    <li key={tr.id} className="flex items-center gap-2 text-sm">
                      <span className="w-5 text-xs text-faint">{i + 1}.</span>
                      <Link href={`/catalog/${tr.id}`} className="min-w-0 flex-1 truncate hover:text-accent-strong">{tr.title}</Link>
                      {hasApprovedMaster(tr) ? <Badge tone="success">master ✓</Badge> : <Badge tone="warning">no master</Badge>}
                      {linked.length > 1 && (
                        <>
                          <InlineAction action={moveTrack} fields={{ releaseId: r.id, trackId: tr.id, dir: "up" }} size="icon" title="Move up"><ArrowUp className="h-3 w-3" /></InlineAction>
                          <InlineAction action={moveTrack} fields={{ releaseId: r.id, trackId: tr.id, dir: "down" }} size="icon" title="Move down"><ArrowDown className="h-3 w-3" /></InlineAction>
                        </>
                      )}
                      <ConfirmAction action={unlinkTrack} fields={{ releaseId: r.id, trackId: tr.id }} label="Remove" title={`Remove “${tr.title}” from this release?`} message="The track stays in your catalog." size="icon" variant="ghost" icon={<Trash2 className="h-3 w-3" />} />
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-warning">No tracks linked.</p>
              )}
              {(r.releaseType !== "single" || !linked.length) && (
                <ActionForm action={linkTrack} className="mt-4 flex gap-2">
                  <input type="hidden" name="releaseId" value={r.id} />
                  <select name="trackId" className={inputClass} aria-label="Add track">
                    {ctx.tracks.filter((x) => !r.trackIds.includes(x.id) && x.status !== "Archived").map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}
                  </select>
                  <SubmitButton variant="outline" size="md">Add</SubmitButton>
                </ActionForm>
              )}
            </Card>
            <Card>
              <CardHeader title="Checklist preferences" description="Changing these adds or removes optional steps." />
              <ActionForm action={updateReleasePreferences}>
                <input type="hidden" name="id" value={r.id} />
                <div className="space-y-2">
                  {(Object.keys(PREFERENCE_LABELS) as (keyof ReleasePrefs)[]).map((k) => (
                    <label key={k} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name={`pref_${k}`} defaultChecked={k === "campaign" ? prefs.campaign !== false : Boolean(prefs[k])} className="accent-[var(--accent)]" />
                      {PREFERENCE_LABELS[k]}
                    </label>
                  ))}
                </div>
                <SubmitButton variant="outline" size="sm" className="mt-4">Update checklist</SubmitButton>
              </ActionForm>
            </Card>
            <Card>
              <CardHeader title="Campaigns" action={<LinkButton href={`/marketing/new?release=${r.id}`} size="sm" variant="ghost"><Plus className="h-3.5 w-3.5" /> New</LinkButton>} />
              {camps.length ? (
                <ul className="space-y-2 text-sm">{camps.map((c) => <li key={c.id} className="flex justify-between gap-2"><Link href={`/marketing/${c.id}`} className="hover:text-accent-strong">{c.name}</Link><StatusBadge status={c.status} /></li>)}</ul>
              ) : (
                <p className="text-sm text-muted">No campaign connected.</p>
              )}
            </Card>
            {r.projectId && <LinkButton href={`/tasks/projects/${r.projectId}`} variant="ghost" size="sm">Open release project & tasks →</LinkButton>}
          </div>
        </div>
      )}

      {tab === "checklist" && (
        <Card>
          <CardHeader title="Release checklist" description="Deadlines are scheduled backwards from the release date. Auto steps are verified from your stored data; external steps need your confirmation." />
          {!r.releaseDate && <Notice tone="warning" className="mb-4">Set a release date to schedule every deadline.</Notice>}
          <ChecklistView items={checklist} resolveHref={resolveHref} today={ctx.today} />
        </Card>
      )}

      {tab === "execution" && (
        <Card>
          <CardHeader title="Release-day checklist" description="Every step is confirmed by you — nothing is published, sent or activated automatically." />
          {r.execution.length ? (
            <>
              <Progress value={r.execution.filter((i) => i.status !== "pending").length} max={r.execution.length} className="mb-4" />
              <ChecklistView items={effectiveChecklist(ctx, r, r.execution)} resolveHref={() => `/releases/${r.id}`} today={ctx.today} />
            </>
          ) : (
            <EmptyState
              compact
              title="Release-day checklist not started."
              description="It is created automatically a week before release, or you can start it now."
              action={<InlineAction action={startExecution} fields={{ id: r.id }} variant="primary" size="md">Start release-day checklist</InlineAction>}
            />
          )}
          <p className="mt-4 text-xs text-faint">Record technical issues in the release notes (Overview → Notes & issues).</p>
        </Card>
      )}

      {tab === "performance" && <Performance releaseId={r.id} userId={user.id} />}

      {tab === "assets" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title="Cover artwork" description="3000×3000 px JPG or PNG, RGB. Approve it when final." />
            {cover ? (
              <div className="flex flex-col gap-4 sm:flex-row">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/files/${cover.id}`} alt={`Cover artwork for ${r.title}`} className="h-48 w-48 rounded-md border border-line object-cover" />
                <div className="space-y-3">
                  <div className="text-sm">{cover.title}</div>
                  {r.coverApproved ? (
                    <>
                      <Badge tone="success"><Check className="h-3 w-3" /> Approved</Badge>
                      <InlineAction action={approveCover} fields={{ id: r.id, approve: "0" }}>Remove approval</InlineAction>
                    </>
                  ) : (
                    <ConfirmAction action={approveCover} fields={{ id: r.id, approve: "1" }} label="Approve artwork" title="Approve this artwork?" message="Approve only the final version that will be delivered to stores." confirmLabel="Approve" variant="primary" size="md" />
                  )}
                </div>
              </div>
            ) : (
              <p className="mb-4 text-sm text-muted">No artwork uploaded yet.</p>
            )}
            <ActionForm action={setCover} className="mt-4">
              <input type="hidden" name="id" value={r.id} />
              <UploadField params={{ releaseId: r.id, category: "artwork" }} label={cover ? "Upload new artwork" : "Upload artwork"} accept="image/png,image/jpeg" />
              <SubmitButton variant="outline" size="sm" className="mt-3">Use as cover</SubmitButton>
            </ActionForm>
          </Card>
          <Card>
            <CardHeader title="Release documents" action={<LinkButton href={`/documents?upload=1&releaseId=${r.id}`} size="sm" variant="ghost">Upload</LinkButton>} />
            {ctx.documents.filter((d) => d.releaseId === r.id).length ? (
              <ul className="space-y-1.5 text-sm">
                {ctx.documents.filter((d) => d.releaseId === r.id && d.isLatest).map((d) => <li key={d.id}><Link href={`/documents?doc=${d.id}`} className="hover:text-accent-strong">{d.title}</Link> <span className="text-xs text-faint">· {titleCase(d.category)}</span></li>)}
              </ul>
            ) : (
              <p className="text-sm text-muted">No documents linked.</p>
            )}
            <div className="mt-6">
              <KeyValue items={[{ label: "Pre-save", value: r.preSaveUrl ? <a href={r.preSaveUrl} target="_blank" rel="noopener noreferrer" className="underline">{r.preSaveUrl}</a> : "—" }, { label: "Smart link", value: r.smartLinkUrl ? <a href={r.smartLinkUrl} target="_blank" rel="noopener noreferrer" className="underline">{r.smartLinkUrl}</a> : "—" }, { label: "UPC", value: r.upc ?? "—" }]} />
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

async function Performance({ releaseId, userId }: { releaseId: string; userId: string }) {
  const ctx = await loadContext(userId);
  const r = ctx.releases.find((x) => x.id === releaseId)!;
  const metrics = await db
    .select()
    .from(analyticsRecords)
    .where(and(eq(analyticsRecords.userId, userId), eq(analyticsRecords.releaseId, releaseId)))
    .orderBy(desc(analyticsRecords.periodEnd));
  const trackMetrics = r.trackIds.length
    ? (await db.select().from(analyticsRecords).where(eq(analyticsRecords.userId, userId))).filter((m) => m.trackId && r.trackIds.includes(m.trackId))
    : [];
  const all = [...metrics, ...trackMetrics];
  const fin = profitability(ctx.transactions, ctx.settings.currency, "releaseId", releaseId);
  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <div className="space-y-6 xl:col-span-2">
        <Card>
          <CardHeader title="Review periods" description="Reviews use recorded data only. Correlation between activities and results is not treated as proof of cause." />
          {r.reviews.length ? (
            <ul className="space-y-4">
              {r.reviews.map((v) => (
                <li key={v.id} className="rounded-md border border-line p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm">{REVIEW_PERIODS.find((p) => p.key === v.period)?.label ?? v.period} <span className="text-xs text-faint">· due {formatDate(v.dueDate)}</span></div>
                    <StatusBadge status={v.status === "pending" && v.dueDate <= ctx.today ? "overdue" : v.status} label={v.status === "pending" && v.dueDate <= ctx.today ? "Due" : undefined} />
                  </div>
                  {v.status === "completed" ? (
                    <div className="mt-2 space-y-1 text-sm text-muted">
                      <p className="whitespace-pre-line">{v.summary}</p>
                      {v.lessons && <p className="whitespace-pre-line"><span className="text-faint">Lessons: </span>{v.lessons}</p>}
                      {v.followUps && <p className="whitespace-pre-line"><span className="text-faint">Follow-ups: </span>{v.followUps}</p>}
                    </div>
                  ) : v.dueDate <= ctx.today ? (
                    <div className="mt-3">
                      <EntityForm action={completeReview} defs={REVIEW_FIELDS} hidden={{ id: v.id }} columns={1} submitLabel="Complete review" />
                    </div>
                  ) : (
                    <p className="mt-1 text-xs text-faint">Opens on {formatDate(v.dueDate)}.</p>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState compact title="Reviews are scheduled when you mark the release as released." />
          )}
          {r.reviews.length > 0 && (
            <div className="mt-4">
              <FormModal
                label="Add custom review period"
                title="Custom review period"
                action={addCustomReview}
                defs={[{ key: "period", label: "Label", type: "text", required: true, placeholder: "6 months" }, { key: "dueDate", label: "Due date", type: "date", required: true }]}
                hidden={{ releaseId: r.id }}
                size="sm"
                variant="ghost"
                icon={<Plus className="h-3.5 w-3.5" />}
                wide={false}
                columns={1}
              />
            </div>
          )}
        </Card>
      </div>
      <div className="space-y-6">
        <Card>
          <CardHeader title="Recorded metrics" action={<LinkButton href={`/analytics?add=1&releaseId=${r.id}`} size="sm" variant="ghost">Add</LinkButton>} />
          {all.length ? (
            <ul className="divide-y divide-line">
              {all.slice(0, 15).map((m) => (
                <li key={m.id} className="py-2 text-sm">
                  <div className="flex justify-between gap-2"><span>{METRICS.find((x) => x.value === m.metric)?.label ?? m.metric}</span><span>{formatNumber(m.value, 2)}</span></div>
                  <div className="text-[11px] text-faint">{m.platform} · {formatDate(m.periodEnd)} · {m.source} · {m.verification}</div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">No metrics recorded for this release yet. Nothing is estimated or invented.</p>
          )}
        </Card>
        <Card>
          <CardHeader title="Release finances" description="Actual linked records" />
          <KeyValue items={[{ label: "Income", value: formatMoney(fin.income, ctx.settings.currency) }, { label: "Expenses", value: formatMoney(fin.expenses, ctx.settings.currency) }, { label: "Net", value: formatMoney(fin.net, ctx.settings.currency) }, { label: "Records", value: fin.count }]} />
        </Card>
      </div>
    </div>
  );
}
