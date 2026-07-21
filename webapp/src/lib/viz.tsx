import Link from "next/link";
import { microLabel } from "./ui";

// Small server-rendered visualization primitives for the dashboard.
// Deliberately hand-rolled with design tokens (no chart library): the data is
// tiny (tens of rows) and the design system wants sober, precise marks —
// bars and columns with real numbers, never gauges or 3D.
// (The 60-day DeadlineCalendar timeline and the Columns chart used to live
// here; removed 2026-07-21 when the Calendar page got a real month grid —
// calendar/month-grid.tsx — and no callers remained.)

export function Kpi({
  label,
  value,
  sub,
  tone,
  href,
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: "hot" | "accent";
  href?: string; // metric links to the records it counts
}) {
  const inner = (
    <>
      <dt className={microLabel}>{label}</dt>
      <dd
        className={`mt-1 text-2xl font-semibold tabular-nums ${
          tone === "hot" ? "text-hot" : tone === "accent" ? "text-accent-fg" : "text-fg"
        }`}
      >
        {value}
      </dd>
      {sub && <dd className="mt-0.5 text-xs text-fg-soft">{sub}</dd>}
    </>
  );
  // <dl> only permits dt/dd/div children — the link must live inside a div.
  if (href)
    return (
      <div className="flex-1">
        <Link
          href={href}
          className="block h-full px-5 py-4 transition-colors duration-150 hover:bg-sunken/60"
        >
          {inner}
        </Link>
      </div>
    );
  return <div className="flex-1 px-5 py-4">{inner}</div>;
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

// Horizontal bar list: label · bar scaled to the max · count. Rows can link
// (e.g. a domain filters the Tender Inbox) and optionally show a share of the
// total next to the count.
export function HBarList({
  rows,
  emptyText = "Nothing matches the current filters.",
  showPct = false,
}: {
  rows: { label: string; count: number; hot?: boolean; href?: string }[];
  emptyText?: string;
  showPct?: boolean;
}) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  const total = rows.reduce((n, r) => n + r.count, 0);
  if (rows.length === 0)
    return <p className="py-4 text-center text-xs text-fg-soft">{emptyText}</p>;
  return (
    <div className="space-y-2">
      {rows.map((r) => {
        const pct = total > 0 ? Math.round((r.count / total) * 100) : 0;
        const bar = (
          <>
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
            {showPct && (
              <span className="w-10 shrink-0 text-right text-xs tabular-nums text-fg-soft">
                {r.count > 0 ? `${pct}%` : "—"}
              </span>
            )}
          </>
        );
        return r.href ? (
          <Link
            key={r.label}
            href={r.href}
            className="flex items-center gap-3 rounded-md text-sm transition-colors duration-150 hover:bg-sunken/60"
          >
            {bar}
          </Link>
        ) : (
          <div key={r.label} className="flex items-center gap-3 text-sm">
            {bar}
          </div>
        );
      })}
    </div>
  );
}
