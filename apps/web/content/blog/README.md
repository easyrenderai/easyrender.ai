# Guides

How a guide is researched, written, checked, illustrated and translated is in
[`docs/blog/PIPELINE.md`](../../../../docs/blog/PIPELINE.md), with a prompt for every stage. This
file is the format.

One markdown file per post per language: `content/blog/{locale}/{slug}.md`. The file name is the
slug, so the English `glb-vs-usdz.md` is served at `/learn/glb-vs-usdz` and the Spanish one at
`/es/guias/glb-vs-usdz`. Native slugs per language are the point: write the Spanish slug in
Spanish.

```md
---

group: glb-vs-usdz
title: GLB or USDZ: which file do you need?
description: One sentence, under about 155 characters. It is the meta description and the card.
date: 2026-11-23
updated: 2026-11-30
keyword: glb to usdz
cta: One sentence shown above the closing button.
---

Body in markdown. Supported: `##`/`###`/`####` headings, paragraphs, `-` and `1.` lists,
`>` quotes, `---` rules, `**bold**`, `*italic*`, `` `code` `` and `[links](/learn)`.
```

### Inside the body

- **Prices** are never typed. Write `{{renderCredits}}`, `{{renderPrice}}`, `{{creditPrice}}`,
  `{{paygMinCredits}}`, `{{paygMinPrice}}`, `{{proPrice}}` or `{{proCredits}}`; the loader fills them
  from `@easyrender/harness`, the same source as the pricing page.
- **Images**: `![Alt text that describes the picture](/showcase/armchair.jpg "Optional caption")`
  on a line of its own. Only paths listed in `lib/blog/images.ts` render (with `next/image`, their
  real width and height, lazy loading; the hero is preloaded). Only real easyrender output, real
  screenshots, crops of them and drawn illustrations captioned as such go in that list. Any other
  path shows as text and fails `content.test.ts`.
- **3D models**: the same syntax with a GLB, `![Alt text](/showcase/armchair.glb "Caption")`. Only
  GLBs listed in `BLOG_MODELS` (`lib/blog/images.ts`) render. Each has a poster, a still of that
  GLB captured in model-viewer and not edited, which is in the server HTML with the alt text and
  the caption; the viewer loads when it nears the screen and takes the poster's place. Use each
  model in one guide only.
- **Diagrams**: `![Alt text that says what the diagram shows](diagram:glb-anatomy "Caption")`. A
  diagram is a React component in `components/blog/diagrams`, listed in `DIAGRAMS` there and in
  `BLOG_DIAGRAMS` (`lib/blog/images.ts`). It is drawn on the server as HTML or inline SVG on the
  site's colour tokens, so it reads without JavaScript and follows the light or dark scheme. Its
  words are per language inside the component (`{ en: {...} }`): a translated guide that uses a
  diagram needs its own block there, and `content.test.ts` fails until it has one. Diagrams stay
  greyscale and never carry measurements, scale bars or "will it fit" marks (claims.md).
- **The hero illustration**: every guide opens with its own illustration, on the line right after
  the first paragraph: `![What is drawn](/blog/illustrations/{group}/hero.webp "Illustration, not an easyrender result: …")`.
  It is made for that guide in the house style, Style A2: a dark, technical 3D render of one
  object split in two, half in its real material and half in matte grey clay with a fine white
  wireframe mesh, under a white rim light, on a charcoal-to-black radial gradient background and
  a dark glossy floor with a contact shadow. The only accent colour comes from the real material.
  16:9, 1280×720 WebP; no text, UI, logos, numbers or measurements. Each guide shows a different
  object, never one of the home demo objects (the armchair), and no image is reused across guides.
  It is at least 1200 pixels wide, registered in `BLOG_IMAGES`, and it is also the guide's
  BlogPosting and Open Graph image. Other illustrations live in the same folder, and every one
  says in its caption that it is an illustration, never an easyrender result; an illustration is
  never presented as product output.
- **Crops**: a second picture of an object already shown in another guide is its own file under
  `public/blog/figures/{slug}/`, cropped from the real asset and registered in `BLOG_IMAGES`, with
  a caption that says what it is cropped from. Never re-colour or reshape it.
- **One guide per asset**: no image, crop, model or diagram path appears in two guides, and none
  twice in the same guide (`content.test.ts` checks both).
- **Side by side**: two image or model lines with no blank line between them show as two columns,
  for a comparison such as the photo next to the model built from it.
- **Tables**: a markdown table with a header row and a `| --- |` divider. Use one only when it
  helps the reader decide (tone guide 5c), never the same table in two guides.
- **Every guide shows at least one real picture or model**, with alt text and a caption. A table
  does not count.
- **Missing images**: leave `<!-- IMAGE PENDING: what the picture must show -->`. Comments are
  stripped before rendering, structured data and llms-full.txt. A drawn illustration that is still
  to be generated is `<!-- ILLUSTRATION PENDING: target path, ratio, what it shows -->`; its caption
  has to say it is an illustration, never an easyrender result, and it is only added once the file
  exists.
- **FAQ**: a `## FAQ` section with one `### Question?` per item. It always renders as an accordion
  (the shadcn `Accordion`), with every answer mounted in the server HTML while closed and shown
  without JavaScript. The same questions become the page's FAQPage structured data, so what
  crawlers read is what readers can open.
- **Links between guides**: link freely. A link to a guide whose date has not come yet shows as
  plain text and becomes a link on that guide's day.
- The closing call to action is the button under the post (with the `cta` sentence). The body
  may hold one more link to the home, mid-post, and no closing CTA section of its own.

`lib/blog/content.test.ts` checks every English guide against these rules and the tone guide:
title and description length, the 40-60 word opening answer, paragraph length, the FAQ, the
link to the core guide, prices, images and the claims. `lib/blog/guide-rules.test.ts` checks the
pipeline's rules (stage 5): the hero under the first paragraph and as the Open Graph image, the
FAQ accordion against the FAQPage, one creative per 400 words of prose (at least five), and
inline sources from at least three outside sites. It covers every English guide and each
translation once it carries its illustration.

## The fields

| Field         | Required | What it does                                                                                                                                                                                                          |
| ------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `group`       | yes      | Ties the translations of one post together. The six files of the same post share it, and that is how hreflang and the language picker find each other. Keep it stable: changing it breaks the link between languages. |
| `title`       | yes      | The `<h1>` and the `<title>` (see title length below).                                                                                                                                                                |
| `description` | yes      | The meta description, the Open Graph description and the card text.                                                                                                                                                   |
| `date`        | yes      | Publication date, `YYYY-MM-DD` (00:00 UTC) or a full ISO instant.                                                                                                                                                     |
| `updated`     | no       | Date of the last real change. Shown next to the date and used as `dateModified` and `lastmod` once it is later than `date`; an edit made before the publication day leaves both at the publication date.              |
| `keyword`     | no       | The target query, for the record. Rendered only as `keywords` in the structured data.                                                                                                                                 |
| `author`      | no       | The byline and the structured-data author. Defaults to `easyrender team`, published as an Organization.                                                                                                               |
| `authorType`  | no       | `organization` (default) or `person`. Use `person` only for a real person who has agreed to sign.                                                                                                                     |
| `authorUrl`   | no       | Site-relative or absolute URL of the author's page.                                                                                                                                                                   |
| `cta`         | no       | The sentence above the closing "Upload a photo" button.                                                                                                                                                               |
| title length  | —        | The `<title>` is the title plus ` · easyrender` when that fits in 60 characters, and the title alone otherwise. Keep the title itself at 60 or fewer.                                                                 |

## Publishing one post a day in six languages

`date` is a schedule, not a label. A post with a date in the future is invisible everywhere: not
in the hub, not in the sitemap, and its own URL answers 404. On its day it appears by itself,
with no deploy, because the pages are server rendered and the sitemaps revalidate every ten
minutes.

So a week of posts, in every language that has them reviewed, can be committed at once with
seven different dates.

## What stops a language from going live

A language only serves pages once it is in `ROUTABLE_LOCALES` in `i18n/config.ts`. A guide
translation also needs the independent per-locale review described in the
[`blog pipeline`](../../../../docs/blog/PIPELINE.md). Unroutable files are parsed but never
served, linked or listed in other languages' hreflang metadata.

A malformed file is skipped with a warning in the server log rather than breaking the hub, so
check the log after adding one.
