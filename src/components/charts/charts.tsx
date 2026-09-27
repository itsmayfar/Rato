"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { cn } from "@/lib/utils";

type Series = { key: string; label: string; color: "1" | "2" };
const color = (c: "1" | "2") => `var(--chart-${c})`;

const axis = { stroke: "var(--faint)", fontSize: 11, tickLine: false, axisLine: false } as const;

function ChartTooltip({ active, payload, label, format }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string; format: (n: number) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-line bg-surface px-3 py-2 text-xs shadow-xl">
      <div className="mb-1 text-muted">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 text-fg">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} aria-hidden />
          {p.name}: <span className="tabular-nums">{format(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

function Legend({ series }: { series: Series[] }) {
  if (series.length < 2) return null;
  return (
    <ul className="mb-3 flex flex-wrap gap-4 text-xs text-muted">
      {series.map((s) => (
        <li key={s.key} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color(s.color) }} aria-hidden />
          {s.label}
        </li>
      ))}
    </ul>
  );
}

/** Chart with a built-in accessible table view. */
function Frame({ title, children, rows, series, xLabel, format }: { title: string; children: React.ReactNode; rows: Record<string, string | number>[]; series: Series[]; xLabel: string; format: (n: number) => string }) {
  const [table, setTable] = useState(false);
  return (
    <figure>
      <div className="mb-2 flex items-center justify-between gap-2">
        <figcaption className="text-xs uppercase tracking-[0.14em] text-muted">{title}</figcaption>
        <button type="button" onClick={() => setTable((t) => !t)} className="text-xs text-faint hover:text-fg" aria-pressed={table}>
          {table ? "Show chart" : "View as table"}
        </button>
      </div>
      <Legend series={series} />
      {table ? (
        <div className="max-h-72 overflow-auto rounded-md border border-line">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-surface-2 text-faint">
                <th className="px-3 py-2 text-left font-normal">{xLabel}</th>
                {series.map((s) => <th key={s.key} className="px-3 py-2 text-right font-normal">{s.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t border-line">
                  <td className="px-3 py-1.5">{r.x}</td>
                  {series.map((s) => <td key={s.key} className="px-3 py-1.5 text-right tabular-nums">{format(Number(r[s.key]))}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className={cn("h-64 w-full")} role="img" aria-label={`${title} chart. Use “View as table” for the values.`}>
          {children}
        </div>
      )}
    </figure>
  );
}

export function BarsChart({ title, rows, series, currency, xLabel = "Month" }: { title: string; rows: Record<string, string | number>[]; series: Series[]; currency?: string; xLabel?: string }) {
  const format = (n: number) => (currency ? new Intl.NumberFormat("en-IE", { style: "currency", currency, maximumFractionDigits: 0 }).format(n) : new Intl.NumberFormat("en-IE").format(n));
  return (
    <Frame title={title} rows={rows} series={series} xLabel={xLabel} format={format}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} barGap={2} barCategoryGap="28%" margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="x" {...axis} />
          <YAxis {...axis} width={64} tickFormatter={(v) => format(Number(v))} />
          <Tooltip cursor={{ fill: "var(--surface-3)", opacity: 0.5 }} content={<ChartTooltip format={format} />} />
          {series.map((s) => (
            <Bar key={s.key} dataKey={s.key} name={s.label} fill={color(s.color)} radius={[4, 4, 0, 0]} maxBarSize={28} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </Frame>
  );
}

export function LineSeriesChart({ title, rows, series, currency, xLabel = "Date", digits = 0 }: { title: string; rows: Record<string, string | number>[]; series: Series[]; currency?: string; xLabel?: string; digits?: number }) {
  const format = (n: number) =>
    currency ? new Intl.NumberFormat("en-IE", { style: "currency", currency, maximumFractionDigits: 0 }).format(n) : new Intl.NumberFormat("en-IE", { maximumFractionDigits: digits }).format(n);
  return (
    <Frame title={title} rows={rows} series={series} xLabel={xLabel} format={format}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="x" {...axis} />
          <YAxis {...axis} width={64} tickFormatter={(v) => format(Number(v))} />
          <Tooltip cursor={{ stroke: "var(--border-strong)" }} content={<ChartTooltip format={format} />} />
          {series.map((s) => (
            <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={color(s.color)} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)", fill: color(s.color) }} activeDot={{ r: 5 }} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </Frame>
  );
}
