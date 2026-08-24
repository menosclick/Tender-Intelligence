import Link from "next/link";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { deadlineClass, deadlineText, stageLabel } from "@/lib/format";
import { LabelChip, PageHeader, microLabel } from "@/lib/ui";

export const dynamic = "force-dynamic";

// Document Vault: every tender's document intelligence in one place — the
// files TenderNed lists (metadata fetched by the extraction workflow; the
// files themselves stay on TenderNed), the AI document verdict, and the bid
// pack. Nothing here is stored locally; links go to the source.

type DocRow = {
  tender_id: number;
  doc_name: string;
  category: string | null;
  file_type: string | null;
  size_bytes: number | null;
  read_for_extraction: boolean;
};

const CATEGORY_LABEL: Record<string, string> = {
  DOC: "Tender documents",
  NVI: "Nota van Inlichtingen",
  ANK: "Announcement",
};

const VERDICT_CHIP: Record<string, { cls: string; text: string }> = {
  bid: { cls: "bg-ok-soft text-ok", text: "BID" },
  no_bid: { cls: "bg-hot-soft text-hot", text: "NO-BID" },
  conditional: { cls: "bg-warm-soft text-warm", text: "CONDITIONAL" },
  docs_unavailable: { cls: "bg-sunken text-fg-mid", text: "Docs elsewhere" },
};

function fmtSize(bytes: number | null): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtDate(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "";
}

// external_platform_url is written by the AI verdict step from third-party
// document text — an untrusted writer. Only ever link http(s).
function safeHttpUrl(url: unknown): string | null {
  return typeof url === "string" && /^https?:\/\//i.test(url) ? url : null;
}

// Working stages first (in lifecycle order), then everything else.
const STAGE_ORDER: Record<string, number> = {
  Identified: 0,
  Analysis: 1,
  "Q&A": 2,
  Submitted: 3,
  Award: 4,
};

export default async function VaultPage() {
  const admin = createSupabaseAdmin();
  const [
    { data: packs },
    { data: verdicts },
    { data: docs },
    { data: extractions },
    { data: board },
  ] = await Promise.all([
    admin.from("bid_packs").select("tender_id,created_at"),
    admin
      .from("bid_verdicts")
      .select("tender_id,verdict,confidence,summary,docs_used,external_platform_url"),
    admin
      .from("tender_documents")
      .select("tender_id,doc_name,category,file_type,size_bytes,read_for_extraction")
      .order("id"),
    admin
      .from("milestone_extractions")
      .select("tender_id,extracted_at,docs_listed,docs_read,milestones_found,status"),
    admin.from("bid_pipeline").select("tender_id,stage"),
  ]);

  // A tender belongs in the vault when it has any document artifact, or is
  // being actively pursued (so its "no documents" state is stated, not hidden).
  const workingBoard = (board ?? []).filter((b) => STAGE_ORDER[b.stage] !== undefined);
  const ids = [
    ...new Set([
      ...(packs ?? []).map((p) => p.tender_id),
      ...(verdicts ?? []).map((v) => v.tender_id),
      ...(docs ?? []).map((d) => d.tender_id),
      ...workingBoard.map((b) => b.tender_id),
    ]),
  ];

  const [{ data: tenders }, { data: platforms }] = await Promise.all([
    ids.length
      ? admin
          .from("v_app_tenders")
          .select("id,title,buyer,deadline,days_to_deadline,label,url,pipeline_stage")
          .in("id", ids)
      : Promise.resolve({ data: [] as never[] }),
    // platform is scraper-owned; read-only lookup to explain missing documents
    ids.length
      ? admin.from("tenders_scraped").select("id,platform").in("id", ids)
      : Promise.resolve({ data: [] as never[] }),
  ]);

  const packByTender = new Map((packs ?? []).map((p) => [p.tender_id, p]));
  const verdictByTender = new Map((verdicts ?? []).map((v) => [v.tender_id, v]));
  const extractionByTender = new Map(
    (extractions ?? []).map((e) => [e.tender_id, e])
  );
  const platformById = new Map(
    (platforms ?? []).map((p: { id: number; platform: string | null }) => [
      p.id,
      (p.platform ?? "").toLowerCase(),
    ])
  );
  const docsByTender = new Map<number, DocRow[]>();
  for (const d of (docs ?? []) as DocRow[]) {
    const list = docsByTender.get(d.tender_id) ?? [];
    list.push(d);
    docsByTender.set(d.tender_id, list);
  }

  const rows = (tenders ?? [])
    .map((t) => ({
      t,
      // A terminal stage (Won/Lost/Dropped) is NOT in the pipeline. It used to
      // fall into the `?? 9` bucket, which passed the `<= 9` test below and
      // rendered under "In the pipeline" next to its own "Dropped" chip.
      stageRank:
        t.pipeline_stage != null
          ? STAGE_ORDER[t.pipeline_stage] ?? 9.5
          : 10,
    }))
    .sort(
      (a, b) =>
        a.stageRank - b.stageRank ||
        (a.t.deadline ?? "9999").localeCompare(b.t.deadline ?? "9999")
    );

  const inPipeline = rows.filter((r) => r.stageRank <= 9);
  // Closed pursuits and never-boarded tenders both belong under "Not in the pipeline".
  const offBoard = rows.filter((r) => r.stageRank > 9);

  // Header counts describe what the page actually shows: only artifacts of
  // tenders the view still qualifies. A tender re-labelled Disqualified keeps
  // its rows in the artifact tables but loses its card — the difference is
  // stated below, never silently absorbed into the totals.
  const renderedIds = new Set((tenders ?? []).map((t) => t.id));
  const docCount = (docs ?? []).filter((d) => renderedIds.has(d.tender_id)).length;
  const packCount = (packs ?? []).filter((p) => renderedIds.has(p.tender_id)).length;
  const verdictCount = (verdicts ?? []).filter((v) => renderedIds.has(v.tender_id)).length;
  const hiddenCount =
    (docs?.length ?? 0) - docCount +
    ((packs?.length ?? 0) - packCount) +
    ((verdicts?.length ?? 0) - verdictCount);

  const renderCard = (t: (typeof rows)[number]["t"]) => {
    const tDocs = docsByTender.get(t.id) ?? [];
    const verdict = verdictByTender.get(t.id);
    const pack = packByTender.get(t.id);
    const extraction = extractionByTender.get(t.id);
    const platform = platformById.get(t.id) ?? "";
    const vChip = verdict ? VERDICT_CHIP[verdict.verdict] : undefined;

    return (
      <div key={t.id} className="rounded-xl border border-line bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
          <div className="min-w-0 flex-1">
            <Link
              href={`/tender/${t.id}`}
              className="block truncate text-sm font-semibold text-fg hover:text-accent-fg hover:underline"
              title={t.title ?? undefined}
            >
              {t.title}
            </Link>
            <p className="mt-0.5 truncate text-xs text-fg-mid">{t.buyer}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {t.pipeline_stage && (
              <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent-fg">
                {stageLabel(t.pipeline_stage)}
              </span>
            )}
            <LabelChip label={t.label} />
            <span className={`text-xs ${deadlineClass(t.days_to_deadline)}`}>
              {deadlineText(t.deadline, t.days_to_deadline)}
            </span>
          </div>
        </div>

        {/* Documents */}
        <div className="mt-4">
          <h3 className={`${microLabel} mb-1.5`}>Documents</h3>
          {tDocs.length > 0 ? (
            <>
              <ul className="divide-y divide-line/60">
                {tDocs.map((d) => (
                  <li
                    key={d.doc_name}
                    className="flex items-center justify-between gap-4 py-1.5 text-sm"
                  >
                    <span className="min-w-0 truncate text-fg" title={d.doc_name}>
                      {d.doc_name}
                    </span>
                    <span className="flex shrink-0 items-center gap-3 text-xs text-fg-soft">
                      {d.read_for_extraction && (
                        <span className="font-medium text-accent-fg">read by AI</span>
                      )}
                      {d.category && (
                        <span>{CATEGORY_LABEL[d.category] ?? d.category}</span>
                      )}
                      {d.size_bytes ? <span className="tabular-nums">{fmtSize(d.size_bytes)}</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
              {safeHttpUrl(t.url) && (
                <a
                  href={safeHttpUrl(t.url)!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1.5 inline-block text-xs font-medium text-accent-fg hover:underline"
                >
                  Download from TenderNed →
                </a>
              )}
            </>
          ) : verdict?.verdict === "docs_unavailable" ? (
            <p className="text-sm text-fg-mid">
              Not hosted on TenderNed — the files live on an external platform.
              {safeHttpUrl(verdict.external_platform_url) && (
                <>
                  {" "}
                  <a
                    href={safeHttpUrl(verdict.external_platform_url)!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-accent-fg hover:underline"
                  >
                    Open it →
                  </a>
                </>
              )}
            </p>
          ) : extraction?.status === "no_docs" ? (
            <p className="text-sm text-fg-mid">
              No documents on TenderNed (checked {fmtDate(extraction.extracted_at)}).
            </p>
          ) : platform === "manual" ? (
            <p className="text-sm text-fg-mid">
              Registered manually — its documents live on the buyer&apos;s own platform.
            </p>
          ) : (
            <p className="text-sm text-fg-mid">
              Not fetched yet. The pipeline lists a tender&apos;s documents
              automatically once it moves into Analysis.
            </p>
          )}
          {extraction && extraction.milestones_found > 0 && (
            <p className="mt-1.5 text-xs text-fg-soft">
              {extraction.milestones_found} key{" "}
              {extraction.milestones_found === 1 ? "date" : "dates"} extracted from
              these documents ·{" "}
              <Link href="/calendar" className="font-medium text-accent-fg hover:underline">
                Calendar →
              </Link>
            </p>
          )}
        </div>

        {/* Verdict + bid pack */}
        {(verdict || pack) && (
          <div className="mt-4 space-y-3 border-t border-line/60 pt-3.5">
            {verdict && vChip && (
              <div className="text-sm">
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${vChip.cls}`}>
                    {vChip.text}
                  </span>
                  {verdict.confidence && verdict.verdict !== "docs_unavailable" && (
                    <span className="text-xs text-fg-soft">
                      confidence: {verdict.confidence}
                    </span>
                  )}
                  {Array.isArray(verdict.docs_used) && verdict.docs_used.length > 0 && (
                    <span className="text-xs text-fg-soft">
                      · based on {verdict.docs_used.length}{" "}
                      {verdict.docs_used.length === 1 ? "document" : "documents"}
                    </span>
                  )}
                </div>
                {verdict.summary && (
                  <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-fg-mid">
                    {verdict.summary}
                  </p>
                )}
                <Link
                  href={`/tender/${t.id}`}
                  className="mt-1 inline-block text-xs font-medium text-accent-fg hover:underline"
                >
                  Full verdict on the tender page →
                </Link>
              </div>
            )}
            {pack && (
              <p className="text-sm text-fg-mid">
                Bid pack generated {fmtDate(pack.created_at)} — knockout checklist,
                requirements angle, win themes, response outline, buyer questions.{" "}
                <Link
                  href={`/tender/${t.id}#bid-pack`}
                  className="font-medium text-accent-fg hover:underline"
                >
                  Open bid pack →
                </Link>
              </p>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Document Vault"
        sub={`Documents, verdicts and bid packs across all tenders — ${docCount} ${
          docCount === 1 ? "document" : "documents"
        } listed · ${packCount} bid ${packCount === 1 ? "pack" : "packs"} · ${verdictCount} ${
          verdictCount === 1 ? "verdict" : "verdicts"
        }. Files stay on TenderNed; the vault links to the source.${
          hiddenCount > 0
            ? ` ${hiddenCount} ${hiddenCount === 1 ? "artifact belongs" : "artifacts belong"} to tenders no longer qualified and ${hiddenCount === 1 ? "is" : "are"} hidden.`
            : ""
        }`}
      />

      {rows.length === 0 ? (
        <div className="mt-8 rounded-xl border border-line bg-surface px-6 py-12 text-center">
          <p className="text-sm font-medium text-fg">Nothing in the vault yet.</p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-fg-mid">
            Documents, verdicts and bid packs appear here as the pipeline
            processes Hot tenders and you move tenders into Analysis.
          </p>
          <Link
            href="/inbox"
            className="mt-5 inline-block text-sm font-medium text-accent-fg hover:underline"
          >
            Open the Tender Inbox →
          </Link>
        </div>
      ) : (
        <>
          {inPipeline.length > 0 && (
            <>
              <h2 className={`${microLabel} mt-6`}>
                In the pipeline · {inPipeline.length}
              </h2>
              <div className="mt-2 space-y-3">{inPipeline.map((r) => renderCard(r.t))}</div>
            </>
          )}
          {offBoard.length > 0 && (
            <>
              <h2 className={`${microLabel} mt-8`}>
                Not in the pipeline · {offBoard.length}
              </h2>
              <div className="mt-2 space-y-3">{offBoard.map((r) => renderCard(r.t))}</div>
            </>
          )}
        </>
      )}
    </div>
  );
}
