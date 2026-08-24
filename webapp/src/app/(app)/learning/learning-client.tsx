"use client";

import { useTransition } from "react";
import { decideSuggestion, runLearning } from "@/lib/actions";
import { btnPrimary, btnSecondary } from "@/lib/ui";

type Suggestion = {
  id: number;
  dimension: string | null;
  target: string | null;
  current_points: number | null;
  suggested_points: number | null;
  rationale: string;
  confidence: number | null;
};

export function SuggestionCard({ suggestion: s }: { suggestion: Suggestion }) {
  const [pending, startTransition] = useTransition();
  const delta = (s.suggested_points ?? 0) - (s.current_points ?? 0);

  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium leading-relaxed text-fg">
            {s.rationale}
          </p>
          <p className="mt-1.5 font-mono text-xs text-fg-soft">
            {s.dimension}/{s.target} · {s.current_points ?? 0} →{" "}
            <span className="font-medium text-accent-fg">{s.suggested_points}</span>{" "}
            ({delta >= 0 ? "+" : ""}
            {delta.toFixed(1)})
            {s.confidence != null && (
              <span className="ml-2">
                confidence {Math.round(s.confidence * 100)}%
              </span>
            )}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            disabled={pending}
            onClick={() => startTransition(() => decideSuggestion(s.id, true))}
            className={btnPrimary}
          >
            Approve
          </button>
          <button
            disabled={pending}
            onClick={() => startTransition(() => decideSuggestion(s.id, false))}
            className={btnSecondary}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}

export function RunLearningButton({ pendingCount = 0 }: { pendingCount?: number }) {
  const [pending, startTransition] = useTransition();
  // generate_scoring_suggestions() starts by deleting every pending row, so
  // re-running discards anything still awaiting a decision. Most are
  // re-derived, but one whose pattern has since dropped below the threshold is
  // gone for good — so say it before it happens rather than after.
  function run() {
    if (
      pendingCount > 0 &&
      !window.confirm(
        `Re-running replaces the ${pendingCount} suggestion${pendingCount === 1 ? "" : "s"} waiting for a decision. ` +
          "Any whose pattern no longer clears the threshold will not come back. Continue?"
      )
    )
      return;
    startTransition(() => runLearning());
  }
  return (
    <button disabled={pending} onClick={run} className={btnSecondary}>
      {pending ? "Analyzing…" : "Run learning"}
    </button>
  );
}
