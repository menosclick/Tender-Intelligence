import { labelChip, labelDot } from "./format";

// One visual vocabulary for tender labels everywhere a tender appears.
export function LabelChip({
  label,
  score,
}: {
  label: string | null;
  score?: number | null;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ${labelChip(label)}`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${labelDot(label)}`} />
      {label ?? "unscored"}
      {score != null && <span className="tabular-nums">{score}</span>}
    </span>
  );
}

export function PageHeader({
  title,
  sub,
  actions,
}: {
  title: string;
  sub?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {sub && <p className="mt-1 text-sm text-fg-mid">{sub}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

// Shared control classes — the same button and input vocabulary on every screen.
export const btnPrimary =
  "inline-flex items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-surface transition-colors duration-150 hover:bg-accent-strong disabled:opacity-50";
export const btnSecondary =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-sm font-medium text-fg transition-colors duration-150 hover:bg-sunken disabled:opacity-50";
export const inputCls =
  "w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-soft transition-colors duration-150 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20";
export const microLabel =
  "text-xs font-semibold uppercase tracking-wider text-fg-soft";
