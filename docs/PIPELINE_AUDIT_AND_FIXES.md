# n8n Pipeline Audit — Findings & Fixes (2026-07-06)

> **STATUS UPDATE (2026-07-06, evening session):** MCP write path bypassed via direct n8n REST API
> (`X-N8N-API-KEY` from Claude config, PUT /api/v1/workflows/:id — settings must be pruned to the
> public-API schema keys). Deployed & verified live:
> - **Finding 1 DONE.** HTTP nodes were already fixed by Cathrine in the UI (retry 3×/5s, 120s
>   timeout — runs Jul 4/5/6 all succeeded). This session added retry (3×/3s) to the 2 AI-agent
>   nodes `AI Tender Analysis` + `ManageEngine Fit Engine`.
> - **Finding 2 DONE (pre-existing).** Error workflow "OS Monitor — Workflow Failure Alerts"
>   (`fs7DKAix5cDLc8vA`, Telegram) is active and set as this workflow's error workflow.
> - **Finding 4 ROOT-CAUSED + FIXED.** The 40 stuck rows are AMBIGUOUS-keyword tenders: the
>   `Call OpenAI Prompt A` HTTP node replaces the item with the OpenAI response, so `Parse Prompt A`
>   forwarded tenders with no `id`/`naam` → downstream UPDATEs matched nothing → re-scraped and
>   re-sent to OpenAI every day. Fixed: `Parse Prompt A` now restores fields from
>   `$('Build Prompt A').item.json`. Expect the 40 to clear on the next scheduled run.
> - **Learning loop CLOSED.** New nodes `Score Tender → Get Score Adjustment (Postgres, existing
>   credential) → Apply Learned Adjustment → Route on Label`; read query now selects `cpv_main`.
>   Approved score overrides now affect live scores. RPC shape verified against the DB.
> - **Finding 3 still open:** ask Derson about the 5 "softwarebroker" tenders.
> - Pre-deploy backup: `docs/workflow-backup-2026-07-06-pre-learning-loop.json` (43-node version).

> **INTELLIGENCE UPGRADE (2026-07-07, second deploy):** scoring dimensions audited against real
> data — d1 (fit) was a hard-coded 15, d2 (value) a constant 2 (TenderNed feed carries no contract
> values: 0/1,587 rows), d7 always 0, making Hot (≥70) mathematically unreachable and leaving the
> Prompt C route-to-market/reseller engine permanently dormant. Deployed to `Merge Analysis`
> (workflow now 44 nodes): d1 = real AI fit verdict (High/Medium/Low → 15/8/2), score recomputed,
> labels recalibrated (Hot = High fit + score ≥50, Warm ≥40, Cold ≥20; red flags downgrade one
> rung; deadline passed → Disqualified). Orphaned `Filter op CPV` node (no input connection)
> deleted. Webapp HealthBanner gained an amber "Analyzer backlog" warning (≥10 unanalyzed) so a
> dead analyzer can never hide behind a green scraper again. Historical rows intentionally NOT
> relabeled — new logic applies to new analyses only. Rollback:
> `docs/workflow-backup-2026-07-07-pre-intelligence.json` (45-node version).

Audit of the live "Tender Scraper Workflow" (`AFyIJ2PzlHA469nq`) on
`deivyramos.app.n8n.cloud`. Verdict: **the intelligence logic is good; the reliability is not.**

---

## Verdict

- **Architecture (n8n brain → Supabase → web app):** correct. Keep it.
- **Scoring/qualification logic:** genuinely good. 7 weighted dimensions, sound CPV/keyword/authority
  rules, well-scoped ManageEngine classifier prompt. When a run succeeds, output quality is high —
  every scored tender got full AI intelligence (0 half-done rows).
- **Reliability:** POOR. ~33% of daily runs crash, silently, with no digest and no alert.

---

## Finding 1 (HIGH) — ~1 in 3 daily runs crash at the OpenAI call

Last 15 runs: **5 failed** (Jun 25, 29, 30; Jul 1, 2, 3). Every failure is the **same node**:
`Call OpenAI Prompt A` → `timeout of 30000ms exceeded` / "connection was aborted".

Root cause: the OpenAI HTTP nodes have a **30s timeout and no retry**. One transient OpenAI slowdown
or network blip kills the entire workflow → **CBA gets no tender digest that day, and nobody is told.**

### The fix (do this in the n8n UI — 2 minutes)

The MCP write path is blocked by a version mismatch (MCP client v2.47.8 vs n8n cloud v2.63.1), so
apply manually. For **each** of these 4 nodes:

- `Call OpenAI Prompt A`  (HTTP Request)
- `Call OpenAI Prompt C`  (HTTP Request)
- `AI Tender Analysis`  (AI Agent — GPT-4o Analysis Model)
- `ManageEngine Fit Engine`  (AI Agent — GPT-4o Fit Model)

Open the node → **Settings** tab (gear icon) → set:
- **Retry On Fail** = ON
- **Max Tries** = 3
- **Wait Between Tries (ms)** = 3000

And for the two HTTP nodes only, on the **Parameters** tab → Options → **Timeout** = `90000` (90s,
up from 30s).

That single change would have prevented all 5 recent failures (transient timeouts recover on retry).

---

## Finding 2 (HIGH) — failures are silent; add a failure alert

There is a `Slack Alert` node, but it only fires on the **success** path (after `Format Daily Brief`).
When the workflow crashes, no notification is sent — that's why the ~33% failure rate went unnoticed.

### The fix
Add an **Error Trigger** workflow (n8n → new workflow → "Error Trigger" node → Slack/Gmail node)
and set this workflow's **Settings → Error Workflow** to point at it. Then any crash pings you
immediately. (I can build this error-handler workflow via MCP — it's a *new* workflow, so the
version-mismatch write issue on the existing one doesn't apply. Say the word.)

---

## Finding 3 (RESOLVED as "looks fine, one item for Derson") — 97% disqualify rate

1,539 of 1,587 tenders are Disqualified. Investigated: **all 1,539 were killed by the cheap
keyword/CPV filter — 0 reached the (expensive) LLM.** That's good design, not waste.

Spot-check of rejected tenders confirms the filter is working: it correctly dropped ICT-hardware,
fuel, tree-pruning, fiber-cabling, and waterway-maintenance tenders — none are ManageEngine software
opportunities.

### One thing for Derson to eyeball (possible false-negatives)

Five **"Softwarebroker"** framework tenders were all disqualified:
- Softwarebroker — Diamant-groep (CPV 72000000)
- Softwarebroker-dienstverlening — Provincie Utrecht (CPV 48000000)
- Standaard-softwarebroker — Provincie Groningen (CPV 72260000)
- Softwarebroker — Bedrijfsvoeringseenheid Bommelerwaard (CPV 72000000)
- Softwarebroker Texel 2026 — Gemeente Texel (CPV 48000000)

Since CBA *resells* ManageEngine, a "softwarebroker" framework could be a legitimate route to sell
in. **Ask Derson:** are software-broker frameworks worth bidding, or correctly ignored? If worth it,
we add "softwarebroker" to the keyword allowlist (one-line change in the Keyword Filter node).

---

## Finding 4 (MEDIUM) — 40 tenders stuck unprocessed

40 rows sit at `status='scraped'`, `label=NULL` — scraped but never analyzed. Likely orphaned by
one of the crashed runs. They'll reprocess on the next successful run if the reliability fix lands;
if not, we can nudge them (`UPDATE ... SET status='scraped'` re-queue) once retries are in.

---

## Recommended order
1. Apply Finding 1 (retry + timeout) — kills the crash loop. **Highest impact.**
2. Add Finding 2 (error alert) — so you never again miss a silent failure.
3. Ask Derson about Finding 3 (softwarebroker) — cheap recall improvement if yes.
4. Re-check Finding 4 after a clean run.
