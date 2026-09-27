import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { analyticsRecords, integrations } from "../db/schema";
import { todayISO } from "../utils";

export function credentialsPresent(keys: string[]) {
  return keys.every((k) => Boolean(process.env[k]?.trim()));
}

type Metric = { metric: string; value: number; platform: string };

async function spotify(config: Record<string, string>): Promise<Metric[]> {
  const id = config.artistId?.trim();
  if (!id || !/^[A-Za-z0-9]{22}$/.test(id)) throw new Error("Set a valid Spotify artist ID (22 characters).");
  const basic = Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString("base64");
  const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(15_000),
  });
  if (!tokenRes.ok) throw new Error(`Spotify rejected the client credentials (${tokenRes.status}).`);
  const { access_token } = (await tokenRes.json()) as { access_token: string };
  const res = await fetch(`https://api.spotify.com/v1/artists/${id}`, { headers: { Authorization: `Bearer ${access_token}` }, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`Spotify artist request failed (${res.status}).`);
  const data = (await res.json()) as { followers?: { total?: number }; popularity?: number };
  const out: Metric[] = [];
  if (typeof data.followers?.total === "number") out.push({ metric: "followers", value: data.followers.total, platform: "Spotify" });
  if (typeof data.popularity === "number") out.push({ metric: "engagement", value: data.popularity, platform: "Spotify (popularity index)" });
  if (!out.length) throw new Error("Spotify returned no statistics for this artist (fields not available for this app).");
  return out;
}

async function youtube(config: Record<string, string>): Promise<Metric[]> {
  const id = config.channelId?.trim();
  if (!id || !/^UC[\w-]{22}$/.test(id)) throw new Error("Set a valid YouTube channel ID (starts with UC, 24 characters).");
  const url = `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${encodeURIComponent(id)}&key=${encodeURIComponent(process.env.YOUTUBE_API_KEY ?? "")}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`YouTube request failed (${res.status}).`);
  const data = (await res.json()) as { items?: { statistics?: { subscriberCount?: string; viewCount?: string; videoCount?: string; hiddenSubscriberCount?: boolean } }[] };
  const st = data.items?.[0]?.statistics;
  if (!st) throw new Error("Channel not found.");
  const out: Metric[] = [];
  if (st.subscriberCount && !st.hiddenSubscriberCount) out.push({ metric: "followers", value: Number(st.subscriberCount), platform: "YouTube" });
  if (st.viewCount) out.push({ metric: "video_views", value: Number(st.viewCount), platform: "YouTube (lifetime)" });
  return out;
}

const SYNCERS: Record<string, { credentials: string[]; run: (c: Record<string, string>) => Promise<Metric[]> }> = {
  spotify: { credentials: ["SPOTIFY_CLIENT_ID", "SPOTIFY_CLIENT_SECRET"], run: spotify },
  youtube: { credentials: ["YOUTUBE_API_KEY"], run: youtube },
};

/** Sync one integration. Values are stored as verified API data; failures are recorded, never hidden. */
export async function syncIntegration(userId: string, key: string) {
  const syncer = SYNCERS[key];
  if (!syncer) throw new Error("This integration has no API sync.");
  if (!credentialsPresent(syncer.credentials)) throw new Error(`Missing server credentials: ${syncer.credentials.join(", ")}.`);
  const [row] = await db.select().from(integrations).where(and(eq(integrations.userId, userId), eq(integrations.service, key)));
  if (!row?.enabled) throw new Error("Connect the integration first.");
  try {
    const metrics = await syncer.run(row.config);
    const day = todayISO();
    for (const m of metrics) {
      await db.insert(analyticsRecords).values({ userId, metric: m.metric, value: m.value, platform: m.platform, periodEnd: day, source: "api", verification: "verified", notes: `Synced from ${key} API` });
    }
    await db.update(integrations).set({ lastSyncAt: new Date(), lastError: null }).where(eq(integrations.id, row.id));
    return metrics.length;
  } catch (err) {
    await db.update(integrations).set({ lastError: (err as Error).message.slice(0, 300) }).where(eq(integrations.id, row.id));
    throw err;
  }
}
