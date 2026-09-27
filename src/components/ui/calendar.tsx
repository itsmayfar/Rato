import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, cn, formatDate, type Tone } from "@/lib/utils";
import { buttonClass } from "./primitives";

export type CalEvent = { date: string; label: string; href: string; tone?: Tone; meta?: string };

const TONE_BAR: Record<Tone, string> = {
  neutral: "border-l-line-strong",
  accent: "border-l-accent-strong",
  success: "border-l-success",
  warning: "border-l-warning",
  danger: "border-l-danger",
  inactive: "border-l-line",
  info: "border-l-sky-500",
};

function monthStart(month: string) {
  return `${month}-01`;
}
function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}
/** Monday-based weekday index */
function weekday(iso: string) {
  return (new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7;
}

/**
 * Calendar with month / week / list views. Navigation is link-based
 * (query params), so it renders on the server and works without JS.
 */
export function Calendar({
  events,
  view,
  anchor,
  today,
  basePath,
  params = {},
  viewParam = "view",
  views,
}: {
  events: CalEvent[];
  view: "month" | "week" | "day" | "list";
  anchor: string; // YYYY-MM-DD
  today: string;
  basePath: string;
  params?: Record<string, string | undefined>;
  /** Query parameter used for the calendar view (when the page already uses "view"). */
  viewParam?: string;
  views?: readonly ("month" | "week" | "day" | "list")[];
}) {
  const href = (over: Record<string, string>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...params, ...over })) if (v) q.set(k, v);
    return `${basePath}?${q.toString()}`;
  };
  const byDate = new Map<string, CalEvent[]>();
  for (const e of events) byDate.set(e.date, [...(byDate.get(e.date) ?? []), e]);

  let title = "";
  let prev = anchor;
  let next = anchor;
  let body: React.ReactNode;

  if (view === "month") {
    const month = anchor.slice(0, 7);
    const first = monthStart(month);
    const start = addDays(first, -weekday(first));
    const days = Array.from({ length: 42 }, (_, i) => addDays(start, i));
    title = formatDate(first, "long").split(" ").slice(1).join(" ");
    prev = `${shiftMonth(month, -1)}-01`;
    next = `${shiftMonth(month, 1)}-01`;
    body = (
      <div className="overflow-x-auto">
        <div className="grid min-w-[720px] grid-cols-7 overflow-hidden rounded-lg border border-line">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d} className="border-b border-line bg-surface-2 px-2 py-1.5 text-[11px] uppercase tracking-[0.14em] text-faint">
              {d}
            </div>
          ))}
          {days.map((d) => {
            const inMonth = d.startsWith(month);
            const list = byDate.get(d) ?? [];
            return (
              <div key={d} className={cn("min-h-28 border-b border-r border-line p-1.5 [&:nth-child(7n)]:border-r-0", !inMonth && "bg-surface/40")}>
                <div className={cn("mb-1 text-right text-xs", d === today ? "text-accent-strong" : inMonth ? "text-muted" : "text-faint/50")}>
                  {d === today ? <span className="rounded-full bg-accent px-1.5 text-white">{Number(d.slice(8))}</span> : Number(d.slice(8))}
                </div>
                <ul className="space-y-1">
                  {list.slice(0, 4).map((e, i) => (
                    <li key={i}>
                      <Link
                        href={e.href}
                        title={`${e.label}${e.meta ? ` · ${e.meta}` : ""}`}
                        className={cn("block truncate rounded-sm border-l-2 bg-surface-3 px-1.5 py-0.5 text-[11px] text-fg hover:bg-line-strong", TONE_BAR[e.tone ?? "accent"])}
                      >
                        {e.label}
                      </Link>
                    </li>
                  ))}
                  {list.length > 4 && <li className="px-1 text-[10px] text-faint">+{list.length - 4} more</li>}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    );
  } else if (view === "day") {
    title = formatDate(anchor, "long");
    prev = addDays(anchor, -1);
    next = addDays(anchor, 1);
    const list = byDate.get(anchor) ?? [];
    body = list.length ? (
      <ul className="divide-y divide-line rounded-lg border border-line">
        {list.map((e, i) => (
          <li key={i} className={cn("flex items-center gap-4 border-l-2 px-4 py-3", TONE_BAR[e.tone ?? "accent"])}>
            <Link href={e.href} className="min-w-0 flex-1 truncate text-sm hover:text-accent-strong">{e.label}</Link>
            {e.meta && <span className="shrink-0 text-xs text-faint">{e.meta}</span>}
          </li>
        ))}
      </ul>
    ) : (
      <p className="rounded-lg border border-dashed border-line p-8 text-center text-sm text-muted">Nothing planned for this day.</p>
    );
  } else if (view === "week") {
    const start = addDays(anchor, -weekday(anchor));
    const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
    title = `Week of ${formatDate(start, "long")}`;
    prev = addDays(start, -7);
    next = addDays(start, 7);
    body = (
      <div className="grid gap-3 md:grid-cols-7">
        {days.map((d) => (
          <div key={d} className={cn("min-h-40 rounded-lg border p-2", d === today ? "border-accent/60" : "border-line")}>
            <div className="mb-2 text-xs text-muted">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][weekday(d)]} <span className="text-fg">{Number(d.slice(8))}</span>
            </div>
            <ul className="space-y-1.5">
              {(byDate.get(d) ?? []).map((e, i) => (
                <li key={i}>
                  <Link href={e.href} className={cn("block rounded-sm border-l-2 bg-surface-3 px-2 py-1 text-xs hover:bg-line-strong", TONE_BAR[e.tone ?? "accent"])}>
                    {e.label}
                    {e.meta && <span className="block text-[10px] text-faint">{e.meta}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    );
  } else {
    const upcoming = events.filter((e) => e.date >= addDays(anchor, -1)).sort((a, b) => (a.date < b.date ? -1 : 1));
    const past = events.filter((e) => e.date < addDays(anchor, -1)).sort((a, b) => (a.date > b.date ? -1 : 1)).slice(0, 10);
    title = "Upcoming";
    body = (
      <div className="space-y-6">
        {[
          { label: "Upcoming", list: upcoming },
          { label: "Recent", list: past },
        ].map(
          (g) =>
            g.list.length > 0 && (
              <div key={g.label}>
                {g.label === "Recent" && <h3 className="mb-2 text-[11px] uppercase tracking-[0.16em] text-faint">Recent</h3>}
                <ul className="divide-y divide-line rounded-lg border border-line">
                  {g.list.map((e, i) => (
                    <li key={i} className={cn("flex items-center gap-4 border-l-2 px-4 py-2.5", TONE_BAR[e.tone ?? "accent"])}>
                      <span className={cn("w-24 shrink-0 text-xs", e.date === today ? "text-accent-strong" : e.date < today ? "text-faint" : "text-muted")}>{formatDate(e.date)}</span>
                      <Link href={e.href} className="min-w-0 flex-1 truncate text-sm hover:text-accent-strong">
                        {e.label}
                      </Link>
                      {e.meta && <span className="hidden shrink-0 text-xs text-faint sm:block">{e.meta}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            ),
        )}
        {!upcoming.length && !past.length && <p className="text-sm text-muted">Nothing scheduled yet.</p>}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {view !== "list" && (
            <>
              <Link href={href({ [viewParam]: view, date: prev })} className={buttonClass("ghost", "icon")} aria-label="Previous">
                <ChevronLeft className="h-4 w-4" />
              </Link>
              <Link href={href({ [viewParam]: view, date: next })} className={buttonClass("ghost", "icon")} aria-label="Next">
                <ChevronRight className="h-4 w-4" />
              </Link>
              <Link href={href({ [viewParam]: view, date: today })} className={buttonClass("ghost", "sm")}>
                Today
              </Link>
            </>
          )}
          <h2 className="ml-1 text-lg font-extralight">{title}</h2>
        </div>
        <div className="flex rounded-md border border-line p-0.5" role="tablist" aria-label="Calendar view">
          {(views ?? (["month", "week", "list"] as const)).map((v) => (
            <Link
              key={v}
              href={href({ [viewParam]: v, date: anchor })}
              role="tab"
              aria-selected={v === view}
              className={cn("rounded px-3 py-1 text-xs capitalize", v === view ? "bg-surface-3 text-fg" : "text-muted hover:text-fg")}
            >
              {v}
            </Link>
          ))}
        </div>
      </div>
      {body}
    </div>
  );
}
