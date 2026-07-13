import { createSupabaseAdmin } from "@/lib/supabase/server";
import { PageHeader, microLabel } from "@/lib/ui";
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
      <PageHeader
        title="Learning"
        sub="The system proposes scoring improvements from real outcomes. You approve what goes live."
        actions={<RunLearningButton />}
      />

      <div className="mt-5 flex divide-x divide-line overflow-hidden rounded-xl border border-line bg-surface">
        {stats.map((s) => (
          <div key={s.label} className="flex-1 px-4 py-3">
            <p className="text-lg font-semibold tabular-nums">{s.value}</p>
            <p className="mt-0.5 text-xs leading-tight text-fg-soft">{s.label}</p>
          </div>
        ))}
      </div>

      <h2 className={`${microLabel} mt-9 border-b border-line pb-1.5`}>
        Suggestions to review ({pendingRows.length})
      </h2>
      <div className="mt-3 space-y-3">
        {pendingRows.map((s) => (
          <SuggestionCard key={s.id} suggestion={s} />
        ))}
        {pendingRows.length === 0 && (
          <div className="rounded-xl border border-dashed border-line-strong px-6 py-9 text-center text-sm leading-relaxed text-fg-soft">
            No suggestions yet. As you mark tenders Won/Lost and Relevant/Not,
            the system finds patterns and proposes scoring changes here. Click
            &ldquo;Run learning&rdquo; once you have a few outcomes recorded.
          </div>
        )}
      </div>

      {(applied.data ?? []).length > 0 && (
        <>
          <h2 className={`${microLabel} mt-9 border-b border-line pb-1.5`}>
            Recently applied
          </h2>
          <div className="mt-3 space-y-2">
            {(applied.data ?? []).map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between gap-4 rounded-lg border border-ok-line bg-ok-soft px-4 py-2.5 text-sm"
              >
                <span className="text-ok">{s.rationale}</span>
                <span className="shrink-0 font-mono text-xs text-ok">
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
