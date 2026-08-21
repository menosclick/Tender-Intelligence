import Link from "next/link";
import { createManualTender } from "@/lib/actions";
import { BOARD_STAGES, stageLabel } from "@/lib/format";
import { btnPrimary, inputCls, microLabel } from "@/lib/ui";

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

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  // The control lives inside the <label> so the association is implicit —
  // no id bookkeeping per field, and clicking the label focuses the control.
  return (
    <div>
      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold text-fg-mid">
          {label}
        </span>
        {children}
      </label>
      {hint && <p className="mt-1 text-xs text-fg-soft">{hint}</p>}
    </div>
  );
}

// Registration for tenders bid outside the platform (historical bids, other
// channels). They join the board, feedback, learning loop, and reports exactly
// like scraped tenders — the daily pipeline never touches them.
export default function NewTenderPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/board"
        className="text-xs font-medium text-fg-soft transition-colors duration-150 hover:text-accent-fg"
      >
        ← Back to Tender Pipeline
      </Link>
      <h1 className="mt-3 text-xl font-semibold tracking-tight">
        Register a tender manually
      </h1>
      <p className="mt-1 text-sm text-fg-mid">
        For bids made outside the platform. Past bids feed the learning engine
        the moment you record their outcome.
      </p>

      <form
        action={createManualTender}
        className="mt-6 space-y-6 rounded-xl border border-line bg-surface p-6"
      >
        <fieldset className="space-y-4">
          <legend className={`${microLabel} mb-3`}>Tender</legend>
          <Field label="Tender name *">
            <input
              name="naam"
              required
              className={inputCls}
              placeholder="e.g. ITSM-oplossing 2024"
            />
          </Field>
          <Field label="Contracting authority *">
            <input
              name="opdrachtgever"
              required
              className={inputCls}
              placeholder="e.g. Gemeente Utrecht"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
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
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="CPV code (domain)" hint="48… = software, 72… = IT services">
              <input
                name="cpv_main"
                className={`${inputCls} font-mono`}
                placeholder="e.g. 48000000"
              />
            </Field>
            <Field label="Procedure">
              <input name="procedure" className={inputCls} placeholder="e.g. Openbaar" />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
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
        </fieldset>

        <fieldset className="border-t border-line pt-5">
          <legend className="sr-only">Classification and outcome</legend>
          <p className={`${microLabel} mb-3`}>Classification &amp; outcome</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Label">
              <select name="label" className={inputCls} defaultValue="Warm">
                <option>Hot</option>
                <option>Warm</option>
                <option>Cold</option>
              </select>
            </Field>
            <Field label="Board stage">
              <select name="stage" className={inputCls} defaultValue="">
                <option value="">not on board</option>
                {BOARD_STAGES.map((s) => (
                  <option key={s} value={s}>
                    {stageLabel(s)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Outcome" hint="Won/Lost teaches the scorer">
              <select name="outcome" className={inputCls} defaultValue="">
                <option value="">none yet</option>
                <option value="won">Won</option>
                <option value="lost">Lost</option>
              </select>
            </Field>
          </div>
        </fieldset>

        <button className={`${btnPrimary} w-full`}>Register tender</button>
      </form>
    </div>
  );
}
