import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

/**
 * Local-disk object storage. Files live outside the web root and are only
 * served through the authenticated /api/files route. The interface (put / get
 * / remove by key) is intentionally small so an S3-compatible adapter can
 * replace it without touching callers.
 */
const ROOT = path.resolve(process.env.STORAGE_DIR ?? "./storage");
export const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_MB ?? 200) * 1024 * 1024;

function resolveKey(key: string) {
  const full = path.resolve(ROOT, key);
  if (!full.startsWith(ROOT + path.sep)) throw new Error("Invalid storage key");
  return full;
}

export function safeFileName(name: string) {
  const base = path.basename(name).replace(/[^\w.\- ()]+/g, "_").slice(0, 150);
  return base || "file";
}

export class UploadTooLargeError extends Error {}

export async function putStream(userId: string, fileName: string, body: ReadableStream<Uint8Array>, maxBytes = MAX_UPLOAD_BYTES) {
  const now = new Date();
  const ext = path.extname(safeFileName(fileName)).toLowerCase().slice(0, 12);
  const key = `${userId}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${randomUUID()}${ext}`;
  const full = resolveKey(key);
  await mkdir(path.dirname(full), { recursive: true });
  const hash = createHash("sha256");
  let size = 0;
  const out = createWriteStream(full, { flags: "wx" });
  try {
    const reader = body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new UploadTooLargeError(`File exceeds the ${Math.round(maxBytes / 1024 / 1024)} MB limit.`);
      }
      hash.update(value);
      if (!out.write(value)) await new Promise((r) => out.once("drain", r));
    }
    await new Promise<void>((resolve, reject) => out.end((err?: Error | null) => (err ? reject(err) : resolve())));
  } catch (err) {
    out.destroy();
    await rm(full, { force: true });
    throw err;
  }
  return { key, size, checksum: hash.digest("hex") };
}

export async function getStream(key: string) {
  const full = resolveKey(key);
  const s = await stat(full);
  return { stream: Readable.toWeb(createReadStream(full)) as ReadableStream<Uint8Array>, size: s.size };
}

export async function removeObject(key: string) {
  await rm(resolveKey(key), { force: true });
}
