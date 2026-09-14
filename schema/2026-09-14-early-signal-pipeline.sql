-- Applied to Supabase nzzjwtjmdciipadpnmvu on 2026-09-14
-- (migration name: early_signal_pipeline_as_app_owned_table)
--
-- Early signals (publicatie_type MAC / VAK) are not biddable: the buyer is
-- still deciding what to buy. They therefore must never enter bid_pipeline,
-- whose every stage names bid work that does not exist yet -- but Derson still
-- needs to follow one up ("quiero que continuen como early signals ... pero
-- con el label de que estan siendo analizadas o en proceso de preguntas").
--
-- So they get their own lifecycle, in their own app-owned table, mirroring how
-- bid_pipeline works for real bids. When the buyer finally publishes the RFP,
-- it arrives as a separate AAO row -- and THAT one goes to the board.
--
-- Note: an earlier attempt put `early_stage` directly on tenders_scraped. That
-- violated the golden rule in webapp/src/lib/actions.ts (the app never writes
-- columns the scraper owns) and was reverted in the same migration.

create table if not exists early_signal_pipeline (
  tender_id integer primary key references tenders_scraped(id) on delete cascade,
  stage text not null default 'new'
    check (stage in ('new','analyzing','questions_sent','awaiting_rfp','dropped')),
  note text,
  updated_at timestamptz not null default now()
);

comment on table early_signal_pipeline is
  'Lifecycle of market consultations / pre-announcements (publicatie_type MAC or VAK). App-owned, like bid_pipeline. A consultation never enters bid_pipeline; when the real RFP is published it arrives as a separate AAO row, and THAT one goes to the board.';

-- v_app_tenders gains early_stage, appended last: `create or replace view`
-- matches columns positionally and refuses to insert one mid-list
-- (42P16: cannot change name of view column).
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
    e.stage AS early_stage
   FROM tenders_scraped t
     LEFT JOIN bid_pipeline b ON b.tender_id = t.id
     LEFT JOIN early_signal_pipeline e ON e.tender_id = t.id
  WHERE t.status = 'analyzed'::text AND t.label IS NOT NULL AND t.label <> 'Disqualified'::text;
