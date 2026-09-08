# Bug Fix: Password reset submission can fail with an opaque, unrecoverable page

- **Slug**: password-reset-error-boundary
- **Fixed**: 2026-09-08 (attempt 2, after re-gate 1)
- **Assessment**: ./assessment.md (see "Revised Diagnosis (re-gate 1)")
- **Status**: applied

## Summary

Attempt 1 added `src/app/(auth)/error.tsx`, an App Router error boundary. Live testing (Stage 4) showed
this does not catch the reported failure: a Server Action that throws during a raw multipart POST (the
progressive-enhancement fallback shape) is handled by Next.js through a request-level crash path
(`"page":"/_error"`, its built-in Pages-Router-style fallback), never reaching the React render-tree
boundary `error.tsx` hooks into. This attempt fixes the actual mechanism: `completePasswordReset` now
catches `ForbiddenOriginError` at its own call to `assertSameOrigin` and returns the existing typed
`{ status: "unknown" }` state instead of letting the exception propagate, so the action never throws in
the first place. `error.tsx` is kept (still correct for genuine render-time errors) but is no longer the
mechanism relied on for this bug.

## Changes

| File | Change | Notes |
|------|--------|-------|
| `src/features/auth/actions.ts` | modified | `completePasswordReset` wraps its `assertSameOrigin` call in `try`/`catch`; catches `ForbiddenOriginError` specifically and returns `{ status: "unknown" }`; re-throws anything else. `requestPasswordReset`, `requestOwnPasswordReset`, and every other call site are untouched — they keep throwing on a same-origin mismatch, as their own tests already assert. |
| `src/features/auth/actions.test.ts` | modified | The pre-existing test `"refuses a request whose Origin does not match APP_URL"` (in the `completePasswordReset` describe block) asserted `.rejects.toThrow()` — the exact old behavior this fix changes on purpose. Renamed to `"returns unknown, not a thrown error, when the Origin does not match APP_URL"` and updated to assert `result` equals `{ status: "unknown" }`. |
| `src/app/(auth)/error.tsx`, `src/app/(auth)/error.test.tsx` | unchanged (from attempt 1) | Kept as-is; not part of this attempt's changes. |

## Diff Highlights

```ts
// src/features/auth/actions.ts
export async function completePasswordReset(
  token: string,
  _prevState: CompletePasswordResetState,
  formData: FormData,
): Promise<CompletePasswordResetState> {
  try {
    assertSameOrigin({ headers: await headers() });
  } catch (error) {
    if (error instanceof ForbiddenOriginError) {
      return { status: "unknown" };
    }
    throw error;
  }
  ...
```

## Tests Added or Updated

- `src/features/auth/actions.test.ts::completePasswordReset (...) > returns unknown, not a thrown error, when the Origin does not match APP_URL` — was `"refuses a request whose Origin does not match APP_URL"` asserting `.rejects.toThrow()`; now asserts the typed return value.

## Local Verification

- `npx vitest run src/features/auth/actions.test.ts` → 37/37 pass.
- `npm run style-check` → no errors (one pre-existing, unrelated warning in `roster-table.tsx`).
- `npm run type-check` → passes.
- **Live re-reproduction, corrected methodology**: attempt 1's live verification was accidentally run
  against the dev server already listening on port 3000, whose process `cwd` is
  `/Users/toannguyen/one-team` — the **main checkout**, not this worktree — so it never saw either
  attempt's code changes; that is why attempt 1's live check still showed a 500 after the fix was
  applied. For this attempt, started a dev server *from this worktree* on port 3100
  (`PORT=3100 APP_URL=http://localhost:3100 npm run dev`) and re-ran both checks against it:
  - Happy path (valid token, matching Origin, real browser submission): still redirects to
    `/signin?reset=done` with the success message, exactly as before.
  - Failure path (same curl replay as the assessment/attempt-1, raw multipart POST with no `Origin`
    header): now returns `HTTP/1.1 200 OK` rendering the existing "This link isn't one we recognised"
    recovery card, instead of the previous `HTTP/1.1 500`. Confirmed the token's `used_at` is still `NULL`
    afterward (no partial state).
  - Test server stopped and its process killed after verification.

## Deviations from Assessment

- The revised assessment's instruction said to map "any other unexpected thrown error" to `unknown`. The
  actual implementation catches `ForbiddenOriginError` specifically and re-throws anything else. This is
  narrower than the literal wording, deliberately: broadening the catch to swallow genuinely unexpected
  errors (e.g. a real database failure) would silently present a misleading "link not recognised" message
  for an unrelated problem, contradicting this project's stated error-handling principle ("Reserve thrown
  errors for exceptional failures"). The confirmed, reproduced failure is specifically the `Origin` throw;
  this fix addresses exactly that, precisely, without masking other classes of failure.
- Discovered and updated a pre-existing test (`"refuses a request whose Origin does not match APP_URL"`)
  that explicitly pinned the old throw-based behavior for `completePasswordReset` specifically. This test
  was missed during the original assessment (which only reviewed `requestPasswordReset` and
  `requestOwnPasswordReset`'s equivalent tests). Updating it is necessary and intentional — the whole point
  of this fix is to change `completePasswordReset`'s behavior on this exact input.

## Follow-ups

- Same as attempt 1: the missing-error-boundary gap outside `(auth)` remains out of scope for this bug.
- Confirm with the user, when possible, that this is in fact what they experienced (the underlying trigger
  — a request reaching the app without a matching `Origin` header — could not be tied to a specific cause
  in their browser/environment from here).
