import Link from "next/link";
import { createManualTender } from "@/lib/actions";
import { BOARD_STAGES } from "@/lib/format";

export const dynamic = "force-dynamic";

const BUYER_TYPES = [
  "gemeente",
  "grote gemeente",
  "provincie",
  "rijksoverheid",
  "politie",
  "defensie",
  "onderwijs",
  "zorg",
  "waterschap",
  "overig",
];

const inputCls =
  "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none";
const labelCls = "mb-1 block text-xs font-semibold text-neutral-600";

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-neutral-400">{hint}</p>}
    </div>
  );
}

// Registration for tenders bid outside the platform (historical bids, other
// channels). They join the board, feedback, learning loop, and reports exactly
// like scraped tenders — the daily pipeline never touches them.
export default function NewTenderPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/board" className="text-xs text-neutral-500 hover:underline">
        ← Back to bid board
      </Link>
      <h1 className="mt-2 text-lg font-semibold">Register a tender manually</h1>
      <p className="mt-1 text-sm text-neutral-500">
        For bids made outside the platform — past bids feed the learning engine
        the moment you record their outcome.
      </p>

      <form
        action={createManualTender}
        className="mt-6 space-y-4 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm"
      >
        <Field label="Tender name *">
          <input name="naam" required className={inputCls} placeholder="e.g. ITSM-oplossing 2024" />
        </Field>
        <Field label="Contracting authority *">
          <input
            name="opdrachtgever"
            required
            className={inputCls}
            placeholder="e.g. Gemeente Utrecht"
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Authority type">
            <select name="buyer_type" className={inputCls} defaultValue="gemeente">
              {BUYER_TYPES.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Contract value (€)" hint="Drives the value reports">
            <input name="waarde" className={inputCls} placeholder="e.g. 250000" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="CPV code (domain)" hint="48… = software, 72… = IT services">
            <input name="cpv_main" className={inputCls} placeholder="e.g. 48000000" />
          </Field>
          <Field label="Procedure">
            <input name="procedure" className={inputCls} placeholder="e.g. Openbaar" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Published">
            <input name="publicatie_datum" type="date" className={inputCls} />
          </Field>
          <Field label="Deadline">
            <input name="sluiting_datum" type="date" className={inputCls} />
          </Field>
        </div>
        <Field label="Description">
          <textarea
            name="beschrijving"
            rows={3}
            className={inputCls}
            placeholder="What was being bought, scope, relevant context…"
          />
        </Field>
        <Field label="Link (optional)">
          <input name="url" type="url" className={inputCls} placeholder="https://…" />
        </Field>

        <div className="grid grid-cols-3 gap-4 border-t border-neutral-100 pt-4">
          <Field label="Label">
            <select name="label" className={inputCls} defaultValue="Warm">
              <option>Hot</option>
              <option>Warm</option>
              <option>Cold</option>
            </select>
          </Field>
          <Field label="Board stage">
            <select name="stage" className={inputCls} defaultValue="">
              <option value="">— not on board —</option>
              {BOARD_STAGES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Outcome" hint="Won/Lost teaches the scorer">
            <select name="outcome" className={inputCls} defaultValue="">
              <option value="">— none yet —</option>
              <option value="won">Won</option>
              <option value="lost">Lost</option>
            </select>
          </Field>
        </div>

        <button className="w-full rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90">
          Register tender
        </button>
      </form>
    </div>
  );
}
