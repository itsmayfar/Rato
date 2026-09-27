import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { BarChart3, Download, Plus, Trash2, Upload } from "lucide-react";
import { LineSeriesChart } from "@/components/charts/charts";
import { ConfirmAction, filterClass } from "@/components/ui/form";
import { FormModal } from "@/components/ui/form-modal";
import { Badge, Card, CardHeader, EmptyState, LinkButton, Notice, PageHeader, Progress, Table, Td, Th } from "@/components/ui/primitives";
import { deleteMetric, deletePlacement, saveMetric, savePlacement } from "@/lib/actions/analytics";
import { requireUser } from "@/lib/auth";
import { METRICS } from "@/lib/constants";
import { loadContext } from "@/lib/context";
import { db } from "@/lib/db";
import { analyticsRecords, playlistPlacements } from "@/lib/db/schema";
import { ANALYTICS_FIELDS, PLACEMENT_FIELDS, withOptions } from "@/lib/forms";
import { relationOptions } from "@/lib/task-options";
import { formatDate, formatMoney, formatNumber } from "@/lib/utils";

export const metadata = { title: "Audience & Analytics" };

type SP = { metric?: string; platform?: string; track?: string; add?: string; trackId?: string; releaseId?: string };

const metricLabel = (m: string) => METRICS.find((x) => x.value === m)?.label ?? m;
const verTone = (v: string, demo: boolean) => (demo ? "info" : v === "verified" ? "success" : v === "estimated" ? "warning" : "neutral");

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser();
  const ctx = await loadContext(user.id);
  const sp = await searchParams;
  const records = await db.select().from(analyticsRecords).where(eq(analyticsRecords.userId, user.id)).orderBy(desc(analyticsRecords.periodEnd));
  const placements = await db.select().from(playlistPlacements).where(and(eq(playlistPlacements.userId, user.id))).orderBy(desc(playlistPlacements.addedDate));
  const opts = relationOptions(ctx);
  const metricsPresent = Array.from(new Set(records.map((r) => r.metric)));
  const metric = sp.metric && metricsPresent.includes(sp.metric) ? sp.metric : metricsPresent[0];
  const platforms = Array.from(new Set(records.filter((r) => r.metric === metric).map((r) => r.platform)));
  const platform = sp.platform && platforms.includes(sp.platform) ? sp.platform : platforms[0];
  const seriesRows = records
    .filter((r) => r.metric === metric && r.platform === platform && (!sp.track || r.trackId === sp.track))
    .sort((a, b) => a.periodEnd.localeCompare(b.periodEnd))
    .map((r) => ({ x: formatDate(r.periodEnd), value: Number(r.value) }));
  const cur = ctx.settings.currency;

  // Campaign comparison from recorded data
  const campaignRows = ctx.campaigns.filter((c) => c.status !== "Archived").map((c) => {
    const content = ctx.content.filter((x) => x.campaignId === c.id);
    const views = content.reduce((s, x) => s + (x.metrics?.views ?? 0), 0);
    const spend = c.ads.reduce((s, a) => s + Number(a.actualSpend ?? 0), 0);
    const conversions = c.ads.reduce((s, a) => s + (a.conversions ?? 0), 0);
    return { c, content: content.length, published: content.filter((x) => x.publishedAt).length, views, spend, conversions, hasData: views > 0 || spend > 0 };
  });
  const goals = ctx.goals.filter((g) => g.targetValue !== null && g.status === "active");

  const addButton = (
    <FormModal
      label="Record metric"
      title="Record a metric"
      description="Enter numbers exactly as shown by the source. Say where they come from — estimates must be marked as estimates."
      action={saveMetric}
      defs={withOptions(ANALYTICS_FIELDS, { trackId: opts.trackId, releaseId: opts.releaseId, campaignId: opts.campaignId })}
      values={{ periodEnd: ctx.today, verification: "manual", platform: "Spotify", metric: "monthly_listeners", trackId: sp.trackId, releaseId: sp.releaseId }}
      after={<label className="flex items-center gap-2 text-xs text-muted"><input type="checkbox" name="confirmVerified" className="accent-[var(--accent)]" /> If “Verified”: I copied this value from the official platform dashboard.</label>}
      variant="primary"
      icon={<Plus className="h-4 w-4" />}
    />
  );

  return (
    <div>
      <PageHeader
        eyebrow="Audience & Analytics"
        title="Audience & performance"
        purpose="Only real data: manual entries, CSV imports and official APIs — each value shows its source, period and whether it is verified, manual or estimated. Missing metrics are never filled in."
        actions={
          <>
            <LinkButton href="/import/analytics" variant="ghost"><Upload className="h-4 w-4" /> Import CSV</LinkButton>
            <a href="/api/export/analytics" className="inline-flex h-9 items-center gap-2 rounded-md px-4 text-sm text-muted hover:bg-surface-3 hover:text-fg"><Download className="h-4 w-4" /> CSV</a>
            <LinkButton href="/settings/integrations" variant="outline">Integrations</LinkButton>
            {addButton}
          </>
        }
      />
      {sp.add && <Notice className="mb-6">Use “Record metric” above to add a value.</Notice>}
      {!records.length ? (
        <EmptyState icon={<BarChart3 className="h-8 w-8" />} title="No audience data recorded yet." description="Record monthly listeners, streams, followers or campaign results — or import a CSV export from your dashboards." action={addButton} />
      ) : (
        <>
          <Card className="mb-6">
            <form className="mb-4 flex flex-wrap gap-2">
              <select name="metric" defaultValue={metric} className={filterClass} aria-label="Metric">{metricsPresent.map((m) => <option key={m} value={m}>{metricLabel(m)}</option>)}</select>
              <select name="platform" defaultValue={platform} className={filterClass} aria-label="Platform">{platforms.map((p) => <option key={p}>{p}</option>)}</select>
              <select name="track" defaultValue={sp.track ?? ""} className={filterClass} aria-label="Track"><option value="">All tracks / artist level</option>{ctx.tracks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}</select>
              <button className="rounded-md border border-line px-3 text-sm text-muted hover:text-fg" type="submit">Show</button>
            </form>
            {seriesRows.length > 1 ? (
              <LineSeriesChart title={`${metricLabel(metric!)} · ${platform}`} rows={seriesRows} series={[{ key: "value", label: metricLabel(metric!), color: "2" }]} digits={2} />
            ) : (
              <p className="text-sm text-muted">{seriesRows.length === 1 ? "Only one data point recorded — add more over time to see a trend." : "No data for this selection."}</p>
            )}
          </Card>
          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader title="All records" description={`${records.length} value(s)`} />
              <div className="max-h-[420px] overflow-auto">
                <Table>
                  <thead><tr><Th>Metric</Th><Th>Value</Th><Th>Period</Th><Th>Source</Th><Th /></tr></thead>
                  <tbody>
                    {records.slice(0, 200).map((r) => (
                      <tr key={r.id}>
                        <Td className="text-xs">{metricLabel(r.metric)}<div className="text-faint">{r.platform}{r.trackId && ` · ${ctx.tracks.find((t) => t.id === r.trackId)?.title ?? ""}`}</div></Td>
                        <Td className="tabular-nums">{r.metric === "ad_spend" || r.metric === "revenue" ? formatMoney(r.value, cur) : formatNumber(r.value, 2)}</Td>
                        <Td className="text-xs text-muted">{r.periodStart ? `${formatDate(r.periodStart)} – ` : ""}{formatDate(r.periodEnd)}</Td>
                        <Td><Badge tone={verTone(r.verification, r.isDemo)}>{r.isDemo ? "demo" : `${r.source} · ${r.verification}`}</Badge></Td>
                        <Td><ConfirmAction action={deleteMetric} fields={{ id: r.id }} label="Delete" title="Delete this record?" message="The value is removed from analytics and reports." size="icon" variant="ghost" icon={<Trash2 className="h-3.5 w-3.5" />} /></Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </Card>
            <div className="space-y-6">
              <Card>
                <CardHeader title="Goal tracking" description="Goals with a numeric target" action={<Link href="/business?tab=goals" className="text-xs text-muted hover:text-fg">Edit goals</Link>} />
                {goals.length ? (
                  <ul className="space-y-3">
                    {goals.map((g) => (
                      <li key={g.id}>
                        <div className="flex justify-between text-sm"><span>{g.title}</span><span className="text-xs text-muted">{formatNumber(g.currentValue)} / {formatNumber(g.targetValue)} {g.unit}</span></div>
                        <Progress value={Number(g.currentValue ?? 0)} max={Number(g.targetValue)} className="mt-1" />
                        {g.deadline && <div className="mt-0.5 text-[11px] text-faint">by {formatDate(g.deadline)}</div>}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted">No measurable goals yet.</p>
                )}
              </Card>
              <Card>
                <CardHeader title="Campaign comparison" description="From recorded content metrics and ad results. Differences show correlation, not proven cause." />
                {campaignRows.some((r) => r.hasData) ? (
                  <Table>
                    <thead><tr><Th>Campaign</Th><Th>Published</Th><Th>Views</Th><Th>Ad spend</Th><Th>Conversions</Th></tr></thead>
                    <tbody>{campaignRows.map((r) => <tr key={r.c.id}><Td><Link href={`/marketing/${r.c.id}`} className="hover:text-accent-strong">{r.c.name}</Link></Td><Td className="text-xs">{r.published}/{r.content}</Td><Td className="text-xs">{r.views ? formatNumber(r.views) : "—"}</Td><Td className="text-xs">{r.spend ? formatMoney(r.spend, r.c.currency) : "—"}</Td><Td className="text-xs">{r.conversions || "—"}</Td></tr>)}</tbody>
                  </Table>
                ) : (
                  <p className="text-sm text-muted">No campaign results recorded yet.</p>
                )}
              </Card>
            </div>
          </div>
        </>
      )}
      <Card className="mt-6">
        <CardHeader
          title="Playlist placements"
          action={<FormModal label="Add placement" title="Playlist placement" action={savePlacement} defs={withOptions(PLACEMENT_FIELDS, { trackId: opts.trackId })} values={{ verification: "manual", platform: "Spotify", addedDate: ctx.today }} size="sm" variant="outline" icon={<Plus className="h-3.5 w-3.5" />} />}
        />
        {placements.length ? (
          <Table>
            <thead><tr><Th>Playlist</Th><Th>Track</Th><Th>Followers</Th><Th>Added</Th><Th>Status</Th><Th /></tr></thead>
            <tbody>
              {placements.map((p) => (
                <tr key={p.id}>
                  <Td>{p.url ? <a href={p.url} target="_blank" rel="noopener noreferrer" className="hover:text-accent-strong">{p.playlistName}</a> : p.playlistName}<div className="text-xs text-faint">{p.platform}{p.curator && ` · ${p.curator}`}</div></Td>
                  <Td className="text-xs">{ctx.tracks.find((t) => t.id === p.trackId)?.title ?? "—"}</Td>
                  <Td className="text-xs">{formatNumber(p.followers)}</Td>
                  <Td className="text-xs">{formatDate(p.addedDate)}</Td>
                  <Td>{p.removedDate ? <Badge tone="inactive">removed {formatDate(p.removedDate)}</Badge> : <Badge tone={verTone(p.verification, p.isDemo)}>{p.isDemo ? "demo" : p.verification}</Badge>}</Td>
                  <Td className="whitespace-nowrap text-right">
                    <FormModal label="Edit" title="Edit placement" action={savePlacement} defs={withOptions(PLACEMENT_FIELDS, { trackId: opts.trackId })} values={p as unknown as Record<string, unknown>} hidden={{ id: p.id }} size="sm" variant="ghost" />
                    <ConfirmAction action={deletePlacement} fields={{ id: p.id }} label="Remove" title="Remove this placement?" message="The placement record is deleted." size="icon" variant="ghost" icon={<Trash2 className="h-3.5 w-3.5" />} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <p className="text-sm text-muted">No playlist placements recorded.</p>
        )}
      </Card>
    </div>
  );
}
