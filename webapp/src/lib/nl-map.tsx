import { NL_PROVINCES, NL_MAP_VIEWBOX } from "./nl-provinces";
import {
  BROKER_CONTRACTS,
  BROKER_HOLDERS,
  HOLDER_COLOR,
  holdersByProvince,
  contractsInProvince,
  formatValue,
  buyerCount,
  type BrokerContract,
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
  // Joint bodies first: one contract covering seven municipalities is a
  // bigger fact than a single town, and mixing the two made the list read
  // as noise (Derson, 2026-09-07).
  const jointBodies = held.filter((c) => c.covers?.length);
  const singles = held.filter((c) => !c.covers?.length);
  // Holders actually present in the data, in BROKER_HOLDERS order, so the
  // legend never advertises a colour the map does not use.
  const holdersShown = BROKER_HOLDERS.filter((h) =>
    held.some((c) => c.holder === h)
  );
  // Buyers reached, members included. "10 contracts" undersells Protinus when
  // three of them are joint bodies buying for their whole membership.
  const reachOf = (h: string) =>
    held.filter((c) => c.holder === h).reduce((n, c) => n + buyerCount(c), 0);

  return (
    <div>
      <svg
        viewBox={NL_MAP_VIEWBOX}
        className="mx-auto block w-full max-w-80"
        role="img"
        aria-label={`Map of the Netherlands showing which partner holds the software-broker contract in each province. ${holdersShown.join(", ")} hold contracts across ${brokered.size} provinces.`}
      >
        <defs>
          {/* A province split between two partners gets both colours as
              stripes. Filling with whichever holder happened to be first made
              the map contradict its own legend: Drenthe rendered as Protinus
              while SoftwareOne holds the province contract there. */}
          {[...brokered.entries()]
            .filter(([, hs]) => hs.length > 1)
            .map(([province, hs]) => (
              <pattern
                key={province}
                id={`split-${province}`}
                width="10"
                height="10"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(45)"
              >
                <rect width="10" height="10" fill={HOLDER_COLOR[hs[0]].fill} />
                <rect width="5" height="10" fill={HOLDER_COLOR[hs[1]].fill} />
              </pattern>
            ))}
        </defs>
        {NL_PROVINCES.map((p) => {
          const holders = brokered.get(p.name) ?? [];
          const split = holders.length > 1;
          const colour = holders[0] ? HOLDER_COLOR[holders[0]] : null;
          const contracts = contractsInProvince(p.name);
          // Naming the member municipalities is the whole point of hovering:
          // "+7" on screen said nothing about which seven.
          const tip = contracts.length
            ? `${p.name}: ${contracts
                .map(
                  (c) =>
                    `${c.buyer} (${c.holder}, ${formatValue(c)}${
                      c.endsBy ? `, to ${c.endsBy}` : ""
                    })${c.covers ? ` covering ${c.covers.join(", ")}` : ""}`
                )
                .join(" | ")}`
            : `${p.name}: no broker contract on file`;
          return (
            <g key={p.name}>
              <title>{tip}</title>
              <path
                d={p.d}
                fill={
                  split
                    ? `url(#split-${p.name})`
                    : colour
                      ? colour.fill
                      : "var(--color-sunken)"
                }
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
        {holdersShown.map((h) => (
          <li key={h} className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{
                backgroundColor: HOLDER_COLOR[h].fill,
                outline: `1px solid ${HOLDER_COLOR[h].stroke}`,
              }}
            />
            <span className="font-medium text-fg">{h}</span>
            {/* Buyers reached, not contracts held: a bare count made the two
                partners look closer than they are. */}
            <span className="tabular-nums text-fg-soft">{reachOf(h)} buyers</span>
          </li>
        ))}
        <li className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 shrink-0 rounded-sm bg-sunken outline outline-1 outline-line-strong" />
          <span className="text-fg-soft">no contract on file</span>
        </li>
      </ul>

      {/* The Dutch statutory term, not an invented English category: these
          bodies are what CBA will see named on the tender itself. The gloss
          carries the meaning for anyone who does not know the word. */}
      <ContractGroup
        heading="Gemeenschappelijke regelingen"
        note="joint bodies buying for their members"
        rows={jointBodies}
      />
      <ContractGroup heading="Single buyers" rows={singles} />

      {openWindows.length > 0 && (
        <div className="mt-4 rounded-lg bg-ok-soft px-2.5 py-2">
          <p className="text-xs font-semibold text-ok">
            No broker appointed yet ({openWindows.length})
          </p>
          <ul className="mt-1.5 space-y-1">
            {openWindows.map((c) => (
              <li
                key={c.buyer}
                className="flex items-baseline justify-between gap-3 text-xs"
                title={
                  (c.bodyType ? `${c.buyer} is a ${c.bodyType}. ` : `${c.buyer}. `) +
                  (c.covers ? `It buys for ${c.covers.join(", ")}. ` : "") +
                  `${c.term}.`
                }
              >
                <span className="min-w-0 truncate">
                  <span className="font-medium text-fg">{c.buyer}</span>
                  {c.covers && (
                    <span className="text-fg-soft"> +{c.covers.length} more</span>
                  )}
                </span>
                <span className="shrink-0 tabular-nums text-fg-mid">
                  {c.closes ? `closes ${c.closes}` : "no close date"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-3 text-xs leading-relaxed text-fg-soft">
        Where a buyer appoints a single-source software broker, licences route
        through that partner rather than direct. Hover any row or province for
        the contract detail.
      </p>
    </div>
  );
}

// One block of contracts. Hovering a row names the member municipalities,
// which is what a bare "+7" left unanswered on screen (Derson, 2026-09-07),
// along with the term and any caveat on the row.
function ContractGroup({
  heading,
  note,
  rows,
}: {
  heading: string;
  note?: string;
  rows: BrokerContract[];
}) {
  if (rows.length === 0) return null;
  return (
    <div className="mt-4">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-fg-mid">
        {heading}
        {note && (
          <span className="ml-1.5 font-normal normal-case tracking-normal text-fg-soft">
            {note}
          </span>
        )}
      </h4>
      <ul className="mt-1.5 space-y-1">
        {rows
          .slice()
          .sort((a, b) => buyerCount(b) - buyerCount(a))
          .map((c) => (
            <li
              key={c.buyer}
              className="flex items-baseline justify-between gap-3 text-xs"
              title={
                (c.bodyType ? `${c.buyer} is a ${c.bodyType}. ` : `${c.buyer}. `) +
                (c.covers
                  ? `It buys for ${buyerCount(c)} bodies: ${c.covers.join(", ")}. `
                  : "") +
                `Broker: ${c.holder}. ${c.term}.` +
                (c.unverified ? ` Caveat: ${c.unverified}.` : "")
              }
            >
              <span className="min-w-0 truncate">
                <span className="font-medium text-fg">{c.buyer}</span>
                {c.covers && (
                  <span className="text-fg-soft"> +{c.covers.length} more</span>
                )}
                <span className="text-fg-soft"> · </span>
                <span style={{ color: HOLDER_COLOR[c.holder].text }}>{c.holder}</span>
              </span>
              <span className="shrink-0 tabular-nums text-fg-soft">
                {c.valueEur !== null && formatValue(c)}
                {c.valueEur !== null && c.endsBy ? " · " : ""}
                {c.endsBy ? `to ${c.endsBy}` : ""}
              </span>
            </li>
          ))}
      </ul>
    </div>
  );
}
