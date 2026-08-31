# Phase 1 — Quickstart validation

**Plan**: [`plan.md`](./plan.md) · **Spec**: [`spec.md`](./spec.md) · **Contracts**: [`contracts/`](./contracts/)

Twelve walkthroughs that prove the screen works end to end. Each names the requirements and success
criteria it demonstrates, so a reviewer can run the list and reach every acceptance scenario the spec
states without reading the code.

---

## Prerequisite: entry R2 is implemented

**Nothing here runs until it is.** Entry R1 has landed — `loadActor()`, the `accountUser` projection,
`touched()`, the reset token, the mail and the throttle are all in the tree. Entry R2 has not: there
is no `src/app/(app)/`, so there is no shell to render inside, no `/profile` route to fill, no
`ScreenHeader` to compose and no banner region for `FR-034`'s banner to sit in.

```bash
ls src/app/\(app\)/layout.tsx
```

A `No such file` means R2 has not landed and this checklist cannot be started.

---

## Setup

```bash
npm ci
```

```bash
npm run db:migrate
```

Seed the installation the way §6 does — `ADMIN_EMAIL` and `ADMIN_PASSWORD` in the environment, first
run only — and create a second, non-admin account, so walkthroughs 6 and 7 have both roles to
compare. Set `SMTP_URL` and `MAIL_FROM` so walkthrough 9 sends real mail; leave them unset once, at
the end of walkthrough 9, to see the unconfigured-mail path.

```bash
npm run dev
```

---

## 1 · Every field edits in place · `FR-013`, `OT-UX-009`, `SC-001`

Sign in and open `/profile` from the sidebar's user chip. Take each of the seven writable fields in
turn — avatar, first name, last name, job title, Slack handle, phone, bio:

- Press the value. It becomes a field carrying the current value, focused.
- Change it and press `Escape`. The previous value returns and **nothing is written** — reload to confirm.
- Change it again and click elsewhere. The change is written and the field returns to a shown value.
- Change it once more and press `⌘`+`Enter`. The same write, without moving focus first.

There is no edit mode anywhere on this screen, no form and no submit button. Each correction takes
well under thirty seconds and reloads nothing (`SC-001`).

## 2 · One write per field, carrying one field · `FR-013`, US1 scenario 5

With the network panel open, change the job title, then the phone.

Two separate calls. Neither payload carries the other field's value. The framework dispatches Server
Functions one at a time, so they are serialized on the wire — they are still two independent writes
with two independent outcomes, which is what the scenario asserts.

## 3 · Optimistic, and rolled back per field · `FR-014`, `FR-015`, `SC-003`

Change the job title and watch the value: the new one renders **before** the server answers
(US1 scenario 6).

Now force a refusal — paste 250 characters into the job title, which is 50 past its bound. Count in
characters, not UTF-16 code units: paste 200 emoji into the same field and it saves, because the
parser and the column both count code points (`FR-020`):

- The value on screen returns to what the server holds.
- A message names what failed and why.
- Start editing the phone, then refuse a job-title save while that edit is open: **only** the job
  title rolls back. The phone edit is untouched.

After every refusal the value on screen equals the value the server holds — reload to confirm, in
every case (`SC-003`).

## 4 · Required, optional, and cleared · `FR-007`, `FR-008`, `FR-012`, `FR-012a`

| Do this | Expect |
| --- | --- |
| Empty the first name, or leave it as spaces | inline error on that field, nothing written |
| Empty the last name | the same |
| Empty the job title, Slack handle, phone or bio | it saves, and the field returns to its empty presentation |
| Empty the **avatar** | it saves and clears — it is **not** measured against the scheme rule (`FR-012a`) |
| Save a name with surrounding spaces | the stored value is trimmed, and the display name carries exactly one space between the parts |
| Save `@ana` as a Slack handle, or `+44 7700 900000` as a phone | accepted as typed. No format rule applies |
| Save the value a field already holds | nothing is written (`FR-016`) — confirm `updated_at` has not moved |

Then check the storage half directly:

```bash
npm run db:studio
```

A cleared optional field is `NULL`, not `''` — the same as a field this screen never touched
(`FR-012a`).

## 5 · The avatar takes web links and nothing else · `FR-011`, `SC-010`

| Value | Expect |
| --- | --- |
| `https://example.com/a.png` | stored as typed. Nothing fetches it |
| `http://example.com/a.png` | the same |
| `https://example.com/not-an-image` | **stored** — the value is a link, and nothing fetches it to find out (spec edge case) |
| `javascript:alert(1)` | refused, inline error, nothing stored |
| `data:image/png;base64,…` | refused |
| `mailto:someone@example.com` | refused — it can never resolve to an image |
| `example.com/a.png` | refused — not a well-formed absolute link |

`SC-010` requires the refusal "whether it arrives from the screen or directly", so also call
`updateOwnProfile("avatarUrl", "javascript:alert(1)")` from a test rather than through the field and
confirm nothing is stored.

## 6 · The record is yours, and there is no way to anyone else's · `FR-002`, `FR-018`, `FR-019`, `SC-004`

Open `/profile` as the member and as the admin. Each sees their own record; the admin has no control
that reaches another user's, and the two screens differ only in the values they carry.

Then look for a way in and fail to find one:

```bash
find src/app -type d
```

No route segment names a user. There is no `/profile/[userId]`, no `?user=`, and `updateOwnProfile`
takes no user identifier — so US2 scenario 4 is satisfied by the signature rather than by a check.
Finally, sign out and request `/profile`: it redirects to `/signin` and never reaches Forbidden
(`FR-005`, `OT-SEC-015`).

## 7 · Email and role are facts, not fields · `FR-024`, `FR-025`, `SC-006`

Click the email. Click the account role. Neither becomes a field, neither is a button, and neither
responds to a press. Compare the member's screen with the admin's: the presentation is identical and
only the role's value differs. No sequence of interactions available on this screen changes either
one.

## 8 · The bio is characters · `FR-009`, `OT-DATA-016`

Save this as the bio:

```text
**bold** _italic_ `code` <b>html</b> [link](https://example.com)
```

Reload. Every character renders exactly as typed. Nothing is bold, nothing is a link, and the `<b>`
is text.

## 9 · Change password, in one press · `FR-026`, `FR-028`, `FR-029`, `SC-007`, `SC-011`

Press **Change password**.

- No address is typed and no form appears.
- The message reads exactly: `Check your email for a link to reset your password.`
- Mail arrives at that user's own address, carrying a `/reset?token=…` link.

Open the link: it lands on the Change password screen, **outside** the shell — no sidebar, no header
(`OT-UX-001`). Set a new password there.

Then the rate limit — press it six times inside fifteen minutes. The sixth is refused and the message
states the time remaining in whole minutes rounded up — `Too many requests. Try again in 15 minutes.` (`SC-011`, `FR-028`). Now confirm the two counters are separate: fail sign-in for
that same address five times, then press Change password again. It is answered normally
(`FR-028`, `OT-SEC-017`, US4 scenario 10).

Finally, unset `SMTP_URL`, restart, and press the link once. The user is told it failed in the same
terms as any other failure on this screen; the detail is in the server log, not the browser.

## 10 · The change signs you out everywhere · `FR-030`, `SC-008`

With the profile open in browser A and the same account signed in on browser B, complete a password
change from the link mailed in walkthrough 9.

- Browser B is returned to sign-in on its next action.
- **Browser A — the one that made the request — is too.** The cookie survives; the session row does
  not, so `requireActor()` refuses it (`OT-SEC-012`).
- The account's `must_change_password` flag, if it was set, is now clear (US4 scenario 9).

## 11 · A corrected name follows you · `FR-004`, `SC-009`

Change the first name, then the last name. On its next render, the sidebar's user chip shows the new
pair joined by a single space, and so does every other place this screen renders a display name — no
application reload, only the screen's own re-query. Navigate away and back: the page queries the
server again rather than rendering a remembered value (`FR-032`).

## 12 · Loading, messages and a lost connection · `FR-031`, `FR-033`, `FR-034`, `SC-012`

**Skeleton.** Throttle the network to Slow 3G and reload `/profile`. A skeleton matching the layout
appears — never a full-screen spinner — and nothing shifts when the data lands.

**Messages.** Every message this screen raises is top-right, newest nearest the origin, and gone five
seconds after it appears. Raise four refusals quickly: at most three are visible and the fourth waits
its turn. Raise the same refusal twice and confirm two entries, not one. Inspect the DOM: there is
exactly **one** message host in the document, and it is in the shell layout, not on this page.

**Lost connection.** Go offline in the network panel and edit a field.

- One banner appears — one for the application, not one per screen — reading `You're offline. Changes can't be saved.`
- The save is refused with `Changes need a connection`. The banner's words and the refusal's are two different strings.
- Nothing is queued: go back online and confirm no write arrives late.

**Keyboard only.** Put the mouse away. Tab to each field, press `Enter` to open it — the shown value
is a button, so `Enter` and `Space` both activate it — type, `⌘`+`Enter` to save, `Escape` to abandon,
and reach the change-password link the same way. After each of save, rollback and `Escape`, focus is
back on the control the field replaced, so `Tab` continues from where you were (`FR-013a`). Inside
the bio a plain `Enter` inserts a line break; in the six single-line fields it does nothing, because
`FR-013` binds this screen to the same three gestures every other surface offers. An empty optional
field is reachable the same way: its quiet line — `Add a job title` and its three siblings — is
itself the button. Every error is announced against the field it belongs to, and every focused
control shows the focus ring (`SC-012`).

---

## The gate

```bash
npm run verify
```

`style-check`, then `type-check`, then `test`, then `build`. CI runs exactly this. Note that
`npm test` runs with `--passWithNoTests`, so a green run is not by itself evidence that the tests of
change gate 1 were written first — the commit order is.
