-- Applied to Supabase nzzjwtjmdciipadpnmvu on 2026-09-14
-- (migration name: allow_manual_early_signal_override)
--
-- TenderNed's publicatie_type is the scraper's fact and the app must never
-- write it. But Derson needs the last word on how a row is TREATED: a
-- publication can be typed AAO and still be an early conversation in his
-- judgement, and a consultation can end up in the wrong lane by hand.
--
-- The override therefore lives beside the fact, in the app-owned table, and
-- the view exposes a single `is_early` the UI acts on.

alter table early_signal_pipeline
  add column if not exists is_early_override boolean;

comment on column early_signal_pipeline.is_early_override is
  'Derson''s manual call, overriding publicatie_type for display/routing only. true = treat as early signal even though TenderNed says AAO. false = treat as a normal biddable tender even though TenderNed says MAC/VAK. NULL = follow TenderNed.';

create or replace view v_app_tenders as
 SELECT t.id,
    t.external_id,
    t.naam AS title,
    t.opdrachtgever AS buyer,
    t.buyer_type_detected AS buyer_type,
    t.publicatie_datum AS published_date,
    t.sluiting_datum AS deadline,
    t.cpv_main,
    t.cpv_codes,
    t.procedure,
    t.type_opdracht,
    t.url,
    t.score,
    t.label,
    t.score_breakdown,
    t.executive_summary,
    t.what_is_being_bought,
    t.why_it_matters,
    t.key_requirements,
    t.possible_knockout_risks,
    t.recommended_products,
    t.fit_reasoning,
    t.fit_level,
    t.route_to_market,
    t.route_reasoning,
    t.route_first_action,
    t.red_flags,
    t.reseller_name,
    t.reseller_outreach_draft,
        CASE
            WHEN t.sluiting_datum IS NOT NULL THEN t.sluiting_datum - CURRENT_DATE
            ELSE NULL::integer
        END AS days_to_deadline,
    b.stage AS pipeline_stage,
    b.assignee AS pipeline_assignee,
    b.updated_at AS pipeline_updated_at,
    t.publicatie_type,
    e.stage AS early_stage,
    COALESCE(e.is_early_override, t.publicatie_type IN ('MAC','VAK')) AS is_early
   FROM tenders_scraped t
     LEFT JOIN bid_pipeline b ON b.tender_id = t.id
     LEFT JOIN early_signal_pipeline e ON e.tender_id = t.id
  WHERE t.status = 'analyzed'::text AND t.label IS NOT NULL AND t.label <> 'Disqualified'::text;
