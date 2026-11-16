---

version: alpha
name: easyrender.ai
description: >
Design system for easyrender.ai: photos of products turned into 3D models and AR, sold to
e-commerce and real estate teams. Two surfaces share one shadcn token layer. The product
(dashboard, auth, render pages) and marketing studio (landing, hub) are always dark, regardless
of the system colour scheme. Both use the studio carbon palette; colour belongs to the 3D
object and the XYZ axes inside the viewports.

colors:
# ── Shared web surface (apps/web/app/globals.css, always dark) ─────────────

# Components use the semantic names, never the values. Document color-scheme is dark.

background: "#0A0A0B"
foreground: "#ECEBE7"
card: "#131315"
popover: "#1C1C1F"
primary: "#ECEBE7"
primary-foreground: "#0A0A0B"
secondary: "#1C1C1F"
muted: "#1C1C1F"
muted-foreground: "#909095"
accent: "#1C1C1F"
border: "rgb(236 235 231 / 10%)"
input: "rgb(236 235 231 / 16%)"
ring: "#909095"
destructive: "#FF6467"

# ── Marketing studio (apps/web/components/studio/studio.css, scoped to .er-studio) ──

carbon: "#0A0A0B" # page canvas
graphite: "#131315" # card plane
slate: "#1C1C1F" # nested fill, popovers, hover
steel: "#26262A" # active fill
bone: "#ECEBE7" # primary text and primary action
ash: "#909095" # secondary text
smoke: "#606065" # disabled, tertiary
line: "rgb(236 235 231 / 10%)"
line-strong: "rgb(236 235 231 / 22%)"
paper: "#F3F2EE" # the one light plane (product photos, sheet backgrounds)
ink: "#0A0A0B" # text on paper
axis-x: "#F2555A" # XYZ gizmo, red
axis-y: "#8BD450" # XYZ gizmo, green
axis-z: "#4D8DFF" # XYZ gizmo, blue

# ── Mobile (apps/mobile/lib/theme.ts) ────────────────────────────────────

# Mobile retains its own light/dark zinc roles as plain hex for React Native, plus success.

success: "#16A34A / #4ADE80"

typography:
product:
fontFamily: "Geist Sans (geist/font/sans), Geist Mono for numbers and ids"
note: Tailwind scale. Body is text-sm, page titles text-2xl, nothing under text-xs.
studio-display:
fontFamily: "Mona Sans (variable, weight 200-900, width 75-125%)"
note: Headlines use the wider cuts. Fluid sizes with clamp().
studio-data:
fontFamily: "Martian Mono (variable)"
note: Sizes, counts, units, credit prices and the labels inside the viewports.

rounded:
product: "--radius 0.625rem; sm = radius - 4px, md = radius - 2px, lg = radius, xl = radius + 4px"
studio: "--radius 0.5rem"

spacing:
control-height: "32 (sm) / 36 (default) / 40 (lg)"
icon: "16px in controls, lucide-react only"
studio-gutter: "clamp(20px, 2.8vw, 40px)"
studio-nav: "3.5rem"
---

## Overview

easyrender sells a result a buyer can judge at a glance: a product photo becomes a 3D model that
spins and opens in AR. The interface stays out of the way of that result.

- The product surface is shadcn (new-york style, `lucide` icons). Every web route is always dark
  and has no theme switcher, including localized pages, auth and the signed-in app.
- Chrome is graphite on carbon, type is bone, and colour comes only from the rendered object
  and the red, green and blue axes of the gizmo.
- Both surfaces read the same shadcn variables (`--background`, `--primary`, ...). Studio colour
  aliases point to these global tokens. `body:has(.er-studio)` only adjusts radius and typography.
  Existing shadcn `dark:` variants apply unconditionally through the root selector in `globals.css`;
  no web theme depends on `prefers-color-scheme`.

Source of truth: `apps/web/app/globals.css` for the product tokens, `apps/web/components/studio/studio.css`
for the studio tokens, `apps/mobile/lib/theme.ts` for mobile. When a value changes there, change it
here in the same PR.

## Components

shadcn components in `apps/web/components/ui` are the only controls. Add new ones with the shadcn
CLI (`components.json` is configured), then edit.

- **Never raw HTML controls.** `<button>`, `<input>`, `<textarea>`, `<select>`, `<dialog>`,
  `<table>` and `<hr>` fail `bun run check:ui-guards`. The guard keeps an allowlist of the ones
  that predate it; counts only go down, never up.
- Navigation is a link, an action is a `Button`. Never nest a `Button` in a `Button`.
- Primary action is `variant="default"`. One primary action per view.
- Forms: `Label` + `Input` / `Textarea`, errors in `Alert` or under the field in
  `text-destructive`. Dialogs use `Dialog`; tabs use `Tabs`; credit and usage meters use `Progress`.
- Cards use `Card`. Do not nest a card inside a card.
- Icons are `lucide-react`, 16px in controls.
- Studio pages may use the studio classes (`.btn`, `.btn--solid`, `.btn--ghost`, `.prompt`,
  `.spec`, ...) from `studio.css`, scoped under `.er-studio`. Do not use them outside the studio.

## Colour

- Use semantic tokens (`bg-background`, `text-muted-foreground`, `border`), never a hex value or a
  Tailwind palette colour such as `bg-zinc-900`, in product components.
- Do not add `dark:` variants or Tailwind palette colours (`bg-zinc-300`) to product code. The
  semantic tokens already provide the always-dark palette.
- Photos, diagrams, angle sheets and QR codes may retain a light canvas inside a rounded,
  bordered media frame. Preserve image colours and pair any text on paper with ink.
- Chrome is greyscale. Colour belongs to the 3D object, the axis gizmo, and `destructive` for
  errors. Do not add brand accents, glows or decorative gradients to chrome.
- Studio: pick a step by its job (carbon canvas, graphite card, slate hover, steel selected). Put
  text on `paper` only with `ink`.
- Colour modifiers use the usual `/5 /10 /20 /40 /50 /60 /70 /80 /90` stops.

Admin analytics adds semantic `success` for favorable KPI deltas (paired with arrows and text),
and five muted `chart-*` data-series tokens in `globals.css`. These are data encodings, not
chrome accents. Chart series also use labels, legends and dashed previous-period lines.

## Typography

- Product: Geist Sans, Geist Mono for ids, sizes and credit counts. `text-sm` for body,
  `text-xs` is the floor. No arbitrary sizes such as `text-[11px]` in product code.
- Studio: Mona Sans for text and headlines, Martian Mono for data. Sizes are fluid (`clamp()`),
  set in `studio.css`.
- Numbers that line up (prices, credits, balances) use `tabular-nums`.

## Layout

- The signed-in app has its own shell (`components/app-shell`): a thin icon rail (Overview,
  Library, Product views, Account), a left drawer with the renders list (thumbnails, grouped by
  state), the page in one rounded block, and a right drawer that a page may fill with its context
  (a render's parts: photo, angle sheet, details) through `ShellPanel`. It has no marketing
  header; below `md` the rail becomes a bottom bar and the drawers are hidden (a page's context
  then follows the page content). Both drawers resize by dragging the handle (shadcn
  `Resizable`, widths in pixels, saved per browser), snap shut when dragged below their minimum,
  and toggle from the top bar. Marketing pages use the site header and footer (`site-chrome.tsx`).
- Settings are full pages with no drawers: Account, Credits and Connectors, linked by one row of
  tabs and reached from the Account rail item. The credit balance is shown only there, never in
  the top bar or the rail.
- The rail peek is a shadcn `HoverCard`: short delays, closes on click and navigation, and never
  opens for the active item.
- Product pages sit in a centred column inside that shell. Do not choose columns from viewport
  breakpoints when the page column is what constrains the grid.
- Controls snap to 32 / 36 / 40px.
- Every page works at 375px wide. The mobile web and the Expo app are first-class surfaces
  because shoppers and agents capture products on a phone.
- 3D viewers (`model-viewer.tsx`) keep a fixed aspect ratio and never resize the page while a
  model loads.

## Motion

- Motion is short, 150-250ms, and only explains a state change. The studio uses
  `cubic-bezier(0.2, 0.7, 0.2, 1)`.
- Honour `prefers-reduced-motion`: the float animations in `globals.css` already do. New
  animation has to.

## States

Every view that loads data shows loading, empty, success and error. A render in progress shows
its real status from the pipeline (preview, sheet, building) and never a fake percentage. An
error says what failed and whether credits were refunded.

## Money and credits

- Credits are the only unit shown in the product. 1 credit = $0.01 (pay as you go); Pro is 5,500
  credits for $49 a month. Prices come from `@easyrender/harness` pricing, never hard-coded in a
  component.
- Show the cost on the button that spends it ("Build 3D, 64 credits") before the click.

## Internationalisation

All copy lives in `apps/web/messages/en.json` and `es.json` and is read with `next-intl`. A new
string is added to both files in the same PR. Layouts have to survive Spanish, which runs about
20% longer.

## Do's and Don'ts

- **Do** reach for an existing shadcn component first.
- **Do** emulate both light and dark OS preferences and verify the site stays dark at 375px and
  desktop whenever chrome changes. Say which browser checks were not run.
- **Do** keep copy in the message files.
- **Don't** add a raw HTML control, a hex colour, a palette colour or a `dark:` variant to product code.
- **Don't** add a new font, a new accent colour, or a second component library.
- **Don't** hard-code a price or a credit amount in a component.
- **Don't** show a model as done before `get_render` says so.
- **Don't** put studio classes in product pages or duplicate shared colour tokens in `studio.css`.

## UI review checkpoints

For a change to shared components, empty states or motion, check the real task in empty,
loading, success and error states, with keyboard focus, touch, narrow layouts, both colour
schemes and reduced motion. Use a Before/After table with source locations and user impact in
the PR. Browser checks that were not run are marked unverified; reading the source is not visual
approval.
