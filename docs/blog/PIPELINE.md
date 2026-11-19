# Blog pipeline

This file is the single source of truth for how an easyrender guide is researched, written,
checked, illustrated, translated and published. The prompt for each stage is in
[`prompts/`](prompts). Copies outside the repo (for example `~/easyrender/pipeline-blog/` on the
team Mac) are mirrors of these files: when they differ, this folder wins.

Rules set by Jorge on 10-nov-2026 that every stage serves:

- **Depth.** Every guide explains methods (concrete steps and settings), goals (what the reader is
  trying to achieve and how to measure it), typical errors with their fixes, and easyrender's
  first-hand view with real numbers from our own files. No filler. (22:35, «le falta chicha».)
- **A hero illustration** directly under the first paragraph, unique to the guide. It illustrates
  the concept of the intro and need not show furniture.
- **The FAQ always renders as an accordion**, with the answers in the server HTML and the same
  questions in the FAQPage JSON-LD.
- **No creative repeats across guides**: images, crops, diagrams, 3D models, illustrations.
- **Never publish weaknesses or limitations of easyrender's own models or exports.** Internal
  findings go to the product team as a bug list, not into the post. Generic facts about a format
  or a method may stay when they are phrased generically, never as a defect of our output.
  (10-nov-2026 ~23:48, «Quítalos del blog».)
- The pipeline enforces these by design (22:39, «rehaz el pipeline para que sea acorde a estos
  requisitos»).

## What every stage reads

| Source                                                | Where                                                                               | What it decides                                           |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Tone guide, incl. 5b (no AI voice) and 5c (creatives) | `contenido/materiales/decisiones/tono-de-voz.md` (team materials, outside the repo) | Voice, paragraph rules, banned phrases, creatives, depth  |
| Claims                                                | `contenido/materiales/decisiones/claims.md`                                         | What we may and may not say. It wins over everything else |
| Decision log                                          | `contenido/materiales/decisiones/DECISIONES.md`                                     | Cadence, languages, approvals                             |
| Keyword map                                           | `contenido/materiales/canales/04-seo/KEYWORD-MAP.md`, `keyword-map-200.csv`         | One keyword per URL, no cannibalisation                   |
| Content format                                        | [`apps/web/content/blog/README.md`](../../apps/web/content/blog/README.md)          | Front matter, markdown subset, images, diagrams, FAQ      |
| Asset registry                                        | `apps/web/lib/blog/images.ts`, `apps/web/components/blog/diagrams/`                 | Which pictures, models, diagrams and illustrations exist  |
| Prices                                                | `packages/harness/src/pricing.ts`, through the `{{renderCredits}}`-style tokens     | Never typed by hand                                       |

## Roles

| Role                       | Who                                                                                | Owns                                      |
| -------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------- |
| Researcher and writer      | Claude (one session per post)                                                      | Stages 1 and 2                            |
| Depth editor               | A second Claude session with a fresh context, which did not write the draft        | Stage 3 verdict                           |
| Final editorial say        | Jorge (or Ale, who has the same rights)                                            | Overrides any verdict; approves the merge |
| Illustrations              | Juanito, with Higgsfield, from the prompt in the brief                             | Stage 4 hero illustration                 |
| Diagrams, crops, posters   | Claude                                                                             | Stage 4 everything else                   |
| Translator and language QA | Claude, one session per language                                                   | Stage 6                                   |
| Language reviewer          | An independent subagent specialising in the target locale, using an advanced model | Stage 6b verdict                          |

## The stages

Each post moves through the stages in order. A post that fails a gate goes back to the stage the
gate names, never forward.

### 1. Research brief

Before a word of the guide is written, the writer fills a brief from
[`prompts/01-research-brief.md`](prompts/01-research-brief.md) and commits it as
`docs/blog/briefs/{group}.md`. It holds:

- The search intent and the reader's goals, each with a way to measure it.
- The methods to cover, step by step, with the settings that matter.
- The typical errors, as symptom, cause and fix.
- easyrender's angle and first-hand data: which repo files and which numbers (asset sizes,
  triangle counts, harness limits, experiments run on copies of our assets). A finding that shows
  a weakness or limitation of our own models or exports goes to the product team as a bug list,
  not into the brief's material for the post.
- The outside sources, each with its URL and the exact fact taken from it. A fact we cannot open
  and read is left out.
- The SERP gaps: what the top results do not cover, and how this guide will.
- The creatives plan, including the Higgsfield prompt for the hero illustration (stage 4).

**Exit:** every section of the brief is filled with something specific. "Explain the settings" is
not specific; "phone: Photo mode, AE/AF lock, exposure down a third for white fabric" is.

### 2. English draft with depth

The writer drafts `apps/web/content/blog/en/{slug}.md` from the brief with
[`prompts/02-en-draft.md`](prompts/02-en-draft.md): answer first in 40 to 60 words, question H2s,
methods with real settings, goals and how to measure them, a symptom/cause/fix section, our own
data and what we learned, and a comparison only where it helps the reader decide, with its
criteria and a verdict per case. Tone guide 5b applies to every sentence. No invented statistics:
an outside figure has its source link inline, or it goes.

**Exit:** `bun run test` passes for the guide (stage 5 checks run from the first draft).

### 3. Depth and editorial gate

A second Claude session scores the draft against the rubric in
[`prompts/03-depth-gate.md`](prompts/03-depth-gate.md): methods, goals, errors, own point of view,
sourced data, no padding, originality against the SERP, plus tone, claims and own output (no
weakness or limitation of easyrender's own models or exports in the post).

- **Who decides:** the depth editor gives the verdict. Jorge or Ale can override it either way.
- **How it is recorded:** the editor appends the filled rubric and the verdict (`PASS` or
  `BACK TO STAGE 2`, with the failing items) to the brief, `docs/blog/briefs/{group}.md`, and
  posts the same verdict as a comment on the post's PR.
- **If it fails:** the post goes back to stage 2 with the list of failing items. The writer fixes
  those items only, and the gate runs again on the new draft.

**Exit:** `PASS` recorded in the brief and on the PR.

### 4. Creatives

With [`prompts/04-creatives.md`](prompts/04-creatives.md):

- **Hero illustration, mandatory.** Directly under the first paragraph. A flat editorial
  illustration made with Higgsfield by Juanito from the prompt in the brief: no text, no logos,
  no measurements or scale marks, nothing that could pass for an easyrender result or a team
  photo. At least 1200 pixels wide, saved as WebP at
  `apps/web/public/blog/illustrations/{group}/hero.webp`. Its caption starts with
  "Illustration, not an easyrender result:". It is also the guide's BlogPosting and Open Graph
  image, picked automatically as the first image of the body that is 1200 pixels wide or more.
- **Explanatory creatives.** Diagrams (`components/blog/diagrams`), crops of real assets, real
  easyrender GLBs in the viewer with their poster, real screenshots, short videos. Each one
  explains something the text needs. Tables and checklists only where they help a reader decide.
- **No repeats.** No image, crop, diagram, model or illustration path appears in two guides.
- **AI images are illustrative only.** Never presented as product output, never as a photo of the
  team or of a customer. A missing real photo is an `IMAGE PENDING` note, never an AI stand-in.

**Exit:** every creative is registered (`BLOG_IMAGES`, `BLOG_MODELS`, `BLOG_DIAGRAMS`) with its
real size, has alt text and a caption, and the stage 5 checks pass.

### 5. Technical checks

Run `bun run preflight`, which CI runs on every push. The checks that enforce these rules, and
fail the build when a guide breaks one, are listed with the test that holds each:

| Rule                                                                                                    | Test                  |
| ------------------------------------------------------------------------------------------------------- | --------------------- |
| Title ≤ 60, description ≤ 155, keyword and `updated` set                                                | `content.test.ts`     |
| Answer first in 40 to 60 words; paragraphs ≤ 3 sentences and ≤ 60 words                                 | `content.test.ts`     |
| FAQ of 3 to 5 questions, answers of 40 to 60 words                                                      | `content.test.ts`     |
| Links to the core guide, at most one home link in the text, no dead guide links                         | `content.test.ts`     |
| No typed price, no em dash, no exclamation, no listed AI phrase                                         | `content.test.ts`     |
| claims.md: no "to scale", "true-to-size", "will it fit?"; STL, printing or embed only ruled out         | `content.test.ts`     |
| Every image known, sized, captioned; each creative in one guide only                                    | `content.test.ts`     |
| Diagrams exist and have words in the guide's language                                                   | `content.test.ts`     |
| Hero illustration directly under the first paragraph, registered, ≥ 1200 px, in the guide's own folder  | `guide-rules.test.ts` |
| The hero is the BlogPosting and Open Graph image                                                        | `guide-rules.test.ts` |
| Every illustration's caption says it is an illustration                                                 | `guide-rules.test.ts` |
| The FAQ renders as an accordion, every answer in the server HTML, as many items as FAQPage questions    | `guide-rules.test.ts` |
| At least one creative per 400 words of prose, never fewer than 5, at least one besides the illustration | `guide-rules.test.ts` |
| Inline citations from at least 3 outside sites                                                          | `guide-rules.test.ts` |
| Each English guide has its own illustration, and no registered illustration is unused                   | `guide-rules.test.ts` |

`guide-rules.test.ts` applies to every English guide and to each translation once it carries its
illustration, so translations written before these rules keep building until they are redone.

What no test can judge, and stage 3 and the reviewer must: whether a step is correct, whether a
number is real, whether a paragraph says anything. Also check the page itself: `next build`,
`next start`, then the post without JavaScript (title, meta, JSON-LD, figures and FAQ answers in
the HTML), and the accordion and the figures at 375 px and on desktop in light and dark. Say which
of these were not run.

### 6. Translation, language QA and independent language review

With [`prompts/06-translation.md`](prompts/06-translation.md), once the English guide has passed
stages 3 to 5:

1. **Translate per language** (es, de, fr, it, pt-PT) from the final English, writing for that
   market rather than translating sentence by sentence (tone guide, section 6). Same `group`,
   native slug, register from tone guide section 3.
2. **Localise every creative.** The same hero file, with alt text and caption in the language. A
   block of words for the language in every diagram the guide uses
   (`components/blog/diagrams/*.tsx`). Localised FAQ, still 3 to 5 questions.
3. **Language QA**, a second pass per language, with the checklist in the same prompt:
   claims translated too ("à l'échelle réelle", "in Originalgröße" and so on are banned), no
   machine-translation tells, numbers and units, links pointing at the same-language guides.
4. **Independent language review.** Start a separate subagent for each locale (es-ES, de-DE,
   fr-FR, it-IT and pt-PT), with a fresh context and an explicit assignment for that market. Use
   the strongest available model suited to editorial review, with high reasoning when available.
   Give it the final English source, the translated article, the relevant visuals and
   [`prompts/07-native-review.md`](prompts/07-native-review.md). The reviewer checks the translation
   with the vocabulary, register and expectations of a reader from that market.
5. **Review loop.** The reviewer gives a `PASS` or identifies blocking edits. The writer fixes the
   blockers and sends the revised text and visuals back for independent review. Record the
   locale, model, revision and final verdict on the PR. A translation can go live after its
   own `PASS`. The subagent's recorded verdict is the language sign-off.

A language only serves pages once it is in `ROUTABLE_LOCALES` (see the content README).

### 7. Publication

- Cadence: one post a day, in the six languages that have it reviewed (decision of 10-nov-2026,
  15:50). A week of posts can be committed at once with seven dates.
- Every change goes through a draft PR into `main`. **No merge without Jorge's explicit yes**, even
  when CI is green; this overrides the general rule in `AGENTS.md` for blog content.
- After the merge and the production [release](../../RELEASING.md), check each published locale:
  HTTP 200, JSON-LD, hero, FAQ accordion, sitemap and matching hreflang links.

## Definition of done for one guide

- [ ] Brief in `docs/blog/briefs/{group}.md`, with sources and the hero prompt.
- [ ] Stage 3 verdict `PASS` in the brief and on the PR.
- [ ] Hero illustration in place, registered, captioned as an illustration.
- [ ] `bun run preflight` green.
- [ ] Rendered page checked without JavaScript; browser checks done or listed as not run.
- [ ] Each translation has passed language QA and has an independent locale review recorded on the PR, or is listed as pending.
- [ ] Jorge's yes on the PR.
