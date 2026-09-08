56a36f8d023a923ce6d1bb2eb3d6f6e0c490d41c
fix_attempts: 1
regates_used: 1
result: verified

## Attempt 1 (fix_attempts was 0 → this attempt)
- Fix applied: src/app/(auth)/error.tsx (App Router route-group error boundary)
- Failure signature: HTTP/1.1 500, "page":"/_error" (Next's built-in Pages-Router-style crash fallback),
  err.message "forbidden_origin" — identical Content-Length (5645) to the pre-fix response.
- What changed since last attempt: nothing fixed it — the App Router error.tsx boundary is never reached
  for this failure. A raw multipart POST invoking a Server Action that throws is handled by Next through a
  request-level crash path, not the React render-tree error boundary error.tsx hooks into.
- Rule applied: Stage 5 rule 2 ("a different error than the one assessed") — the assessed remediation
  (add error.tsx) cannot address this mechanism regardless of how it's iterated. regates_used incremented
  to 1 (of max_regates: 1), fix_attempts reset to 0, returning to Stage 2 with a revised diagnosis.

## Attempt 2 (post re-gate 1)
- Fix applied: src/features/auth/actions.ts — completePasswordReset catches ForbiddenOriginError from
  assertSameOrigin and returns { status: "unknown" } instead of throwing.
- Verified: live reproduction against a dev server actually running this worktree (corrected a methodology
  error in attempt 1's live check, which had unknowingly hit the main checkout's stale server on port
  3000) now returns 200 with the recovery card instead of 500. Full suite green (340 files / 2775 tests),
  style-check and type-check clean.
- Outcome: verified. Stage 6 success.
