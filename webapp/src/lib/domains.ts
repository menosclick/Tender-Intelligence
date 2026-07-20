// Solution-domain classification (ManageEngine portfolio view).
// Presentation-layer: derived from title + recommended products + the keyword
// matches that surfaced the tender. Highest hit-count wins; ties resolve by
// the order below (more specific domains first).
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

export function classifyDomain(texts: (string | null | undefined)[]): string {
  const t = texts.filter(Boolean).join(" ").toLowerCase();
  let best = "Other";
  let bestHits = 0;
  for (const rule of DOMAIN_RULES) {
    const hits = rule.patterns.filter((p) => t.includes(p)).length;
    if (hits > bestHits) {
      best = rule.domain;
      bestHits = hits;
    }
  }
  return best;
}
