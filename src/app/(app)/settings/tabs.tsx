"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/settings", label: "General & workflow" },
  { href: "/settings/integrations", label: "Integrations" },
  { href: "/settings/ai", label: "AI" },
  { href: "/settings/data", label: "Data & backup" },
  { href: "/settings/security", label: "Security" },
];

export function SettingsTabs() {
  const path = usePathname();
  return (
    <nav className="no-print mb-8 flex gap-1 overflow-x-auto border-b border-line" aria-label="Settings sections">
      {TABS.map((t) => (
        <Link key={t.href} href={t.href} aria-current={path === t.href ? "page" : undefined} className={cn("-mb-px whitespace-nowrap border-b px-3 py-2 text-sm", path === t.href ? "border-accent-strong text-fg" : "border-transparent text-muted hover:text-fg")}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
