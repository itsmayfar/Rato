import Link from "next/link";
import { Scale } from "lucide-react";
import { Badge, Card, CardHeader, EmptyState, LinkButton, Notice, PageHeader, Stat, StatusBadge, Table, Td, Th } from "@/components/ui/primitives";
import { requireUser } from "@/lib/auth";
import { RIGHTS_STATUS_OPTIONS } from "@/lib/constants";
import { loadContext } from "@/lib/context";
import { ROYALTY_CATEGORIES, realOnly, toBase } from "@/lib/finance";
import { evaluateTrack, isResolved } from "@/lib/info/engine";
import { summarizeSplits, splitsByType } from "@/lib/rights";
import { formatMoney } from "@/lib/utils";
import { tracksForRelease } from "@/lib/workflow/phases";

export const metadata = { title: "Rights & Royalties" };

const label = (list: { value: string; label: string }[], v?: string | null) => list.find((o) => o.value === v)?.label ?? "—";

export default async function RightsPage({ searchParams }: { searchParams: Promise<{ scope?: string }> }) {
  const user = await requireUser();
  const ctx = await loadContext(user.id);
  const { scope } = await searchParams;
  const heading = new Set(tracksForRelease(ctx).map((t) => t.id));
  const list = ctx.tracks.filter((t) => t.status !== "Archived" && (scope !== "release" || heading.has(t.id)));
  const rows = list.map((t) => {
    const { composition, master } = splitsByType(t.splits);
    const items = evaluateTrack(ctx, t).filter((i) => i.group === "rights" && i.required);
    return { t, comp: summarizeSplits(composition), mast: summarizeSplits(master), open: items.filter((i) => !isResolved(i)) };
  });
  const cur = ctx.settings.currency;
  const royalties = realOnly(ctx.transactions).filter((x) => x.kind === "income" && x.nature === "actual" && ROYALTY_CATEGORIES.has(x.category));
  const royaltyTotal = royalties.reduce((s, x) => s + (toBase(x, cur) ?? 0), 0);
  const unattributed = royalties.filter((x) => !x.trackId && !x.releaseId).length;

  return (
    <div>
      <PageHeader
        eyebrow="Rights & Royalties"
        title="Who owns what"
        purpose="Composition and master ownership, splits, samples, agreements, registrations and royalty collection for every track. Incomplete or conflicting information is flagged."
        actions={<LinkButton href="/documents?category=split_sheet" variant="outline">Split sheets & contracts</LinkButton>}
      />
      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <Card><Stat label="Tracks documented" value={`${rows.filter((r) => !r.open.length).length}/${rows.length}`} /></Card>
        <Card><Stat label="Split conflicts" value={rows.filter((r) => ["over", "under"].includes(r.comp.status) || ["over", "under"].includes(r.mast.status)).length} tone="danger" /></Card>
        <Card><Stat label="Heading to release, incomplete" value={rows.filter((r) => heading.has(r.t.id) && r.open.length).length} tone="warning" /></Card>
        <Card><Stat label="Royalties recorded" value={formatMoney(royaltyTotal, cur)} hint={unattributed ? `${unattributed} not linked to a track/release` : "Actual, received or pending"} /></Card>
      </div>
      <Notice className="mb-6">Registration statuses only show “registered” when you record a confirmation. The app never registers works or collects royalties itself, and this is not legal advice.</Notice>
      <div className="mb-3 flex gap-2 text-sm">
        <Link href="/rights" className={!scope ? "text-fg" : "text-muted hover:text-fg"}>All tracks</Link>
        <span className="text-faint">·</span>
        <Link href="/rights?scope=release" className={scope === "release" ? "text-fg" : "text-muted hover:text-fg"}>Heading to release</Link>
      </div>
      {rows.length ? (
        <Table>
          <thead><tr><Th>Track</Th><Th>Composition</Th><Th>Master</Th><Th>Samples</Th><Th>Agreement</Th><Th>Copyright / PRO</Th><Th>Collection</Th><Th>Status</Th></tr></thead>
          <tbody>
            {rows.map(({ t, comp, mast, open }) => (
              <tr key={t.id} className="hover:bg-surface-2">
                <Td><Link href={`/catalog/${t.id}?tab=rights`} className="hover:text-accent-strong">{t.title}</Link>{heading.has(t.id) && <div className="text-[11px] text-accent-strong">heading to release</div>}</Td>
                <Td><SplitCell s={comp} /></Td>
                <Td><SplitCell s={mast} /></Td>
                <Td className="text-xs">{label(RIGHTS_STATUS_OPTIONS.samplesUsed, t.rights?.samplesUsed)}{t.rights?.samplesUsed === "yes" && <div className="text-faint">{label(RIGHTS_STATUS_OPTIONS.sampleLicenseStatus, t.rights.sampleLicenseStatus)}</div>}</Td>
                <Td className="text-xs">{t.hasCollaborators === "no" ? "Solo work" : label(RIGHTS_STATUS_OPTIONS.agreementStatus, t.rights?.agreementStatus)}</Td>
                <Td className="text-xs">{label(RIGHTS_STATUS_OPTIONS.registration, t.rights?.copyrightRegistration)} / {label(RIGHTS_STATUS_OPTIONS.registration, t.rights?.proRegistration)}</Td>
                <Td className="text-xs">{label(RIGHTS_STATUS_OPTIONS.registration, t.rights?.royaltyCollection)}</Td>
                <Td>{open.length ? <Badge tone="warning" >{open.length} open</Badge> : <Badge tone="success">Documented</Badge>}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <EmptyState icon={<Scale className="h-8 w-8" />} title="No tracks to document yet." action={<LinkButton href="/catalog/new">Add a track</LinkButton>} />
      )}
      <Card className="mt-6">
        <CardHeader title="Royalty collection" description="Where royalties are collected is recorded per track (collection services). Record statements as income under “Streaming royalties” or “Publishing royalties”." />
        <LinkButton href="/finances/new?kind=income&category=Streaming%20royalties" size="sm" variant="outline">Record a royalty statement</LinkButton>
      </Card>
    </div>
  );
}

function SplitCell({ s }: { s: ReturnType<typeof summarizeSplits> }) {
  return (
    <div className="text-xs">
      <StatusBadge status={s.status === "complete" ? "complete" : s.status === "missing" ? "missing" : s.status === "unconfirmed" ? "needs_confirmation" : "invalid"} label={s.count ? `${s.total}%` : "Missing"} />
      {s.count > 0 && <div className="mt-0.5 text-faint">{s.count} holder(s)</div>}
    </div>
  );
}
