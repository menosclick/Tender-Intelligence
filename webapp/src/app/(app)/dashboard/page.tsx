import Link from "next/link";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { deadlineText, deadlineClass } from "@/lib/format";
import { LabelChip, PageHeader, btnSecondary, microLabel } from "@/lib/ui";

export const dynamic = "force-dynamic";

// Phase 2: the anchor screen — ranked open tenders, replaces the email digest.
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string }>;
}) {
  const { show } = await searchParams;
  const showCold = show === "all";
  const admin = createSupabaseAdmin();

  let query = admin
    .from("v_app_tenders")
    .select(
      "id,title,buyer,label,score,deadline,days_to_deadline,fit_level,pipeline_stage"
    )
    .gte("days_to_deadline", 0)
    .order("score", { ascending: false })
    .order("deadline", { ascending: true });
  if (!showCold) query = query.in("label", ["Hot", "Warm"]);

  // "New" = scraped in the last 24h (covers this morning's 09:00 run until tomorrow's).
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  const [{ data: tenders }, scraped, { data: fresh }] = await Promise.all([
    query,
    admin.from("tenders_scraped").select("id", { count: "exact", head: true }),
    admin.from("tenders_scraped").select("id").gte("scraped_at", since),
  ]);

  const rows = tenders ?? [];
  const freshIds = new Set((fresh ?? []).map((f) => f.id));

  const segment = (active: boolean) =>
    `px-3 py-1.5 text-sm font-medium transition-colors duration-150 ${
      active
        ? "bg-accent text-surface"
        : "bg-surface text-fg-mid hover:bg-sunken"
    }`;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Open tenders"
        sub={`${rows.length} qualified and open, ranked by score · ${scraped.count ?? 0} scraped in total`}
        actions={
          <>
            <Link href="/tender/new" className={btnSecondary}>
              <svg
                viewBox="0 0 16 16"
                className="h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M8 3v10M3 8h10" />
              </svg>
              Add tender
            </Link>
            <div className="flex overflow-hidden rounded-lg border border-line-strong">
              <Link
                href="/dashboard"
                aria-current={!showCold ? "page" : undefined}
                className={segment(!showCold)}
              >
                Warm+
              </Link>
              <Link
                href="/dashboard?show=all"
                aria-current={showCold ? "page" : undefined}
                className={`border-l border-line-strong ${segment(showCold)}`}
              >
                Include Cold
              </Link>
            </div>
          </>
        }
      />

      <div className="mt-5 overflow-hidden rounded-xl border border-line bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className={`border-b border-line text-left ${microLabel}`}>
              <th className="px-4 py-2.5">Tender</th>
              <th className="px-4 py-2.5">Buyer</th>
              <th className="px-4 py-2.5">Label</th>
              <th className="px-4 py-2.5 text-right">Score</th>
              <th className="px-4 py-2.5">Deadline</th>
              <th className="px-4 py-2.5">Board</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr
                key={t.id}
                className="border-b border-line/60 transition-colors duration-150 last:border-0 hover:bg-sunken/60"
              >
                <td className="max-w-sm px-4 py-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <Link
                      href={`/tender/${t.id}`}
                      className="truncate font-medium text-fg hover:text-accent-fg hover:underline"
                      title={t.title ?? ""}
                    >
                      {t.title}
                    </Link>
                    {freshIds.has(t.id) && (
                      <span className="shrink-0 rounded-full bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent-fg">
                        New
                      </span>
                    )}
                  </div>
                </td>
                <td
                  className="max-w-[14rem] truncate px-4 py-3 text-fg-mid"
                  title={t.buyer ?? ""}
                >
                  {t.buyer}
                </td>
                <td className="px-4 py-3">
                  <LabelChip label={t.label} />
                </td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums">
                  {t.score}
                </td>
                <td
                  className={`px-4 py-3 tabular-nums ${deadlineClass(t.days_to_deadline)}`}
                >
                  {deadlineText(t.deadline, t.days_to_deadline)}
                </td>
                <td className="px-4 py-3 text-xs text-fg-soft">
                  {t.pipeline_stage ?? "—"}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-fg-soft">
                  No open {showCold ? "" : "Warm+ "}tenders right now. The
                  scraper runs daily at 09:00.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
