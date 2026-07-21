// Operational-actions layer for the Tender Command Center.
//
// The database has NO actions / waiting-on / internal-due schema yet — the
// fields it will need are documented in docs/ops-schema-next-iteration.md.
// This module is the thin typed seam the dashboard reads through today:
// production returns an empty list (the dashboard shows its teaching empty
// state); development returns clearly-labelled sample rows so the layout can
// be exercised. Sample rows are synthetic and are never real tender data.

export type ActionStatus =
  | "open"
  | "in_progress"
  | "waiting"
  | "blocked"
  | "completed";

export type TenderAction = {
  id: string;
  tenderId: number | null; // links to /tender/[id] when set
  tenderTitle: string;
  nextAction: string;
  owner: string | null;
  waitingOn: string | null; // person or organisation we are blocked on
  internalDue: string | null; // YYYY-MM-DD
  officialDeadline: string | null; // YYYY-MM-DD
  status: ActionStatus;
  sample: boolean;
};

export const ACTION_STATUS_LABEL: Record<ActionStatus, string> = {
  open: "Open",
  in_progress: "In Progress",
  waiting: "Waiting",
  blocked: "Blocked",
  completed: "Completed",
};

// Chip styling per status — tint always paired with the text label above,
// never color alone (PRODUCT.md accessibility rule).
export const ACTION_STATUS_CHIP: Record<ActionStatus, string> = {
  open: "bg-sunken text-fg-mid",
  in_progress: "bg-accent-soft text-accent-fg",
  waiting: "bg-warm-soft text-warm",
  blocked: "bg-hot-soft text-hot",
  completed: "bg-ok-soft text-ok",
};

function iso(offsetDays: number): string {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Synthetic layout-exercise rows (dev only). Titles are obviously fake and
// each row is flagged sample so the UI labels the whole section.
function sampleActions(): TenderAction[] {
  return [
    {
      id: "sample-1",
      tenderId: null,
      tenderTitle: "[SAMPLE] ITSM tender — Gemeente Voorbeeld",
      nextAction: "Draft answers for the Nota van Inlichtingen",
      owner: "Derson",
      waitingOn: null,
      internalDue: iso(-2),
      officialDeadline: iso(12),
      status: "in_progress",
      sample: true,
    },
    {
      id: "sample-2",
      tenderId: null,
      tenderTitle: "[SAMPLE] PAM tender — Provincie Voorbeeld",
      nextAction: "Confirm reseller pricing for the bid",
      owner: "Derson",
      waitingOn: "ProtinusIT",
      internalDue: iso(3),
      officialDeadline: iso(21),
      status: "waiting",
      sample: true,
    },
    {
      id: "sample-3",
      tenderId: null,
      tenderTitle: "[SAMPLE] Monitoring tender — Waterschap Voorbeeld",
      nextAction: "Legal review of the concept contract",
      owner: null,
      waitingOn: null,
      internalDue: iso(6),
      officialDeadline: iso(30),
      status: "open",
      sample: true,
    },
  ];
}

export async function getOperationalActions(): Promise<TenderAction[]> {
  // No persistence yet — see docs/ops-schema-next-iteration.md.
  if (process.env.NODE_ENV === "development") return sampleActions();
  return [];
}

// ---- Priority sort (spec order) ----
// 1 overdue internal action · 2 official deadline ≤3d · 3 blocked ·
// 4 waiting on an external party · 5 due this calendar week · 6 unassigned ·
// 7 everything else. Completed rows sink to the bottom regardless.

function daysFromToday(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  if (!m) return null;
  const target = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target - today) / 86400000);
}

export function currentWeekBounds(): { start: string; end: string } {
  const now = new Date();
  const day = (now.getDay() + 6) % 7; // Monday = 0
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day);
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { start: fmt(monday), end: fmt(sunday) };
}

export function isOverdue(a: TenderAction): boolean {
  if (a.status === "completed") return false;
  const d = daysFromToday(a.internalDue);
  return d !== null && d < 0;
}

export function isDueThisWeek(a: TenderAction): boolean {
  if (a.status === "completed" || !a.internalDue) return false;
  const { start, end } = currentWeekBounds();
  return a.internalDue >= start && a.internalDue <= end;
}

export function actionPriority(a: TenderAction): number {
  if (a.status === "completed") return 99;
  if (isOverdue(a)) return 1;
  const official = daysFromToday(a.officialDeadline);
  if (official !== null && official >= 0 && official <= 3) return 2;
  if (a.status === "blocked") return 3;
  if (a.waitingOn) return 4;
  if (isDueThisWeek(a)) return 5;
  if (!a.owner) return 6;
  return 7;
}

export function sortActions(actions: TenderAction[]): TenderAction[] {
  return [...actions].sort((x, y) => {
    const p = actionPriority(x) - actionPriority(y);
    if (p !== 0) return p;
    return (x.internalDue ?? "9999").localeCompare(y.internalDue ?? "9999");
  });
}
