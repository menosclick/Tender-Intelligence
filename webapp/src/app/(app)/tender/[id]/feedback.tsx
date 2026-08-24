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
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  // The pill flips immediately, but this is the signal that trains the scorer:
  // if the write fails it must snap back rather than sit there showing a
  // preference the database never received.
  function set(kind: "relevance" | "outcome", value: string) {
    const setter = kind === "relevance" ? setRelevance : setOutcome;
    const previous = kind === "relevance" ? relevance : outcome;
    setter(value);
    setFailed(false);
    startTransition(async () => {
      try {
        await recordFeedback(tenderId, kind, value);
      } catch {
        setter(previous);
        setFailed(true);
      }
    });
  }

  const pill = (active: boolean, tone: "good" | "bad" | "neutral") =>
    `rounded-full border px-3 py-1.5 text-sm font-medium transition-colors duration-150 disabled:opacity-50 ${
      active
        ? tone === "good"
          ? "border-ok-line bg-ok-soft text-ok"
          : tone === "bad"
            ? "border-hot-line bg-hot-soft text-hot"
            : "border-accent bg-accent-soft text-accent-fg"
        : "border-line-strong bg-surface text-fg-mid hover:bg-sunken"
    }`;

  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <h2 className="text-sm font-semibold text-fg">
        Your feedback{" "}
        <span className="font-normal text-fg-soft">teaches the system</span>
      </h2>
      <div className="mt-3 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-24 text-xs text-fg-soft">Relevant?</span>
          <button
            disabled={pending}
            onClick={() => set("relevance", "relevant")}
            className={pill(relevance === "relevant", "good")}
          >
            Relevant
          </button>
          <button
            disabled={pending}
            onClick={() => set("relevance", "not_relevant")}
            className={pill(relevance === "not_relevant", "bad")}
          >
            Not relevant
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-24 text-xs text-fg-soft">Outcome?</span>
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
      {failed && (
        <p className="mt-3 rounded-lg border border-hot-line bg-hot-soft px-3 py-2 text-sm text-hot">
          That didn&apos;t save — the button has been reset. Check your
          connection and try again.
        </p>
      )}
      <p className="mt-3 text-xs leading-relaxed text-fg-soft">
        Won/Lost tunes scoring weights; relevance tunes what gets surfaced.
        Nothing changes scores until you approve a suggestion on the Learning
        page.
      </p>
    </section>
  );
}
