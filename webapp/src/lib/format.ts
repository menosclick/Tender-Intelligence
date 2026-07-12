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
  Hot: "bg-red-100 text-red-800",
  Warm: "bg-amber-100 text-amber-800",
  Cold: "bg-slate-200 text-slate-700",
};

export function labelChip(label: string | null) {
  return LABEL_CHIP[label ?? ""] ?? "bg-neutral-100 text-neutral-600";
}

// Real names + maxima for score_breakdown d1..d7 (from scoring_rules.json).
export const SCORE_DIMENSIONS: { key: string; label: string; max: number }[] = [
  { key: "d1", label: "Product fit (ManageEngine)", max: 30 },
  { key: "d2", label: "Estimated value", max: 20 },
  { key: "d3", label: "Procedure type", max: 15 },
  { key: "d4", label: "Authority type", max: 15 },
  { key: "d5", label: "Deadline runway", max: 10 },
  { key: "d6", label: "Recency", max: 5 },
  { key: "d7", label: "CBA relationship", max: 5 },
];

export function deadlineText(deadline: string | null, days: number | null) {
  if (!deadline) return "—";
  if (days === null) return deadline;
  if (days < 0) return `${deadline} (closed)`;
  return `${deadline} (${days}d)`;
}

export function deadlineClass(days: number | null) {
  if (days === null) return "text-neutral-500";
  if (days < 0) return "text-neutral-400";
  if (days < 14) return "font-semibold text-red-600";
  if (days < 28) return "text-amber-700";
  return "text-neutral-600";
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

export const BOARD_STAGES = [
  "New",
  "Reviewing",
  "Bidding",
  "Submitted",
  "Won",
  "Lost",
  "Dropped",
] as const;
export type BoardStage = (typeof BOARD_STAGES)[number];
