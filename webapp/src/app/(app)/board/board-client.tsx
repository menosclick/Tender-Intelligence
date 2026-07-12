"use client";

import { useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { moveCard, updateCard, removeCard } from "@/lib/actions";
import { BOARD_STAGES, type BoardStage, labelChip } from "@/lib/format";

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
              className={`w-64 shrink-0 rounded-xl border p-2 transition-colors ${
                dragOver === stage
                  ? "border-accent bg-accent-soft"
                  : "border-neutral-200 bg-neutral-100/60"
              }`}
            >
              <p className="px-1.5 py-1 text-xs font-bold uppercase tracking-wide text-neutral-500">
                {stage} <span className="font-normal">({items.length})</span>
              </p>
              <div className="mt-1 space-y-2">
                {items.map((c) => (
                  <div
                    key={c.cardId}
                    draggable
                    onDragStart={(e) =>
                      e.dataTransfer.setData("text/plain", String(c.cardId))
                    }
                    className="cursor-grab rounded-lg border border-neutral-200 bg-white p-3 shadow-sm active:cursor-grabbing"
                  >
                    <Link
                      href={`/tender/${c.tenderId}`}
                      className="block text-sm font-medium leading-snug hover:text-accent hover:underline"
                    >
                      {c.title}
                    </Link>
                    <p className="mt-1 truncate text-xs text-neutral-500" title={c.buyer}>
                      {c.buyer}
                    </p>
                    <div className="mt-2 flex items-center gap-2 text-xs">
                      {c.label && (
                        <span className={`rounded px-1.5 py-0.5 font-bold ${labelChip(c.label)}`}>
                          {c.score}
                        </span>
                      )}
                      {c.deadline && (
                        <span
                          className={
                            (c.daysToDeadline ?? 99) < 14
                              ? "font-semibold text-red-600"
                              : "text-neutral-500"
                          }
                        >
                          {c.daysToDeadline !== null && c.daysToDeadline >= 0
                            ? `${c.daysToDeadline}d left`
                            : c.deadline}
                        </span>
                      )}
                      {c.assignee && (
                        <span className="ml-auto truncate text-neutral-400">{c.assignee}</span>
                      )}
                    </div>
                    <button
                      onClick={() => setOpenCard(openCard === c.cardId ? null : c.cardId)}
                      className="mt-2 text-xs text-neutral-400 hover:text-neutral-700"
                    >
                      {openCard === c.cardId ? "Close" : "Edit"}
                    </button>
                    {openCard === c.cardId && (
                      <CardEditor
                        card={c}
                        onDone={() => setOpenCard(null)}
                      />
                    )}
                  </div>
                ))}
                {items.length === 0 && (
                  <p className="px-1.5 py-3 text-center text-xs text-neutral-400">
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
  const [pending, startTransition] = useTransition();

  return (
    <div className="mt-2 space-y-2 border-t border-neutral-100 pt-2">
      <input
        value={assignee}
        onChange={(e) => setAssignee(e.target.value)}
        placeholder="Assignee"
        className="w-full rounded border border-neutral-300 px-2 py-1 text-xs"
      />
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes"
        rows={2}
        className="w-full rounded border border-neutral-300 px-2 py-1 text-xs"
      />
      <div className="flex justify-between">
        <button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await updateCard(card.cardId, {
                assignee: assignee || null,
                notes: notes || null,
              });
              onDone();
            })
          }
          className="rounded bg-accent px-2 py-1 text-xs font-semibold text-white disabled:opacity-50"
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
          className="text-xs text-red-500 hover:underline disabled:opacity-50"
        >
          Remove from board
        </button>
      </div>
    </div>
  );
}
