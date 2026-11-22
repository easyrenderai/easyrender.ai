---

group: "woocommerce-3d-models"
title: "How to add a 3D product viewer to WooCommerce"
description: "Add a 3D viewer to WooCommerce using an existing GLB, or create a model from a product photo. Test both setups on one product before rolling them out."
date: 2026-11-29
updated: 2026-11-29
author: Jorge Rodríguez
authorType: person
keyword: "woocommerce 3d product viewer"
cta: "Try a free preview from a product photo before building a model for your store."
---

Add a 3D viewer to one WooCommerce product on a staging store. If you have a GLB, choose an extension or a viewer that can load it, or generate a model first if you only have photos. Keep the original product gallery and verify the viewer, the selected variant and the cart on your actual theme.

![Coffee grinder with a solid surface on one side and wireframe on the other](/blog/illustrations/woocommerce-3d-models/hero.webp "Editorial illustration made in Blender.")

> **Test the buyer’s next action.** A shopper should be able to leave the viewer, select the right option and add it to the cart without hunting for the button.

## Choose the integration based on what you have

| Starting point                              | Integration                       | What to verify first                                                     |
| ------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------ |
| An existing GLB and an admin-managed viewer | A WooCommerce viewer extension    | Upload support and where the viewer appears                              |
| An existing GLB and a template you maintain | A web viewer such as model-viewer | Public asset URLs, mobile layout and loading                             |
| A photo and a catalog that needs models     | The EasyRender connector          | The quoted products and credits, followed by the external 3D and AR link |

[Arty’s WooCommerce documentation](https://woocommerce.com/document/arty-3dmodelviewer/) gives one example of an extension that accepts GLB and allows the viewer position and height to be configured. It requires an Arty account and subscription. Check the exact extension you plan to install, especially if the product has multiple variants.

## If you already have a GLB

1. Select an existing product on staging. Keep its [main image and product gallery](https://woocommerce.com/document/adding-product-images-and-galleries/) in WooCommerce, including a photo for each relevant variant.
2. Upload the GLB and associate it with the product in your extension. If you maintain the template, the [model-viewer examples](https://modelviewer.dev/examples/loading/) show how to supply a model and a poster. Host the files at HTTPS URLs that load without a store login and configure cross-origin access if the model lives on another host.
3. Open the product as a signed-out shopper. Rotate the model, switch variants, and add the intended variant to the cart. Repeat at a mobile width and on the browsers you support.

| Expected behavior                                | What to check                                                    |
| ------------------------------------------------ | ---------------------------------------------------------------- |
| The regular photo appears before the model loads | Leave the product photo in place and set a poster for the viewer |
| The correct model opens after switching variants | Test models and labels against the actual SKU or variant ID      |
| The main buying controls stay accessible         | Try closing the viewer and adding the variant from the page      |

For the model itself, see our guide to [making a 3D model](/learn/how-to-make-a-3d-model), including which file to check before attaching it to a product.

## If you need to create models from photos

The [EasyRender WooCommerce connector](/ecommerce?platform=woocommerce) uses the store’s product photos to generate models. A completed product gets a button and a QR code that open its separate 3D and AR page. Choose the template or extension route above if you need rotation directly inside the WooCommerce gallery.

1. On a staging store, follow the [WordPress ZIP installation steps](https://wordpress.org/documentation/article/manage-plugins/) after preparing the ZIP from the source linked on the EasyRender connector page.
2. Open **WooCommerce → 3D & AR** and enter an EasyRender API key. Put only the intended published test products with HTTPS images on that staging catalog. The connector works on eligible products in a batch.
3. Review the product count and credit quote before confirming any generation. When the list reports that a product is ready, open its storefront page and check the button and QR destination.

![WooCommerce Storefront test product with the original photo, cart controls, AR button and QR code](/blog/figures/woocommerce-3d-models/storefront-test.webp "Cropped browser capture of our WooCommerce test store. The catalog API returned simulated results, and the QR points to the test environment.")

In [our browser test](https://github.com/easyrenderai/easyrender.ai/actions/runs/44724493484), the real WooCommerce installation ran on both Storefront and Twenty Twenty-Five. The test checked the quote, three eligible fixture products, that the QR image loaded, and that the button reached the expected destination. The catalog responses were simulated, so a physical-phone AR test is still needed.

## What to check before enabling it for customers

| Symptom                                     | Check                                                                    |
| ------------------------------------------- | ------------------------------------------------------------------------ |
| The model fetch returns 403                 | Open the model URL in a private window and inspect its host permissions  |
| The product photo disappears                | Review the placement and restore the WooCommerce gallery in the template |
| The page shifts when the viewer loads       | Reserve a fixed aspect ratio for the poster and viewer                   |
| The AR button never opens the mobile viewer | Check the device, browser and whether the viewer supports its AR route   |

Test any AR feature on an iPhone and an Android phone you intend to support. [Model-viewer’s AR documentation](https://modelviewer.dev/examples/augmentedreality/) describes the handoff and format differences. Retain the photo and product dimensions so shoppers can use the page whichever device they have.

## FAQ

### Do I need a WooCommerce plugin to add a 3D viewer?

Use a plugin if you need to manage models from WordPress without editing templates. If you own the theme, you can add a web viewer to the product template and maintain its model URLs, posters and variant mapping. Both options should keep the original gallery and cart usable.

### Can I use the same GLB on iPhone and Android?

A GLB can be used in a browser viewer and can feed supported Android AR routes. An iPhone handoff to Quick Look uses USDZ, which some viewers generate for you. Test how your chosen viewer handles that file and keep the original photos available for devices without AR.

### What should I check before processing more products?

Open the test product in a signed-out browser and check that the displayed model matches the selected variant. Verify the mobile layout and the purchase button. If you plan to generate models for a batch, review the eligible product count and current credit quote before starting it.
