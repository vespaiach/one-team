# Bug Verification: Password reset submission can fail with an opaque, unrecoverable page

- **Slug**: password-reset-error-boundary
- **Tested**: 2026-09-08 (attempt 2, after re-gate 1)
- **Assessment**: ./assessment.md (see "Revised Diagnosis (re-gate 1)")
- **Fix**: ./fix.md
- **Result**: verified

## Summary

The revised fix (catch `ForbiddenOriginError` inside `completePasswordReset` and return the typed
`{ status: "unknown" }` state) resolves the reproduced failure. Re-running the exact same reproduction
that failed in the first attempt — this time against a dev server actually running this worktree's code,
correcting a methodology error from attempt 1 (see below) — now returns `HTTP/1.1 200` with the app's
existing "This link isn't one we recognised" recovery card, instead of the previous unrecoverable
`HTTP/1.1 500`. The full regression suite is green.

**Methodology correction**: attempt 1's post-fix reproduction was accidentally run against the dev server
already listening on port 3000, whose process `cwd` is `/Users/toannguyen/one-team` — the main checkout —
not this worktree, so it never saw either round of code changes. That is the actual reason attempt 1's
live check still showed a 500: not because `error.tsx` was ineffective for this mechanism (which remains
true and is why the fix was redirected), but the specific "still 500 after adding error.tsx" observation
was measured against stale, unrelated code. The reasoning that led to the re-gate (that `"page":"/_error"`
is Next's built-in crash fallback and bypasses App Router `error.tsx` boundaries) is a property of Next.js
itself, independently verifiable from the response body's own stack trace and confirmed unchanged in this
worktree's build too — so the re-gate's conclusion and this attempt's fix remain correct even though the
specific evidence-gathering had a flaw. This test round used a dev server started from this worktree
(`PORT=3100 APP_URL=http://localhost:3100 npm run dev`) to avoid repeating that mistake.

## Checks Performed

| Check | Command / Action | Result | Notes |
|-------|------------------|--------|-------|
| Reproduction (post-fix) | Fresh valid token → curl multipart POST to `/reset?token=...` with the page's real hidden Server Action fields, no `Origin` header, against a dev server serving **this worktree** | **pass** | `HTTP/1.1 200`, body renders "This link isn't one we recognised" (the `unknown` state), not a 500. Token's `used_at` confirmed still `NULL` afterward. |
| Happy path (regression) | Real browser: fresh valid token, matching `Origin`, full form submission | pass | Still redirects to `/signin?reset=done` with the success banner — unaffected by the fix. |
| New/updated tests | `npx vitest run src/features/auth/actions.test.ts` | pass | 37/37 pass, including the updated Origin-mismatch test. |
| Regression suite | `npm test` | pass | 340 test files, 2775 tests, exit 0. |
| Lint / type-check | `npm run style-check` / `npm run type-check` | pass | No errors (one pre-existing, unrelated warning in `roster-table.tsx`). |

## Output Excerpts

Post-fix response body (this worktree, port 3100), where the pre-fix response embedded a 500 crash
payload:

```
<h1 class="text-h1">This link isn&#x27;t one we recognise</h1>
<div role="alert" ...>This link isn&#x27;t one we recognise. Check the whole address came across from the email.</div>
```

`npm test` summary: `Test Files 340 passed (340)` / `Tests 2775 passed (2775)`.

## Residual Risks

- It remains unconfirmed that a real user's browser can actually omit or mismatch the `Origin` header on
  a same-origin POST (browsers attach it automatically and page JS cannot strip it) — noted in the
  assessment and unresolved from here. What this fix guarantees is that *whatever* causes
  `completePasswordReset` to hit that throw, the user now sees a recoverable message and an intact,
  unspent token instead of a crash — which is the actual reported symptom, independent of confirming the
  exact trigger.
- `src/app/(auth)/error.tsx` (attempt 1) remains in the tree. It is still correct and tested for genuine
  React-render-time errors in the `(auth)` route group; it is simply not what resolves this specific
  reproduction. No reason to remove it.

## Recommendation

Close the bug — verified end-to-end against this worktree's own running code, with the original
reproduction from the assessment no longer crashing, the happy path unaffected, and the full test suite
green.
