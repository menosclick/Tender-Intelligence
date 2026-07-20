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
