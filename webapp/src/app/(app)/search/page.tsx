import Link from "next/link";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { deadlineText, deadlineClass, daysUntil } from "@/lib/format";
import { LabelChip, PageHeader, btnPrimary, inputCls, microLabel } from "@/lib/ui";

export const dynamic = "force-dynamic";

// Phase 3: search the FULL archive (incl. Disqualified) — read-only on tenders_scraped.
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    label?: string;
    cpv?: string;
    open?: string;
  }>;
}) {
  const { q = "", label = "", cpv = "", open = "" } = await searchParams;
  const hasQuery = q || label || cpv || open;
  const admin = createSupabaseAdmin();

  let results: {
    id: number;
    naam: string | null;
    opdrachtgever: string | null;
    label: string | null;
    score: number | null;
    sluiting_datum: string | null;
    cpv_main: string | null;
  }[] = [];

  if (hasQuery) {
    let query = admin
      .from("tenders_scraped")
      .select("id,naam,opdrachtgever,label,score,sluiting_datum,cpv_main")
      .order("score", { ascending: false, nullsFirst: false })
      .limit(100);

    if (q) {
      // Neutralize PostgREST .or() filter syntax: strip commas (term separator),
      // parens (group delimiters), backslashes, and % wildcards so a crafted `q`
      // is always treated as a literal substring and can never break out.
      const safe = q.replace(/[,()\\%]/g, " ").trim();
      if (safe) {
        const like = `%${safe}%`;
        query = query.or(
          `naam.ilike.${like},beschrijving.ilike.${like},opdrachtgever.ilike.${like}`
        );
      }
    }
    if (label) query = query.eq("label", label);
    if (cpv) query = query.ilike("cpv_main", `${cpv.replaceAll("%", "")}%`);
    if (open === "1") {
      const now = new Date();
      const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      query = query.gte("sluiting_datum", localToday);
    }

    const { data } = await query;
    results = data ?? [];
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Search the archive"
        sub="All scraped tenders, including ones the scoring pipeline disqualified."
      />

      <form
        method="get"
        className="mt-5 rounded-xl border border-line bg-surface p-4"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_10rem_8rem_auto_auto] sm:items-center">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search title, description, buyer (Dutch)"
            className={inputCls}
          />
          <select name="label" defaultValue={label} className={inputCls}>
            <option value="">Any label</option>
            <option>Hot</option>
            <option>Warm</option>
            <option>Cold</option>
            <option>Monitor</option>
            <option>Disqualified</option>
          </select>
          <input
            name="cpv"
            defaultValue={cpv}
            placeholder="CPV prefix"
            className={`${inputCls} font-mono`}
          />
          <label className="flex items-center gap-2 text-sm text-fg-mid">
            <input
              type="checkbox"
              name="open"
              value="1"
              defaultChecked={open === "1"}
              className="h-4 w-4 accent-accent"
            />
            Open only
          </label>
          <button className={btnPrimary}>Search</button>
        </div>
      </form>

      {hasQuery && (
        <div className="mt-5 overflow-hidden rounded-xl border border-line bg-surface">
          <p className="border-b border-line px-4 py-2 text-xs text-fg-soft">
            {results.length} result{results.length === 1 ? "" : "s"}
            {results.length === 100 ? " (first 100 shown)" : ""}
          </p>
          <table className="w-full text-sm">
            <thead>
              <tr className={`border-b border-line text-left ${microLabel}`}>
                <th className="px-4 py-2.5">Tender</th>
                <th className="px-4 py-2.5">Buyer</th>
                <th className="px-4 py-2.5">Label</th>
                <th className="px-4 py-2.5 text-right">Score</th>
                <th className="px-4 py-2.5">Deadline</th>
              </tr>
            </thead>
            <tbody>
              {results.map((t) => {
                const days = daysUntil(t.sluiting_datum);
                return (
                  <tr
                    key={t.id}
                    className="border-b border-line/60 transition-colors duration-150 last:border-0 hover:bg-sunken/60"
                  >
                    <td className="max-w-sm px-4 py-3">
                      <Link
                        href={`/tender/${t.id}`}
                        className="block truncate font-medium text-fg hover:text-accent-fg hover:underline"
                        title={t.naam ?? ""}
                      >
                        {t.naam}
                      </Link>
                    </td>
                    <td
                      className="max-w-[14rem] truncate px-4 py-3 text-fg-mid"
                      title={t.opdrachtgever ?? ""}
                    >
                      {t.opdrachtgever}
                    </td>
                    <td className="px-4 py-3">
                      <LabelChip label={t.label} />
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">
                      {t.score ?? "—"}
                    </td>
                    <td className={`px-4 py-3 tabular-nums ${deadlineClass(days)}`}>
                      {deadlineText(t.sluiting_datum, days)}
                    </td>
                  </tr>
                );
              })}
              {results.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-fg-soft">
                    No tenders match. Try fewer filters or a shorter keyword.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
