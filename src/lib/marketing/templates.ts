/**
 * Customisable campaign plan templates. Offsets are days relative to the
 * anchor date: the release date when a release is linked, otherwise the
 * campaign start date. Templates only create tasks — nothing is published.
 */
export type PlanStep = { key: string; title: string; offset: number; phase: "marketing" | "content" | "execution" | "growth"; content?: { platform: string; format: string } };

export const CAMPAIGN_PLANS: Record<string, { label: string; anchor: "release" | "start"; steps: PlanStep[] }> = {
  pre_release: {
    label: "Pre-release promotion",
    anchor: "release",
    steps: [
      { key: "story", title: "Define the campaign story and key visual", offset: -28, phase: "marketing" },
      { key: "announce", title: "Announce the release date", offset: -21, phase: "content", content: { platform: "Instagram", format: "Release announcement" } },
      { key: "presave", title: "Share the pre-save link", offset: -14, phase: "content", content: { platform: "Instagram", format: "Story" } },
      { key: "teaser1", title: "Publish teaser clip #1", offset: -10, phase: "content", content: { platform: "TikTok", format: "Teaser clip" } },
      { key: "bts", title: "Behind-the-scenes studio clip", offset: -7, phase: "content", content: { platform: "Instagram", format: "Behind the scenes" } },
      { key: "teaser2", title: "Publish teaser clip #2", offset: -3, phase: "content", content: { platform: "YouTube Shorts", format: "YouTube Short" } },
      { key: "playlists", title: "Prepare playlist curator shortlist", offset: -14, phase: "marketing" },
      { key: "djpromo", title: "Prepare DJ promo list", offset: -14, phase: "marketing" },
    ],
  },
  release_week: {
    label: "Release week",
    anchor: "release",
    steps: [
      { key: "out-now", title: "“Out now” announcement", offset: 0, phase: "content", content: { platform: "Instagram", format: "Instagram Reel" } },
      { key: "canvas", title: "Upload Spotify Canvas", offset: -2, phase: "content", content: { platform: "Spotify", format: "Spotify Canvas" } },
      { key: "stories", title: "Daily stories with the track", offset: 1, phase: "content", content: { platform: "Instagram", format: "Story" } },
      { key: "curators", title: "Send playlist pitches to independent curators", offset: 1, phase: "marketing" },
      { key: "thanks", title: "Thank supporters and reshare features", offset: 4, phase: "content" },
    ],
  },
  post_release: {
    label: "Post-release promotion",
    anchor: "release",
    steps: [
      { key: "review7", title: "Review 7-day results and adjust", offset: 7, phase: "growth" },
      { key: "live", title: "Live / DJ clip featuring the track", offset: 10, phase: "content", content: { platform: "TikTok", format: "Short-form video" } },
      { key: "remix", title: "Consider remix or edit opportunities", offset: 21, phase: "growth" },
      { key: "review30", title: "Review 30-day results", offset: 30, phase: "growth" },
    ],
  },
  music_video: {
    label: "Music video promotion",
    anchor: "start",
    steps: [
      { key: "premiere", title: "Schedule YouTube premiere", offset: 0, phase: "content", content: { platform: "YouTube", format: "YouTube video" } },
      { key: "cutdowns", title: "Create vertical cut-downs", offset: 2, phase: "content", content: { platform: "Instagram", format: "Instagram Reel" } },
      { key: "outreach", title: "Pitch the video to blogs", offset: 3, phase: "marketing" },
    ],
  },
  audience_growth: {
    label: "Audience growth",
    anchor: "start",
    steps: [
      { key: "pillars", title: "Define 3 content pillars", offset: 0, phase: "marketing" },
      { key: "weekly", title: "Plan a weekly posting rhythm", offset: 2, phase: "content" },
      { key: "collab", title: "Reach out for one collaboration", offset: 7, phase: "marketing" },
      { key: "review", title: "Review follower growth", offset: 28, phase: "growth" },
    ],
  },
  merch: {
    label: "Merchandise promotion",
    anchor: "start",
    steps: [
      { key: "product", title: "Photograph the products", offset: 0, phase: "content" },
      { key: "launch", title: "Launch post", offset: 7, phase: "content", content: { platform: "Instagram", format: "Carousel" } },
      { key: "email", title: "Email announcement to fans", offset: 7, phase: "marketing" },
    ],
  },
  branding: {
    label: "Artist branding",
    anchor: "start",
    steps: [
      { key: "shoot", title: "Plan a press photo shoot", offset: 0, phase: "marketing" },
      { key: "bio", title: "Refresh bio and press kit", offset: 7, phase: "marketing" },
      { key: "visual", title: "Update visual identity across profiles", offset: 14, phase: "content" },
    ],
  },
};
