import Link from "next/link";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { deadlineText, deadlineClass, BOARD_STAGES, stageLabel } from "@/lib/format";
import { LabelChip, PageHeader, btnPrimary, btnSecondary, microLabel } from "@/lib/ui";
import { Kpi, ChartCard, HBarList, Columns } from "@/lib/viz";

export const dynamic = "force-dynamic";

type Row = {
  id: number;
  title: string | null;
  buyer: string | null;
  buyer_type: string | null;
  label: string | null;
  score: number | null;
  deadline: string | null;
  days_to_deadline: number | null;
  pipeline_stage: string | null;
};

// inputCls minus w-full: compact inline filter controls.
const selectCls =
  "rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-sm text-fg transition-colors duration-150 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20";

const DUE_BUCKETS = [
  { key: "14", label: "≤ 14 days", test: (d: number) => d <= 14 },
  { key: "30", label: "15–30 days", test: (d: number) => d > 14 && d <= 30 },
  { key: "60", label: "31–60 days", test: (d: number) => d > 30 && d <= 60 },
  { key: "365", label: "> 60 days", test: (d: number) => d > 60 && d <= 365 },
  { key: "long", label: "Long-term", test: (d: number) => d > 365 },
];

// The anchor screen: a glanceable overview (KPIs + charts) on top of the
// daily work queue. Replaces the email digest — scanability first.
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const first = (v: string | string[] | undefined) =>
    Array.isArray(v) ? v[0] ?? "" : v ?? "";
  const LABELS = ["warmplus", "all", "Hot", "Warm", "Cold", "Monitor"];
  // `show=all` is the pre-redesign toggle URL — keep old bookmarks meaningful.
  let label = first(params.label) || (first(params.show) === "all" ? "all" : "warmplus");
  if (!LABELS.includes(label)) label = "warmplus";
  const buyerParam = first(params.buyer);
  const due = DUE_BUCKETS.some((b) => b.key === first(params.due)) ? first(params.due) : "";
  const admin = createSupabaseAdmin();

  // "New" = scraped in the last 24h (covers this morning's 09:00 run until tomorrow's).
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const activeStages = ["New", "Reviewing", "Bidding", "Submitted"];
  // Intake chart window: first day of the month 5 months back, in UTC.
  const nowUtc = new Date();
  const windowStart = new Date(Date.UTC(nowUtc.getUTCFullYear(), nowUtc.getUTCMonth() - 5, 1));

  const [{ data: open }, scraped, { data: fresh }, { data: feedback }, { data: board }, { data: qualifiedAll }] =
    await Promise.all([
      admin
        .from("v_app_tenders")
        .select(
          "id,title,buyer,buyer_type,label,score,deadline,days_to_deadline,pipeline_stage"
        )
        .gte("days_to_deadline", 0)
        .order("score", { ascending: false })
        .order("deadline", { ascending: true }),
      admin.from("tenders_scraped").select("id", { count: "exact", head: true }),
      admin.from("tenders_scraped").select("id").gte("scraped_at", since),
      // Relevance only — outcomes are fetched per board card below, so neither
      // query can drift toward PostgREST's silent 1,000-row cap.
      admin.from("tender_feedback").select("tender_id,value").eq("kind", "relevance"),
      admin.from("bid_pipeline").select("tender_id,stage"),
      // Historical context for the intake chart — bounded to the visible
      // window so the query can never hit PostgREST's 1,000-row cap silently.
      admin
        .from("tenders_scraped")
        .select("scraped_at")
        .eq("status", "analyzed")
        .not("label", "is", null)
        .neq("label", "Disqualified")
        .gte("scraped_at", windowStart.toISOString()),
    ]);

  const openRows = (open ?? []) as Row[];
  const freshIds = new Set((fresh ?? []).map((f) => f.id));
  const fb = feedback ?? [];
  const notRelevantIds = new Set(
    fb.filter((f) => f.value === "not_relevant").map((f) => f.tender_id)
  );
  const reviewedIds = new Set(fb.map((f) => f.tender_id));

  // Board cards that likely need an outcome recorded: Bidding/Submitted with a
  // deadline already past and no final outcome yet — the fuel the learning loop lacks.
  const boardCards = (board ?? []) as { tender_id: number; stage: string }[];
  const decidedCards = boardCards.filter((b) => ["Bidding", "Submitted"].includes(b.stage));
  const decidedIds = decidedCards.map((b) => b.tender_id);
  const [{ data: decidedTenders }, { data: outcomes }] = decidedIds.length
    ? await Promise.all([
        admin.from("tenders_scraped").select("id,naam,sluiting_datum").in("id", decidedIds),
        admin
          .from("tender_feedback")
          .select("tender_id,value")
          .eq("kind", "outcome")
          .in("tender_id", decidedIds),
      ])
    : [{ data: [] as { id: number; naam: string | null; sluiting_datum: string | null }[] }, { data: [] }];
  const outcomeByTender = new Map((outcomes ?? []).map((f) => [f.tender_id, f.value]));
  const today = new Date().toISOString().slice(0, 10);
  // won/lost/no_bid are final; "bidding" (auto-set on stage moves) is not.
  const needsOutcome = (decidedTenders ?? []).filter(
    (t) =>
      t.sluiting_datum !== null &&
      t.sluiting_datum < today &&
      !["won", "lost", "no_bid"].includes(outcomeByTender.get(t.id) ?? "")
  );

  // "Needs attention" — computed actions, priority order, deduped by tender.
  const attention: { id: number; title: string; note: string; urgent: boolean }[] = [];
  const seen = new Set<number>();
  const push = (id: number, title: string | null, note: string, urgent = false) => {
    if (seen.has(id)) return;
    seen.add(id);
    attention.push({ id, title: title ?? `Tender #${id}`, note, urgent });
  };
  for (const t of needsOutcome)
    push(t.id, t.naam, "Deadline passed — record the outcome (Won / Lost / No bid)", true);
  // Within the closing group, soonest deadline first — so the cap can never
  // drop a tender closing tomorrow in favor of one closing in two weeks.
  const closingSoon = openRows
    .filter(
      (t) =>
        (t.label === "Hot" || t.label === "Warm") &&
        (t.days_to_deadline ?? 99) <= 14 &&
        !t.pipeline_stage &&
        !notRelevantIds.has(t.id)
    )
    .sort((a, b) => (a.days_to_deadline ?? 0) - (b.days_to_deadline ?? 0));
  for (const t of closingSoon)
    push(
      t.id,
      t.title,
      t.days_to_deadline === 0
        ? "Closing today — decide bid or drop"
        : `Closing in ${t.days_to_deadline}d — decide bid or drop`,
      true
    );
  for (const t of openRows)
    if (t.label === "Hot" && freshIds.has(t.id))
      push(t.id, t.title, "New Hot from this morning's scrape — review it");
  for (const t of openRows)
    if (t.label === "Hot" && !reviewedIds.has(t.id) && !t.pipeline_stage)
      push(t.id, t.title, "Hot but never reviewed — mark Relevant / Not relevant");
  const attentionShown = attention.slice(0, 6);
  const attentionOverflow = attention.length - attentionShown.length;

  // Next real dates, soonest first — never resurfacing what was marked not relevant.
  const upcoming = [...openRows]
    .filter((t) => t.days_to_deadline !== null && !notRelevantIds.has(t.id))
    .sort((a, b) => (a.days_to_deadline ?? 0) - (b.days_to_deadline ?? 0))
    .slice(0, 6);

  // KPIs read the whole open set — the overview stays stable while filters
  // below slice the charts and the queue.
  const kpis = {
    open: openRows.length,
    hot: openRows.filter((t) => t.label === "Hot").length,
    fresh: openRows.filter((t) => freshIds.has(t.id)).length,
    closing: openRows.filter((t) => (t.days_to_deadline ?? 999) <= 14).length,
    onBoard: (board ?? []).filter((b) => activeStages.includes(b.stage)).length,
  };

  // Filters
  const buyerTypes = [...new Set(openRows.map((t) => t.buyer_type ?? "unknown"))].sort();
  const buyer = buyerTypes.includes(buyerParam) ? buyerParam : "";
  let rows = openRows;
  if (label === "warmplus") rows = rows.filter((t) => t.label === "Hot" || t.label === "Warm");
  else if (label !== "all") rows = rows.filter((t) => t.label === label);
  if (buyer) rows = rows.filter((t) => (t.buyer_type ?? "unknown") === buyer);
  if (due) {
    const bucket = DUE_BUCKETS.find((b) => b.key === due);
    if (bucket) rows = rows.filter((t) => t.days_to_deadline !== null && bucket.test(t.days_to_deadline));
  }

  // Feedback must have a visible consequence: rows marked "Not relevant" drop
  // to the bottom, visually demoted — still inspectable, no longer competing.
  rows = [...rows].sort(
    (a, b) => Number(notRelevantIds.has(a.id)) - Number(notRelevantIds.has(b.id))
  );
  const markedCount = rows.filter((t) => notRelevantIds.has(t.id)).length;

  // Charts (respect the filters). Zero-count buckets stay visible — "0 urgent"
  // is the most valuable reading of the deadline chart, not noise.
  const byDeadline =
    rows.length === 0
      ? []
      : DUE_BUCKETS.map((b) => ({
          label: b.label,
          count: rows.filter((t) => t.days_to_deadline !== null && b.test(t.days_to_deadline))
            .length,
          hot: b.key === "14",
        }));

  const byBuyerCount = new Map<string, number>();
  for (const t of rows) {
    const k = t.buyer_type ?? "unknown";
    byBuyerCount.set(k, (byBuyerCount.get(k) ?? 0) + 1);
  }
  const byBuyer = [...byBuyerCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => ({ label: k, count: v }));

  // Qualified intake, last 6 months (historical, not filtered). Month keys in
  // UTC to match the window bound; leading empty months trimmed.
  const months: { label: string; value: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(nowUtc.getUTCFullYear(), nowUtc.getUTCMonth() - i, 1));
    const key = d.toISOString().slice(0, 7);
    months.push({
      label: d.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" }),
      value: (qualifiedAll ?? []).filter((q) => (q.scraped_at ?? "").startsWith(key)).length,
    });
  }
  const firstActive = months.findIndex((m) => m.value > 0);
  const intake = firstActive === -1 ? [] : months.slice(firstActive);

  const filtersActive = label !== "warmplus" || buyer !== "" || due !== "";

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Open tenders"
        sub={`${kpis.open} qualified and open · ${scraped.count ?? 0} scraped in total`}
        actions={
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
        }
      />

      {/* KPI overview — whole open set, unaffected by filters */}
      <dl className="mt-5 flex flex-col divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface sm:flex-row sm:divide-x sm:divide-y-0">
        <Kpi label="Open now" value={kpis.open} sub="qualified, deadline ahead" />
        <Kpi label="Hot" value={kpis.hot} sub="top-priority matches" tone={kpis.hot > 0 ? "hot" : undefined} />
        <Kpi label="New today" value={kpis.fresh} sub="from this morning's scrape" tone={kpis.fresh > 0 ? "accent" : undefined} />
        <Kpi label="Closing ≤ 14d" value={kpis.closing} sub="act this sprint or drop" tone={kpis.closing > 0 ? "hot" : undefined} />
        <Kpi label="On bid board" value={kpis.onBoard} sub="Identified → Submitted" />
      </dl>

      {/* Cockpit panels: what needs a decision, and what's coming */}
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <ChartCard title="Needs attention">
          {attentionShown.length === 0 ? (
            <p className="py-4 text-center text-xs text-fg-soft">
              All caught up — nothing needs a decision right now.
            </p>
          ) : (
            <ul className="space-y-2.5">
              {attentionShown.map((a) => (
                <li key={a.id} className="text-sm leading-snug">
                  <Link
                    href={`/tender/${a.id}`}
                    className="block truncate font-medium text-fg hover:text-accent-fg hover:underline"
                    title={a.title}
                  >
                    {a.title}
                  </Link>
                  <p className={`text-xs ${a.urgent ? "font-medium text-hot" : "text-fg-mid"}`}>
                    {a.note}
                  </p>
                </li>
              ))}
              {attentionOverflow > 0 && (
                <li className="text-xs text-fg-soft">
                  +{attentionOverflow} more need attention
                </li>
              )}
            </ul>
          )}
        </ChartCard>
        <ChartCard title="Upcoming deadlines">
          {upcoming.length === 0 ? (
            <p className="py-4 text-center text-xs text-fg-soft">No open deadlines ahead.</p>
          ) : (
            <ul className="space-y-2">
              {upcoming.map((t) => (
                <li key={t.id} className="flex items-baseline gap-3 text-sm">
                  <span
                    className={`w-24 shrink-0 tabular-nums ${deadlineClass(t.days_to_deadline)}`}
                  >
                    {t.deadline}
                  </span>
                  <Link
                    href={`/tender/${t.id}`}
                    className="min-w-0 flex-1 truncate text-fg hover:text-accent-fg hover:underline"
                    title={t.title ?? ""}
                  >
                    {t.title ?? `Tender #${t.id}`}
                  </Link>
                  <span className={`shrink-0 text-xs tabular-nums ${deadlineClass(t.days_to_deadline)}`}>
                    {(t.days_to_deadline ?? 0) > 365 ? "long-term" : `${t.days_to_deadline}d`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </ChartCard>
      </div>

      {/* Bid pipeline funnel — counts per stage, straight to the board */}
      <Link
        href="/board"
        className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-line bg-surface px-4 py-3 transition-colors duration-150 hover:border-line-strong"
      >
        <span className={`${microLabel} mr-2`}>Bid pipeline</span>
        {BOARD_STAGES.map((s, i) => {
          const n = boardCards.filter((b) => b.stage === s).length;
          return (
            <span key={s} className="flex items-center gap-2 text-sm">
              {i > 0 && (
                <span className="text-fg-soft" aria-hidden="true">
                  →
                </span>
              )}
              <span className={n > 0 ? "font-medium text-fg" : "text-fg-soft"}>
                {stageLabel(s)} <span className="tabular-nums">{n}</span>
              </span>
            </span>
          );
        })}
        <span className="ml-auto text-xs font-medium text-accent-fg">Open board →</span>
      </Link>

      {/* Filters — slice the charts and the queue below */}
      <form
        method="get"
        className="mt-5 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2.5"
      >
        <span className={`${microLabel} mr-1`}>Filter</span>
        <select name="label" defaultValue={label} className={selectCls} aria-label="Label">
          <option value="warmplus">Hot + Warm</option>
          <option value="all">All labels</option>
          <option value="Hot">Hot only</option>
          <option value="Warm">Warm only</option>
          <option value="Cold">Cold only</option>
          <option value="Monitor">Monitor only</option>
        </select>
        <select name="buyer" defaultValue={buyer} className={selectCls} aria-label="Buyer type">
          <option value="">Any buyer type</option>
          {buyerTypes.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
        <select name="due" defaultValue={due} className={selectCls} aria-label="Deadline">
          <option value="">Any deadline</option>
          {DUE_BUCKETS.map((b) => (
            <option key={b.key} value={b.key}>
              {b.label}
            </option>
          ))}
        </select>
        <button className={`${btnPrimary} py-1.5`}>Apply</button>
        {filtersActive && (
          <Link
            href="/dashboard"
            className="text-sm font-medium text-fg-soft transition-colors duration-150 hover:text-accent-fg"
          >
            Clear
          </Link>
        )}
      </form>

      {/* Work queue */}
      <h2 className={`${microLabel} mt-8`}>
        Work queue · {rows.length} tender{rows.length === 1 ? "" : "s"}
        {markedCount > 0 ? ` (${markedCount} marked not relevant)` : ""}
      </h2>
      <div className="mt-2 overflow-hidden rounded-xl border border-line bg-surface">
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
                className={`border-b border-line/60 transition-colors duration-150 last:border-0 hover:bg-sunken/60 ${
                  notRelevantIds.has(t.id) ? "bg-sunken/50" : ""
                }`}
              >
                <td className="max-w-sm px-4 py-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <Link
                      href={`/tender/${t.id}`}
                      className={`truncate font-medium hover:text-accent-fg hover:underline ${
                        notRelevantIds.has(t.id) ? "text-fg-mid" : "text-fg"
                      }`}
                      title={t.title ?? ""}
                    >
                      {t.title}
                    </Link>
                    {freshIds.has(t.id) && (
                      <span className="shrink-0 rounded-full bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent-fg">
                        New
                      </span>
                    )}
                    {notRelevantIds.has(t.id) && (
                      <span className="shrink-0 rounded-full bg-sunken px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-fg-mid">
                        Not relevant
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
                  {t.pipeline_stage ? stageLabel(t.pipeline_stage) : "—"}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-fg-soft">
                  {filtersActive
                    ? "No open tenders match these filters."
                    : "No open Warm+ tenders right now. The scraper runs daily at 09:00."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Analytics context — follows the same filters as the queue */}
      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <ChartCard title="By deadline">
          <HBarList rows={byDeadline} />
        </ChartCard>
        <ChartCard title="By buyer type">
          <HBarList rows={byBuyer} />
        </ChartCard>
        <ChartCard title="Qualified intake · last months">
          <Columns points={intake} />
        </ChartCard>
      </div>
    </div>
  );
}
