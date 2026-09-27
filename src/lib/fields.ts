/**
 * Field definitions shared by forms, server-side validation and the
 * information collection engine. One definition → one set of rules everywhere.
 */
import { isValidISODate, parseDuration } from "./utils";

export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "money"
  | "percent"
  | "date"
  | "email"
  | "url"
  | "select"
  | "multiselect"
  | "tags"
  | "boolean"
  | "tristate" // yes | no | unknown
  | "duration" // m:ss stored as seconds
  | "currency";

export type Option = string | { value: string; label: string };

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  /** Short help shown under the input. */
  help?: string;
  /** Why the information is needed (shown by the question engine). */
  why?: string;
  placeholder?: string;
  options?: readonly Option[];
  min?: number;
  max?: number;
  maxLength?: number;
  /** Legal / financial / sensitive — show a confirmation summary before saving. */
  important?: boolean;
  /** Allow typing a value that isn't in `options` (select only). */
  allowCustom?: boolean;
}

export type FieldValue = string | number | boolean | string[] | null;

export function optionValue(o: Option) {
  return typeof o === "string" ? o : o.value;
}
export function optionLabel(o: Option) {
  return typeof o === "string" ? o : o.label;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const CURRENCIES = ["EUR", "USD", "GBP", "CHF", "SEK", "NOK", "DKK", "PLN", "CZK", "CAD", "AUD", "JPY", "BRL", "MXN"];

export function isValidUrl(v: string) {
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** Accepts "example.com" and upgrades to https://example.com. */
export function normalizeUrl(v: string) {
  const t = v.trim();
  if (!t) return t;
  if (/^[a-z]+:\/\//i.test(t)) return t;
  return `https://${t}`;
}

type ParseResult = { ok: true; value: FieldValue } | { ok: false; error: string };

/** Parse a raw form value (string or list of strings) according to the field definition. */
export function parseFieldValue(def: FieldDef, raw: string | string[] | null | undefined): ParseResult {
  const str = Array.isArray(raw) ? raw.join(",") : (raw ?? "");
  const trimmed = str.trim();
  const empty = (): ParseResult =>
    def.required ? { ok: false, error: `${def.label} is required.` } : { ok: true, value: emptyValue(def) };

  switch (def.type) {
    case "boolean": {
      const v = Array.isArray(raw) ? raw[raw.length - 1] : raw;
      return { ok: true, value: v === "on" || v === "true" || v === "1" || v === "yes" };
    }
    case "multiselect":
    case "tags": {
      const list = (Array.isArray(raw) ? raw : str.split(","))
        .flatMap((s) => (def.type === "tags" ? s.split(",") : [s]))
        .map((s) => s.trim())
        .filter(Boolean);
      const unique = Array.from(new Set(list));
      if (def.required && unique.length === 0) return { ok: false, error: `${def.label} needs at least one value.` };
      if (def.type === "multiselect" && def.options && !def.allowCustom) {
        const allowed = new Set(def.options.map(optionValue));
        const bad = unique.find((v) => !allowed.has(v));
        if (bad) return { ok: false, error: `"${bad}" is not a valid option for ${def.label}.` };
      }
      return { ok: true, value: unique };
    }
    default:
      break;
  }

  if (!trimmed) return empty();
  if (def.maxLength && trimmed.length > def.maxLength)
    return { ok: false, error: `${def.label} must be at most ${def.maxLength} characters.` };

  switch (def.type) {
    case "text":
    case "textarea":
      return { ok: true, value: trimmed };
    case "email":
      return EMAIL_RE.test(trimmed) ? { ok: true, value: trimmed.toLowerCase() } : { ok: false, error: "Enter a valid email address." };
    case "url": {
      const url = normalizeUrl(trimmed);
      return isValidUrl(url) ? { ok: true, value: url } : { ok: false, error: "Enter a valid web address (https://…)." };
    }
    case "date":
      return isValidISODate(trimmed) ? { ok: true, value: trimmed } : { ok: false, error: "Enter a valid date (YYYY-MM-DD)." };
    case "number":
    case "money":
    case "percent": {
      const n = Number(trimmed.replace(/\s/g, "").replace(",", "."));
      if (!Number.isFinite(n)) return { ok: false, error: `${def.label} must be a number.` };
      const min = def.min ?? (def.type === "percent" || def.type === "money" ? 0 : undefined);
      const max = def.max ?? (def.type === "percent" ? 100 : undefined);
      if (min !== undefined && n < min) return { ok: false, error: `${def.label} must be at least ${min}.` };
      if (max !== undefined && n > max) return { ok: false, error: `${def.label} must be at most ${max}.` };
      const rounded = def.type === "money" ? Math.round(n * 100) / 100 : n;
      return { ok: true, value: rounded };
    }
    case "duration": {
      const s = parseDuration(trimmed);
      return s === null ? { ok: false, error: "Use minutes:seconds, e.g. 3:45." } : { ok: true, value: s };
    }
    case "currency": {
      const c = trimmed.toUpperCase();
      return /^[A-Z]{3}$/.test(c) ? { ok: true, value: c } : { ok: false, error: "Use a 3-letter currency code (EUR)." };
    }
    case "tristate":
      return ["yes", "no", "unknown"].includes(trimmed)
        ? { ok: true, value: trimmed }
        : { ok: false, error: `Choose yes, no or unknown.` };
    case "select": {
      if (def.options && !def.allowCustom && !def.options.map(optionValue).includes(trimmed))
        return { ok: false, error: `Choose a valid option for ${def.label}.` };
      return { ok: true, value: trimmed };
    }
    default:
      return { ok: true, value: trimmed };
  }
}

export function emptyValue(def: FieldDef): FieldValue {
  if (def.type === "multiselect" || def.type === "tags") return [];
  if (def.type === "boolean") return false;
  return null;
}

export type FormErrors = Record<string, string>;

function readRaw(def: FieldDef, form: FormData, prefix = ""): string | string[] | null {
  const name = prefix + def.key;
  if (def.type === "multiselect") return form.getAll(name).map(String);
  if (def.type === "boolean") return form.getAll(name).map(String);
  const v = form.get(name);
  return v === null ? null : String(v);
}

/** Validate every field; returns values or per-field errors. */
export function parseForm(
  defs: readonly FieldDef[],
  form: FormData,
  opts: { prefix?: string; only?: Set<string> } = {},
): { ok: true; data: Record<string, FieldValue> } | { ok: false; errors: FormErrors } {
  const data: Record<string, FieldValue> = {};
  const errors: FormErrors = {};
  for (const def of defs) {
    if (opts.only && !opts.only.has(def.key)) continue;
    const res = parseFieldValue(def, readRaw(def, form, opts.prefix));
    if (res.ok) data[def.key] = res.value;
    else errors[def.key] = res.error;
  }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, data };
}

/** Render a stored value as a plain string for inputs. */
export function toInputValue(def: FieldDef, v: unknown): string {
  if (v === null || v === undefined) return "";
  if (Array.isArray(v)) return v.join(", ");
  if (def.type === "duration" && typeof v === "number") return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, "0")}`;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v);
}

export function displayValue(def: FieldDef, v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (Array.isArray(v)) return v.length ? v.join(", ") : "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (def.type === "tristate") return v === "yes" ? "Yes" : v === "no" ? "No" : "Unknown";
  if (def.type === "percent") return `${v}%`;
  if (def.type === "select" && def.options) {
    const o = def.options.find((o) => optionValue(o) === v);
    if (o) return optionLabel(o);
  }
  return toInputValue(def, v);
}
