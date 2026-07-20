import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import {
  deadlineText,
  deadlineClass,
  SCORE_DIMENSIONS,
  SCORE_DIMENSIONS_SPARSE,
  asArray,
} from "@/lib/format";
import { LabelChip, btnPrimary, btnSecondary, microLabel } from "@/lib/ui";
import { addToBoard } from "@/lib/actions";
import { FeedbackWidget } from "./feedback";
import { CopyButton } from "./copy-button";

export const dynamic = "force-dynamic";

// Prose sections sit directly on the canvas: micro-heading + rule, no card.
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className={`${microLabel} border-b border-line pb-1.5`}>{title}</h2>
      <div className="pt-2.5">{children}</div>
    </section>
  );
}

function ExternalIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6.5 3.5H3v9.5h9.5V9M9.5 2.5H13.5V6.5M13 3 7.5 8.5" />
    </svg>
  );
}

const VERDICT_STYLES: Record<
  string,
  { box: string; title: string; heading: string }
> = {
  bid: {
    box: "border-ok-line bg-ok-soft",
    title: "text-ok",
    heading: "BID: eligibility checked against the documents",
  },
  no_bid: {
    box: "border-hot-line bg-hot-soft",
    title: "text-hot",
    heading: "NO-BID: hard requirement not met",
  },
  conditional: {
    box: "border-warm-line bg-warm-soft",
    title: "text-warm",
    heading: "CONDITIONAL: verify before committing",
  },
  docs_unavailable: {
    box: "border-line-strong bg-surface",
    title: "text-fg-mid",
    heading: "Documents not on TenderNed",
  },
};

export default async function TenderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tenderId = Number(id);
  if (!Number.isInteger(tenderId)) notFound();

  const admin = createSupabaseAdmin();
  const [{ data: t }, { data: raw }, { data: fb }, { data: bidPack }, { data: verdict }] =
    await Promise.all([
      admin.from("v_app_tenders").select("*").eq("id", tenderId).maybeSingle(),
      // description, value and filter provenance live on the base table (read-only)
      admin
        .from("tenders_scraped")
        .select("beschrijving,procedure,waarde,keyword_matches")
        .eq("id", tenderId)
        .maybeSingle(),
      admin.from("tender_feedback").select("kind,value").eq("tender_id", tenderId),
      admin
        .from("bid_packs")
        .select("content,created_at")
        .eq("tender_id", tenderId)
        .maybeSingle(),
      admin
        .from("bid_verdicts")
        .select("*")
        .eq("tender_id", tenderId)
        .maybeSingle(),
    ]);
  if (!t) notFound();

  const pack = (bidPack?.content ?? null) as null | {
    knockout_checklist?: { risk: string; check: string }[];
    requirements_matrix?: { requirement: string; angle: string }[];
    win_themes?: string[];
    response_outline?: { section: string; guidance: string }[];
    questions_for_buyer?: string[];
  };

  const relevance = fb?.find((f) => f.kind === "relevance")?.value ?? null;
  const outcome = fb?.find((f) => f.kind === "outcome")?.value ?? null;

  const requirements = asArray(t.key_requirements);
  const risks = asArray(t.possible_knockout_risks);
  const products = asArray(t.recommended_products);
  const redFlags = asArray(t.red_flags);
  const breakdown = (t.score_breakdown ?? {}) as Record<string, number>;
  const addAction = addToBoard.bind(null, tenderId);
  // Unknown verdict values get a neutral box with the raw value, never a wrong claim.
  const vs = verdict
    ? VERDICT_STYLES[verdict.verdict] ?? {
        box: "border-line-strong bg-surface",
        title: "text-fg-mid",
        heading: String(verdict.verdict ?? "Verdict"),
      }
    : null;

  return (
    <div className="mx-auto max-w-3xl">
      {/* Header */}
      <Link
        href="/dashboard"
        className="text-xs font-medium text-fg-soft transition-colors duration-150 hover:text-accent-fg"
      >
        ← Back to dashboard
      </Link>
      <div className="mt-3 flex items-start justify-between gap-6">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold leading-snug tracking-tight">
            {t.title}
          </h1>
          <p className="mt-1.5 text-sm text-fg-mid">{t.buyer}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-3xl font-semibold tabular-nums leading-none">
            {t.score}
          </p>
          <div className="mt-1.5">
            <LabelChip label={t.label} />
          </div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-fg-mid">
        <span className={deadlineClass(t.days_to_deadline)}>
          Deadline: {deadlineText(t.deadline, t.days_to_deadline)}
        </span>
        <span>Published: {t.published_date ?? "—"}</span>
        {t.cpv_main && (
          <span>
            CPV: <span className="font-mono text-[13px]">{t.cpv_main}</span>
          </span>
        )}
        {raw?.procedure && <span>Procedure: {raw.procedure}</span>}
        {raw?.waarde && (
          <span>
            Value:{" "}
            {/^\d+$/.test(raw.waarde.trim())
              ? `€ ${Number(raw.waarde.trim()).toLocaleString("nl-NL")}`
              : raw.waarde}
          </span>
        )}
      </div>
      {(raw?.keyword_matches ?? []).length > 0 && (
        <p className="mt-2 text-xs text-fg-soft">
          Surfaced by keyword match:{" "}
          {(raw!.keyword_matches as string[]).join(" · ")}
        </p>
      )}
      <div className="mt-5 flex gap-2">
        {t.url && (
          <a
            href={t.url}
            target="_blank"
            rel="noopener noreferrer"
            className={btnSecondary}
          >
            View on TenderNed
            <ExternalIcon />
          </a>
        )}
        {t.pipeline_stage ? (
          <Link
            href="/board"
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent-soft px-3 py-1.5 text-sm font-medium text-accent-fg transition-colors duration-150 hover:bg-accent-soft/70"
          >
            On board: {t.pipeline_stage} →
          </Link>
        ) : (
          <form action={addAction}>
            <button className={btnPrimary}>Add to bid board</button>
          </form>
        )}
      </div>

      <div className="mt-6">
        <FeedbackWidget
          tenderId={tenderId}
          initialRelevance={relevance}
          initialOutcome={outcome}
        />
      </div>

      {redFlags.length > 0 && (
        <div className="mt-4 rounded-xl border border-hot-line bg-hot-soft p-4 text-sm text-hot">
          <strong>Red flags:</strong> {redFlags.join(" · ")}
        </div>
      )}

      {verdict && vs && (
        <div className={`mt-4 rounded-xl border p-5 ${vs.box}`}>
          <div className="flex items-center justify-between gap-4">
            <h2 className={`text-base font-semibold ${vs.title}`}>
              {vs.heading}
            </h2>
            {verdict.confidence && verdict.verdict !== "docs_unavailable" && (
              <span className="shrink-0 text-xs text-fg-soft">
                confidence: {verdict.confidence}
              </span>
            )}
          </div>
          {verdict.summary && (
            <p className="mt-2 text-sm leading-relaxed text-fg">
              {verdict.summary}
            </p>
          )}
          {verdict.verdict === "docs_unavailable" && verdict.external_platform_url && (
            <a
              href={verdict.external_platform_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-accent-fg hover:underline"
            >
              Open the external tender platform
              <ExternalIcon />
            </a>
          )}

          {Array.isArray(verdict.hard_knockouts) && verdict.hard_knockouts.length > 0 && (
            <div className="mt-4">
              <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-hot">
                Hard knockouts
              </h3>
              <ul className="space-y-1.5 text-sm text-fg">
                {(verdict.hard_knockouts as { risk: string; impact: string; action: string }[]).map(
                  (k, i) => (
                    <li key={i}>
                      <strong>{k.risk}</strong>: {k.impact}
                      {k.action && <span className="text-fg-mid"> → {k.action}</span>}
                    </li>
                  )
                )}
              </ul>
            </div>
          )}

          {Array.isArray(verdict.eligibility_checks) && verdict.eligibility_checks.length > 0 && (
            <div className="mt-4">
              <h3 className={`${microLabel} mb-1.5`}>
                Eligibility checks (quoted from the tender documents)
              </h3>
              <div className="space-y-2">
                {(verdict.eligibility_checks as {
                  requirement: string;
                  source_quote: string;
                  status: string;
                  note: string;
                }[]).map((c, i) => (
                  <div key={i} className="rounded-lg bg-surface/80 p-3 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <strong className="text-fg">{c.requirement}</strong>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                          c.status === "pass"
                            ? "bg-ok-soft text-ok"
                            : c.status === "fail"
                              ? "bg-hot-soft text-hot"
                              : "bg-warm-soft text-warm"
                        }`}
                      >
                        {c.status}
                      </span>
                    </div>
                    {c.source_quote && (
                      <p className="mt-1.5 rounded-md bg-sunken px-2.5 py-1.5 text-xs italic leading-relaxed text-fg-mid">
                        “{c.source_quote}”
                      </p>
                    )}
                    {c.note && <p className="mt-1.5 text-xs text-fg-mid">{c.note}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {Array.isArray(verdict.verify_items) && verdict.verify_items.length > 0 && (
            <div className="mt-4">
              <h3 className={`${microLabel} mb-1.5`}>Verify before bidding</h3>
              <ul className="list-disc space-y-1 pl-5 text-sm text-fg-mid">
                {(verdict.verify_items as string[]).map((v, i) => (
                  <li key={i}>{v}</li>
                ))}
              </ul>
            </div>
          )}

          {Array.isArray(verdict.docs_used) && verdict.docs_used.length > 0 && (
            <p className="mt-3 text-xs text-fg-soft">
              Based on: {(verdict.docs_used as string[]).join(" · ")}
            </p>
          )}
        </div>
      )}

      <div className="mt-8 space-y-7">
        {t.executive_summary && (
          <Section title="Executive summary">
            <p className="text-sm leading-relaxed text-fg">{t.executive_summary}</p>
          </Section>
        )}

        {t.what_is_being_bought && (
          <Section title="What is being bought">
            <p className="text-sm leading-relaxed text-fg-mid">
              {t.what_is_being_bought}
            </p>
          </Section>
        )}

        {t.why_it_matters && (
          <Section title="Why it matters">
            <p className="text-sm leading-relaxed text-fg-mid">{t.why_it_matters}</p>
          </Section>
        )}

        {(products.length > 0 || t.fit_reasoning) && (
          <Section title={`Product fit${t.fit_level ? ` · ${t.fit_level}` : ""}`}>
            {products.length > 0 && (
              <div className="mb-2.5 flex flex-wrap gap-1.5">
                {products.map((p) => (
                  <span
                    key={p}
                    className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-semibold text-accent-fg"
                  >
                    {p}
                  </span>
                ))}
              </div>
            )}
            {t.fit_reasoning && (
              <p className="text-sm leading-relaxed text-fg-mid">{t.fit_reasoning}</p>
            )}
          </Section>
        )}

        {requirements.length > 0 && (
          <Section title="Key requirements">
            <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-fg-mid">
              {requirements.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </Section>
        )}

        {risks.length > 0 && (
          <Section title="Possible knockout risks">
            <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-fg-mid">
              {risks.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </Section>
        )}

        {t.route_to_market && (
          <Section title="Route to market">
            <p className="text-sm font-medium text-fg">{t.route_to_market}</p>
            {t.route_reasoning && (
              <p className="mt-1 text-sm leading-relaxed text-fg-mid">
                {t.route_reasoning}
              </p>
            )}
            {t.route_first_action && (
              <p className="mt-2 text-sm leading-relaxed text-fg-mid">
                <strong className="text-fg">First action:</strong>{" "}
                {t.route_first_action}
              </p>
            )}
            {t.reseller_outreach_draft && (
              <details className="mt-3 rounded-lg border border-line bg-surface">
                <summary className="cursor-pointer px-4 py-2.5 text-sm font-medium text-accent-fg">
                  Outreach draft{t.reseller_name ? ` for ${t.reseller_name}` : ""} · generated
                </summary>
                <div className="border-t border-line px-4 py-3">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-fg-mid">
                    {t.reseller_outreach_draft}
                  </p>
                  <div className="mt-3">
                    <CopyButton text={t.reseller_outreach_draft} />
                  </div>
                </div>
              </details>
            )}
          </Section>
        )}

        {pack && (
          <div className="overflow-hidden rounded-xl border border-line-strong bg-surface">
            <div className="flex items-center justify-between gap-4 bg-accent-soft px-5 py-3">
              <h2 className="text-sm font-semibold text-accent-fg">
                Bid pack · generated for this Hot tender
              </h2>
              <span className="text-xs text-accent-fg">
                {bidPack?.created_at
                  ? new Date(bidPack.created_at).toLocaleDateString("nl-NL")
                  : ""}
              </span>
            </div>
            <div className="space-y-5 p-5">
              {(pack.knockout_checklist ?? []).length > 0 && (
                <div>
                  <h3 className={`${microLabel} mb-1.5`}>
                    Knockout checklist: verify before bidding
                  </h3>
                  <ul className="space-y-1.5 text-sm leading-relaxed text-fg-mid">
                    {pack.knockout_checklist!.map((k, i) => (
                      <li key={i}>
                        <strong className="text-hot">{k.risk}</strong>: {k.check}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {(pack.requirements_matrix ?? []).length > 0 && (
                <div>
                  <h3 className={`${microLabel} mb-1.5`}>Requirements &amp; our angle</h3>
                  <ul className="space-y-1.5 text-sm leading-relaxed text-fg-mid">
                    {pack.requirements_matrix!.map((r, i) => (
                      <li key={i}>
                        <strong className="text-fg">{r.requirement}</strong>
                        <span className="text-fg-soft"> → </span>
                        {r.angle}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {(pack.win_themes ?? []).length > 0 && (
                <div>
                  <h3 className={`${microLabel} mb-1.5`}>Win themes</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {pack.win_themes!.map((w, i) => (
                      <span
                        key={i}
                        className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-semibold text-accent-fg"
                      >
                        {w}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {(pack.response_outline ?? []).length > 0 && (
                <div>
                  <h3 className={`${microLabel} mb-1.5`}>Response outline</h3>
                  <ol className="list-decimal space-y-1 pl-5 text-sm leading-relaxed text-fg-mid">
                    {pack.response_outline!.map((s, i) => (
                      <li key={i}>
                        <strong className="text-fg">{s.section}:</strong> {s.guidance}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              {(pack.questions_for_buyer ?? []).length > 0 && (
                <div>
                  <h3 className={`${microLabel} mb-1.5`}>
                    Questions to submit before the Q&amp;A deadline
                  </h3>
                  <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-fg-mid">
                    {pack.questions_for_buyer!.map((q, i) => (
                      <li key={i}>{q}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {Object.keys(breakdown).length > 0 && (
          <Section title="Score breakdown">
            <div className="space-y-2.5">
              {SCORE_DIMENSIONS.map((d) => {
                const val = breakdown[d.key] ?? 0;
                return (
                  <div key={d.key} className="flex items-center gap-3 text-sm">
                    <span className="w-52 shrink-0 text-fg-mid">{d.label}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-sunken">
                      <div
                        className="h-full rounded-full bg-accent"
                        style={{ width: `${Math.min(100, (val / d.max) * 100)}%` }}
                      />
                    </div>
                    <span className="w-12 shrink-0 text-right tabular-nums text-fg-mid">
                      {val}/{d.max}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-xs leading-relaxed text-fg-soft">
              Rarely scoreable (TenderNed publishes no contract value; no
              relationship data yet):{" "}
              {SCORE_DIMENSIONS_SPARSE.map(
                (d) => `${d.label} ${breakdown[d.key] ?? 0}/${d.max}`
              ).join(" · ")}
              . Total out of 100.
            </p>
          </Section>
        )}

        {raw?.beschrijving && (
          <Section title="Original description (TenderNed)">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-fg-mid">
              {raw.beschrijving}
            </p>
          </Section>
        )}
      </div>
    </div>
  );
}
