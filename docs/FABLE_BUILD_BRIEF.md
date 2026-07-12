# Fable Build Brief — FU-Tender-Engine Web App

**Read this whole file before writing any code.** You are building a Next.js web app on top of an
already-live tender-intelligence system. The backend (n8n scraper + AI scoring) is in production for a
real client (CBA Benelux). Your job is the **web app only**.

---

## 🔑 THE GOLDEN RULE (do not violate)

The app is a **READER** of the tender data and a **WRITER** only to its own new tables.

- ✅ **READ** from the view `v_app_tenders` (and `tenders_scraped` if you must).
- ✅ **WRITE** only to `bid_pipeline` (already created) and any new app-only tables you add.
- ❌ **NEVER** write to `tenders_scraped` — the n8n pipeline owns every column there
  (`status`, `label`, `score`, `executive_summary`, etc.). Writing to it corrupts a live system.

If you need to store new app state (saved filters, user prefs), create a **new table**. Never add
columns to `tenders_scraped`.

---

## Stack

- **Framework:** Next.js (App Router), TypeScript, React Server Components for data reads.
- **Hosting:** Vercel.
- **DB:** existing Supabase project `nzzjwtjmdciipadpnmvu`. Use `@supabase/supabase-js` +
  `@supabase/ssr`. Connection details come from env vars (below) — never hardcode keys.
- **Auth:** Supabase Auth. Email/password + Google OAuth. **Gate the entire app** — this is
  internal CBA data, no public pages except the login screen.
- **UI:** clean, dense, scannable. This is a working tool, not a marketing site. Think Linear/Notion,
  not a landing page. Tailwind is fine.
- **Language:** UI chrome in English; tender content stays Dutch (do not translate tender text).

### Env vars — a filled template is at `webapp/.env.example`
The public URL + publishable key are already filled in there (safe to use). You only need to add the
**service role key** (Cathrine gets it from Supabase → Settings → API). Copy `.env.example` → `.env.local`.
```
NEXT_PUBLIC_SUPABASE_URL=https://nzzjwtjmdciipadpnmvu.supabase.co   # already set
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_a2uvX8gtHkRrwwXsoQYajA_VXK_zFB7  # already set (public by design)
SUPABASE_SERVICE_ROLE_KEY=   # SECRET, server-only, Cathrine fills this
```

---

## The data — what's real (verified 2026-07-06)

- **1,587 tenders** in `tenders_scraped`; **~1,050 still open** (deadline in future).
- Labels that actually occur: **Warm, Cold, Disqualified**. `Hot` is defined (score ≥70) but **none
  exist yet** — handle it in the UI, don't assume it appears.
- **`waarde` (estimated value) is EMPTY for all rows** — TenderNed rarely discloses value.
  → **Do NOT build a value/budget filter or column.** It would always be blank.
- **`route_to_market`, `route_reasoning`, `route_first_action`, `reseller_*` are currently NULL**
  for all rows (pipeline not populating them yet). → **Render these sections only when non-null.**
  Every detail section must gracefully hide when its field is empty.
- The scraper runs **daily 09:00 Europe/Amsterdam**; data is fresh.

### Primary read surface: the view `v_app_tenders`
Already created. One row per non-disqualified, analyzed tender, joined to its pipeline stage. Columns:

| Column | Type | Notes |
|---|---|---|
| `id` | int | PK, use for links + bid_pipeline FK |
| `external_id` | text | TenderNed ID |
| `title` | text | (`naam`) Dutch tender title |
| `buyer` | text | (`opdrachtgever`) contracting authority |
| `buyer_type` | text | detected authority type |
| `published_date` | date | |
| `deadline` | date | submission deadline |
| `days_to_deadline` | int | computed; **negative = already closed** |
| `cpv_main`, `cpv_codes` | text | CPV classification |
| `procedure`, `type_opdracht` | text | |
| `url` | text | link out to TenderNed notice |
| `score` | int | 0–100 |
| `label` | text | Hot/Warm/Cold |
| `score_breakdown` | jsonb | `{d1..d7}` — see dimension names below |
| `executive_summary` | text | AI |
| `what_is_being_bought` | text | AI |
| `why_it_matters` | text | AI |
| `key_requirements` | jsonb array | AI |
| `possible_knockout_risks` | jsonb array | AI |
| `recommended_products` | jsonb array | ManageEngine products |
| `fit_reasoning`, `fit_level` | text | fit_level = High/Moderate/Weak |
| `route_to_market` etc. | text | **often NULL — hide if empty** |
| `red_flags` | text[] | may be empty array |
| `pipeline_stage` | text | NULL until added to board |
| `pipeline_assignee` | text | |

### Score breakdown — render `d1..d7` with these real names
The `score_breakdown` jsonb looks like `{"d1":15,"d2":2,"d3":15,"d4":7,"d5":10,"d6":5,"d7":0}`.
Map keys → labels (and show as bars out of max):

| Key | Label | Max |
|---|---|---|
| d1 | Product fit (ManageEngine) | 30 |
| d2 | Estimated value | 20 |
| d3 | Procedure type | 15 |
| d4 | Authority type | 15 |
| d5 | Deadline runway | 10 |
| d6 | Recency | 5 |
| d7 | CBA relationship | 5 |

---

## The app's write surface: `bid_pipeline` (already created)

```
bid_pipeline (
  id          bigint PK,
  tender_id   int  FK → tenders_scraped(id), UNIQUE (one card per tender),
  stage       text CHECK in ('New','Reviewing','Bidding','Submitted','Won','Lost','Dropped')
              DEFAULT 'New',
  assignee    text,
  notes       text,
  created_at  timestamptz,
  updated_at  timestamptz  -- auto-touched on update
)
```
Adding a tender to the board = INSERT with `tender_id` + `stage='New'`. Moving it = UPDATE `stage`.
The `UNIQUE(tender_id)` means "add to board" should upsert, not duplicate.

---

## Screens to build (you sequence them; this is the dependency order)

### 1. Shell + auth
Login (email + Google). Gate everything. App layout: left nav (Dashboard / Search / Bid Board),
top bar with a freshness indicator ("Last scrape: …" — you can read `workflow_health` if present,
else the max `scraped_at`).
**Done:** logged-in user sees a real tender count from `v_app_tenders`.

### 2. Dashboard (anchor screen — replaces the email digest)
Ranked list of open tenders (`days_to_deadline >= 0`, order by `score` desc, then `deadline` asc).
Each row: buyer, title, a **label chip** (Hot=red, Warm=amber, Cold=slate), score, deadline +
urgency ("88d" or "closes in 6d" in red when <14). Default filter to Warm+ but let user show Cold.
Click a row → detail.
**Detail page:** executive summary, what's being bought, why it matters, key requirements (list),
knockout risks (list), recommended products (chips), fit reasoning + fit level, red flags,
score breakdown (d1–d7 bars), and route-to-market **only if present**. A "View on TenderNed" link
(`url`). An "Add to bid board" button (upserts into `bid_pipeline`).
**Done:** every tender in today's digest is viewable, richer, in the app.

### 3. Search + filters
Full-text search over `title` + `beschrijving` (Dutch). Filters: label, CPV (prefix match on
`cpv_main`), buyer, deadline range, published-date range. **No value filter** (data is empty).
Search the full ~1,050 open set (and optionally closed).
**Done:** "IAM tenders from a gemeente closing in 30 days" returns the right rows.

### 4. Bid board (Kanban — the true feature gap)
Columns: New → Reviewing → Bidding → Submitted → Won → Lost (+ Dropped). Cards = tenders in
`bid_pipeline`, showing title, buyer, score, deadline. Drag to change `stage`. Card detail: assignee,
notes, link back to full tender detail. Writes only to `bid_pipeline`.
**Done:** drag the DUO PAM/IGA tender (id 6169) New→Bidding and it persists across reload.

### 5. Polish
Deadline urgency colors, empty states, the freshness widget, and make dashboard the default route
after login. Deep-link support so digest emails can point at `/tender/[id]`.

---

## Guardrails / gotchas (learned from the real data)

1. **Golden rule again:** read `v_app_tenders`, write only `bid_pipeline`. Never mutate `tenders_scraped`.
2. **Negative `days_to_deadline` = closed.** Default dashboard hides them; search may include them.
3. **Empty fields are normal** — value, route-to-market, reseller drafts are often NULL. Hide sections,
   don't render blank headers.
4. **Only 3 labels occur** (Warm/Cold/Disqualified). Disqualified is already filtered out by the view.
5. **Dutch tender text** — never translate it; search must tokenize Dutch.
6. **Server-side reads** with the service role key on the server only; anon key on the client. Never
   ship the service key to the browser.
7. **Single-tenant** — no tenant/org abstraction. This is CBA-only by decision.

---

## Definition of done (whole app)

Derson logs in, sees CBA's scored open tenders ranked, clicks one to read the full AI intelligence,
searches the archive, and drags a tender across a bid board — all without opening the n8n backend or
touching the live scraper. The morning email still fires (unchanged); the app is the richer home for it.
