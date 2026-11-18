---

group: "shopify-3d-models"
title: "How to add 3D models to Shopify products"
description: "Upload a product model in Shopify, check your theme and test how shoppers see it on web and mobile."
date: 2026-11-20
updated: 2026-11-20
keyword: "shopify 3d models"
cta: "Try an angle preview from a product photo."
---

Add a GLB or USDZ to the media gallery of a Shopify product and preview it with the storefront theme you use. Check it on a phone as well as desktop. Keep a product photo as the first media item so the listing works while the model loads.

![Editorial rendering: open shipping carton, half solid and half wireframe](../covers/shopify-3d-models.webp "Editorial illustration made in Blender.")

## What should you check before upload?

Pick one existing product with clear photos. Open the model in a standalone viewer to check orientation, surfaces and texture. Record the file size and choose a thumbnail that shows what the model adds.

Check the current supported formats and upload limits in Shopify’s media guide. The theme must support 3D product media or be adapted to display it. Confirm this on a draft product or a development theme first.

## How do you find a missing viewer?

Open the product in Shopify admin and add the file under Media. Wait until processing finishes and save the product. Open the storefront preview, select the model and turn it to the back and underside.

If the model works in the admin but not the storefront, inspect the theme’s product-media section first. Check a mobile view and a fresh session. Where you enable AR, open it on a compatible device and go back to the shop.

## What should you check before publishing?

| What happens                              | Where to look                      |
| ----------------------------------------- | ---------------------------------- |
| Upload rejected                           | Format and file limits             |
| Admin preview works but no viewer appears | Product media support in the theme |
| Viewer works but AR does not open         | Device, browser and AR file        |

<!-- IMAGE PENDING: Photograph or capture the example described in the brief. -->

**Source** [Shopify · product media](https://help.shopify.com/en/manual/products/product-media), [Shopify · media types](https://help.shopify.com/en/manual/products/product-media/product-media-types), [Shopify · managing product media](https://shopify.dev/docs/apps/build/product-merchandising/products-and-collections/manage-media), [Apple · Quick Look](https://developer.apple.com/quick-look-gallery/).

[Related guide](/learn/3d-models-for-ecommerce)

[How to make a 3D model](/learn/how-to-make-a-3d-model)

## FAQ

### Does every Shopify theme display 3D?

Shopify lists themes with product-media support. Check the version used in production and the product template where the model will appear. A custom theme may need changes. Preview a draft on a phone and check that the gallery can switch from the lead image to the model.

### Which file should I upload?

Start with a model format accepted by Shopify. Verify the source file in another viewer and then verify the processed media in the storefront. Keep the original model for later fixes. Shopify accepts GLB and USDZ for 3D product media. Check scale, orientation and textures after processing.

### Should I replace the hero photo with a model?

Keep a clear photo first for the initial product impression. Place the model after the images that explain the product most quickly. Check that the reader can tell which gallery item is interactive. On mobile, confirm the viewer opens by choice and customers can quickly return to the photos.
