# Stage 6b · Independent language review

Use this prompt with a fresh subagent specialising in one target locale and running an advanced
editorial model. Pipeline: [`../PIPELINE.md`](../PIPELINE.md).

---

Review the `{locale}` revision `{revision}` of `{slug}` for native-quality language. Read the
final English source, translated article, tone guide, claims and translated visuals. Review
independently of the writer. Read the guide as a customer in that market would, including on a
phone where a preview is available. Give the writer precise findings and replacement text.

- [ ] It sounds like a person from here wrote it. Mark every sentence that "sounds translated" or
  "sounds like AI".
- [ ] The register is right for the market and the same all the way through.
- [ ] The terms are the ones local sellers use (for example «mueble de salón», «telemóvel»).
- [ ] The examples and platforms make sense here.
- [ ] Numbers, files, operations, approval steps and claims match the English source and evidence.
- [ ] Nothing promises real size, scale or a fit, in any wording. Nothing offers 3D printing.
- [ ] Title, description, opening and FAQs match the target search intent and editorial limits.
- [ ] Internal links point to the right locale and exist in the publication batch or the live site.
- [ ] Captions and alt texts read naturally; the hero caption says it is an illustration.
- [ ] The words inside the diagrams are right and fit their boxes.
- [ ] The FAQ answers the questions people here actually ask.

Return `PASS` or `HOLD`, followed by the locale, slug, reviewed revision and model. For `HOLD`,
list each blocker, its location and the correction. The writer handles fixes. Review the new
revision again before marking it `PASS`. The editorial owner records the final verdict and any
verification limits on the PR, identifying the reviewer as a subagent.
