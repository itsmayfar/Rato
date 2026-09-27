import { NextResponse, type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { getStream } from "@/lib/storage";

// Types that are safe to display inline; everything else is downloaded.
const INLINE = /^(image\/(png|jpeg|gif|webp|avif)|audio\/[\w.+-]+|video\/(mp4|webm|quicktime)|application\/pdf)$/;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const [doc] = await db.select().from(documents).where(and(eq(documents.id, id), eq(documents.userId, user.id)));
  if (!doc || !doc.storageKey) return NextResponse.json({ error: "Not found." }, { status: 404 });
  try {
    const { stream, size } = await getStream(doc.storageKey);
    const type = doc.mimeType ?? "application/octet-stream";
    const inline = INLINE.test(type) && req.nextUrl.searchParams.get("download") !== "1";
    const name = encodeURIComponent(doc.fileName ?? "file");
    return new NextResponse(stream, {
      headers: {
        "Content-Type": inline ? type : "application/octet-stream",
        "Content-Length": String(size),
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${name}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'; sandbox",
      },
    });
  } catch {
    return NextResponse.json({ error: "The file is missing from storage." }, { status: 410 });
  }
}
