---

group: usdz-file
title: What is a USDZ file? AR Quick Look on iPhone, explained
description: "A USDZ file is the 3D format iPhone and iPad open in AR: what is inside it, how to open and make one, and why it can look the wrong size."
date: 2026-11-17
updated: 2026-11-11
author: Jorge Rodríguez
authorType: person
keyword: usdz file
cta: Pick a sharp photo of one piece, an oak side table or a floor lamp, and check every angle before you spend a credit.
---

A USDZ file is a 3D model packed in Pixar's Universal Scene Description format, USD, inside an uncompressed zip archive. Apple uses it for AR Quick Look, so an iPhone or iPad can open a USDZ from Safari, Files, Mail or Messages and place the object in the room through the camera. Android does not open USDZ.

![Illustration of a glowing mushroom table lamp beside a phone lying flat, the lamp's left half lit warm and its right half in matte grey clay with a white wireframe mesh, on a dark background](/blog/illustrations/usdz-file/hero.webp "Illustration, not an easyrender result: a lamp drawn half lit, half as a clay-and-wireframe mesh, beside a phone.")

> **Choose the format for the device.** Use USDZ for Apple Quick Look and keep a GLB version for the web and Android. Test the exported file on the actual phone.

## What is inside a USDZ file?

USD is the scene format Pixar built for film production. The [USDZ specification](https://openusd.org/release/spec_usdz.html) describes a zip archive with zero compression that holds USD layers and the images they use. Each file inside starts at a multiple of 64 bytes, so a device can read it in place without unpacking anything.

![A USDZ file drawn as a zip archive stored with zero compression, holding a USD layer with the mesh and materials and the texture images it points to](diagram:usdz-anatomy "What the USDZ specification describes. Because nothing is compressed, an iPhone reads each part straight out of the archive.")

USD layers come in two encodings: .usda is text you can read, and .usdc is binary. Textures are usually PNG or JPEG. Which ones a USDZ holds depends on the tool that wrote it, and that choice decides most of the file size.

Apple [introduced USDZ with ARKit 2](https://www.apple.com/newsroom/2018/06/apple-unveils-arkit-2/) at WWDC in June 2018, for iOS 12, alongside AR Quick Look. Since then it has been the format Apple devices expect for AR from a web page or a message.

## What decides the size of a USDZ file?

Two choices made by the tool that writes it. Geometry written as text, in .usda, takes several times the bytes of the same mesh in binary .usdc, because every number is spelled out in digits. Textures are the other half: a lossless PNG of a photo-like texture is usually several times the size of a JPEG of the same picture.

The image types the specification lists include PNG and JPEG but not WebP. So a GLB with WebP textures has its images converted on the way to USDZ, and the converter's choice of format decides how much they grow.

| Choice in the exporter | Smaller file                              | Larger file                    |
| ---------------------- | ----------------------------------------- | ------------------------------ |
| Geometry               | Binary .usdc                              | Text .usda                     |
| Texture format         | JPEG, unless the model needs transparency | PNG                            |
| Texture size           | 1024 or 2048 pixels                       | 4096 pixels                    |
| Mesh                   | Simplified to what a phone screen shows   | Every triangle of a dense scan |

None of these is an error, since Quick Look reads both encodings and both image formats. Size still matters, because a file of several megabytes is slower to send in Messages and to load on mobile data.

## How do you check what is inside a USDZ?

A USDZ is a zip, so `unzip -l side-table.usdz` lists every file inside with its size. You can see at once whether the geometry is .usda or .usdc and whether the textures are PNG or JPEG. Because the specification asks for no compression, the sizes listed are the real ones.

Then unzip a copy and open the main .usda layer in a text editor. `metersPerUnit` and `upAxis` say how big the model will appear and which way is up, and an anchoring line says whether Quick Look puts it on a horizontal surface, like a floor, or a vertical one, like a wall.

What to ask of an exporter: binary .usdc geometry, JPEG textures unless the model needs transparency, and textures of 2048 pixels or less. Compare the result with the size of the GLB, then open it in Quick Look on a Mac before it goes on a page.

## USDZ viewer: how do you open a USDZ file?

The device you are on decides how:

- iPhone and iPad: tap the file in Safari, Files, Mail or Messages. Quick Look opens it with an Object view and an AR view.
- Mac: select it in Finder and press the space bar for a Quick Look preview.
- Windows and Android: there is no built-in viewer. [Blender 3.5 and later](https://developer.blender.org/docs/release_notes/3.5/pipeline_assets_io/) import USDZ, so you can open it there.

[Apple's Quick Look page](https://developer.apple.com/augmented-reality/quick-look/) lists Safari, Messages, Mail, News and Notes among the apps that open USDZ, on iOS 12 or iPadOS 12 and later. If you need the same model on Android or in a browser, use its GLB version instead. [What a GLB file is](/learn/glb-file) covers that side.

<!-- IMAGE PENDING: a real iPhone screenshot of an easyrender USDZ (for example the bouclé armchair) open in Quick Look's Object view, unretouched. Not the AR view until AR is tested on device (REQ-00). -->

## How does AR Quick Look work on a web page?

A page links to the USDZ with `rel="ar"` around a preview image, and Safari adds a small AR badge to that image. [WebKit's guide](https://webkit.org/blog/8421/viewing-augmented-reality-assets-in-safari-for-ios/) shows the markup. Tapping the image opens the model in the room, with no app to install.

The setup has four details, and each one breaks it if it is missing:

1. Host the USDZ over HTTPS, served with the content type `model/vnd.usdz+zip`, which is the type Safari looks for.
2. Wrap a preview image in a link to the file: `<a rel="ar" href="side-table.usdz"><img src="side-table.jpg"></a>`.
3. Give the link a single child, an `img` or a `picture`, and nothing else.
4. Check support in script with `a.relList.supports("ar")`, and show a plain download link where it is false.

Google's open-source [model-viewer](https://modelviewer.dev/) component handles both systems from one snippet: it shows a GLB in the page and hands iPhones a USDZ for Quick Look.

![Two ways into AR Quick Look on an iPhone, a Safari page with an AR-badged preview image or a USDZ file tapped in Messages, Mail or Files, both opening the Object view and the AR view](diagram:quick-look-path "Both routes end in the same two views. The model appears at the size stored in its file, which for a model made from a photo is not a measured size.")

AR Quick Look places the model at the size stored in the file. If that size was never measured, the object can appear bigger or smaller than the real one, and the shopper can pinch to resize it anyway.

## How do you make a USDZ file?

There are four common ways, and they differ in where they run and what they are good at.

| Tool                       | Runs on             | Good at                                                       | Watch for                                      |
| -------------------------- | ------------------- | ------------------------------------------------------------- | ---------------------------------------------- |
| Apple's Reality Converter  | Mac                 | Checking the materials before you export                      | Mac only                                       |
| Blender 3.5 and later      | Mac, Windows, Linux | Editing the model before you export                           | Some Blender materials come out flatter in USD |
| The three.js USDZ exporter | Any browser         | No server, and the USDZ always matches its GLB                | Check the size and the materials in Quick Look |
| Shopify                    | Your store admin    | Converting each uploaded model so a GLB and a USDZ both exist | It decides the result, not you                 |

Reality Converter [converts files such as OBJ, glTF, FBX and USD](https://developer.apple.com/videos/play/wwdc2022/10141/) to USDZ. In Blender, use File, Export, Universal Scene Description and give the file a .usdz extension.

Our verdict: if you edit models, export from Blender and check the result in Quick Look on a Mac. If you sell on Shopify, upload the GLB and let it make the USDZ. If you build your own site, an in-browser export keeps one source file, so check its size against the GLB.

If you start from a photo, some image-to-3D tools export USDZ next to the GLB, so you skip the conversion. The steps are in [how to turn a photo into a 3D model](/learn/how-to-make-a-3d-model-from-photos).

easyrender gives you both files for every finished model. AR is included: open the piece on your phone and see it in your room. Keep the real dimensions in the product text, since AR shows a model at the size stored in its file.

## An example: an oak side table on an iPhone

Send yourself the USDZ of an oak side table by Messages and tap it. Quick Look opens the Object view first, where you can spin it with one finger. Switch to AR, point the camera at the floor, and the table appears on the spot you tap.

Walk round it and look where the legs meet the floor. A model whose base sits slightly off will appear to float.

![A round solid wood table as a 3D model in a viewer, that can be turned to check the legs from every side](/showcase/coffee-table.glb "A round solid wood table easyrender modelled from one photo, shown here from its GLB: 16,228 triangles. Its USDZ is made from this same GLB, so the two always match. Turn it and look where the legs meet the ground.")

Then check the grain under your own lamp, which is warmer than the studio light in the original photo.

## What goes wrong with a USDZ, and how do you fix it?

Most USDZ problems are in how the file is served or what the converter wrote. This is the list to check, from what you see to what to change.

| Symptom                                                   | Cause                                                                         | Fix                                                                      |
| --------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Tapping the link downloads the file instead of opening AR | The link has no `rel="ar"`, or the file is served with the wrong content type | Add `rel="ar"` and serve the file as `model/vnd.usdz+zip`                |
| No AR badge on the preview image                          | The link holds more than one child, or the device runs an iOS older than 12   | Give the link one `img` or `picture` child, and test on a current iPhone |
| The piece looks huge or tiny                              | Quick Look uses the size in the file, which was never measured                | Write the dimensions in the product text; shoppers can pinch to resize   |
| The piece floats above the floor                          | The base of the model sits above its origin                                   | Move the origin to the base in Blender, then export again                |
| Colours are flatter than in Blender                       | A material setup that does not translate to USD                               | Check in Quick Look on a Mac, and simplify the material                  |
| Curves look faceted                                       | The source GLB had no normals                                                 | Add smooth normals to the GLB before you convert it                      |
| The file is too big to send easily                        | Geometry written as text, textures as PNG                                     | Export with binary geometry and JPEG textures, then compare sizes        |

## GLB to USDZ: should you keep both?

Both, if the model goes on a product page. GLB covers the web and Android, and USDZ covers AR on Apple devices. Shopify, for example, accepts both as product media and makes the missing one itself.

The [guide to making a 3D model](/learn/how-to-make-a-3d-model) explains where both files come from, whichever method you use. For a store, [3D for ecommerce](/learn/3d-models-for-ecommerce) covers which products are worth it.

## FAQ

### Can you open a USDZ file on Android?

Not natively, because Android's AR uses Google's Scene Viewer, which reads glTF and GLB files rather than USDZ. To show the same model on Android, use a GLB version of it. If you only have the Apple file, Blender 3.5 or later can import the USDZ and export a GLB, though you should check the materials afterwards.

### Can you convert a USDZ to a GLB?

Yes. Import the USDZ into Blender 3.5 or later, then export it as glTF 2.0 in the binary GLB format. Check the result in a viewer, because USD and glTF describe surfaces differently and some material settings, such as a clear coat on lacquered wood, may not carry over exactly between the two formats.

### Why does a USDZ model look the wrong size in AR?

AR Quick Look uses the size stored in the file. If the model was never made with real measurements, as with models generated from a photo or scans without a reference, it can appear larger or smaller than the real piece. Treat AR as a way to see the look of an object, not to check whether it fits.

### Why is a USDZ bigger than the GLB it came from?

Usually because of what the converter writes. Geometry written as text takes several times the bytes of binary, and USDZ does not list WebP among its image types, so a small WebP texture is converted, often to a much larger PNG. Exporting binary .usdc geometry and JPEG textures brings the size back down.

### Is USDZ the same as USD?

USDZ is a package of USD. A USD scene can be a text file (.usda), a binary file (.usdc) or several files that reference each other. USDZ zips those layers and their textures into a single uncompressed file, which is what makes it easy to send by message and open on an iPhone.
