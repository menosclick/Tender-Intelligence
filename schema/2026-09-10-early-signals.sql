-- ============================================================
-- Early signals: Marktconsultatie (MAC) + Vooraankondiging (VAK)
-- Run in the Supabase SQL editor. Safe to re-run. Run as ONE batch.
-- ============================================================
--
-- WHY
-- The scraper asked TenderNed for publicatieType=AAO only, so market
-- consultations were filtered out server-side and never reached the pipeline.
-- Derson found two IAM consultations by hand (Veiligheidsregio Fryslan,
-- Gemeente Velsen) that the system never showed him.
--
-- The n8n workflow (AFyIJ2PzlHA469nq) now also requests MAC and VAK and writes
-- publicatie_type on every row. "Save to Postgres" uses autoMapInputData, so
-- WITHOUT STEP 1 THE NEXT SCRAPER RUN FAILS ON INSERT.

-- ------------------------------------------------------------
-- 1. The column the pipeline now writes.  REQUIRED.
-- ------------------------------------------------------------
ALTER TABLE tenders_scraped
  ADD COLUMN IF NOT EXISTS publicatie_type text DEFAULT 'AAO';

-- Everything scraped before today was a live tender.
UPDATE tenders_scraped
   SET publicatie_type = 'AAO'
 WHERE publicatie_type IS NULL;

-- The inbox filters on this on every page load.
CREATE INDEX IF NOT EXISTS tenders_scraped_publicatie_type_idx
  ON tenders_scraped (publicatie_type);

-- ------------------------------------------------------------
-- 2. Expose it to the web app.
-- ------------------------------------------------------------
-- v_app_tenders is the app's only read surface: a column absent there is
-- invisible to the UI regardless of what the table holds. The view renames
-- columns (naam->title, opdrachtgever->buyer, sluiting_datum->deadline) and
-- joins pipeline state, so it is NOT re-declared by hand here. Instead the
-- existing definition is read back and re-created with one extra column,
-- which cannot drift from whatever is actually deployed.
DO $$
DECLARE
  def text;
BEGIN
  SELECT pg_get_viewdef('public.v_app_tenders'::regclass, true) INTO def;

  -- Already exposed? Then there is nothing to do.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name   = 'v_app_tenders'
       AND column_name  = 'publicatie_type'
  ) THEN
    RAISE NOTICE 'v_app_tenders already exposes publicatie_type - skipped';
    RETURN;
  END IF;

  -- Wrap the live definition and add the column from the base table.
  EXECUTE format(
    'CREATE OR REPLACE VIEW public.v_app_tenders AS
       SELECT v.*, t.publicatie_type
         FROM (%s) AS v
         JOIN public.tenders_scraped t ON t.id = v.id',
    rtrim(def, ';' || chr(10) || chr(9) || ' ')
  );
  RAISE NOTICE 'v_app_tenders recreated with publicatie_type';
END $$;

-- ------------------------------------------------------------
-- 3. Verify (should print AAO plus MAC/VAK once the scraper has run).
-- ------------------------------------------------------------
SELECT publicatie_type, count(*)
  FROM tenders_scraped
 GROUP BY publicatie_type
 ORDER BY 2 DESC;
