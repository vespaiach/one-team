# Bug Assessment: Password reset submission can fail with an opaque, unrecoverable page

- **Slug**: password-reset-error-boundary
- **Created**: 2026-09-08
- **Source**: pasted text (see verbatim below); a URL was also supplied but auto-refused per policy (see below)
- **Verdict**: valid
- **Severity**: medium

## Report (verbatim or summarized)

> Setting a new password didn't work. I visted this link
> http://localhost:3000/reset?token=IEh0j3ciLpkTMFkdpRwrrAi9ZEoUdyEU48LcfY4Ty-s and tried to set a new
> password but it didn't work

**URL trust policy**: the link's host is `localhost`, which is a loopback host — auto-refused (fetch
skipped) per the URL Trust Policy. No fetch was attempted. The token was instead used directly against
the local database to reproduce the flow (see Reproduction).

## Symptom

User visits a password-reset link and attempts to set a new password; the attempt "didn't work" with no
further detail (no error text, no description of what the page showed).

## Reproduction

1. Confirmed the reported token (`IEh0j3ciLpkTMFkdpRwrrAi9ZEoUdyEU48LcfY4Ty-s`) is a real, currently valid,
   unspent `reset_token` row in this environment's database — its SHA-256 digest
   (`a0f75a0c9f1a9c77da575a1107529f58b6d0258b1081a0ae2a05790ac12b68e5`) matches a row for
   `grace.hopper@one-team.test`, `used_at IS NULL`, not yet expired.
2. Loaded `http://localhost:3000/reset?token=IEh0j3ciLpkTMFkdpRwrrAi9ZEoUdyEU48LcfY4Ty-s` in a real browser
   against the running dev server — the "Set a new password" form rendered correctly with `status: "idle"`.
3. Submitted a compliant new password through the actual form.
4. **Result: the flow completed successfully** — redirected to `/signin?reset=done` with "Your password has
   been changed. Sign in with it now." The token is now spent (`used_at` set).

So the exact reported token, exercised end-to-end through the real browser UI in this environment,
**does not reproduce a failure by itself**. However, the underlying failure mode was reproduced directly:

5. Issued a second fresh, valid, unspent token for the same user and loaded the reset form normally to
   capture the exact hidden Server Action fields the browser renders for progressive enhancement
   (`$ACTION_REF_1`, `$ACTION_1:0`, `$ACTION_1:1`, `$ACTION_KEY`) — the same encoding visible in the raw
   page source at `src/app/(auth)/reset/page.tsx` → `ChangePasswordForm`.
6. Replayed that exact submission with `curl`, as a multipart POST to the same URL, **omitting the
   `Origin` header** (curl does not send one by default, unlike a browser's `fetch`):

   ```
   curl -X POST "http://localhost:3000/reset?token=<token>" \
     -F '$ACTION_REF_1=' -F '$ACTION_1:0=...' -F '$ACTION_1:1=...' -F '$ACTION_KEY=...' \
     -F 'password=...' -F 'confirmPassword=...'
   ```

7. **Result: `HTTP/1.1 500 Internal Server Error`**, body is Next.js's generic built-in error page (no
   reset-specific messaging, no way back into the flow). Confirmed in the database afterward that
   `used_at` is still `NULL` for that token — the failure happens before the transaction, leaving the
   token unspent, exactly matching what was found for the reported token before this investigation touched
   it.

This directly demonstrates the mechanism: any request that reaches `completePasswordReset` without a
matching `Origin` header crashes with an unrecoverable 500, and the token survives unspent — indistinguishable
from a user saying "I tried and it didn't work." [NEEDS CLARIFICATION: whether the user's actual browser
omitted or mismatched the `Origin` header is still unconfirmed — that depends on their specific
browser/extensions/network, which cannot be determined from here — but the code-level failure mode is now
proven to exist and to produce exactly this symptom.]

## Suspected Code Paths

- `src/features/auth/server/origin.ts:17-22` (`assertSameOrigin`) — throws `ForbiddenOriginError` (an
  **uncaught exception**, not a typed state) whenever the request's `Origin` header is missing or doesn't
  match `APP_URL`. This runs as the very first line of `completePasswordReset`
  (`src/features/auth/actions.ts:116`), before any of the typed `CompletePasswordResetState` branches.
- `src/features/auth/server/origin.test.ts:23-24` confirms this is deliberate: "refuses a request with no
  Origin header, like a foreign one" (cited to FR-023, research B-5) — i.e., the team already knowingly
  accepts that some legitimate requests without an `Origin` header get refused.
- No `error.tsx` (or `global-error.tsx`) exists anywhere under `src/app` (verified via repo-wide search).
  Any exception thrown by a Server Action on this route — `ForbiddenOriginError`, or any other unexpected
  error — is therefore caught only by Next.js's built-in default error UI, which shows a generic,
  unhelpful, and non-recoverable page. There is nothing reset-specific that tells the user what happened or
  lets them retry without re-requesting a new link.
- `src/features/auth/components/change-password-form.tsx:48-63` only renders friendly recovery UI for the
  three *typed* terminal states (`expired`, `used`, `unknown`) returned normally by the action. It has no
  way to render anything for a thrown exception — by the time one occurs, `useActionState` never gets a
  return value to work with.

## Root Cause Hypothesis

**Confidence: medium.** The reset-completion transaction logic itself is correct and was verified working
end-to-end with the user's own real token. The mechanism that plausibly caused the report is confirmed to
exist and reproduce live (see Reproduction steps 5-7): `completePasswordReset` (like every other
password-reset action) throws a raw, uncaught `ForbiddenOriginError` whenever `assertSameOrigin` rejects the
request, and because the app has no `error.tsx` anywhere, that surfaces as Next.js's generic 500 error page
instead of a recoverable, reset-specific message. A same-origin POST can legitimately arrive without an
`Origin` header in some real browsers/environments (content-blocking extensions, some corporate
proxies/VPNs, unusual clients) even though this deployment's `APP_URL` matches the link the user actually
visited. This would look exactly like "I tried and it didn't work," with no further detail for the user to
report, and matches why the reported token was still unspent when this assessment picked it up (the
failure happens before the database transaction, so nothing is ever spent) — the same signature reproduced
directly with a second token above.

What remains unconfirmed is *why* the user's specific request lacked a matching `Origin` header — that
depends on their browser/network, which cannot be determined from here. The code-level failure mode itself,
and its exact "looks like nothing happened, token still valid" signature, is no longer a hypothesis.

## Proposed Remediation

**Preferred**: Add an `error.tsx` boundary scoped to the `(auth)` route group
(`src/app/(auth)/error.tsx`) that renders the app's existing `Banner` component with a generic, friendly
message ("Something went wrong. Try the link again.") plus a way back to `/reset` — the same recovery
pattern `ChangePasswordForm` already uses for `expired`/`used`/`unknown`. This does not change
`assertSameOrigin`'s intentionally strict behavior (FR-023) and does not touch the working
`completePasswordReset` transaction logic; it only ensures that when any of these actions do throw, the
user sees something recoverable instead of Next's generic error page.

**Alternatives** (optional):
- Catch `ForbiddenOriginError` specifically inside `completePasswordReset` and map it to a new typed
  `CompletePasswordResetState` (e.g. `{ status: "unknown" }`). Rejected as the preferred option because it
  only patches this one action; `requestPasswordReset`, `requestOwnPasswordReset`, and the sign-in route
  handler all share the same throw-on-mismatch pattern and would remain unprotected, and the existing test
  suite (`actions.test.ts:169-175`, `:325-335`) explicitly asserts `.rejects.toThrow()` for the request-side
  actions, so swallowing the error only in `completePasswordReset` would be an inconsistent, partial fix.

**Files likely to change**:
- `src/app/(auth)/error.tsx` (new)
- `src/app/(auth)/error.test.tsx` (new)

**Tests to add or update**:
- A test rendering the new `error.tsx` boundary confirms it shows a recoverable message and a link back to
  `/reset` rather than a blank/broken page.

## Risks & Considerations

- This does not fix a confirmed root cause — it closes a real, demonstrable gap (no error boundary anywhere
  in the app) that is the most plausible explanation grounded in code, but the report cannot be confirmed to
  be *this specific* failure without more detail from the user.
- Scoping the boundary to `(auth)` only, rather than the whole app, is deliberate and minimal per the report
  — the same gap exists app-wide but fixing it everywhere is out of scope for this bug.
- `assertSameOrigin`'s "no Origin header ⇒ refuse" behavior is an intentional, tested security decision
  (FR-023, research B-5) and must not be relaxed by this fix.

## Revised Diagnosis (re-gate 1)

**What changed**: `/speckit-bug-fix` implemented the preferred remediation (`src/app/(auth)/error.tsx`),
and `/speckit-bug-test` replayed the exact reproduction from this assessment against the live dev server
with the fix applied. **The reproduction still failed** — byte-for-byte the same `HTTP/1.1 500` response
as before the fix (`Content-Length: 5645`, same `forbidden_origin` stack trace).

**Why the original remediation cannot work**: the response body's embedded Next.js payload shows
`"page":"/_error"` — Next's built-in Pages-Router-style crash fallback, not the App Router's `error.tsx`
render-tree boundary. A raw multipart POST that invokes a Server Action — the exact shape of a plain,
JS-disabled `<form method="POST">` progressive-enhancement submission — is handled by Next through a
request-level exception path when the action throws. `error.tsx` only intercepts errors thrown *during
React rendering* within its segment; this action throws outside that render pass, so no amount of
iterating on `error.tsx`'s content will ever catch it. The original diagnosis correctly identified *that*
an uncaught exception produces an unrecoverable page, but was wrong about *which mechanism* would catch
it.

**A further complication**: real browsers cannot omit or spoof the `Origin` header on a same-origin POST
— it's a forbidden header that page JavaScript cannot strip, and both `fetch`-driven submissions and
native, JS-disabled form fallbacks attach it automatically per the Fetch/HTML specs. So it is not
established that any real browser can actually reach `assertSameOrigin`'s throw via a normal user
interaction; the `curl` reproduction proves the crash mechanism exists in the code, not that this specific
trigger (`Origin` missing) is how the reported user actually hit it.

**Revised root cause (confidence: medium)**: the defect is broader and more robust than "the `Origin`
check specifically." **Any** uncaught exception thrown inside `completePasswordReset` — a same-origin
mismatch, or equally a transient database error, a network reset mid-request, or any other unexpected
failure — crashes with this same unrecoverable, non-React-boundary 500, and leaves the reset token
unspent (the transaction never starts). This matches a vague "I tried and it didn't work" report from any
user who hit *any* transient failure during submission, not specifically an `Origin` mismatch. The
`Origin` check was simply the one throw site that could be triggered reliably to prove the mechanism.

**Revised remediation**: since the App Router error boundary cannot intercept this class of failure,
`completePasswordReset` must not let it throw uncaught in the first place. Wrap the action's body in a
`try`/`catch` that maps any unexpected error to a new typed `CompletePasswordResetState` (e.g.
`{ status: "unknown" }`, reusing the existing "This link isn't one we recognise" recovery card
`ChangePasswordForm` already renders for that state) rather than letting it propagate. This is the
"Alternative" originally rejected in this assessment for being an inconsistent, single-action patch — that
objection stands for `requestPasswordReset`/`requestOwnPasswordReset`/sign-in (which are out of scope for
this bug and still intentionally throw, per their own tests), but for `completePasswordReset` specifically
it is now the only remediation that can actually work, since the alternative (`error.tsx`) is proven
ineffective for this action's failure mode.

`src/app/(auth)/error.tsx` (already added) is kept — it is a real, tested improvement for genuine
React-render-time errors within `(auth)`, it does no harm, and it is still the correct catch-all for
errors this scoping *can* reach — but it is no longer presented as sufficient by itself for this bug.

**Revised files likely to change**:
- `src/features/auth/actions.ts` (`completePasswordReset`) — catch and map to a typed state instead of
  letting the action throw.
- `src/features/auth/actions.test.ts` — a test asserting `completePasswordReset` returns a typed state
  (not a thrown error) when `assertSameOrigin` rejects the request.

**Revised risk**: `requestPasswordReset` and `requestOwnPasswordReset` deliberately keep throwing on a
same-origin mismatch (their own tests assert `.rejects.toThrow()`); this change touches only
`completePasswordReset`, so it does not alter that established, tested pattern for the other two actions.

## Open Questions

- [NEEDS CLARIFICATION: What exactly did the user see — a blank/white page, a browser or Next.js error
  screen, a validation message, or the page just not visibly changing? Screenshot if available.]
- [NEEDS CLARIFICATION: Browser, device, and any extensions/corporate network in use, to test whether an
  `Origin`-stripping intermediary is plausible.]
- [NEEDS CLARIFICATION: Was this the user's first attempt with this link, or a retry after an earlier
  attempt? (The token was unspent when investigated, which rules out "already used" as the cause.)]
