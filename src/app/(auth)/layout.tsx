import { Wordmark } from "@/components/brand";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/3 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-30 blur-3xl"
        style={{ background: "radial-gradient(circle, var(--accent) 0%, transparent 65%)" }}
      />
      <div className="relative w-full max-w-sm">
        <div className="mb-10 flex flex-col items-center gap-4 text-center">
          <Wordmark />
          <p className="text-xs tracking-[0.3em] text-muted">SOUND BECOMES FEELING.</p>
        </div>
        <div className="rounded-lg border border-line bg-surface/90 p-6 backdrop-blur">{children}</div>
      </div>
    </main>
  );
}
