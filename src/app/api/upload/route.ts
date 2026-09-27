import { NextResponse, type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { campaigns, contacts, documents, releases, tracks } from "@/lib/db/schema";
import { DOCUMENT_CATEGORIES } from "@/lib/constants";
import { MAX_UPLOAD_BYTES, UploadTooLargeError, putStream, safeFileName } from "@/lib/storage";

const CATEGORY_VALUES = new Set(DOCUMENT_CATEGORIES.map((c) => c.value));

async function owns(table: typeof tracks | typeof releases | typeof campaigns | typeof contacts, userId: string, id: string | null) {
  if (!id) return true;
  const [row] = await db.select({ id: table.id }).from(table).where(and(eq(table.id, id), eq(table.userId, userId)));
  return Boolean(row);
}

/**
 * Streaming upload: the raw file is the request body; metadata comes in the
 * query string. Creates a document record owned by the current user.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!req.body) return NextResponse.json({ error: "No file received." }, { status: 400 });
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_UPLOAD_BYTES) return NextResponse.json({ error: "File is too large." }, { status: 413 });

  const q = req.nextUrl.searchParams;
  const fileName = safeFileName(q.get("name") ?? "file");
  const category = CATEGORY_VALUES.has(q.get("category") ?? "") ? q.get("category")! : "other";
  const trackId = q.get("trackId") || null;
  const releaseId = q.get("releaseId") || null;
  const campaignId = q.get("campaignId") || null;
  const contactId = q.get("contactId") || null;
  const replaces = q.get("replaces") || null;
  const sensitive = q.get("sensitive") === "1";

  if (!(await owns(tracks, user.id, trackId)) || !(await owns(releases, user.id, releaseId)) || !(await owns(campaigns, user.id, campaignId)) || !(await owns(contacts, user.id, contactId))) {
    return NextResponse.json({ error: "Linked record not found." }, { status: 404 });
  }
  let previous: typeof documents.$inferSelect | undefined;
  if (replaces) {
    [previous] = await db.select().from(documents).where(and(eq(documents.id, replaces), eq(documents.userId, user.id)));
    if (!previous) return NextResponse.json({ error: "Document to replace not found." }, { status: 404 });
  }

  try {
    const stored = await putStream(user.id, fileName, req.body);
    const mimeType = (req.headers.get("content-type") ?? "application/octet-stream").split(";")[0].slice(0, 100);
    const [doc] = await db
      .insert(documents)
      .values({
        userId: user.id,
        title: previous?.title ?? (q.get("title")?.slice(0, 200) || fileName),
        category: previous?.category ?? category,
        tags: previous?.tags ?? [],
        storageKey: stored.key,
        fileName,
        mimeType,
        sizeBytes: stored.size,
        checksum: stored.checksum,
        version: previous ? previous.version + 1 : 1,
        previousVersionId: previous?.id ?? null,
        sensitive: previous?.sensitive ?? sensitive,
        trackId: previous?.trackId ?? trackId,
        releaseId: previous?.releaseId ?? releaseId,
        campaignId: previous?.campaignId ?? campaignId,
        contactId: previous?.contactId ?? contactId,
      })
      .returning({ id: documents.id, title: documents.title, version: documents.version });
    if (previous) await db.update(documents).set({ isLatest: false }).where(eq(documents.id, previous.id));
    await audit(user.id, "document.upload", "document", doc.id, `${doc.title} (v${doc.version}, ${stored.size} bytes)`);
    return NextResponse.json({ id: doc.id, title: doc.title, version: doc.version, size: stored.size });
  } catch (err) {
    if (err instanceof UploadTooLargeError) return NextResponse.json({ error: err.message }, { status: 413 });
    console.error("upload failed", (err as Error).message);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }
}
