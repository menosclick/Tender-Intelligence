import { createSupabaseAdmin } from "@/lib/supabase/server";
import { SuggestionCard, RunLearningButton } from "./learning-client";

export const dynamic = "force-dynamic";

// The self-improvement control room: review what the system learned, approve or reject.
export default async function LearningPage() {
  const admin = createSupabaseAdmin();

  const [pending, applied, overrides, signal] = await Promise.all([
    admin
      .from("scoring_suggestions")
      .select("*")
      .eq("status", "pending")
      .order("confidence", { ascending: false }),
    admin
      .from("scoring_suggestions")
      .select("*")
      .eq("status", "applied")
      .order("decided_at", { ascending: false })
      .limit(10),
    admin.from("score_overrides").select("*").eq("active", true),
    admin.from("tender_feedback").select("kind,value"),
  ]);

  const fb = signal.data ?? [];
  const wins = fb.filter((f) => f.kind === "outcome" && f.value === "won").length;
  const losses = fb.filter((f) => f.kind === "outcome" && f.value === "lost").length;
  const relevant = fb.filter((f) => f.kind === "relevance" && f.value === "relevant").length;
  const notRelevant = fb.filter((f) => f.kind === "relevance" && f.value === "not_relevant").length;

  const stats = [
    { label: "Bids won", value: wins },
    { label: "Bids lost", value: losses },
    { label: "Marked relevant", value: relevant },
    { label: "Marked not-relevant", value: notRelevant },
    { label: "Active learned rules", value: (overrides.data ?? []).length },
  ];

  const pendingRows = pending.data ?? [];

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold">Learning</h1>
          <p className="mt-1 text-sm text-neutral-500">
            The system proposes scoring improvements from real outcomes. You approve what goes live.
          </p>
        </div>
        <RunLearningButton />
      </div>

      <div className="mt-5 grid grid-cols-5 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-neutral-200 bg-white p-3 shadow-sm">
            <p className="text-xl font-bold tabular-nums">{s.value}</p>
            <p className="mt-0.5 text-[11px] leading-tight text-neutral-500">{s.label}</p>
          </div>
        ))}
      </div>

      <h2 className="mt-8 text-sm font-semibold text-neutral-700">
        Suggestions to review ({pendingRows.length})
      </h2>
      <div className="mt-2 space-y-3">
        {pendingRows.map((s) => (
          <SuggestionCard key={s.id} suggestion={s} />
        ))}
        {pendingRows.length === 0 && (
          <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-400">
            No suggestions yet. As you mark tenders Won/Lost and Relevant/Not, the system finds
            patterns and proposes scoring changes here. Click “Run learning” once you have a few
            outcomes recorded.
          </div>
        )}
      </div>

      {(applied.data ?? []).length > 0 && (
        <>
          <h2 className="mt-8 text-sm font-semibold text-neutral-700">Recently applied</h2>
          <div className="mt-2 space-y-2">
            {(applied.data ?? []).map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm"
              >
                <span className="text-green-800">{s.rationale}</span>
                <span className="font-mono text-xs text-green-700">
                  {s.dimension}/{s.target} {s.suggested_points >= 0 ? "+" : ""}
                  {s.suggested_points}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
