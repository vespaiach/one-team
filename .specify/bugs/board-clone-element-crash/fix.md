# Bug Fix: Board route crashes with "Element type is invalid"

- **Slug**: board-clone-element-crash
- **Fixed**: 2026-09-08
- **Assessment**: ./assessment.md
- **Status**: applied

## Summary

`BoardScreen` no longer receives a pre-built `<ProjectHeader>` element as `children` and `cloneElement`s it to inject the grouping control. Instead `BoardScreen` now builds `<ProjectHeader>` itself, receiving only plain data (`commentCount`) and an already-valid client element (`newIssue`) as ordinary props — the same pattern `ProjectDetailsScreen` already uses successfully for the same `newIssue`/`ProjectHeader` composition on the details route.

## Changes

| File | Change | Notes |
|------|--------|-------|
| `src/features/board/components/board-screen.tsx` | modified | Removed `cloneElement`; `BoardScreen` now imports `ProjectHeader` directly and renders it with `control={<GroupingControl .../>}`, `commentCount`, and `newIssue` (both now plain props, not `children`). |
| `src/app/(app)/projects/[projectKey]/page.tsx` | modified | `BoardData` now passes `commentCount` and `newIssue` as props to `<BoardScreen>` instead of building `<ProjectHeader>` itself and passing it as `children`. |
| `src/features/board/components/board-a11y.test.tsx`, `board-admin.test.tsx`, `board-assigned-non-member.test.tsx`, `board-parity.test.tsx`, `board-screen.test.tsx` | modified | Removed the local `Header` stub component and the `children` prop these tests passed to `BoardScreen` (no longer a valid prop). `board-screen.test.tsx`'s header-composition test now queries the real header via `getByRole("banner")` instead of the stub's `data-region="header"` marker; a new test pins that the real header names the project and selects the Board tab (FR-004, FR-007), replacing coverage that moved out of `page.test.ts`. |
| `src/features/board/components/board-affordances.test.tsx` | modified | `headerOf`/`headerNewIssue` now look for `BoardScreen`'s `newIssue` prop directly instead of digging into a `ProjectHeader` element that page.tsx no longer creates. |
| `src/app/(app)/projects/[projectKey]/page.test.ts` | modified | The two tests that inspected `ProjectHeader`'s props (now an internal detail of `BoardScreen`) instead assert on `BoardScreen`'s own `board`/`commentCount` props, which is what `page.tsx` is still responsible for. |

## Diff Highlights

```tsx
// src/features/board/components/board-screen.tsx
export function BoardScreen({
  board,
  commentCount,
  newIssue,
}: {
  board: BoardView;
  commentCount?: number;
  newIssue?: ReactNode;
}) {
  ...
  return (
    <>
      <ProjectHeader
        projectKey={board.project.key}
        name={board.project.name}
        current="board"
        commentCount={commentCount}
        newIssue={newIssue}
        control={<GroupingControl grouping={grouping} onChange={setGrouping} />}
      />
      <div data-region="board" ...>
```

```tsx
// src/app/(app)/projects/[projectKey]/page.tsx
return (
  <BoardScreen
    board={board}
    commentCount={commentCount}
    newIssue={<NewIssueControl projectKey={board.project.key} canWrite={board.canWrite} writeReason={...} />}
  />
);
```

## Tests Added or Updated

- `src/features/board/components/board-screen.test.tsx::BoardScreen — the header names the project, on the board tab (FR-004, FR-007)` — new test pinning that the real header (not a test stub) shows the project name and selects the Board tab, since that composition responsibility moved from `page.tsx` into `board-screen.tsx`.
- `src/features/board/components/board-screen.test.tsx::BoardScreen — the grouping control belongs to the header (FR-005)` — updated to query the real `<header>` via `getByRole("banner")`.
- `src/features/board/components/board-a11y.test.tsx::names every button, link and text input on a writable board` — updated to exclude the header's now-visible Board/Details tabs (`role="tab"`) from the "controls the board feature adds" assertion, since those tabs belong to the (now unconditionally rendered) shared `ProjectHeader`, not the board feature itself.
- `src/app/(app)/projects/[projectKey]/page.test.ts` — the two `ProjectHeader`-prop assertions were rewritten to assert on `BoardScreen`'s `board`/`commentCount` props instead, since page.tsx no longer builds `ProjectHeader`.
- `src/features/board/components/board-affordances.test.tsx` — `headerNewIssue` rewritten to read `BoardScreen`'s `newIssue` prop instead of an unreachable nested `ProjectHeader`.

## Local Verification

- Commands run:
  - `npx tsc --noEmit -p .` → clean, no errors.
  - `npm test` (full suite) → 339 files, 2773/2773 tests passed.
  - `npm run style-check` → 0 errors (1 pre-existing, unrelated `<img>` warning in `roster-table.tsx`).
  - `npm run build` → compiled successfully, all 15 routes generated including `/projects/[projectKey]`.
  - `npm run verify` (full gate: style-check, type-check, test, build) → all green.
- Manual checks (live `next dev`, real Postgres, seeded data):
  - Signed in as the seeded `ada.lovelace@one-team.test` user.
  - `GET /projects/MOBILE` and `GET /projects/APOLLO` (the two routes that crashed before the fix) now render the real board — lanes, cards, the "Group by" control, and the header with Board/Details tabs — with **no runtime error overlay** and **zero console errors** on a freshly opened browser tab.
  - Confirmed this against the actual bug report's repro command shape (`GET /projects/MOBILE`), not just the test suite, since the original bug was invisible to Vitest (client-only jsdom rendering never exercises Next's real SSR-of-client-components path).

## Deviations from Assessment

The assessment's proposed remediation (a render-prop `children: (control: ReactNode) => ReactElement` on `BoardScreen`) was tried first and reverted: it removed `cloneElement`, but passing that plain closure as `children` from the Server Component `BoardData` into the `"use client"` `BoardScreen` produced a *different*, very explicit React error — "Functions are not valid as a child of Client Components... you meant to call this function rather than return it" — because raw functions cannot cross the Server→Client (RSC Flight) props boundary. This confirmed the assessment's core diagnosis (something about how `BoardScreen` received its header content across that boundary was the problem) while showing the *specific* replacement mechanism it proposed didn't work.

The fix that actually shipped instead has `BoardScreen` build `<ProjectHeader>` itself from plain, already-boundary-safe props (`commentCount: number`, `newIssue: ReactNode` — a valid client element), mirroring the exact pattern `ProjectDetailsScreen` already uses successfully for the same `ProjectHeader`/`newIssue` composition on the sibling details route. No `cloneElement`, no function props — only plain data and valid elements cross the boundary, both of which are proven-safe in this codebase today.

This did expand the file scope beyond what the assessment listed for tests: five board test files that injected a lightweight `Header` stub via `children` needed updating (that prop no longer exists), and `page.test.ts` / `board-affordances.test.tsx` needed their shallow-JSX-tree walkers updated because `ProjectHeader` is no longer a child of `BoardScreen` in the tree `page.tsx` returns — it's now an implementation detail `BoardScreen` builds internally. These were called out as at-risk in the assessment's **Risks & Considerations** section.

## Follow-ups

- None identified. The architecture now matches the existing, working `ProjectDetailsScreen` pattern, so there's no remaining asymmetry to clean up.
