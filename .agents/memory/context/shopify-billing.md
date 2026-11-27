---

name: shopify-billing
description: Why Shopify credit packs are bought inside the app through the Billing API, and what was left open
type: project
---

Merchants buy credit packs inside the Shopify app through the Billing API as one-time purchases,
at the same price rule as pay-as-you-go, with no markup (PR #362). Existing easyrender customers
connect their account and spend held credits. The in-app link to the web credits page was removed.

**Why:** the Shopify App Store requirement against off-platform billing (1.2). App Pricing has no
one-time purchases, so the Billing API is the route. Whether spending credits bought off Shopify
inside the app is allowed is not confirmed; it needs Shopify's written answer before submission
(issue #382).
**How to apply:** dev stores are not billed by Shopify, so a test charge credits one pack per
account only. Refunds are an admin action (`docs/shopify-refunds.md`) because Shopify sends no
refund webhook. Never submit or pay anything for Shopify without the owner. Keep partner, support
and fee questions out of public issues.
