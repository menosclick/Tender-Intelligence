import { addMilestone, removeMilestone } from "@/lib/actions";
import { MILESTONE_KINDS, milestoneLabel, daysUntil, deadlineClass } from "@/lib/format";
import { btnSecondary, microLabel } from "@/lib/ui";

// inputCls minus w-full: compact inline controls for the one-row add form.
const fieldCls =
  "rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-sm text-fg placeholder:text-fg-soft transition-colors duration-150 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20";

export type MilestoneRow = {
  id: number;
  kind: string;
  milestone_date: string;
  note: string | null;
  source: string;
};

// Key dates of the pursuit (NvI, demo, award, ...) — the manual entry point of
// the deadline-calendar loop. The submission and question deadlines come from
// TenderNed and live in the page header; this section holds everything the
// buyer's planning table adds on top.
export function MilestonesSection({
  tenderId,
  milestones,
}: {
  tenderId: number;
  milestones: MilestoneRow[];
}) {
  const rows = [...milestones].sort((a, b) =>
    a.milestone_date.localeCompare(b.milestone_date)
  );
  return (
    <section>
      <h2 className={`${microLabel} border-b border-line pb-1.5`}>Key dates</h2>
      <div className="pt-2.5">
        {rows.length > 0 && (
          <ul className="space-y-1.5">
            {rows.map((m) => {
              const days = daysUntil(m.milestone_date);
              return (
                <li key={m.id} className="flex items-baseline gap-3 text-sm">
                  <span className="w-44 shrink-0 font-medium text-fg">
                    {milestoneLabel(m.kind)}
                  </span>
                  <span className={`shrink-0 tabular-nums ${deadlineClass(days)}`}>
                    {m.milestone_date}
                    {days !== null &&
                      (days < 0
                        ? " · past"
                        : days === 0
                          ? " · today"
                          : ` · in ${days}d`)}
                  </span>
                  {m.note && (
                    <span className="min-w-0 flex-1 truncate text-fg-soft" title={m.note}>
                      {m.note}
                    </span>
                  )}
                  {m.source !== "manual" ? (
                    <span className="ml-auto shrink-0 rounded-full bg-sunken px-2 py-0.5 text-xs text-fg-mid">
                      from {m.source}
                    </span>
                  ) : (
                    <form action={removeMilestone.bind(null, m.id, tenderId)} className="ml-auto shrink-0">
                      <button
                        className="text-xs font-medium text-fg-soft transition-colors duration-150 hover:text-hot"
                        aria-label={`Remove ${milestoneLabel(m.kind)}`}
                      >
                        Remove
                      </button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <form
          action={addMilestone.bind(null, tenderId)}
          className={`flex flex-wrap items-center gap-2 ${rows.length > 0 ? "mt-3" : ""}`}
        >
          <select name="kind" required aria-label="Milestone kind" className={fieldCls}>
            {MILESTONE_KINDS.map((k) => (
              <option key={k.key} value={k.key}>
                {k.label}
              </option>
            ))}
          </select>
          <input type="date" name="date" required aria-label="Milestone date" className={fieldCls} />
          <input
            name="note"
            maxLength={120}
            placeholder="Note (optional)"
            aria-label="Note"
            className={`${fieldCls} min-w-40 flex-1`}
          />
          <button className={btnSecondary}>Add date</button>
        </form>
        <p className="mt-2 text-xs leading-relaxed text-fg-soft">
          Dates from the buyer&apos;s planning (NvI, demo, award). They show on the
          dashboard deadline calendar once this tender is in Analysis or later;
          adding a kind again corrects its date.
        </p>
      </div>
    </section>
  );
}
