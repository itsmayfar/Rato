import { describe, expect, it } from "vitest";
import { parseCSV, parseCSVObjects, toCSV } from "@/lib/csv";
import { budgetUsage, monthRange, summarizePeriod, toBase } from "@/lib/finance";

describe("csv", () => {
  it("parses quotes, escaped quotes, newlines and CRLF", () => {
    const rows = parseCSV('a,b\r\n"x, y","he said ""hi"""\r\n"multi\nline",2\r\n');
    expect(rows).toEqual([["a", "b"], ["x, y", 'he said "hi"'], ["multi\nline", "2"]]);
  });
  it("detects semicolon delimiters and strips BOM", () => {
    expect(parseCSVObjects("﻿title;bpm\nNightfall;124\n").rows).toEqual([{ title: "Nightfall", bpm: "124" }]);
  });
  it("round-trips and neutralises formula injection", () => {
    const out = toCSV([{ key: "a", label: "A" }], [{ a: "=HYPERLINK(1)" }, { a: "-12.5" }, { a: 'q"uote' }]);
    expect(out).toContain("'=HYPERLINK(1)");
    expect(out).toContain("-12.5");
    expect(parseCSVObjects(out).rows[2].A).toBe('q"uote');
  });
});

const tx = (o: Record<string, unknown>) => ({
  kind: "income", category: "Streaming royalties", amount: 100, currency: "EUR", baseAmount: null, date: "2026-09-10",
  nature: "actual", paymentStatus: "paid", isDemo: false, campaignId: null, releaseId: null, trackId: null, projectId: null, ...o,
}) as never;

describe("finance", () => {
  it("never mixes demo, estimated or forecast values into actuals", () => {
    const s = summarizePeriod(
      [tx({}), tx({ isDemo: true, amount: 999 }), tx({ nature: "estimated", amount: 50 }), tx({ nature: "forecast", amount: 70 }), tx({ kind: "expense", category: "Advertising", amount: 40 })],
      "EUR", ...monthRange("2026-09"),
    );
    expect(s.income.amount).toBe(100);
    expect(s.expenses.amount).toBe(40);
    expect(s.marketing.amount).toBe(40);
    expect(s.estimatedIncome.amount).toBe(50);
    expect(s.forecastIncome.amount).toBe(70);
    expect(s.net).toBe(60);
  });
  it("only converts foreign currency when a rate was recorded", () => {
    expect(toBase({ amount: 10, currency: "USD", baseAmount: null } as never, "EUR")).toBeNull();
    expect(toBase({ amount: 10, currency: "USD", baseAmount: 9.2 } as never, "EUR")).toBe(9.2);
    const s = summarizePeriod([tx({ currency: "USD" })], "EUR", ...monthRange("2026-09"));
    expect(s.income.unconverted).toBe(1);
    expect(s.income.amount).toBe(0);
  });
  it("excludes cancelled records and computes pending income", () => {
    const s = summarizePeriod([tx({ paymentStatus: "cancelled" }), tx({ paymentStatus: "pending", amount: 30 })], "EUR", ...monthRange("2026-09"));
    expect(s.income.amount).toBe(30);
    expect(s.outstandingIncome.amount).toBe(30);
  });
  it("computes budget usage for a campaign", () => {
    const u = budgetUsage({ amount: 100, currency: "EUR", campaignId: "c1", releaseId: null, projectId: null, category: null, periodStart: null, periodEnd: null } as never, [tx({ kind: "expense", amount: 120, campaignId: "c1" })], "EUR");
    expect(u).toMatchObject({ spent: 120, remaining: -20, over: true, percent: 120 });
  });
  it("handles month ranges including leap years", () => {
    expect(monthRange("2028-02")).toEqual(["2028-02-01", "2028-02-29"]);
  });
});
