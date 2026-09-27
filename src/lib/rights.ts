import type { Split } from "./types";

export type SplitSummary = {
  total: number;
  count: number;
  unconfirmed: number;
  status: "missing" | "complete" | "under" | "over" | "unconfirmed";
  issues: string[];
};

const round = (n: number) => Math.round(n * 1000) / 1000;

/** Validate the splits of one right type (composition or master). */
export function summarizeSplits(splits: Pick<Split, "holderName" | "percentage" | "confirmed">[]): SplitSummary {
  const issues: string[] = [];
  const total = round(splits.reduce((s, x) => s + Number(x.percentage || 0), 0));
  const unconfirmed = splits.filter((s) => !s.confirmed).length;
  const names = splits.map((s) => s.holderName.trim().toLowerCase());
  const dupes = names.filter((n, i) => names.indexOf(n) !== i);
  if (dupes.length) issues.push(`Duplicate rights holder: ${Array.from(new Set(dupes)).join(", ")}`);
  if (splits.some((s) => Number(s.percentage) <= 0)) issues.push("Every rights holder needs a share above 0%.");
  let status: SplitSummary["status"];
  if (!splits.length) status = "missing";
  else if (total > 100) {
    status = "over";
    issues.push(`Shares total ${total}% — more than 100%.`);
  } else if (total < 100) {
    status = "under";
    issues.push(`Shares total ${total}% — ${round(100 - total)}% unassigned.`);
  } else if (unconfirmed) status = "unconfirmed";
  else status = "complete";
  if (issues.length && status === "complete") status = "unconfirmed";
  return { total, count: splits.length, unconfirmed, status, issues };
}

export function splitsByType(splits: Split[]) {
  return {
    composition: splits.filter((s) => s.rightType === "composition"),
    master: splits.filter((s) => s.rightType === "master"),
  };
}
