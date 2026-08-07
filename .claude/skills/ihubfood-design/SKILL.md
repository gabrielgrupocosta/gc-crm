---
name: ihubfood-design
description: Brand and UI design system for iHubFood, a delivery-management dashboard product (iFood/99Food/Keeta consulting SaaS). Use this skill ANY time you are building, redesigning, or adding a component/page/card to the iHubFood web system, its dashboards, landing pages, or marketing materials — even if the user just says "melhora esse card", "cria uma tela de X", "faz um dashboard", or references "meu site"/"o sistema" without naming iHubFood explicitly, since that is almost always what's meant. This layers ON TOP of the general frontend-design skill (still read that one too) — this file locks in the specific palette, typography, component patterns, and signature motif so the output matches the existing iHubFood product instead of reinventing the identity each time.
---

# iHubFood Design System

iHubFood is a B2B SaaS dashboard for delivery-platform management consultants: managers track restaurant clients' performance across iFood, 99Food, and Keeta (revenue, reports, rankings, onboarding). The existing product uses a **dark sidebar + light content area** hybrid layout — that structure is settled and should be preserved, not reinvented. This skill's job is to make new screens and components look like they belong in that same product, while pulling in more sophisticated dashboard/data-viz patterns where they fit.

## Brand tokens

**Color**
- `#0E1116` — near-black, sidebar background, darkest surface
- `#1C2128` — dark gray, secondary dark surface / hover states on dark
- `#F2F4F7` — light gray, main content background
- `#FFFFFF` — card surfaces on the light side
- `#FF4B2E` — primary brand accent (logo, active nav item, primary CTAs, key highlights)
- `#00C896` — success/positive green (used for positive % deltas, "on track" states)
- `#2563EB` — blue (secondary accent — links, informational states, secondary data series)

**Platform badge colors (keep as-is, do not migrate to brand palette):**
- iFood → red (`#EA1D2C`-ish, existing red/orange badge)
- 99Food → yellow (existing yellow badge)
- Keeta → pick a distinct hue not already used (e.g. purple or teal) when it appears

**Semantic color use**
- Green = positive change / success
- Red = negative change / alert / iFood badge (context-dependent, don't conflate — a red delta pill always means "down," a red platform badge just means "this is iFood")
- Amber/yellow highlight background = "#1 / top rank" row emphasis (already used — keep this pattern for any ranked list)

**Typography**
- Headings / numbers / anything that needs weight → **Manrope ExtraBold**
- Body, labels, table text → **Manrope Regular**
- Big KPI numbers should be the heaviest, largest element on a card — this is already done well in the current dashboard (e.g. "R$ 160.286,03"), keep doing it

## Layout pattern (locked in, don't deviate without reason)

- **Sidebar**: dark (`#0E1116`), logo top-left, grouped nav sections with uppercase small-caps section labels (RESULTADO, GESTÃO, CARTEIRA DE GESTÃO), active item gets a subtle dark-red/brand-tinted background pill, not just a color change
- **Content area**: light (`#F2F4F7` background), white rounded cards (`border-radius` ~12-16px), soft shadow — never harsh drop shadows
- **Top bar**: page title bold + large, filter dropdowns top-right (period selector, entity selector)
- **Alert banner**: left-border-accent style (thin colored bar on the left edge of a light card) for warnings like "16 relatórios atrasados" — keep this pattern for any warning/attention state, don't switch to a toast or modal for persistent status info
- **Ranked lists**: numbered rows (icon/rank badge on the left), name + secondary label, right-aligned platform badge + delta pill. Row 1 gets the amber highlight background.

## Signature motif: the Hub

The logo is a hexagonal "hub" — a pin/location marker containing a bar chart, ringed by connected nodes (circles joined by lines), echoing "network of stores/managers feeding into one system." This is the one element that should feel unmistakably iHubFood — use it as the signature graphic wherever a screen benefits from conveying **connection, network, or aggregation** (the CRM, a multi-store map view, onboarding flow, "portfolio" or "carteira" overview, any hero/empty-state illustration). Concretely:
- A small node-and-line pattern (2-6 connected circles) works as a subtle background texture or as a literal element (e.g., a mini network diagram showing stores feeding into a central hub)
- Don't force it onto every card — it's a signature for moments that are actually about connection/aggregation, not a generic decoration. A single dense data table doesn't need it; a "visão geral da carteira" screen does.

## Dashboard component patterns to pull in from references

These are patterns from enterprise BI tools (Appian-style dashboards, KPI panels) that are NOT yet in the current product but fit its DNA well — reach for them instead of generic bar/line charts when the data suits it:

- **Radial progress ring** (donut with % in the center): use for any single-metric completion/health stat — e.g. "relatórios em dia," "taxa de conversão," account usage. Currently "Relatórios em dia" is shown as a flat progress bar; a ring reads faster at a glance and matches the reference set.
- **Semicircle gauge**: reserve for a "health score" style metric where there's a clear target/threshold (e.g. an overall portfolio health score, SLA compliance) — don't overuse, one gauge per screen max.
- **Sparkline inside a KPI card**: a thin trend line under/beside a big number (like "Faturamento da Carteira") adds trend context without a full chart — good default upgrade for the existing flat KPI cards.
- **Category donut + legend**: for "spending/revenue by category" style breakdowns (e.g. faturamento by platform, by store type) — colored donut with a simple legend list beside it, matches the reference's "Spending by Category" pattern.
- **Data table**: keep the existing dense, searchable, paginated pattern for anything list-like (relatórios, lojas, clientes) — this part of the current product already matches the reference dashboards well.

## Visual hierarchy & UX rules

These are general dashboard/data-viz UX principles, made concrete for iHubFood's stack (Manrope, the dark-sidebar/light-content layout). Apply them to every screen, not just new ones.

**Page-level hierarchy (top → bottom, not negotiable for dashboard screens)**
1. **Above the fold**: status/health — is the portfolio okay or not? (big KPI numbers, alert banners like "16 relatórios atrasados")
2. **Middle**: trends and comparisons — what's changing, where? (rankings, sparklines, category breakdowns)
3. **Bottom / drill-down**: detail tables, filters, granular data
If a manager has to hunt to answer "am I on track this week," the layout has failed — the top section alone should answer that.

**Typography scale**
Use a modular scale (base 16px × ~1.25 ratio) instead of arbitrary sizes, so every screen feels consistent:
- Body / table text: 14-16px, Manrope Regular
- Card labels / eyebrows: 12-13px, Manrope Regular, uppercase, muted gray (e.g. `#6B7280` on light, lighter gray on dark) — this is already the pattern in "RESULTADO", "FATURAMENTO DA CARTEIRA"
- Section/card titles: 18-20px, Manrope ExtraBold
- Big KPI numbers: 28-40px, Manrope ExtraBold — this should be the single largest text on any card
- Never introduce a font size that doesn't map to this scale; never use more than 2 font families (already satisfied — Manrope only)

**Contrast & accessibility (non-negotiable, not just nice-to-have)**
- Body text against its background: minimum 4.5:1 contrast ratio. Large text (18px+ bold or 24px+ regular): minimum 3:1.
- Line height ≥ 1.5× font size for any paragraph/body text block.
- Never use color as the only signal — a "down" delta pill should have a down-arrow icon, not just red text, so it still reads for colorblind users.
- Check this especially on the dark sidebar: muted nav labels on `#0E1116` need to be light gray, not low-contrast dark gray.

**Chart selection — match the chart to the question, not to what looks nice**
- Trend over time → line chart / sparkline
- Comparison across discrete items (stores, managers) → bar chart or ranked list (already the pattern for "Top Lojas")
- Part-of-a-whole → donut, and only when there are ≤6 categories — beyond that, use a table
- Single completion/health metric → radial progress ring or gauge (see component patterns above)
- Never add a chart to decorate — every visual should answer a specific question at a glance. If a table communicates it just as fast, use the table (the current product already leans correctly on tables for lojas/relatórios).

**Reduce cognitive load**
- One primary visual focus per card. A KPI card is a number + one supporting element (sparkline, delta, or icon) — not both a chart and a table crammed in.
- Group related data with whitespace and card boundaries rather than borders/lines — this is already how the dashboard separates "Top Lojas" from "Top Gestores."
- Cap the number of simultaneous colors doing semantic work on one screen (status green/red/amber + at most 1-2 categorical colors) — more than that becomes noise, not signal.
- Favor progressive disclosure: show the summary by default, let the manager click into a store/gestor for the granular breakdown, rather than putting everything on one screen.

**Scan pattern**
Content should be arranged so the eye naturally moves in an F or Z pattern: most important KPI top-left or top-center, supporting detail flows left-to-right then down. This is already respected in the current dashboard's layout (alert → Top Lojas/Gestores side-by-side → KPI row → ranking) — keep new screens consistent with that flow.

## Restraint

Match the current product's fairly enterprise, low-noise register — this is a tool consultants check daily, not a marketing site. No page-load animations, no heavy gradients outside the header/hero context, no decorative illustration outside the hub motif use cases above. Prioritize scan-ability: big number, clear label, one supporting visual, done. When in doubt, look at how "Faturamento da Carteira" or "Top Lojas" is already built and match that level of restraint.

**Banned tic: left-only accent border.** Don't reach for `border-left: 3px solid <accent>` as a generic way to mark emphasis, recency, or hierarchy on a card, list row, or timeline item — it's a shallow, overused pattern that reads as AI-generated the instant a screen has more than one of them. The *only* place this is legitimate is the product's existing persistent alert/warning banner (e.g. "16 relatórios atrasados") — that convention predates this rule and stays as-is. Don't extend it to anything new. To highlight an item instead: use a tinted background (accent-soft), a font-weight bump, a full border on all four sides, or an icon/badge — not a stripe down one edge.

## Before shipping a component

1. Does it use the dark-sidebar/light-content split correctly (never invert this)?
2. Are brand colors used semantically (not decoratively — green means positive, not "looks nice here")?
3. Platform badges keep their current colors?
4. If the screen is about connection/aggregation, did you consider the hub motif — and if not, is that a deliberate call?
5. Typography: Manrope ExtraBold for anything that needs to be scanned first, Regular for everything else, sizes on the modular scale?
6. Does the page answer "are we on track?" from the top section alone, before any scrolling or drill-down?
7. Contrast checked (4.5:1 body / 3:1 large text), and no signal relies on color alone?
8. Is every chart answering a specific question — would a table or a simpler number communicate it just as fast?
9. Any left-only accent border that isn't the established alert-banner pattern? Remove it.
