# Operaciones n8n pendientes de aprobación — 2026-07-20

El classifier de auto-mode bloquea `update_workflow` sobre el workflow de producción `AFyIJ2PzlHA469nq` (igual que el 2026-07-14). Para aplicarlas: correr en una sesión interactiva de Claude Code y aprobar el permiso cuando salga el diálogo, diciendo "aplica las ops pendientes de docs/pending-n8n-ops-2026-07-20.md".

**Backup ya tomado:** `docs/workflow-backup-2026-07-20-pre-m3fix-keywords.json` (65 nodos, workflow activo).

---

## OP 1 — Fix M3: condición del IF `AI Failure?` (validada en clon, exec 11399)

Prod tiene la condición ESTRECHA (`executive_summary equals "AI analysis failed - skipped"`) que NO dispara en el modo real de fallo (summary vacío — evidencia exec 11398). Hasta aplicar esto, el alert de fallo AI en prod no dispara.

Herramienta: `claude.ai n8n → update_workflow`, workflowId `AFyIJ2PzlHA469nq`, una operación:

```json
{
  "type": "updateNodeParameters",
  "nodeName": "AI Failure?",
  "replace": true,
  "parameters": {
    "conditions": {
      "options": { "caseSensitive": true, "leftValue": "", "typeValidation": "strict", "version": 2 },
      "combinator": "or",
      "conditions": [
        {
          "id": "ai-failure-check",
          "leftValue": "={{ ($json.executive_summary || '').toString() }}",
          "rightValue": "AI analysis failed - skipped",
          "operator": { "type": "string", "operation": "equals" }
        },
        {
          "id": "ai-failure-empty",
          "leftValue": "={{ ($json.executive_summary || '').toString().trim() }}",
          "rightValue": "",
          "operator": { "type": "string", "operation": "empty", "singleValue": true }
        }
      ]
    },
    "options": {}
  }
}
```

Verificación post-apply: GET del workflow → el nodo debe tener combinator `or` con las 2 condiciones. El E2E ya se probó en el clon (Slack `ok: true`, exec 11399 — ver fixes.md 2026-07-14).

## OP 2 — Negative keywords de salud en `Keyword Filter` (mata los falsos positivos "monitor")

Evidencia: "Monitor Nationaal Programma Grieppreventie" quedó Hot 52 y "Monitor Prenatale Screening" Warm 48 — ambos programas de salud del RIVM que matchearon 'monitoring'. Los términos son de TEMA salud (no de sector), para no descalificar compras IT legítimas de RIVM/hospitales.

Herramienta: igual, una operación `setNodeParameter` sobre `Keyword Filter`, path `/jsCode`: en el array `negKw`, después de la línea que termina en `'civieltechnisch','drukwerk','kantoorartikelen',` agregar:

```js
  'vaccinatie','griep','pneumokokken','prenatale','neonatale','echoscopisch',
  'hielprik','bevolkingsonderzoek','epidemiologisch','epidemiologie',
```

(El resto del código del nodo queda idéntico; el jsCode completo actual está en el backup.)

Verificación post-apply: GET → el jsCode contiene 'grieppreventie'... (nota: 'griep' cubre 'grieppreventie' por substring). Los 2 tenders ya escrapeados NO cambian (el filtro corre al scrapear); en la app ya se pueden demotear con "Not relevant".

---

## OP 3 — Migración DB: stages del board al ciclo real + stage "Award" (agregada 2026-07-21)

El classifier también bloquea DDL en auto-mode. La UI ya muestra los nombres nuevos vía display-map (`STAGE_LABELS` en `webapp/src/lib/format.ts`: New→Identified, Reviewing→Analysis, Bidding→Q&A) sin tocar la DB. Esta migración completa el rename en la DB y agrega el stage **Award** (Submitted → Award → Won/Lost), que no puede existir sin ella por el CHECK constraint.

Herramienta: `claude.ai Supabase → apply_migration`, proyecto `nzzjwtjmdciipadpnmvu`:

```sql
-- 1. Widen check (acepta viejos y nuevos durante la transición)
ALTER TABLE bid_pipeline DROP CONSTRAINT bid_pipeline_stage_check;
ALTER TABLE bid_pipeline ADD CONSTRAINT bid_pipeline_stage_check
  CHECK (stage = ANY (ARRAY['Identified','Analysis','Q&A','Submitted','Award','Won','Lost','Dropped','New','Reviewing','Bidding']::text[]));
-- 2. Migrar filas existentes
UPDATE bid_pipeline SET stage='Identified' WHERE stage='New';
UPDATE bid_pipeline SET stage='Analysis'   WHERE stage='Reviewing';
UPDATE bid_pipeline SET stage='Q&A'        WHERE stage='Bidding';
-- 3. Tighten (solo nombres nuevos)
ALTER TABLE bid_pipeline DROP CONSTRAINT bid_pipeline_stage_check;
ALTER TABLE bid_pipeline ADD CONSTRAINT bid_pipeline_stage_check
  CHECK (stage = ANY (ARRAY['Identified','Analysis','Q&A','Submitted','Award','Won','Lost','Dropped']::text[]));
```

**Después de aplicarla, en el código:** BOARD_STAGES pasa a los nombres nuevos + 'Award' entre Submitted y Won, STAGE_LABELS se vacía, y el outcomeMap de `moveCard` mapea Q&A/Submitted/Award→bidding. (Pedirme "aplica la OP 3" y hago migración + código + deploy juntos.)

---

## OP 4 — Tabla `tender_milestones` para el Deadline Calendar (agregada 2026-07-21)

El Deadline Calendar del dashboard (pedido de Derson) hoy solo puede mostrar los hitos que existen en la DB: submission deadline (y question deadline cuando venga). Los otros 8 hitos del ciclo (NvI publication, Demo, Proof of Concept, Provisional award, Objection period, Final award, Contract start, Publication) viven en la leidraad de cada tender. Esta tabla los habilita — carga manual primero, extracción automática desde los documentos (pipeline bid-pack ya los lee) después.

```sql
CREATE TABLE tender_milestones (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tender_id integer NOT NULL REFERENCES tenders_scraped(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN (
    'publication','question_deadline','nvi_publication','submission_deadline',
    'demo','proof_of_concept','provisional_award','objection_period_end',
    'final_award','contract_start','other'
  )),
  milestone_date date NOT NULL,
  note text,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','documents','tenderned')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tender_id, kind)
);
ALTER TABLE tender_milestones ENABLE ROW LEVEL SECURITY;
-- misma política que las demás tablas app-owned (service role escribe; authenticated lee)
CREATE POLICY tender_milestones_read ON tender_milestones FOR SELECT TO authenticated USING (true);
```

**Después de aplicarla, en el código:** el DeadlineCalendar del dashboard lee `tender_milestones` (unión con los hitos de tenders_scraped), y el tender detail gana un mini-form "Add milestone" (kind + fecha). Fase 2 (pipeline): extraer la tabla de planning de la leidraad en el paso de bid pack y escribir los hitos con source='documents'. (Pedirme "aplica la OP 4".)
