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
