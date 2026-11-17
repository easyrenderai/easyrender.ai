---

name: react-effects
description: useEffect is ratcheted; how to remove or justify one, and what the baseline check does
type: feedback
---

`bun run check:use-effects` (scripts/check-use-effect.ts) counts `useEffect` / `useLayoutEffect`
calls and async effects without an abort per source file against
`scripts/use-effect-baseline.json`. New file or higher count fails; a lower count fails until
`--prune` rewrites the baseline. CI also fails if the baseline grew compared with `main`.

**Why:** effects that fetch, sync state or derive values cause races, double fetches and stale UI.
Most of them are not needed.

**How to apply:** in order, derive in render, do it in the event handler that caused it, reset with
a `key`, or use the existing data hook. Keep an effect only to subscribe to a system outside React
and put `// use-effect-audit: ignore <reason>` on the line above (reason required). An async effect
needs an `AbortController` and passes its `signal`. After removing effects run
`bun run check:use-effects --prune` and commit the smaller baseline. Never raise a count.
