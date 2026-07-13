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
