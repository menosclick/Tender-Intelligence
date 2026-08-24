import Link from "next/link";
import { NL_PROVINCES, NL_MAP_VIEWBOX } from "./nl-provinces";

// Netherlands opportunity map — real province geometry (CBS/Kadaster
// generalized borders baked into nl-provinces.ts as static SVG paths; no
// mapping library). Provinces with open tenders get a tinted fill and a
// count badge at their centroid; the title carries the tender details.
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

export function NetherlandsMap({
  provinces,
  nationalCount,
  otherRegions,
  noDataCount = 0,
  multiRegionCount = 0,
}: {
  provinces: ProvinceBucket[];
  nationalCount: number;
  otherRegions: MapTender[]; // NUTS codes outside the known table
  noDataCount?: number; // tenders whose publication carries no NUTS data
  multiRegionCount?: number; // published for several regions, pinned to the first
}) {
  const byProvince = new Map(provinces.map((p) => [p.province, p.tenders]));
  const regional = provinces.reduce((n, p) => n + p.tenders.length, 0);

  if (regional === 0 && nationalCount === 0 && otherRegions.length === 0) {
    return (
      <p className="py-6 text-center text-xs text-fg-soft">
        No open tenders with location data right now. Tenders appear here as
        TenderNed publishes their NUTS region.
      </p>
    );
  }

  return (
    <div>
      <svg
        viewBox={NL_MAP_VIEWBOX}
        className="mx-auto block w-full max-w-80"
        role="img"
        aria-label={`Map of the Netherlands: ${regional} open tender${regional === 1 ? "" : "s"} with a published region`}
      >
        {NL_PROVINCES.map((p) => {
          const tenders = byProvince.get(p.name) ?? [];
          const has = tenders.length > 0;
          return (
            <g key={p.name}>
              <title>
                {has
                  ? `${p.name} — ${tenders
                      .map(
                        (m) =>
                          `${m.title} · ${m.buyer} · ${m.domain} · ${m.label}${
                            m.pipelineStage ? ` · ${m.pipelineStage}` : ""
                          } · NUTS: ${m.nutsName}`
                      )
                      .join(" | ")}`
                  : p.name}
              </title>
              <path
                d={p.d}
                className={has ? "fill-accent-soft" : "fill-sunken"}
                stroke="var(--color-surface)"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              {has && (
                <>
                  <circle
                    cx={p.label[0]}
                    cy={p.label[1]}
                    r="14"
                    className="fill-surface"
                    stroke="var(--color-accent)"
                    strokeWidth="1.5"
                  />
                  <text
                    x={p.label[0]}
                    y={p.label[1]}
                    textAnchor="middle"
                    dominantBaseline="central"
                    className="fill-accent-fg text-[15px] font-semibold tabular-nums"
                  >
                    {tenders.length}
                  </text>
                </>
              )}
            </g>
          );
        })}
      </svg>
      {regional > 0 && (
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg-mid">
          {provinces
            .slice()
            .sort((a, b) => b.tenders.length - a.tenders.length)
            .map((p) => (
              <li key={p.province}>
                <span className="font-medium text-fg">{p.province}</span>{" "}
                <span className="tabular-nums">{p.tenders.length}</span>
              </li>
            ))}
        </ul>
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
        project locations.
        {multiRegionCount > 0 &&
          ` ${multiRegionCount} tender${multiRegionCount === 1 ? " lists" : "s list"} more than one region; each is pinned to the first.`}
      </p>
    </div>
  );
}
