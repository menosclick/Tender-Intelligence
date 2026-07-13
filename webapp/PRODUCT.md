# Product

## Register

product

## Users

Bid managers at CBA Benelux (ManageEngine premium partner, NL). Primary user today: Derson (derson@cbabenelux.com). Context: bright office, laptop, mid-morning after the 09:00 daily scrape. The job: scan roughly ten scored open tenders, decide which deserve attention, read the AI intelligence on one, move it across the bid board, and record outcomes so the scorer learns. Sessions are short and repeated daily; the app replaces an email digest, so scanability beats exploration.

## Product Purpose

Internal tender-intelligence dashboard on top of a live n8n scraping + AI scoring pipeline. It ranks Dutch public procurement tenders (TenderNed) by fit for ManageEngine products, explains each score, hosts a bid pipeline kanban, and closes a human-approved learning loop (feedback → scoring suggestions → overrides). Success: CBA opens it every morning instead of the email, trusts the scores, and the learning loop visibly improves relevance. It is also MenosClick's #1 live portfolio demo, so craft is part of the pitch.

## Brand Personality

Institutional precision. Calm, factual, quietly confident. The tool of a procurement professional, not a startup dashboard. Three words: precise, sober, trustworthy. UI chrome in English; tender content stays Dutch and is never translated.

## Anti-references

- Marketing-site energy: hero sections, gradients, oversized numbers celebrating themselves (the build brief says "Think Linear/Notion, not a landing page").
- Generic AI-admin-template look: default font stack, untinted grays, identical stat-card grids, emoji as icons.
- Dark "data tool" cosplay. Users read Dutch prose in a bright office; the surface stays light.
- Anything implying traction or metrics that do not exist (public-proof rule).

## Design Principles

1. The score is the product: label + score + deadline must be readable in a half-second scan on every surface where a tender appears, with one consistent visual vocabulary.
2. Density with hierarchy: dense tables and packed detail pages are correct here, but weight and scale contrast do the organizing, not boxes around everything.
3. Empty is normal: many pipeline fields are NULL by design; sections hide rather than render blank, and empty states teach the loop (feedback → suggestions → overrides).
4. Trust through provenance: AI claims sit next to their source (quotes from tender documents, "generated" timestamps, confidence). Never dress inference up as fact.
5. Print is a first-class output: Reports doubles as the weekly artifact for management; screens must degrade cleanly to paper.

## Accessibility & Inclusion

WCAG AA contrast on text and interactive states. Urgency and label semantics never rely on color alone (always paired with text). Full keyboard operability with visible focus rings; the kanban keeps a non-drag path for every mutation. Respect prefers-reduced-motion; motion is 150–250 ms state feedback only.
