import Link from "next/link";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import {
  deadlineText,
  deadlineClass,
  stageLabel,
  asArray,
  isEarlyActive,
  EARLY_STAGES,
  EARLY_STAGE_LABEL,
  EARLY_STAGE_MEANING,
  earlyStageChip,
  earlyStageLabel,
} from "@/lib/format";
import { classifyDomain, CORE_DOMAINS } from "@/lib/domains";
import { LabelChip, PageHeader, PubTypeChip, btnSecondary, microLabel } from "@/lib/ui";
import {
  addToBoard,
  recordFeedback,
  setEarlyStage,
  setIsEarlySignal,
} from "@/lib/actions";
import { InboxFilters } from "./filters";
import { brokerFor } from "@/lib/partner-territory";

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
  publicatie_type: string | null;
  early_stage: string | null;
  is_early: boolean | null;
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
  // What KIND of publication to show. Consultations and pre-announcements are
  // not biddable, so they are opt-in rather than mixed into the bid list by
  // default: "tenders" keeps this screen the daily pursue/hide loop it is.
  const KINDS = ["tenders", "early", "all"];
  let kind = first(params.kind) || "tenders";
  if (!KINDS.includes(kind)) kind = "tenders";

  const admin = createSupabaseAdmin();
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  let query = admin
    .from("v_app_tenders")
    .select(
      "id,title,buyer,buyer_type,label,score,deadline,days_to_deadline,pipeline_stage,recommended_products,publicatie_type,early_stage,is_early"
    )
    // A tender with no published deadline is still open — the pipeline's own
    // v_pipeline_active says so. PostgREST gte() is never true for NULL, so
    // filtering on gte alone silently dropped qualified tenders from the app.
    .or("days_to_deadline.gte.0,days_to_deadline.is.null")
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
    classifyDomain(
      [t.title, (extrasById.get(t.id)?.keyword_matches ?? []).join(" ")],
      asArray(t.recommended_products)
    );

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
  if (kind === "tenders") rows = rows.filter((t) => !t.is_early);
  else if (kind === "early") {
    // A consultation Derson has dropped is a decision already made, so it
    // leaves the working list the same way a hidden tender does.
    rows = rows.filter(
      (t) => t.is_early && t.early_stage !== "dropped"
    );
    // The ones being worked come first: this tab is the follow-up list.
    rows = [...rows].sort(
      (a, b) => Number(isEarlyActive(b.early_stage)) - Number(isEarlyActive(a.early_stage))
    );
  }
  if (buyer) rows = rows.filter((t) => (t.buyer_type ?? "unknown") === buyer);
  if (domain) rows = rows.filter((t) => domainOf(t) === domain);
  if (due) {
    const bucket = DUE_BUCKETS.find((b) => b.key === due);
    if (bucket)
      rows = rows.filter((t) => t.days_to_deadline !== null && bucket.test(t.days_to_deadline));
  }

  const filtersActive =
    label !== "warmplus" || buyer !== "" || domain !== "" || due !== "" || q !== "" || kind !== "tenders";

  // Describes what the table below actually shows. The old count spanned all
  // labels and moved whenever a search was typed, so the header and the rows
  // under it described different sets.
  // Say which of the two things is on screen. A consultation cannot be
  // "qualified into the pipeline", so the instruction changes with the view.
  const noun =
    kind === "early" ? "early signal" : kind === "all" ? "publication" : "tender";
  const action =
    kind === "early"
      ? "Not biddable yet. The buyer is exploring options for a potential RFP."
      : "Qualify them into the pipeline or hide them.";
  const subtitle = `${rows.length} ${noun}${rows.length === 1 ? "" : "s"} shown${
    filtersActive ? " (filtered)" : ""
  }${hiddenCount > 0 ? ` · ${hiddenCount} hidden as not relevant` : ""}. ${action}`;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Tender Inbox"
        sub={subtitle}
        actions={
          <Link href="/tender/new" className={btnSecondary}>
            Add tender
          </Link>
        }
      />

      <InboxFilters
        q={q}
        kind={kind}
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
        <table className="w-full min-w-[44rem] text-sm">
          <thead>
            <tr className={`border-b border-line text-left ${microLabel}`}>
              <th className="px-4 py-2.5">Tender</th>
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
                    <PubTypeChip pubType={t.publicatie_type} />
                    {freshIds.has(t.id) && (
                      <span className="shrink-0 rounded-full bg-accent-soft px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-accent-fg">
                        New
                      </span>
                    )}
                  </div>
                  {/* The buyer repeats here, under the title, even though it
                      has its own column: four separate Identity/Access tenders
                      (Radboud, Zaanstad, DUO, Van Hall) open with near-identical
                      Dutch titles, and at a column's distance the eye compares
                      titles and calls them duplicates (Derson, 2026-09-07).
                      The buyer is what tells them apart, so it belongs next to
                      the thing it disambiguates. */}
                  <span className="mt-0.5 block truncate text-xs text-fg-soft">
                    {t.buyer}
                  </span>
                  {/* If this buyer has appointed a single-source software
                      broker, CBA cannot sell it direct: the broker is the
                      route in. That decides HOW to pursue the tender, so it
                      belongs on the row where the pursue/hide call is made.
                      The chip carries its own caveat rather than asserting
                      more than the source supports, and says which contract
                      matched, since a buyer can be reached through a joint
                      body it belongs to (Gemert-Bakel via Bizob). */}
                  {(() => {
                    const broker = brokerFor(t.buyer);
                    if (!broker || broker.status !== "held") return null;
                    const via =
                      broker.buyer.toLowerCase() ===
                      String(t.buyer ?? "").toLowerCase()
                        ? broker.buyer
                        : `${broker.buyer}, which it belongs to`;
                    return (
                      <span
                        className="mt-1 inline-block rounded bg-warm-soft px-1.5 py-0.5 text-xs font-medium text-warm"
                        title={
                          `Software for this buyer routes through ${broker.holder} under the broker contract held by ${via}. ${broker.term}.` +
                          (broker.unverified ? ` Caveat: ${broker.unverified}.` : "")
                        }
                      >
                        via {broker.holder}
                      </span>
                    );
                  })()}
                </td>
                <td className="px-4 py-3 text-fg-mid">{domainOf(t)}</td>
                <td className="px-4 py-3">
                  <LabelChip label={t.label} score={t.score} />
                </td>
                <td className={`px-4 py-3 tabular-nums ${deadlineClass(t.days_to_deadline)}`}>
                  {deadlineText(t.deadline, t.days_to_deadline, t.publicatie_type)}
                </td>
                <td className="px-4 py-3 text-xs text-fg-soft">
                  {t.is_early ? (
                    <span
                      className={`inline-flex rounded px-1.5 py-0.5 font-medium ${earlyStageChip(
                        t.early_stage
                      )}`}
                      title={
                        EARLY_STAGE_MEANING[t.early_stage ?? "new"] ??
                        EARLY_STAGE_MEANING.new
                      }
                    >
                      {earlyStageLabel(t.early_stage)}
                    </span>
                  ) : t.pipeline_stage ? (
                    stageLabel(t.pipeline_stage)
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    {/* A consultation cannot be bid, so it never gets a board
                        card — it moves along its own states and stays in this
                        tab. The real RFP, when it comes, is a separate AAO row
                        and that one goes to the pipeline. */}
                    {t.is_early ? (
                      <form action={setEarlyStage.bind(null, t.id)}>
                        <select
                          name="stage"
                          defaultValue={t.early_stage ?? "new"}
                          className="rounded border border-line bg-surface px-1.5 py-1 text-xs text-fg"
                          aria-label="Early signal status"
                        >
                          {EARLY_STAGES.map((s) => (
                            <option key={s} value={s}>
                              {EARLY_STAGE_LABEL[s]}
                            </option>
                          ))}
                        </select>
                        <button className="ml-1.5 text-xs font-medium text-accent-fg transition-colors duration-150 hover:underline">
                          Set
                        </button>
                      </form>
                    ) : (
                      !t.pipeline_stage && (
                        <form action={addToBoard.bind(null, t.id)}>
                          <button
                            className="text-xs font-medium text-accent-fg transition-colors duration-150 hover:underline"
                            title="Add to Tender Pipeline (stage: Identified)"
                          >
                            Add to pipeline
                          </button>
                        </form>
                      )
                    )}
                    {/* TenderNed's publication type is usually right, but not
                        always, and a tender can also be moved into the wrong
                        lane by hand. This is the correction: it records the
                        call without touching what the scraper stored. */}
                    <form action={setIsEarlySignal.bind(null, t.id, !t.is_early)}>
                      <button
                        className="text-xs font-medium text-fg-soft transition-colors duration-150 hover:text-accent-fg"
                        title={
                          t.is_early
                            ? "Treat as a live tender instead: it moves to the Live tenders tab and can be added to the pipeline."
                            : "Treat as an early signal instead: it moves to the Early signals tab and leaves the bid pipeline."
                        }
                      >
                        {t.is_early ? "Move to tenders" : "Move to early"}
                      </button>
                    </form>
                    <form action={recordFeedback.bind(null, t.id, "relevance", "not_relevant")}>
                      <button
                        className="text-xs font-medium text-fg-soft transition-colors duration-150 hover:text-hot"
                        title="Hide as not relevant. Teaches the scoring loop."
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
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-fg-soft">
                  {kind === "early"
                    ? "No open market consultations or pre-announcements right now. The scraper picks them up daily at 09:00."
                    : filtersActive
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
