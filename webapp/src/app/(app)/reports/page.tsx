import { createSupabaseAdmin } from "@/lib/supabase/server";
import { PageHeader, microLabel } from "@/lib/ui";
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

// waarde is free text ("€ 1.250.000", "250000", "90000 + 101271/jaar", …).
// Take only the FIRST number group — concatenating all digits produces nonsense.
function parseValue(v: string | null): number {
  if (!v) return 0;
  const m = /\d{1,3}(?:[.\s]\d{3})+(?:,\d{1,2})?|\d+(?:,\d{1,2})?/.exec(v);
  if (!m) return 0;
  const whole = m[0].replace(/,\d{1,2}$/, "").replace(/[^\d]/g, "");
  const n = parseInt(whole, 10);
  return Number.isFinite(n) ? n : 0;
}

function euro(n: number): string {
  if (n <= 0) return "—";
  return "€ " + n.toLocaleString("nl-NL");
}

function BreakdownTable({
  title,
  columns,
  rows,
}: {
  title: string;
  columns: string[];
  rows: (string | number)[][];
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
                  className={`px-4 py-2 ${j > 0 ? "text-right tabular-nums text-fg-mid" : "max-w-[16rem] truncate text-fg"}`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-6 text-center text-fg-soft"
              >
                No data yet
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
  label: string | null;
  status: string | null;
  waarde: string | null;
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
        "id,label,status,waarde,opdrachtgever,buyer_type_detected,cpv_main,scraped_at,sluiting_datum,platform"
      )
      .order("id")
      .range(from, from + PAGE - 1);
    const page = (data ?? []) as TenderRow[];
    rows.push(...page);
    if (page.length < PAGE) break;
  }
  return rows;
}

export default async function ReportsPage() {
  const admin = createSupabaseAdmin();
  const [tenders, { data: pipeline }, { data: outcomes }] = await Promise.all([
    fetchAllTenders(admin),
    admin.from("bid_pipeline").select("tender_id,stage"),
    admin.from("tender_feedback").select("tender_id,value").eq("kind", "outcome"),
  ]);

  const all = tenders;
  const byId = new Map(all.map((t) => [t.id, t]));
  const cards = (pipeline ?? []).filter((p) => byId.has(p.tender_id));
  const qualified = all.filter((t) => t.label && !["Disqualified", "Monitor"].includes(t.label));

  // KPIs
  const won = (outcomes ?? []).filter((o) => o.value === "won").length;
  const lost = (outcomes ?? []).filter((o) => o.value === "lost").length;
  const winRate = won + lost > 0 ? Math.round((100 * won) / (won + lost)) : null;
  const activeStages = ["New", "Reviewing", "Bidding", "Submitted"];
  const activeCards = cards.filter((c) => activeStages.includes(c.stage));
  const pipelineValue = activeCards.reduce(
    (sum, c) => sum + parseValue(byId.get(c.tender_id)?.waarde ?? null),
    0
  );
  const wonValue = cards
    .filter((c) => c.stage === "Won")
    .reduce((sum, c) => sum + parseValue(byId.get(c.tender_id)?.waarde ?? null), 0);

  // Value & count by board stage
  const stageOrder = ["New", "Reviewing", "Bidding", "Submitted", "Won", "Lost", "Dropped"];
  const byStage = stageOrder
    .map((s) => {
      const items = cards.filter((c) => c.stage === s);
      const value = items.reduce(
        (sum, c) => sum + parseValue(byId.get(c.tender_id)?.waarde ?? null),
        0
      );
      return [s, items.length, euro(value)] as (string | number)[];
    })
    .filter((r) => (r[1] as number) > 0);

  // Top authorities among qualified tenders
  const authCount = new Map<string, { n: number; won: number }>();
  const wonIds = new Set((outcomes ?? []).filter((o) => o.value === "won").map((o) => o.tender_id));
  for (const t of qualified) {
    const k = t.opdrachtgever ?? "Onbekend";
    const e = authCount.get(k) ?? { n: 0, won: 0 };
    e.n += 1;
    if (wonIds.has(t.id)) e.won += 1;
    authCount.set(k, e);
  }
  const topAuthorities = [...authCount.entries()]
    .sort((a, b) => b[1].n - a[1].n)
    .slice(0, 10)
    .map(([k, v]) => [k, v.n, v.won] as (string | number)[]);

  // Domains (CPV) among qualified tenders
  const domCount = new Map<string, { n: number; value: number }>();
  for (const t of qualified) {
    const k = cpvDomain(t.cpv_main);
    const e = domCount.get(k) ?? { n: 0, value: 0 };
    e.n += 1;
    e.value += parseValue(t.waarde);
    domCount.set(k, e);
  }
  const domains = [...domCount.entries()]
    .sort((a, b) => b[1].n - a[1].n)
    .map(([k, v]) => [k, v.n, euro(v.value)] as (string | number)[]);

  // Buyer types among qualified tenders
  const btCount = new Map<string, number>();
  for (const t of qualified) {
    const k = t.buyer_type_detected ?? "onbekend";
    btCount.set(k, (btCount.get(k) ?? 0) + 1);
  }
  const buyerTypes = [...btCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => [k, v] as (string | number)[]);

  // Monthly intake, last 6 months
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
  const monthlyAll = [...months.entries()].map(
    ([k, v]) => [k, v.scanned, v.qualified] as (string | number)[]
  );
  // Trim leading months from before the scraper existed — all-zero rows read as failure.
  const firstActive = monthlyAll.findIndex((r) => (r[1] as number) > 0);
  const monthly = firstActive === -1 ? monthlyAll : monthlyAll.slice(firstActive);

  const manualCount = all.filter((t) => t.platform === "manual").length;
  const dateStr = new Date().toLocaleDateString("nl-NL", { dateStyle: "long" });

  const kpis = [
    {
      label: "Active pipeline",
      value: String(activeCards.length),
      sub: "tenders on the board (New → Submitted)",
    },
    {
      label: "Pipeline value",
      value: euro(pipelineValue),
      sub: "known contract value, active stages",
    },
    {
      label: "Win rate",
      value: winRate === null ? "—" : `${winRate}%`,
      sub: `${won} won · ${lost} lost`,
    },
    { label: "Value won", value: euro(wonValue), sub: "from Won board cards" },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Reports"
        sub={`Tender intelligence overview · ${dateStr} · ${all.length} tenders scanned${manualCount > 0 ? ` (${manualCount} registered manually)` : ""}`}
        actions={<PrintButton />}
      />

      <dl className="flex flex-col divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface md:flex-row md:divide-x md:divide-y-0">
        {kpis.map((k) => (
          <div key={k.label} className="flex-1 px-5 py-4">
            <dt className={microLabel}>{k.label}</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums text-fg">
              {k.value}
            </dd>
            <dd className="mt-0.5 text-xs text-fg-soft">{k.sub}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-6 md:grid-cols-2">
        <BreakdownTable
          title="Bid board: count & value by stage"
          columns={["Stage", "Tenders", "Value"]}
          rows={byStage}
        />
        <BreakdownTable
          title="Buyer types (qualified tenders)"
          columns={["Type", "Tenders"]}
          rows={buyerTypes}
        />
      </div>

      <BreakdownTable
        title="Top contracting authorities (qualified tenders)"
        columns={["Authority", "Tenders", "Won"]}
        rows={topAuthorities}
      />

      <div className="grid gap-6 md:grid-cols-2">
        <BreakdownTable
          title="Domains (CPV, qualified tenders)"
          columns={["Domain", "Tenders", "Value"]}
          rows={domains}
        />
        <BreakdownTable
          title="Monthly intake (last 6 months)"
          columns={["Month", "Scanned", "Qualified"]}
          rows={monthly}
        />
      </div>

      <p className="text-xs leading-relaxed text-fg-soft print:block">
        Generated by CBA Tender Intelligence. Contract values reflect only
        tenders where a value is known; TenderNed rarely publishes them, and
        manually registered bids usually carry the real figures.
      </p>
    </div>
  );
}
