# FU Tender Engine — CBA Tender Intelligence

Tender-intelligence system for CBA Benelux (ManageEngine premium partner, NL). Monitors Dutch public procurement (TenderNed) daily, AI-scores every tender for ManageEngine relevance, learns from human feedback, and serves everything in a web app + daily email brief.

## Architecture

| Piece | Where | What |
| --- | --- | --- |
| Pipeline | n8n cloud, workflow `AFyIJ2PzlHA469nq` | Daily 09:00 AMS: scrape → keyword filter → score → GPT-4o analysis → ManageEngine fit → bid pack → email brief |
| Feedback webhook | n8n, workflow `tD7WrDC7PNzL2Gnf` | Learning loop: feedback → score adjustments |
| Database | Supabase `nzzjwtjmdciipadpnmvu` | `tenders_scraped` (pipeline-owned), `bid_pipeline`, `tender_feedback`, `scoring_suggestions`, `score_overrides`, `bid_packs`, `bid_verdicts` (app-owned) |
| Web app | `webapp/` → Vercel `cba-tender-intelligence` | Next.js 15. Dashboard, tender detail, search, bid board, learning, reports |

## Repo layout

- `webapp/` — the Next.js app (Vercel Root Directory points here)
- `schema/` — Supabase DDL
- `prompts/` — the AI pipeline prompts (relevance, intelligence, route)
- `keywords/` — keyword filter lists (NL/EN)
- `scoring/` — scoring dimension rules
- `docs/` — build brief, company profile, pipeline audits, n8n workflow backups
- `FUs/` — sample functional-requirement documents from real tenders (public documents)

## Golden rules

1. The app READS `v_app_tenders`; it WRITES only to app-owned tables. It never updates rows the n8n pipeline owns in `tenders_scraped` (manual inserts with `platform='manual'` are the documented exception).
2. Secrets never enter this repo: `docs/credentials.md` and all `.env*` files are gitignored. Real values live only in n8n credentials and Vercel env vars.
3. All pipeline changes go through n8n MCP with a workflow backup in `docs/` first.

## Local dev

```bash
cd webapp
cp .env.example .env.local   # fill SUPABASE_SERVICE_ROLE_KEY (Supabase → Settings → API)
npm install
npm run dev
```

Client docs: `../os/AI_Operating_System/02_CLIENTS/cba-benelux/` in Derson's Brain (status, plans, audits).
