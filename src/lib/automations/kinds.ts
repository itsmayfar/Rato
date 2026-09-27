/** Supported automation kinds. All built-in actions have internal effects only (notifications, tasks). */
export const AUTOMATION_KINDS = {
  deadline_reminders: {
    label: "Deadline reminders",
    description: "Notify about tasks, checklist steps and content due within the next few days.",
    defaultSchedule: "daily",
    conditions: { daysAhead: 3 },
  },
  overdue_tasks: {
    label: "Overdue task notifications",
    description: "Notify when open tasks pass their due date.",
    defaultSchedule: "daily",
    conditions: {},
  },
  missing_info: {
    label: "Missing information alerts",
    description: "Alert when upcoming releases or campaigns are missing required information, and create a task to collect it.",
    defaultSchedule: "daily",
    conditions: { withinDays: 45 },
  },
  weekly_summary: {
    label: "Weekly business summary",
    description: "A summary of the week ahead: priorities, deadlines, releases and open blockers.",
    defaultSchedule: "weekly",
    conditions: {},
  },
  monthly_finance: {
    label: "Monthly financial summary",
    description: "Income, expenses and pending payments of the previous month (actual records only).",
    defaultSchedule: "monthly",
    conditions: {},
  },
  release_prep: {
    label: "Release preparation reminders",
    description: "Remind about release checklist steps as the release date approaches and schedule the release-day checklist.",
    defaultSchedule: "daily",
    conditions: {},
  },
  content_reminders: {
    label: "Content publication reminders",
    description: "Remind about scheduled content and content still awaiting approval.",
    defaultSchedule: "daily",
    conditions: { daysAhead: 1 },
  },
  campaign_review: {
    label: "Campaign review reminders",
    description: "Remind to review campaigns after they end, and release reviews when due.",
    defaultSchedule: "daily",
    conditions: {},
  },
  recurring_tasks: {
    label: "Recurring tasks",
    description: "Create the next occurrence of completed recurring tasks (weekly / monthly / quarterly).",
    defaultSchedule: "daily",
    conditions: {},
  },
  follow_up_reminders: {
    label: "Follow-up reminders",
    description: "Remind about contacts whose follow-up date has arrived.",
    defaultSchedule: "daily",
    conditions: {},
  },
} as const;

export type AutomationKind = keyof typeof AUTOMATION_KINDS;
