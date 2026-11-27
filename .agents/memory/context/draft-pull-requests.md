---

name: draft-pull-requests
description: Vincent wants every draft PR merged: undraft, get CI green, merge. Never offer to close one.
type: feedback
---

A draft PR is work waiting to land, not work waiting to be closed. When one is open, take it out of
draft, bring it up to date with `main` (merge the base in; if its history has no merge base, replay
its commits onto `main` with `git cherry-pick -x` so the authorship stays), get CI green, and merge
it. Do not offer to close a draft or leave it open as a question.

**Why:** Vincent does not want open PRs left behind, especially when cutting a release, and
treats asking "close or keep?" as a failure to do the job.

**How to apply:** Before a release, list the open PRs and land every one, drafts included. Fix
what blocks CI yourself. If the replacement is a new PR, say so on the old one and close the old
one only after the new one has merged. Editorial or content gates written in a draft's body
(locale review, visual evidence) apply to promoting content to the public site, not to merging
drafts that ship nothing public.
