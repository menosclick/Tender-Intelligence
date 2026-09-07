import Link from "next/link";
import { NL_PROVINCES, NL_MAP_VIEWBOX } from "./nl-provinces";
import {
  BROKER_CONTRACTS,
  holdersByProvince,
  formatValue,
} from "./partner-territory";

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
  const brokered = holdersByProvince();
  const openWindows = BROKER_CONTRACTS.filter((c) => c.status === "open");

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
        aria-label={`Map of the Netherlands: ${regional} open tender${regional === 1 ? "" : "s"} with a published region, and ${brokered.size} province${brokered.size === 1 ? "" : "s"} where a partner holds a software-broker contract`}
      >
        {/* Diagonal hatch marks provinces where a partner holds the broker
            position. Hatch, not a second fill: the fill already encodes open
            tenders, and the two facts are independent — a province can have
            both, either, or neither. */}
        <defs>
          <pattern
            id="broker-hatch"
            width="7"
            height="7"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="7"
              stroke="var(--color-warm)"
              strokeWidth="1.6"
              opacity="0.55"
            />
          </pattern>
        </defs>
        {NL_PROVINCES.map((p) => {
          const tenders = byProvince.get(p.name) ?? [];
          const has = tenders.length > 0;
          const contracts = brokered.get(p.name) ?? [];
          const brokerNote = contracts.length
            ? ` ⟶ BROKER TERRITORY: ${contracts
                .map(
                  (c) =>
                    `${c.buyer} held by ${c.holder} (${formatValue(c.valueEur)}${
                      c.endsBy ? `, to ${c.endsBy}` : ""
                    })`
                )
                .join("; ")}`
            : "";
          return (
            <g key={p.name}>
              <title>
                {(has
                  ? `${p.name} — ${tenders
                      .map(
                        (m) =>
                          `${m.title} · ${m.buyer} · ${m.domain} · ${m.label}${
                            m.pipelineStage ? ` · ${m.pipelineStage}` : ""
                          } · NUTS: ${m.nutsName}`
                      )
                      .join(" | ")}`
                  : p.name) + brokerNote}
              </title>
              <path
                d={p.d}
                className={has ? "fill-accent-soft" : "fill-sunken"}
                stroke="var(--color-surface)"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              {contracts.length > 0 && (
                <path
                  d={p.d}
                  fill="url(#broker-hatch)"
                  stroke="var(--color-warm)"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                  pointerEvents="none"
                />
              )}
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

      {/* Partner territory. This is the reason the map earns its space: where a
          buyer has appointed a single-source software broker, CBA cannot sell
          direct — the broker IS the route to market. Protinus is vendor-neutral
          and routes specialist resellers into its accounts, so a held territory
          is a door, not a wall. */}
      <div className="mt-4 border-t border-line pt-3">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-fg-mid">
            Partner territory
          </h3>
          <span className="flex items-center gap-1.5 text-xs text-fg-soft">
            <span
              className="h-2.5 w-2.5 rounded-sm ring-1 ring-inset ring-warm/50"
              style={{ backgroundColor: "var(--color-warm-soft)" }}
            />
            broker held
          </span>
        </div>
        <ul className="mt-2 space-y-1.5">
          {BROKER_CONTRACTS.filter((c) => c.status === "held").map((c) => (
            <li key={c.buyer} className="flex items-baseline justify-between gap-3 text-xs">
              <span className="min-w-0 truncate">
                <span className="font-medium text-fg">{c.buyer}</span>{" "}
                <span className="text-fg-mid">· {c.holder}</span>
              </span>
              <span className="shrink-0 tabular-nums text-fg-soft">
                {formatValue(c.valueEur)}
                {c.endsBy ? ` · to ${c.endsBy}` : ""}
              </span>
            </li>
          ))}
        </ul>
        {openWindows.length > 0 && (
          <div className="mt-3 rounded-lg bg-ok-soft px-2.5 py-2">
            <p className="text-xs font-semibold text-ok">
              Open — no broker appointed yet
            </p>
            {openWindows.map((c) => (
              <p key={c.buyer} className="mt-0.5 text-xs text-fg-mid">
                <span className="font-medium text-fg">{c.buyer}</span> — {c.term}.
                {c.unverified ? ` ${c.unverified}.` : ""}
              </p>
            ))}
          </div>
        )}
        <p className="mt-2 text-xs leading-relaxed text-fg-soft">
          Hand-curated from public award notices, not scraped — a buyer missing
          here means no contract is on file, not that it buys direct. Sources and
          what is still unverified: see the partner-territory research note.
        </p>
      </div>
    </div>
  );
}
