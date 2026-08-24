# Fixes & Verification Log — FU Tender Engine

Evidence log. A claim of "works/fixed" only counts with real output pasted here.

---

## 2026-07-13 — Full UI redesign, verified with rendered screenshots (branch design/ui-refresh)

**What changed (presentation only, zero functional changes):** OKLCH design-token system in `globals.css` (`@theme`), IBM Plex Sans/Mono via next/font, dark teal navigation rail with a health-aware status dot, one shared chip/button/input/table vocabulary (`src/lib/ui.tsx`), tender detail prose de-carded, favicon, a11y fixes (AA contrast, focus-visible, aria-current, kanban stage select as non-drag path). Design intent documented in `webapp/PRODUCT.md` + `webapp/DESIGN.md`.

**Verification:**

1. `npm run build` ✓ (compiled, 8/8 pages, no type errors) — twice, before and after review fixes.
2. All 9 screens rendered against the local dev server with REAL Supabase data and screenshotted at 1440px (login, dashboard ×2, tender 7130 with bid pack + verdict, board, search with 35 results, learning, reports, tender/new). Auth was NOT bypassed: a throwaway Supabase user was created via service-role admin API, allowlisted only in the local process env, logged in through the real form, and deleted afterward (verified "temp user deleted" in output; zero residue).
3. Fresh-eyes subagent review (screenshots + full diff): verdict fix-first with 3 blockers — global focus rule deforming rounded controls, `fg-soft` below AA contrast, em dashes in verdict headings. All 3 fixed, plus 6 nits (health-tied status dot, verdict fallback, aria-current, favicon hue, search thead, kanban stage select). Regression sweep confirmed every field/action/filter of the old UI survives.

**Promoted to production 2026-07-13 (approved by Cathrine):** fast-forward merge `design/ui-refresh` → `main` (2bbdfdd..0da006b, no merge commit). Smoke test against the live domain: `https://cba-tender-intelligence.vercel.app/login` returns HTTP 200 serving the new markup (marker "CBA Benelux · internal access only" replaces the old em-dash copy) and `/icon.svg` returns 200. Output: `PROD SERVES NEW DESIGN`.

**Gotchas for future sessions:**
- Never run `next build` while `next dev` is serving the same folder — they share `.next` and the dev server starts serving unstyled HTML. Kill dev, `rm -rf .next`, restart.
- TaskStop on a background `next dev` kills the shell but NOT the node child on Windows; the port stays held. Find via `Get-NetTCPConnection -LocalPort <p>` and Stop-Process.
- Headless Edge does not work for screenshots here (spawns zombie children, never renders); use the cached Puppeteer Chrome at `~/.cache/puppeteer/chrome/win64-*/chrome-win64/chrome.exe` with `puppeteer-core`.

---

## 2026-07-13 — Learning loop VERIFIED end-to-end (M2 of webapp improvement plan)

**Claim being tested:** "The system learns from feedback" (the self-learning pitch). Never proven before — 0 suggestions had ever been generated.

**Diagnosis first:** 0 suggestions was correct behavior, not a bug. `generate_scoring_suggestions()` requires ≥3 won/lost outcomes per group (buyer_type or CPV) with win-rate deviation ≥20% (≥3 relevance marks, deviation ≥30%). Real feedback at test time: 1 `bidding` + 1 `no_bid` (don't count) + 2 `relevant` (below the 3 minimum). The loop never had enough signal.

**E2E test (synthetic data, CPV `99999999` that no real tender has):**

1. 3 synthetic tenders (ids 7183–7185, `platform='manual'`, `status='analyzed'`, deadline past, label Cold — invisible to app, pipeline, and brief) + 3 `won` feedbacks.
2. `SELECT * FROM generate_scoring_suggestions()` → `{out_created: 1, dimension: cpv, target: 99999999, rationale: "Won 3, lost 0 on CPV 99999999 (100% win rate)"}`
3. `approve_suggestion(3, 'claude-e2e-test')` → `score_overrides`: `{dimension: cpv, target: 99999999, points: 5.0, active: true}`
4. `get_score_adjustment('overig','99999999')` → `total_adjustment: 5.0`
5. Synthetic scraped tender (id 7186) + manual n8n run (execution **11395**, mode manual, success, 41s):
   - `Score Tender` → score **45**, breakdown `{d1:15, d2:2, d3:8, d4:5, d5:10, d6:5, d7:0}`
   - `Get Score Adjustment` → `total_adjustment: 5, applied: [{points:5, target:"99999999", dimension:"cpv"}]`
   - `Apply Learned Adjustment` → score **50**, `score_adjustment: 5`
   - Supabase row 7186: `score: 50, status: analyzed` — **BEFORE 45 → AFTER 50 by an approved override. Loop closed.**

**Cleanup verified by query:** tenders_test=0, feedback_test=0, suggestions_test=0, overrides_test=0, orphan_packs=0. Cathrine's 4 real feedback rows untouched. Next morning's brief query returns only the real Hot tender (432784).

**Practical note for CBA:** the loop needs ≥3 Won/Lost outcomes on the same buyer type or CPV before it proposes anything. Suggestions appear on /learning after pressing "Run learning" — nothing auto-applies without human approval.

---

## 2026-07-13 — KNOWN ISSUE: n8n MCP cannot update workflows on this instance

Every `n8n_update_partial_workflow` / full-update PUT against workflow `AFyIJ2PzlHA469nq` fails with `request/body must NOT have additional properties` — even for operations that pass `validateOnly: true`. Root cause: the MCP server rebuilds the full workflow body including newer n8n-cloud fields (`binaryMode`, `timeSavedMode`, `callerPolicy`, `availableInMCP` in settings) that the public API's update schema rejects. Version mismatch MCP ↔ n8n cloud.

**Impact:** any workflow edit via MCP is blocked (this blocks M3's alert branch). Workarounds: edit in the n8n UI manually, or update the n8n-mcp server version. Manual executions (Test workflow button) work fine and were used for the E2E test.

---

## 2026-07-13 — Vercel git deploys: commit author must be recognized

First two git-triggered deployments sat in status UNKNOWN forever, no logs. Cause: commit author email (`derson_92@hotmail.com`) not linked to the Vercel team. Fix: author commits as `270447224+menosclick@users.noreply.github.com` → build Ready in 49s. Production alias verified serving the git build (login page smoke-tested via HTTP).

---

## 2026-07-14 — M3 alert branch: added, tested, and a REAL bug found in the fail-open path

**Goal:** alert when `AI Tender Analysis` / `ManageEngine Fit Engine` exhaust retries (they fail open with `continueRegularOutput` — tenders were saved with empty analysis, silently).

**Unblock discovered:** the KNOWN ISSUE of 2026-07-13 ("n8n MCP cannot update workflows") applies ONLY to the community `n8n-mcp` server. Two working alternatives verified today:
1. The official claude.ai n8n connector (`update_workflow`, atomic ops) — applied 5 ops to prod (`AFyIJ2PzlHA469nq`, 63→65 nodes).
2. Direct REST `PUT /api/v1/workflows/{id}` with a sanitized body ({name, nodes, connections, settings:{executionOrder, timezone}} only) — the 2026-07-13 failure was the community MCP resending cloud-only settings fields, not the API itself.

**What was added to prod (additive only, no rewiring):** `Merge Analysis` fans out to new `AI Failure?` (IF) → `Slack AI Failure Alert` (DM to derson, same credential as the daily Slack Alert, `onError: continueRegularOutput` so a Slack outage can never break the pipeline). Backup first: `docs/workflow-backup-2026-07-14-pre-m3-alerts.json`.

**REAL BUG FOUND by forced-failure test:** the documented sentinel path in `Merge Analysis` (`executive_summary = 'AI analysis failed - skipped'`) NEVER triggers in the real failure mode. Evidence (disposable clone `AgC5GzQ3Ulh66ugG`, scoped to synthetic tender `TEST-M3-ALERT-99999`, broken model `gpt-4o-mini-BROKEN-M3-TEST`):
- Exec **11398**: AI agent failed (`error: The resource you are requesting could not be found`) → `Carry Context` swallowed it (no `.error` field, `analysis_output` undefined) → Fit Engine ran normally → Merge Analysis took the NORMAL path → `executive_summary: ""` (empty string, NOT the sentinel) → narrow IF condition routed FALSE → **no alert fired**.
- Fix: condition broadened to `sentinel OR empty/whitespace executive_summary`.
- Exec **11399** (same clone, corrected condition): AI failed → IF routed TRUE → **Slack API responded `ok: true`**, message delivered to channel D09KN4R4SC8 (derson DM), ts 1783982161.684529. Real response body, not a green status.

**State:** clone deleted (GET → Not Found). PROD still carries the NARROW condition — the auto-mode permission classifier requires Cathrine to approve the one-op fix (`updateNodeParameters` on `AI Failure?`). Until applied, the prod alert will NOT fire on a real AI failure.

**Cleanup:** synthetic tender deleted + residue counts verified by query (see below; first attempt rolled back on a bad column name, retried after a transient Supabase MCP 502).

**Cleanup verified (post-502 retry):** `synthetic_left: 0` · `rows_analyzed_in_test_window: 0` (zero real tenders touched) · `pending: 0` — DB identical to pre-test state.

---

## 2026-07-20 — Webapp "make it make sense" audit + 10 presentation fixes (branch audit/make-sense-2026-07-20)

**Audit method:** all 7 pages' code read; field-coverage queries against live Supabase; 7 screenshots per round with REAL login (throwaway user via admin API, allowlisted only in local env, deleted after — "temp user deleted" verified in all 3 rounds). Verdict doc: `os/AI_Operating_System/02_CLIENTS/cba-benelux/plans/2026-07-20-webapp-audit-veredicto.md`. Shots: `docs/audit-shots-2026-07-20/` (before).

**Data findings (queries, not guesses):** d7 "CBA relationship" = 0 in 20/20 rows with a breakdown, ever; d2 "Estimated value" max seen 2/20 (waarde empty for all TenderNed rows; only the 2 manual tenders have it: "171580", "495000"). Feedback reality: outcome bidding×3/no_bid×3 (zero won/lost), relevance 3/2 — explains why the learning page showed 0 suggestions (RPC threshold ≥3 per group). reseller_outreach_draft existed on 2 tenders but was never rendered anywhere. keyword_matches non-empty on 20 rows, never rendered. Tender 5784 deadline 2034 rendered as "(2897d)".

**Shipped (all presentation-layer, zero n8n/scoring changes):** breakdown shows 5 scoreable bars + honest footnote for d2/d7; dashboard drops not-relevant-marked rows to the bottom (sunken wash + "Not relevant" chip + subtitle count — feedback now has a visible consequence); learning page shows progress toward the RPC threshold ("Closest to a suggestion: N of 3", only groups below threshold); detail renders outreach draft (collapsible + CopyButton with aria-live), Value (formatted when numeric), "Surfaced by keyword match: …" provenance; deadlines >365d render "long-term"; Monitor label added to search filter + chip styles; reports trims pre-scraper all-zero months; dead fetch of trefwoorden/type_opdracht removed.

**Verification:** `next build` clean ×2; final screenshots confirm every change with real data (dashboard shows both not-relevant rows dimmed at bottom, tender 7409 shows footnote "Estimated value 2/20 · CBA relationship 0/5. Total out of 100" summing to score 60, learning shows "onderwijs 2 of 3 · gemeente 2 of 3 · overig 1 of 3", board card shows "long-term", reports starts 2026-04). Fresh-eyes adversarial subagent review: 1 blocker (WCAG contrast of opacity-55 dimming) — fixed by switching to sunken wash + fg-mid text at full opacity; 6 nits applied (RPC-accurate empty-state copy, no misleading "3 of 3", € formatting, corrected footnote wording, CopyButton try/catch + aria-live, `summary` added to global focus-visible). Verified in shots-final round.

**NOT deployed to prod yet** — branch pushed for Vercel preview; promotion pending Derson's OK.

---

## 2026-07-20 — Audit fixes PROMOTED TO PRODUCTION

Merge `77536d7` fast-forward to main, pushed. Vercel production deployment `dpl_9rf5SZPaEwFHagYeqeGfMKvxSNkU` (cba-tender-intelligence-6vfevkkil) **Ready in 38s**, target=production, aliased to `cba-tender-intelligence.vercel.app` + `-git-main` (verified via `vercel inspect`). Prod `/login` → HTTP 200. Same commit was fully verified pre-merge with 3 rounds of real-data screenshots locally (see previous entry); preview build jg0yxzu3r Ready 49s.

**n8n ops NOT applied — blocked by the auto-mode permission classifier (2 attempts, consistent with 2026-07-14):** the M3 `AI Failure?` condition fix and the health negative-keywords for `Keyword Filter`. Both prepared verbatim in `docs/pending-n8n-ops-2026-07-20.md`; workflow backup taken first (`docs/workflow-backup-2026-07-20-pre-m3fix-keywords.json`). Until OP 1 is applied, the prod AI-failure alert still does NOT fire.

---

## 2026-07-20 (2) — Dashboard redesign + "Why this score" (branch design/dashboard-2026-07-20)

**Derson's feedback on the audit round:** breakdown still unclear, outreach draft unnecessary, dashboard "no es un dashboard" (reference: BI-style Excel dashboard — KPIs, charts, filters).

**Shipped:** (1) Dashboard rebuilt: 5-KPI row (Open/Hot/New today/Closing ≤14d/On board), filter bar (label/buyer type/deadline — sanitized params, legacy `?show=all` mapped), 3 charts (by deadline with zero-buckets visible, by buyer type, qualified intake by month — query bounded to the 6-month window so PostgREST's 1,000-row cap can't silently undercount), work queue below with the not-relevant demotion intact. New `lib/viz.tsx` (Kpi/ChartCard/HBarList/Columns), hand-rolled with design tokens, no chart lib. (2) Tender detail: "Why this score · N/100" moved above Executive summary — strongest/weakest sentence, per-dimension bar + qualitative tier + plain-language meaning, d2/d7 footnote. (3) Outreach draft + CopyButton removed (explicit request).

**Fresh-eyes adversarial review: 3 blockers, all fixed:** unbounded qualifiedAll query (→ windowed), invalid `<dl>` structure in KPI row (→ proper dt/dd), and dimension descriptions contradicted by live data — tender 7409 shows d3=15/15 on a "Niet-openbaar" procedure while scoring_rules.json says niet-openbaar=12/mini-competitie=6 (→ descriptions softened to what each dimension measures, no mechanical claims). Nits applied: searchParams whitelist, zero-bucket visibility, all-zero intake → empty state, degenerate strongest/weakest guard, UTC month keys, "unknown" not "onbekend", max-w-5xl per DESIGN.md, text-xs floor, fg-mid for descriptions/tiers.

**⚠️ PIPELINE FINDING (not fixed here):** live n8n `Score Tender` gives d3=15 to a niet-openbaar/mini-competition tender — diverges from scoring/scoring_rules.json (12/6). Also labels: rules say Hot ≥70 but prod labels Hot at 50-60. The repo JSON and the live scoring node have drifted; needs a dedicated session to reconcile.

**Verification:** `next build` clean ×3; screenshots with real data in `docs/redesign-shots-2026-07-20/` (dashboard shows KPI row + 3 charts + demoted not-relevant rows; tender 7409 shows the new Why-this-score section). NOT in prod — branch pushed for preview, promotion pending Derson's OK.

**Cockpit iteration (commits 7bf5355 + this one):** dashboard reshaped to Derson's wireframe — Needs-attention panel (computed: overdue outcomes on board cards, closing ≤14d without a bid decision, fresh/unreviewed Hots), Upcoming-deadlines agenda, bid-pipeline funnel strip, charts moved below the queue. Focused fresh-eyes review: 1 blocker (upcoming deadlines resurfaced not-relevant tenders — fixed) + nits applied: outcome queries bounded per board card (no silent 1,000-row cap), no_bid counts as a final outcome, closing group sorted soonest-first with "+N more" overflow, "Closing today" at 0d, aria-hidden funnel arrows, title fallback. Coherence fix in recordFeedback: recording Won/Lost on a tender now moves its board card to Won/Lost (mirror of moveCard's outcome capture). Verified: build clean, screenshots shots-v6 (not-relevant rows absent from upcoming, KNMI/OM overdue-outcome nudges present).

---

## 2026-07-21 — Dashboard v3 PROMOTED + DB migrations applied (Derson: "aprobado")

**Prod:** main fast-forwarded to 79ee3b9 (dashboard v3: domain chart, hidden not-relevants, deadline calendar) — deployment mtjsz7k7i Ready, alias verified, /login 200. Then two approved migrations applied via Supabase MCP:
1. `tender_milestones_for_deadline_calendar` (OP 4) — table + RLS + read policy created, `{"success":true}`.
2. `bid_pipeline_stages_tender_lifecycle` (OP 3) — stages renamed in DB (New→Identified, Reviewing→Analysis, Bidding→Q&A), **Award** stage added, constraint tightened to the 8 lifecycle values, `{"success":true}`.
Coordinated code deploy: BOARD_STAGES → lifecycle names + Award column, outcomeMap Q&A/Submitted/Award→bidding, activeStages/stageOrder/CALENDAR_STAGES updated, STAGE_LABELS kept as legacy display shim. Verified with real-data screenshots (shots-v9): board shows Identified 1 / Analysis 1 / Q&A 0 / Submitted 3 / Award, all 5 cards render.

---

## 2026-07-21 (2) — Milestone entry VERIFIED + 3 review blockers fixed (branch feature/milestones-2026-07-21)

The morning commit 9991d2a (Key dates section on tender detail feeding the dashboard calendar) was built but never verified — treated as hypothesis and verified from scratch.

**E2E round 1 (16/16 PASS, real login, throwaway user, tender 6169):** empty state → add Demo → re-add corrects date without duplicating (upsert proven) → "other" labeled by its note on the calendar → extracted row (source=documents, SQL-seeded) shows "from documents" chip with NO Remove → re-adding the kind flips it to manual+removable → all rows removed via UI → calendar back to TenderNed-only. Two visual bugs found in the screenshots: manual milestone label collided with the clamped Submission label, and the 2034 DAS tender rendered "Submission (+2896d)" on the calendar (live in prod since v3). Fixed in 1b4abb0.

**Fresh-eyes adversarial review: 3 BLOCKERS, all real, all outside the paths round 1 exercised:**
1. Calendar derived from the `.gte(days_to_deadline, 0)` query — Submitted/Award tenders vanished from the calendar the day their deadline passed, exactly when demo/award/objection dates matter. Fix: calendar tenders come from board stage (not-relevant still excluded), fetched by id with no deadline filter.
2. Index-parity lanes only separated adjacent labels; several beyond-horizon milestones clamped onto the identical right anchor (total superposition). Fix: greedy lane assignment by estimated label width + all beyond-horizon milestones collapse into one "+N more" marker (title attr lists them).
3. The add form offered Submission/Questions-close while the calendar (correctly) keeps TenderNed authoritative — a manual "correction" silently never took effect. Fix: MANUAL_MILESTONE_KINDS excludes TenderNed-owned kinds in form + server action; explainer says they're tracked automatically. Plus server-side validation: real calendar dates only (rejects Feb 31, years outside 2000-2100), note clipped to 120.

**E2E round 2 (16/16 PASS):** milestone on tender 6760 (Submitted, deadline passed 2026-06-23) NOW APPEARS on the calendar; 4-milestone cluster renders with ZERO pairwise label overlaps (getBoundingClientRect assertion); "+1 more" collapse and "(long-term)" verified; form offers no TenderNed-owned kinds; all test rows removed via UI. Reviewer re-verified the fix diff: explicit SIGN-OFF, no regressions.

**State:** `next build` clean ×3 · tender_milestones residue 0 (query) · both throwaway users deleted (admin API 404) · shots in `docs/milestone-shots-2026-07-21/` (12) · branch pushed, Vercel preview dpl_4jpuJ4hHRFooZvKMyAQTunQwefwD Ready, /login 200. NOT in prod — promotion pending Derson's OK.

---

## 2026-07-21 (3) — Milestone feature PROMOTED TO PRODUCTION (Derson: "aprobado")

Main fast-forwarded 1f617f9 → f413d62, pushed. Vercel production deployment `dpl_H9oA1jQhy2eC7aWqYEBnFg33wec9` **Ready**, target=production, aliased to `cba-tender-intelligence.vercel.app` (verified via `vercel inspect`). Prod `/login` → HTTP 200. Same commit fully verified pre-merge: 2 E2E rounds with real login (32 checks total), fresh-eyes reviewer sign-off, zero test residue (see previous two entries).

---

## 2026-07-21 (4) — Tender Command Center iteration (branch feature/command-center-2026-07-21)

Per Derson''s written spec: nav restructure (8 items, Bid Board → Tender Pipeline everywhere), dashboard rebuilt as an operational command center (5 linked metric cells, Needs Attention via typed ops seam — empty in prod, labelled samples in dev, schema doc''d in docs/ops-schema-next-iteration.md; Upcoming Milestones next-5 with Official/Internal chips; Portfolio Snapshot = domain bars with % linking into Inbox + schematic NL province map from publication NUTS codes, never buyer addresses; Latest Qualified 5 newest Hot/Warm), full discovery table moved to /inbox (search + label/domain/buyer/deadline filters + per-row Add-to-pipeline / Hide actions), /calendar (60-day timeline relocated + dated list), /vault honest stub. Mobile: rail collapses to a top bar (dot + last scrape + sign out), sections stack, tables scroll internally.

**Bugs found & fixed during verification:** sr-only table header without positioned ancestor created phantom horizontal scroll on mobile (fix: relative on the scroll wrapper); "in 2896d" resurfaced in two new surfaces (→ long-term); mobile shell previously unusable under 1024px.

**Fresh-eyes review: 0 blockers, 10 nits** — 4 fixed now (dl content model on linked KPIs, Active Pipeline exclusion-list, "qualified" copy mismatch, mobile header sign-out/health), 6 documented for next iteration (query caps vs PostgREST 1000-row silent truncation, NUTS view instead of raw_json fetch, KPI↔calendar population question, not-relevant pipeline-tender consistency, Columns dead code, evidence-hygiene process note).

**Validation:** tsc exit 0 · next build clean · 48 prod E2E checks + 5 dev checks with real login (desktop 1440 + mobile 390), Search/Reports/Learning/Pipeline verified intact · zero test residue (throwaway users deleted, 404-verified ×2) · shots in docs/command-center-shots-2026-07-21/. No ESLint config and no test suite exist in the repo (reported as-is). Preview gkv0jia5z Ready, /login 200. NOT in prod — promotion pending Derson''s OK.

---

## 2026-07-21 (5) — Command Center PROMOTED TO PRODUCTION (Derson: "aprobado")

Main fast-forwarded 02ad657 → 36751fb, pushed. Vercel production deployment `dpl_DjfjCTx7XYUH2dRuARSAhxhktP1z` **Ready**, aliased to `cba-tender-intelligence.vercel.app`. Prod `/login` → HTTP 200; `/inbox` unauthenticated → 307 to login (middleware covers the new routes). Same commit verified pre-merge: 48 prod + 5 dev E2E checks, fresh-eyes review 0 blockers (see previous entry).

---

## 2026-07-21 (6) — Real NL map PROMOTED + Needs Attention made real (tender_actions)

**Map to prod (Derson: "aprobado"):** main ff 1e2eef3 → 902308d, deployment Ready, alias verified, /login 200. Real CBS/Kadaster 2025 province geometry (cartomap CC-BY), Mercator-projected offline into 20KB static paths — first render exposed a degree/radian axis-mix bug (country rendered as a 9px pancake), fixed and re-verified 6/6 checks.

**"Add first action" didn''t work (Derson):** it was the documented disabled placeholder — his click was the go-ahead to build the real thing. Migration `tender_actions_for_needs_attention` applied (app-owned, RLS, service-role writes — exactly per docs/ops-schema-next-iteration.md). Server actions addAction/setActionStatus/deleteAction; naming a waiting-on party implies Waiting; official deadline joins from v_app_tenders (never stored). Dashboard: always-visible inline add form, Done/Remove per row, dev sample data removed — Waiting-on-Others and Due-this-week KPIs now count real rows.

**Verified (17/17 E2E, real login):** empty state + form → add 3 actions (tender-linked, waiting-on, overdue-unassigned) → priority sort exact (overdue > waiting > due-this-week) → official deadline joined (2026-08-12 from the linked ESM tender) → KPIs 1/2 → Done removes from open list → Remove ×2 → empty state returns. tsc 0, build clean. Residue 0 (query), throwaway user deleted (404). Branch feature/tender-actions-2026-07-21, preview cgdbnb2tl Ready /login 200 — prod promotion pending Derson''s OK.

---

## 2026-07-21 (7) — tender_actions PROMOTED TO PRODUCTION (Derson: "aprobado")

Main fast-forwarded 902308d → 94a3449, pushed. Production deployment lwpj42py0 **Ready**, target=production, prod /login 200. Needs Attention is now a working loop in the live app: add form, Done/Remove, Waiting/Overdue inference, deadline join — verified pre-merge with 17/17 E2E checks (see previous entry).

## 2026-07-21 (8) — Month-grid Calendar + Document Vault + Leidraad Milestone Extractor (branch feature/vault-calendar-extraction)

**What was built (Derson: "Lets go to this: Document Vault, month-grid Calendar, and the leidraad milestone auto-extraction"):**

1. **Month-grid Calendar** — real Monday-first month view (`calendar/month-grid.tsx`), `?m=YYYY-MM` nav (back blocked before current month, forward capped at last tracked month within 12; DAS dates stay in the list as "long-term"), today marker, per-day chips (submission/official/internal tint + label text + source in tooltip). `DeadlineCalendar` + `Columns` deleted from viz.tsx (zero callers).
2. **Document Vault** — real page: per-tender document list (name/category/size/"read by AI"), verdict chip + summary, bid-pack deep link (`/tender/[id]#bid-pack` anchor added), honest empty states (external platform / manual / no docs, with "checked <date>"). Powered by new tables.
3. **Leidraad Milestone Extractor** — NEW n8n workflow `oRYeERPLQ9H2EQ4G` (21 nodes, separate from the prod monolith): daily 09:45 AMS + manual; for pipeline tenders (Analysis/Q&A/Submitted/Award, TenderNed platform, not yet ledgered) fetches the TenderNed doc list, stores metadata in `tender_documents`, reads up to 2 leidraad PDFs, GPT-4o (json_schema strict) extracts the planning table into `tender_milestones` with `source='documents'` via **ON CONFLICT DO NOTHING** (manual always wins, GOLDEN RULE kept), ledger row in `milestone_extractions` (re-extract = delete ledger row), Slack DM per tender, errorWorkflow `fs7DKAix5cDLc8vA`, TZ Europe/Amsterdam.
   Migration: `tender_documents_and_milestone_extractions` (RLS SELECT authenticated; writes only via n8n service creds).

**Verification (real output):**
- Extractor exec 11426: 3 candidates → PAM/IGA (6169) **6 milestones** from Selectiedocument (publication 2026-06-29 … objection_period_end 2026-11-11, Dutch planning quotes in notes); Identity mgmt (5784) correctly ledgered `no_docs` (DAS); ESM picked wrong docs (annexes — English tender). Heuristic fixed (English main-doc names + size rank), ledger reset, exec 11427: ESM **7 milestones** from "Request for ESM Platform" + "Memorandum of Information 1" — extracted submission 2026-08-12 **matches TenderNed's official deadline** (cross-validation). DB: 13 `source='documents'` milestones, 34 `tender_documents` rows, 3 ledger rows — confirmed by SQL.
- Webapp E2E (throwaway user via admin API, real login, deleted after — 404 confirmed): **36/36 PASS ×2** (before and after review fixes) incl. July honest-empty grid, Aug/Oct chips from extracted milestones, forward-cap at Nov, vault counts 34/5/4, read-by-AI markers, no-docs/manual/external states, `from documents` chips ×6 on tender 6169, mobile 390px zero overflow. Screenshots: `docs/vault-calendar-shots-2026-07-21/` (01–08).
- `tsc --noEmit` clean, `next build` green ×2.
- Fresh-eyes adversarial review (probed live DB itself): verdict **SHIP, 0 blockers**; 2 SHOULD-FIX applied (http(s)-scheme guard on AI-written `external_platform_url` in vault + detail; vault header counts scoped to rendered tenders with explicit "N artifacts hidden" note) + chip tooltip now carries official/internal source. NITs documented: UTC-vs-local today-ring (consistent on Vercel), unbounded `tender_documents` read vs PostgREST 1000 cap (~60 tenders away), hand-typed far-future `?m=` renders blank-but-honest.

**NOT yet in prod:** webapp changes on branch (not merged), extractor workflow **left unpublished** (draft — no daily runs yet). Both promote together on Derson's aprobado.

**Addendum (same day, Derson feedback on the live dashboard):** "Está duplicada lo de upcoming milestones" — the panel listed every milestone, so ESM appeared 3×. DB checked first: zero duplicate rows (`GROUP BY tender_id, kind HAVING count(*)>1` → empty); it was the same tender repeating per date. Fix: Upcoming Milestones now shows ONE row per tender — next date + "+N more dates →" linking to the Calendar. Verified with real login: one row per tender (4232/6169/5784), "+3 more dates"/"+4 more dates" rendered, ESM exactly once; screenshot `docs/vault-calendar-shots-2026-07-21/09-upcoming-grouped.png`; tsc + build green; user deleted (404).

---

## 2026-08-20 — Vault/Calendar/Extractor PROMOTED TO PRODUCTION (Derson: "promote to prod now")

Branch `feature/vault-calendar-extraction` sat verified-but-unpromoted for a month (last touched 2026-07-21). Before promoting: `tsc --noEmit` clean, `next build` clean (0 errors, only pre-existing Supabase Edge Runtime warning), confirmed required tables still live in Supabase (`tender_milestones` 14 rows, `tender_documents` 34 rows, `milestone_extractions` 3 rows), confirmed `tenders_scraped` grew 1,741→2,395 rows over the month (pipeline kept running fine unattended).

**Also fixed:** `scoring/scoring_rules.json` had an uncommitted local diff (the v2.0 rewrite documenting real two-stage scoring, drafted 2026-07-21 but never committed) — committed now, no behavior change, doc-only.

**Actions:**
1. Committed scoring doc fix (repo-local git identity set to `menosclick <270447224+menosclick@users.noreply.github.com>` to match required deploy author — was unset, would have hung the Vercel deploy in UNKNOWN).
2. `git merge --ff-only` branch → main (3 commits, clean fast-forward, no conflicts).
3. `git push origin main` → Vercel auto-deploy triggered.
4. Polled `https://cba-tender-intelligence.vercel.app/login` until 200; confirmed via WebFetch it renders the real branded login form, no errors.
5. Published n8n workflow `oRYeERPLQ9H2EQ4G` (Leidraad Milestone Extractor) — was sitting as an unpublished draft since creation. Confirmed post-publish: `active: true`, `activeVersionId` set, `sameAsDraft: true` (no drift from the verified draft).

**Now live:**
- Month-grid Calendar, real Document Vault on `cba-tender-intelligence.vercel.app`
- Leidraad Milestone Extractor running daily 09:45 Europe/Amsterdam — first real unattended run tomorrow 2026-08-21

**Pending:** verify the 2026-08-21 09:45 run executes clean (check `milestone_extractions` ledger + Slack report) — first real scheduled run, prior evidence was manual/dev-triggered only.

---

## 2026-08-20 (2) — Duplicate milestone extraction found and resolved

Right after publishing the standalone Leidraad Milestone Extractor (`oRYeERPLQ9H2EQ4G`), checked whether the monolith `AFyIJ2PzlHA469nq` already did the same thing (per the 2026-07-21 open item: "integrated into the monolith as a 4-node branch off Assemble Dossier... verified in draft `337a8b1e`, publish classifier-blocked"). Confirmed via `activeVersion.sameAsDraft: true` that branch (`Build Planning Prompt` -> `Call OpenAI Planning` -> `Save Planning Milestones` -> `Exec Save Milestones`) was ALREADY LIVE — it must have been published sometime after 07-21 without a corresponding fixes.md entry. Both paths write to `tender_milestones` with the same `ON CONFLICT DO NOTHING`/`source='documents'` guard, so no data corruption risk, but real duplicate OpenAI spend and duplicate Slack notices on any tender both paths process.

**Derson's call:** keep the standalone workflow (ledger-tracked via `milestone_extractions`, cleanly scoped to pipeline-stage tenders) as sole source of truth; disable the monolith's inline branch.

**Action:** backed up `AFyIJ2PzlHA469nq` first (`02_CLIENTS/cba-benelux/workflows/backup-2026-08-20-AFyIJ2PzlHA469nq-before-disabling-planning-branch.json`), then `setNodeDisabled` on `Build Planning Prompt` (id `e4d97231-ebe6-4031-b5e6-021e4dfdeedc`) — disabling the branch's entry node no-ops everything downstream of it without touching scrape/score/AI-analysis/bid-pack/daily-brief. Published (`activeVersionId` `177b1317-bcee-4bca-980d-482cb016070d`, `sameAsDraft: true`). Diffed pre/post JSON snapshots programmatically: 76 nodes both sides, zero added/removed, exactly one node changed (`Build Planning Prompt`) — no incidental drift from the publish step (the documented REST-sanitization gotcha did not recur here).

**Net effect:** single milestone-extraction path going forward — `oRYeERPLQ9H2EQ4G`, daily 09:45 AMS, batch over pipeline tenders, ledgered.

---

## 2026-08-21 — UI polish pass (audit vs DESIGN.md, 7 fixes)

Full-screen audit of the webapp against DESIGN.md. Foundation was clean (no raw hex/neutral grays outside the static favicon); found 7 surgical gaps, all fixed:

1. Search results table lacked the `relative overflow-x-auto` + `min-w` scroll treatment every other wide table has (squeezed on mobile).
2. Learning stats strip forced 5 cells side-by-side at any width — now stacks on mobile like the dashboard KPI strip.
3. tender/new: labels not associated with inputs (now implicit via wrapping `<label>`); 2/3-col grids didn't collapse on phones (now `sm:grid-cols-*`).
4. Health banner `px-8` misaligned with mobile content gutter — now `px-4 lg:px-8`.
5. Off-scale type: Inbox "New" chip 10px and rail "CBA Benelux" 11px → `text-xs` (12px floor per DESIGN.md).
6. Empty pipeline board was 8 columns of "Drop here" — now teaches the next action (qualify from Tender Inbox).
7. DESIGN.md drift corrected: fg-soft documented 0.60 vs shipped 0.55; table radius documented 10 vs shipped 12; table-scroll rule recorded.

Verified: `tsc --noEmit` clean; `/login` 200, auth gate 307 on dev server. **Built but NOT visually verified:** authed screens (app is login-gated; visual pass pending Derson sign-in on the preview pane). NOT included in this commit: the uncommitted reports/page.tsx funnel rewrite found in the working tree from a prior session — no verification record, left for separate review.

---

## 2026-08-24 — Reports funnel rewrite verified and promoted; polish pass visually verified

**Polish pass (0129cc0) visual verification closed:** walked prod signed-in via Derson's Chrome — dashboard, inbox, board, calendar, vault, search, learning, reports all render clean. Responsive fixes proven via production DOM: learning strip `sm:flex-row` stack, search table `relative overflow-x-auto` + `min-w-[40rem]`, tender/new 13/13 labels wrapping their control and all grids `sm:grid-cols-*`.

**Reports rewrite (found uncommitted from a prior session) put through a fixer pass:**
- Data-verified against prod DB: 2,457 scanned → 24 qualified → 11 pipeline → 5 active; >1,000-row pagination the rewrite adds is genuinely required (PostgREST caps at 1,000).
- **Bug found with real data:** guard was `won+lost > 0`, so with today's 0 won / 1 lost the page rendered "Win rate 0%" off a single lost bid — the exact misleading rate its own comment promises to prevent (confirmed live on prod, old page also shows "Pipeline value €171.580" from one tender's value). Fixed: rate needs ≥3 decided outcomes; below that the funnel shows honest counts.
- tsc clean. Promoted to prod; post-deploy render check below.

**Post-deploy render check (925efd3, prod):** /reports live — funnel 2457 → 24 → 11 → 5, "Outcomes recorded 1 (0 won · 1 lost)" with the threshold explainer instead of "Win rate 0%"; value KPIs gone; pipeline table lists real tenders with chips. Screenshot in session. VERIFIED end-to-end.

---

## 2026-08-24 (2) — Structural pass: region, resilience, learning-loop integrity

Full analysis of the webapp (all 11 screens, libs, actions, auth, config) surfaced three structural issues above any visual work. All three fixed.

**1. Every request crossed the Atlantic.** Supabase is `eu-west-1` (Ireland); no `vercel.json` existed, so functions ran in Vercel's US default. Measured from a real browser BEFORE: dashboard domComplete 2049ms, reports 1557ms, inbox 844ms. Added `webapp/vercel.json` pinning `regions: ["dub1"]` (Dublin = eu-west-1). Also removed a duplicate `getUser()`: middleware already validates the JWT per request, so it now forwards the verified email on `x-tender-user-email` and the app layout reads that instead of making a second auth-API round trip. The middleware DELETES any inbound copy of that header first — verified locally that a forged `x-tender-user-email` on `/dashboard` still 307s to /login.

**2. No loading, error or not-found states existed anywhere** (zero loading/error/not-found files). Added `(app)/loading.tsx` (content-shaped skeleton, not a spinner), `(app)/error.tsx`, `(app)/not-found.tsx`, and `app/global-error.tsx`. Also hardened the app layout: its two health queries moved to `.maybeSingle()` and are wrapped in try/catch, so a Supabase outage degrades the status line instead of taking down the rail on every screen.
**Correction to the analysis:** I initially called the layout's `.single()` an app-shell crash risk. That was WRONG — supabase-js returns `{data: null, error}` for a 0-row `.single()`, it does not throw, and the code already handled null. The real gap was the absent error boundary for genuine fetch failures.

**3. Learning loop could be silently poisoned by a mis-drag.** `moveCard` wrote won/lost/bidding feedback but had no entry for Identified/Analysis — dragging a card back OUT of Won/Lost left the stale outcome in `tender_feedback` forever, invisible on screen but consumed by the reports funnel and `generate_scoring_suggestions`. With only 1 real outcome in the system, one mis-drag was 50% of the training signal. Fixed: `STAGE_OUTCOME` now maps EVERY stage (Identified/Analysis → retract the outcome row; Dropped → no_bid), and `FINAL_STAGE` maps terminal outcomes back to one stage each. Also whitelisted `recordFeedback` values (`relevance`: relevant/not_relevant, `outcome`: bidding/won/lost/no_bid) — server actions accept arbitrary arguments, and this feeds the scorer.

tsc clean, `next build` clean. Local verification of auth paths done pre-deploy. Post-deploy timings + signed-in render check recorded below.

**Post-deploy verification (e2e20f4, prod, signed in):**
- Region pin works. Warm domComplete AFTER: dashboard **383ms**, reports **396ms**, calendar **314ms**, inbox 473ms. BEFORE (same browser, earlier today): dashboard 2049ms, reports 1557ms, inbox 844ms. First hit after deploy read 2965ms — cold start on the new deployment, not a regression; the two warm re-runs settled at 735ms then 383ms. Caveat on the headline: the "before" sample's own descending trend (2049→1557→844) suggests it was warming too, so the cleanest apples-to-apples is inbox 844→473ms; dashboard warm-before was never captured.
- Auth header handoff works: rail renders `derson@cbabenelux.com` with the layout's `getUser()` removed. Pre-deploy local test confirmed a forged `x-tender-user-email` on /dashboard still 307s to /login.
- not-found renders inside the app shell at /tender/99999999 (screenshot in session).
- **NOT visually captured:** the loading skeleton. Warm pages now complete in ~350ms so it flashes too briefly to screenshot; it builds and type-checks, and exists for cold starts and slow connections. Honest status: shipped, not seen.
- **Live evidence the outcome fix fires:** tender 8606 was moved to Dropped in the running app at 16:20 (Derson using it during the deploy) and `no_bid` was recorded alongside — under the OLD code, Dropped wrote no outcome at all. Dashboard counts followed correctly (active pipeline 5→4, deadlines 8→6, since 8606 left the calendar-tracked stages).

**Open — legacy data, NOT auto-corrected:** two rows predate the fix and still contradict the new invariant: tender 4232 and 6888 are both `Dropped` with outcome `bidding`. Harm is low (they don't touch win rate, and `generate_scoring_suggestions` only reads won/lost), but the reports exit table shows "Dropped" instead of "Decided not to bid" for them. Deliberately left alone — rewriting recorded human feedback is Derson's call, not a silent migration.

---

## 2026-08-24 (3) — Second-tier pass: reports scale, inbox friction, optimistic-UI honesty

**Reports is now constant-time.** It used to page the ENTIRE `tenders_scraped` corpus into the app on every view (2,457 rows x 11 columns, 3 round trips, growing ~25/day) and aggregate in JS. Rewritten to count in Postgres: `count(*)` with `head:true` transfers zero rows, so the scanned/qualified/manual totals and all 12 monthly-bucket counts are constant regardless of archive size. The only rows now fetched are the QUALIFIED ones (24 today, 2 columns) for the domain/buyer breakdowns — still paged, so a >1,000 qualified archive can't silently truncate a breakdown. Board-card tender details are fetched by id (bounded by board size) instead of being looked up in a full-corpus map. **No schema changes** — deliberately kept app-side rather than adding views to the client's production DB.

**Inbox filters apply on change.** Triage is the daily loop; an extra "Apply" click per filter was the friction that mattered. Dropdowns now navigate on change via `router.push` inside a transition (form dims while pending). It stays a real `<form method="get">` with a submit button, so it degrades to the old behavior without JS; the button now reads "Search" because it only applies the typed query. Bucket predicates stay server-side — the client component only receives key + display name.

**Feedback pills no longer lie on failure.** The widget flipped the pill optimistically and never rolled back, so a failed write left the UI showing a training signal the database never received. Now reverts to the previous value and states the failure.

**Tender detail back link** said "Back to dashboard" on every tender even though tenders are reached from the Inbox (and the rail highlights the Inbox while you're on one). Now agrees with both.

**BLOCKED — needs Derson:** the legacy-row backfill (4232, 6888: `Dropped` with outcome `bidding`) was denied by the Claude Code permission classifier when attempted via the Supabase MCP. Not worked around. SQL handed to Derson to run:
```sql
update tender_feedback f set value = 'no_bid'
from bid_pipeline bp
where bp.tender_id = f.tender_id and f.kind = 'outcome'
  and bp.stage = 'Dropped' and f.value <> 'no_bid';
```

tsc + `next build` clean. Ground truth captured from SQL before deploy for a numbers-match check: scanned 2457, qualified 24, manual 4, monthly Apr 104/2 · May 662/3 · Jun 675/6 · Jul 696/9 · Aug 320/4, buyer types overig 10 / rijksoverheid 4 / onderwijs 3 / gemeente 3 / uitvoeringsorganisatie 1 / provincie 1 / intergemeentelijk 1 / grote gemeente 1, CPV 72=16 · 48=5 · 64=1 · 51=1 · none=1.

**Post-deploy verification (5300318, prod, signed in):**
- **Reports numbers match ground truth EXACTLY** — the point of a data-layer rewrite. Rendered: scanned 2457, qualified 24, "4 registered manually", monthly `2026-04 104/2 · 05 662/3 · 06 675/6 · 07 696/9 · 08 320/4` (March correctly trimmed as pre-scraper), domains IT-diensten 16 / Software 5 / Onbekend 1 / CPV 51xx 1 / CPV 64xx 1, buyer types overig 10 / rijksoverheid 4 / onderwijs 3 / gemeente 3 / uitvoeringsorganisatie 1 / grote gemeente 1 / intergemeentelijk 1 / provincie 1 (sums to 24). Every figure identical to the pre-deploy SQL. Confirms the PostgREST `not.in.(Disqualified,Monitor)` filter matches the SQL predicate.
- **No perf regression:** reports fully-warm domComplete **394ms** vs 396ms before the rewrite. Intermediate readings of 1100-1415ms were lambda cold/warming, not the change — same page settled at 394ms on the next hit. So: same speed today, now flat as the archive grows.
- **Inbox filter-on-change works:** setting the domain dropdown to PAM navigated to `/inbox?label=warmplus&domain=PAM` with no click, and the table filtered to exactly the 2 PAM rows.
- Back link now reads "← Back to Tender Inbox" → `/inbox`. Feedback pills render all six values.
- **Loading skeleton confirmed rendering** (closes the gap left this morning): mid-stream probes caught the page with content still in React's `div[hidden][id="S:0"]` Suspense container while the a11y tree exposed only the rail — i.e. the aria-hidden skeleton was on screen.

**False alarm, recorded so it isn't re-investigated:** mid-stream DOM probes showed the inbox filter form unhydrated and inside the hidden `S:0` container, which looked like a hydration bug caused by the new `loading.tsx`. It was a race with streaming — re-querying after the swap showed `hydrated: true`, `visible: true`, chain `FORM < DIV < MAIN < ...`, zero hidden containers. `document.readyState === "complete"` is NOT a reliable "Suspense content swapped in" signal; assert on the element's own hydration/visibility instead.

---

## 2026-08-24 (4) — Dashboard raw_json/NUTS: measured, and deliberately NOT changed

Last open item from the webapp analysis. The dashboard fetches `raw_json` for every open tender each pageview and `JSON.parse`s it purely to read `nutsCodes[0]` for the Netherlands map. I offered a DB column + n8n pipeline change to store the parsed code. **Measured first — it does not justify the change:**

- 15 open tenders · **43 kB total** raw_json · avg 2,953 bytes/row · max 4,397 bytes. Column type is `text`, not jsonb.
- Dashboard warm domComplete is 436 ms, dominated by round trips, not by 43 kB of body.

A migration touching the scraper-owned `tenders_scraped` plus a live n8n workflow, to save 43 kB, is a bad trade. **Not done.**

**Cheap alternative also tested and rejected —** PostgREST JSON projection so only the extracted value crosses the wire:
- `select=id,nuts:raw_json->nutsCodes` → returns `{"nuts":null}` **silently**, no error, because the column is `text` not `json`/`jsonb`. Shipping this unverified would have emptied the map with no failure signal.
- `select=id,nuts:raw_json::json->nutsCodes` → `PGRST100` parse error; PostgREST won't accept a cast in a JSON path.

A `generated always as (raw_json::json->...)` column was also rejected: `raw_json` is untrusted text and one malformed blob would break every scraper INSERT.

**Revisit threshold:** this becomes worth fixing at roughly 100+ concurrently-open tenders (~300 kB/view), or if `raw_json` is ever migrated to `jsonb` for other reasons — at which point the PostgREST projection becomes a one-line change. Not before.

---

## 2026-08-24 (5) — Fresh-eyes audit findings fixed (independent sub-agent, then re-verified)

An independent audit agent was given the spec (PRODUCT.md / DESIGN.md / README golden rules) and read-only DB access, deliberately NOT told what had been changed this session. Its findings were re-verified before acting on any of them — one at a time, against the live database.

**1. The "Why this score" panel named the WRONG weakest dimension (major).** `format.ts` declared `d1` (Product fit) `max: 30`. `scoring/scoring_rules.json` declares weight 30 but caps stage 2 at `{High:15, Medium:8, Low:2}` "so the AI fit verdict replaces (not doubles) the provisional constant". Verified independently: across all 24 scored rows **d1 never exceeds 15**; highest total score in the system is 60. Consequences proven on real tenders:
- **7409** (highest-scoring tender, d1=15 = perfect fit): UI ratio 15/30 = 0.50, the lowest of its five dimensions → page printed *"weakest: product fit"* about a **perfect** product fit.
- **6855**: UI d1 8/30=0.27 vs d4 5/15=0.33 → named product fit; true d1 8/15=0.53 vs 0.33 → real weakest is **authority type**. The sentence named the wrong dimension.
Fixed `max: 15`. Also corrected the footer's "All seven dimensions add up to 100" — the reachable total is ~62, which the rules file itself states.

**2. Qualified tenders with no published deadline were invisible everywhere (major).** Inbox and dashboard both filtered `.gte("days_to_deadline", 0)`; PostgREST `gte` is never true for NULL. The pipeline's own `v_pipeline_active` uses `(sluiting_datum IS NULL OR sluiting_datum >= CURRENT_DATE)` — the app silently narrowed it. Two **Warm** tenders (8416, 8417, Rijkswaterstaat) were dropped from the Inbox, its header count, "Open qualified", "Latest qualified", the domain chart and the map. Fixed with `.or("days_to_deadline.gte.0,days_to_deadline.is.null")`, verified against SQL through the real REST endpoint: old filter 15 rows, new filter 17, null-deadline 2 — exact match.

**3. Reports called hand-labelled tenders "AI-scored" (major).** 4 of the 24 "Qualified (Hot/Warm/Cold) · AI-scored as relevant" have a human-picked label and `score IS NULL` — 17% of the headline figure on the page management prints. Sub-label now reads "AI-scored, incl. N registered by hand". "Tenders scanned · TenderNed, all time" also counted 4 manual + 1 Mercell row → now "all sources, all time".

**4. Document Vault filed closed pursuits under "In the pipeline" (major).** `STAGE_ORDER[stage] ?? 9` put Won/Lost/Dropped in the `<= 9` bucket. Four Dropped tenders (4232, 6169, 6888, 8606) rendered under the heading "In the pipeline" directly above their own "Dropped" chip. Terminal stages now rank 9.5 and fall to "Not in the pipeline".

**5. The kanban painted dead deadlines as most-urgent (major).** `(c.daysToDeadline ?? 99) < 14` is satisfied by negatives, so expired tenders got bold red with no "(closed)" marker — 6761 (-185d), 6760 (-62d), 4232 (-12d). Now uses the shared `deadlineClass` like every other surface, and says "· closed".

**6. `addMilestone` destroyed n8n-extracted provenance (major).** It upserted `source:'manual'` with a null note over rows the Leidraad extractor owns — all 36 `tender_milestones` rows are `source='documents'`, 21 of them on kinds the manual form offers. Overriding a date blanked the note quoted from the tender documents and downgraded it from "Official" to "Internal" on the Calendar. `removeMilestone` already guarded these rows; this path did not. Now preserves the existing note when the new one is blank.

**7. Manual tenders rendered an empty 3xl score numeral.** Now shows "—" with a title explaining it was registered manually rather than AI-scored.

Also fixed a stale comment claiming `tender_feedback` rows "aren't deduped upstream" (a UNIQUE (tender_id, kind) constraint exists).

`tsc --noEmit` clean, `next build` compiled successfully.

**NOT fixed — needs Derson (security, finding 6 of the audit):** RLS policies grant the `authenticated` role blanket access — `SELECT` on `tenders_scraped`/`bid_packs`/`bid_verdicts` and **ALL** on `bid_pipeline`, `tender_feedback`, `scoring_suggestions`, `score_overrides`. `ALLOWED_EMAILS` is enforced only in Next.js middleware, so it does not reach the database: any holder of an `authenticated` JWT for this project could call the Supabase REST API directly and read every tender and bid pack, or write their own score overrides. Severity turns entirely on **whether email signup is enabled** on the Supabase project (2 accounts exist, both created 2026-07-06) — that setting could not be read over SQL and was not tested. Requires a dashboard check + RLS tightening; both are writes that the permission classifier blocks.

**Still open from earlier:** the 4232/6888 outcome backfill (audit independently found the same divergence), and the duplicate manual rows 8416/8417 (same tender registered twice, 4s apart — `external_id = manual-<timestamp>` makes UNIQUE unable to catch it). Both need DB writes.

**Post-deploy verification (52c9cf3, prod, signed in):**
- **Score explanation, tender 7409** — now reads *"Strongest signal: product fit (15/15) · weakest: authority type (13/15)."* Before the fix it said *"weakest: product fit (15/30)"* about a perfect fit. The dimension row shows "15/15 STRONG" (was "15/30 MODERATE"). Footer now states the reachable ~62 total instead of claiming 100.
- **Null-deadline tenders recovered** — `/inbox?label=all` renders 14 rows including BOTH Rijkswaterstaat rows (8416, 8417) that were previously invisible on every surface.
- **Reports** — "TENDERS SCANNED 2457 · all sources, all time" and "QUALIFIED 24 · AI-scored, incl. 4 registered by hand".
- **Vault** — headings now "In the pipeline · 4" / "Not in the pipeline · 7" (was 7 / 4). Zero Dropped chips above the divider; all 7 cards below render correctly with their stage chips intact (first: ESM Platform / TU Eindhoven / Dropped).
- **Board** — the three expired cards (2026-02-20, 2026-06-23, 2026-08-12) render muted `text-fg-soft` with "· closed" appended. None carries `text-hot`. Before, all three were bold red.
- **Manual score** — tender 6760 renders "—" with title "Not AI-scored — registered manually".
- **NOT verified live:** the `addMilestone` note-preservation fix — proving it requires writing a milestone over an extractor-owned row in the client's production DB. Code-verified only.

**Probe note (second time this session):** `document.body.innerText` can miss streamed Suspense content even after `readyState === "complete"`; two probes returned "not found" for text that a screenshot and direct DOM inspection both showed present. Poll on a specific rendered element, not on body text.

---

## 2026-08-24 (6) — WCAG AA contrast fix + security thread closed

**Contrast (audit finding 11).** Recomputed independently from the OKLCH tokens (OKLCH → OKLab → linear sRGB → relative luminance → WCAG ratio) rather than trusting the audit's figures — they matched: `text-fg-soft` at L=0.55 measured **3.93–4.24:1** on every tinted surface (cold-soft 3.93, accent-soft 4.09, hot-soft 4.14, warm-soft 4.17, ok-soft 4.22, sunken 4.24), all under the 4.5 AA bar PRODUCT.md commits to. It passed only on `surface` (4.76) and `canvas` (4.52). Worst placement was inside the verdict boxes, on the quoted-from-documents provenance text.

Fixed at the token rather than the call sites, so every usage is covered at once: `--color-fg-soft` 0.55 → **0.51**. Swept the candidates — 0.52 still fails (4.46 on cold-soft), 0.51 clears everything (min **4.66**). Hierarchy still reads: fg 0.26 / fg-mid 0.45 / fg-soft 0.51.

Separately, `text-fg-soft/60` on the calendar's out-of-month day numbers measured **2.30:1** — opacity on an already-marginal token, unrescuable by darkening. Now full `fg-soft`, still visibly muted against the `fg-mid` used for in-month days. Verified no other `fg-soft/<opacity>` usage exists in `src/`. DESIGN.md records the value and the "never apply opacity to this token" rule.

**Security thread closed (advisor `function_search_path_mutable`).** Checked `pg_proc.prosecdef` for all six flagged functions — `approve_suggestion`, `reject_suggestion`, `generate_scoring_suggestions`, `get_score_adjustment`, `update_updated_at`, `bid_pipeline_touch`: **none is SECURITY DEFINER**, all run as the caller with no `proconfig`. The mutable `search_path` warning is therefore cosmetic, not a privilege-escalation path. No action needed.

**Also surfaced by the advisor, not actioned (needs dashboard access):** leaked-password protection is disabled (Auth → Password security). Five unrelated tables (`articles`, `content_log`, `content_queue`, `video_scripts`, `videos`) have RLS enabled with zero policies — that denies all non-service-role access, so it fails safe, but they are not this app's tables.

**STILL BLOCKED on Derson:** (1) whether email signup is enabled — decides whether the `authenticated`-role RLS grants are a live hole or defence-in-depth; (2) the 4232/6888 outcome backfill; (3) the duplicate rows 8416/8417.
