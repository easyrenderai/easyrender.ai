---

group: how-to-make-a-3d-model
title: "How to make a 3D model: five ways, with or without skills"
description: "How to make a 3D model five ways, from Blender to one photo: what each method needs, how long it takes, where it fails, and how to pick one."
date: 2026-11-16
updated: 2026-11-11
author: Jorge Rodríguez
authorType: person
keyword: how to make a 3d model
cta: If you have a sharp photo of a chair, a lamp or a sideboard, you can see it from every angle before deciding whether a model is worth making.
---

You can make a 3D model in five ways: build it in software like Blender, scan the object with photogrammetry, scan it with a phone's LiDAR sensor, generate it with AI from a photo, or hire a 3D artist. Which one fits depends on whether the object exists, whether you have it in hand, and how much time you have.

![Illustration of a walnut chess knight, its face and front in real carved wood and its back in matte grey clay with a white wireframe mesh, on a dark background](/blog/illustrations/how-to-make-a-3d-model/hero.webp "Illustration, not an easyrender result: a chess knight drawn half as walnut, half as a clay-and-wireframe mesh.")

> **Start with what you have.** A photo points to image-to-3D; an object you can walk around points to scanning. Use measured modeling when dimensions and hidden geometry must be exact.

## Which method should you pick?

If the object does not exist yet, model it in software or hire an artist. If it exists and is in front of you, scan it. If all you have is a photo of it, use image-to-3D.

![Decision tree: if the object does not exist yet, model it in software or hire an artist; if it exists but you only have a photo, use AI image-to-3D; if it is in front of you, use LiDAR for large simple shapes and photogrammetry for detailed surfaces](diagram:method-decision-tree "The three questions behind the table below. A 3D artist is also the answer whenever the model has to be exact.")

Accuracy roughly follows effort. An artist working from measurements gives the most exact model. A model generated from one photo is the quickest to get, and the sides the photo did not show come from that picture.

| Method               | What you need                                     | Your own time                                          | Best for                                     | Watch for                                                        |
| -------------------- | ------------------------------------------------- | ------------------------------------------------------ | -------------------------------------------- | ---------------------------------------------------------------- |
| Model it in software | Weeks of practice, reference photos, measurements | A day or more per piece, once you can use the software | Objects that do not exist yet                | Proportions, textures and UV mapping                             |
| Photogrammetry       | The object in hand, 20 to 100 or more photos      | An hour or two of shooting, plus processing            | Real surface detail                          | Plain white surfaces, glass, polished metal                      |
| LiDAR on a phone     | An iPhone Pro or iPad Pro, the object in hand     | A few minutes of walking round it                      | Large, simple shapes like a sofa             | Less detail: turned legs, woven seats                            |
| AI from a photo      | One sharp photo                                   | Checking the preview and the model                     | A supplier photo of a piece you cannot touch | The photo only shows one side, and the file has no measured size |
| Hire a 3D artist     | Photos, measurements and a budget                 | Writing the brief and reviewing drafts                 | Exact models, or one model in several sizes  | Time to brief and commission                                     |

One thing none of this covers is 3D printing. This guide is about models for screens, product pages and AR. A part you want to print needs a CAD model built from real measurements, which is a different job.

Whatever the method, aim at the same target. For a product page or AR on a phone, Google's [Scene Viewer](https://developers.google.com/ar/develop/scene-viewer) recommends at most 100,000 triangles, ideally 30,000 to 50,000, textures no larger than 2048 pixels, and a file of 10 MB or less.

## Method 1: Model it yourself in software

Blender is free, open source and exports GLB, FBX, OBJ and USD. SketchUp is gentler for furniture and buildings, because you [push and pull flat shapes](https://help.sketchup.com/en/sketchup/pushing-and-pulling-shapes-3d) into solids. [Tinkercad](https://www.tinkercad.com/help-center/what-is-tinkercad), a free app that runs in a browser, is the easiest place to learn basic shapes.

Expect weeks of practice before a chair you model looks right. The hard parts for beginners are proportions and textures. UV mapping, which unfolds a surface flat so an image can be painted onto it, is where most people stall.

For a simple piece like a side table, the workflow looks like this:

1. Gather reference: a front photo, a side photo and the real measurements.
2. Block out the main shapes with boxes and cylinders: top, legs, apron.
3. Bevel the edges slightly, so corners catch the light like real wood.
4. Unwrap the UVs, then add materials: a wood texture on the top, a metal finish on any handles.
5. Apply the object's scale and rotation, so the exported file keeps the size you modelled.
6. Check it from every side, underneath included, then export it as GLB.

![A side table modelled in three stages: rough boxes and cylinders for the top and legs, the same shapes with bevelled edges, then with a wood texture before export](diagram:blockout-side-table "Steps 2 to 6 on one simple table. Drawn for this guide.")

Two settings save most beginner models. In Blender, Object, Apply, All Transforms before export stops a table from arriving rotated or the wrong size in a viewer. And a checker texture on the model before the real one shows at once where a UV unwrap stretches.

## Method 2: Photogrammetry

Photogrammetry builds a model from many overlapping photos. [Polycam's guide](https://learn.poly.cam/hc/en-us/articles/27425185907348-How-to-Use-Object-Mode) asks for at least 20, with about 70% overlap between shots, taken in rings at different heights in soft, even light. Detailed objects need 100 or more.

![A floor lamp ringed by camera positions at three heights, low, middle and high looking down, with two neighbouring shots whose views overlap](diagram:photogrammetry-rings "How a photogrammetry capture is shot: rings at several heights, each photo sharing about 70% of its view with the next, as Polycam's guide asks.")

A capture that works follows the same few rules every time:

1. Use soft, even light: an overcast day outside, or a room with no direct sun.
2. Lock exposure on the phone, so the brightness does not change between shots.
3. Shoot a low ring, a middle ring and a high ring looking down, moving a step at a time.
4. Keep the object large in the frame: [RealityScan](https://dev.epicgames.com/documentation/realityscan-mobile/realityscan-step-by-step-guide) asks for it to fill at least half of each image.
5. Never move the object during a session. Move yourself.

RealityScan starts processing after 20 images and takes up to 300. Its guide puts the main limit plainly: what is not visible in several images will not show up in the model.

RealityScan and Polycam run it on a phone, and the open-source [Meshroom](https://alicevision.org/) runs it on a computer. It captures real surface detail well. It struggles with plain white surfaces, glass and polished metal, because it needs visible texture to match one photo to the next.

[Photogrammetry software vs one-photo AI](/compare/photogrammetry-software) sets out when this route is worth the setup.

## Method 3: LiDAR scanning on a phone

Pro iPhones from the iPhone 12 Pro on, and recent iPad Pro models, have a [LiDAR sensor](https://www.apple.com/newsroom/2020/03/apple-unveils-new-ipad-pro-with-lidar-scanner-and-trackpad-support-in-ipados/) that measures depth directly. Apps like Polycam use it to build a model as you walk round the object.

LiDAR is quick and handles large, simple shapes like a sofa well. It records less detail than photogrammetry, so turned legs and woven seats come out lumpy.

Walk slowly, at an even distance, and keep the room well lit: the depth comes from the sensor, but the colours come from the camera. A sofa against a wall needs to be pulled out first, or its back is simply missing.

## Method 4: Generate it with AI

AI tools make a model from a photo, called image-to-3D, or from a written description, called text-to-3D. Image-to-3D keeps the look of a real product. Text-to-3D invents one, which is fine for a concept and wrong for something you sell.

The method is the same in every tool: one sharp photo of the whole object on a plain background, then a check of the hidden sides before you keep the result. Each step is in [how to turn a photo into a 3D model](/learn/how-to-make-a-3d-model-from-photos).

![A matte stoneware vase in its catalogue photo, straight on against a white background](/showcase/vase.jpg "The one photo.")
![The 3D model easyrender built from that photo, a pale stoneware vase in a viewer that can be turned](/showcase/vase.glb "The model easyrender built from it, by way of a free angle sheet, textures compressed for this page: 16,708 triangles. Turn it and check the back, which the photo never showed.")

easyrender is one of these tools. It first draws a free sheet of nine views, eight round the object in 45-degree steps and one from above, then builds the model from those views. A finished model costs {{renderCredits}} credits ({{renderPrice}}). [Upload a photo](/)

It models one object at a time, such as furniture, decor and building exteriors. Meshy and Tripo also turn images into 3D models and add text-to-3D, each with its own pricing. A closer look is in [Meshy alternative for product photos](/compare/meshy) and [Tripo alternative for product photos](/compare/tripo).

To compare tools, run the same photo through two of them and judge five things side by side:

1. The back and the underside: plausible, or obviously invented?
2. The counts: legs, doors, drawers, handles.
3. The texture at full screen.
4. The file: triangles and size against the budget above.
5. The cost per finished model, and whether you can see a preview before you pay.

## Method 5: Hire a 3D artist

An artist models the object from your photos and measurements. It is the right choice when the model must be exact, such as a sofa sold in three widths, or when you need one polished model for an ad campaign.

A good brief removes most of the back and forth. Put these in it:

- Photos from every side, plus close-ups of each material and finish.
- The measurements, taken with a tape.
- The formats: GLB and USDZ for a product page.
- The budget: 30,000 to 50,000 triangles, textures at 2048 pixels or less, and as few materials as the piece allows.
- The source file, such as the .blend, so you can make changes later.

Freelance marketplaces such as Fiverr and Upwork list product modellers. Ask for a sample model, or a past one in the same category, before you commission a whole catalogue. Cost, time and when to hire versus start from a photo are in [hire a 3D modeler or use AI](/compare/3d-modeler-vs-ai).

## How much does a 3D model cost?

Free software costs time. An artist quotes per model, by complexity. Scanning apps and AI tools charge per model or by subscription, often after a free tier or a free preview.

On easyrender, credits cost {{creditPrice}} each and are pay as you go, from {{paygMinCredits}} credits. The Pro plan is {{proPrice}} a month for {{proCredits}} credits, and credits never expire.

## How do you check a finished model?

Whatever the method, open the model in a viewer and look underneath and behind, where errors hide. Then go through the same short list every time:

1. Spin it slowly at full screen, and stop at the back and the underside.
2. Count the parts against the real piece.
3. Zoom into the textures, because a fabric that looks fine as a thumbnail can be blurred up close.
4. Read the triangle count and file size, and compare them with the budget above.
5. Open it on a phone over mobile data, and try AR on an iPhone and on an Android phone.

For product pages you usually need two files: GLB for the web and Android, USDZ for AR on Apple devices. [What a GLB file is](/learn/glb-file) covers opening, checking and compressing one, and [what a USDZ file is](/learn/usdz-file) covers the Apple side.

## An example: one floor lamp, three ways

Take a floor lamp with a linen shade and a brass stem. In Blender, a beginner can block out the stem and shade in an afternoon. Making the linen look like linen takes far longer.

Photogrammetry struggles with the polished brass, which reflects the room and confuses the matching. People who scan for a living dull shiny parts with a temporary matte spray, which you would not do to stock.

Image-to-3D, from a clean catalogue shot, gets the overall shape and the colour of the shade. The thin stem is the part to check, because thin parts can come out bent or thicker than they are.

Our verdict for that lamp: image-to-3D if you only have the supplier photo, photogrammetry with the brass masked if it is in your stockroom, and an artist if it is the lamp your whole campaign is built on.

## What goes wrong with each method?

Each method fails in its own way, and each failure has a usual cause. This is the list to check a bad result against.

| Method          | What you see                                | Cause                                             | Fix                                                                |
| --------------- | ------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------ |
| Software        | The model arrives rotated or the wrong size | Object scale and rotation were never applied      | Apply all transforms, then export again                            |
| Software        | The wood grain stretches across one face    | A poor UV unwrap                                  | Check with a checker texture and unwrap that face again            |
| Photogrammetry  | Holes in a plain white table top            | Nothing for the software to match between photos  | Shoot it on an overcast day, or pick another method for that piece |
| Photogrammetry  | The base is missing or fused with the floor | The underside was never photographed              | Accept it, or shoot a second session with the piece on its side    |
| LiDAR           | Thin legs are lumpy or missing              | The parts are finer than the sensor resolves      | Use photogrammetry for that piece                                  |
| AI from a photo | The back does not match the piece           | The photo never showed that side                  | Use a three-quarter photo, or add a note about the back            |
| AI from a photo | A logo or label is a blur                   | Fine detail from one photo                        | Keep the logo in your photos, not in the model                     |
| Artist          | The model is late or wrong                  | A brief without measurements, formats or a budget | Send photos, measurements, formats and a triangle budget up front  |

## What are the limits of each method?

Models from one photo carry no measured size. Scans miss whatever the camera could not see, like the underside of a sofa that sits flat on the floor. Models you build yourself take time to learn, and artist models take time to commission.

All five methods make one object at a time. A whole furnished room is a different job from a single chair. For selling furniture and decor, [3D for ecommerce](/learn/3d-models-for-ecommerce) compares the routes for a catalogue, and [selling vintage furniture online](/learn/sell-vintage-furniture-online) covers one-off pieces.

## FAQ

### Do you need to learn Blender to make a 3D model?

No, scanning apps and image-to-3D both produce a model without any modelling. You still need a good eye, because checking the back, the textures and the thin parts is what separates a usable model from a strange one. Learning Blender pays off if you often need exact, editable models of things that do not exist yet.

### How long does it take to make a 3D model?

It varies by method more than by object: image-to-3D and phone scans take the least of your own time, and photogrammetry takes an hour or two of shooting plus processing. Modelling a chair in Blender can take a day once you know the software, after weeks of learning. Artists quote their own turnaround.

### Can you make a 3D model from one photo?

Yes, with an image-to-3D tool that starts from one photo, so the sides the camera did not see come from that picture. Check the back and fine details in the preview, especially where the photo did not show them. It works best with a sharp three-quarter shot of one object on a plain background.

### Is this the same as making a model for 3D printing?

No: models for screens and AR need to look right, while models for printing need exact measurements and a closed, printable shape. Image-to-3D and most scans give you the first kind. easyrender, for one, exports GLB and USDZ for the web and AR, not STL. For a printed part, use CAD software and real measurements.

### How many triangles should a 3D model have?

For a product page or phone AR, aim for 30,000 to 50,000, the ideal range Google's Scene Viewer gives, and stay under its recommended limit of 100,000. Our showcase models run from 14,590 triangles for a vase to 69,910 for a bedside table with drawers. Scans usually come out denser and need simplifying.
