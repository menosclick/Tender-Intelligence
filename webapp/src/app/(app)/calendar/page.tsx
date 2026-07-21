import Link from "next/link";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { getMilestoneEvents } from "@/lib/calendar-data";
import { PageHeader, btnSecondary, microLabel } from "@/lib/ui";
import {
  MonthGrid,
  currentMonth,
  isValidMonth,
  monthTitle,
  shiftMonth,
} from "./month-grid";

export const dynamic = "force-dynamic";

// Calendar: a real month grid plus the full dated list. Only upcoming dates
// are tracked (getMilestoneEvents drops past dates), so navigation starts at
// the current month — earlier months would misleadingly render empty.
export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const { m } = await searchParams;
  const nowMonth = currentMonth();
  const month = isValidMonth(m) && m >= nowMonth ? m : nowMonth;

  const admin = createSupabaseAdmin();
  const events = await getMilestoneEvents(admin);
  const prev = shiftMonth(month, -1);
  const next = shiftMonth(month, 1);
  const canGoBack = prev >= nowMonth;
  // Forward navigation stops at the last month with a tracked date, capped at
  // a year out — paging into provably blank grids helps nobody. Dates further
  // away (DAS/framework windows) stay in the list below as "long-term".
  const horizon = shiftMonth(nowMonth, 12);
  const capMonth = events
    .map((e) => e.date.slice(0, 7))
    .filter((mm) => mm <= horizon)
    .reduce((max, mm) => (mm > max ? mm : max), nowMonth);
  const canGoForward = month < capMonth;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Calendar"
        sub="Every tracked date for tenders in Analysis and beyond. Add dates on a tender's detail page under Key dates."
      />

      <div className="mt-5 rounded-xl border border-line bg-surface p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-fg">{monthTitle(month)}</h2>
          <div className="flex items-center gap-2">
            {month !== nowMonth && (
              <Link href="/calendar" className={btnSecondary}>
                Today
              </Link>
            )}
            {canGoBack ? (
              <Link
                href={`/calendar?m=${prev}`}
                className={btnSecondary}
                aria-label={`Previous month, ${monthTitle(prev)}`}
              >
                ←
              </Link>
            ) : (
              <span className={`${btnSecondary} pointer-events-none opacity-40`} aria-hidden="true">
                ←
              </span>
            )}
            {canGoForward ? (
              <Link
                href={`/calendar?m=${next}`}
                className={btnSecondary}
                aria-label={`Next month, ${monthTitle(next)}`}
              >
                →
              </Link>
            ) : (
              <span className={`${btnSecondary} pointer-events-none opacity-40`} aria-hidden="true">
                →
              </span>
            )}
          </div>
        </div>
        <MonthGrid month={month} events={events} />
      </div>

      <h2 className={`${microLabel} mt-8`}>All upcoming dates · {events.length}</h2>
      <div className="relative mt-2 overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full min-w-[36rem] text-sm">
          <thead>
            <tr className={`border-b border-line text-left ${microLabel}`}>
              <th className="px-4 py-2.5">Date</th>
              <th className="px-4 py-2.5">Tender</th>
              <th className="px-4 py-2.5">Milestone</th>
              <th className="px-4 py-2.5">Source</th>
              <th className="px-4 py-2.5 text-right">Days left</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e, i) => (
              <tr
                key={`${e.tenderId}-${e.label}-${i}`}
                className="border-b border-line/60 last:border-0"
              >
                <td className="px-4 py-2.5 tabular-nums text-fg">{e.date}</td>
                <td className="max-w-sm px-4 py-2.5">
                  <Link
                    href={`/tender/${e.tenderId}`}
                    className="block truncate font-medium text-fg hover:text-accent-fg hover:underline"
                    title={e.tenderTitle}
                  >
                    {e.tenderTitle}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-fg-mid">{e.label}</td>
                <td className="px-4 py-2.5">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      e.official ? "bg-accent-soft text-accent-fg" : "bg-sunken text-fg-mid"
                    }`}
                  >
                    {e.official ? "Official" : "Internal"}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-fg-mid">
                  {/* beyond a year it's a DAS/framework window, not a countdown */}
                  {e.days === 0 ? "today" : e.days > 365 ? "long-term" : `${e.days}d`}
                </td>
              </tr>
            ))}
            {events.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-sm text-fg-soft">
                  No upcoming dates. Move a tender into Analysis on the Tender
                  Pipeline, then add its key dates on the tender detail page.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
