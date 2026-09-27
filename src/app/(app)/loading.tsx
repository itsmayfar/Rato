export default function Loading() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true" aria-label="Loading">
      <div className="h-9 w-72 rounded bg-surface-3" />
      <div className="h-4 w-96 max-w-full rounded bg-surface-2" />
      <div className="grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-36 rounded-lg border border-line bg-surface" />
        ))}
      </div>
      <div className="h-64 rounded-lg border border-line bg-surface" />
    </div>
  );
}
