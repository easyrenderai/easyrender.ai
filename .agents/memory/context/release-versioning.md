---

name: release-versioning
description: Every release is a patch bump until Vincent says to bump minor or major
type: feedback
---

Every release is a patch bump (v0.5.2 to v0.5.3 and so on). Do not propose or make a minor or
major bump, however many features are waiting on `main`. Vincent decides when that changes and
says so himself.

**Why:** the version number only means something when Vincent chooses to move it. New features
landing on `main` are not a reason to bump the minor.

**How to apply:** when you bump the root `package.json` version for a release, increase the patch
number only, and use the matching `vX.Y.Z` tag when dispatching the Release workflow (see
`RELEASING.md`). When you report unreleased changes, name the next patch version. Releasing itself
still waits for Vincent's go-ahead.
