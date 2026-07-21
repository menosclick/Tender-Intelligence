import Link from "next/link";
import type { MilestoneEvent } from "@/lib/calendar-data";

// Real month-grid calendar, Monday-first (Dutch convention). Server-rendered;
// month navigation is plain links (?m=YYYY-MM), no client JS. Events come from
// getMilestoneEvents, which tracks upcoming dates only — past days render
// empty by design, so navigation never goes earlier than the current month.

const pad = (n: number) => String(n).padStart(2, "0");

// Local date parts — same clock daysUntil() uses, so "today" agrees everywhere.
function localToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function currentMonth(): string {
  return localToday().slice(0, 7);
}

// Strict YYYY-MM within the same year window the rest of the app accepts.
export function isValidMonth(m: string | undefined): m is string {
  if (!m || !/^\d{4}-(0[1-9]|1[0-2])$/.test(m)) return false;
  const y = +m.slice(0, 4);
  return y >= 2020 && y <= 2100;
}

export function shiftMonth(month: string, delta: number): string {
  const total = +month.slice(0, 4) * 12 + (+month.slice(5, 7) - 1) + delta;
  return `${Math.floor(total / 12)}-${pad((total % 12) + 1)}`;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function monthTitle(month: string): string {
  return `${MONTH_NAMES[+month.slice(5, 7) - 1]} ${month.slice(0, 4)}`;
}

type Cell = { date: string; day: number; inMonth: boolean };

// Full weeks covering the month, Monday-first.
function buildWeeks(month: string): Cell[][] {
  const y = +month.slice(0, 4);
  const m = +month.slice(5, 7);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const offset = (first.getUTCDay() + 6) % 7; // Monday = 0
  const cur = new Date(Date.UTC(y, m - 1, 1 - offset));
  const weeks: Cell[][] = [];
  do {
    const week: Cell[] = [];
    for (let i = 0; i < 7; i++) {
      week.push({
        date: `${cur.getUTCFullYear()}-${pad(cur.getUTCMonth() + 1)}-${pad(cur.getUTCDate())}`,
        day: cur.getUTCDate(),
        inMonth: cur.getUTCMonth() === m - 1,
      });
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    weeks.push(week);
  } while (cur.getUTCMonth() === m - 1);
  return weeks;
}

// Tint per event type — always paired with the milestone label text on the
// chip itself, never color alone (accessibility rule in DESIGN.md).
function chipClass(e: MilestoneEvent): string {
  if (e.hot) return "bg-hot-soft text-hot";
  if (e.official) return "bg-accent-soft text-accent-fg";
  return "bg-sunken text-fg-mid";
}

const MAX_CHIPS_PER_DAY = 3;

export function MonthGrid({
  month,
  events,
}: {
  month: string; // YYYY-MM
  events: MilestoneEvent[];
}) {
  const weeks = buildWeeks(month);
  const today = localToday();

  const byDate = new Map<string, MilestoneEvent[]>();
  for (const e of events) {
    const list = byDate.get(e.date) ?? [];
    list.push(e);
    byDate.set(e.date, list);
  }

  const inMonthEvents = events.filter((e) => e.date.startsWith(month));

  return (
    <div>
      {/* Wrapper is positioned so no absolutely-placed child can extend the
          document scroll width past the viewport (sr-only phantom-scroll fix). */}
      <div className="relative overflow-x-auto">
        <div className="min-w-[46rem]">
          <div className="grid grid-cols-7 border-b border-line pb-1.5 text-center">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <span
                key={d}
                className="text-xs font-semibold uppercase tracking-wider text-fg-soft"
              >
                {d}
              </span>
            ))}
          </div>
          {weeks.map((week, wi) => (
            <div
              key={wi}
              className="grid grid-cols-7 border-b border-line/60 last:border-0"
            >
              {week.map((cell) => {
                const dayEvents = cell.inMonth ? byDate.get(cell.date) ?? [] : [];
                const shown = dayEvents.slice(0, MAX_CHIPS_PER_DAY);
                const rest = dayEvents.slice(MAX_CHIPS_PER_DAY);
                const isToday = cell.date === today;
                const weekend =
                  new Date(cell.date + "T00:00:00Z").getUTCDay() % 6 === 0;
                return (
                  <div
                    key={cell.date}
                    className={`min-h-[5.5rem] border-r border-line/60 p-1.5 last:border-r-0 ${
                      !cell.inMonth ? "bg-sunken/40" : weekend ? "bg-sunken/25" : ""
                    }`}
                  >
                    <div className="flex justify-end">
                      {isToday ? (
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-xs font-semibold tabular-nums text-surface">
                          {cell.day}
                        </span>
                      ) : (
                        <span
                          className={`text-xs tabular-nums ${
                            cell.inMonth ? "text-fg-mid" : "text-fg-soft/60"
                          }`}
                        >
                          {cell.day}
                        </span>
                      )}
                    </div>
                    {shown.length > 0 && (
                      <div className="mt-1 space-y-1">
                        {shown.map((e, i) => (
                          <Link
                            key={`${e.tenderId}-${e.label}-${i}`}
                            href={`/tender/${e.tenderId}`}
                            title={`${e.label} — ${e.tenderTitle} (${e.date})`}
                            className={`block truncate rounded px-1.5 py-0.5 text-xs font-medium hover:opacity-80 ${chipClass(e)}`}
                          >
                            {e.label} · {e.tenderTitle}
                          </Link>
                        ))}
                        {rest.length > 0 && (
                          <span
                            className="block px-1.5 text-xs text-fg-soft"
                            title={rest.map((e) => `${e.label} — ${e.tenderTitle}`).join(" · ")}
                          >
                            +{rest.length} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-1.5">
        <p className="text-xs text-fg-soft">
          {inMonthEvents.length === 0
            ? "No tracked dates this month."
            : `${inMonthEvents.length} tracked ${inMonthEvents.length === 1 ? "date" : "dates"} this month.`}
        </p>
        <p className="flex items-center gap-4 text-xs text-fg-soft">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-hot-soft ring-1 ring-inset ring-hot/30" />
            Submission
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-accent-soft ring-1 ring-inset ring-accent/30" />
            Official date
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-sunken ring-1 ring-inset ring-line-strong" />
            Internal date
          </span>
        </p>
      </div>
    </div>
  );
}
