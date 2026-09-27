import {
  BarChart3,
  Bot,
  Briefcase,
  CalendarDays,
  CheckSquare,
  Clapperboard,
  Coins,
  Database,
  Disc3,
  FileText,
  FolderOpen,
  LayoutDashboard,
  Megaphone,
  Music2,
  Scale,
  Settings,
  Rocket,
  User,
  Users,
  Workflow,
  Zap,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon; match?: string[] };

/** The 19 main sections (plus the Information Center) in sidebar order. */
export const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Command",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/assistant", label: "AI Assistant", icon: Bot },
      { href: "/information", label: "Information Center", icon: Database },
    ],
  },
  {
    label: "Artist",
    items: [
      { href: "/profile", label: "My Artist Profile", icon: User, match: ["/onboarding"] },
      { href: "/business", label: "Business Setup", icon: Briefcase },
      { href: "/workflow", label: "Workflow Phases", icon: Workflow },
    ],
  },
  {
    label: "Music",
    items: [
      { href: "/catalog", label: "Music Catalog", icon: Music2 },
      { href: "/releases", label: "Release Manager", icon: Disc3 },
      { href: "/rights", label: "Rights & Royalties", icon: Scale },
    ],
  },
  {
    label: "Promotion",
    items: [
      { href: "/marketing", label: "Marketing & Promotion", icon: Megaphone },
      { href: "/content", label: "Content Studio", icon: Clapperboard },
      { href: "/planner", label: "Social Media Planner", icon: CalendarDays },
      { href: "/analytics", label: "Audience & Analytics", icon: BarChart3 },
    ],
  },
  {
    label: "Business",
    items: [
      { href: "/finances", label: "Finances", icon: Coins },
      { href: "/contacts", label: "Contacts & Networking", icon: Users },
      { href: "/tasks", label: "Tasks & Projects", icon: CheckSquare },
      { href: "/documents", label: "Documents & Assets", icon: FolderOpen },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/automations", label: "Automations", icon: Zap },
      { href: "/reports", label: "Reports", icon: FileText },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

export const ALL_NAV = NAV_GROUPS.flatMap((g) => g.items);

export const QUICK_ACTIONS = [
  { href: "/catalog/new", label: "New track", icon: Music2 },
  { href: "/releases/new", label: "New release", icon: Rocket },
  { href: "/marketing/new", label: "New campaign", icon: Megaphone },
  { href: "/tasks/new", label: "Add task", icon: CheckSquare },
  { href: "/contacts/new", label: "Add contact", icon: Users },
  { href: "/documents?upload=1", label: "Upload document", icon: FolderOpen },
  { href: "/finances/new?kind=expense", label: "Record expense", icon: Coins },
  { href: "/assistant", label: "Ask the assistant", icon: Bot },
];

