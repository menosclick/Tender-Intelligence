import Link from "next/link";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { deadlineText, deadlineClass, stageLabel, asArray } from "@/lib/format";
import { classifyDomain, CORE_DOMAINS } from "@/lib/domains";
import { LabelChip, PageHeader, btnSecondary, microLabel } from "@/lib/ui";
import { addToBoard, recordFeedback } from "@/lib/actions";
import { InboxFilters } from "./filters";

export const dynamic = "force-dynamic";

// Tender Inbox: discovery and qualification. Every open qualified tender lands
// here; the daily decision is "pursue it (→ Tender Pipeline) or hide it".
// The full-table view moved here from the dashboard in the command-center
// iteration — the dashboard now only shows the five latest.

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
  recommended_products: unknown;
};

const DUE_BUCKETS = [
  { key: "14", label: "≤ 14 days", test: (d: number) => d <= 14 },
  { key: "30", label: "15–30 days", test: (d: number) => d > 14 && d <= 30 },
  { key: "60", label: "31–60 days", test: (d: number) => d > 30 && d <= 60 },
  { key: "365", label: "> 60 days", test: (d: number) => d > 60 && d <= 365 },
  { key: "long", label: "Long-term", test: (d: number) => d > 365 },
];

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const first = (v: string | string[] | undefined) =>
    Array.isArray(v) ? v[0] ?? "" : v ?? "";
  const LABELS = ["warmplus", "all", "Hot", "Warm", "Cold", "Monitor"];
  let label = first(params.label) || "warmplus";
  if (!LABELS.includes(label)) label = "warmplus";
  const q = first(params.q).slice(0, 100);
  const buyerParam = first(params.buyer);
  const domainParam = first(params.domain);
  const due = DUE_BUCKETS.some((b) => b.key === first(params.due)) ? first(params.due) : "";

  const admin = createSupabaseAdmin();
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  let query = admin
    .from("v_app_tenders")
    .select(
      "id,title,buyer,buyer_type,label,score,deadline,days_to_deadline,pipeline_stage,recommended_products"
    )
    .gte("days_to_deadline", 0)
    .order("score", { ascending: false })
    .order("deadline", { ascending: true });
  if (q) {
    // Same PostgREST-neutralizing sanitization as the archive search.
    const safe = q.replace(/[,()\\%]/g, " ").trim();
    if (safe) {
      const like = `%${safe}%`;
      query = query.or(`title.ilike.${like},buyer.ilike.${like}`);
    }
  }

  const [{ data: open }, { data: fresh }, { data: feedback }] = await Promise.all([
    query,
    admin.from("tenders_scraped").select("id").gte("scraped_at", since),
    admin.from("tender_feedback").select("tender_id,value").eq("kind", "relevance"),
  ]);

  const openAll = (open ?? []) as Row[];
  const freshIds = new Set((fresh ?? []).map((f) => f.id));
  const notRelevantIds = new Set(
    (feedback ?? []).filter((f) => f.value === "not_relevant").map((f) => f.tender_id)
  );
  const visible = openAll.filter((t) => !notRelevantIds.has(t.id));
  const hiddenCount = openAll.length - visible.length;

  // Keyword provenance improves the domain classification (small .in()).
  const { data: extras } = visible.length
    ? await admin
        .from("tenders_scraped")
        .select("id,keyword_matches")
        .in("id", visible.map((t) => t.id))
    : { data: [] as { id: number; keyword_matches: string[] | null }[] };
  const extrasById = new Map((extras ?? []).map((e) => [e.id, e]));
  const domainOf = (t: Row) =>
    classifyDomain([
      t.title,
      asArray(t.recommended_products).join(" "),
      (extrasById.get(t.id)?.keyword_matches ?? []).join(" "),
    ]);

  // Filters
  const buyerTypes = [...new Set(visible.map((t) => t.buyer_type ?? "unknown"))].sort();
  const buyer = buyerTypes.includes(buyerParam) ? buyerParam : "";
  const domains = [
    ...CORE_DOMAINS,
    ...[...new Set(visible.map(domainOf))].filter((d) => !CORE_DOMAINS.includes(d)).sort(),
  ];
  const domain = domains.includes(domainParam) ? domainParam : "";

  let rows = visible;
  if (label === "warmplus") rows = rows.filter((t) => t.label === "Hot" || t.label === "Warm");
  else if (label !== "all") rows = rows.filter((t) => t.label === label);
  if (buyer) rows = rows.filter((t) => (t.buyer_type ?? "unknown") === buyer);
  if (domain) rows = rows.filter((t) => domainOf(t) === domain);
  if (due) {
    const bucket = DUE_BUCKETS.find((b) => b.key === due);
    if (bucket)
      rows = rows.filter((t) => t.days_to_deadline !== null && bucket.test(t.days_to_deadline));
  }

  const filtersActive = label !== "warmplus" || buyer !== "" || domain !== "" || due !== "" || q !== "";

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Tender Inbox"
        sub={`${visible.length} open tender${visible.length === 1 ? "" : "s"}${
          hiddenCount > 0 ? ` · ${hiddenCount} hidden as not relevant` : ""
        } — qualify them into the pipeline or hide them.`}
        actions={
          <Link href="/tender/new" className={btnSecondary}>
            Add tender
          </Link>
        }
      />

      <InboxFilters
        q={q}
        label={label}
        domain={domain}
        buyer={buyer}
        due={due}
        domains={domains}
        buyerTypes={buyerTypes}
        // The bucket predicates stay on the server; the client only needs the
        // key and its display name.
        dueBuckets={DUE_BUCKETS.map((b) => ({ value: b.key, label: b.label }))}
        filtersActive={filtersActive}
      />

      {/* relative: the sr-only header is position:absolute — without a
          positioned ancestor its static position inside the wide table row
          becomes phantom document scroll area on mobile. */}
      <div className="relative mt-5 overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full min-w-[52rem] text-sm">
          <thead>
            <tr className={`border-b border-line text-left ${microLabel}`}>
              <th className="px-4 py-2.5">Tender</th>
              <th className="px-4 py-2.5">Buyer</th>
              <th className="px-4 py-2.5">Domain</th>
              <th className="px-4 py-2.5">Label · score</th>
              <th className="px-4 py-2.5">Deadline</th>
              <th className="px-4 py-2.5">Pipeline</th>
              <th className="px-4 py-2.5">
                <span className="sr-only">Actions</span>
              </th>
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
                      <span className="shrink-0 rounded-full bg-accent-soft px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-accent-fg">
                        New
                      </span>
                    )}
                  </div>
                </td>
                <td className="max-w-[12rem] truncate px-4 py-3 text-fg-mid" title={t.buyer ?? ""}>
                  {t.buyer}
                </td>
                <td className="px-4 py-3 text-fg-mid">{domainOf(t)}</td>
                <td className="px-4 py-3">
                  <LabelChip label={t.label} score={t.score} />
                </td>
                <td className={`px-4 py-3 tabular-nums ${deadlineClass(t.days_to_deadline)}`}>
                  {deadlineText(t.deadline, t.days_to_deadline)}
                </td>
                <td className="px-4 py-3 text-xs text-fg-soft">
                  {t.pipeline_stage ? stageLabel(t.pipeline_stage) : "—"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    {!t.pipeline_stage && (
                      <form action={addToBoard.bind(null, t.id)}>
                        <button
                          className="text-xs font-medium text-accent-fg transition-colors duration-150 hover:underline"
                          title="Add to Tender Pipeline (stage: Identified)"
                        >
                          Add to pipeline
                        </button>
                      </form>
                    )}
                    <form action={recordFeedback.bind(null, t.id, "relevance", "not_relevant")}>
                      <button
                        className="text-xs font-medium text-fg-soft transition-colors duration-150 hover:text-hot"
                        title="Hide as not relevant — teaches the scoring loop"
                      >
                        Hide
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-sm text-fg-soft">
                  {filtersActive
                    ? "No open tenders match these filters."
                    : "No open Warm+ tenders right now. The scraper runs daily at 09:00."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
