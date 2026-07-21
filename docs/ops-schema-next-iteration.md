# Operational actions — database fields needed next iteration

> **IMPLEMENTED 2026-07-21** (same day, on Derson's go-ahead after he hit the
> placeholder button): migration `tender_actions_for_needs_attention` applied,
> server actions `addAction`/`setActionStatus`/`deleteAction` live,
> `getOperationalActions(admin)` reads the table, the dashboard form works.
> This doc remains as the design record. Still open from below: the NUTS
> location view.

Written 2026-07-21 during the Tender Command Center iteration. The dashboard's
"Needs Attention" section and the "Waiting on Others" / "Actions Due This Week"
metrics currently read through the typed seam in `webapp/src/lib/ops.ts`, which
returns an empty list in production (dev shows labelled sample rows). To make
them real, the next iteration needs one small app-owned table — NOT a workflow
engine.

## Proposed table: `tender_actions`

| Column | Type | Notes |
|---|---|---|
| `id` | bigint identity PK | |
| `tender_id` | int NULL, FK → `tenders_scraped(id)` ON DELETE CASCADE | NULL allowed for non-tender ops work |
| `title` | text NOT NULL | the next action, imperative ("Draft NvI answers") |
| `owner` | text NULL | person responsible; NULL = unassigned (sort bucket 6) |
| `waiting_on` | text NULL | person/organisation we are blocked on; feeds "Waiting on Others" |
| `internal_due` | date NULL | our own deadline; feeds "Actions Due This Week" + overdue sort |
| `status` | text CHECK in (`open`,`in_progress`,`waiting`,`blocked`,`completed`) | matches `ActionStatus` in ops.ts |
| `notes` | text NULL | |
| `created_by` | text NOT NULL | user email |
| `created_at` / `updated_at` | timestamptz default now() | |
| `completed_at` | timestamptz NULL | set when status → completed |

- RLS: enable, SELECT for `authenticated`; writes via service role server
  actions only (same pattern as `bid_pipeline` / `tender_milestones`).
- Follows the GOLDEN RULE in `webapp/src/lib/actions.ts`: app-owned table,
  never touches scraper-owned rows.
- The official deadline is NOT stored here — it joins from
  `v_app_tenders.deadline` via `tender_id` so it can never drift.

## Server actions needed

`addAction(formData)`, `updateActionStatus(id, status)`, `completeAction(id)`,
`deleteAction(id)` — same auth + validation conventions as `addMilestone`.

## UI already in place

The dashboard table, priority sort (overdue → deadline ≤3d → blocked →
waiting → due-this-week → unassigned → rest), status chips and empty state are
built and typed against `TenderAction`. Swapping `getOperationalActions()` to
read the table is the only wiring change; the "Add first action" button in the
empty state gets pointed at the new `addAction` form.

## Also worth adding while touching the schema (optional)

- `tenders_scraped` is missing a queryable location column; the dashboard map
  currently parses `raw_json → nutsCodes` server-side for open qualified
  tenders (≤ ~20 rows/load, acceptable). A generated column or small view
  (`id, nuts_code, nuts_name`) would make it indexable. Do NOT alter the
  scraped table's pipeline-owned columns; a view is the safe form.
