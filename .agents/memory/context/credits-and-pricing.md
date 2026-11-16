# Credits and pricing

- 1 credit = $0.01 (`CREDIT_USD` in `packages/harness/src/pricing.ts`). Credit prices are
  provider cost divided by (1 - margin), margin 70%, rounded up. Change the cost constants, not
  the credit numbers.
- Pay as you go: any number of credits from 500 to 100,000 through one $0.01 Stripe price, bought
  with `quantity = credits`. Pro: $49 a month for 5,500 credits. Public plans are PAYG, Pro and Enterprise. Creator and
  Scale remain in billing for existing subscribers. Active/trialing subscribers top up at their
  own plan's exact per-credit rate (actual Stripe price ID selects plan/variant), rounded once to
  cents for the whole pack via inline Checkout price_data. Other statuses use PAYG. The shared
  harness calculation drives UI and checkout; Purchase snapshots the credits and amount for
  idempotent webhook grants. No plan change; all credits remain non-expiring.
- A 3D build is `RENDER_CREDITS`; the angle sheet is `SHEET_CREDITS` and counts toward the 3D
  price. Free previews are limited per day (`FREE_PREVIEWS_PER_DAY`). Redrawing a sheet with a fix
  note (`redrawSheet`) costs `SHEET_CREDITS` each time, does not count toward the 3D price, and is
  refunded if that redraw fails (the owner keeps the sheet they had).
- Product views (`packages/core/src/product-views.ts`): one photo to nine white-background
  packshots, no 3D. A set costs `PRODUCT_VIEWS_CREDITS` (2K sheet + nine upscales, same model as the Upscale action + one reserved
  redraw) and is refunded in full only if no sheet can be drawn; after the sheet no view ever
  fails the set (it falls back and is flagged). Polishing one view costs `VIEW_POLISH_CREDITS` and
  is refunded if it cannot be drawn. Building 3D from a set creates a `Render` with
  `hasFinalSheet` and charges `BUILD_FROM_VIEWS_CREDITS` (a full render minus the 2K sheet it
  reuses). Per-view checks and their limits live in `packages/harness/src/packshot.ts` and
  `LIMITS` (`view*`), tunable from the private harness `limits`.
- Upscale (`packages/core/src/upscale.ts`): a paid enlargement of a ready product view or of the
  angle sheet of a paid render, to at most 4096 px. A flat `UPSCALE_CREDITS` (from
  `ENLARGE_COST_USD`), charged before the model runs and refunded if it fails; asking again for the
  same picture returns the earlier file at no charge. Which model runs, and why:
  [upscalers](upscalers.md).
- A failed job refunds its credits. Guardrail failures (bad photo, bad sheet, bad GLB) fail and
  refund.
- Stripe is live only. There is no test mode, so a test checkout is a real charge. With
  `STRIPE_SECRET_KEY` empty outside production, `/api/dev/checkout` grants credits locally.
