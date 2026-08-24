import { createSupabaseAdmin } from "@/lib/supabase/server";
import { stageLabel } from "@/lib/format";
import { PageHeader, microLabel, LabelChip } from "@/lib/ui";
import { Kpi, ChartCard, HBarList } from "@/lib/viz";
import { PrintButton } from "./print-button";

export const dynamic = "force-dynamic";

// CPV top-level divisions that matter for this business; fallback shows the code.
const CPV_DOMAINS: Record<string, string> = {
  "48": "Software",
  "72": "IT-diensten",
  "73": "Onderzoek & ontwikkeling",
  "30": "Computerapparatuur",
  "32": "Telecom & netwerk",
  "35": "Veiligheid & defensie",
  "50": "Onderhoud & reparatie",
  "71": "Engineering",
  "79": "Zakelijke diensten",
  "80": "Onderwijs & training",
};

function cpvDomain(cpv: string | null): string {
  if (!cpv) return "Onbekend";
  const p = cpv.slice(0, 2);
  return CPV_DOMAINS[p] ?? `CPV ${p}xx`;
}

function BreakdownTable({
  title,
  columns,
  rows,
  emptyText = "No data yet",
}: {
  title: string;
  columns: string[];
  rows: React.ReactNode[][];
  emptyText?: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      <h2 className="border-b border-line px-4 py-2.5 text-sm font-semibold text-fg">
        {title}
      </h2>
      <table className="w-full text-sm">
        <thead>
          <tr className={`border-b border-line text-left ${microLabel}`}>
            {columns.map((c, i) => (
              <th key={c} className={`px-4 py-2 ${i > 0 ? "text-right" : ""}`}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-line/40 last:border-0">
              {r.map((cell, j) => (
                <td
                  key={j}
                  className={`px-4 py-2 ${j > 0 ? "text-right tabular-nums text-fg-mid" : "max-w-[20rem] truncate text-fg"}`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-4 py-6 text-center text-fg-soft">
                {emptyText}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

type TenderRow = {
  id: number;
  naam: string | null;
  label: string | null;
  score: number | null;
  status: string | null;
  opdrachtgever: string | null;
  buyer_type_detected: string | null;
  cpv_main: string | null;
  scraped_at: string | null;
  sluiting_datum: string | null;
  platform: string | null;
};

// PostgREST caps each response at 1,000 rows — page through everything.
async function fetchAllTenders(admin: ReturnType<typeof createSupabaseAdmin>) {
  const PAGE = 1000;
  const rows: TenderRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data } = await admin
      .from("tenders_scraped")
      .select(
        "id,naam,label,score,status,opdrachtgever,buyer_type_detected,cpv_main,scraped_at,sluiting_datum,platform"
      )
      .order("id")
      .range(from, from + PAGE - 1);
    const page = (data ?? []) as TenderRow[];
    rows.push(...page);
    if (page.length < PAGE) break;
  }
  return rows;
}

const DROPPED_OR_LOST = ["Dropped", "Lost"];
const ACTIVE_STAGES = ["Identified", "Analysis", "Q&A", "Submitted", "Award"];
const STAGE_ORDER = [...ACTIVE_STAGES, "Won", "Lost", "Dropped"];

export default async function ReportsPage() {
  const admin = createSupabaseAdmin();
  const [tenders, { data: pipeline }, { data: feedback }] = await Promise.all([
    fetchAllTenders(admin),
    admin.from("bid_pipeline").select("tender_id,stage"),
    admin.from("tender_feedback").select("tender_id,kind,value"),
  ]);

  const all = tenders;
  const byId = new Map(all.map((t) => [t.id, t]));
  const cards = (pipeline ?? []).filter((p) => byId.has(p.tender_id));
  const qualified = all.filter((t) => t.label && !["Disqualified", "Monitor"].includes(t.label));

  // Latest outcome/relevance feedback per tender (rows aren't deduped upstream).
  const latestFeedback = new Map<number, { outcome?: string; relevance?: string }>();
  for (const f of feedback ?? []) {
    const e = latestFeedback.get(f.tender_id) ?? {};
    if (f.kind === "outcome") e.outcome = f.value;
    if (f.kind === "relevance") e.relevance = f.value;
    latestFeedback.set(f.tender_id, e);
  }

  // ---- The funnel: this is the report. Every number is a real count, never
  // a rate computed from too few data points (DESIGN.md: "empty is normal,
  // hide don't fake" — a 0% win rate on 1 outcome reads as failure when the
  // honest state is "too early to have a rate").
  const activeCards = cards.filter((c) => ACTIVE_STAGES.includes(c.stage));
  const droppedOrLostCards = cards.filter((c) => DROPPED_OR_LOST.includes(c.stage));
  const outcomes = (feedback ?? []).filter((f) => f.kind === "outcome");
  const won = outcomes.filter((o) => o.value === "won").length;
  const lost = outcomes.filter((o) => o.value === "lost").length;
  const decided = won + lost;
  // A percentage from one or two outcomes is exactly the misleading rate this
  // page refuses to show ("0% win rate" off a single lost bid). Below the
  // threshold the funnel shows the honest counts instead.
  const MIN_OUTCOMES_FOR_RATE = 3;
  const showWinRate = decided >= MIN_OUTCOMES_FOR_RATE;

  const funnel: { label: string; value: string | number; sub?: string; href?: string }[] = [
    { label: "Tenders scanned", value: all.length, sub: "TenderNed, all time" },
    { label: "Qualified (Hot/Warm/Cold)", value: qualified.length, sub: "AI-scored as relevant" },
    { label: "Moved to pipeline", value: cards.length, sub: "a human chose to act" },
    { label: "Active right now", value: activeCards.length, sub: "Identified → Award", href: "/board" },
  ];
  if (showWinRate) {
    funnel.push({
      label: "Win rate",
      value: `${Math.round((100 * won) / decided)}%`,
      sub: `${won} won · ${lost} lost`,
    });
  } else if (decided > 0) {
    funnel.push({
      label: "Outcomes recorded",
      value: decided,
      sub: `${won} won · ${lost} lost`,
    });
  }

  // Pipeline detail: real tenders, not just counts — management sees WHAT is being pursued.
  const pipelineRows = cards
    .slice()
    .sort((a, b) => STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage))
    .map((c) => {
      const t = byId.get(c.tender_id);
      return [
        t?.naam ?? `Tender ${c.tender_id}`,
        <LabelChip key="l" label={t?.label ?? null} score={t?.score ?? null} />,
        stageLabel(c.stage),
      ];
    });

  // Why tenders left the pipeline — the "why" a status count can't show.
  const exitRows = droppedOrLostCards.map((c) => {
    const t = byId.get(c.tender_id);
    const fb = latestFeedback.get(c.tender_id);
    let reason = stageLabel(c.stage);
    if (fb?.relevance === "not_relevant") reason = "Marked not relevant (false positive)";
    else if (fb?.outcome === "no_bid") reason = "Decided not to bid";
    else if (fb?.outcome === "lost") reason = "Lost to competitor";
    return [t?.naam ?? `Tender ${c.tender_id}`, <LabelChip key="l" label={t?.label ?? null} />, reason];
  });

  // Domains (CPV) among qualified tenders — supporting context.
  const domCount = new Map<string, number>();
  for (const t of qualified) {
    const k = cpvDomain(t.cpv_main);
    domCount.set(k, (domCount.get(k) ?? 0) + 1);
  }
  const domainRows = [...domCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({ label, count }));

  // Buyer types among qualified tenders — supporting context.
  const btCount = new Map<string, number>();
  for (const t of qualified) {
    const k = t.buyer_type_detected ?? "onbekend";
    btCount.set(k, (btCount.get(k) ?? 0) + 1);
  }
  const buyerRows = [...btCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({ label, count }));

  // Monthly intake, last 6 months — already answers "is the system healthy
  // and consistent", kept as-is.
  const months = new Map<string, { scanned: number; qualified: number }>();
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.set(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, {
      scanned: 0,
      qualified: 0,
    });
  }
  for (const t of all) {
    const key = (t.scraped_at ?? "").slice(0, 7);
    const e = months.get(key);
    if (e) {
      e.scanned += 1;
      if (t.label && !["Disqualified", "Monitor"].includes(t.label)) e.qualified += 1;
    }
  }
  const monthlyAll = [...months.entries()].map(([k, v]) => ({ month: k, ...v }));
  // Trim leading months from before the scraper existed — all-zero rows read as failure.
  const firstActive = monthlyAll.findIndex((r) => r.scanned > 0);
  const monthly = firstActive === -1 ? monthlyAll : monthlyAll.slice(firstActive);

  const manualCount = all.filter((t) => t.platform === "manual").length;
  const dateStr = new Date().toLocaleDateString("nl-NL", { dateStyle: "long" });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Reports"
        sub={`Tender intelligence overview · ${dateStr} · ${all.length} tenders scanned${manualCount > 0 ? ` (${manualCount} registered manually)` : ""}`}
        actions={<PrintButton />}
      />

      <dl className="flex flex-col divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface md:flex-row md:divide-x md:divide-y-0">
        {funnel.map((k) => (
          <Kpi key={k.label} label={k.label} value={k.value} sub={k.sub} href={k.href} />
        ))}
      </dl>

      {!showWinRate && (
        <p className="text-xs text-fg-soft">
          {decided === 0
            ? "Win rate isn't shown yet — no tender has a recorded won/lost outcome."
            : `Win rate isn't shown yet — only ${decided} decided ${decided === 1 ? "outcome" : "outcomes"} recorded.`}{" "}
          It appears once {MIN_OUTCOMES_FOR_RATE} outcomes are in, so a single result can&apos;t
          read as a trend.
        </p>
      )}

      <BreakdownTable
        title="Pipeline: tenders being pursued"
        columns={["Tender", "Score", "Stage"]}
        rows={pipelineRows}
        emptyText="No tenders on the board yet"
      />

      <BreakdownTable
        title="Left the pipeline: why"
        columns={["Tender", "Score", "Reason"]}
        rows={exitRows}
        emptyText="Nothing dropped or lost yet"
      />

      <ChartCard title="Monthly intake (last 6 months)">
        <table className="w-full text-sm">
          <thead>
            <tr className={`border-b border-line text-left ${microLabel}`}>
              <th className="py-1.5">Month</th>
              <th className="py-1.5 text-right">Scanned</th>
              <th className="py-1.5 text-right">Qualified</th>
            </tr>
          </thead>
          <tbody>
            {monthly.map((r) => (
              <tr key={r.month} className="border-b border-line/40 last:border-0">
                <td className="py-1.5 text-fg-mid">{r.month}</td>
                <td className="py-1.5 text-right tabular-nums text-fg">{r.scanned}</td>
                <td className="py-1.5 text-right tabular-nums text-fg">{r.qualified}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ChartCard>

      <div className="grid gap-6 md:grid-cols-2">
        <ChartCard title="Domains (qualified tenders)">
          <HBarList rows={domainRows} showPct />
        </ChartCard>
        <ChartCard title="Buyer types (qualified tenders)">
          <HBarList rows={buyerRows} showPct />
        </ChartCard>
      </div>

      <p className="text-xs leading-relaxed text-fg-soft print:block">
        Generated by CBA Tender Intelligence. Contract values aren&apos;t shown here: TenderNed
        publishes a value on well under 1% of tenders, so a value total would be misleading rather
        than useful.
      </p>
    </div>
  );
}
