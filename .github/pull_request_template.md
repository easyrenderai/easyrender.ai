<!--
Title = squash commit subject, Conventional Commits: `type(scope): summary`
(feat, fix, docs, refactor, test, chore, build, ci, perf). Lowercase, imperative, no trailing period.
-->

## Summary

<!-- What changed, and what outcome does it produce for a user or a developer? -->

## Related issue

<!-- `Closes #123` when this PR fully resolves the work, `Refs #123` while acceptance is still outstanding. No issue: write `No-Issue` and one sentence why. -->

## Scope

<!-- Public contracts touched (API paths, MCP tools, webhooks), schema changes, new env vars
that Vercel needs, work left out on purpose. -->

## Verification

<!-- Commands you ran and their results. State the finish condition and show it met: repro before
and pass after for a bug, a walked flow or a read-back value for a feature. Say which checks you
could not run. -->

## Screenshots

<!-- Required for visible UI changes: 375px and desktop, each under both OS colour preferences (the site is always dark). Otherwise "Not applicable". -->

## Checklist

- [ ] `bun run preflight` passes
- [ ] No secrets, `.env*` files or customer data in the diff
- [ ] New strings are in all six `messages/*.json` files (en, es, de, fr, it, pt; email namespaces are en and es only)
- [ ] New env vars are in `.env.example` and `turbo.json`
