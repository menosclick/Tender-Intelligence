import Link from "next/link";
import { microLabel } from "./ui";

// Small server-rendered visualization primitives for the dashboard.
// Deliberately hand-rolled with design tokens (no chart library): the data is
// tiny (tens of rows) and the design system wants sober, precise marks —
// bars and columns with real numbers, never gauges or 3D.

export function Kpi({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: "hot" | "accent";
}) {
  return (
    <div className="flex-1 px-5 py-4">
      <dt className={microLabel}>{label}</dt>
      <dd
        className={`mt-1 text-2xl font-semibold tabular-nums ${
          tone === "hot" ? "text-hot" : tone === "accent" ? "text-accent-fg" : "text-fg"
        }`}
      >
        {value}
      </dd>
      {sub && <dd className="mt-0.5 text-xs text-fg-soft">{sub}</dd>}
    </div>
  );
}

export function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <h2 className="text-sm font-semibold text-fg">{title}</h2>
      <div className="mt-3">{children}</div>
    </div>
  );
}

// Horizontal bar list: label · bar scaled to the max · count.
export function HBarList({
  rows,
  emptyText = "Nothing matches the current filters.",
}: {
  rows: { label: string; count: number; hot?: boolean }[];
  emptyText?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  if (rows.length === 0)
    return <p className="py-4 text-center text-xs text-fg-soft">{emptyText}</p>;
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-3 text-sm">
          <span className="w-32 shrink-0 truncate text-fg-mid" title={r.label}>
            {r.label}
          </span>
          <div className="h-4 flex-1 overflow-hidden rounded-sm bg-sunken">
            <div
              className={`h-full rounded-sm ${r.hot ? "bg-hot" : "bg-accent"}`}
              style={{ width: `${(r.count / max) * 100}%` }}
            />
          </div>
          <span className="w-8 shrink-0 text-right tabular-nums text-fg">{r.count}</span>
        </div>
      ))}
    </div>
  );
}

// Horizontal timeline of milestones per tender over the next `horizonDays`.
// Milestone kinds are open-ended: question and submission deadlines come from
// the scraped TenderNed row; the rest of the tender lifecycle (NvI, demo, PoC,
// award, contract start) comes from tender_milestones, entered on the tender
// detail page.
export type CalendarItem = {
  id: number;
  title: string;
  milestones: { label: string; date: string; days: number; hot?: boolean }[];
};

export function DeadlineCalendar({
  items,
  horizonDays = 60,
  emptyText = "Move a tender into Analysis to track its dates here.",
}: {
  items: CalendarItem[];
  horizonDays?: number;
  emptyText?: string;
}) {
  if (items.length === 0)
    return <p className="py-4 text-center text-xs text-fg-soft">{emptyText}</p>;

  // Layout pass. Two things stop labels from colliding:
  // 1. Everything past the horizon collapses into ONE right-edge marker
  //    (soonest milestone + "+N more") — clamping them individually stacked
  //    identical anchors on top of each other.
  // 2. Labels get a lane (upper/lower) greedily by estimated width: a label
  //    moves to the other lane only when it would overlap the previous label
  //    in its own. Index parity separated only adjacent neighbors.
  type Placed = {
    label: string;
    date: string;
    suffix: string;
    title: string;
    hot: boolean;
    pct: number;
    nearRight: boolean;
    lane: 0 | 1;
  };
  // Label width as % of the rail: ~6.5px/char (text-xs) + dot/gap on a ~760px
  // rail. An estimate is enough — lanes only need to be right about overlap.
  const estWidth = (text: string) => (text.length * 6.5 + 22) / 7.6;

  const layout = items.map((t) => {
    const sorted = [...t.milestones].sort((a, b) => a.days - b.days);
    const within = sorted.filter((m) => m.days <= horizonDays);
    const beyond = sorted.filter((m) => m.days > horizonDays);
    const specs: Omit<Placed, "lane">[] = within.map((m) => {
      const pct = Math.max(0, (m.days / horizonDays) * 100);
      return {
        label: m.label,
        date: m.date,
        suffix: "",
        title: `${m.label}: ${m.date}`,
        hot: m.hot ?? false,
        pct,
        nearRight: pct > 72,
      };
    });
    if (beyond.length > 0) {
      const first = beyond[0];
      const suffix =
        (first.days > 365 ? " (long-term)" : ` (+${first.days}d)`) +
        (beyond.length > 1 ? ` · +${beyond.length - 1} more` : "");
      specs.push({
        label: first.label,
        date: first.date,
        suffix,
        title: beyond.map((m) => `${m.label}: ${m.date}`).join(" · "),
        hot: beyond.some((m) => m.hot),
        pct: 100,
        nearRight: true,
      });
    }
    // Greedy lanes over ascending positions; right-anchored labels occupy the
    // interval to the LEFT of their anchor.
    const laneEnd = [-Infinity, -Infinity];
    const placed: Placed[] = specs.map((s) => {
      const w = estWidth(`${s.label} ${s.date.slice(5)}${s.suffix}`);
      const start = s.nearRight ? s.pct - w : s.pct;
      const lane: 0 | 1 =
        start >= laneEnd[0] ? 0 : start >= laneEnd[1] ? 1 : laneEnd[0] <= laneEnd[1] ? 0 : 1;
      laneEnd[lane] = start + w;
      return { ...s, lane };
    });
    return { id: t.id, title: t.title, placed };
  });
  const stacked = layout.some((t) => t.placed.some((m) => m.lane === 1));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between pl-[13.5rem] text-xs text-fg-soft">
        <span>today</span>
        <span>+{Math.round(horizonDays / 2)}d</span>
        <span>+{horizonDays}d</span>
      </div>
      {layout.map((t) => (
        <div key={t.id} className="flex items-center gap-3">
          <Link
            href={`/tender/${t.id}`}
            className="w-[13rem] shrink-0 truncate text-sm font-medium text-fg hover:text-accent-fg hover:underline"
            title={t.title}
          >
            {t.title}
          </Link>
          <div className={`relative ${stacked ? "h-10" : "h-7"} flex-1 rounded-md bg-sunken`}>
            {/* halfway gridline */}
            <div className="absolute inset-y-0 left-1/2 w-px bg-line" aria-hidden="true" />
            {t.placed.map((m, i) => {
              const lane = !stacked
                ? "top-1/2"
                : m.lane === 0
                  ? "top-[28%]"
                  : "top-[72%]";
              return (
                <div
                  key={i}
                  className={`absolute ${lane} flex -translate-y-1/2 items-center gap-1.5`}
                  style={
                    m.nearRight
                      ? { right: `${100 - m.pct}%`, flexDirection: "row-reverse" }
                      : { left: `${m.pct}%` }
                  }
                  title={m.title}
                >
                  <span
                    className={`h-2.5 w-2.5 shrink-0 rounded-full ${m.hot ? "bg-hot" : "bg-accent"}`}
                  />
                  <span className="whitespace-nowrap text-xs text-fg-mid">
                    {m.label} {m.date.slice(5)}
                    {m.suffix}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// Small column chart with the value printed above each column.
export function Columns({
  points,
  emptyText = "No data yet.",
}: {
  points: { label: string; value: number }[];
  emptyText?: string;
}) {
  const max = Math.max(1, ...points.map((p) => p.value));
  if (points.length === 0)
    return <p className="py-4 text-center text-xs text-fg-soft">{emptyText}</p>;
  return (
    <div className="flex items-end gap-2" style={{ height: "8.5rem" }}>
      {points.map((p) => (
        <div key={p.label} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
          <span className="text-xs font-medium tabular-nums text-fg">{p.value}</span>
          <div
            className="w-full max-w-10 rounded-t-sm bg-accent"
            style={{ height: `${Math.max(4, (p.value / max) * 88)}px` }}
          />
          <span className="w-full truncate text-center text-xs text-fg-soft" title={p.label}>
            {p.label}
          </span>
        </div>
      ))}
    </div>
  );
}
