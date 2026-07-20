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
