import Link from "next/link";

// Netherlands opportunity map — first iteration.
//
// Rendered as a schematic province tile map (SVG, no mapping dependency):
// twelve tiles in approximate geographic position, count per province.
// The component API is per-province data, so real province geometry can
// replace the tiles in a later iteration without touching callers.
//
// Location source: the TenderNed publication's NUTS codes (place of
// performance as published). Buyer addresses are NEVER used as project
// locations. Tenders published with national scope (code "NL") are counted
// separately below the map instead of being pinned anywhere.

export type MapTender = {
  id: number;
  title: string;
  buyer: string;
  domain: string;
  label: string;
  pipelineStage: string | null;
  nutsName: string; // the region description as published
};

export type ProvinceBucket = {
  province: string;
  tenders: MapTender[];
};

// Parse the nutsCodes array out of a scraped tender's raw TenderNed JSON.
// raw_json is a text column; malformed or missing data yields [].
export type NutsEntry = { code: string; omschrijving: string };
export function parseNutsCodes(rawJson: string | null): NutsEntry[] {
  if (!rawJson) return [];
  try {
    const parsed = JSON.parse(rawJson) as { nutsCodes?: unknown };
    if (!Array.isArray(parsed.nutsCodes)) return [];
    return parsed.nutsCodes
      .filter(
        (n): n is { code: string; omschrijving?: string } =>
          !!n && typeof n === "object" && typeof (n as { code?: unknown }).code === "string"
      )
      .map((n) => ({ code: n.code, omschrijving: n.omschrijving ?? n.code }));
  } catch {
    return [];
  }
}

// NUTS-2 prefix → province. Base table per the current TED eForms codelist
// (nuts-nld-lvl3); NL35/NL36 cover the post-2021 renumbering variants seen in
// live TenderNed data (e.g. NL363 "Agglomeratie Leiden en Bollenstreek").
export const NUTS2_PROVINCE: Record<string, string> = {
  NL11: "Groningen",
  NL12: "Friesland",
  NL13: "Drenthe",
  NL21: "Overijssel",
  NL22: "Gelderland",
  NL23: "Flevoland",
  NL31: "Utrecht",
  NL32: "Noord-Holland",
  NL33: "Zuid-Holland",
  NL34: "Zeeland",
  NL35: "Utrecht",
  NL36: "Zuid-Holland",
  NL41: "Noord-Brabant",
  NL42: "Limburg",
};

// Approximate geographic tile positions (col, row) on a 4×4 grid.
const TILE: Record<string, { col: number; row: number; abbr: string }> = {
  Friesland: { col: 2, row: 0, abbr: "FR" },
  Groningen: { col: 3, row: 0, abbr: "GR" },
  "Noord-Holland": { col: 1, row: 1, abbr: "NH" },
  Flevoland: { col: 2, row: 1, abbr: "FL" },
  Drenthe: { col: 3, row: 1, abbr: "DR" },
  "Zuid-Holland": { col: 0, row: 2, abbr: "ZH" },
  Utrecht: { col: 1, row: 2, abbr: "UT" },
  Gelderland: { col: 2, row: 2, abbr: "GE" },
  Overijssel: { col: 3, row: 2, abbr: "OV" },
  Zeeland: { col: 0, row: 3, abbr: "ZE" },
  "Noord-Brabant": { col: 1, row: 3, abbr: "NB" },
  Limburg: { col: 2, row: 3, abbr: "LI" },
};

const CELL = 64;
const GAP = 6;

export function NetherlandsMap({
  provinces,
  nationalCount,
  otherRegions,
  noDataCount = 0,
}: {
  provinces: ProvinceBucket[];
  nationalCount: number;
  otherRegions: MapTender[]; // NUTS codes outside the known table
  noDataCount?: number; // tenders whose publication carries no NUTS data
}) {
  const byProvince = new Map(provinces.map((p) => [p.province, p.tenders]));
  const regional = provinces.reduce((n, p) => n + p.tenders.length, 0);
  const width = 4 * CELL + 3 * GAP;
  const height = 4 * CELL + 3 * GAP;

  if (regional === 0 && nationalCount === 0 && otherRegions.length === 0) {
    return (
      <p className="py-6 text-center text-xs text-fg-soft">
        No open qualified tenders with location data right now. Tenders appear
        here as TenderNed publishes their NUTS region.
      </p>
    );
  }

  return (
    <div>
      {regional > 0 ? (
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="mx-auto block w-full max-w-72"
          role="img"
          aria-label={`Schematic map of the Netherlands: ${regional} open qualified tender${regional === 1 ? "" : "s"} with a published region`}
        >
          {Object.entries(TILE).map(([province, t]) => {
            const tenders = byProvince.get(province) ?? [];
            const x = t.col * (CELL + GAP);
            const y = t.row * (CELL + GAP);
            const has = tenders.length > 0;
            return (
              <g key={province}>
                <title>
                  {has
                    ? `${province} — ${tenders
                        .map(
                          (m) =>
                            `${m.title} · ${m.buyer} · ${m.domain} · ${m.label}${
                              m.pipelineStage ? ` · ${m.pipelineStage}` : ""
                            } · NUTS: ${m.nutsName}`
                        )
                        .join(" | ")}`
                    : province}
                </title>
                <rect
                  x={x}
                  y={y}
                  width={CELL}
                  height={CELL}
                  rx="6"
                  className={has ? "fill-accent-soft" : "fill-sunken"}
                  stroke="var(--color-line)"
                />
                <text
                  x={x + 8}
                  y={y + 18}
                  className={`text-[11px] font-semibold ${has ? "fill-accent-fg" : "fill-fg-soft"}`}
                >
                  {t.abbr}
                </text>
                {has && (
                  <text
                    x={x + CELL - 8}
                    y={y + CELL - 10}
                    textAnchor="end"
                    className="fill-fg text-[16px] font-semibold tabular-nums"
                  >
                    {tenders.length}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      ) : (
        <p className="py-4 text-center text-xs text-fg-soft">
          No open qualified tenders name a specific region right now.
        </p>
      )}

      <div className="mt-3 space-y-1 text-xs text-fg-mid">
        {nationalCount > 0 && (
          <p>
            <Link href="/inbox" className="font-medium text-accent-fg hover:underline">
              {nationalCount} tender{nationalCount === 1 ? "" : "s"}
            </Link>{" "}
            published with national scope (no single region).
          </p>
        )}
        {otherRegions.length > 0 && (
          <p>
            {otherRegions.length} in regions outside the province table:{" "}
            {[...new Set(otherRegions.map((m) => m.nutsName))].join(", ")}.
          </p>
        )}
        {noDataCount > 0 && (
          <p>
            {noDataCount} without location data in the publication.
          </p>
        )}
      </div>
      <p className="mt-2 text-xs leading-relaxed text-fg-soft">
        Locations come from the TenderNed publication&apos;s NUTS region (place
        of performance as published) — buyer addresses are never shown as
        project locations. Schematic tiles for now; real province geometry can
        drop in later.
      </p>
    </div>
  );
}
