# Bug Verification: Board route crashes with "Element type is invalid"

- **Slug**: board-clone-element-crash
- **Tested**: 2026-09-08
- **Assessment**: ./assessment.md
- **Fix**: ./fix.md
- **Result**: verified

## Summary

The original crash (`GET /projects/<KEY>` throwing "Element type is invalid ... got: undefined") no longer reproduces against a live `next dev` server with real seeded data, on either of the two routes confirmed broken pre-fix (`/projects/MOBILE`, `/projects/APOLLO`). The full test suite, type-check, style-check, and production build all pass.

## Checks Performed

| Check | Command / Action | Result | Notes |
|-------|------------------|--------|-------|
| Reproduction (post-fix) | Signed in as seeded user `ada.lovelace@one-team.test`; `GET /projects/MOBILE` and `GET /projects/APOLLO` via a real `next dev` (Turbopack) server against a freshly seeded local Postgres | pass | Board renders (lanes, cards, Group by control, header with Board/Details tabs). No runtime error overlay. Verified with a brand-new browser tab (empty console buffer) to rule out stale console history: `read_console_messages` returned "No console logs." on both routes. |
| New / updated tests | `npx vitest run src/features/board/components/board-screen.test.tsx src/features/board/components/board-a11y.test.tsx src/features/board/components/board-admin.test.tsx src/features/board/components/board-assigned-non-member.test.tsx src/features/board/components/board-parity.test.tsx "src/app/(app)/projects/[projectKey]/page.test.ts"` | pass | 65/65 tests, including the new "the header names the project, on the board tab (FR-004, FR-007)" test. |
| Regression suite | `npm test` (full suite) | pass | 339 test files, 2773/2773 tests passed. |
| Lint / type-check | `npm run style-check` then `npx tsc --noEmit -p .` | pass | style-check: 0 errors (1 pre-existing, unrelated `<img>` warning in `roster-table.tsx`, unrelated to this change). type-check: clean. |
| Build | `npm run build` | pass | Compiled successfully; all 15 routes generated, including `/projects/[projectKey]`. |
| Full gate | `npm run verify` | pass | style-check → type-check → test → build, all green in one run. |

## Output Excerpts

```
Test Files  339 passed (339)
     Tests  2773 passed (2773)
```

```
✓ Compiled successfully in 2.0s
  Finished TypeScript in 761ms ...
✓ Generating static pages using 7 workers (14/14) in 130ms
```

Live check — fresh tab, both previously-broken routes:
```
read_console_messages(onlyErrors, tab-2, /projects/MOBILE)  → "No console logs."
read_console_messages(onlyErrors, tab-2, /projects/APOLLO)  → "No console logs."
```

## Residual Risks

- The reproduction was run against this worktree's own local Postgres (seeded via `npm run seed` specifically for this verification, since the worktree's dev database started empty) and a `next dev` instance on a non-default port (3000 was occupied by another checkout's dev server). `APP_URL` and the dev-server port were temporarily adjusted in `.env`/`.claude/launch.json` for this check and reverted afterward — both files are gitignored, so no tracked change resulted from this. The verification itself exercised the real, unmodified production code path (Turbopack SSR of a `"use client"` component behind a `Suspense` boundary), so this is not considered a meaningfully different environment from the one the bug was originally reported in.
- No automated test exercises Next's actual SSR-of-client-components path (this is exactly why the original bug was invisible to Vitest); the live `next dev` check above is the only guard against a regression of this specific class of bug. Future changes to `BoardScreen`'s props or to how it composes `ProjectHeader` should be spot-checked the same way, not just via `npm test`.

## Recommendation

Close the bug — verified end-to-end, both via the full local test/type/build gate and by reproducing the exact failing request against a live server with real data and confirming it now renders cleanly with zero console errors.
