# Svach AI HQ — Design System

Design authority is `https://svach.in` (`Claude.md.txt`). Every token below except the
"HQ-specific usage" notes was pulled directly from the live site's computed styles —
not guessed, not inferred from screenshots. HQ should read as the operational
extension of the site, not a reskin of a generic admin template.

## Typography

**Two typefaces, deliberately paired**: a serif display face for headings, a sans-serif
for everything functional. This is the site's actual pairing, not a default choice.

- **Display — Fraunces** (serif). Every heading, from H1 down to small card titles,
  uses Fraunces at weight 600. It's what gives the site its "premium, not generic SaaS"
  feel — swapping it for a sans-serif display face would flatten that distinction.
- **Body/UI — Inter** (sans-serif). Paragraphs, buttons, nav, labels, form fields —
  anything functional.
- **Monospace** — not used on the marketing site (no code/data display there). For HQ's
  own data-dense surfaces (table cells, timestamps, DB-adjacent labels), use a system
  monospace stack (`ui-monospace, "Cascadia Code", "SF Mono", Consolas, monospace`) —
  consistent with the "engineering blueprint" precedent already used in
  `DATABASE_SCHEMA.md`'s own presentation.

### Type Scale (measured)

| Role | Font | Size | Weight | Line Height | Letter Spacing |
|---|---|---|---|---|---|
| H1 | Fraunces | 36px | 600 | 37.8px (1.05) | -0.72px |
| H2 | Fraunces | 30px | 600 | 37.5px (1.25) | -0.6px |
| H3 (incl. card titles) | Fraunces | 16px | 600 | 24px (1.5) | -0.32px |
| Lead paragraph | Inter | 18px | 400 | 29.25px (1.625) | normal |
| Body | Inter | 16px | 400 | 24px (1.5) | normal |
| Button / UI label | Inter | 14px | 600 | 20px | normal |
| Nav link (active / inactive) | Inter | 14px | 600 / 500 | — | normal |
| Eyebrow / section label | Inter | 12px | 600 | — | **1.68px**, uppercase |

The eyebrow's wide tracking (1.68px on 12px text — unusually wide) is a signature
detail, not an accident; keep it that wide in HQ's own section labels rather than
rounding it down to a more "default" letter-spacing.

**HQ-specific usage**: apply this scale to HQ's own headings/labels directly. HQ has
denser, more data-heavy screens than the marketing site (tables, pipeline boards,
schema-like detail panels) — where the site has no equivalent component, follow the H3
card-title treatment (16px/600 Fraunces) for HQ card/section titles, and Inter at the
body/label sizes above for everything else. Don't invent a third typeface for HQ.

## Color

Full palette confirmed directly by the Owner (cross-checked against the site's live
computed `oklch()` values — consistent, no conflicts found).

**Brand**
| Purpose | Name | Hex |
|---|---|---|
| Primary Brand Blue | Electric Blue | `#2563EB` |
| Secondary Blue | Bright Azure | `#3B82F6` |
| Cyan Accent | Neon Cyan | `#06B6D4` |
| Premium Cyan Glow | Aqua | `#22D3EE` |

**Backgrounds**
| Purpose | Name | Hex |
|---|---|---|
| Primary Background | Deep Black | `#020617` |
| Secondary Background | Midnight Blue | `#0F172A` |
| Card Background | Dark Slate | `#111827` |
| Glass Layer | Rich Navy | `#1E293B` |

The live site alternates section backgrounds between its base background and a
slightly lighter "muted surface" tone for rhythm between sections — worth the same
treatment on long HQ pages (e.g. Knowledge, Settings) rather than one flat background
the whole way down.

**Text**: Primary `#FFFFFF` · Secondary `#CBD5E1` · Muted `#94A3B8` · Disabled `#64748B`

**Status**: Success `#10B981` · Warning `#F59E0B` · Error `#EF4444` · Info `#0EA5E9`

**Charts**: Blue `#3B82F6` · Cyan `#22D3EE` · Purple `#8B5CF6` · Pink `#EC4899` ·
Green `#10B981` · Orange `#F59E0B`

**Signature rainbow hover gradient** (90deg): `#3B82F6 → #06B6D4 → #8B5CF6 → #EC4899 → #3B82F6`

**Aurora hero gradient**: `#020617 → #0F172A → #1E3A8A → #2563EB`

**HQ-specific usage — use these sparingly, not throughout**: the rainbow gradient and
aurora background are the site's highest-energy signature moves, right for a marketing
hero, wrong for a tool people operate all day. Reserve them for OOA branding and a
handful of key CTAs in HQ; everywhere else, stay on the base palette so HQ reads as
"calm" and "enterprise" (`PRODUCT_VISION.md`'s own design principles), not visually loud.

## Spacing & Layout

- **Container max-width**: `1280px` (measured) for standard content width; `768px` for
  narrower single-column content (e.g. long-form text, forms).
- **Section vertical padding**: `72px` top and bottom (measured) between major page
  sections on the marketing site. HQ's own pages are denser and shouldn't copy this
  exact rhythm section-for-section, but it's the right scale for spacing between major
  Dashboard regions (e.g. between the System Health block and the Action Queue).
- **Card padding**: `24px` (measured — Tailwind's `p-6`).
- **Radius scale** (measured):
  - Cards / buttons: `16px`
  - Pills / nav links / small badges: `14px`
  - Use these two values consistently rather than an arbitrary third radius — the site
    doesn't use more than two.

## Surfaces — Glassmorphism

The card recipe, measured directly from a live card element:

```css
background: rgba(15, 23, 42, 0.55);   /* Card Background, translucent */
border: 1px solid rgba(255, 255, 255, 0.08);
border-radius: 16px;
padding: 24px;
backdrop-filter: blur(20px);
box-shadow:
  inset 0 1px 0 rgba(255, 255, 255, 0.06),   /* top inset highlight */
  0 18px 40px -24px rgba(0, 0, 0, 0.9);      /* soft ambient drop shadow */
```

This is the one visual signature worth reusing everywhere in HQ — every card, panel,
and modal should use this exact recipe, not a close approximation, so the whole
product reads as one system.

## Motion (measured)

- **Easing**: `cubic-bezier(0.4, 0, 0.2, 1)` — used consistently across buttons and
  card hovers. This is Tailwind's standard `ease-in-out`; no custom easing curve to
  reproduce.
- **Button hover/interaction**: `300ms`.
- **Card hover** (box-shadow, border-color, transform together): `220ms`.
- No scroll-triggered or page-load animation sequences were found on the marketing
  site's core content — motion here is restrained, interaction-driven, not ambient.
  Match that restraint in HQ: hover/press feedback, not decorative animation.

## Buttons

- Padding `10px 20px`, radius `16px`, label `14px/600 Inter`.
- Primary button background/hover use the Brand Blue tokens above (`#2563EB` →
  `#3B82F6` on hover), per the confirmed palette.

## Component Mapping (shadcn/ui)

Build against shadcn/ui primitives, themed with the tokens above rather than shadcn's
defaults:

| Token role | shadcn/Tailwind mechanism |
|---|---|
| Color palette | CSS custom properties on `:root`, mapped into `tailwind.config` theme colors — not hardcoded hex in components |
| Card | `Card` component, restyled with the glassmorphism recipe above |
| Type scale | Tailwind `fontSize` theme extension matching the measured scale exactly |
| Radius | Tailwind `borderRadius` theme: `card`/`button` → `16px`, `pill` → `14px` |
| Charts | Recharts, colored from the Charts palette above — see `dataviz` conventions for legend/axis/tooltip treatment |
| Icons | Lucide, sized/colored per the Icon tokens (Primary `#3B82F6`, Secondary `#22D3EE`, Muted `#94A3B8`) |

## Open Items

- **Fraunces licensing/hosting**: it's a Google Font (open license) — self-host it in
  the Vite app rather than linking Google's CDN at runtime, consistent with keeping
  external runtime dependencies minimal.
- **Dark-only, by design**: the site and the confirmed palette are dark-native; HQ
  should stay dark-only in Phase 1 rather than building a light theme nobody asked for
  — matches `Claude.md.txt`'s "Dark First" direction.
