export type PipelineHealth = {
  is_healthy: boolean | null;
  hours_since_scrape: number | null;
  stuck_unanalyzed: number | null;
};

function WarnIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="mt-0.5 h-4 w-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8 2 1.8 13h12.4L8 2ZM8 6.5v3M8 11.8v.2" />
    </svg>
  );
}

// Self-reliability surfaced to the user: if the scraper hasn't run, say so loudly.
// A green scraper can still hide a dead analyzer (June 2026 incident: runs "succeeded" for a
// month while every tender stalled before analysis) — so a sustained unanalyzed backlog gets
// its own warning. Health data is fetched once in the app layout and shared with the rail dot.
export function HealthBanner({ health }: { health: PipelineHealth | null }) {
  if (!health) return null;

  if (!health.is_healthy) {
    const hours = Math.round(health.hours_since_scrape ?? 0);
    return (
      <div className="flex items-start gap-2.5 border-b border-hot-line bg-hot-soft px-4 py-2.5 text-sm text-hot print:hidden lg:px-8">
        <WarnIcon />
        <p>
          <strong>Pipeline may be stale.</strong> Last successful scrape was{" "}
          {hours}h ago (expected daily). New tenders may be missing; check the
          n8n workflow.
        </p>
      </div>
    );
  }

  if ((health.stuck_unanalyzed ?? 0) >= 10) {
    return (
      <div className="flex items-start gap-2.5 border-b border-warm-line bg-warm-soft px-4 py-2.5 text-sm text-warm print:hidden lg:px-8">
        <WarnIcon />
        <p>
          <strong>Analyzer backlog.</strong> {health.stuck_unanalyzed} tenders
          are scraped but not analyzed. The backlog should clear on the next
          daily run; if it persists, the analysis stage is failing silently
          even though the scraper looks healthy.
        </p>
      </div>
    );
  }

  return null;
}
