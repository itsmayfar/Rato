import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn("h-7 w-7", className)} aria-hidden="true">
      <path d="M14 46V18l18 18 18-18v28" fill="none" stroke="currentColor" strokeWidth="2.5" />
      <circle cx="32" cy="36" r="3.5" fill="var(--accent-strong)" />
    </svg>
  );
}

export function Wordmark({ collapsed }: { collapsed?: boolean }) {
  return (
    <span className="flex items-center gap-3">
      <BrandMark className="shrink-0 text-fg" />
      {!collapsed && (
        <span className="leading-none">
          <span className="block text-sm font-normal tracking-[0.32em] text-fg">MAYFAR</span>
          <span className="mt-1 block text-[10px] tracking-[0.24em] text-faint">ARTIST MANAGER</span>
        </span>
      )}
    </span>
  );
}
