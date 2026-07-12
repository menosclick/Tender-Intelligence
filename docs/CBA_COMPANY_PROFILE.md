# CBA Benelux — Company profile for bid/no-bid verdicts

> Consumed by the bid/no-bid verdict engine: every tender eligibility requirement is checked
> against THIS file. Sources: "CBA legal - procurement" document set (KvK extracts, ISO
> certificates, SLA docs), read and extracted 2026-07-07. Items marked **`? DERSON`** are
> not in the documents and still need his answer — the engine treats them as "unknown,
> verify manually", never as a guess.

## 1. Legal & registration (source: KvK extracts, June 2026)

- **Statutory name:** Computer Business Applications B.V.
- **Trade names:** CBABenelux, CBA IT Tools, Cloud Business Applications
- **KvK:** 34109894 · **RSIN:** 807948810 · Legal form: B.V., statutory seat Amsterdam
- **Founded:** 13-01-1999 (27 years of trading history — passes any "minimum X years" gate)
- **Address:** Deltastraat 54, 1823 DP Alkmaar (KvK); ISO certificate also lists Entrada 234
  Amsterdam + Prof. van der Waalsstraat 2 Alkmaar as operating locations
- **Web:** www.cbaholland.com · info@cbaholland.com
- **SBI:** 62100 (software design/development), 85591 (corporate training)
- **Group structure:** 100% subsidiary of CBA Holding B.V. (KvK 88832775, Alkmaar, since
  04-2023), which is jointly directed by Tyc Beheer B.V. and Van Raai Enterprises B.V.
- **UBOs (UBO register):** Patryk Marcin Tyc (25–50%) and Marc Vincent van Raai (25–50%),
  both Dutch nationals. No shielded UBOs — clean for Wwft/integrity checks.
- **Related entity in doc set:** Apora B.V. (KvK 70502544, Schiedam, financial holding /
  software projects). **`? DERSON`**: role of Apora in the group — does it employ staff?
- **Annual accounts:** FY2024 filed 05-11-2025 (deposits current — passes filing checks).
- NOTE: KvK lists "werkzame personen: 0" on the B.V. — payroll appears to sit elsewhere in
  the group. Org chart shows **~13 people**. **`? DERSON`**: confirm FTE count and which
  entity employs them (tenders ask for "gemiddeld personeelsbestand").

## 2. Financials

- Revenue FY2023 / FY2024 / FY2025: **`? DERSON`** (approximate is fine)
- Professional liability (beroepsaansprakelijkheid) insured amount: **`? DERSON`**
- General liability (bedrijfsaansprakelijkheid) insured amount: **`? DERSON`**

## 3. Certifications — CBA'S OWN (what eligibility criteria check)

- **ISO/IEC 27001:2022 — YES, CBA's own.** Holder: Computer Business Applications B.V.
  Certificate H28KKGAU20260617NLDIS1Q6 (Guardian Assessment, UAF-accredited), initial
  registration 17-06-2026, **valid to 16-06-2029**. Scope: IT & cybersecurity services incl.
  IT operations, Managed Security Services (NOC/SOC/MDR), managed infrastructure & private
  hosting, vulnerability management, disaster recovery, OT security, pentesting, GRC SaaS;
  Azure-hosted virtual IT environment. Documented ISMS (CBA-ISMS V1.0 + ISMS Policy on file).
- ISO 9001: **not found for CBA itself** (only the vendor's — see §4). **`? DERSON`**: confirm.
- NEN 7510: **not found**. **`? DERSON`**: confirm (matters for zorg tenders).
- CAVEAT for the engine: the certificate is issued by Guardian Assessment (UAF accreditation).
  Some tenders require certification by a **RvA-accredited** (or EA-MLA) body — flag this as
  a verify-item whenever a tender specifies the accreditation body.

## 4. Certifications — VENDOR (Zoho/ManageEngine; answer solution & hosting requirements,
NOT tenderer eligibility)

On file, current: ISO 27001:2022 (BSI IS 642819, valid to 21-08-2028), ISO 9001, ISO 22301
(business continuity), ISO 27017 (cloud security), ISO 27018 (cloud privacy), ISO 27701
(privacy/PIMS), SOC 1 Type 2, SOC 2 Type 2 (+HIPAA), GoBD (Germany).

- **EU data residency:** ManageEngine cloud EU data centers = Digital Realty Schiphol-Rijk
  (NL) + Equinix Dublin (IE) — named on the vendor ISO 27001. Answers "data must stay in
  EU/EER" requirements for cloud deployments; on-premises deployment available for stricter
  demands (data never leaves the buyer).
- **Cloud SLA (ServiceDesk Plus Cloud, applies to Zoho cloud services):** 99.9% monthly
  uptime commitment with service credits (7/15/30 days); Sev-1: response 1h, resolution/
  workaround 8h; support tiers Classic (8×5, free) and Premium (24×5, paid, 3h response,
  dedicated account manager).

## 5. ManageEngine partnership

- Channel-focused organization (org chart: dedicated Channel team — MSP + Resellers).
- Partner tier: **"premium partner van ManageEngine voor Nederland"** — CBA's own wording
  in the signed OM aanbiedingsbrief (Feb 2026). Local implementation, support and Customer
  Success Management. **`? DERSON`**: certified engineers per product line.
- **Vendor authorization (proven practice):** Zoho Corporation B.V. issues per-tender
  Manufacturer Authorization Forms confirming CBA Benelux as authorized reseller + support
  partner for ManageEngine in the EU (example on file: KNMI, signed Sridhar Iyengar,
  Director Zoho Corporation B.V., 23-06-2026, 1-year validity). The engine can treat
  "vendor authorization required" requirements as PASS (obtainable per tender).
- Product coverage by named specialists (org chart): ITSM (Rithu Barkavi), UEM (Gokul +
  Gillian Beke), IAM/SIEM/PAM (Brian Pauelsen, Uma), Cybersecurity (Andre Schelleman),
  Licensing (Victor Degenaars), FSO (Prasanna, Gillian Beke). Sales director: Ludo Bergkamp.
  Managing director: Patrick (Patryk Tyc). Resellers channel: Derson Ramos.
- Additional operating address used in bids: Kingsfordweg 151, 1043 GR Amsterdam.

## 6. Delivery capability

- Per CBA's own ISO 27001 scope: IT operations, managed security services (NOC/SOC/MDR),
  managed infrastructure & private hosting, vulnerability management, disaster recovery,
  OT security, pentesting, GRC SaaS — i.e. CBA can credibly offer managed/hosted variants,
  not only license resale + implementation.
- Training: SBI 85591 registered (corporate training) — supports "opleiding" requirements.
  Proven training model (KNMI PvA): train-de-trainer, role-based curricula, ManageEngine
  Academy e-learning, custom work instructions in the built-in knowledge base.
- **CBA's own support SLAs (from KNMI bid, June 2026):** two tiers —
  **Zilver**: business days 09:00–17:00, 99.9% uptime/month, P1 assigned ≤4h & resolved ≤8h,
  data-loss guarantee ≤4h, monthly SLA reports. **Goud** (surcharge): 24×7, P1 assigned ≤1h &
  resolved ≤4h, data-loss ≤1h. Remote support included in license cost; on-site available at
  the consultancy day rate.
- **Delivery model (proven, KNMI PvA):** PRINCE2-light, phased with formal gate decisions,
  big-bang cutover with open-ticket migration, "Voordoen–Samen Doen–Zelf Doen" enablement,
  RACI split, risk register. Typical ITSM migration: ~60 consultant-days across 12 weeks
  (team: project lead + implementation consultant + integration specialist).
- **Proven integrations:** e-mail, SSO/SAML, TOPdesk, ServiceNow, Ultimo, Salesforce,
  PowerBI, Jira (offered fixed-price in the KNMI bid).
- **ARBIT-2022:** CBA formally accepts the Model Verwerkersovereenkomst ARBIT-2022 (signed
  declaration on file, Patrick Tyc, 23-06-2026) — the standard rijksoverheid contract gate.
- Deployment models: cloud (ManageEngine EU DCs), on-premises, private hosting (CBA, per
  ISO scope, on Azure).
- **Deployment models — both proven in real bids:** SDP **Cloud** (KNMI bid, EU DCs) and
  SDP **fully On-Premises** on the buyer's own infrastructure incl. on-prem AI features
  (OM bid — buyer hosts, updates and manages; meets "no public cloud" knock-outs).
- **Indicative pricing (real bids, 2026):** ITSM migration ~€90,000 fixed (migration €7.5k,
  implementation incl. PM €60k, training €7.5k, 6 integrations €15k); licenses cloud
  ~€101k/yr (~400 agents, 3,000 CIs), on-prem ~€160/behandelaar/yr at 600 seats; rates:
  installation €125/h, senior adviseur €150/h, medior €110/h; training ~€2,700 pp (2 days);
  read-only users free; support & maintenance included in license fees.

## 7. Reference projects — **`? DERSON`** still the biggest gap for WON references

Eligibility typically demands 1–3 comparable references from the last 3 years. Aim for 3–6,
public sector first: client, sector, what was delivered, approx value, year, contactable?

| # | Client | Sector | Delivered | Value | Year | Contactable? |
|---|--------|--------|-----------|-------|------|--------------|
| 1 | ? | | | | | |
| 2 | ? | | | | | |
| 3 | ? | | | | | |

**Product/deployment references used in real bids (signed OM aanbiedingsbrief, Feb 2026):**
- ManageEngine ServiceDesk Plus already in use WITHIN Openbaar Ministerie: Rijksrecherche
  (project Huisvesting) and CFA GVKA — named reference contact: Gijs van der Valk, via
  Licentiemanagement@Om.nl
- Benelux SDP deployments: Bol.com, Logicall/VCK Logistics, Sala Group (NCOI, LOI, NTI),
  UZA Ziekenhuis Antwerpen
- Product credential: ServiceDesk Plus is in Gartner's Magic Quadrant for AI in ITSM
  (per the same letter). **`? DERSON`**: which of these were CBA-delivered implementations
  (claimable as CBA references) vs. product installs.

**Recent bid experience (outcomes pending — ASK DERSON, award dates have passed):**
1. KNMI / Ministerie van IenW (rijksoverheid) — ITSM migration TOPdesk → SDP **Cloud**,
   6 integrations, train-de-trainer; submitted 23-06-2026 via ProtinusIT (FU 31218136);
   ~€90k project + ~€101k/yr licenses. PvE: 101 requirements answered.
2. Openbaar Ministerie / Min. J&V (rijksoverheid) — Service Management System, **fully
   On-Premises** (8,600 end users, 600 handlers, IT+HR+Facilities ESM); DIRECT bid as
   EASP2020-2 framework contractor (FU 10600140711, T197205); submitted 20/23-02-2026,
   award decision was due 04-03-2026; €160/behandelaar/yr (600 → ~€96k/yr), 3-yr fixed;
   335-row PvEeW answered incl. all knock-outs "Ja". ARBIT-2018 applies, escrow included.
   Both answer sets on file as the reusable answer library (cloud + on-premises variants).

## 8. Framework agreements

- EASP2020-2 (Standaard Software en aanverwante Dienstverlening): **CONFIRMED framework
  contractor** — bid the OM mini-competition directly under it in Feb 2026 (participation
  is limited to framework contractors, so a direct bid proves membership).
- EA2023: NOT a direct party — route via resellers (SoftwareOne / ProtinusIT / Dustin),
  per the routing engine's configured rules. **Proven in practice:** the KNMI mini-
  competition was bid via ProtinusIT (June 2026) — the rijksoverheid-via-ProtinusIT route
  works commercially.
- Other frameworks: **`? DERSON`**

## 9. Hard boundaries — **`? DERSON`**

- Minimum deal size worth bidding (€):
- Maximum credible contract size (€ / FTE constraint):
- Sectors or requirement types to always avoid:
- Geography: Netherlands (per Cathrine 2026-07-07: NL focus only for now).

---
*Sources on file: `Tenderapp/CBA legal - procurement/` — KvK extracts (CBA B.V., CBA Holding,
UBO register, Apora), CBA ISO 27001 certificate, CBA-ISMS V1.0 + ISMS Policy, org chart,
ManageEngine SLA details, Zoho certificate stack (ISO 27001/9001/22301/27017/27018/27701,
SOC 1/2, GoBD). Update this file when certs renew or references change — verdicts follow it.*
