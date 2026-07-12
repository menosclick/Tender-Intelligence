import Link from "next/link";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { labelChip, deadlineText, deadlineClass } from "@/lib/format";

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

  const [{ data: tenders }, scraped] = await Promise.all([
    query,
    admin.from("tenders_scraped").select("id", { count: "exact", head: true }),
  ]);

  const rows = tenders ?? [];

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-lg font-semibold">Open tenders</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {rows.length} qualified &amp; open, ranked by score · {scraped.count ?? 0} scraped in total
          </p>
        </div>
        <div className="flex gap-2 text-sm">
          <Link
            href="/tender/new"
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 hover:bg-neutral-50"
          >
            ＋ Add tender
          </Link>
          <Link
            href="/dashboard"
            className={`rounded-md px-3 py-1.5 ${!showCold ? "bg-accent text-white" : "border border-neutral-300 bg-white hover:bg-neutral-50"}`}
          >
            Warm+
          </Link>
          <Link
            href="/dashboard?show=all"
            className={`rounded-md px-3 py-1.5 ${showCold ? "bg-accent text-white" : "border border-neutral-300 bg-white hover:bg-neutral-50"}`}
          >
            Include Cold
          </Link>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-xs uppercase tracking-wide text-neutral-400">
              <th className="px-4 py-2 font-semibold">Tender</th>
              <th className="px-4 py-2 font-semibold">Buyer</th>
              <th className="px-4 py-2 font-semibold">Label</th>
              <th className="px-4 py-2 font-semibold">Score</th>
              <th className="px-4 py-2 font-semibold">Deadline</th>
              <th className="px-4 py-2 font-semibold">Board</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr
                key={t.id}
                className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50"
              >
                <td className="max-w-sm px-4 py-2.5">
                  <Link
                    href={`/tender/${t.id}`}
                    className="block truncate font-medium text-neutral-900 hover:text-accent hover:underline"
                    title={t.title ?? ""}
                  >
                    {t.title}
                  </Link>
                </td>
                <td
                  className="max-w-[14rem] truncate px-4 py-2.5 text-neutral-600"
                  title={t.buyer ?? ""}
                >
                  {t.buyer}
                </td>
                <td className="px-4 py-2.5">
                  <span
                    className={`rounded-md px-2 py-0.5 text-xs font-bold ${labelChip(t.label)}`}
                  >
                    {t.label}
                  </span>
                </td>
                <td className="px-4 py-2.5 font-semibold tabular-nums">{t.score}</td>
                <td className={`px-4 py-2.5 tabular-nums ${deadlineClass(t.days_to_deadline)}`}>
                  {deadlineText(t.deadline, t.days_to_deadline)}
                </td>
                <td className="px-4 py-2.5 text-xs text-neutral-500">
                  {t.pipeline_stage ?? "—"}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-neutral-400">
                  No open {showCold ? "" : "Warm+ "}tenders right now. The scraper runs daily at 09:00.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
