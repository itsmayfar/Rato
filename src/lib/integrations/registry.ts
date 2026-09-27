/** Integrations center definitions (no secrets here — credentials live in env vars). */
export type IntegrationDef = {
  key: string;
  name: string;
  purpose: string;
  permissions: string;
  credentials: string[];
  capabilities: string[];
  configFields: { key: string; label: string; help?: string }[];
  /** "api" = implemented official API sync; "manual" = no usable official API, manual workflow provided. */
  mode: "api" | "manual";
  manual: { label: string; href: string };
};

export const INTEGRATIONS: IntegrationDef[] = [
  {
    key: "spotify",
    name: "Spotify Web API",
    purpose: "Public artist statistics (followers, popularity) recorded as verified metrics.",
    permissions: "Client-credentials access to public catalog data only. No account access.",
    credentials: ["SPOTIFY_CLIENT_ID", "SPOTIFY_CLIENT_SECRET"],
    capabilities: ["Artist followers", "Artist popularity (0–100)"],
    configFields: [{ key: "artistId", label: "Spotify artist ID", help: "From your artist URL: open.spotify.com/artist/<ID>" }],
    mode: "api",
    manual: { label: "Enter monthly listeners manually", href: "/analytics?add=1" },
  },
  {
    key: "youtube",
    name: "YouTube Data API",
    purpose: "Public channel statistics (subscribers, total views, video count).",
    permissions: "API key access to public channel statistics.",
    credentials: ["YOUTUBE_API_KEY"],
    capabilities: ["Subscribers", "Total channel views", "Video count"],
    configFields: [{ key: "channelId", label: "YouTube channel ID", help: "Starts with UC… (YouTube Studio → Settings → Channel → Advanced)" }],
    mode: "api",
    manual: { label: "Enter metrics manually", href: "/analytics?add=1" },
  },
  {
    key: "spotify_for_artists",
    name: "Spotify for Artists",
    purpose: "Streams, listeners, saves and playlist data.",
    permissions: "No public API is offered for Spotify for Artists data.",
    credentials: [],
    capabilities: ["Manual entry", "CSV import of exported data"],
    configFields: [],
    mode: "manual",
    manual: { label: "Import CSV export", href: "/import/analytics" },
  },
  {
    key: "instagram",
    name: "Instagram",
    purpose: "Reach, engagement and follower counts.",
    permissions: "Requires a Meta business app review for the Graph API; not connected in this installation.",
    credentials: [],
    capabilities: ["Manual entry", "CSV import"],
    configFields: [],
    mode: "manual",
    manual: { label: "Record metrics", href: "/analytics?add=1" },
  },
  {
    key: "tiktok",
    name: "TikTok",
    purpose: "Video views and follower growth.",
    permissions: "Requires TikTok developer approval; not connected in this installation.",
    credentials: [],
    capabilities: ["Manual entry", "CSV import"],
    configFields: [],
    mode: "manual",
    manual: { label: "Record metrics", href: "/analytics?add=1" },
  },
  {
    key: "distributor",
    name: "Music distributor",
    purpose: "Royalty statements and release delivery status.",
    permissions: "Distributors (DistroKid, TuneCore, CD Baby…) do not offer public APIs for artists.",
    credentials: [],
    capabilities: ["Import royalty statements as CSV", "Confirm submissions in the release checklist"],
    configFields: [],
    mode: "manual",
    manual: { label: "Import royalty CSV", href: "/import/transactions" },
  },
  {
    key: "calendar",
    name: "Google / Apple Calendar",
    purpose: "Release dates, deadlines, tasks and content in your calendar.",
    permissions: "One-way export file (.ics) — no account access required.",
    credentials: [],
    capabilities: ["Download an .ics file and import it into any calendar"],
    configFields: [],
    mode: "manual",
    manual: { label: "Download calendar (.ics)", href: "/api/export/calendar.ics" },
  },
  {
    key: "email",
    name: "Email",
    purpose: "Outreach and follow-ups.",
    permissions: "Messages are never sent by the app. Drafts open in your own email client.",
    credentials: [],
    capabilities: ["Open drafts in your email app (mailto)", "Log sent messages"],
    configFields: [],
    mode: "manual",
    manual: { label: "Contacts & outreach", href: "/contacts" },
  },
  {
    key: "cloud_storage",
    name: "Cloud storage",
    purpose: "Large project files and stems stored elsewhere.",
    permissions: "Store share links on documents and track versions.",
    credentials: [],
    capabilities: ["Link documents to Dropbox / Google Drive / WeTransfer URLs"],
    configFields: [],
    mode: "manual",
    manual: { label: "Documents & Assets", href: "/documents" },
  },
];

export function getIntegration(key: string) {
  return INTEGRATIONS.find((i) => i.key === key);
}
