import type { SupabaseClient } from "@supabase/supabase-js";

// Operational-actions layer for the Tender Command Center.
//
// Backed by the app-owned `tender_actions` table (migration
// tender_actions_for_needs_attention, 2026-07-21 — designed in
// docs/ops-schema-next-iteration.md). The official deadline is never stored
// here; it joins from v_app_tenders so it can't drift from the tender.

export type ActionStatus =
  | "open"
  | "in_progress"
  | "waiting"
  | "blocked"
  | "completed";

export type TenderAction = {
  id: number;
  tenderId: number | null; // links to /tender/[id] when set
  tenderTitle: string; // "General" for non-tender ops work
  nextAction: string;
  owner: string | null;
  waitingOn: string | null; // person or organisation we are blocked on
  internalDue: string | null; // YYYY-MM-DD
  officialDeadline: string | null; // joined from the tender
  status: ActionStatus;
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

// Open (non-completed) actions with tender title + official deadline joined.
export async function getOperationalActions(
  admin: SupabaseClient
): Promise<TenderAction[]> {
  const { data: rows } = await admin
    .from("tender_actions")
    .select("id,tender_id,title,owner,waiting_on,internal_due,status")
    .neq("status", "completed")
    .order("internal_due", { ascending: true, nullsFirst: false })
    .limit(200);

  const ids = [
    ...new Set((rows ?? []).map((r) => r.tender_id).filter((v): v is number => v != null)),
  ];
  const { data: tenders } = ids.length
    ? await admin.from("v_app_tenders").select("id,title,deadline").in("id", ids)
    : { data: [] as { id: number; title: string | null; deadline: string | null }[] };
  const tMap = new Map((tenders ?? []).map((t) => [t.id, t]));

  return (rows ?? []).map((r) => ({
    id: r.id,
    tenderId: r.tender_id,
    tenderTitle: r.tender_id
      ? tMap.get(r.tender_id)?.title ?? `Tender #${r.tender_id}`
      : "General",
    nextAction: r.title,
    owner: r.owner,
    waitingOn: r.waiting_on,
    internalDue: r.internal_due,
    officialDeadline: r.tender_id ? tMap.get(r.tender_id)?.deadline ?? null : null,
    status: r.status as ActionStatus,
  }));
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
