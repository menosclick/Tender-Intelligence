"use client";

import { useState, useTransition } from "react";
import { recordFeedback } from "@/lib/actions";

// Captures the learning signal on each tender. Relevance = filter tuning; Outcome = score weights.
export function FeedbackWidget({
  tenderId,
  initialRelevance,
  initialOutcome,
}: {
  tenderId: number;
  initialRelevance: string | null;
  initialOutcome: string | null;
}) {
  const [relevance, setRelevance] = useState(initialRelevance);
  const [outcome, setOutcome] = useState(initialOutcome);
  const [pending, startTransition] = useTransition();

  function set(kind: "relevance" | "outcome", value: string) {
    const setter = kind === "relevance" ? setRelevance : setOutcome;
    setter(value);
    startTransition(() => recordFeedback(tenderId, kind, value));
  }

  const pill = (active: boolean, tone: "good" | "bad" | "neutral") =>
    `rounded-md px-3 py-1.5 text-sm font-medium border transition-colors ${
      active
        ? tone === "good"
          ? "border-green-600 bg-green-50 text-green-700"
          : tone === "bad"
            ? "border-red-500 bg-red-50 text-red-700"
            : "border-accent bg-accent-soft text-accent"
        : "border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-50"
    }`;

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
      <h2 className="mb-1 text-sm font-semibold text-neutral-700">
        Your feedback <span className="font-normal text-neutral-400">— teaches the system</span>
      </h2>
      <div className="mt-3 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-24 text-xs text-neutral-500">Relevant?</span>
          <button disabled={pending} onClick={() => set("relevance", "relevant")} className={pill(relevance === "relevant", "good")}>
            👍 Relevant
          </button>
          <button disabled={pending} onClick={() => set("relevance", "not_relevant")} className={pill(relevance === "not_relevant", "bad")}>
            👎 Not relevant
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-24 text-xs text-neutral-500">Outcome?</span>
          {[
            ["bidding", "Bidding", "neutral"],
            ["won", "Won", "good"],
            ["lost", "Lost", "bad"],
            ["no_bid", "No bid", "neutral"],
          ].map(([val, label, tone]) => (
            <button
              key={val}
              disabled={pending}
              onClick={() => set("outcome", val)}
              className={pill(outcome === val, tone as "good" | "bad" | "neutral")}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-3 text-xs text-neutral-400">
        Won/Lost tunes scoring weights; relevance tunes what gets surfaced. Nothing changes scores
        until you approve a suggestion on the Learning page.
      </p>
    </section>
  );
}
