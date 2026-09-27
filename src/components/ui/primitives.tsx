import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn, titleCase, toneFor, type Tone } from "@/lib/utils";

// ─── Buttons ────────────────────────────────────────────────────────────────

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg" | "icon";

export function buttonClass(variant: Variant = "secondary", size: Size = "md", extra?: string) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-md font-normal tracking-wide transition-colors duration-150 select-none",
    "disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap",
    size === "sm" && "h-8 px-3 text-xs",
    size === "md" && "h-9 px-4 text-sm",
    size === "lg" && "h-11 px-6 text-sm",
    size === "icon" && "h-9 w-9 text-sm",
    variant === "primary" && "bg-accent text-white hover:bg-accent-strong",
    variant === "secondary" && "bg-surface-3 text-fg hover:bg-line-strong border border-line",
    variant === "outline" && "border border-line-strong text-fg hover:border-accent hover:text-fg",
    variant === "ghost" && "text-muted hover:text-fg hover:bg-surface-3",
    variant === "danger" && "border border-danger/40 text-danger hover:bg-danger/10",
    extra,
  );
}

export function Button({
  variant,
  size,
  className,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button type="button" className={buttonClass(variant, size, className)} {...props} />;
}

export function LinkButton({
  variant,
  size,
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

// ─── Surfaces ───────────────────────────────────────────────────────────────

export function Card({ className, children, ...props }: ComponentProps<"section">) {
  return (
    <section className={cn("rounded-lg border border-line bg-surface p-5", className)} {...props}>
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  description,
  action,
  icon,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-sm font-normal uppercase tracking-[0.14em] text-fg">
          {icon && <span className="text-accent-strong">{icon}</span>}
          {title}
        </h2>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function PageHeader({
  title,
  purpose,
  actions,
  eyebrow,
}: {
  title: ReactNode;
  purpose?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="mb-2 text-xs uppercase tracking-[0.2em] text-accent-strong">{eyebrow}</div>}
        <h1 className="text-3xl font-extralight tracking-wide text-fg md:text-4xl">{title}</h1>
        {purpose && <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">{purpose}</p>}
      </div>
      {actions && <div className="no-print flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

// ─── Badges ─────────────────────────────────────────────────────────────────

const toneClass: Record<Tone, string> = {
  neutral: "border-line-strong text-muted",
  accent: "border-accent/60 text-accent-strong bg-accent-soft",
  success: "border-success/40 text-success bg-success/10",
  warning: "border-warning/40 text-warning bg-warning/10",
  danger: "border-danger/40 text-danger bg-danger/10",
  inactive: "border-line text-faint",
  info: "border-sky-500/40 text-sky-400 bg-sky-500/10",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-normal leading-4 tracking-wide",
        toneClass[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status, tone, label }: { status: string | null | undefined; tone?: Tone; label?: string }) {
  if (!status) return <Badge tone="inactive">—</Badge>;
  return <Badge tone={tone ?? toneFor(status)}>{label ?? titleCase(status)}</Badge>;
}

export function DemoBadge() {
  return (
    <Badge tone="info" className="uppercase">
      Demo
    </Badge>
  );
}

// ─── Progress & stats ───────────────────────────────────────────────────────

export function Progress({ value, max = 100, tone = "accent", className, label }: { value: number; max?: number; tone?: Tone; className?: string; label?: string }) {
  const pct = max <= 0 ? 0 : Math.max(0, Math.min(100, (value / max) * 100));
  const bar =
    tone === "success" ? "bg-success" : tone === "warning" ? "bg-warning" : tone === "danger" ? "bg-danger" : "bg-accent-strong";
  return (
    <div
      className={cn("h-1 w-full overflow-hidden rounded-full bg-surface-3", className)}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div className={cn("h-full rounded-full transition-all duration-500", bar)} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: Tone }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] uppercase tracking-[0.16em] text-faint">{label}</div>
      <div
        className={cn(
          "mt-1 truncate text-2xl font-extralight",
          tone === "danger" && "text-danger",
          tone === "warning" && "text-warning",
          tone === "success" && "text-success",
          tone === "accent" && "text-accent-strong",
        )}
      >
        {value}
      </div>
      {hint && <div className="mt-0.5 text-xs text-muted">{hint}</div>}
    </div>
  );
}

// ─── States ─────────────────────────────────────────────────────────────────

export function EmptyState({
  title,
  description,
  action,
  icon,
  compact,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-line text-center",
        compact ? "px-4 py-6" : "px-6 py-14",
      )}
    >
      {icon && <div className="mb-3 text-accent-strong">{icon}</div>}
      <p className="text-sm text-fg">{title}</p>
      {description && <p className="mt-1 max-w-md text-sm text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Notice({
  tone = "neutral",
  title,
  children,
  className,
}: {
  tone?: Tone;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const border =
    tone === "danger"
      ? "border-l-danger"
      : tone === "warning"
        ? "border-l-warning"
        : tone === "success"
          ? "border-l-success"
          : tone === "info"
            ? "border-l-sky-500"
            : "border-l-accent";
  return (
    <div className={cn("rounded-md border border-line border-l-2 bg-surface-2 px-4 py-3 text-sm", border, className)} role="note">
      {title && <div className="mb-0.5 text-fg">{title}</div>}
      {children && <div className="text-muted">{children}</div>}
    </div>
  );
}

// ─── Tables ─────────────────────────────────────────────────────────────────

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-x-auto rounded-lg border border-line", className)}>
      <table className="w-full min-w-[640px] border-collapse text-sm">{children}</table>
    </div>
  );
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        "border-b border-line bg-surface-2 px-3 py-2.5 text-left text-[11px] font-normal uppercase tracking-[0.14em] text-faint",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({ children, className, colSpan }: { children?: ReactNode; className?: string; colSpan?: number }) {
  return (
    <td colSpan={colSpan} className={cn("border-b border-line px-3 py-2.5 align-middle text-fg", className)}>
      {children}
    </td>
  );
}

// ─── Tabs (link-based, server friendly) ─────────────────────────────────────

export function LinkTabs({ tabs, active }: { tabs: { key: string; label: ReactNode; href: string }[]; active: string }) {
  return (
    <nav className="no-print mb-6 flex gap-1 overflow-x-auto border-b border-line" aria-label="Views">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={t.key === active ? "page" : undefined}
          className={cn(
            "-mb-px whitespace-nowrap border-b px-3 py-2 text-sm transition-colors",
            t.key === active ? "border-accent-strong text-fg" : "border-transparent text-muted hover:text-fg",
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

// ─── Misc ───────────────────────────────────────────────────────────────────

export function KeyValue({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
      {items.map((i) => (
        <div key={i.label} className="min-w-0">
          <dt className="text-[11px] uppercase tracking-[0.14em] text-faint">{i.label}</dt>
          <dd className="mt-0.5 break-words text-sm text-fg">{i.value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Divider() {
  return <hr className="my-6 border-line" />;
}

export function SourceTag({ source, date }: { source: string; date?: string | null }) {
  return (
    <span className="text-[11px] text-faint">
      Source: {source}
      {date ? ` · ${date}` : ""}
    </span>
  );
}
