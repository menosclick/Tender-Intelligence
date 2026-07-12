import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import {
  labelChip,
  deadlineText,
  deadlineClass,
  SCORE_DIMENSIONS,
  asArray,
} from "@/lib/format";
import { addToBoard } from "@/lib/actions";
import { FeedbackWidget } from "./feedback";

export const dynamic = "force-dynamic";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
      <h2 className="mb-2 text-sm font-semibold text-neutral-700">{title}</h2>
      {children}
    </section>
  );
}

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
      // description lives on the base table (read-only)
      admin
        .from("tenders_scraped")
        .select("beschrijving,trefwoorden,procedure,type_opdracht")
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

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* Header */}
      <div>
        <Link href="/dashboard" className="text-xs text-neutral-500 hover:underline">
          ← Back to dashboard
        </Link>
        <div className="mt-2 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold leading-snug">{t.title}</h1>
            <p className="mt-1 text-sm text-neutral-600">{t.buyer}</p>
          </div>
          <span
            className={`shrink-0 rounded-md px-2.5 py-1 text-sm font-bold ${labelChip(t.label)}`}
          >
            {t.label} · {t.score}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-neutral-600">
          <span className={deadlineClass(t.days_to_deadline)}>
            Deadline: {deadlineText(t.deadline, t.days_to_deadline)}
          </span>
          <span>Published: {t.published_date ?? "—"}</span>
          {t.cpv_main && <span>CPV: {t.cpv_main}</span>}
          {raw?.procedure && <span>Procedure: {raw.procedure}</span>}
        </div>
        <div className="mt-4 flex gap-2">
          {t.url && (
            <a
              href={t.url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-neutral-50"
            >
              View on TenderNed ↗
            </a>
          )}
          {t.pipeline_stage ? (
            <Link
              href="/board"
              className="rounded-md bg-accent-soft px-3 py-1.5 text-sm font-medium text-accent"
            >
              On board: {t.pipeline_stage} →
            </Link>
          ) : (
            <form action={addAction}>
              <button className="rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">
                Add to bid board
              </button>
            </form>
          )}
        </div>
      </div>

      <FeedbackWidget
        tenderId={tenderId}
        initialRelevance={relevance}
        initialOutcome={outcome}
      />

      {redFlags.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <strong>Red flags:</strong> {redFlags.join(" · ")}
        </div>
      )}

      {verdict && (
        <div
          className={`rounded-xl border-2 p-5 shadow-sm ${
            verdict.verdict === "bid"
              ? "border-green-500 bg-green-50"
              : verdict.verdict === "no_bid"
                ? "border-red-500 bg-red-50"
                : verdict.verdict === "conditional"
                  ? "border-amber-500 bg-amber-50"
                  : "border-neutral-300 bg-white"
          }`}
        >
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-base font-bold">
              {verdict.verdict === "bid" && (
                <span className="text-green-800">✓ BID — eligibility checked against the documents</span>
              )}
              {verdict.verdict === "no_bid" && (
                <span className="text-red-800">✕ NO-BID — hard requirement not met</span>
              )}
              {verdict.verdict === "conditional" && (
                <span className="text-amber-800">◐ CONDITIONAL — verify before committing</span>
              )}
              {verdict.verdict === "docs_unavailable" && (
                <span className="text-neutral-700">Documents not on TenderNed</span>
              )}
            </h2>
            {verdict.confidence && verdict.verdict !== "docs_unavailable" && (
              <span className="shrink-0 text-xs text-neutral-500">
                confidence: {verdict.confidence}
              </span>
            )}
          </div>
          {verdict.summary && (
            <p className="mt-2 text-sm text-neutral-800">{verdict.summary}</p>
          )}
          {verdict.verdict === "docs_unavailable" && verdict.external_platform_url && (
            <a
              href={verdict.external_platform_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-sm font-medium text-accent hover:underline"
            >
              Open the external tender platform ↗
            </a>
          )}

          {Array.isArray(verdict.hard_knockouts) && verdict.hard_knockouts.length > 0 && (
            <div className="mt-4">
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-red-700">
                Hard knockouts
              </h3>
              <ul className="space-y-1.5 text-sm text-neutral-800">
                {(verdict.hard_knockouts as { risk: string; impact: string; action: string }[]).map(
                  (k, i) => (
                    <li key={i}>
                      <strong>{k.risk}</strong> — {k.impact}
                      {k.action && (
                        <span className="text-neutral-600"> → {k.action}</span>
                      )}
                    </li>
                  )
                )}
              </ul>
            </div>
          )}

          {Array.isArray(verdict.eligibility_checks) && verdict.eligibility_checks.length > 0 && (
            <div className="mt-4">
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Eligibility checks (quoted from the tender documents)
              </h3>
              <div className="space-y-2">
                {(verdict.eligibility_checks as {
                  requirement: string;
                  source_quote: string;
                  status: string;
                  note: string;
                }[]).map((c, i) => (
                  <div key={i} className="rounded-md bg-white/70 p-2.5 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <strong className="text-neutral-900">{c.requirement}</strong>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${
                          c.status === "pass"
                            ? "bg-green-100 text-green-800"
                            : c.status === "fail"
                              ? "bg-red-100 text-red-800"
                              : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {c.status}
                      </span>
                    </div>
                    {c.source_quote && (
                      <p className="mt-1 border-l-2 border-neutral-300 pl-2 text-xs italic text-neutral-600">
                        “{c.source_quote}”
                      </p>
                    )}
                    {c.note && <p className="mt-1 text-xs text-neutral-700">{c.note}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {Array.isArray(verdict.verify_items) && verdict.verify_items.length > 0 && (
            <div className="mt-4">
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Verify before bidding
              </h3>
              <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-700">
                {(verdict.verify_items as string[]).map((v, i) => (
                  <li key={i}>{v}</li>
                ))}
              </ul>
            </div>
          )}

          {Array.isArray(verdict.docs_used) && verdict.docs_used.length > 0 && (
            <p className="mt-3 text-xs text-neutral-400">
              Based on: {(verdict.docs_used as string[]).join(" · ")}
            </p>
          )}
        </div>
      )}

      {t.executive_summary && (
        <Section title="Executive summary">
          <p className="text-sm text-neutral-700">{t.executive_summary}</p>
        </Section>
      )}

      {t.what_is_being_bought && (
        <Section title="What is being bought">
          <p className="text-sm text-neutral-700">{t.what_is_being_bought}</p>
        </Section>
      )}

      {t.why_it_matters && (
        <Section title="Why it matters">
          <p className="text-sm text-neutral-700">{t.why_it_matters}</p>
        </Section>
      )}

      {(products.length > 0 || t.fit_reasoning) && (
        <Section title={`Product fit${t.fit_level ? ` — ${t.fit_level}` : ""}`}>
          {products.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {products.map((p) => (
                <span
                  key={p}
                  className="rounded-md bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent"
                >
                  {p}
                </span>
              ))}
            </div>
          )}
          {t.fit_reasoning && (
            <p className="text-sm text-neutral-700">{t.fit_reasoning}</p>
          )}
        </Section>
      )}

      {requirements.length > 0 && (
        <Section title="Key requirements">
          <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-700">
            {requirements.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </Section>
      )}

      {risks.length > 0 && (
        <Section title="Possible knockout risks">
          <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-700">
            {risks.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </Section>
      )}

      {t.route_to_market && (
        <Section title="Route to market">
          <p className="text-sm font-medium text-neutral-800">{t.route_to_market}</p>
          {t.route_reasoning && (
            <p className="mt-1 text-sm text-neutral-700">{t.route_reasoning}</p>
          )}
          {t.route_first_action && (
            <p className="mt-2 text-sm text-neutral-700">
              <strong>First action:</strong> {t.route_first_action}
            </p>
          )}
        </Section>
      )}

      {pack && (
        <div className="rounded-xl border-2 border-accent bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-accent">
              Bid pack — generated for this Hot tender
            </h2>
            <span className="text-xs text-neutral-400">
              {bidPack?.created_at
                ? new Date(bidPack.created_at).toLocaleDateString("nl-NL")
                : ""}
            </span>
          </div>
          <div className="space-y-4">
            {(pack.knockout_checklist ?? []).length > 0 && (
              <div>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Knockout checklist — verify before bidding
                </h3>
                <ul className="space-y-1.5 text-sm text-neutral-700">
                  {pack.knockout_checklist!.map((k, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-red-600">▲</span>
                      <span>
                        <strong>{k.risk}</strong> — {k.check}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {(pack.requirements_matrix ?? []).length > 0 && (
              <div>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Requirements &amp; our angle
                </h3>
                <ul className="space-y-1.5 text-sm text-neutral-700">
                  {pack.requirements_matrix!.map((r, i) => (
                    <li key={i}>
                      <strong>{r.requirement}</strong>
                      <span className="text-neutral-500"> → </span>
                      {r.angle}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {(pack.win_themes ?? []).length > 0 && (
              <div>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Win themes
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {pack.win_themes!.map((w, i) => (
                    <span
                      key={i}
                      className="rounded-md bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent"
                    >
                      {w}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {(pack.response_outline ?? []).length > 0 && (
              <div>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Response outline
                </h3>
                <ol className="list-decimal space-y-1 pl-5 text-sm text-neutral-700">
                  {pack.response_outline!.map((s, i) => (
                    <li key={i}>
                      <strong>{s.section}:</strong> {s.guidance}
                    </li>
                  ))}
                </ol>
              </div>
            )}
            {(pack.questions_for_buyer ?? []).length > 0 && (
              <div>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Questions to submit before the Q&amp;A deadline
                </h3>
                <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-700">
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
          <div className="space-y-2">
            {SCORE_DIMENSIONS.map((d) => {
              const val = breakdown[d.key] ?? 0;
              return (
                <div key={d.key} className="flex items-center gap-3 text-sm">
                  <span className="w-52 shrink-0 text-neutral-600">{d.label}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-100">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${Math.min(100, (val / d.max) * 100)}%` }}
                    />
                  </div>
                  <span className="w-12 shrink-0 text-right tabular-nums text-neutral-600">
                    {val}/{d.max}
                  </span>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {raw?.beschrijving && (
        <Section title="Original description (TenderNed)">
          <p className="whitespace-pre-wrap text-sm text-neutral-600">
            {raw.beschrijving}
          </p>
        </Section>
      )}
    </div>
  );
}
