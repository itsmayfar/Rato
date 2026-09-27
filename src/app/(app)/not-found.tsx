import { LinkButton } from "@/components/ui/primitives";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg py-20 text-center">
      <p className="text-xs uppercase tracking-[0.3em] text-accent-strong">404</p>
      <h1 className="mt-3 text-2xl font-extralight">This record doesn’t exist</h1>
      <p className="mt-2 text-sm text-muted">It may have been deleted, or it belongs to another account.</p>
      <LinkButton href="/dashboard" variant="primary" className="mt-6">
        Back to dashboard
      </LinkButton>
    </div>
  );
}
