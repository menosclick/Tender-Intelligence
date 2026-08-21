# Design

Visual system for the CBA Tender Intelligence webapp. Tokens live in `src/app/globals.css` under `@theme`; use the Tailwind utilities they generate (`bg-canvas`, `text-fg-mid`, `border-line`, `bg-rail`, ...). Never reintroduce raw `neutral-*` grays or hex colors in components.

## Theme

Light, always. Users read Dutch procurement prose in a bright office. One committed color surface: the deep teal-ink navigation rail. Everything else is Restrained: teal-tinted neutrals plus one accent used for primary actions, selection, and state only.

## Colors (OKLCH, brand hue ~195)

| Token | Value | Use |
|---|---|---|
| `canvas` | `oklch(0.977 0.004 195)` | page background |
| `surface` | `oklch(0.995 0.002 195)` | tables, cards, inputs |
| `sunken` | `oklch(0.955 0.006 195)` | board columns, quotes, wells |
| `line` / `line-strong` | `oklch(0.90 0.008 195)` / `oklch(0.84 0.012 195)` | borders |
| `fg` / `fg-mid` / `fg-soft` | `oklch(0.26 0.02 210)` / `oklch(0.45 0.015 210)` / `oklch(0.55 0.012 210)` | text hierarchy |
| `rail` / `rail-hover` / `rail-active` | `oklch(0.27 0.03 210)` / `oklch(0.33 0.03 210)` / `oklch(0.42 0.06 195)` | sidebar |
| `rail-fg` / `rail-fg-soft` | `oklch(0.93 0.006 195)` / `oklch(0.72 0.015 200)` | sidebar text |
| `accent` / `accent-strong` | `oklch(0.48 0.08 195)` / `oklch(0.42 0.08 195)` | primary actions, focus |
| `accent-soft` / `accent-fg` | `oklch(0.94 0.025 195)` / `oklch(0.36 0.07 195)` | tinted fills + text on them |
| `hot` / `hot-soft` | `oklch(0.44 0.16 25)` / `oklch(0.95 0.025 25)` | Hot label, danger text |
| `warm` / `warm-soft` | `oklch(0.47 0.11 70)` / `oklch(0.95 0.04 85)` | Warm label, warnings |
| `cold` / `cold-soft` | `oklch(0.45 0.02 240)` / `oklch(0.93 0.008 240)` | Cold label |
| `ok` / `ok-soft` | `oklch(0.42 0.10 150)` / `oklch(0.95 0.03 150)` | success, Won, bid verdict |

Rules: no pure `#fff`/`#000`; urgency and labels always pair color with text; full borders or background tints, never colored left-edge stripes.

## Typography

- **IBM Plex Sans** (UI + prose), **IBM Plex Mono** (CPV codes, IDs, technical fragments). Loaded via `next/font`, exposed as `--font-sans` / `--font-mono`.
- Fixed rem scale: 12 micro-labels (uppercase, tracked), 13 table data, 14 body, 16 section headings, 20 page titles, 24 detail titles. Weight contrast (400/500/600) does the hierarchy work.
- All numerals in data contexts are `tabular-nums`. Prose capped at `max-w-prose`.

## Components

- **Label chip**: colored dot + text on soft tint, radius-full, 12px semibold. Same component everywhere a tender appears.
- **Score**: 600-weight tabular numeral, optionally over a 36px micro-meter (2px track). Never a gauge.
- **Buttons**: primary = accent fill, white text; secondary = surface + line border; quiet = text-only accent-fg. Radius 8. All have hover, focus-visible ring (2px accent/40), disabled 50%.
- **Inputs**: surface bg, line border, radius 8, focus = accent border + ring. Labels 12px semibold fg-mid.
- **Tables**: surface container with line border radius 12 (`rounded-xl`, same as cards); 12px uppercase tracked headers in fg-soft; row hover `sunken`; 13px cells. Wide tables scroll inside a `relative overflow-x-auto` wrapper with a `min-w` on the table — never squeeze columns.
- **Banners** (health, denied, red flags): soft tint bg + matching full border + text color, radius 8. No icons-as-emoji anywhere; inline SVG, stroke 1.5, 16px.
- **Empty states**: teach the next action, never just "no data".

## Layout

Fixed 232px rail, content column max-w per screen (tables 64rem, prose/detail 44rem). Section rhythm through spacing steps (4/8/12/16/24/32), not uniform padding. Prose sections on the detail page sit directly on canvas with headings and rules; boxes are reserved for special blocks (verdict, bid pack, red flags).

## Motion

150–200 ms, `ease-out`, state feedback only (hover, drag-over, disclosure). No page-load choreography. Respect `prefers-reduced-motion`.
