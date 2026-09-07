import type { SupabaseClient } from "@supabase/supabase-js";
import { daysUntil, milestoneLabel } from "@/lib/format";

// Shared milestone-event builder for the Calendar page, the dashboard's
// Upcoming Milestones panel and the deadlines-in-30-days metric.
//
// Sources, in authority order:
// - TenderNed's own dates on the scraped row (question deadline, submission)
//   — official, and never shadowed by tender_milestones rows of the same kind.
// - tender_milestones — source 'documents'/'tenderned' count as official,
//   'manual' (typed in on the tender detail page) count as internal.
// Only future dates (days >= 0) become events.

// Board stages that mean "past Analysis" — these tenders get their dates tracked.
export const CALENDAR_STAGES = ["Analysis", "Q&A", "Submitted", "Award"];

export type MilestoneEvent = {
  tenderId: number;
  tenderTitle: string;
  /**
   * Short stand-in for the title on space-starved surfaces (calendar chips).
   * A tender in Analysis carries up to 10 tracked dates, so printing the full
   * Dutch title on every chip made one opportunity read as many duplicates
   * (Derson, 2026-09-07). The milestone leads the chip; this identifies which
   * tender it belongs to without swamping it.
   */
  tenderShort: string;
  label: string;
  date: string; // YYYY-MM-DD
  days: number;
  official: boolean;
  hot: boolean; // submission deadlines carry the urgency mark
};

// Dutch tender titles open with boilerplate that repeats across unrelated
// tenders ("Leveren, implementeren en onderhouden van een ..."), so a plain
// prefix-truncate yields chips that are indistinguishable from each other.
// Drop the leading verb clause, then keep whole words up to the budget.
const TITLE_PREAMBLE =
  /^(?:het\s+|de\s+)?(?:leveren|levering|implementeren|implementatie|onderhouden|onderhoud|aanschaf|aanbesteding|aanbesteden|inhuur|verwerven|verwerving|realiseren|realisatie|dienstverlening|europese)\b[\s,]*(?:en\s+)?/i;

export function shortTenderTitle(title: string, max = 22): string {
  let t = title.trim();
  // Peel repeated boilerplate verbs, then a bridging "van (een|de|het)".
  for (let i = 0; i < 4 && TITLE_PREAMBLE.test(t); i++) t = t.replace(TITLE_PREAMBLE, "");
  t = t.replace(/^van\s+(?:een\s+|de\s+|het\s+)?/i, "").trim();
  // Trailing procedure noise carries no identity: "- Openbaar", "(EU)".
  t = t.replace(/\s*[-–—(]\s*(openbaar|europees|niet-openbaar|eu)\b.*$/i, "").trim();
  // A title that was ALL boilerplate strips down to a bare article ("een") —
  // that names nothing, so keep the original rather than a meaningless chip.
  if (!t || /^(een|de|het|van|en)$/i.test(t)) t = title.trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const sp = cut.lastIndexOf(" ");
  return `${(sp > max * 0.5 ? cut.slice(0, sp) : cut).replace(/[\s,.;:-]+$/, "")}…`;
}

export async function getMilestoneEvents(
  admin: SupabaseClient
): Promise<MilestoneEvent[]> {
  const [{ data: board }, { data: feedback }] = await Promise.all([
    admin.from("bid_pipeline").select("tender_id,stage"),
    admin.from("tender_feedback").select("tender_id,value").eq("kind", "relevance"),
  ]);
  const notRelevant = new Set(
    (feedback ?? []).filter((f) => f.value === "not_relevant").map((f) => f.tender_id)
  );
  const ids = (board ?? [])
    .filter((b) => CALENDAR_STAGES.includes(b.stage) && !notRelevant.has(b.tender_id))
    .map((b) => b.tender_id);
  if (ids.length === 0) return [];

  const [{ data: tenders }, { data: extras }, { data: msRows }] = await Promise.all([
    admin.from("v_app_tenders").select("id,title,deadline,days_to_deadline").in("id", ids),
    admin.from("tenders_scraped").select("id,deadline_vragen").in("id", ids),
    admin
      .from("tender_milestones")
      .select("tender_id,kind,milestone_date,note,source")
      .in("tender_id", ids),
  ]);

  const vragenById = new Map((extras ?? []).map((e) => [e.id, e.deadline_vragen ?? ""]));
  const msByTender = new Map<
    number,
    { kind: string; milestone_date: string; note: string | null; source: string }[]
  >();
  for (const m of msRows ?? []) {
    const list = msByTender.get(m.tender_id) ?? [];
    list.push(m);
    msByTender.set(m.tender_id, list);
  }

  const events: MilestoneEvent[] = [];
  for (const t of tenders ?? []) {
    const title = t.title ?? `Tender #${t.id}`;
    const short = shortTenderTitle(title);
    const seenKinds = new Set<string>();

    const vragenDate = /^\d{4}-\d{2}-\d{2}/.exec((vragenById.get(t.id) ?? "").trim())?.[0];
    if (vragenDate) {
      const days = daysUntil(vragenDate);
      if (days !== null && days >= 0) {
        seenKinds.add("question_deadline");
        events.push({
          tenderId: t.id,
          tenderTitle: title,
          tenderShort: short,
          label: milestoneLabel("question_deadline"),
          date: vragenDate,
          days,
          official: true,
          hot: false,
        });
      }
    }
    if (t.deadline && t.days_to_deadline !== null && t.days_to_deadline >= 0) {
      seenKinds.add("submission_deadline");
      events.push({
        tenderId: t.id,
        tenderTitle: title,
        tenderShort: short,
        label: milestoneLabel("submission_deadline"),
        date: t.deadline,
        days: t.days_to_deadline,
        official: true,
        hot: true,
      });
    }
    for (const m of msByTender.get(t.id) ?? []) {
      if (seenKinds.has(m.kind)) continue; // TenderNed's own dates stay authoritative
      const days = daysUntil(m.milestone_date);
      if (days === null || days < 0) continue;
      seenKinds.add(m.kind);
      events.push({
        tenderId: t.id,
        tenderTitle: title,
        tenderShort: short,
        // "Other" says nothing on a timeline — the note is the label there.
        label: m.kind === "other" && m.note ? m.note.slice(0, 28) : milestoneLabel(m.kind),
        date: m.milestone_date,
        days,
        official: m.source !== "manual",
        hot: m.kind === "submission_deadline",
      });
    }
  }
  return events.sort((a, b) => a.days - b.days);
}
