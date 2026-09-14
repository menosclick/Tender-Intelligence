// Solution-domain classification (ManageEngine portfolio view).
// Presentation-layer: derived from title + recommended products + the keyword
// matches that surfaced the tender.
//
// The product the fit engine actually recommends is the strongest evidence of
// the domain — stronger than a word in a Dutch title. Counting raw pattern hits
// equally let generic title words outvote it: #7130 recommends ServiceDesk Plus
// first, but "digitale werkplek" in its title scored UEM higher, and six
// ServiceDesk Plus tenders were reading as anything but ITSM (Derson,
// 2026-09-14: "there should be more ITSM I guess" — he was right).
// Product matches are therefore weighted, and ties resolve by the order below.
const PRODUCT_DOMAIN: { domain: string; products: string[] }[] = [
  { domain: "PAM", products: ["pam360", "password manager pro", "key manager"] },
  { domain: "IAM", products: ["admanager", "adaudit", "adselfservice", "identity360", "m365 manager"] },
  { domain: "ITSM", products: ["servicedesk plus", "servicedesk", "analyticsplus", "asset explorer"] },
  { domain: "Security", products: ["log360", "eventlog analyzer", "vulnerability manager", "firewall analyzer", "datasecurity"] },
  { domain: "ITOM", products: ["opmanager", "site24x7", "applications manager", "netflow", "network configuration"] },
  { domain: "UEM", products: ["endpoint central", "patch manager", "mobile device manager", "remote access plus"] },
];

// A recommended product is worth this many title/keyword hits.
const PRODUCT_WEIGHT = 3;

const DOMAIN_RULES: { domain: string; patterns: string[] }[] = [
  {
    domain: "PAM",
    patterns: [
      "pam", "privileged", "wachtwoordkluis", "wachtwoordbeheer", "password vault",
      "password manag", "secret management", "pam360", "bevoorrechte toegang",
    ],
  },
  {
    domain: "IAM",
    patterns: [
      "identity", "iam", "iga", "gebruikersbeheer", "toegangsbeheer",
      "active directory", "ad audit", "adaudit", "admanager", "access management",
    ],
  },
  {
    domain: "ITSM",
    patterns: [
      "itsm", "servicedesk", "service desk", "helpdesk", "help desk", "itil",
      "service management", "servicemanagement", "incidentbeheer", "wijzigingsbeheer",
      "cmdb", "topdesk", "meldingenbeheer", "esm",
    ],
  },
  {
    domain: "Security",
    patterns: [
      "siem", "soc", "log360", "security", "beveiliging", "kwetsbaarheid",
      "vulnerability", "cyber", "gegevensbescherming", "awareness",
    ],
  },
  {
    domain: "ITOM",
    patterns: [
      "itom", "monitoring", "opmanager", "netwerkbeheer", "netwerk", "network",
      "observability", "apm", "infrastructuur", "uptime", "noc", "systeembeheer",
    ],
  },
  {
    domain: "UEM",
    patterns: [
      "endpoint", "mdm", "mobile device", "patch", "uem", "digitale werkplek",
      "werkplek", "apparaatbeheer", "device management",
    ],
  },
];

// Derson's core portfolio domains — always shown on the dashboard, even at 0.
export const CORE_DOMAINS = ["ITSM", "ITOM", "IAM", "PAM"];

/**
 * @param texts  free text — title, keyword matches, description fragments
 * @param products  recommended ManageEngine products, weighted far higher:
 *                  the fit engine named them deliberately, a title word is
 *                  incidental. Pass them here, not folded into `texts`.
 */
export function classifyDomain(
  texts: (string | null | undefined)[],
  products: (string | null | undefined)[] = []
): string {
  const t = texts.filter(Boolean).join(" ").toLowerCase();
  const p = products.filter(Boolean).join(" ").toLowerCase();
  let best = "Other";
  let bestScore = 0;
  let bestTextHits = 0;
  for (const rule of DOMAIN_RULES) {
    const textHits = rule.patterns.filter((x) => t.includes(x)).length;
    const productHits = p
      ? (PRODUCT_DOMAIN.find((d) => d.domain === rule.domain)?.products ?? []).filter((x) =>
          p.includes(x)
        ).length
      : 0;
    const score = textHits + productHits * PRODUCT_WEIGHT;
    // On a tie the buyer's own words win, because they describe what is being
    // bought while the product is only what CBA would answer with. Van Hall
    // Larenstein's "Identity & Access Managementsysteem" tied 3-3 between IAM
    // (three text hits) and PAM (one PAM360 recommendation) and was reading as
    // PAM purely because PAM sits earlier in DOMAIN_RULES.
    if (score > bestScore || (score === bestScore && score > 0 && textHits > bestTextHits)) {
      best = rule.domain;
      bestScore = score;
      bestTextHits = textHits;
    }
  }
  return best;
}
