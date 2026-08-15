# Svach AI HQ — UI/UX Guidelines

Builds on `DESIGN_SYSTEM.md`'s tokens. This document covers *how those tokens get used*
— interaction patterns, composition patterns, and state handling — observed directly
from svach.in and its current work-in-progress build, then adapted for HQ's denser,
daily-use context.

## Composition Patterns (observed on svach.in)

- **Section rhythm**: uppercase eyebrow label (cyan, wide tracking, per
  `DESIGN_SYSTEM.md`'s type scale) → large Fraunces headline → one supporting Inter
  paragraph. Repeats consistently section after section — this rhythm is the site's
  main structural device, not each section inventing its own layout.
- **Two card patterns, used for different content**:
  - **Feature grid** (e.g. the six technology-ecosystem cards): 2-column grid, each
    card = small icon in a colored circle badge + bold Fraunces title + one muted
    description line. Compact, scannable, for parallel items.
  - **Narrative cards** (e.g. the four business-challenge cards): full-width, stacked
    single-column, bold Fraunces subheading + a full paragraph. Used when the content
    needs room to make an argument, not just label a feature.
  - Don't mix these — a grid card with a full paragraph, or a narrative card cramped
    into a 2-column grid, both undersell the content.
- **Stat tiles**: equal-width grid, oversized gradient/bold number, one line of
  context, small "Source:" attribution beneath. The source line matters — it's what
  keeps the stats feeling evidence-led rather than asserted (`PRODUCT_VISION.md`'s
  honesty principle, visible in the actual UI, not just the copy).
- **Numbered content, only when order is real**: service pages use "SERVICE 01,"
  "SERVICE 02" eyebrows — legitimate because services are presented in a real,
  intentional sequence. Don't default to numbering elsewhere just because it looks
  structured; only use it where the number carries information.
- **Capability checklists**: cyan circular checkmark + label, one per line, under a
  "KEY CAPABILITIES" eyebrow. This is the pattern for any "what does this include" list
  — cleaner than a plain bullet list and consistent with the icon-badge language used
  elsewhere.
- **Hero pattern**: small pill-shaped eyebrow badge (icon + label, translucent
  background, subtle border) → large Fraunces headline with one key phrase highlighted
  in the brand gradient → supporting paragraph → primary CTA (gradient-filled button
  with a trailing arrow) alongside a secondary text link.

## Interaction States

- **Nav active/hover**: the current section gets an underline; hovering a nav item
  shows a subtle bordered outline around it. Both are light-touch — no heavy background
  fill or color inversion.
- **Card hover**: per `DESIGN_SYSTEM.md`'s measured motion — box-shadow, border-color,
  and a slight transform shift together, 220ms, standard easing. Card border brightens
  slightly (toward the Hover Border token) rather than changing the fill color.
- **Buttons**: 300ms transition, per `DESIGN_SYSTEM.md`. Primary buttons use the
  gradient fill; hovering shifts toward the brighter end of the Brand Blue tokens.
- **Focus states** (keyboard navigation) aren't visible in the reference screenshots,
  so this is a guideline addition, not an observation: every interactive element in HQ
  needs a visible focus ring (not just a hover state) — non-negotiable for an
  internal tool used daily via keyboard as much as mouse.

## Empty, Loading, and Error States

Carried forward from `PRODUCT_VISION.md`'s design principles and confirmed by the
site's own behavior (its testimonials/case-studies sections say "coming soon" plainly
rather than faking content):

- **Empty**: plain, honest copy — "No action needed right now," not a decorative
  illustration or a fabricated example to fill space. Applies directly to the OOA
  Action Queue (`INFORMATION_ARCHITECTURE.md` §2.2) and Knowledge's empty search
  results.
- **Loading**: skeleton states matching the real layout (card-shaped placeholders for
  card grids, row-shaped for tables) — never a generic spinner replacing a whole
  section if the shape of the incoming content is already known.
- **Error**: state what went wrong and what to do next, in plain language — not a raw
  error code or an apology. Matches `AI_ARCHITECTURE.md`'s "Draft failed, try again"
  precedent for AI-assist failures.

## Adapting for HQ: What Changes, What Doesn't

HQ is a denser, daily-use internal tool, not a marketing site — a few patterns above
need deliberate adaptation rather than a direct copy:

| Pattern | Marketing site | HQ adaptation |
|---|---|---|
| Section rhythm (eyebrow → headline → paragraph) | Full 72px section padding | Same structural device, tighter spacing — HQ pages are scanned, not read top-to-bottom |
| Feature grid cards | 2-column, six items | Same shape works for the Knowledge category grid or Dashboard summary tiles |
| Stat tiles | Marketing statistics with citations | Dashboard's "at-a-glance stats" (`INFORMATION_ARCHITECTURE.md` §2.4) — real numbers from HQ's own data, no citation needed, but the same "no fabricated data" discipline applies |
| Hero pattern | Full hero with illustration | Not used in HQ at all — no page in HQ needs a hero; every HQ screen opens directly with real content |
| Rainbow/aurora gradients | Signature hero treatment | Sparingly — OOA branding and primary CTAs only, per `DESIGN_SYSTEM.md`'s explicit guidance |

## Accessibility Baseline

- Every interactive control has a visible keyboard focus state (see above).
- Text/background contrast meets WCAG AA at minimum, checked against the actual token
  pairs in `DESIGN_SYSTEM.md` (e.g. Muted text `#94A3B8` on Card Background `#111827`),
  not assumed from the palette alone.
- Respect `prefers-reduced-motion` — disable the card-hover transform and any future
  decorative motion for users who've opted out, while keeping instant state feedback
  (a card can still show a hover border without an animated shift).
- Icon-only controls (e.g. Dismiss on an OOA card) get an accessible label, not just a
  visual icon.
