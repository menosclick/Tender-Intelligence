# Evals — set de tenders etiquetados a mano

Propósito: medir qué tan bueno es el scoring del pipeline (keyword filter + AI) contra la verdad humana. Con ~50 tenders etiquetados, Claude calcula precisión/recall y el número va directo al case study ("el sistema captura el X% de los tenders relevantes").

## Cómo agregar un tender (2 minutos)

1. Crea una carpeta con el `external_id` de TenderNed como nombre (el mismo ID que aparece en `tenders_scraped` y en el link del brief). Ejemplo: `evals/432784/`
2. Suelta adentro los PDFs del tender. En orden de importancia:
   - **aanbestedingsleidraad** (o beschrijvend document) — obligatorio si existe
   - **Programma van Eisen (PvE)** — obligatorio si existe
   - Nota van Inlichtingen — solo si el leidraad es ambiguo
   - Gunningscriteria — opcional (no sirve para el eval, pero es oro para el futuro bid copilot)
   - NO hace falta: UEA/ESPD, concepto de contrato, prijzenblad
3. Copia `_template/label.md` a la carpeta y llena las 3 líneas.

Nada más. Claude cruza el `external_id` con Supabase y arma el eval solo.

## Qué cuenta como buen set

- Mezcla real: relevantes E irrelevantes (ideal ~mitad y mitad; un set de puros relevantes no mide nada)
- Incluye los casos difíciles: los que dudaste, los que el sistema marcó mal
- Los enviados (bid submitted) valen doble: traen outcome real
