export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

/** Today as YYYY-MM-DD in the given IANA time zone (defaults to server local). */
export function todayISO(timeZone?: string, now: Date = new Date()): string {
  if (!timeZone) {
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  } catch {
    return todayISO(undefined, now);
  }
}

/** Add days to a YYYY-MM-DD date string (calendar arithmetic, UTC based). */
export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Whole days from a to b (b - a) for YYYY-MM-DD strings. */
export function daysBetween(a: string, b: string): number {
  const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

export function isValidISODate(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

export function monthKey(iso: string) {
  return iso.slice(0, 7);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatDate(iso: string | null | undefined, style: "short" | "long" = "short"): string {
  if (!iso) return "—";
  const s = typeof iso === "string" ? iso : new Date(iso).toISOString();
  const [y, m, d] = s.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return "—";
  return style === "long" ? `${d} ${MONTHS[m - 1]} ${y}` : `${d} ${MONTHS[m - 1]}${y === new Date().getFullYear() ? "" : ` ${y}`}`;
}

export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return `${formatDate(d.toISOString())} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function formatMonth(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return `${MONTHS[(m ?? 1) - 1]} ${y}`;
}

export function formatMoney(amount: number | null | undefined, currency = "EUR"): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return "—";
  try {
    return new Intl.NumberFormat("en-IE", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

export function formatNumber(n: number | null | undefined, digits = 0): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-IE", { maximumFractionDigits: digits }).format(n);
}

export function formatDuration(sec: number | null | undefined): string {
  if (!sec) return "—";
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

export function parseDuration(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  const m = /^(\d+):([0-5]\d)$/.exec(t);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  if (/^\d+$/.test(t)) return Number(t);
  return null;
}

export function isBlank(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === "string") return v.trim() === "";
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === "number") return Number.isNaN(v);
  return false;
}

export function titleCase(s: string): string {
  return s.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function pluralize(n: number, word: string, plural = `${word}s`) {
  return `${n} ${n === 1 ? word : plural}`;
}

export function truncate(s: string | null | undefined, n: number) {
  if (!s) return "";
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

export type Tone = "neutral" | "accent" | "success" | "warning" | "danger" | "inactive" | "info";

const TONES: Record<string, Tone> = {
  // generic
  complete: "success",
  completed: "success",
  done: "success",
  approved: "success",
  achieved: "success",
  paid: "success",
  released: "success",
  published: "success",
  active: "accent",
  "in progress": "accent",
  in_progress: "accent",
  missing: "danger",
  blocked: "danger",
  overdue: "danger",
  invalid: "danger",
  error: "danger",
  failed: "danger",
  urgent: "danger",
  high: "warning",
  needs_confirmation: "warning",
  outdated: "warning",
  pending: "warning",
  "waiting for information": "warning",
  "waiting for approval": "warning",
  waiting_info: "warning",
  waiting_approval: "warning",
  "awaiting information": "warning",
  "awaiting approval": "warning",
  awaiting_approval: "warning",
  changes_requested: "warning",
  estimated: "warning",
  forecast: "info",
  not_applicable: "inactive",
  cancelled: "inactive",
  archived: "inactive",
  not_started: "inactive",
  backlog: "inactive",
  paused: "inactive",
  skipped: "inactive",
  draft: "neutral",
  demo: "info",
  verified: "success",
  manual: "neutral",
};

export function toneFor(status: string | null | undefined): Tone {
  if (!status) return "neutral";
  return TONES[status.toLowerCase()] ?? "neutral";
}

export function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
