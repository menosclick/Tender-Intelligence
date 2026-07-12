"use client";

import { useTransition } from "react";
import { decideSuggestion, runLearning } from "@/lib/actions";

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
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-neutral-800">{s.rationale}</p>
          <p className="mt-1 font-mono text-xs text-neutral-500">
            {s.dimension} / {s.target} · {s.current_points ?? 0} →{" "}
            <span className="font-semibold text-accent">{s.suggested_points}</span>{" "}
            ({delta >= 0 ? "+" : ""}
            {delta.toFixed(1)})
            {s.confidence != null && (
              <span className="ml-2 text-neutral-400">
                confidence {Math.round(s.confidence * 100)}%
              </span>
            )}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            disabled={pending}
            onClick={() => startTransition(() => decideSuggestion(s.id, true))}
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            Approve
          </button>
          <button
            disabled={pending}
            onClick={() => startTransition(() => decideSuggestion(s.id, false))}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-50 disabled:opacity-50"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}

export function RunLearningButton() {
  const [pending, startTransition] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => startTransition(() => runLearning())}
      className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-neutral-50 disabled:opacity-50"
    >
      {pending ? "Analyzing…" : "Run learning"}
    </button>
  );
}
