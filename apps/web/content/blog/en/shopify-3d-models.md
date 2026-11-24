---

group: "shopify-3d-models"
title: "How to add 3D models to Shopify products"
description: "Upload a product model in Shopify, check your theme and test how shoppers see it on web and mobile."
date: 2026-11-20
updated: 2026-11-24
author: Jorge Rodríguez
authorType: person
keyword: "shopify 3d models"
cta: "Try an angle preview from a product photo."
---

Add a GLB or USDZ to the media gallery of a Shopify product and preview it with the storefront theme you use. Check it on a phone as well as desktop. Keep a product photo as the first media item so the listing works while the model loads.

![Editorial rendering: open shipping carton, half solid and half wireframe](/blog/illustrations/shopify-3d-models/hero.webp "Editorial illustration made in Blender.")

## What should you check before upload?

Pick one existing product with clear photos. Open the model in a standalone viewer to check orientation, surfaces and texture. Record the file size and choose a thumbnail that shows what the model adds.

Check the supported formats and upload limits in Shopify’s media guide. Upload to a draft product first, then use the theme preview to see if your theme displays 3D media.

## How do you find a missing viewer?

Open the draft product in Shopify admin and [add the file under Media](https://help.shopify.com/en/manual/products/product-media/add-media). Save after processing finishes, then open the storefront preview. Select the model and turn it to the back and underside.

If the model works in the admin but not the storefront, inspect the theme’s product-media section first. Check the draft preview on a phone and use a private window if you have a visitor preview link. Where you enable AR, open it on a compatible device and go back to the shop.

## What should you check before publishing?

| What happens                                 | Where to look                                                      |
| -------------------------------------------- | ------------------------------------------------------------------ |
| Upload rejected                              | Format and file limits                                             |
| Admin preview works but no viewer appears    | Product media support in the theme                                 |
| Viewer works but AR does not open            | Check the device, browser and processed AR file                    |
| Shoppers see the model before the lead photo | Check the order in the Media section                               |
| The model opens but the finish changed       | Compare the processed model with the source under similar lighting |
| Model is slow on a phone                     | Compare transfer size and time to first usable interaction         |

![EasyRender swivel chair GLB opened locally in Blender](/blog/figures/shopify-3d-models/chair-inspection.webp "We reopened the source GLB in Blender to inspect it before upload. Check Shopify processing and the gallery independently using your own store’s preview.")

## Check what Shopify accepts

[Shopify’s media requirements](https://help.shopify.com/en/manual/products/product-media/product-media-types) list a 500 MB limit for GLB and USDZ uploads, with automatic optimisation above 15 MB. Record the source file size and compare the result after processing. The [glTF specification](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html) describes what a GLB can contain.

| What you check                              | Where to check it                     |
| ------------------------------------------- | ------------------------------------- |
| Orientation and textures of your source GLB | Standalone model viewer before upload |
| Whether processing finished                 | Media area for the draft product      |
| Thumbnail and gallery position              | Theme preview for the product         |

## Run the customer checks

| Session                               | Expected result                                                     |
| ------------------------------------- | ------------------------------------------------------------------- |
| Desktop, visitor preview if available | Lead photo appears and the 3D item can rotate                       |
| Phone, fresh session                  | The model loads after selection and the reader can return to photos |
| Compatible Apple device               | Quick Look opens where enabled and returns to the listing           |

**Source** [Shopify · product media](https://help.shopify.com/en/manual/products/product-media), [Shopify · media types](https://help.shopify.com/en/manual/products/product-media/product-media-types), [Shopify · managing product media](https://shopify.dev/docs/apps/build/product-merchandising/products-and-collections/manage-media), [Apple · Quick Look](https://developer.apple.com/quick-look-gallery/).

[Related guide](/learn/3d-models-for-ecommerce)

[How to make a 3D model](/learn/how-to-make-a-3d-model)

## FAQ

### Does every Shopify theme display 3D?

Check Shopify’s list of themes with product-media support and confirm the version on your store. A custom product template may need changes. Preview a draft on a phone and make sure you can open the model from the gallery and return to the lead photo.

### Which file should I upload?

Upload GLB or USDZ and keep the original file for later fixes. Open the source in a standalone viewer before upload, then view the processed model in the storefront. Compare orientation and materials on both screens and reduce the file weight if it loads too slowly on your test phone.

### Should I replace the hero photo with a model?

Keep a clear photo first and place the model after the pictures that explain the product most quickly. Check that readers can tell which gallery item is interactive. On a phone, select the model, rotate it and confirm that you can return to the photos without reloading the page.
