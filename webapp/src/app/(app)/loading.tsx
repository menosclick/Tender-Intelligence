// Every screen is force-dynamic and reads Supabase on each request, so a
// navigation always costs a round trip. This is the shape of what's coming —
// header, metric strip, table — not a spinner: the page doesn't appear to jump
// when the real content lands. Pulse is suppressed under prefers-reduced-motion
// by the global rule in globals.css.
function Bar({ className = "" }: { className?: string }) {
  return <div className={`rounded bg-sunken ${className}`} />;
}

export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl animate-pulse" aria-hidden="true">
      <Bar className="h-6 w-64" />
      <Bar className="mt-2.5 h-4 w-96 max-w-full" />

      <div className="mt-5 flex flex-col divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface sm:flex-row sm:divide-x sm:divide-y-0">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex-1 px-5 py-4">
            <Bar className="h-3 w-24" />
            <Bar className="mt-2 h-7 w-12" />
            <Bar className="mt-2 h-3 w-28" />
          </div>
        ))}
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-line bg-surface">
        <div className="border-b border-line px-4 py-3">
          <Bar className="h-3 w-32" />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-line/60 px-4 py-3.5 last:border-0"
          >
            <Bar className="h-4 flex-1" />
            <Bar className="hidden h-4 w-32 sm:block" />
            <Bar className="h-4 w-16" />
            <Bar className="hidden h-4 w-24 sm:block" />
          </div>
        ))}
      </div>

      <span className="sr-only" aria-live="polite">
        Loading…
      </span>
    </div>
  );
}
