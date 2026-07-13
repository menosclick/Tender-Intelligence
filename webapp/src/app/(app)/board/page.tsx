import { createSupabaseAdmin } from "@/lib/supabase/server";
import { daysUntil } from "@/lib/format";
import { PageHeader } from "@/lib/ui";
import { BoardClient, type BoardCard } from "./board-client";

export const dynamic = "force-dynamic";

// Phase 4: bid pipeline Kanban. Reads bid_pipeline + tender info; writes via server actions only.
export default async function BoardPage() {
  const admin = createSupabaseAdmin();

  const { data: cards } = await admin
    .from("bid_pipeline")
    .select("id,tender_id,stage,assignee,notes,updated_at")
    .order("updated_at", { ascending: false });

  const ids = (cards ?? []).map((c) => c.tender_id);
  const { data: tenders } = ids.length
    ? await admin
        .from("tenders_scraped")
        .select("id,naam,opdrachtgever,score,label,sluiting_datum")
        .in("id", ids)
    : { data: [] as never[] };

  const tMap = new Map((tenders ?? []).map((t) => [t.id, t]));
  const board: BoardCard[] = (cards ?? []).map((c) => {
    const t = tMap.get(c.tender_id);
    const days = daysUntil(t?.sluiting_datum ?? null);
    return {
      cardId: c.id,
      tenderId: c.tender_id,
      stage: c.stage,
      assignee: c.assignee,
      notes: c.notes,
      title: t?.naam ?? `Tender #${c.tender_id}`,
      buyer: t?.opdrachtgever ?? "",
      score: t?.score ?? null,
      label: t?.label ?? null,
      deadline: t?.sluiting_datum ?? null,
      daysToDeadline: days,
    };
  });

  return (
    <div>
      <PageHeader
        title="Bid board"
        sub="Drag cards between stages. Add tenders from their detail page."
      />
      <div className="mt-5">
        <BoardClient cards={board} />
      </div>
    </div>
  );
}
