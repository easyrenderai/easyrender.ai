# Ship: finish the branch and get it merged

1. `git status` and read the diff. Stop if a secret or an `.env*` file is staged.
2. `bun run preflight`. Fix what fails; do not loosen a check or edit the UI guard allowlist
   upward.
3. Commit with a conventional subject. Push the branch (`git push -u origin <branch>`), never
   `main`.
4. Open a PR with `.github/pull_request_template.md`. State the finish condition and the evidence.
   Name any new env var that Vercel needs.
5. Wait for CI. Fix red checks on the same branch. Do not skip or delete a failing test.
6. Squash-merge when green. Merging does not deploy; production ships through the Release
   workflow (`RELEASING.md`). If the change should go live, say so and name the release it needs,
   and report it done only after that release's run finished green.
