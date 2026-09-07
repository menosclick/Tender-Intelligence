// Software-broker territory: which public buyers have appointed a single-source
// software broker, and who holds it.
//
// WHY THIS EXISTS. When a Dutch public body appoints a software broker, every
// licence it buys goes through that broker — CBA cannot sell it directly. So
// the buyer's broker decides the *route to market*, which is a sales fact, not
// a geographic curiosity. Protinus in particular is vendor-agnostic "Managed
// Sourcing" and openly routes specialist resellers into its large accounts, so
// a brokered buyer is a channel to enter, not an account that is lost.
//
// HOW IT IS MAINTAINED. Hand-curated from public sources, one entry per
// contract, each carrying its own `source` URL. Nothing here is scraped or
// inferred — if a fact could not be verified it is left null and `verified`
// says what is still unknown. Research write-up and full citations:
// 02_CLIENTS/cba-benelux/research/2026-09-07-partner-territory.md
//
// TO ADD A ROW: paste the buyer exactly as TenderNed publishes it (the matcher
// is case-insensitive substring, so "Rotterdam" catches "Gemeente Rotterdam"),
// the holder, and a source URL. Leave a field null rather than guessing.

export type BrokerContract = {
  /** Buyer name as published. Matched case-insensitively as a substring. */
  buyer: string;
  /** The partner holding the broker position. */
  holder: string;
  /** Province, for tinting the map. Null for national/non-geographic bodies. */
  province: string | null;
  /** Maximum estimated contract value, as published. Null when not disclosed. */
  valueEur: number | null;
  /** Free-text term as published — durations are rarely clean dates. */
  term: string;
  /** Year the contract runs to, when it can be stated. Null when unpublished. */
  endsBy: number | null;
  /** "held" = awarded and running. "open" = tendered, not yet awarded. */
  status: "held" | "open";
  source: string;
  /** What is NOT established about this row. Empty string when fully verified. */
  unverified: string;
};

export const BROKER_CONTRACTS: BrokerContract[] = [
  {
    buyer: "Rotterdam",
    holder: "Protinus IT",
    province: "Zuid-Holland",
    valueEur: 160_000_000,
    term: "2 years + 2×1-year extensions (renewal of a 2020 contract)",
    endsBy: 2029,
    status: "held",
    source:
      "https://www.computable.nl/2025/04/25/protinus-it-sleept-opnieuw-grote-deal-rotterdam-in-de-wacht/",
    unverified: "exact start and end dates not published; endsBy is the maximum term",
  },
  {
    buyer: "Den Haag",
    holder: "SoftwareOne",
    province: "Zuid-Holland",
    valueEur: null,
    term: "4 years + up to 2 more, awarded January 2024",
    endsBy: 2030,
    status: "held",
    source:
      "https://www.dutchitchannel.nl/news/420188/raamovereenkomst-gemeente-den-haag-gegund-aan-softwareone",
    unverified: "value not disclosed; endsBy assumes both extensions are taken",
  },
  {
    buyer: "Zoetermeer",
    holder: "Protinus IT",
    province: "Zuid-Holland",
    valueEur: 40_000_000,
    term: "4 years, running since February 2026 (renewal)",
    endsBy: 2030,
    status: "held",
    source:
      "https://protinus.nl/en/news/protinus-remains-software-broker-for-the-municipality-of-zoetermeer/",
    unverified: "",
  },
  {
    buyer: "Dronten",
    holder: "Protinus IT",
    province: "Flevoland",
    valueEur: 20_000_000,
    term: "2 years + 2×24-month extensions",
    endsBy: null,
    status: "held",
    source: "https://protinus.nl/nieuws/protinus-it-wint-aanbesteding-voor-softwarelevering-aan-gemeente-dronten/",
    unverified: "award date not established, so the end year cannot be stated",
  },
  {
    buyer: "Fryske Marren",
    holder: "Protinus IT",
    province: "Friesland",
    valueEur: 1_600_000,
    term: "4 years (€400k/year), from 1 January 2026",
    endsBy: 2030,
    status: "held",
    source:
      "https://executive-people.nl/690145/de-fryske-marren-gunt-protinus-it-opdracht-levering-software.html",
    unverified: "",
  },
  {
    buyer: "Stichtse Vecht",
    holder: "Protinus IT",
    province: "Utrecht",
    valueEur: null,
    term: '"EA - Software broker dienstverlening", listed 2021',
    endsBy: null,
    status: "held",
    source: "https://nl.openprocurements.com/supplier/protinus-it/",
    unverified: "may have lapsed or been re-tendered since 2021 — treat as stale",
  },
  {
    buyer: "Noaberkracht",
    holder: "Protinus IT",
    province: "Overijssel",
    valueEur: null,
    term: '"Softwaremakelaar" for seven Twente municipalities, listed 2020',
    endsBy: null,
    status: "held",
    source: "https://nl.openprocurements.com/supplier/protinus-it/",
    unverified: "may have lapsed or been re-tendered since 2020 — treat as stale",
  },
  {
    // The one that matters most: still winnable.
    buyer: "Leeuwarden",
    holder: "not yet awarded",
    province: "Friesland",
    valueEur: null,
    term: "European procedure for a single supplier, announced 18 November 2025",
    endsBy: null,
    status: "open",
    source: "https://nl.openprocurements.com/buyer/gemeente-leeuwarden/",
    unverified: "bidders reported as Bechtle and SoftwareONE; no award found",
  },
];

/**
 * The broker holding a buyer's software, or null when none is known.
 * Substring match because TenderNed publishes "Gemeente Rotterdam" while the
 * contract is reported against "Rotterdam".
 *
 * A null result means "no contract on file" — NOT "sells direct". Coverage is
 * hand-curated from trade press and is deliberately incomplete.
 */
export function brokerFor(buyer: string | null): BrokerContract | null {
  if (!buyer) return null;
  const b = buyer.toLowerCase();
  return BROKER_CONTRACTS.find((c) => b.includes(c.buyer.toLowerCase())) ?? null;
}

/** Province → the partners holding contracts there, for tinting the map. */
export function holdersByProvince(): Map<string, BrokerContract[]> {
  const m = new Map<string, BrokerContract[]>();
  for (const c of BROKER_CONTRACTS) {
    if (!c.province) continue;
    const list = m.get(c.province) ?? [];
    list.push(c);
    m.set(c.province, list);
  }
  return m;
}

export function formatValue(v: number | null): string {
  if (v === null) return "value not published";
  return v >= 1_000_000 ? `€${Math.round(v / 1_000_000)}M` : `€${(v / 1000).toFixed(0)}k`;
}
