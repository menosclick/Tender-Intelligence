import Link from "next/link";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { labelChip, deadlineText, deadlineClass, daysUntil } from "@/lib/format";

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
      <h1 className="text-lg font-semibold">Search the archive</h1>
      <p className="mt-1 text-sm text-neutral-500">
        All scraped tenders, including ones the scoring pipeline disqualified.
      </p>

      <form method="get" className="mt-4 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_10rem_8rem_auto_auto]">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search title, description, buyer… (Dutch)"
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
          <select
            name="label"
            defaultValue={label}
            className="rounded-md border border-neutral-300 bg-white px-2 py-2 text-sm"
          >
            <option value="">Any label</option>
            <option>Hot</option>
            <option>Warm</option>
            <option>Cold</option>
            <option>Disqualified</option>
          </select>
          <input
            name="cpv"
            defaultValue={cpv}
            placeholder="CPV prefix"
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
          <label className="flex items-center gap-2 text-sm text-neutral-600">
            <input type="checkbox" name="open" value="1" defaultChecked={open === "1"} />
            Open only
          </label>
          <button className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
            Search
          </button>
        </div>
      </form>

      {hasQuery && (
        <div className="mt-4 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
          <p className="border-b border-neutral-200 px-4 py-2 text-xs text-neutral-500">
            {results.length} result{results.length === 1 ? "" : "s"}
            {results.length === 100 ? " (first 100 shown)" : ""}
          </p>
          <table className="w-full text-sm">
            <tbody>
              {results.map((t) => {
                const days = daysUntil(t.sluiting_datum);
                return (
                  <tr key={t.id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
                    <td className="max-w-sm px-4 py-2.5">
                      <Link
                        href={`/tender/${t.id}`}
                        className="block truncate font-medium hover:text-accent hover:underline"
                        title={t.naam ?? ""}
                      >
                        {t.naam}
                      </Link>
                    </td>
                    <td className="max-w-[14rem] truncate px-4 py-2.5 text-neutral-600" title={t.opdrachtgever ?? ""}>
                      {t.opdrachtgever}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${labelChip(t.label)}`}>
                        {t.label ?? "unscored"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 tabular-nums">{t.score ?? "—"}</td>
                    <td className={`px-4 py-2.5 tabular-nums ${deadlineClass(days)}`}>
                      {deadlineText(t.sluiting_datum, days)}
                    </td>
                  </tr>
                );
              })}
              {results.length === 0 && (
                <tr>
                  <td className="px-4 py-8 text-center text-neutral-400">
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
