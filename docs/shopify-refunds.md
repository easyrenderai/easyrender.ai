# Refunding a Shopify credit pack

Shopify sends no webhook when a one-time app purchase is refunded, and the charge keeps its `ACTIVE`
status ([AppPurchaseStatus](https://shopify.dev/docs/api/admin-graphql/latest/enums/AppPurchaseStatus):
a purchase "remains in that final state"). So a refund cannot be polled for. It is recorded by an admin
after the money has been returned in Shopify.

1. Refund the charge in the Shopify Partner Dashboard (Payments, the app's charge).
2. Find the charge id, `gid://shopify/AppPurchaseOneTime/...`, in the `ShopifyPurchase` table
   (`chargeId`) or in the Partner Dashboard charge.
3. Signed in to https://easyrender.ai as an admin, open any `/admin` page and run this in the browser
   console:

   ```js
   await fetch('/api/admin/shopify/refunds', {
     method: 'POST',
     headers: { 'content-type': 'application/json' },
     body: JSON.stringify({ chargeId: 'gid://shopify/AppPurchaseOneTime/123' }),
   }).then((r) => r.json());
   ```

The reply is `{ chargeId, credits, reclaimed, isAlreadyRefunded }`.

- `reclaimed` is how many credits left the wallet: at most the pack's `credits`, and never more than
  the account still holds, so the balance does not go below zero. Credits already spent are not taken
  back. It is written to the ledger (`shopify_refund`, key `shopify:refund:<chargeId>`).
- The purchase becomes `refunded`, so it drops out of revenue and buyer analytics, and settling the
  same charge again (webhook or page) cannot credit it twice.
- Calling it again for the same charge changes nothing and returns `isAlreadyRefunded: true`.
- Only an `active` purchase can be refunded; a pending, declined or expired one answers 409.
