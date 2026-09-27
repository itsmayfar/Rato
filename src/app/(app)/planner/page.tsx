import { Plus } from "lucide-react";
import { Calendar, type CalEvent } from "@/components/ui/calendar";
import { filterClass, inputClass } from "@/components/ui/form";
import { LinkButton, PageHeader } from "@/components/ui/primitives";
import { requireUser } from "@/lib/auth";
import { CONTENT_PLATFORMS, CONTENT_STAGES } from "@/lib/constants";
import { loadContext } from "@/lib/context";
import { cn } from "@/lib/utils";

export const metadata = { title: "Social Media Planner" };

type SP = { view?: string; date?: string; platform?: string; campaign?: string; track?: string; stage?: string };

export default async function PlannerPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser();
  const ctx = await loadContext(user.id);
  const sp = await searchParams;
  const view = (["month", "week", "day", "list"].includes(sp.view ?? "") ? sp.view : "month") as "month" | "week" | "day" | "list";
  const events: CalEvent[] = ctx.content
    .filter((c) => c.plannedDate && (!sp.platform || c.platform === sp.platform) && (!sp.campaign || c.campaignId === sp.campaign) && (!sp.track || c.trackId === sp.track) && (!sp.stage || c.stage === sp.stage))
    .map((c) => ({
      date: c.plannedDate!,
      label: `${c.platform ? `[${c.platform}] ` : ""}${c.title}`,
      href: `/content/${c.id}`,
      tone: c.stage === "Published" || c.stage === "Analyzed" ? "success" : c.approvalStatus === "approved" ? "accent" : c.approvalStatus === "pending" ? "warning" : "neutral",
      meta: [c.plannedTime, c.stage, c.approvalStatus === "approved" ? "approved" : "not approved"].filter(Boolean).join(" · "),
    }));
  for (const r of ctx.releases.filter((r) => r.releaseDate && r.status !== "Archived")) events.push({ date: r.releaseDate!, label: `◆ Release: ${r.title}`, href: `/releases/${r.id}`, tone: "info", meta: "Release" });
  const params = { platform: sp.platform, campaign: sp.campaign, track: sp.track, stage: sp.stage };
  return (
    <div>
      <PageHeader
        eyebrow="Social Media Planner"
        title="Content calendar"
        purpose="All planned content across platforms, with release dates for context. Colour shows approval: grey draft, amber awaiting approval, red approved, green published."
        actions={<LinkButton href={`/content/new${sp.date ? `?date=${sp.date}` : ""}`} variant="primary"><Plus className="h-4 w-4" /> Plan content</LinkButton>}
      />
      <form className="mb-5 flex flex-wrap gap-2" role="search">
        <input type="hidden" name="view" value={view} />
        {sp.date && <input type="hidden" name="date" value={sp.date} />}
        <select name="platform" defaultValue={sp.platform ?? ""} className={filterClass} aria-label="Platform"><option value="">All platforms</option>{CONTENT_PLATFORMS.map((p) => <option key={p}>{p}</option>)}</select>
        <select name="campaign" defaultValue={sp.campaign ?? ""} className={filterClass} aria-label="Campaign"><option value="">All campaigns</option>{ctx.campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <select name="track" defaultValue={sp.track ?? ""} className={filterClass} aria-label="Track"><option value="">All tracks</option>{ctx.tracks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}</select>
        <select name="stage" defaultValue={sp.stage ?? ""} className={filterClass} aria-label="Status"><option value="">All statuses</option>{CONTENT_STAGES.map((s) => <option key={s}>{s}</option>)}</select>
        <button className="rounded-md border border-line px-3 text-sm text-muted hover:text-fg" type="submit">Apply</button>
      </form>
      <Calendar events={events} view={view} anchor={sp.date ?? ctx.today} today={ctx.today} basePath="/planner" params={params} views={["month", "week", "day", "list"]} />
    </div>
  );
}
