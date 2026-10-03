# Contract: Page routes, access rules and UI pieces (RM-3)

Layout, states, copy, components and focus are fixed by the Frozen [design.md](../design.md); this file only says where each piece lives and how routes behave. Reasons are in [research.md](../research.md) (R8, R12, R13, R18).

## Access rules (enforced in `src/proxy.ts`, every page request)

| Request | Signed in | Signed out |
|---------|-----------|------------|
| `/` | redirect `/my-issues` | redirect `/sign-in` |
| `/sign-in` (no `token` parameter) | redirect `/my-issues`; `next` ignored (FR-023) | Sign-in form |
| `/sign-in?token=…` (the `token` parameter present at all, even empty or repeated) | landing page with the first `token` value, never redirected, never a `422` (FR-023) | landing page |
| any other page, including unknown addresses | the page (or Not found inside the shell) | redirect `/sign-in?next=<path and query>` (query string kept, FR-020) |
| `/api` and `/api/…`, `/health`, `/_next/static/…`, `/_next/image…`, `/favicon.ico` | not handled by the Proxy | not handled by the Proxy |

"Signed in" means a valid session (data-model.md `sessions`), checked with `validateSession` from `src/server/session.ts`, the same function `requireMember` uses; checking it counts as activity (FR-015). On every page request through the Proxy (including `/sign-in` and `/sign-in?token=…`), a stale or unknown `session` cookie is cleared with a clearing `Set-Cookie`. The Proxy only authenticates; role checks belong to `src/server/permissions.ts`, FR-021's one permission layer (research R9).

## Routes

| Route | Files | Renders |
|-------|-------|---------|
| `/sign-in` | `src/app/sign-in/layout.tsx` (standalone centred layout, no sidebar), `src/app/sign-in/page.tsx` | without `token`: `SignInForm` (title "Sign in · Tracklite"); with a `token` parameter (its first value when repeated; empty allowed): `MagicLinkLanding`, its first state chosen on the server: Sign in button, or "You're signed in as {full name}…" when a member is signed in and the link is not theirs (research R12) |
| `/my-issues` | `src/app/(app)/layout.tsx` (member + `AppShell`), `src/app/(app)/my-issues/page.tsx` | "My issues" heading (focused after an in-app navigation through `HeadingFocus`) and `EmptyState` "Nothing assigned to you" (title "My issues · Tracklite") |
| Not found | `src/app/not-found.tsx` (now async: reads the member and renders `AppShell` around the RM-1 content) | unchanged RM-1 content inside the shell; its heading focus now comes from the shared `HeadingFocus` (same behavior) |
| `/` | none (`src/app/page.tsx` removed) | always redirected by the Proxy |

The root layout `src/app/layout.tsx` keeps `AriaRouterProvider` and `ToastProvider` and drops `AppShell`.

## UI pieces

| Piece | File | Notes |
|-------|------|-------|
| `SignInForm` | `src/features/auth/components/SignInForm.tsx` (client) | Hairline `TextInput` `type="email"`, `FieldError`, primary `Button`; new `crypto.randomUUID()` per submission; `200` → "Check your email" replaces the form; `422` → field error; `429` → inline limit message under the form, email kept; `503` → toast "We couldn't send the email. Try again."; other failure → toast "Couldn't save. Try again."; button disabled while sending |
| `StatusMessage` | `src/features/auth/components/StatusMessage.tsx` (client; test `StatusMessage.test.tsx` beside it) | design.md's "status message", new and shared by Sign-in and Magic-link landing: "Check your email", "This link has expired" and "You're signed in as …"; a heading below the page heading, focusable (`tabIndex={-1}`), announced (`role="status"`), wrapping, never truncated; takes focus when it appears after an action (`focusOnShow`), not when the landing page opens in the signed-in-as-another state (browser default focus). Used by `SignInForm` and `MagicLinkLanding` |
| `sendSignInLinkRequest` | `src/features/auth/services/sendSignInLinkRequest.ts` | the form's `fetch` to `POST /api/sign-in-links`, mapping the statuses above (own call: `saveJson` has no `429`/`503` outcomes) |
| `MagicLinkLanding` | `src/features/auth/components/MagicLinkLanding.tsx` (client) | states Populated, Link expired, Signed in as another member (design.md); makes one `requestId` with `crypto.randomUUID()` when the page loads and reuses it for every Sign in click from that load, including a retry after the failure toast (FR-012; a reload or another tab gets a new one); Sign in calls `saveJson("/api/sessions", { token, requestId })`: `signedIn` → `window.location.assign(destination)`; `expired` / `signedInAsOther` → switch state and focus the message; failure → toast "Couldn't save. Try again.", button enabled again (a retry after a lost answer then gets `signedIn`) |
| `SignOutButton` | `src/components/layout/SignOutButton.tsx` (client; test `SignOutButton.test.tsx` beside it) | `DELETE /api/sessions/current` (ends whichever session the browser has now, also from a stale tab; `204` even when none); then `window.location.assign("/sign-in")` from the shell, or `window.location.reload()` on the landing page; failure → toast "Couldn't save. Try again.", button enabled again; used by `AppShell` (tertiary, imported from the same folder) and `MagicLinkLanding` (secondary, imported from `src/components/layout`) |
| `AppShell` (extended) | `src/components/layout/AppShell.tsx` | takes `member: { fullName }`; adds the "My issues" sidebar link with a current-page mark (`aria-current="page"`, small client child using `usePathname`), and at the bottom the initials avatar, the full name (cut off with "…", full name on hover and to screen readers) and `SignOutButton` |
| `NotAllowed` | `src/components/ui/NotAllowed.tsx` | heading "You don't have permission to do that." (focused after an in-app navigation through `HeadingFocus`) and a "My issues" link; rendered by its component test only in RM-3 (Principle II shared-component exception) |
| `HeadingFocus` | `src/components/ui/HeadingFocus.tsx` (client; test `HeadingFocus.test.tsx` beside it), moved from `src/app/NotFoundFocus.tsx` | shared heading-focus helper: focuses the page heading (`tabIndex={-1}`) when the page was reached by an in-app navigation, leaves browser default focus on a full page load; used by Not found, My issues and `NotAllowed` (design.md "Keyboard and focus") |
| `initials` | `src/lib/initials.ts` | REQ-003.4 rule (research R17) |

## Server helpers used by pages

| Helper | File | Use |
|--------|------|-----|
| `currentMember()` | `src/server/session.ts` | request-cached (`react` `cache`) member from the `session` cookie via `cookies()`, through `validateSession`; null when signed out. Authentication only: page-level role checks in later slices go through `src/server/permissions.ts` |
| `requireCurrentMember()` | `src/server/session.ts` | as above, `redirect("/sign-in")` when null (the Proxy normally redirects first, with `next`) |
