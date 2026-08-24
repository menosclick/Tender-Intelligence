import Link from "next/link";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { deadlineText, deadlineClass, stageLabel, asArray } from "@/lib/format";
import { classifyDomain, CORE_DOMAINS } from "@/lib/domains";
import { LabelChip, PageHeader, btnSecondary, microLabel } from "@/lib/ui";
import { Kpi, ChartCard, HBarList } from "@/lib/viz";
import { addAction, setActionStatus, deleteAction } from "@/lib/actions";
import { getMilestoneEvents } from "@/lib/calendar-data";
import {
  getOperationalActions,
  sortActions,
  isOverdue,
  isDueThisWeek,
  ACTION_STATUS_LABEL,
  ACTION_STATUS_CHIP,
} from "@/lib/ops";
import {
  NetherlandsMap,
  parseNutsCodes,
  NUTS2_PROVINCE,
  type MapTender,
  type ProvinceBucket,
} from "@/lib/nl-map";

export const dynamic = "force-dynamic";

type Row = {
  id: number;
  title: string | null;
  buyer: string | null;
  label: string | null;
  score: number | null;
  deadline: string | null;
  days_to_deadline: number | null;
  pipeline_stage: string | null;
  recommended_products: unknown;
};

// inputCls minus w-full: compact inline controls for the one-row add form.
const fieldCls =
  "rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-sm text-fg placeholder:text-fg-soft transition-colors duration-150 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20";

// The command center answers four questions, in order: what needs attention
// now, what's the next important deadline, who are we waiting for, and what
// new qualified opportunities appeared. Reporting lives on /reports; the full
// discovery table lives on /inbox.
export default async function DashboardPage() {
  const admin = createSupabaseAdmin();

  const [{ data: open }, { data: feedback }, { data: board }, actions, events] =
    await Promise.all([
      admin
        .from("v_app_tenders")
        .select(
          "id,title,buyer,label,score,deadline,days_to_deadline,pipeline_stage,recommended_products"
        )
        // A tender with no published deadline is still open — the pipeline's own
        // v_pipeline_active says so. PostgREST gte() is never true for NULL, so
        // filtering on gte alone silently dropped qualified tenders from the app.
        .or("days_to_deadline.gte.0,days_to_deadline.is.null")
        .order("score", { ascending: false }),
      admin.from("tender_feedback").select("tender_id,value").eq("kind", "relevance"),
      admin.from("bid_pipeline").select("tender_id,stage"),
      getOperationalActions(admin),
      getMilestoneEvents(admin),
    ]);

  const notRelevantIds = new Set(
    (feedback ?? []).filter((f) => f.value === "not_relevant").map((f) => f.tender_id)
  );
  const openRows = ((open ?? []) as Row[]).filter((t) => !notRelevantIds.has(t.id));
  const qualified = openRows.filter((t) => t.label === "Hot" || t.label === "Warm");
  const boardCards = (board ?? []) as { tender_id: number; stage: string }[];
  // Exclusion form: a stray legacy stage value must count as active, not vanish.
  const activePipeline = boardCards.filter(
    (b) => !["Won", "Lost", "Dropped"].includes(b.stage)
  );

  // Deadlines in 30 days: official deadlines of open qualified tenders plus
  // tracked milestones of pipeline tenders, deduped per tender+date.
  const deadlineKeys = new Set<string>();
  for (const t of qualified)
    if (t.deadline && t.days_to_deadline !== null && t.days_to_deadline <= 30)
      deadlineKeys.add(`${t.id}:${t.deadline}`);
  for (const e of events) if (e.days <= 30) deadlineKeys.add(`${e.tenderId}:${e.date}`);

  const sortedActions = sortActions(actions);
  const openActions = sortedActions.filter((a) => a.status !== "completed");
  const waitingCount = openActions.filter((a) => a.waitingOn).length;
  const dueThisWeekCount = openActions.filter(isDueThisWeek).length;

  // Active pipeline tenders populate the add-form's tender picker.
  const pipelineIds = activePipeline.map((b) => b.tender_id);
  const { data: pipelineTenders } = pipelineIds.length
    ? await admin
        .from("v_app_tenders")
        .select("id,title")
        .in("id", pipelineIds)
        .order("title")
    : { data: [] as { id: number; title: string | null }[] };

  // Extras for domain classification, recency and the map (small .in() reads).
  const ids = openRows.map((t) => t.id);
  const { data: extras } = ids.length
    ? await admin
        .from("tenders_scraped")
        .select("id,keyword_matches,analyzed_at,scraped_at,raw_json")
        .in("id", ids)
    : {
        data: [] as {
          id: number;
          keyword_matches: string[] | null;
          analyzed_at: string | null;
          scraped_at: string | null;
          raw_json: string | null;
        }[],
      };
  const extrasById = new Map((extras ?? []).map((e) => [e.id, e]));
  const domainOf = (t: Row) =>
    classifyDomain([
      t.title,
      asArray(t.recommended_products).join(" "),
      (extrasById.get(t.id)?.keyword_matches ?? []).join(" "),
    ]);

  // Portfolio: open tenders by solution domain (count + share), rows filter the Inbox.
  const domainCount = new Map<string, number>();
  for (const t of openRows) {
    const d = domainOf(t);
    domainCount.set(d, (domainCount.get(d) ?? 0) + 1);
  }
  const byDomain = [
    ...CORE_DOMAINS.map((d) => ({ label: d, count: domainCount.get(d) ?? 0 })),
    ...[...domainCount.entries()]
      .filter(([d]) => !CORE_DOMAINS.includes(d))
      .sort((a, b) => b[1] - a[1])
      .map(([d, n]) => ({ label: d, count: n })),
  ].map((r) => ({ ...r, href: `/inbox?label=all&domain=${encodeURIComponent(r.label)}` }));

  // Netherlands map buckets from the publications' NUTS codes.
  const provinceMap = new Map<string, MapTender[]>();
  const otherRegions: MapTender[] = [];
  let nationalCount = 0;
  let noDataCount = 0;
  // A tender can be published for several regions; only the first is pinned,
  // so the map says how many it is simplifying rather than implying precision.
  let multiRegionCount = 0;
  for (const t of openRows) {
    const nuts = parseNutsCodes(extrasById.get(t.id)?.raw_json ?? null);
    const entry = nuts[0];
    if (nuts.length > 1) multiRegionCount++;
    if (!entry) {
      noDataCount++;
      continue;
    }
    const mt: MapTender = {
      id: t.id,
      title: t.title ?? `Tender #${t.id}`,
      buyer: t.buyer ?? "",
      domain: domainOf(t),
      label: t.label ?? "unscored",
      pipelineStage: t.pipeline_stage ? stageLabel(t.pipeline_stage) : null,
      nutsName: entry.omschrijving,
    };
    if (entry.code === "NL") {
      nationalCount++;
    } else {
      const province = NUTS2_PROVINCE[entry.code.slice(0, 4)];
      if (province) {
        const list = provinceMap.get(province) ?? [];
        list.push(mt);
        provinceMap.set(province, list);
      } else {
        otherRegions.push(mt);
      }
    }
  }
  const provinces: ProvinceBucket[] = [...provinceMap.entries()].map(
    ([province, tenders]) => ({ province, tenders })
  );

  // Latest qualified: five most recently analyzed Hot/Warm tenders.
  const latestQualified = [...qualified]
    .sort((a, b) => {
      const ta = extrasById.get(a.id)?.analyzed_at ?? extrasById.get(a.id)?.scraped_at ?? "";
      const tb = extrasById.get(b.id)?.analyzed_at ?? extrasById.get(b.id)?.scraped_at ?? "";
      return tb.localeCompare(ta);
    })
    .slice(0, 5);

  // One row per tender — its next date plus a "+N more" pointer. Listing every
  // milestone made the same tender repeat, which read as duplicate entries
  // (Derson, 2026-07-21); the full per-date list lives on the Calendar page.
  const byTenderNext = new Map<number, { e: (typeof events)[number]; more: number }>();
  for (const e of events) {
    const cur = byTenderNext.get(e.tenderId);
    if (cur) cur.more += 1;
    else byTenderNext.set(e.tenderId, { e, more: 0 });
  }
  const upcoming = [...byTenderNext.values()].slice(0, 5);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Tender Command Center"
        sub="Your active tender work, upcoming deadlines and latest qualified opportunities."
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

      {/* Compact metric strip — each metric opens the records it counts. */}
      <dl className="mt-5 flex flex-col divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface sm:flex-row sm:divide-x sm:divide-y-0">
        <Kpi
          label="Open qualified"
          value={qualified.length}
          sub="Hot + Warm, deadline ahead"
          href="/inbox"
        />
        <Kpi
          label="Active pipeline"
          value={activePipeline.length}
          sub="Identified → Award"
          href="/board"
        />
        <Kpi
          label="Deadlines ≤ 30d"
          value={deadlineKeys.size}
          sub="official dates & milestones"
          tone={deadlineKeys.size > 0 ? "hot" : undefined}
          href="/calendar"
        />
        <Kpi
          label="Waiting on others"
          value={waitingCount}
          sub="open actions blocked externally"
          href="#needs-attention"
        />
        <Kpi
          label="Due this week"
          value={dueThisWeekCount}
          sub="internal actions"
          href="#needs-attention"
        />
      </dl>

      {/* Operational core: what needs attention + the next dates. */}
      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]">
        <section id="needs-attention">
          <h2 className="text-base font-semibold text-fg">Needs attention</h2>
          {openActions.length > 0 ? (
            // relative: the sr-only header is position:absolute — without a
            // positioned ancestor it becomes phantom scroll area on mobile.
            <div className="relative mt-2.5 overflow-x-auto rounded-xl border border-line bg-surface">
              <table className="w-full min-w-[46rem] text-sm">
                <thead>
                  <tr className={`border-b border-line text-left ${microLabel}`}>
                    <th className="px-4 py-2.5">Tender</th>
                    <th className="px-4 py-2.5">Next action</th>
                    <th className="px-4 py-2.5">Owner</th>
                    <th className="px-4 py-2.5">Waiting on</th>
                    <th className="px-4 py-2.5">Internal due</th>
                    <th className="px-4 py-2.5">Deadline</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5">
                      <span className="sr-only">Row actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {openActions.map((a) => (
                    <tr
                      key={a.id}
                      className="border-b border-line/60 last:border-0"
                    >
                      <td className="max-w-[13rem] px-4 py-3">
                        {a.tenderId ? (
                          <Link
                            href={`/tender/${a.tenderId}`}
                            className="block truncate font-medium text-fg hover:text-accent-fg hover:underline"
                            title={a.tenderTitle}
                          >
                            {a.tenderTitle}
                          </Link>
                        ) : (
                          <span className="block truncate font-medium text-fg" title={a.tenderTitle}>
                            {a.tenderTitle}
                          </span>
                        )}
                      </td>
                      <td className="max-w-[15rem] truncate px-4 py-3 text-fg-mid" title={a.nextAction}>
                        {a.nextAction}
                      </td>
                      <td className="px-4 py-3 text-fg-mid">
                        {a.owner ?? <span className="font-medium text-warm">Unassigned</span>}
                      </td>
                      <td className="px-4 py-3 text-fg-mid">{a.waitingOn ?? "—"}</td>
                      <td className="px-4 py-3 tabular-nums">
                        {a.internalDue ? (
                          isOverdue(a) ? (
                            <span className="font-semibold text-hot">
                              {a.internalDue} · Overdue
                            </span>
                          ) : (
                            <span className="text-fg-mid">{a.internalDue}</span>
                          )
                        ) : (
                          <span className="text-fg-soft">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-fg-mid">
                        {a.officialDeadline ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${ACTION_STATUS_CHIP[a.status]}`}
                        >
                          {ACTION_STATUS_LABEL[a.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <form action={setActionStatus.bind(null, a.id, "completed")}>
                            <button
                              className="text-xs font-medium text-accent-fg transition-colors duration-150 hover:underline"
                              title="Mark this action completed"
                            >
                              Done
                            </button>
                          </form>
                          <form action={deleteAction.bind(null, a.id)}>
                            <button
                              className="text-xs font-medium text-fg-soft transition-colors duration-150 hover:text-hot"
                              aria-label={`Remove action: ${a.nextAction}`}
                            >
                              Remove
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mt-2.5 rounded-xl border border-line bg-surface px-6 py-8 text-center">
              <p className="text-sm font-medium text-fg">No operational actions yet.</p>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-fg-mid">
                This table tracks the next step per pursuit — who owns it, who
                you&apos;re waiting for and when it&apos;s due internally. Add
                the first one below.
              </p>
            </div>
          )}
          <form action={addAction} className="mt-3 flex flex-wrap items-center gap-2">
            <input
              name="title"
              required
              maxLength={200}
              placeholder="Next action (e.g. Draft NvI answers)"
              aria-label="Action"
              className={`${fieldCls} min-w-52 flex-1`}
            />
            <select name="tender_id" aria-label="Tender" className={fieldCls} defaultValue="">
              <option value="">No tender — general</option>
              {(pipelineTenders ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {(t.title ?? `Tender #${t.id}`).slice(0, 60)}
                </option>
              ))}
            </select>
            <input
              name="owner"
              maxLength={120}
              placeholder="Owner"
              aria-label="Owner"
              className={`${fieldCls} w-28`}
            />
            <input
              name="waiting_on"
              maxLength={120}
              placeholder="Waiting on"
              aria-label="Waiting on"
              className={`${fieldCls} w-32`}
            />
            <input type="date" name="internal_due" aria-label="Internal due date" className={fieldCls} />
            <button className={btnSecondary}>Add action</button>
          </form>
          <p className="mt-2 text-xs leading-relaxed text-fg-soft">
            Naming who you&apos;re waiting on sets the action to Waiting; a
            past internal date surfaces it as Overdue at the top.
          </p>
        </section>

        <section>
          <div className="flex items-baseline justify-between">
            <h2 className="text-base font-semibold text-fg">Upcoming milestones</h2>
            <Link href="/calendar" className="text-xs font-medium text-accent-fg hover:underline">
              View Calendar →
            </Link>
          </div>
          <div className="mt-2.5 rounded-xl border border-line bg-surface">
            {upcoming.length > 0 ? (
              <ul className="divide-y divide-line/60">
                {upcoming.map(({ e, more }) => (
                  <li key={e.tenderId} className="px-4 py-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className={`tabular-nums text-sm ${deadlineClass(e.days)}`}>
                        {e.date}
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-fg-soft">
                        {/* beyond a year it's a DAS/framework window, not a countdown */}
                        {e.days === 0 ? "today" : e.days > 365 ? "long-term" : `in ${e.days}d`}
                      </span>
                    </div>
                    <Link
                      href={`/tender/${e.tenderId}`}
                      className="mt-0.5 block truncate text-sm font-medium text-fg hover:text-accent-fg hover:underline"
                      title={e.tenderTitle}
                    >
                      {e.tenderTitle}
                    </Link>
                    <p className="mt-0.5 flex items-center gap-2 text-xs text-fg-mid">
                      {e.label}
                      <span
                        className={`rounded-full px-1.5 py-0.5 font-medium ${
                          e.official ? "bg-accent-soft text-accent-fg" : "bg-sunken text-fg-mid"
                        }`}
                      >
                        {e.official ? "Official" : "Internal"}
                      </span>
                      {more > 0 && (
                        <Link
                          href="/calendar"
                          className="font-medium text-accent-fg hover:underline"
                        >
                          +{more} more {more === 1 ? "date" : "dates"} →
                        </Link>
                      )}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 py-8 text-center text-xs leading-relaxed text-fg-soft">
                No tracked dates yet. Move a tender into Analysis on the Tender
                Pipeline, then add its key dates on the tender detail page.
              </p>
            )}
          </div>
        </section>
      </div>

      {/* Portfolio snapshot — secondary, below the operational core. */}
      <h2 className={`${microLabel} mt-8`}>Portfolio snapshot</h2>
      <div className="mt-2.5 grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-2">
        <ChartCard title="Open tenders by solution domain">
          <HBarList rows={byDomain} showPct />
        </ChartCard>
        <ChartCard title="Netherlands opportunity map">
          <NetherlandsMap
            provinces={provinces}
            nationalCount={nationalCount}
            otherRegions={otherRegions}
            noDataCount={noDataCount}
            multiRegionCount={multiRegionCount}
          />
        </ChartCard>
      </div>

      {/* Latest qualified — the five newest Hot/Warm, full list in the Inbox. */}
      <div className="mt-8 flex items-baseline justify-between">
        <h2 className="text-base font-semibold text-fg">Latest qualified tenders</h2>
        <Link href="/inbox" className="text-xs font-medium text-accent-fg hover:underline">
          View all in Tender Inbox →
        </Link>
      </div>
      <div className="mt-2.5 overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full min-w-[44rem] text-sm">
          <thead>
            <tr className={`border-b border-line text-left ${microLabel}`}>
              <th className="px-4 py-2.5">Tender</th>
              <th className="px-4 py-2.5">Buyer</th>
              <th className="px-4 py-2.5">Domain</th>
              <th className="px-4 py-2.5">Match</th>
              <th className="px-4 py-2.5">Deadline</th>
              <th className="px-4 py-2.5">Pipeline</th>
            </tr>
          </thead>
          <tbody>
            {latestQualified.map((t) => (
              <tr
                key={t.id}
                className="border-b border-line/60 transition-colors duration-150 last:border-0 hover:bg-sunken/60"
              >
                <td className="max-w-sm px-4 py-3">
                  <Link
                    href={`/tender/${t.id}`}
                    className="block truncate font-medium text-fg hover:text-accent-fg hover:underline"
                    title={t.title ?? ""}
                  >
                    {t.title}
                  </Link>
                </td>
                <td className="max-w-[12rem] truncate px-4 py-3 text-fg-mid" title={t.buyer ?? ""}>
                  {t.buyer}
                </td>
                <td className="px-4 py-3 text-fg-mid">{domainOf(t)}</td>
                <td className="px-4 py-3">
                  {/* Match = qualification label; the numeric score stays on the detail page */}
                  <LabelChip label={t.label} />
                </td>
                <td className={`px-4 py-3 tabular-nums ${deadlineClass(t.days_to_deadline)}`}>
                  {deadlineText(t.deadline, t.days_to_deadline)}
                </td>
                <td className="px-4 py-3 text-xs text-fg-soft">
                  {t.pipeline_stage ? stageLabel(t.pipeline_stage) : "—"}
                </td>
              </tr>
            ))}
            {latestQualified.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-fg-soft">
                  No open Hot or Warm tenders right now. The scraper runs daily
                  at 09:00 — new qualifiers appear here first.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
