"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServer, createSupabaseAdmin } from "@/lib/supabase/server";
import { BOARD_STAGES, MILESTONE_KINDS, type BoardStage } from "@/lib/format";

// GOLDEN RULE: the app writes to bid_pipeline, tender_feedback and
// tender_milestones, and may INSERT new rows into tenders_scraped ONLY with
// platform='manual' (status pre-set to 'analyzed' so the n8n pipeline never
// picks them up). It never updates or deletes rows the scraper owns.

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

  // Board is also a capture point: Won/Lost/Bidding on the board records the learning signal.
  const outcomeMap: Record<string, string> = {
    Won: "won",
    Lost: "lost",
    "Q&A": "bidding",
    Submitted: "bidding",
    Award: "bidding",
  };
  if (card && outcomeMap[stage]) {
    await admin.from("tender_feedback").upsert(
      { tender_id: card.tender_id, kind: "outcome", value: outcomeMap[stage], user_email: user.email },
      { onConflict: "tender_id,kind" }
    );
  }
  revalidatePath("/board");
  revalidatePath("/learning");
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
  if (!MILESTONE_KINDS.some((k) => k.key === kind))
    throw new Error("Invalid milestone kind");
  const date = String(formData.get("date") ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Invalid date");
  const note = String(formData.get("note") ?? "").trim() || null;

  const admin = createSupabaseAdmin();
  // One row per (tender, kind): re-adding a kind corrects its date/note.
  // A typed-in date always wins over an extracted one, so source flips to
  // manual on conflict — the human is the authority on the planning table.
  const { error } = await admin.from("tender_milestones").upsert(
    { tender_id: tenderId, kind, milestone_date: date, note, source: "manual" },
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

// ---- Learning loop: capture the human signal ----

export async function recordFeedback(
  tenderId: number,
  kind: "relevance" | "outcome",
  value: string
) {
  const user = await requireUser();
  const admin = createSupabaseAdmin();
  const { error } = await admin.from("tender_feedback").upsert(
    { tender_id: tenderId, kind, value, user_email: user.email },
    { onConflict: "tender_id,kind" }
  );
  if (error) throw new Error(error.message);

  // Mirror of moveCard's outcome capture: a final outcome recorded here moves
  // the board card too, so the funnel never disagrees with the feedback.
  const finalStage: Record<string, BoardStage> = { won: "Won", lost: "Lost" };
  if (kind === "outcome" && finalStage[value]) {
    await admin
      .from("bid_pipeline")
      .update({ stage: finalStage[value] })
      .eq("tender_id", tenderId);
    revalidatePath("/board");
    revalidatePath("/dashboard");
  }
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
