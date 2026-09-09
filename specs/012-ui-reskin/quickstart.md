# Quickstart — validating the Broadsheet reskin

Prerequisites: `npm install` already run, a `TEST_DATABASE_URL` pointed at a scratch PostgreSQL
instance (per AGENTS.md's testing rules), `.env.local` with whatever `next dev` needs locally.

## 1. Automated checks

```bash
npm run verify
```

Runs, in order: `style-check` (Biome — catches any stray literal colour class Rule 1 in
`contracts/design-tokens.md` forbids), `type-check`, `test` (includes `src/app/globals.test.ts`'s
WCAG contrast contract and the repo-wide `theme-tokens.test.ts` pattern from research.md D-8.3),
`build`.

**Expected result**: every check green, with zero skipped tests (gate 8). `globals.test.ts` passing
is the automated proof of SC-003 (4.5:1 text / 3:1 non-text) against the *new* palette — if it fails,
the ramp is wrong, not the test.

To confirm nothing on the prior palette survives (FR-001), run:

```bash
grep -rn "#ec3013\|#e15b47\|#f3f2f2" src --include="*.css" --include="*.tsx"
```

Expected: no hits. Those three hexes are the current accent, accent-2, and page-background values
this feature replaces; any surviving hit is a surface the sweep missed.

To confirm no dark theme was introduced (research.md *Assumptions carried forward*), run:

```bash
grep -n "prefers-color-scheme" src/app/globals.css
```

Expected: no hits.

## 2. Manual walkthrough — User Story 1 (sign-in and recovery)

Run `npm run dev`, then for each row:

| Screen | URL | What to confirm |
| --- | --- | --- |
| Sign in | `/signin` | Cream paper background, serif heading, Archivo form labels, clay/terracotta primary button; submits correctly with a valid account |
| Wrong credentials | `/signin` (submit a bad password) | Error styled with the danger token, legible, distinguishable from the resting form without relying on colour alone (an icon or label accompanies it) |
| Locked account | `/signin` (five failed attempts against one address) | Same danger treatment, correct copy |
| Forgot password | `/reset` | Request form styled; submitting a known or unknown address returns the same generic message either way (unchanged behaviour) |
| Expired/used reset link | `/reset?token=<expired-or-used>` | Dead-link screen restyled, "request a new link" and "return to sign-in" both present and working |
| Accept invitation | `/invite/accept?token=<valid>` | Form restyled; still creates the account on submit |
| Expired/used invitation | `/invite/accept?token=<expired-or-used>` | Dead-link screen restyled, same two recovery actions |
| Sign-in-flow error boundary | Force a render error on any `(auth)` page (e.g. temporarily throw from `signin/page.tsx` during dev) | `(auth)/error.tsx` renders restyled: "Something went wrong" heading, the error banner ("Try the link again, or request a new one below."), a working "Request a new link" action to `/reset`, and the sign-in footer |

## 3. Manual walkthrough — User Story 2 (app shell)

Sign in, then confirm across every page the sidebar and header wrap:

- Sidebar: app mark, Home, project list, Notifications, Accounts, Labels (admin only), user chip —
  all present, same order as before, restyled.
- Hover and (if defined) active/selected states on nav items use the new tokens; none rely on colour
  alone if paired with any other signal the current shell already provides.
- Header search/action controls behave exactly as before (FR-005's "preserving current information
  architecture").
- Sign out still ends the session and redirects to `/signin`.

## 4. Manual walkthrough — User Story 3 (remaining pages)

Walk every row in `contracts/page-inventory.md`'s User Story 3 table. For each: confirm the page
renders with the new palette/typography/spacing, and exercise the one interaction the spec names for
it (view a notification, edit a profile field, move a board card, create an issue, create a project,
manage an account, manage a label). Also visit all three boundary pages:

- A URL inside the shell that doesn't exist → `not-found.tsx` (in-shell wording, restyled).
- A member visiting an admin-only route (e.g. `/settings/accounts`) → `forbidden.tsx`, restyled,
  still returns an actual `403`.
- A URL outside both route groups (e.g. `/some-nonexistent-path`) → the root `src/app/not-found.tsx`
  boundary, restyled.

## 5. Cross-cutting checks

- **Keyboard focus** (FR-008): tab through a sign-in form, the sidebar, a dialog (e.g. delete a
  label) — every stop shows the accent-coloured focus ring, nothing is reachable-but-invisible.
- **Reduced motion**: with the OS `prefers-reduced-motion` setting on, confirm no new motion was
  introduced (there should be none to reduce — research.md's Assumptions).
- **Long content**: a long notification body or a long project/issue name still truncates or wraps
  exactly as it does today — this feature changes no truncation/overflow CSS property, only the
  colours, spacing unit, and radius around it.
- **Dialog behaviour** after the shared dialog-shell extraction (research.md D-6): open each of the
  eight dialogs listed in `contracts/component-patterns.md` and confirm each still shows its own
  copy, fields, and destructive/confirm action — the shared shell must not have merged any two
  dialogs' content.
