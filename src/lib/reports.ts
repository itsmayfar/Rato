export const REPORTS = [
  { key: "overview", title: "Artist business overview", description: "Profile completeness, phases, pipeline and priorities.", csv: null },
  { key: "catalog", title: "Music catalog report", description: "Every track with status, metadata completeness and rights.", csv: "tracks" },
  { key: "releases", title: "Release pipeline report", description: "Upcoming and past releases with checklist progress.", csv: "releases" },
  { key: "marketing", title: "Marketing campaign report", description: "Campaigns, budgets, recorded spend and results.", csv: "campaigns" },
  { key: "content", title: "Content calendar report", description: "Planned and published content in the period.", csv: "content" },
  { key: "audience", title: "Audience growth report", description: "Recorded metrics per platform over the period.", csv: "analytics" },
  { key: "finance", title: "Financial report", description: "Monthly or period income, expenses, categories and outstanding payments.", csv: "transactions" },
  { key: "rights", title: "Rights & documentation report", description: "Ownership, splits, agreements and missing documents.", csv: null },
  { key: "tasks", title: "Task completion report", description: "Tasks completed, overdue and open by phase.", csv: "tasks" },
  { key: "quarterly", title: "Quarterly strategy review", description: "Goals, releases, finances and lessons for the quarter.", csv: null },
] as const;
export type ReportKey = (typeof REPORTS)[number]["key"];
