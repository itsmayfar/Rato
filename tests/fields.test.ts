import { describe, expect, it } from "vitest";
import { parseFieldValue, parseForm, type FieldDef } from "@/lib/fields";

const f = (over: Partial<FieldDef>): FieldDef => ({ key: "x", label: "X", type: "text", ...over });

describe("field validation", () => {
  it("requires required fields", () => {
    expect(parseFieldValue(f({ required: true }), "  ")).toEqual({ ok: false, error: "X is required." });
    expect(parseFieldValue(f({}), "")).toEqual({ ok: true, value: null });
  });
  it("validates emails and normalises case", () => {
    expect(parseFieldValue(f({ type: "email" }), "Hi@MayFar.com")).toEqual({ ok: true, value: "hi@mayfar.com" });
    expect(parseFieldValue(f({ type: "email" }), "nope").ok).toBe(false);
  });
  it("upgrades bare domains to https urls", () => {
    expect(parseFieldValue(f({ type: "url" }), "mayfar.com")).toEqual({ ok: true, value: "https://mayfar.com" });
    expect(parseFieldValue(f({ type: "url" }), "javascript:alert(1)").ok).toBe(false);
  });
  it("validates real calendar dates", () => {
    expect(parseFieldValue(f({ type: "date" }), "2026-02-29").ok).toBe(false);
    expect(parseFieldValue(f({ type: "date" }), "2028-02-29").ok).toBe(true);
  });
  it("bounds percentages and rounds money", () => {
    expect(parseFieldValue(f({ type: "percent" }), "101").ok).toBe(false);
    expect(parseFieldValue(f({ type: "percent" }), "-1").ok).toBe(false);
    expect(parseFieldValue(f({ type: "percent" }), "33,5")).toEqual({ ok: true, value: 33.5 });
    expect(parseFieldValue(f({ type: "money" }), "12.345")).toEqual({ ok: true, value: 12.35 });
    expect(parseFieldValue(f({ type: "money" }), "-5").ok).toBe(false);
  });
  it("parses durations", () => {
    expect(parseFieldValue(f({ type: "duration" }), "6:30")).toEqual({ ok: true, value: 390 });
    expect(parseFieldValue(f({ type: "duration" }), "6:75").ok).toBe(false);
  });
  it("restricts selects to options unless custom values allowed", () => {
    expect(parseFieldValue(f({ type: "select", options: ["a", "b"] }), "c").ok).toBe(false);
    expect(parseFieldValue(f({ type: "select", options: ["a"], allowCustom: true }), "c")).toEqual({ ok: true, value: "c" });
  });
  it("splits and de-duplicates tags", () => {
    expect(parseFieldValue(f({ type: "tags" }), "Ableton, Serum, Ableton,")).toEqual({ ok: true, value: ["Ableton", "Serum"] });
  });
  it("parses a whole form and collects errors", () => {
    const fd = new FormData();
    fd.set("title", "");
    fd.set("bpm", "abc");
    const res = parseForm(
      [
        { key: "title", label: "Title", type: "text", required: true },
        { key: "bpm", label: "BPM", type: "number" },
      ],
      fd,
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(Object.keys(res.errors).sort()).toEqual(["bpm", "title"]);
  });
});
