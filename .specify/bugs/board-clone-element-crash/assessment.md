# Bug Assessment: Board route crashes with "Element type is invalid"

- **Slug**: board-clone-element-crash
- **Created**: 2026-09-08
- **Source**: pasted text
- **Verdict**: valid
- **Severity**: critical

## Report (verbatim or summarized)

```
GET /projects/MOBILE 200 in 378ms (next.js: 289ms, proxy.ts: 11ms, application-code: 77ms)
[browser] Uncaught Error: Element type is invalid: expected a string (for built-in components) or a class/function (for composite components) but got: undefined. You likely forgot to export your component from the file it's defined in, or you might have mixed up default and named imports.
```

## Symptom

Visiting any project's board route (`/projects/<KEY>`) crashes at runtime. The server responds 200 and streams a valid loading skeleton, but when the deferred Suspense boundary resolves, React throws "Element type is invalid ... got: undefined" both during SSR and again on the client fallback re-render. The board is completely unusable — every project, not just `MOBILE`.

Expected: the board renders its lanes/cards and the grouping control without error.

## Reproduction

1. Sign in (seed user `ada.lovelace@one-team.test`, password from `scripts/seed.ts`'s `SEED_PASSWORD`).
2. Navigate to `GET /projects/MOBILE` (or any other seeded project key, e.g. `/projects/APOLLO`) — reproduces every time, deterministically, on a fresh request.
3. Observe the Next.js dev error overlay: "Element type is invalid: expected a string (for built-in components) or a class/function (for composite components) but got: undefined."
4. Contrast: `/projects/MOBILE/details` and `/projects/MOBILE/issues/1/details` — both also client-heavy, both behind their own `Suspense` boundaries, both using many of the same `react-aria-components` subpath imports — render correctly. Only the board route (`page.tsx` → `BoardScreen`) fails.
5. `npx vitest run src/features/board/components/board-screen.test.tsx` — 16/16 tests pass. The existing test suite does not catch this because Vitest/jsdom only exercises client-side rendering of `BoardScreen`; it never runs Next's actual server-side render of this "use client" component, which is where the crash happens.

## Suspected Code Paths

- `src/features/board/components/board-screen.tsx:128-139` — the only `cloneElement` call in the entire codebase (verified via `grep -rl cloneElement src`, zero other hits). It clones the `children` prop (a `<ProjectHeader>` element that crossed the Server→Client boundary, created in `src/app/(app)/projects/[projectKey]/page.tsx:22-35` inside the async server component `BoardData`) and injects a freshly created `<GroupingControl>` element into it as a new `control` prop.
- `src/features/board/components/board-screen.tsx:143-163` — the `lanes.map(...)` that renders one `<BoardLane>` per lane, directly inside the same returned `<>...</>` fragment as the cloned element above.
- `src/app/(app)/projects/[projectKey]/page.tsx:21-38` — `BoardData`, the async Server Component that renders `<BoardScreen board={board}><ProjectHeader .../></BoardScreen>`, wrapped in `<Suspense fallback={<BoardSkeleton />}>` at `page.tsx:45-50`.

## Root Cause Hypothesis

Confidence: **medium**.

The authoritative server-side React component stack captured from the actual crash (extracted from the Flight/RSC payload's `$RX(...)` error record in the streamed HTML) is:

```
at BoardScreen (.../board-screen.tsx via compiled chunk :226:24)
at BoardData [Server]
at BoardData [Server]
at Suspense
at ProjectBoardPage
```

`BoardScreen` is the innermost frame — no `BoardLane`, `GroupingControl`, `CardComposer`, or `IssueCard` frame appears above it. Since React only pushes a component onto this stack once its render function has actually started executing, this proves the crash happens while React is processing an element that `BoardScreen` returns directly, before any child component's own function body runs. That rules out a bug inside `BoardLane`/`GroupingControl`/`CardComposer`/`IssueCard` themselves.

Static inspection of every plausible "wrong import" explanation came up empty:
- `BoardLane` (`board-lane.tsx:24`) and `GroupingControl` (`grouping-control.tsx:16`) are both correctly `export function`-ed and correctly named-imported (verified byte-for-byte, no lookalike-unicode issue).
- The Turbopack SSR chunk (`.next/dev/server/chunks/ssr/src_0whg77f._.js`) shows both module references wired up correctly at the exact call sites — this isn't a bundler mis-resolution of the identifier.
- `react-aria-components` subpath imports (`react-aria-components/Button`, `/Select`, `/Popover`, `/ListBox`, `/GridList`, `/useDragAndDrop`, etc.) are used pervasively across the app, including on other `Suspense`-wrapped, client-heavy routes that render correctly (`/projects/[key]/details` via `columns-section.tsx`, which also uses `GridList` + `useDragAndDrop`; `/projects/[key]/issues/[n]/details` via `issue-rail.tsx`, which uses `Select`/`Popover`/`ListBox`/`Button`/`Label` — the same set `GroupingControl` uses). This rules out a blanket "subpath import breaks SSR" theory.

What's left, and unique to this one file, is `cloneElement`. It is the only call to `cloneElement` anywhere in `src`. It operates on `children`, which is not a plain locally-created element — it is a `<ProjectHeader>` element created on the far side of the Server→Client boundary (in the async Server Component `BoardData`) and handed into a `"use client"` component's props. Cloning that boundary-crossing element and grafting a brand-new client element (`<GroupingControl>`) onto it as a prop, then returning the clone alongside a second array of newly created elements (`lanes.map(...) → <BoardLane>`) in the same fragment, is a code shape that does not appear anywhere else in this codebase and that none of the working comparison routes exercise. The evidence points at this `cloneElement` usage as the most likely trigger of a Turbopack/Next 16 SSR-only inconsistency that ends up handing React an `undefined` element type for a sibling in the same children array — but the exact internal mechanism (why the *sibling* `BoardLane` array ends up with `type: undefined` rather than the cloned element itself) could not be pinned down further without instrumenting the framework internals, which is out of scope for a source-level fix.

## Proposed Remediation

**Preferred**: Stop cloning a Server→Client boundary-crossing element inside `BoardScreen`. Instead of receiving `children` as a pre-built `<ProjectHeader>` element and mutating it with `cloneElement`, have `BoardScreen` accept the grouping control as an explicit render-prop/slot, e.g. change the `children` contract to a function `(control: ReactNode) => ReactElement` (or add a dedicated `renderHeader`/`header` prop), and have the caller (`BoardData` in `page.tsx`) build `<ProjectHeader newIssue={...} />` itself, passing `control={<GroupingControl .../>}` directly — with `GroupingControl`'s state (`grouping`/`setGrouping`) then needing to live in `BoardScreen` and be threaded down through a prop instead of via `cloneElement`. This avoids `cloneElement` entirely and keeps the element-creation pattern consistent with the rest of the codebase (plain prop-drilling, no clone-and-mutate).

**Alternatives**:
- Keep `cloneElement` but verify against a real `next dev`/Turbopack run whether isolating it (e.g., removing the `GroupingControl` injection into the clone, and instead having `ProjectHeader` accept `grouping`/`onGroupingChange` primitives directly instead of a pre-built `control` element) resolves the crash. Lower confidence this is minimal, since the render-prop restructuring above avoids the clone altogether rather than trying to work around unconfirmed Turbopack behavior.

**Files likely to change**:
- `src/features/board/components/board-screen.tsx` (remove `cloneElement`, restructure how the grouping control reaches `ProjectHeader`)
- `src/app/(app)/projects/[projectKey]/page.tsx` (adjust how `BoardScreen`/`ProjectHeader` are composed)
- Possibly `src/features/projects/components/project-header.tsx` (if its `newIssue`/control slot prop shape needs to change)

**Tests to add or update**:
- A test that exercises the actual Next.js SSR path for the board route is not feasible under the current Vitest/jsdom setup (confirmed: the existing `board-screen.test.tsx` suite passes today despite the live bug, because it never performs a real SSR pass). The fix should therefore be validated by hand against a running `next dev` server (`GET /projects/<KEY>` returns the board without the runtime error), which `/speckit-bug-test` should do.
- Existing `board-screen.test.tsx` and `board-lane.test.tsx` coverage of grouping/drag behavior should keep passing after the restructuring, since it asserts on rendered output, not on the internal `cloneElement` mechanism.

## Risks & Considerations

- The restructuring touches the `children`/`control` contract between `BoardScreen` and `ProjectHeader`, both of which have several existing tests (`board-screen.test.tsx`, `board-assigned-non-member.test.tsx`, `board-mid-drag.test.tsx`, `board-parity.test.tsx`, `board-deleted-rows.test.tsx`, `board-affordances.test.tsx`, `board-admin.test.tsx`, `board-freshness.test.tsx`, `board-optimism.test.tsx`, `board-a11y.test.tsx`) that render `<BoardScreen>` directly and may pass `children`/expect the `control` slot — these will need to keep working with whatever new prop shape is chosen.
- Because the exact Turbopack-internal mechanism isn't fully pinned down, there's a chance removing `cloneElement` alone doesn't fully explain/fix the crash if some other factor is also involved; `/speckit-bug-test` verifying against a live `next dev` request for `/projects/<KEY>` is essential before declaring this fixed (Vitest passing is not sufficient evidence, as demonstrated above).

## Open Questions

- [NEEDS CLARIFICATION: The precise internal reason Turbopack's SSR pass turns the sibling `BoardLane` array's element type into `undefined` when `cloneElement` is used on a boundary-crossing element earlier in the same fragment. Not required to implement the proposed remediation, but would give higher confidence there isn't a second, independent contributing cause.]
