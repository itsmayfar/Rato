/** Domain vocabularies. Status lists can be extended per user (Settings → Workflow). */

export const DEFAULT_BRAND = {
  artistName: "MayFar",
  brandConcept: "Dark Emotion",
  brandPhrase: "Sound becomes feeling.",
  visualIdentity: "Black, red and white",
} as const;

export const CAREER_STAGES = ["Emerging", "Developing", "Established", "Professional", "Veteran"] as const;

export const GENRES = [
  "Melodic Techno",
  "Techno",
  "Progressive House",
  "Deep House",
  "Afro House",
  "Organic House",
  "Indie Dance",
  "Tech House",
  "House",
  "Trance",
  "Downtempo",
  "Ambient",
  "Electronica",
  "Drum & Bass",
  "Dubstep",
  "Synthwave",
  "Pop",
  "Other",
];

export const TRACK_STATUSES = [
  "Idea",
  "Demo",
  "In production",
  "Arrangement",
  "Recording",
  "Mixing",
  "Mastering",
  "Review",
  "Finished",
  "Archived",
];

/** Default visual track workflow (customisable in Settings). */
export const TRACK_WORKFLOW = [
  "Idea",
  "Production",
  "Recording",
  "Mixing",
  "Mastering",
  "Rights Review",
  "Release Preparation",
  "Marketing",
  "Release",
  "Performance Review",
];

export const VERSION_KINDS = [
  { value: "demo", label: "Demo" },
  { value: "project", label: "Project file" },
  { value: "stems", label: "Stems" },
  { value: "vocals", label: "Vocal recording" },
  { value: "instrumental", label: "Instrumental" },
  { value: "mix", label: "Mix" },
  { value: "master", label: "Master" },
  { value: "artwork", label: "Cover artwork" },
  { value: "clip", label: "Promotional clip" },
  { value: "video", label: "Music video" },
  { value: "reference", label: "Reference" },
];

export const COLLABORATOR_ROLES = [
  "Producer",
  "Co-producer",
  "Songwriter",
  "Lyricist",
  "Composer",
  "Vocalist",
  "Featured artist",
  "Musician",
  "Mix engineer",
  "Mastering engineer",
  "Remixer",
];

export const MUSICAL_KEYS = [
  "C major", "C minor", "C# major", "C# minor", "D major", "D minor", "D# major", "D# minor",
  "E major", "E minor", "F major", "F minor", "F# major", "F# minor", "G major", "G minor",
  "G# major", "G# minor", "A major", "A minor", "A# major", "A# minor", "B major", "B minor",
];

export const RELEASE_TYPES = [
  { value: "single", label: "Single" },
  { value: "ep", label: "EP" },
  { value: "album", label: "Album" },
  { value: "remix", label: "Remix" },
  { value: "compilation", label: "Compilation" },
];

export const RELEASE_STATUSES = [
  "Planning",
  "In preparation",
  "Awaiting information",
  "Ready for submission",
  "Submitted",
  "Scheduled",
  "Released",
  "Post-release review",
  "Archived",
];

export const DISTRIBUTORS = [
  "DistroKid",
  "TuneCore",
  "CD Baby",
  "Amuse",
  "Ditto",
  "LANDR",
  "UnitedMasters",
  "AWAL",
  "Label Worx",
  "FUGA",
  "Believe",
  "Label (via label)",
];

export const TASK_STATUSES = [
  { value: "backlog", label: "Backlog" },
  { value: "planned", label: "Planned" },
  { value: "in_progress", label: "In progress" },
  { value: "waiting_info", label: "Waiting for information" },
  { value: "waiting_approval", label: "Waiting for approval" },
  { value: "blocked", label: "Blocked" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];
export const OPEN_TASK_STATUSES = ["backlog", "planned", "in_progress", "waiting_info", "waiting_approval", "blocked"];

export const PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];
export const PRIORITY_RANK: Record<string, number> = { urgent: 4, high: 3, medium: 2, low: 1 };

export const CAMPAIGN_OBJECTIVES = [
  "Increase awareness",
  "Increase profile visits",
  "Increase streaming activity",
  "Increase followers",
  "Promote a release",
  "Build an audience",
  "Generate merchandise sales",
];

export const CAMPAIGN_STATUSES = ["Planning", "Ready", "Active", "Paused", "Completed", "Archived"];

export const CAMPAIGN_TEMPLATES = [
  { value: "pre_release", label: "Pre-release promotion" },
  { value: "release_week", label: "Release week" },
  { value: "post_release", label: "Post-release promotion" },
  { value: "music_video", label: "Music video promotion" },
  { value: "audience_growth", label: "Audience growth" },
  { value: "merch", label: "Merchandise promotion" },
  { value: "branding", label: "Artist branding" },
];

export const CHANNELS = [
  "Instagram",
  "TikTok",
  "YouTube",
  "Spotify",
  "SoundCloud",
  "Facebook",
  "Email newsletter",
  "Playlist pitching",
  "Press / blogs",
  "DJ promo",
  "Paid ads",
  "Website",
];

export const PLATFORMS = [
  "Spotify",
  "Apple Music",
  "YouTube",
  "YouTube Music",
  "SoundCloud",
  "Beatport",
  "Instagram",
  "TikTok",
  "Facebook",
  "Bandcamp",
  "X / Twitter",
  "Website",
];

export const CONTENT_PLATFORMS = ["Instagram", "TikTok", "YouTube", "YouTube Shorts", "Spotify", "Facebook", "SoundCloud", "Website", "Email"];

export const CONTENT_FORMATS = [
  "Short-form video",
  "Instagram Reel",
  "TikTok video",
  "YouTube Short",
  "YouTube video",
  "Spotify Canvas",
  "Cover artwork",
  "Teaser clip",
  "Behind the scenes",
  "Studio video",
  "Release announcement",
  "Promotional graphic",
  "Carousel",
  "Story",
  "Live stream",
];

/** Content production pipeline (customisable). */
export const CONTENT_STAGES = [
  "Idea",
  "Script",
  "Asset Creation",
  "Editing",
  "Review",
  "Approved",
  "Scheduled",
  "Published",
  "Analyzed",
  "Archived",
];

export const CONTACT_CATEGORIES = [
  "Producer",
  "Vocalist",
  "Songwriter",
  "DJ",
  "Label",
  "Manager",
  "Booking agent",
  "Playlist curator",
  "Music blog",
  "Promoter",
  "Venue",
  "Publisher",
  "Designer",
  "Video editor",
  "Mix engineer",
  "Mastering engineer",
  "PR",
  "Business partner",
  "Other",
];

export const PIPELINE_STATUSES = [
  { value: "potential", label: "Potential contact" },
  { value: "researching", label: "Researching" },
  { value: "ready", label: "Ready to contact" },
  { value: "contacted", label: "Contacted" },
  { value: "waiting", label: "Waiting for reply" },
  { value: "follow_up", label: "Follow-up required" },
  { value: "discussion", label: "In discussion" },
  { value: "confirmed", label: "Opportunity confirmed" },
  { value: "closed", label: "Closed" },
  { value: "archived", label: "Archived" },
];

export const OUTREACH_KINDS = [
  { value: "collaboration", label: "Collaboration request" },
  { value: "dj_promo", label: "DJ promotion" },
  { value: "booking", label: "Booking inquiry" },
  { value: "label_submission", label: "Label submission" },
  { value: "playlist", label: "Playlist pitch" },
  { value: "press", label: "Press / blog pitch" },
  { value: "follow_up", label: "Follow-up" },
  { value: "partnership", label: "Partnership proposal" },
  { value: "other", label: "Other" },
];

export const INCOME_CATEGORIES = [
  "Streaming royalties",
  "Publishing royalties",
  "Performance fees",
  "Merchandise",
  "Licensing",
  "Production services",
  "Sponsorships",
  "Other income",
];

export const EXPENSE_CATEGORIES = [
  "Advertising",
  "Distribution",
  "Software",
  "Equipment",
  "Music production",
  "Mixing and mastering",
  "Artwork",
  "Video production",
  "Travel",
  "Legal services",
  "Accounting",
  "Other business expenses",
];

export const PAYMENT_STATUSES = [
  { value: "paid", label: "Paid / received" },
  { value: "pending", label: "Pending" },
  { value: "overdue", label: "Overdue" },
  { value: "cancelled", label: "Cancelled" },
];

export const TX_NATURES = [
  { value: "actual", label: "Actual" },
  { value: "estimated", label: "Estimated" },
  { value: "forecast", label: "Forecast" },
];

export const DOCUMENT_CATEGORIES = [
  { value: "contract", label: "Contract" },
  { value: "split_sheet", label: "Split sheet" },
  { value: "license", label: "License" },
  { value: "invoice", label: "Invoice" },
  { value: "receipt", label: "Receipt" },
  { value: "artwork", label: "Artwork" },
  { value: "audio", label: "Audio" },
  { value: "lyrics", label: "Lyrics" },
  { value: "marketing", label: "Marketing asset" },
  { value: "report", label: "Report" },
  { value: "business", label: "Business document" },
  { value: "other", label: "Other" },
];

export const METRICS = [
  { value: "monthly_listeners", label: "Monthly listeners" },
  { value: "streams", label: "Streams" },
  { value: "followers", label: "Followers" },
  { value: "saves", label: "Saves" },
  { value: "playlist_adds", label: "Playlist adds" },
  { value: "profile_visits", label: "Profile visits" },
  { value: "reach", label: "Social reach" },
  { value: "engagement", label: "Engagement" },
  { value: "video_views", label: "Video views" },
  { value: "ctr", label: "Click-through rate (%)" },
  { value: "ad_spend", label: "Advertising spend" },
  { value: "conversions", label: "Campaign conversions" },
  { value: "revenue", label: "Revenue" },
];

export const VERIFICATION = [
  { value: "verified", label: "Verified (official source)" },
  { value: "manual", label: "Manually entered" },
  { value: "estimated", label: "Estimated" },
];

export const RIGHTS_STATUS_OPTIONS = {
  samplesUsed: [
    { value: "unknown", label: "Unknown" },
    { value: "none", label: "No samples" },
    { value: "yes", label: "Uses samples" },
  ],
  sampleLicenseStatus: [
    { value: "not_needed", label: "Not needed" },
    { value: "missing", label: "Missing" },
    { value: "requested", label: "Requested" },
    { value: "cleared", label: "Cleared (licence on file)" },
  ],
  agreementStatus: [
    { value: "unknown", label: "Unknown" },
    { value: "not_needed", label: "Not needed (solo work)" },
    { value: "draft", label: "Draft" },
    { value: "sent", label: "Sent for signature" },
    { value: "signed", label: "Signed" },
  ],
  registration: [
    { value: "not_started", label: "Not started" },
    { value: "in_progress", label: "In progress" },
    { value: "registered", label: "Registered (confirmed)" },
    { value: "not_applicable", label: "Not applicable" },
  ],
};

export const REVIEW_PERIODS = [
  { key: "24h", label: "First 24 hours", days: 1 },
  { key: "7d", label: "First 7 days", days: 7 },
  { key: "30d", label: "First 30 days", days: 30 },
  { key: "90d", label: "First 90 days", days: 90 },
];

export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
