// Shared display helpers.

// Calendar-day difference (deadline date − today), timezone-stable.
// Both sides normalized to local midnight so time-of-day never shifts the count.
// Use this everywhere instead of ad-hoc Date.parse math so all screens agree.
export function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  if (!m) return null;
  const deadline = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((deadline - today) / 86400000);
}

export const LABEL_CHIP: Record<string, string> = {
  Hot: "bg-hot-soft text-hot",
  Warm: "bg-warm-soft text-warm",
  Cold: "bg-cold-soft text-cold",
  Monitor: "bg-sunken text-fg-mid",
};

export function labelChip(label: string | null) {
  return LABEL_CHIP[label ?? ""] ?? "bg-sunken text-fg-mid";
}

// Dot color matching each label chip, so the chip never relies on tint alone.
export const LABEL_DOT: Record<string, string> = {
  Hot: "bg-hot",
  Warm: "bg-warm",
  Cold: "bg-cold",
  Monitor: "bg-fg-soft",
};

export function labelDot(label: string | null) {
  return LABEL_DOT[label ?? ""] ?? "bg-fg-soft";
}

// Real names, maxima and plain-language meaning for score_breakdown d1..d7
// (semantics from scoring/scoring_rules.json). d2 and d7 are listed apart:
// TenderNed publishes no contract value and no relationship data exists yet,
// so they can't meaningfully score (audit 2026-07-20: d7 = 0 on every row
// ever, d2 ≤ 2/20). Rendering them as bars erodes trust in the score.
export const SCORE_DIMENSIONS: {
  key: string;
  label: string;
  max: number;
  desc: string;
}[] = [
  {
    key: "d1",
    label: "Product fit",
    max: 30,
    desc: "How clearly the tender maps to ManageEngine products",
  },
  {
    key: "d3",
    label: "Procedure type",
    max: 15,
    desc: "Points for the kind of procurement procedure the buyer runs",
  },
  {
    key: "d4",
    label: "Authority type",
    max: 15,
    desc: "Strategic value of this type of buyer for CBA",
  },
  {
    key: "d5",
    label: "Deadline runway",
    max: 10,
    desc: "Time left until the submission deadline — longer means a serious bid is feasible",
  },
  {
    key: "d6",
    label: "Recency",
    max: 5,
    desc: "How early the system caught it after publication",
  },
];
export const SCORE_DIMENSIONS_SPARSE: { key: string; label: string; max: number; reason: string }[] = [
  { key: "d2", label: "Estimated value", max: 20, reason: "TenderNed rarely publishes contract values" },
  { key: "d7", label: "CBA relationship", max: 5, reason: "no relationship data recorded yet" },
];

// Qualitative reading of a dimension's contribution, so the number explains itself.
export function scoreTier(val: number, max: number): string {
  if (val <= 0) return "none";
  const r = val / max;
  if (r >= 0.8) return "strong";
  if (r >= 0.5) return "moderate";
  return "weak";
}

export function deadlineText(deadline: string | null, days: number | null) {
  if (!deadline) return "—";
  if (days === null) return deadline;
  if (days < 0) return `${deadline} (closed)`;
  // Beyond a year it's a framework/DAS-style window, not a bid-by date —
  // "(2897d)" reads like a data error and drowns the real urgency scale.
  if (days > 365) return `${deadline} (long-term)`;
  return `${deadline} (${days}d)`;
}

export function deadlineClass(days: number | null) {
  if (days === null) return "text-fg-soft";
  if (days < 0) return "text-fg-soft";
  if (days < 14) return "font-semibold text-hot";
  if (days < 28) return "text-warm";
  return "text-fg-mid";
}

// jsonb fields sometimes arrive as arrays, sometimes as JSON strings.
export function asArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
    } catch {
      return v.trim() ? [v] : [];
    }
  }
  return [];
}

// Milestone kinds, in lifecycle order — mirrors the tender_milestones CHECK
// constraint (migration tender_milestones_for_deadline_calendar, 2026-07-21).
// `label` is the display name on the detail page and the dashboard calendar.
export const MILESTONE_KINDS: { key: string; label: string }[] = [
  { key: "publication", label: "Publication" },
  { key: "question_deadline", label: "Questions close" },
  { key: "nvi_publication", label: "NvI published" },
  { key: "submission_deadline", label: "Submission" },
  { key: "demo", label: "Demo" },
  { key: "proof_of_concept", label: "Proof of concept" },
  { key: "provisional_award", label: "Provisional award" },
  { key: "objection_period_end", label: "Objection period ends" },
  { key: "final_award", label: "Final award" },
  { key: "contract_start", label: "Contract start" },
  { key: "other", label: "Other" },
];

export function milestoneLabel(kind: string): string {
  return MILESTONE_KINDS.find((k) => k.key === kind)?.label ?? kind;
}

// Kinds TenderNed itself publishes. The scraped row is authoritative for these
// and the app never edits scraper-owned data, so offering them in the manual
// add form would promise a correction that can't take effect. They stay in
// MILESTONE_KINDS for the document-extraction pipeline.
const TENDERNED_OWNED = ["publication", "question_deadline", "submission_deadline"];
export const MANUAL_MILESTONE_KINDS = MILESTONE_KINDS.filter(
  (k) => !TENDERNED_OWNED.includes(k.key)
);

// The real tender lifecycle (DB migration bid_pipeline_stages_tender_lifecycle,
// approved 2026-07-21): working stages Identified → Analysis → Q&A → Submitted
// → Award, terminals Won / Lost / Dropped.
export const BOARD_STAGES = [
  "Identified",
  "Analysis",
  "Q&A",
  "Submitted",
  "Award",
  "Won",
  "Lost",
  "Dropped",
] as const;
export type BoardStage = (typeof BOARD_STAGES)[number];

// Legacy display shim: stored values were renamed in the DB, but any stray
// legacy value (e.g. from an old export) still renders as its new name.
export const STAGE_LABELS: Record<string, string> = {
  New: "Identified",
  Reviewing: "Analysis",
  Bidding: "Q&A",
};
export function stageLabel(stage: string): string {
  return STAGE_LABELS[stage] ?? stage;
}
