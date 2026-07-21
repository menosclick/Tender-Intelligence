import Link from "next/link";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { getMilestoneEvents } from "@/lib/calendar-data";
import { PageHeader, microLabel } from "@/lib/ui";
import { DeadlineCalendar, type CalendarItem } from "@/lib/viz";

export const dynamic = "force-dynamic";

// Calendar, first iteration: the 60-day milestone timeline (moved here from
// the dashboard) plus the full dated list. A month-grid calendar view is a
// later iteration — this page is its permanent home.
export default async function CalendarPage() {
  const admin = createSupabaseAdmin();
  const events = await getMilestoneEvents(admin);

  // Group the flat events per tender for the timeline component.
  const byTender = new Map<number, CalendarItem>();
  for (const e of events) {
    const item =
      byTender.get(e.tenderId) ??
      ({ id: e.tenderId, title: e.tenderTitle, milestones: [] } as CalendarItem);
    item.milestones.push({ label: e.label, date: e.date, days: e.days, hot: e.hot });
    byTender.set(e.tenderId, item);
  }
  const items = [...byTender.values()].sort(
    (a, b) => a.milestones[0].days - b.milestones[0].days
  );

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Calendar"
        sub="Every tracked date for tenders in Analysis and beyond. Add dates on a tender's detail page under Key dates."
      />

      <div className="mt-5 rounded-xl border border-line bg-surface p-4">
        <h2 className="text-sm font-semibold text-fg">Next 60 days</h2>
        <div className="mt-3">
          <DeadlineCalendar items={items} horizonDays={60} />
        </div>
      </div>

      <h2 className={`${microLabel} mt-8`}>All upcoming dates · {events.length}</h2>
      <div className="mt-2 overflow-x-auto rounded-xl border border-line bg-surface">
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
