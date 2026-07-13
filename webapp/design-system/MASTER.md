# Design System Master — CBA Tender Intelligence

> Retrieval note for agents (ui-ux-pro-max hierarchical pattern): this file is the
> entry point, but the **source of truth lives in two sibling docs**. Read them
> before generating any UI code. Page-specific overrides would live in
> `design-system/pages/<page>.md`; none exist yet, the global system covers all screens.

## Source of truth

- `../PRODUCT.md` — register (product), users, brand personality, anti-references, design principles, accessibility bar.
- `../DESIGN.md` — visual system: OKLCH tokens (defined in `src/app/globals.css` under `@theme`), IBM Plex Sans/Mono, component vocabulary (`src/lib/ui.tsx`), layout and motion rules.

Never reintroduce raw Tailwind palette colors (`neutral-*`, `slate-*`, hex) in components; use the theme tokens (`bg-canvas`, `text-fg-mid`, `border-line`, `bg-rail`, ...).

## ui-ux-pro-max audit (2026-07-13)

Generated recommendation for "tender intelligence procurement dashboard" was the
generic Data-Dense Dashboard template (navy slate `#0F172A` + blue CTA, Fira
Code/Fira Sans). **Decision: rejected.** The shipped custom system (teal-tinted
OKLCH neutrals, teal ink rail, IBM Plex) is client-approved, in production, AA
verified, and more distinctive than the template. Do not swap palettes based on
this tool's defaults; use its UX checklists instead.

Checklist deltas found and fixed:

- Tailwind v4 preflight leaves buttons with `cursor: default` → global
  `button:not(:disabled) { cursor: pointer }` rule added in `globals.css`.

Known accepted gaps (deliberate, do not "fix" without a gate):

- No mobile/responsive pass (fixed 232px rail; desktop tool). Gated on evidence
  CBA opens the app on phones — see M5 in
  `02_CLIENTS/cba-benelux/plans/2026-07-13-webapp-mejora.md` (Derson's Brain).
- No dark mode (deliberate: bright-office daytime tool, light theme committed).
