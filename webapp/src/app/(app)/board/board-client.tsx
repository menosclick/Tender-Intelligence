"use client";

import { useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { moveCard, updateCard, removeCard } from "@/lib/actions";
import { BOARD_STAGES, deadlineClass, stageLabel, type BoardStage } from "@/lib/format";
import { LabelChip, btnPrimary, inputCls } from "@/lib/ui";

export type BoardCard = {
  cardId: number;
  tenderId: number;
  stage: string;
  assignee: string | null;
  notes: string | null;
  title: string;
  buyer: string;
  score: number | null;
  label: string | null;
  deadline: string | null;
  daysToDeadline: number | null;
};

export function BoardClient({ cards }: { cards: BoardCard[] }) {
  const [, startTransition] = useTransition();
  const [optimistic, applyMove] = useOptimistic(
    cards,
    (state, move: { cardId: number; stage: BoardStage }) =>
      state.map((c) => (c.cardId === move.cardId ? { ...c, stage: move.stage } : c))
  );
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [openCard, setOpenCard] = useState<number | null>(null);

  function onDrop(e: React.DragEvent, stage: BoardStage) {
    e.preventDefault();
    setDragOver(null);
    const cardId = Number(e.dataTransfer.getData("text/plain"));
    if (!cardId) return;
    startTransition(async () => {
      applyMove({ cardId, stage });
      await moveCard(cardId, stage);
    });
  }

  return (
    <div className="overflow-x-auto pb-4">
      {optimistic.length === 0 && (
        <div className="mb-4 rounded-xl border border-line bg-surface px-6 py-8 text-center">
          <p className="text-sm font-medium text-fg">
            No tenders in the pipeline yet.
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-fg-mid">
            Qualify your first one from the Tender Inbox — every open Hot or
            Warm tender there has an &ldquo;Add to pipeline&rdquo; action, and
            it lands here in Identified.
          </p>
          <Link
            href="/inbox"
            className="mt-4 inline-block text-sm font-medium text-accent-fg hover:underline"
          >
            Open the Tender Inbox →
          </Link>
        </div>
      )}
      <div className="flex min-w-max gap-3">
        {BOARD_STAGES.map((stage) => {
          const items = optimistic.filter((c) => c.stage === stage);
          return (
            <div
              key={stage}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(stage);
              }}
              onDragLeave={() => setDragOver(null)}
              onDrop={(e) => onDrop(e, stage)}
              className={`w-64 shrink-0 rounded-xl border p-2 transition-colors duration-150 ${
                dragOver === stage
                  ? "border-accent bg-accent-soft/50"
                  : "border-line/60 bg-sunken/70"
              }`}
            >
              <p className="flex items-center justify-between px-1.5 py-1 text-xs font-semibold uppercase tracking-wider text-fg-soft">
                {stageLabel(stage)}
                <span className="rounded-full bg-surface px-1.5 py-0.5 font-medium tabular-nums text-fg-soft">
                  {items.length}
                </span>
              </p>
              <div className="mt-1 space-y-2">
                {items.map((c) => (
                  <div
                    key={c.cardId}
                    draggable
                    onDragStart={(e) =>
                      e.dataTransfer.setData("text/plain", String(c.cardId))
                    }
                    className="cursor-grab rounded-lg border border-line bg-surface p-3 transition-colors duration-150 hover:border-line-strong active:cursor-grabbing"
                  >
                    <Link
                      href={`/tender/${c.tenderId}`}
                      className="block text-sm font-medium leading-snug text-fg hover:text-accent-fg hover:underline"
                    >
                      {c.title}
                    </Link>
                    <p className="mt-1 truncate text-xs text-fg-soft" title={c.buyer}>
                      {c.buyer}
                    </p>
                    <div className="mt-2 flex items-center gap-2 text-xs">
                      {c.label && <LabelChip label={c.label} score={c.score} />}
                      {c.deadline && (
                        <span className={`tabular-nums ${deadlineClass(c.daysToDeadline)}`}>
                          {c.daysToDeadline !== null && c.daysToDeadline >= 0
                            ? c.daysToDeadline > 365
                              ? "long-term"
                              : `${c.daysToDeadline}d left`
                            : `${c.deadline} · closed`}
                        </span>
                      )}
                      {c.assignee && (
                        <span className="ml-auto truncate text-fg-soft">
                          {c.assignee}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => setOpenCard(openCard === c.cardId ? null : c.cardId)}
                      className="mt-2 text-xs font-medium text-fg-soft transition-colors duration-150 hover:text-accent-fg"
                    >
                      {openCard === c.cardId ? "Close" : "Edit"}
                    </button>
                    {openCard === c.cardId && (
                      <CardEditor card={c} onDone={() => setOpenCard(null)} />
                    )}
                  </div>
                ))}
                {items.length === 0 && (
                  <p className="rounded-lg border border-dashed border-line px-1.5 py-4 text-center text-xs text-fg-soft">
                    Drop here
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CardEditor({ card, onDone }: { card: BoardCard; onDone: () => void }) {
  const [assignee, setAssignee] = useState(card.assignee ?? "");
  const [notes, setNotes] = useState(card.notes ?? "");
  const [stage, setStage] = useState(card.stage);
  const [pending, startTransition] = useTransition();

  return (
    <div className="mt-2 space-y-2 border-t border-line pt-2.5">
      {/* Non-drag path for stage changes (keyboard / touch) */}
      <select
        value={stage}
        onChange={(e) => setStage(e.target.value)}
        aria-label="Stage"
        className={`${inputCls} px-2 py-1 text-xs`}
      >
        {BOARD_STAGES.map((s) => (
          <option key={s} value={s}>
            {stageLabel(s)}
          </option>
        ))}
      </select>
      <input
        value={assignee}
        onChange={(e) => setAssignee(e.target.value)}
        placeholder="Assignee"
        className={`${inputCls} px-2 py-1 text-xs`}
      />
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes"
        rows={2}
        className={`${inputCls} px-2 py-1 text-xs`}
      />
      <div className="flex items-center justify-between">
        <button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await updateCard(card.cardId, {
                assignee: assignee || null,
                notes: notes || null,
              });
              if (stage !== card.stage) {
                await moveCard(card.cardId, stage as BoardStage);
              }
              onDone();
            })
          }
          className="rounded-md bg-accent px-2.5 py-1 text-xs font-semibold text-surface transition-colors duration-150 hover:bg-accent-strong disabled:opacity-50"
        >
          Save
        </button>
        <button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await removeCard(card.cardId);
            })
          }
          className="text-xs font-medium text-hot transition-colors duration-150 hover:underline disabled:opacity-50"
        >
          Remove from board
        </button>
      </div>
    </div>
  );
}
