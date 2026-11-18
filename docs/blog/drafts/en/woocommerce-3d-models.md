---

group: woocommerce-3d-models
title: "How to add a 3D product viewer to WooCommerce"
description: "Set up a WooCommerce 3D product viewer with a GLB, a fallback photo and a mobile acceptance test."
date: 2026-11-29
updated: 2026-11-29
keyword: "woocommerce 3d product viewer"
cta: "Try an angle preview from a product photo."
---

Add a 3D viewer to one WooCommerce product on a staging site. Use a viewer extension if you need an admin workflow, or add a web viewer if you manage the template. Keep a product photo available and test the gallery on the theme and devices your customers use.

<!-- ILLUSTRATION PENDING: /blog/illustrations/woocommerce-3d-models/hero.webp; Prepare the editorial cover described in the brief. -->

## How do you pick the integration?

Check that the extension supports your file and placement before purchasing or installing it. A custom template can use a component such as model-viewer, hosted with your GLB and poster. Check that variant selection and buying controls still work.

## What do you test with one product?

Upload a small model first. Open the product in an incognito session, verify the poster, interact with the viewer and add the correct variant to the basket. On a slow mobile connection, confirm the photo and product details remain usable.

## What should you check before publishing?

| Failure                           | Check                                             |
| --------------------------------- | ------------------------------------------------- |
| Model returns 403                 | Public URL or hosting permissions                 |
| Viewer replaces the whole gallery | Extension placement and theme                     |
| Page jumps on load                | Give the poster and viewer a defined aspect ratio |

<!-- IMAGE PENDING: Photograph or capture the example described in the brief. -->

**Source** [WooCommerce · Arty 3D Viewer](https://woocommerce.com/document/arty-3dmodelviewer/), [WooCommerce · adding products](https://woocommerce.com/document/managing-products/add-product/), [model-viewer · documentation](https://modelviewer.dev/docs/).

[Related guide](/learn/3d-models-for-ecommerce)

## FAQ

### Do I need a plugin?

Use a plugin for an admin-managed gallery, or choose a component when you can own the template and hosting. Test maintenance as well as the first upload.

### Is GLB enough for every AR mode?

Check the chosen viewer’s documented modes and device support. Test a representative device before presenting any AR action to shoppers.

### Where should the 3D appear?

Give it a clear place alongside the photos. Prioritize the photo and buying controls on a narrow screen and make rotation optional.
