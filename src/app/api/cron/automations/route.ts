import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { runAutomations } from "@/lib/automations/engine";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

/** Scheduler endpoint: POST with `Authorization: Bearer $CRON_SECRET`. Runs due rules for every user. */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 503 });
  const given = Buffer.from(req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "");
  const expected = Buffer.from(secret);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const all = await db.select({ id: users.id }).from(users);
  const summary: { userId: string; ran: number; errors: number }[] = [];
  for (const u of all) {
    const results = await runAutomations(u.id);
    summary.push({ userId: u.id, ran: results.length, errors: results.filter((r) => r.result === "error").length });
  }
  return NextResponse.json({ ok: true, users: summary.length, runs: summary.reduce((s, x) => s + x.ran, 0), errors: summary.reduce((s, x) => s + x.errors, 0) });
}
