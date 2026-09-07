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
// HOW IT IS MAINTAINED. Hand-curated from public award notices and Dutch
// channel press, one entry per contract, each carrying its own `source` URL.
// Nothing here is scraped or inferred — where a value was not published the
// field is null rather than estimated, and `unverified` states what is still
// unknown about the row. Research write-up and full citations:
// 02_CLIENTS/cba-benelux/research/2026-09-07-partner-territory.md
//
// TO ADD A ROW: paste the buyer as TenderNed publishes it (matching is
// case-insensitive substring, so "Rotterdam" catches "Gemeente Rotterdam"),
// the holder, and a source URL. Leave a field null rather than guessing.
//
// A NOTE ON JOINT BODIES. Several of the largest contracts are not held by a
// single town but by a gemeenschappelijke regeling — the Dutch statutory form
// for public bodies co-operating — which tenders once on behalf of all its
// members. `covers` lists those members so a tender from any one of them is
// matched. This is where most of the brokered territory actually is.
//
// They are NOT interchangeable, which is why each carries its own `bodyType`:
// SSC Ons is a staffed shared-service centre that runs its members' IT,
// Drechtsteden a formal regional arrangement, Inkoopkracht ZHW a purchasing
// network, Zuidoost Brabant bodies bundled for a single tender.

/** The partners seen holding broker seats. Order fixes their colour. */
export const BROKER_HOLDERS = [
  "Protinus IT",
  "SoftwareOne",
  "Centralpoint",
  "Bechtle",
] as const;
export type BrokerHolder = (typeof BROKER_HOLDERS)[number] | "not yet awarded";

/**
 * One colour per holder, so the map reads as territory at a glance.
 * Every swatch is paired with the holder's NAME in the legend and in each
 * tooltip — colour never carries the meaning alone (DESIGN.md).
 */
export const HOLDER_COLOR: Record<string, { fill: string; stroke: string; text: string }> = {
  "Protinus IT": {
    fill: "var(--color-accent-soft)",
    stroke: "var(--color-accent)",
    text: "var(--color-accent-fg)",
  },
  SoftwareOne: {
    fill: "var(--color-warm-soft)",
    stroke: "var(--color-warm)",
    text: "var(--color-warm)",
  },
  Centralpoint: {
    fill: "var(--color-ok-soft)",
    stroke: "var(--color-ok)",
    text: "var(--color-ok)",
  },
  Bechtle: {
    fill: "var(--color-cold-soft)",
    stroke: "var(--color-cold)",
    text: "var(--color-cold)",
  },
  "not yet awarded": {
    fill: "var(--color-sunken)",
    stroke: "var(--color-line-strong)",
    text: "var(--color-fg-mid)",
  },
};

export type BrokerContract = {
  /** Buyer or collective name as published. Substring-matched, case-insensitive. */
  buyer: string;
  holder: BrokerHolder;
  /** Member buyers, for joint bodies. Each is matched like `buyer`. */
  covers?: string[];
  /**
   * What kind of joint body this is. They are all gemeenschappelijke
   * regelingen (the Dutch statutory form for public bodies co-operating), but
   * they are not the same animal: SSC Ons is a staffed shared-service centre
   * running its members' IT, Drechtsteden a formal regional arrangement,
   * Inkoopkracht a purchasing network, Zuidoost Brabant bodies bundled for one
   * tender. Shown on hover so the panel does not flatten them into one label.
   */
  bodyType?: string;
  /** Provinces to tint. A collective can span several. */
  provinces: string[];
  /** Maximum estimated value as published, in euros. Null when not disclosed. */
  valueEur: number | null;
  /** Whether valueEur is the whole term or a yearly figure. */
  valueBasis: "total" | "per year";
  /** Term as published — durations are rarely clean dates. */
  term: string;
  /** Year the contract can run to. Null when it cannot be stated. */
  endsBy: number | null;
  /** "held" = awarded and running. "open" = tendered, not yet awarded. */
  status: "held" | "open";
  /** Bid deadline for open tenders, ISO date. */
  closes?: string;
  source: string;
  /** What is NOT established here. Empty string when fully verified. */
  unverified: string;
};

export const BROKER_CONTRACTS: BrokerContract[] = [
  // ---- Held: the large collectives, where most of the territory sits --------
  {
    buyer: "Inkoopkracht Zuid-Holland West",
    bodyType: "purchasing network of 6 municipalities",
    holder: "Protinus IT",
    covers: [
      "Delft",
      "Pijnacker-Nootdorp",
      "Westland",
      "Leidschendam-Voorburg",
      "Midden-Delfland",
    ],
    provinces: ["Zuid-Holland"],
    valueEur: 53_000_000,
    valueBasis: "total",
    term: "24 months + 2×12-month extensions",
    endsBy: null,
    status: "held",
    source: "https://www.computable.nl/2022/03/18/protinus-it-softwarebroker-voor-inkoopkracht-zhw/",
    unverified: "awarded 2022; may have been re-tendered since, so the end date is unknown",
  },
  {
    buyer: "Drechtsteden",
    bodyType: "regional joint arrangement (gemeenschappelijke regeling) of 7 municipalities",
    holder: "Protinus IT",
    covers: [
      "Alblasserdam",
      "Dordrecht",
      "Hardinxveld-Giessendam",
      "Hendrik-Ido-Ambacht",
      "Papendrecht",
      "Sliedrecht",
      "Zwijndrecht",
    ],
    provinces: ["Zuid-Holland"],
    valueEur: null,
    valueBasis: "total",
    term: "Joint arrangement of 7 municipalities; Protinus named co-winner",
    endsBy: null,
    status: "held",
    source:
      "https://www.computable.nl/artikel/nieuws/wie-gunt-wat/7182509/3152533/drechtsteden-kiest-protinus-it-als-softwarebroker.html",
    unverified: "co-winner, so a second broker also holds part of this; value and term not published",
  },
  {
    buyer: "SSC Ons",
    bodyType: "staffed shared-service centre running IT for 6 municipalities and a province",
    holder: "Protinus IT",
    // Seven members, not six: Ommen was missing from the press summary and
    // comes from SSC Ons's own account of itself.
    covers: [
      "Zwolle",
      "Kampen",
      "Dalfsen",
      "Westerveld",
      "Zwartewaterland",
      "Ommen",
      "Overijssel",
    ],
    provinces: ["Overijssel", "Drenthe"],
    valueEur: 6_000_000,
    valueBasis: "per year",
    term: "3 years + 3×1-year extensions (max 6), explicitly Single Source",
    endsBy: null,
    status: "held",
    source: "https://www.dutchitleaders.nl/news/183016/protinus-it-wint-aanbesteding-softwarebroker-bij-ssc-ons",
    unverified: "start date not published, so the end year cannot be stated",
  },

  // ---- Held: single buyers -------------------------------------------------
  {
    buyer: "Rotterdam",
    holder: "Protinus IT",
    provinces: ["Zuid-Holland"],
    valueEur: 160_000_000,
    valueBasis: "total",
    term: "2 years + 2×1-year extensions (renewal of a 2020 win, then €100M)",
    endsBy: 2029,
    status: "held",
    source:
      "https://www.computable.nl/2025/04/25/protinus-it-sleept-opnieuw-grote-deal-rotterdam-in-de-wacht/",
    unverified: "exact start/end dates not published; endsBy is the maximum term",
  },
  {
    buyer: "Den Haag",
    holder: "SoftwareOne",
    provinces: ["Zuid-Holland"],
    valueEur: null,
    valueBasis: "total",
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
    provinces: ["Zuid-Holland"],
    valueEur: 40_000_000,
    valueBasis: "total",
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
    provinces: ["Flevoland"],
    valueEur: 20_000_000,
    valueBasis: "total",
    term: "2 years + 2×24-month extensions",
    endsBy: null,
    status: "held",
    source:
      "https://protinus.nl/nieuws/protinus-it-wint-aanbesteding-voor-softwarelevering-aan-gemeente-dronten/",
    unverified: "award date not established, so the end year cannot be stated",
  },
  {
    buyer: "Fryske Marren",
    holder: "Protinus IT",
    provinces: ["Friesland"],
    valueEur: 1_600_000,
    valueBasis: "total",
    term: "4 years (€400k/year), from 1 January 2026",
    endsBy: 2030,
    status: "held",
    source:
      "https://executive-people.nl/690145/de-fryske-marren-gunt-protinus-it-opdracht-levering-software.html",
    unverified: "",
  },
  {
    buyer: "Gouda",
    holder: "Protinus IT",
    provinces: ["Zuid-Holland"],
    valueEur: null,
    valueBasis: "total",
    term: "Standard-software broker with advisory services, listed 2026",
    endsBy: null,
    status: "held",
    source: "https://nl.openprocurements.com/cpv/72268000/",
    unverified: "holder listed on the tender record; no award press release found to confirm",
  },
  {
    buyer: "Drenthe",
    holder: "SoftwareOne",
    provinces: ["Drenthe"],
    valueEur: null,
    valueBasis: "total",
    term: "4 years, awarded October 2025 (renewal); ~1000 workplaces",
    endsBy: 2029,
    status: "held",
    source:
      "https://www.softwareone.com/nl-nl/nieuwsberichten/2025/10/27/softwareone-wint-wederom-software-aanbesteding-provincie-drenthe",
    unverified: "value not disclosed",
  },
  {
    buyer: "Westerkwartier",
    holder: "SoftwareOne",
    provinces: ["Groningen"],
    valueEur: null,
    valueBasis: "total",
    term: "Standard software licences and related services, awarded June 2025",
    endsBy: null,
    status: "held",
    source:
      "https://beleidsradar.nl/documenten/aanbesteding-software-broker-gemeente-westerkwartier-b0b2a91b-7e06-4c6b-b007-9d51bdb2214b",
    unverified: "value and term not published",
  },
  {
    buyer: "Zuidoost Brabant",
    bodyType: "14 decentral public bodies bundled for one tender",
    holder: "SoftwareOne",
    provinces: ["Noord-Brabant"],
    valueEur: null,
    valueBasis: "total",
    term: "14 decentral government bodies, awarded 2022",
    endsBy: null,
    status: "held",
    source: "https://www.softwareone.com/nl-nl/nieuwsberichten/2022/02/11/softwareone-wint-aanbesteding-zuidoost-brabant",
    unverified: "awarded 2022 and likely re-tendered by now; treat as stale",
  },
  {
    buyer: "Stichtse Vecht",
    holder: "Protinus IT",
    provinces: ["Utrecht"],
    valueEur: null,
    valueBasis: "total",
    term: '"EA - Software broker dienstverlening", listed 2021',
    endsBy: null,
    status: "held",
    source: "https://nl.openprocurements.com/supplier/protinus-it/",
    unverified: "listed 2021; may have lapsed or been re-tendered, so treat as stale",
  },
  {
    buyer: "Noaberkracht",
    bodyType: "merged operating organisation for 2 municipalities",
    holder: "Protinus IT",
    covers: ["Dinkelland", "Tubbergen"],
    provinces: ["Overijssel"],
    valueEur: null,
    valueBasis: "total",
    term: '"Softwaremakelaar" for seven Twente municipalities, listed 2020',
    endsBy: null,
    status: "held",
    source: "https://nl.openprocurements.com/supplier/protinus-it/",
    unverified: "listed 2020; may have lapsed or been re-tendered, so treat as stale",
  },

  // ---- Open: nobody holds these yet. This is where CBA can still move. -----
  {
    buyer: "Provincie Utrecht",
    holder: "not yet awarded",
    provinces: ["Utrecht"],
    valueEur: null,
    valueBasis: "total",
    term: "Softwarebroker-dienstverlening: licences, SaaS, implementation, support",
    endsBy: null,
    status: "open",
    closes: "2026-09-25",
    source: "https://nl.openprocurements.com/cpv/72268000/",
    unverified: "value not published",
  },
  {
    buyer: "Nieuwegein",
    holder: "not yet awarded",
    provinces: ["Utrecht"],
    valueEur: null,
    valueBasis: "total",
    term: "Softwarebroker: standard software licences and related services",
    endsBy: null,
    status: "open",
    closes: "2026-09-25",
    source: "https://nl.openprocurements.com/cpv/72268000/",
    unverified: "value not published",
  },
  {
    buyer: "De Wolden Hoogeveen",
    holder: "not yet awarded",
    provinces: ["Drenthe"],
    valueEur: null,
    valueBasis: "total",
    term: '"EA Softwarebroker", announced 24 August 2026',
    endsBy: null,
    status: "open",
    closes: "2026-10-05",
    source: "https://nl.openprocurements.com/cpv/72266000/",
    unverified: "value not published",
  },
  {
    buyer: "ISNV Noord Veluwe",
    bodyType: "shared procurement organisation for 2 municipalities",
    holder: "not yet awarded",
    covers: ["Putten", "Bunschoten"],
    provinces: ["Gelderland"],
    valueEur: null,
    valueBasis: "total",
    term: "Broker Standaardsoftware: purchase, delivery, management of installed base",
    endsBy: null,
    status: "open",
    closes: "2026-10-28",
    source: "https://nl.openprocurements.com/cpv/72268000/",
    unverified: "value not published",
  },
  {
    buyer: "Leeuwarden",
    holder: "not yet awarded",
    provinces: ["Friesland"],
    valueEur: null,
    valueBasis: "total",
    term: "European procedure for a single supplier, announced 18 November 2025",
    endsBy: null,
    status: "open",
    source: "https://nl.openprocurements.com/buyer/gemeente-leeuwarden/",
    unverified: "bidders reported as Bechtle and SoftwareONE; no award found, no close date",
  },
];

/**
 * The broker holding a buyer's software, or null when none is on file.
 * Checks the contract's own name and every member of a collective, so a tender
 * from Dordrecht resolves through Drechtsteden.
 *
 * A null result means "no contract on file" — NOT "sells direct". Coverage is
 * hand-curated from trade press and is deliberately incomplete.
 */
export function brokerFor(buyer: string | null): BrokerContract | null {
  if (!buyer) return null;
  const b = buyer.toLowerCase();
  return (
    BROKER_CONTRACTS.find(
      (c) =>
        b.includes(c.buyer.toLowerCase()) ||
        (c.covers ?? []).some((m) => b.includes(m.toLowerCase()))
    ) ?? null
  );
}

/**
 * Province → the holders with a HELD contract touching it, deduped.
 * Open tenders deliberately do not tint a province: nobody holds them.
 */
export function holdersByProvince(): Map<string, BrokerHolder[]> {
  const m = new Map<string, Set<BrokerHolder>>();
  for (const c of BROKER_CONTRACTS) {
    if (c.status !== "held") continue;
    for (const p of c.provinces) {
      const set = m.get(p) ?? new Set<BrokerHolder>();
      set.add(c.holder);
      m.set(p, set);
    }
  }
  return new Map([...m].map(([p, s]) => [p, [...s]]));
}

/** Contracts touching a province, for tooltips. */
export function contractsInProvince(province: string): BrokerContract[] {
  return BROKER_CONTRACTS.filter(
    (c) => c.status === "held" && c.provinces.includes(province)
  );
}

export function formatValue(c: BrokerContract): string {
  if (c.valueEur === null) return "value not published";
  const n =
    c.valueEur >= 1_000_000
      ? `€${Math.round(c.valueEur / 1_000_000)}M`
      : `€${Math.round(c.valueEur / 1000)}k`;
  return c.valueBasis === "per year" ? `${n}/yr` : n;
}

/** How many buyers a contract actually covers — collectives count their members. */
export function buyerCount(c: BrokerContract): number {
  return 1 + (c.covers?.length ?? 0);
}
