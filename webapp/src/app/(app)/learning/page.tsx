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
    admin.from("tender_feedback").select("kind,value,tender_id"),
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

  // Progress toward the first suggestion, mirroring generate_scoring_suggestions():
  // ≥3 won/lost per buyer type or CPV, or ≥3 relevance marks per buyer type.
  // Without this the page reads as broken ("11 feedbacks, 0 suggestions").
  const MIN_SIGNALS = 3;
  const fbIds = [...new Set(fb.map((f) => f.tender_id))];
  const { data: fbTenders } = fbIds.length
    ? await admin
        .from("tenders_scraped")
        .select("id,buyer_type_detected,cpv_main")
        .in("id", fbIds)
    : { data: [] as { id: number; buyer_type_detected: string | null; cpv_main: string | null }[] };
  const attr = new Map((fbTenders ?? []).map((t) => [t.id, t]));
  const groups = new Map<string, number>();
  for (const f of fb) {
    const t = attr.get(f.tender_id);
    if (!t) continue;
    if (f.kind === "outcome" && (f.value === "won" || f.value === "lost")) {
      if (t.buyer_type_detected)
        groups.set(`Won/Lost outcomes on “${t.buyer_type_detected}” buyers`,
          (groups.get(`Won/Lost outcomes on “${t.buyer_type_detected}” buyers`) ?? 0) + 1);
      if (t.cpv_main)
        groups.set(`Won/Lost outcomes on CPV ${t.cpv_main}`,
          (groups.get(`Won/Lost outcomes on CPV ${t.cpv_main}`) ?? 0) + 1);
    }
    if (f.kind === "relevance" && t.buyer_type_detected) {
      groups.set(`Relevance marks on “${t.buyer_type_detected}” buyers`,
        (groups.get(`Relevance marks on “${t.buyer_type_detected}” buyers`) ?? 0) + 1);
    }
  }
  // Only groups still below the threshold — a "3 of 3" with no suggestion
  // (possible when the pattern has no clear lean) would read as broken.
  const progress = [...groups.entries()]
    .filter(([, n]) => n < MIN_SIGNALS)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Learning"
        sub="The system proposes scoring improvements from real outcomes. You approve what goes live."
        actions={<RunLearningButton />}
      />

      <div className="mt-5 flex flex-col divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface sm:flex-row sm:divide-x sm:divide-y-0">
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
          <div className="rounded-xl border border-dashed border-line-strong px-6 py-7 text-sm leading-relaxed text-fg-soft">
            <p className="text-center">
              No suggestions yet. A pattern needs at least {MIN_SIGNALS} Won/Lost
              outcomes on the same buyer type or CPV — or {MIN_SIGNALS} relevance
              marks on the same buyer type — plus a clear lean. Then press
              &ldquo;Run learning&rdquo;.
            </p>
            {progress.length > 0 && (
              <div className="mx-auto mt-4 max-w-md space-y-1.5">
                <p className={`${microLabel} text-center`}>Closest to a suggestion</p>
                {progress.map(([desc, n]) => (
                  <div key={desc} className="flex items-center justify-between gap-3">
                    <span className="truncate">{desc}</span>
                    <span className="shrink-0 tabular-nums text-fg-mid">
                      {Math.min(n, MIN_SIGNALS)} of {MIN_SIGNALS}
                    </span>
                  </div>
                ))}
              </div>
            )}
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
