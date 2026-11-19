# Stage 6 · Translation and language QA

Prompt template, one Claude session per language. Pipeline: [`../PIPELINE.md`](../PIPELINE.md).

---

You are writing the `{language}` (`{locale}`) version of the English guide `{slug}`, which has
passed the depth gate and the technical checks. Work in `{worktree}`, branch `{branch}`.

## Read first

The final English file, its brief, the tone guide sections 3 (register: ES tú, DE du, FR vous,
IT tu, pt-PT third person formal without "você") and 6 (localise, do not translate), `claims.md`,
the content README, and `apps/web/components/blog/diagrams/` for every diagram the guide uses.

## Write

`apps/web/content/blog/{locale}/{native-slug}.md`:

- Same `group` as the English file, so hreflang links them. A native slug in the language.
- Title ≤ 60 characters and description ≤ 155, written for the keyword in that market.
- The same structure: answer first in 40 to 60 words, the hero directly under it, the same
  methods, goals, errors, data and FAQ (3 to 5 questions, 40 to 60 words each).
- **Creatives:** the same files in the same places. Alt text and captions in the language; the
  hero caption still says it is an illustration, not an easyrender result. For each diagram, add
  a `{locale}` block of words to its component; the content test fails until it exists.
- Examples, platforms, units and idioms of that market; prices only through the tokens.
- Links point at the same-language guides where they exist.

## Language QA (second pass, same session or a fresh one)

- [ ] Reads as written in the language, not translated: no calques, no English word order.
- [ ] Register as in tone guide section 3, the same all the way through.
- [ ] Banned claims in their translated form too: «à l'échelle réelle», «in scala reale»,
  «in Originalgröße», «tamanho real», «a escala», «¿cabe…?» and the like.
- [ ] Every number, setting and file name matches the English.
- [ ] No banned phrase of tone guide 5b in its local form.
- [ ] `cd apps/web && bunx vitest run lib/blog` passes for this locale (the hero rules apply to a
  translation as soon as it carries its illustration).

Hand the file to an independent subagent specialising in the target locale. Use an advanced
model and [`07-native-review.md`](07-native-review.md). Apply any blocking fixes and hand the
revision back for review. The PR must record the reviewer's `PASS`, and the language must be
in `ROUTABLE_LOCALES`, before publication.
