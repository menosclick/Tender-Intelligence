"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServer, createSupabaseAdmin } from "@/lib/supabase/server";
import { BOARD_STAGES, MANUAL_MILESTONE_KINDS, type BoardStage } from "@/lib/format";

// GOLDEN RULE: the app writes to bid_pipeline, tender_feedback,
// tender_milestones and tender_actions, and may INSERT new rows into
// tenders_scraped ONLY with platform='manual' (status pre-set to 'analyzed'
// so the n8n pipeline never picks them up). It never updates or deletes rows
// the scraper owns. tender_documents and milestone_extractions are written by
// the n8n Leidraad Milestone Extractor — the app only reads them.

// The single mapping between a board stage and the outcome it implies.
// `null` means "this stage asserts no outcome" — any previously recorded one
// is retracted when a card lands here. Terminal outcomes map back to exactly
// one stage (see FINAL_STAGE), so the two directions can never disagree.
const STAGE_OUTCOME: Record<BoardStage, string | null> = {
  Identified: null,
  Analysis: null,
  "Q&A": "bidding",
  Submitted: "bidding",
  Award: "bidding",
  Won: "won",
  Lost: "lost",
  Dropped: "no_bid",
};

// Outcomes that name a single unambiguous stage. "bidding" is deliberately
// absent: it covers Q&A, Submitted and Award, so it can't pick one.
const FINAL_STAGE: Record<string, BoardStage> = {
  won: "Won",
  lost: "Lost",
  no_bid: "Dropped",
};

// Server actions are callable with arbitrary arguments — the feedback that
// trains the scorer is whitelisted, never passed through.
const FEEDBACK_VALUES: Record<string, string[]> = {
  relevance: ["relevant", "not_relevant"],
  outcome: ["bidding", "won", "lost", "no_bid"],
};

async function requireUser() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

export async function addToBoard(tenderId: number) {
  await requireUser();
  const admin = createSupabaseAdmin();
  const { error } = await admin
    .from("bid_pipeline")
    .upsert(
      { tender_id: tenderId, stage: "Identified" },
      { onConflict: "tender_id", ignoreDuplicates: true }
    );
  if (error) throw new Error(error.message);
  revalidatePath("/board");
  revalidatePath("/inbox");
  revalidatePath("/dashboard");
  revalidatePath(`/tender/${tenderId}`);
}

export async function moveCard(cardId: number, stage: BoardStage) {
  const user = await requireUser();
  if (!BOARD_STAGES.includes(stage)) throw new Error("Invalid stage");
  const admin = createSupabaseAdmin();
  const { data: card, error } = await admin
    .from("bid_pipeline")
    .update({ stage })
    .eq("id", cardId)
    .select("tender_id")
    .single();
  if (error) throw new Error(error.message);

  // Board is also a capture point: the stage records the learning signal.
  // EVERY stage maps to exactly one outcome state, including the two that mean
  // "no outcome yet". Without that, dragging a card back out of Won/Lost (a
  // mis-drop, or a corrected decision) left the old "won"/"lost" in
  // tender_feedback forever — invisible on screen, but consumed by the reports
  // funnel and by generate_scoring_suggestions. The board is the authority.
  if (card) {
    const outcome = STAGE_OUTCOME[stage];
    if (outcome) {
      await admin.from("tender_feedback").upsert(
        { tender_id: card.tender_id, kind: "outcome", value: outcome, user_email: user.email },
        { onConflict: "tender_id,kind" }
      );
    } else {
      await admin
        .from("tender_feedback")
        .delete()
        .eq("tender_id", card.tender_id)
        .eq("kind", "outcome");
    }
  }
  revalidatePath("/board");
  revalidatePath("/learning");
  revalidatePath("/reports");
}

export async function updateCard(
  cardId: number,
  fields: { assignee?: string | null; notes?: string | null }
) {
  await requireUser();
  const admin = createSupabaseAdmin();
  const { error } = await admin
    .from("bid_pipeline")
    .update(fields)
    .eq("id", cardId);
  if (error) throw new Error(error.message);
  revalidatePath("/board");
}

export async function removeCard(cardId: number) {
  await requireUser();
  const admin = createSupabaseAdmin();
  const { error } = await admin.from("bid_pipeline").delete().eq("id", cardId);
  if (error) throw new Error(error.message);
  revalidatePath("/board");
}

// ---- Manual registration: tenders bid outside the platform ----

const MANUAL_LABELS = ["Hot", "Warm", "Cold"] as const;

export async function createManualTender(formData: FormData) {
  const user = await requireUser();

  const opt = (k: string) => {
    const v = String(formData.get(k) ?? "").trim();
    return v || null;
  };
  const naam = opt("naam");
  const opdrachtgever = opt("opdrachtgever");
  if (!naam || !opdrachtgever)
    throw new Error("Tender name and authority are required");

  const label = String(formData.get("label") ?? "Warm");
  if (!MANUAL_LABELS.includes(label as (typeof MANUAL_LABELS)[number]))
    throw new Error("Invalid label");

  const scoreRaw = opt("score");
  const score = scoreRaw
    ? Math.max(0, Math.min(100, parseInt(scoreRaw, 10) || 0))
    : null;

  const outcome = String(formData.get("outcome") ?? "");
  let stage = String(formData.get("stage") ?? "");
  // A historical result implies the matching board column.
  if (!stage && outcome === "won") stage = "Won";
  if (!stage && outcome === "lost") stage = "Lost";

  const admin = createSupabaseAdmin();
  const { data: row, error } = await admin
    .from("tenders_scraped")
    .insert({
      external_id: `manual-${Date.now()}`,
      naam,
      opdrachtgever,
      beschrijving: opt("beschrijving"),
      waarde: opt("waarde"),
      cpv_main: opt("cpv_main"),
      sluiting_datum: opt("sluiting_datum"),
      publicatie_datum: opt("publicatie_datum"),
      url: opt("url"),
      procedure: opt("procedure"),
      buyer_type_detected: opt("buyer_type"),
      platform: "manual",
      status: "analyzed",
      analyzed_at: new Date().toISOString(),
      label,
      score,
      keyword_result: "MANUAL",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const tenderId = row!.id as number;

  if (stage && BOARD_STAGES.includes(stage as BoardStage)) {
    await admin
      .from("bid_pipeline")
      .upsert({ tender_id: tenderId, stage }, { onConflict: "tender_id" });
  }
  if (outcome === "won" || outcome === "lost") {
    await admin.from("tender_feedback").upsert(
      { tender_id: tenderId, kind: "outcome", value: outcome, user_email: user.email },
      { onConflict: "tender_id,kind" }
    );
  }

  revalidatePath("/dashboard");
  revalidatePath("/board");
  revalidatePath("/reports");
  redirect(`/tender/${tenderId}`);
}

// ---- Key dates: milestones feeding the dashboard deadline calendar ----

export async function addMilestone(tenderId: number, formData: FormData) {
  await requireUser();
  const kind = String(formData.get("kind") ?? "");
  // Only kinds the form offers: TenderNed-owned kinds (publication, question/
  // submission deadline) come from the scraped row and can't be corrected here.
  if (!MANUAL_MILESTONE_KINDS.some((k) => k.key === kind))
    throw new Error("Invalid milestone kind");
  const date = String(formData.get("date") ?? "").trim();
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!dm) throw new Error("Invalid date");
  // Reject impossible dates (Feb 31 round-trips to a different day) and typo
  // years — a 3026 milestone would sort as "long-term" forever.
  const [y, mo, d] = [+dm[1], +dm[2], +dm[3]];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (
    y < 2000 ||
    y > 2100 ||
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== mo - 1 ||
    dt.getUTCDate() !== d
  )
    throw new Error("Invalid date");
  const note = String(formData.get("note") ?? "").trim().slice(0, 120) || null;

  const admin = createSupabaseAdmin();
  // One row per (tender, kind): re-adding a kind corrects its date/note.
  // A typed-in date wins over an extracted one — the human is the authority on
  // the planning table — but overriding must not DESTROY what the extractor
  // found. Blank note used to null out the note quoted from the tender
  // documents, so an override silently erased its own provenance.
  const { data: existing } = await admin
    .from("tender_milestones")
    .select("note,source")
    .eq("tender_id", tenderId)
    .eq("kind", kind)
    .maybeSingle();
  const keptNote = note ?? existing?.note ?? null;

  const { error } = await admin.from("tender_milestones").upsert(
    { tender_id: tenderId, kind, milestone_date: date, note: keptNote, source: "manual" },
    { onConflict: "tender_id,kind" }
  );
  if (error) throw new Error(error.message);
  revalidatePath(`/tender/${tenderId}`);
  revalidatePath("/dashboard");
}

export async function removeMilestone(milestoneId: number, tenderId: number) {
  await requireUser();
  const admin = createSupabaseAdmin();
  // Only manual rows are removable from the app; extracted rows (documents/
  // tenderned) belong to the pipeline and can only be overridden, not deleted.
  const { error } = await admin
    .from("tender_milestones")
    .delete()
    .eq("id", milestoneId)
    .eq("source", "manual");
  if (error) throw new Error(error.message);
  revalidatePath(`/tender/${tenderId}`);
  revalidatePath("/dashboard");
}

// ---- Operational actions: the Needs Attention loop ----

const ACTION_STATUSES = ["open", "in_progress", "waiting", "blocked", "completed"];

// Reject impossible dates (Feb 31 round-trips to a different day) and typo years.
function isRealDate(date: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return false;
  const [y, mo, d] = [+m[1], +m[2], +m[3]];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return (
    y >= 2000 &&
    y <= 2100 &&
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === mo - 1 &&
    dt.getUTCDate() === d
  );
}

export async function addAction(formData: FormData) {
  const user = await requireUser();
  const title = String(formData.get("title") ?? "").trim().slice(0, 200);
  if (!title) throw new Error("Action title is required");
  const tenderRaw = String(formData.get("tender_id") ?? "").trim();
  const tenderId = tenderRaw ? Number.parseInt(tenderRaw, 10) : null;
  if (tenderRaw && !Number.isInteger(tenderId)) throw new Error("Invalid tender");
  const opt = (k: string) => String(formData.get(k) ?? "").trim().slice(0, 120) || null;
  const owner = opt("owner");
  const waitingOn = opt("waiting_on");
  const due = String(formData.get("internal_due") ?? "").trim();
  if (due && !isRealDate(due)) throw new Error("Invalid date");

  const admin = createSupabaseAdmin();
  const { error } = await admin.from("tender_actions").insert({
    tender_id: tenderId,
    title,
    owner,
    waiting_on: waitingOn,
    internal_due: due || null,
    // Naming who you wait for IS the waiting state — no separate toggle.
    status: waitingOn ? "waiting" : "open",
    created_by: user.email,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
}

export async function setActionStatus(actionId: number, status: string) {
  await requireUser();
  if (!ACTION_STATUSES.includes(status)) throw new Error("Invalid status");
  const admin = createSupabaseAdmin();
  const { error } = await admin
    .from("tender_actions")
    .update({
      status,
      updated_at: new Date().toISOString(),
      completed_at: status === "completed" ? new Date().toISOString() : null,
    })
    .eq("id", actionId);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
}

export async function deleteAction(actionId: number) {
  await requireUser();
  const admin = createSupabaseAdmin();
  const { error } = await admin.from("tender_actions").delete().eq("id", actionId);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
}

// ---- Learning loop: capture the human signal ----

export async function recordFeedback(
  tenderId: number,
  kind: "relevance" | "outcome",
  value: string
) {
  const user = await requireUser();
  if (!Number.isInteger(tenderId)) throw new Error("Invalid tender");
  if (!FEEDBACK_VALUES[kind]?.includes(value))
    throw new Error("Invalid feedback");

  const admin = createSupabaseAdmin();
  const { error } = await admin.from("tender_feedback").upsert(
    { tender_id: tenderId, kind, value, user_email: user.email },
    { onConflict: "tender_id,kind" }
  );
  if (error) throw new Error(error.message);

  // Mirror of moveCard's outcome capture: a final outcome recorded here moves
  // the board card too, so the funnel never disagrees with the feedback.
  if (kind === "outcome" && FINAL_STAGE[value]) {
    await admin
      .from("bid_pipeline")
      .update({ stage: FINAL_STAGE[value] })
      .eq("tender_id", tenderId);
    revalidatePath("/board");
  }
  revalidatePath("/dashboard");
  revalidatePath("/inbox");
  revalidatePath("/reports");
  revalidatePath(`/tender/${tenderId}`);
}

export async function decideSuggestion(id: number, approve: boolean) {
  const user = await requireUser();
  const admin = createSupabaseAdmin();
  const fn = approve ? "approve_suggestion" : "reject_suggestion";
  const { error } = await admin.rpc(fn, { p_id: id, p_user: user.email });
  if (error) throw new Error(error.message);
  revalidatePath("/learning");
}

export async function runLearning() {
  await requireUser();
  const admin = createSupabaseAdmin();
  const { error } = await admin.rpc("generate_scoring_suggestions");
  if (error) throw new Error(error.message);
  revalidatePath("/learning");
}
