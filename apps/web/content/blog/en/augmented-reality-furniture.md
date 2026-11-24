---

group: "augmented-reality-furniture"
title: "Augmented reality for furniture: what to test"
description: "Test a furniture model on iPhone and Android before opening AR to shoppers. Check the QR link, orientation, floor placement and the return to your store."
date: 2026-12-01
updated: 2026-12-01
author: Jorge Rodríguez
authorType: person
keyword: "augmented reality furniture"
cta: "Start with a furniture photo and inspect the free angle preview before creating a model."
---

Use augmented reality to give shoppers another way to see a piece of furniture. Start with one product and check how buyers open the model, place it on the floor, and return to the product page. Leave the manufacturer’s dimensions and original photos accessible so buyers can check the piece before ordering.

![Armchair shown half as a solid object and half as a wireframe](/blog/illustrations/augmented-reality-furniture/hero.webp "Editorial illustration made in Blender.")

> **Start where the customer starts.** Open the product page as a guest and follow the same button or QR code the shopper will use.

## Test the web page before opening AR

Open the model page from a computer and verify that the photo or browser model, product name and QR code match the listing. Scan the QR with a phone and check the item that opens. If the product has variants, change the color or finish in the shop and repeat.

![Desktop browser with a wooden table model and a QR code beside it](/blog/figures/augmented-reality-furniture/desktop-en.webp "Public EasyRender example in a desktop browser. The model opens in 3D and the QR takes the same example to a phone.")

We checked the same EasyRender table page on desktop and in a mobile-sized browser. The GLB loaded in both views and the desktop QR decoded to the same model page. The camera and floor placement require a test on a physical phone.

![The same table rendered in a narrow mobile-size 3D preview](/blog/figures/augmented-reality-furniture/phone-en.webp "Public EasyRender model in a phone-sized browser before the native AR session opens.")

| Starting point                        | Expected result                                     | If it fails                                                         |
| ------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------- |
| Product page on desktop               | A browser model or photo and a working mobile link  | Confirm the link and QR carry the right product ID                  |
| Browser page on a supported phone     | A clear way to launch the device viewer             | Verify the browser and that the asset is accessible without a login |
| Browser or phone without supported AR | Photo, product specifications and the checkout path | Keep those controls available and give the buyer a way back         |

## Which formats and devices should you test?

On iPhone or iPad, open the product with Safari and follow its AR entry point to [Apple Quick Look](https://developer.apple.com/quick-look-gallery/), which displays USDZ. [Google’s Scene Viewer documentation](https://developers.google.com/ar/develop/scene-viewer) explains the Android requirements and fallback modes for compatible devices and GLB or glTF assets.

| Device route                      | Check first                                                                    |
| --------------------------------- | ------------------------------------------------------------------------------ |
| iPhone with Safari and Quick Look | The USDZ opens and retains the intended finish and orientation                 |
| Android with Scene Viewer         | The hosted model loads and the device opens the expected 3D or AR mode         |
| Desktop or unsupported browser    | Photos, written dimensions and the variant or buying controls remain available |

When using [model-viewer](https://modelviewer.dev/examples/augmentedreality/), test the AR mode you actually configured. Some setups provide a separate USDZ file and others create one during the handoff. See our [USDZ guide](/learn/usdz-file) for the difference.

## What should you check once the camera opens?

1. Choose an uncluttered floor in good light and wait for the phone to recognize it. Place the piece and compare its front and back with the reference photo.
2. Move around it and look for a tilted model, feet floating above the floor, or materials that change unexpectedly. Save the phone model, browser, variant and a brief capture with any issue.
3. Close the AR session. Check that you can get back to the correct product and select the intended variant without needing to load the model again.

| What you see                         | What to inspect before retrying                                      |
| ------------------------------------ | -------------------------------------------------------------------- |
| The piece starts turned sideways     | Export orientation and the direction visible in the browser viewer   |
| The base looks offset from the floor | Base geometry and the starting position in the exported model        |
| The product has the wrong finish     | Variant mapping plus the materials in both GLB and USDZ              |
| The camera cannot detect a surface   | Room lighting, phone support and the browser that opened the session |

For the source asset, see our guide to [making a 3D model](/learn/how-to-make-a-3d-model). Keep the store’s verified dimensions with the active variant so shoppers can use them independently of the model.

## FAQ

### Do the original photos and measurements still matter?

Keep the original photos and the supplier’s measurements linked to the selected variant. Shoppers can use AR to see how an object might look in a room and read the catalog measurements separately. Include width, depth and height next to the product specifications, with a unit for each value.

### Can I test furniture AR using a desktop browser?

A desktop can verify the web model, the product name and whether the QR image loads. Use an actual phone to scan, launch the native viewer, place the model and return to the store. Repeat on the iPhone and Android devices that cover the browsers you intend to support.

### What should shoppers see if their phone cannot open AR?

Leave the original photos, dimensions and product options visible, and offer the browser’s 3D viewer if it loads on that device. The important test is whether shoppers can return to the product page, select the right variant and add it to their cart without opening the camera session.
