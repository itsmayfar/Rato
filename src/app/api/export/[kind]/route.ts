import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { exportBackup } from "@/lib/backup";
import { loadContextUncached } from "@/lib/context";
import { toCSV } from "@/lib/csv";
import { db } from "@/lib/db";
import { analyticsRecords } from "@/lib/db/schema";
import { toBase } from "@/lib/finance";
import { addDays, todayISO } from "@/lib/utils";

const h = (keys: string) => keys.split(",").map((k) => ({ key: k, label: k }));

function ics(events: { uid: string; date: string; title: string; description?: string }[]) {
  const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/[,;]/g, (m) => `\\${m}`).replace(/\n/g, "\\n");
  const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//MAYFAR//Artist Manager//EN", "CALSCALE:GREGORIAN", "X-WR-CALNAME:MAYFAR"];
  for (const e of events) {
    lines.push("BEGIN:VEVENT", `UID:${e.uid}@mayfar`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${e.date.replace(/-/g, "")}`, `DTEND;VALUE=DATE:${addDays(e.date, 1).replace(/-/g, "")}`, `SUMMARY:${esc(e.title)}`);
    if (e.description) lines.push(`DESCRIPTION:${esc(e.description)}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ kind: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const { kind } = await params;
  const ctx = await loadContextUncached(user.id);
  const stamp = todayISO(ctx.settings.timezone);
  const csv = (name: string, body: string) =>
    new NextResponse(body, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="mayfar-${name}-${stamp}.csv"`, "Cache-Control": "no-store" } });

  switch (kind) {
    case "tracks":
      return csv("tracks", toCSV(h("projectCode,title,status,workflowStage,primaryArtist,featuredArtists,genre,subgenre,bpm,musicalKey,mood,language,durationSec,explicit,hasCollaborators,isrc,plannedReleaseDate,actualReleaseDate"), ctx.tracks.filter((t) => !t.isDemo)));
    case "releases":
      return csv("releases", toCSV(h("title,releaseType,status,primaryArtist,featuredArtists,releaseDate,releaseDateConfirmed,distributor,upc,genre,language,explicit,preSaveUrl,smartLinkUrl"), ctx.releases.filter((r) => !r.isDemo)));
    case "tasks":
      return csv("tasks", toCSV(h("title,status,priority,dueDate,startDate,assignee,phaseKey,source,completedAt,description"), ctx.tasks.filter((t) => !t.isDemo)));
    case "contacts":
      return csv("contacts", toCSV(h("name,organization,role,category,pipelineStatus,email,phone,website,location,isTeamMember,lastContactDate,nextFollowUpDate,notes"), ctx.contacts.filter((c) => !c.isDemo)));
    case "campaigns":
      return csv("campaigns", toCSV(h("name,status,objective,startDate,endDate,budget,currency,channels,targetAudience,message,successMetrics,results"), ctx.campaigns.filter((c) => !c.isDemo)));
    case "content":
      return csv("content", toCSV(h("title,platform,format,stage,approvalStatus,plannedDate,plannedTime,caption,hashtags,callToAction,publishedUrl"), ctx.content.filter((c) => !c.isDemo)));
    case "transactions":
      return csv(
        "transactions",
        toCSV(
          h(`date,kind,category,description,amount,currency,baseAmount,fxRate,fxSource,fxDate,nature,paymentStatus,counterparty`),
          ctx.transactions.filter((t) => !t.isDemo).map((t) => ({ ...t, baseAmount: toBase(t, ctx.settings.currency) })),
        ),
      );
    case "analytics": {
      const rows = await db.select().from(analyticsRecords).where(eq(analyticsRecords.userId, user.id));
      return csv("analytics", toCSV(h("metric,value,platform,periodStart,periodEnd,source,verification,notes"), rows.filter((r) => !r.isDemo)));
    }
    case "calendar.ics": {
      const events = [
        ...ctx.releases.filter((r) => r.releaseDate && r.status !== "Archived").map((r) => ({ uid: `release-${r.id}`, date: r.releaseDate!, title: `Release: ${r.title}` })),
        ...ctx.releases.flatMap((r) => r.checklist.filter((c) => c.dueDate && c.status === "pending").map((c) => ({ uid: `check-${c.id}`, date: c.dueDate!, title: `${r.title}: ${c.label}` }))),
        ...ctx.tasks.filter((t) => t.dueDate && !["completed", "cancelled"].includes(t.status)).map((t) => ({ uid: `task-${t.id}`, date: t.dueDate!, title: t.title, description: t.description ?? undefined })),
        ...ctx.content.filter((c) => c.plannedDate && !["Published", "Analyzed", "Archived"].includes(c.stage)).map((c) => ({ uid: `content-${c.id}`, date: c.plannedDate!, title: `Content: ${c.title}` })),
      ];
      return new NextResponse(ics(events), { headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `attachment; filename="mayfar-calendar-${stamp}.ics"` } });
    }
    case "backup.json": {
      const backup = await exportBackup(user.id);
      await audit(user.id, "data.export", "backup", null, "Full JSON backup exported");
      return new NextResponse(JSON.stringify(backup, null, 2), { headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="mayfar-backup-${stamp}.json"`, "Cache-Control": "no-store" } });
    }
    default:
      return NextResponse.json({ error: "Unknown export." }, { status: 404 });
  }
}
