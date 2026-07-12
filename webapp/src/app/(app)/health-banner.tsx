import { createSupabaseAdmin } from "@/lib/supabase/server";

// Self-reliability surfaced to the user: if the scraper hasn't run, say so loudly.
// A green scraper can still hide a dead analyzer (June 2026 incident: runs "succeeded" for a
// month while every tender stalled before analysis) — so a sustained unanalyzed backlog gets
// its own warning.
export async function HealthBanner() {
  const admin = createSupabaseAdmin();
  const { data } = await admin.from("v_pipeline_health").select("*").single();
  if (!data) return null;

  if (!data.is_healthy) {
    const hours = Math.round(data.hours_since_scrape ?? 0);
    return (
      <div className="border-b border-red-200 bg-red-50 px-6 py-2 text-sm text-red-800">
        ⚠️ <strong>Pipeline may be stale.</strong> Last successful scrape was {hours}h ago (expected
        daily). New tenders may be missing — check the n8n workflow.
      </div>
    );
  }

  if ((data.stuck_unanalyzed ?? 0) >= 10) {
    return (
      <div className="border-b border-amber-200 bg-amber-50 px-6 py-2 text-sm text-amber-800">
        ⚠️ <strong>Analyzer backlog.</strong> {data.stuck_unanalyzed} tenders are scraped but not
        analyzed. The backlog should clear on the next daily run — if it persists, the analysis
        stage is failing silently even though the scraper looks healthy.
      </div>
    );
  }

  return null;
}
