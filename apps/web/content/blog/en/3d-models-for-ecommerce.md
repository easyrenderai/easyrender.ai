---

group: 3d-models-for-ecommerce
title: "3D for ecommerce: how stores get 3D models"
description: "3D for ecommerce: what a 3D product model adds, which files a store needs (GLB and USDZ), four ways to get one, and the limits to know first."
date: 2026-11-13
updated: 2026-11-15
author: Jorge Rodríguez
authorType: person
keyword: 3d for ecommerce
cta: Pick one piece with depth, an armchair or a sideboard, and check every angle before you decide whether 3D is worth it for your store.
---

3D for ecommerce means giving a product a 3D model, usually a GLB or USDZ file, that shoppers can spin on screen and, on a phone, place in their room with AR. Stores get these models in four ways: from a 3D artist, from the manufacturer's CAD files, by scanning the product, or with AI from a single photo.

![Illustration of a brown leather loafer beside its shoe box, the front of the loafer in real leather and the heel in matte grey clay with a white wireframe mesh, on a dark background](/blog/illustrations/3d-models-for-ecommerce/hero.webp "Illustration, not an easyrender result: a loafer drawn half as leather, half as a clay-and-wireframe mesh, next to its box.")

## From one furniture photo to Shopify product media

Use this repeatable workflow for one product before starting a batch. These instructions follow [Shopify's product-media documentation](https://help.shopify.com/en/manual/products/product-media/add-media); they are not a report of a completed store deployment.

1. Choose a sharp three-quarter photo showing the whole piece, including its feet. Keep the original product dimensions separately.
2. Upload it to easyrender and inspect the available preview. Check the back, leg count and open spaces before building the full model.
3. Download the GLB. Rotate the finished file and compare visible details with your source photo; reject an incorrect model even if generation succeeded.
4. In Shopify, open Products, select the product, then add the GLB in Media using Upload new. Wait for processing.
5. Check that your theme supports 3D media. Open the actual storefront on mobile and desktop, and verify texture, rotation and loading. Test AR separately on a compatible phone.

You can inspect our existing [armchair GLB](/showcase/armchair.glb) before generating your own. It contains 25,879 triangles and occupies 622,804 bytes, measured from that file on 15 November 2026. This is a downloadable sample, not evidence that your theme or every generated model will behave identically.

## Budget by usable model, not by successful job

Record each attempt, credits charged, refunds and whether the output passed your product check. Divide the net credits consumed by the number of models you accepted. A technically successful model with the wrong back or legs belongs in the cost, but not in the accepted-model count.

The standard complete generation is {{renderCredits}} credits; use the [current pricing](/pricing) for your currency and plan. Editing and additional operations can have separate quotes. If no model passes, report the spend and zero accepted models rather than claiming a cost per usable model.

For automation, the [REST API guide](/image-to-3d-api) includes executable Python and TypeScript examples with status polling. The [MCP integration](/mcp) exposes the same workflow to agents. Start with one reviewed product, then batch the inputs that pass your acceptance check.

## What does a 3D model add to a product page?

A photo shows the view you chose. A 3D model lets the shopper choose: the back of a bookcase, the underside of a coffee table, how thick the cushion on a lounge chair really is.

![A grey upholstered swivel armchair in its catalogue photo, seen from behind at three-quarters](/showcase/swivel-chair.jpg "The catalogue photo: one view, from behind, chosen by the photographer.")
![The same grey swivel armchair as a 3D model in a viewer, which the shopper can turn to see the front and the seat](/showcase/swivel-chair.glb "The model easyrender built from that photo: the shopper picks the view. The front is a prediction, because the photo only shows the back.")

On iPhone and iPad, a USDZ file opens in [AR Quick Look](https://developer.apple.com/augmented-reality/quick-look/) and places the object in the room through the camera. On Android, Google's [Scene Viewer](https://developers.google.com/ar/develop/scene-viewer) does the same with a GLB.

AR shows how a piece looks in a room. Its size comes from the file, not from a measurement: Scene Viewer reads one unit in the file as one metre, and a model generated from a photo opens at whatever size its file happens to say. So the dimensions belong in your product text.

## How do you measure whether 3D is worth it?

Decide what you want 3D to change before you pay for a model. For most furniture shops it is one of three things: fewer pre-sale questions about the back and the depth, more add-to-carts on the pages that get a model, and fewer returns where the reason is how the piece looked.

We do not publish conversion or return figures for 3D, because we have not measured any we can stand behind. Treat any figure you read as a claim to test on your own catalogue, with a method like this one.

Pick five to ten products that get a model and a matched group of similar products that do not. Keep prices, photos and text unchanged on both for four to six weeks. Then compare add-to-cart per product view between the two groups, and read the return reasons.

On your own site, [model-viewer](https://github.com/google/model-viewer/blob/master/packages/model-viewer/src/features/ar.ts) fires events you can send to your analytics. A `camera-change` event whose source is `user-interaction` means the shopper turned the model. An `ar-status` event reports an AR session starting or failing, and `quick-look-button-tapped` fires when an iPhone hands over to Quick Look.

## Which files does a store need for 3D?

GLB for the web and Android, USDZ for AR on Apple devices. Most platforms that support 3D take one or both.

![One product model split into two files: the GLB opens on a product page in any browser and in AR on Android through Scene Viewer, the USDZ opens in AR Quick Look on iPhone and iPad](diagram:store-files "One model, two files, three places a shopper meets it. A site you build yourself can serve both through model-viewer.")

### Shopify 3D models

[Shopify accepts 3D models as product media](https://help.shopify.com/en/manual/products/product-media/product-media-types), in GLB or USDZ, up to 500 MB, in the same place you add photos. A file over 15 MB has its geometry and textures optimised on upload. Shopify converts every model so that both a GLB and a USDZ version exist.

### WooCommerce and custom sites

WooCommerce stores add 3D through extensions, such as [Arty 3D Viewer](https://woocommerce.com/products/arty-3d-viewer/) in the WooCommerce marketplace. On a site you build yourself, Google's open-source [model-viewer](https://modelviewer.dev/) component shows a GLB, and `ar-modes="webxr scene-viewer quick-look"` hands each phone its own AR viewer.

### What file budget should a product model have?

Shopify takes big files, but a shopper's phone does not want them. Scene Viewer publishes the clearest budget we know of, so we hold our own files against it.

| Budget    | Scene Viewer recommends                         | The six models on our showcase |
| --------- | ----------------------------------------------- | ------------------------------ |
| Triangles | Up to 100,000, ideally 30,000 to 50,000         | 14,590 to 69,910               |
| Texture   | At most 2048 x 2048                             | One 1024 x 1024 texture each   |
| Materials | Up to 10                                        | One each                       |
| File size | 10 MB; bigger models may give a poor experience | 308,448 to 1,287,432 bytes     |

Scene Viewer also lists the glTF extensions it supports. A file that relies on one outside that list, such as WebP textures, may not open, so a GLB meant for Android AR is safest with PNG or JPEG textures. Open it on a real Android phone before you link it from a product page.

## Ways to create 3D product models

There are four. We judge them on four criteria: whether you need the product in hand, how much of your own time it takes, how true the hidden sides are, and where it fails.

### Hire a 3D artist

An artist builds the model from your photos, drawings and measurements. It needs no product in hand, costs the most time to brief and wait for, and gives the truest result, because nothing is guessed. Quotes on Fiverr or Upwork vary with the complexity of the piece.

Verdict: the right route when the model must be exact, such as a sofa sold in three widths, or for one hero product in a campaign.

### Use the manufacturer's CAD files

If you sell your own designs, the factory may already have CAD or SketchUp files. They are exact in shape, but rarely ready for the web: they usually need real textures and far fewer triangles before they load well on a phone.

Verdict: worth asking for first if you own the designs. Budget for the clean-up, since a factory file can carry far more detail than Scene Viewer's 100,000 triangles.

### Scan the product

Photogrammetry apps like Polycam and [RealityScan](https://dev.epicgames.com/documentation/realityscan-mobile/realityscan-step-by-step-guide) build a model from many overlapping photos. RealityScan starts processing after 20 images and takes up to 300. You need the piece in hand and room to walk all the way round it.

Verdict: the best route for textured pieces you have in your stockroom, such as a rattan chair or an oak sideboard. It fails on glass, mirrors and polished metal.

### Generate it from one photo with AI

Image-to-3D tools such as Meshy, Tripo and easyrender start from a single picture. It is the only route when you have a supplier photo and no access to the item. The photo only shows one side, so you check the back in the preview before you keep the model.

![Nine views of a matte stoneware vase, drawn from one product photo](/showcase/vase-angles.jpg "An angle sheet easyrender drew from one photo of a stoneware vase, unretouched. Round, matte objects like this are the easy case.")

Verdict: the route for a catalogue built from supplier photos. Fine logos, open weaves and a side the photo never showed are harder to read from one picture. Each route, with what it needs and where it fails, is in [how to make a 3D model](/learn/how-to-make-a-3d-model).

Hiring someone versus starting from a photo is in [hire a 3D modeler or use AI](/compare/3d-modeler-vs-ai). A closer look at two of the tools is in [Meshy](/compare/meshy) and [Tripo](/compare/tripo).

## 3D models for furniture stores: where to start

Rank your products before you make a single model. Score each one on four questions: does the back or the depth matter, is the price high enough that buyers hesitate, do people ask for more angles, and do returns mention the look?

Start with the five that score highest. That usually means an armchair, a sideboard or a floor lamp with a shaped shade. Flat items, like a framed print or a rug, gain little from 3D.

Then test routes before you commit. Run one product through two of them, for example a phone scan and an image-to-3D model of the same table lamp, and compare them on a phone. That tells you more than any feature list.

For a large catalogue, look at bulk options and pricing per model. easyrender lets you drop a set of catalogue photos into a library, check a free preview for each, and build only the ones that look right.

## How do you add 3D to a store, step by step?

This is the order we would follow for a first batch:

1. Pick five products with the four questions above.
2. Make each model by the route that fits it.
3. Check every model: the counts of legs and doors, the back, the texture at full screen.
4. Bring each file into the budget: textures at 2048 pixels or less, geometry compressed if your viewer supports it.
5. Upload with the platform's own tools, such as Shopify's product media.
6. Open each page on one iPhone and one Android phone over mobile data, and try AR on both.
7. Measure for four to six weeks as described above, then decide on the next batch.

## An example: a walnut sideboard

Say a shop has three supplier photos of a walnut sideboard: front, three-quarter and a close-up of the brass handles. The three-quarter shot is the one to use for image-to-3D, because it shows depth and one end panel.

![Three supplier photos of a sideboard drawn as frames: a straight front view with no depth, a three-quarter view showing the front and one end panel, marked as the one to use, and a close-up of a bar handle](diagram:sideboard-photo-pick "Of the three supplier shots, only the three-quarter one shows the end panel, so the tool has less depth to guess. A drawing for this example, not a real listing.")

Expect the doors, legs and wood grain to read well. Check the brass handles against the close-up, since small hardware is where any method loses detail first, and look closely at the back, which the tool has never seen.

Then upload the GLB with your platform's own tools and open the page on an iPhone and an Android phone before you publish. On Shopify, the USDZ for the iPhone is made for you from the same upload.

## What goes wrong when a store adds 3D?

Most problems show up only on a real phone, which is why step 6 exists. These are the ones to look for, with the fix for each.

| Symptom                               | Cause                                                                      | Fix                                                                                                                                                              |
| ------------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No AR button on an Android phone      | Scene Viewer loads files over HTTPS only, or the phone does not support it | Serve the GLB over HTTPS and test on a second phone                                                                                                              |
| No AR on an iPhone from your own site | No USDZ, or it is served with the wrong content type                       | Add the USDZ and serve it as `model/vnd.usdz+zip`, the type [Safari looks for](https://webkit.org/blog/8421/viewing-augmented-reality-assets-in-safari-for-ios/) |
| The piece opens huge or tiny in AR    | AR uses the size stored in the file, which was never measured              | Put the dimensions in the text; shoppers can pinch to resize                                                                                                     |
| The piece floats above the floor      | The bottom of the model sits above its origin                              | Move the origin to the base in Blender before you export                                                                                                         |
| The page is slow on mobile data       | 4096-pixel textures or uncompressed geometry                               | Textures at 2048 or 1024, and Draco or Meshopt compression where the viewer supports it                                                                          |
| The model looks dark or dirty in AR   | Shadows baked into the texture, which Scene Viewer advises against         | Use a texture without baked shadows, and set Metallic to 0 if the material leaves it unset                                                                       |
| The GLB fails to open in Scene Viewer | It uses a glTF extension Scene Viewer does not list, such as WebP textures | Export a plain version with PNG or JPEG textures                                                                                                                 |

## What are the limits of 3D for ecommerce?

A model generated from one photo shows shape and materials, not measurements. Keep the dimensions in the product text, and do not rely on AR to tell a shopper whether a piece fits.

Transparent and reflective products, like a glass vase or a chrome lamp, are hard for every method. Fine print and small logos come out soft.

3D does not replace photos. Platforms still use still images for search results, ads and category grids, so the [product photography for ecommerce](/learn/product-photography-for-ecommerce) basics still apply.

## FAQ

### Do I need 3D models for my online store?

Not for every product: 3D helps most where shoppers want to see depth and the back: chairs, sofas, sideboards, lamps. For flat or very simple items, good photos do the job. Start with a handful of products where buyers ask for more angles, and judge from there rather than converting the whole catalogue at once.

### Which 3D file format does an online store need?

Two, in most cases: GLB for the web and for AR on Android, and USDZ, the format iPhones and iPads open in AR Quick Look. Shopify accepts either and converts each model so both versions exist. If a tool only gives you one, Apple's Reality Converter on a Mac or Blender can make the other.

### How big should a 3D product model file be?

Small enough for a phone on mobile data. Google's Scene Viewer recommends at most 10 MB, 100,000 triangles and 2048-pixel textures, with 30,000 to 50,000 triangles as the ideal. Shopify accepts files up to 500 MB and optimises any over 15 MB, but a lighter file still loads faster for the shopper.

### How much does a 3D model for ecommerce cost?

It depends on the route. Artists quote per model by complexity, scanning apps usually charge a subscription, and AI tools charge per model or per month. On easyrender the preview is free and a finished model costs {{renderCredits}} credits ({{renderPrice}}); credits are pay as you go, or {{proCredits}} a month on Pro for {{proPrice}}.

### Can shoppers see a 3D product in AR at its real size?

They can see it in AR on most recent phones: iPhones and iPads use AR Quick Look with USDZ, Android uses Scene Viewer with GLB. The size is another matter. A model only appears at the real size if it was made with correct measurements, and a model generated from a photo was not.
