import { NL_PROVINCES, NL_MAP_VIEWBOX } from "./nl-provinces";
import {
  BROKER_CONTRACTS,
  BROKER_HOLDERS,
  HOLDER_COLOR,
  holdersByProvince,
  contractsInProvince,
  formatValue,
  buyerCount,
} from "./partner-territory";

// Netherlands PARTNER-TERRITORY map — real province geometry (CBS/Kadaster
// generalized borders baked into nl-provinces.ts as static SVG paths; no
// mapping library). Each province is filled with the colour of the partner
// holding a single-source software-broker contract there.
//
// It used to plot open tenders per province with a count badge. That was
// dropped (Derson, 2026-09-07): only 5 of 16 open tenders carry a province at
// all — the other 10 publish NUTS "NL" and pin nowhere — so the counts implied
// a geographic pattern that did not exist, and CBA does not decide by region
// anyway. What DOES decide the sale is who brokers the buyer's software, since
// a brokered buyer cannot be sold direct. Contract data: partner-territory.ts.
//
// MapTender / ProvinceBucket / parseNutsCodes / NUTS2_PROVINCE below are still
// exported: the dashboard uses them to derive its own per-province buckets.

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


// Takes no tender data: the map is about partner territory now, and the
// contracts are a static curated file rather than anything from the DB.
export function NetherlandsMap() {
  const brokered = holdersByProvince();
  const held = BROKER_CONTRACTS.filter((c) => c.status === "held");
  const openWindows = BROKER_CONTRACTS.filter((c) => c.status === "open");
  // Holders actually present in the data, in BROKER_HOLDERS order, so the
  // legend never advertises a colour the map does not use.
  const holdersShown = BROKER_HOLDERS.filter((h) =>
    held.some((c) => c.holder === h)
  );

  return (
    <div>
      <svg
        viewBox={NL_MAP_VIEWBOX}
        className="mx-auto block w-full max-w-80"
        role="img"
        aria-label={`Map of the Netherlands showing which partner holds the software-broker contract in each province. ${holdersShown.join(", ")} hold contracts across ${brokered.size} provinces.`}
      >
        {NL_PROVINCES.map((p) => {
          const holders = brokered.get(p.name) ?? [];
          // A province can be split between two brokers (Zuid-Holland is:
          // Protinus in Rotterdam, SoftwareOne in Den Haag). Fill with the
          // first holder and say so in the tooltip rather than pretending
          // one partner owns the whole province.
          const primary = holders[0];
          const colour = primary ? HOLDER_COLOR[primary] : null;
          const contracts = contractsInProvince(p.name);
          const tip = contracts.length
            ? `${p.name} — ${contracts
                .map(
                  (c) =>
                    `${c.buyer}: ${c.holder} (${formatValue(c)}${
                      c.endsBy ? `, to ${c.endsBy}` : ""
                    })${c.covers ? ` — covers ${buyerCount(c)} buyers` : ""}`
                )
                .join(" | ")}`
            : `${p.name} — no broker contract on file`;
          return (
            <g key={p.name}>
              <title>{tip}</title>
              <path
                d={p.d}
                fill={colour ? colour.fill : "var(--color-sunken)"}
                stroke={colour ? colour.stroke : "var(--color-surface)"}
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </g>
          );
        })}
      </svg>

      {/* Legend: swatch + the holder's name, never colour alone. */}
      <ul className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
        {holdersShown.map((h) => {
          const n = held.filter((c) => c.holder === h).length;
          return (
            <li key={h} className="flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{
                  backgroundColor: HOLDER_COLOR[h].fill,
                  outline: `1px solid ${HOLDER_COLOR[h].stroke}`,
                }}
              />
              <span className="font-medium text-fg">{h}</span>
              <span className="tabular-nums text-fg-soft">{n}</span>
            </li>
          );
        })}
        <li className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 shrink-0 rounded-sm bg-sunken outline outline-1 outline-line-strong" />
          <span className="text-fg-soft">no contract on file</span>
        </li>
      </ul>

      {/* Held contracts, biggest coverage first — a collective covering seven
          municipalities matters more than a single town. */}
      <ul className="mt-3 space-y-1.5">
        {held
          .slice()
          .sort((a, b) => buyerCount(b) - buyerCount(a))
          .map((c) => (
            <li key={c.buyer} className="flex items-baseline justify-between gap-3 text-xs">
              <span className="min-w-0 truncate">
                <span className="font-medium text-fg">{c.buyer}</span>
                {c.covers && (
                  <span className="text-fg-soft"> +{c.covers.length}</span>
                )}{" "}
                <span style={{ color: HOLDER_COLOR[c.holder].text }}>{c.holder}</span>
              </span>
              <span className="shrink-0 tabular-nums text-fg-soft">
                {formatValue(c)}
                {c.endsBy ? ` · to ${c.endsBy}` : ""}
              </span>
            </li>
          ))}
      </ul>

      {openWindows.length > 0 && (
        <div className="mt-3 rounded-lg bg-ok-soft px-2.5 py-2">
          <p className="text-xs font-semibold text-ok">
            No broker appointed yet — {openWindows.length} open
          </p>
          <ul className="mt-1 space-y-0.5">
            {openWindows.map((c) => (
              <li key={c.buyer} className="text-xs text-fg-mid">
                <span className="font-medium text-fg">{c.buyer}</span>
                {c.covers && <span className="text-fg-soft"> +{c.covers.length}</span>}
                {c.closes ? ` — bids close ${c.closes}` : " — no close date published"}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-2 text-xs leading-relaxed text-fg-soft">
        Where a buyer appoints a single-source software broker, licences route
        through that partner rather than direct. Hand-curated from public award
        notices, not scraped — a buyer missing here means no contract is on
        file, not that it buys direct. Some rows are older awards that may have
        been re-tendered; each carries its source and caveat in
        <code className="mx-1">partner-territory.ts</code>.
      </p>
    </div>
  );
}
