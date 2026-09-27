"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Bell, ChevronsLeft, ChevronsRight, LogOut, Menu, Plus, Search, X } from "lucide-react";
import { Wordmark } from "@/components/brand";
import { buttonClass } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { ALL_NAV, NAV_GROUPS, QUICK_ACTIONS } from "./nav";

function isActive(pathname: string, href: string, match?: string[]) {
  return pathname === href || pathname.startsWith(`${href}/`) || Boolean(match?.some((m) => pathname.startsWith(m)));
}

function Sidebar({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 pb-6">
      {NAV_GROUPS.map((group) => (
        <div key={group.label} className="mt-5 first:mt-2">
          {!collapsed && <div className="mb-1.5 px-3 text-[10px] uppercase tracking-[0.22em] text-faint">{group.label}</div>}
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = isActive(pathname, item.href, item.match);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                      active ? "bg-surface-3 text-fg" : "text-muted hover:bg-surface-2 hover:text-fg",
                      collapsed && "justify-center px-0",
                    )}
                  >
                    {active && <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-accent-strong" aria-hidden />}
                    <Icon className={cn("h-4 w-4 shrink-0", active ? "text-accent-strong" : "text-faint group-hover:text-muted")} strokeWidth={1.5} />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function QuickActions() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className={buttonClass("primary", "md", "h-9")}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Plus className="h-4 w-4" />
        <span className="hidden sm:inline">Create</span>
      </button>
      {open && (
        <div role="menu" className="animate-fade-in absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-lg border border-line bg-surface py-1 shadow-2xl">
          {QUICK_ACTIONS.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2 text-sm text-muted hover:bg-surface-3 hover:text-fg"
            >
              <a.icon className="h-4 w-4 text-faint" strokeWidth={1.5} />
              {a.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function GlobalSearch() {
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  return (
    <form
      role="search"
      className="relative w-full max-w-md"
      onSubmit={(e) => {
        e.preventDefault();
        const q = ref.current?.value.trim();
        if (q) router.push(`/search?q=${encodeURIComponent(q)}`);
      }}
    >
      <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-faint" />
      <input
        ref={ref}
        type="search"
        name="q"
        aria-label="Search everything"
        placeholder="Search tracks, releases, tasks, contacts…"
        className="h-9 w-full rounded-md border border-line bg-surface-2 pl-9 pr-12 text-sm text-fg placeholder:text-faint focus:border-accent focus:outline-none"
      />
      <kbd className="pointer-events-none absolute right-2 top-2 hidden rounded border border-line px-1.5 text-[10px] text-faint md:block">⌘K</kbd>
    </form>
  );
}

export function AppShell({
  children,
  user,
  unread,
  initialCollapsed,
  logoutAction,
  demoActive,
}: {
  children: ReactNode;
  user: { name: string; email: string };
  unread: number;
  initialCollapsed: boolean;
  logoutAction: () => Promise<void>;
  demoActive: boolean;
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const current = ALL_NAV.find((n) => isActive(pathname, n.href, n.match));

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `mayfar_sidebar=${next ? "collapsed" : "expanded"}; path=/; max-age=31536000; samesite=lax`;
  };

  return (
    <div className="flex min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded focus:bg-accent focus:px-3 focus:py-2">
        Skip to content
      </a>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "no-print sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-line bg-surface transition-[width] duration-200 lg:flex",
          collapsed ? "w-[68px]" : "w-64",
        )}
      >
        <div className={cn("flex h-16 items-center border-b border-line", collapsed ? "justify-center" : "px-5")}>
          <Link href="/dashboard" aria-label="MAYFAR Artist Manager — dashboard">
            <Wordmark collapsed={collapsed} />
          </Link>
        </div>
        <Sidebar collapsed={collapsed} />
        <div className="border-t border-line p-3">
          <button
            type="button"
            onClick={toggle}
            className={buttonClass("ghost", "sm", "w-full justify-center")}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronsRight className="h-4 w-4" /> : (<><ChevronsLeft className="h-4 w-4" /> Collapse</>)}
          </button>
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 bg-black/70" onClick={() => setMobileOpen(false)} />
          <aside className="animate-fade-in absolute inset-y-0 left-0 flex w-72 flex-col border-r border-line bg-surface">
            <div className="flex h-16 items-center justify-between border-b border-line px-5">
              <Wordmark />
              <button type="button" className={buttonClass("ghost", "icon")} onClick={() => setMobileOpen(false)} aria-label="Close navigation">
                <X className="h-4 w-4" />
              </button>
            </div>
            <Sidebar collapsed={false} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-line bg-bg/85 px-4 backdrop-blur md:px-8">
          <button type="button" className={buttonClass("ghost", "icon", "lg:hidden")} onClick={() => setMobileOpen(true)} aria-label="Open navigation">
            <Menu className="h-5 w-5" />
          </button>
          <div className="hidden min-w-0 shrink-0 text-xs uppercase tracking-[0.2em] text-faint xl:block xl:w-48">
            {current?.label ?? ""}
          </div>
          <div className="flex min-w-0 flex-1 justify-center">
            <GlobalSearch />
          </div>
          <div className="flex items-center gap-2">
            <QuickActions />
            <Link href="/notifications" className={buttonClass("ghost", "icon", "relative")} aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}>
              <Bell className="h-4 w-4" />
              {unread > 0 && (
                <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-strong px-1 text-[10px] text-white">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Link>
            <form action={logoutAction}>
              <button type="submit" className={buttonClass("ghost", "icon")} aria-label={`Sign out ${user.email}`} title={`Sign out (${user.email})`}>
                <LogOut className="h-4 w-4" />
              </button>
            </form>
          </div>
        </header>
        {demoActive && (
          <div className="no-print border-b border-sky-500/30 bg-sky-500/10 px-4 py-1.5 text-center text-xs text-sky-300 md:px-8">
            Demo data is loaded and labelled <strong>DEMO</strong>. It is excluded from financial totals.{" "}
            <Link href="/settings/data" className="underline underline-offset-2">
              Remove demo data
            </Link>
          </div>
        )}
        <main id="main" className="print-full mx-auto w-full max-w-[1400px] flex-1 px-4 py-8 md:px-8 md:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
