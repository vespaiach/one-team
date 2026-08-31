# Design brief — Accounts and invitations

**Feature**: [`spec.md`](./spec.md) · **Screens contract**: [`contracts/accounts-screen.md`](./contracts/accounts-screen.md) · **Conventions**: [`contracts/ux-conventions.md`](./contracts/ux-conventions.md)

**Status of the code**: nothing here is drawn yet. The behaviour, the copy that is quoted below, and
the tokens are all settled and are not open to redesign. What is open is listed in §11 and nowhere
else.

**Product**: *One Team* — a self-hosted issue tracker for one small team. There is no public sign-up:
an installation begins with exactly one seeded admin, and every other account exists because an admin
invited an address and someone took the offer. These two screens are that entire path.

---

## 1. The ask

Two screens and their states. Roughly twenty frames.

| # | Frame | Notes |
| --- | --- | --- |
| 1 | `/settings/accounts` — Invitations tab, populated | the default landing state |
| 2 | Invitations tab — empty | one line, no illustration |
| 3 | Invitations tab — loading skeleton | must match frame 1 exactly |
| 4 | Invitations tab — read failed | explanatory state + retry, in the panel's place |
| 5 | Invite modal — empty | one field and a submit control |
| 6 | Invite modal — four inline refusals | malformed · account (active) · account (closed) · already invited |
| 7 | Invite modal — submitting | in-flight on the control |
| 8 | Accounts tab, populated | active above closed; includes the disabled last-admin control |
| 9 | Accounts tab — loading skeleton | must match frame 8 exactly |
| 10 | Accounts tab — arrived-from-invite | one row focused and transiently marked |
| 11 | Deactivate confirmation | |
| 12 | Reactivate confirmation | |
| 13 | Toasts — all four kinds, stacked | success, info, warning, error |
| 14 | Connection banner | above the tabs |
| 15 | `/invite/accept` — the form | outside the shell |
| 16 | `/invite/accept` — submitting | |
| 17 | `/invite/accept` — link already used | |
| 18 | `/invite/accept` — link expired | |
| 19 | `/invite/accept` — link unknown | |
| 20 | `/invite/accept` — address already has an account | |

Frames 17–19 must be visibly distinguishable from one another. That is a requirement (`FR-032`), not
a nicety: a person on a dead link has to work out which of the three happened without asking anyone.

---

## 2. Non-negotiables

Read these before drawing anything. Each one is already true of the shipped screens, and an
unconsidered default will violate every one of them.

1. **Nothing in this product has a rounded corner.** The stylesheet enforces `border-radius: 0` on
   every element globally. No pills, no rounded cards, no circular avatars, no rounded buttons.
2. **No illustrations, no empty-state art, no marketing.** An empty list is one quiet line of text.
3. **No responsive design.** The app has a hard 1280px minimum and no breakpoint anywhere; below it
   the document scrolls horizontally. Do not produce mobile or tablet frames — that is out of v1
   (`OT-SCOPE-004`), not deferred.
4. **No dark mode.** Not deferred either.
5. **No avatar fallback.** A user without an avatar URL, and one whose avatar fails to load, both
   render **the display name alone** — no initials circle, no silhouette, no generated colour block
   (R2 `FR-017`). This is explicit, and it is the rule most likely to be broken by habit.
6. **One accent colour.** `#5b5bd6`. The blue / green / violet / amber / grey ramps in the theme are
   reserved for project, label and board-column identity and carry **no interface meaning** — never
   use them for chrome, state or emphasis on these screens.
7. **Never state anything by colour alone.** Expired invitations, the transient row highlight, field
   errors, toast kinds — each needs text, or an icon plus text, carrying the same information.
8. **Interaction behaviour comes from `react-aria-components`**, which ships unstyled. You are
   designing the visual layer over known-correct keyboard, focus and ARIA behaviour. Do not design an
   interaction that would require re-implementing a primitive by hand.
9. **No component library, no icon set is approved.** If a frame needs an icon, say so and it becomes
   a decision to make, not an import.

---

## 3. The design system as it stands

Defined in `src/app/globals.css` under Tailwind v4's `@theme inline`. These are the whole palette and
the whole type scale — there is no second sheet.

### Semantic colour (the only names a component uses)

| Token | Resolves to | Used for |
| --- | --- | --- |
| `--color-page` | `#f4f2f0` | the page ground, and the sidebar fill |
| `--color-surface` | `#ffffff` | the content region, cards, modals |
| `--color-surface-sunken` | `#fbfaf9` | recessed areas |
| `--color-border` | `#d7d3cf` | dividers, card edges |
| `--color-border-control` | `#8f8a86` | input and control edges |
| `--color-border-strong` | `#24211f` | |
| `--color-text` | `#24211f` | |
| `--color-text-muted` | `#6e6a66` | secondary text **on `--color-surface` only** |
| `--color-text-placeholder` | `#6e6a66` | |
| `--color-text-disabled` | `#b3aeaa` | |
| `--color-accent` | `#5b5bd6` | the one accent — primary controls, focus ring |
| `--color-accent-hover` / `-pressed` | `#4a4ac0` / `#3c3c9c` | |
| `--color-accent-text` | `#3c3c9c` | links, and accent-coloured text |
| `--color-danger` / `-fill` / `-text` | `#c8453c` / `#fbe4e2` / `#8c2b25` | errors, destructive |
| `--color-success` / `-fill` / `-text` | `#3a9d5d` / `#e7f4ec` / `#27713f` | |
| `--color-advisory` / `-fill` / `-text` | `#d4a017` / `#fbf2dc` / `#8a6708` | warnings |

`--color-text-muted` measures 4.36:1 on `--color-page` — below AA — so it is only safe on
`--color-surface`. That covers this whole screen: the content region is white and the only
page-coloured ground is the sidebar, which you are not designing. (A `--color-text-muted-on-page`
token is specified for that case and does not exist in the stylesheet yet.)

### Type — Archivo, six steps

| Step | Size / line | Weight & tracking | Where |
| --- | --- | --- | --- |
| `micro` | 11 / 16 | 600, `+0.08em` | table column headers, eyebrow labels |
| `small` | 13 / 20 | — | field labels, helper and error text, table cell secondary |
| `body` | 15 / 24 | — | body copy, table cells |
| `control` | 16 / 24 | — | text **inside** inputs and buttons |
| `title` | 22 / 28 | `-0.01em` | screen title, dialog title |
| `display` | 32 / 36 | `-0.02em` | the wordmark on the auth card |

### Space and geometry

- Unit is **4px**. Structure lands on multiples of **8**; 4 is only ever the gap between a control and
  the text annotating it.
- `--size-field: 44px` — the height of every input and every button.
- `--size-card: 440px` — the auth-card width, which is what `/invite/accept` sits in.
- `--radius-none: 0px` — the only radius.
- Focus: **2px solid accent, 2px offset**, one global rule, on every focusable thing.
- Links: accent text, underlined, 2px underline offset.

---

## 4. The frame

### `/settings/accounts` sits inside the app shell

The shell is specified but **not yet built** (roadmap entry R2 owns it). Design the screen assuming
it, and do not redesign it.

```
┌──────────────┬──────────────────────────────────────────────┐
│  sidebar     │  main                                        │
│  262px       │  fill: --color-surface                       │
│  fill:       │  ┌────────────────────────────────────────┐  │
│  --color-    │  │ banner slot (empty on this screen      │  │
│  page        │  │ unless the connection drops)           │  │
│              │  ├────────────────────────────────────────┤  │
│  1px border  │  │ <ScreenHeader name="Accounts" />       │  │
│  on the      │  │   h1 + optional context line           │  │
│  inline end  │  │   two control slots — both EMPTY here  │  │
│              │  ├────────────────────────────────────────┤  │
│              │  │ the page: tabs and their panels        │  │
│              │  └────────────────────────────────────────┘  │
└──────────────┴──────────────────────────────────────────────┘
   shell minimum width 1280px  →  content region is 1018px at that minimum
```

The header's two per-screen control slots render **nothing** on this screen — the Invite control
belongs at the head of the Invitations tab, not in the header. A slot with nothing in it occupies no
space and never shows a placeholder.

### `/invite/accept` sits outside the shell

It reuses the existing sign-in card exactly: page-coloured ground, `max(12vh, 96px)` of top padding,
a 440px column, the wordmark **One**(text) **Team**(accent) at `display`, then a white card with a
1px `--color-border` edge, 32px padding and 24px between its children. No sidebar, no header, no app
navigation — the only link any of these states carries is the one route onward on the three dead-link
screens.

---

## 5. `/settings/accounts` — the Invitations tab

### The tab strip

Two tabs, **Invitations** then **Accounts**, Invitations selected on arrival.

The selected tab is **page state, not a route**. There is no URL for a tab, no browser-history entry
when it changes, and a reload returns to Invitations. Do not draw anything that implies a linkable or
bookmarkable tab.

Nothing that writes moves the tab. The toast region and the connection banner therefore live at
**page level, outside both panels**, so an outcome raised on one tab is still seen while the other is
selected.

### The list

An **Invite** control at the head of the tab, then a table, newest first:

| address | invited by | sent | expires | | |
| --- | --- | --- | --- | --- | --- |
| ada@example.com | Grace Hopper | … | … | Resend | Revoke |
| bob@example.com — **Expired** | Grace Hopper | … | … | Resend | Revoke |

- "invited by" is a display name — first and last joined by one space. A **deactivated** person's
  name still renders here, exactly like anyone else's.
- An expired invitation **stays in the list** and keeps offering Resend. It is marked expired **in
  text**; colour may reinforce that, never carry it.
- Every row carries both Resend and Revoke. Revoke is destructive but appears to take **no
  confirmation**: the requirement says its token is invalidated *at once*, and confirmation is
  required only of the two account-state changes. If you think it needs one, say so — that is a
  question for the spec rather than a thing to draw on your own authority.
- Empty: one quiet line, **"No outstanding invitations"** — binding copy. No illustration, no
  call to action, no card.
- Read failed: the panel is replaced by an explanatory state naming that the data could not be loaded
  and offering a retry. Never an empty list, and never a skeleton left standing.

### The Invite modal

One email field and a submit control. **Nothing else** — no second field, no role selector, no bulk
or CSV affordance, no navigation. (A field's own error output is not an addition to that.)

- The submit control **stays enabled at all times**. An invalid field never disables it. In-flight
  state on submission is the only thing that changes it.
- Validation is **per field, on blur** — never a wall of errors on submit.
- Cancel and Escape close the modal, discard what was typed, and write nothing.
- **A press outside the modal does not close it.** A typed address is discarded only by an explicit
  act.

Four inline refusals. The wording is yours; the content of each is fixed:

| The address | The error must | And offers |
| --- | --- | --- |
| is malformed | name the problem | — |
| already has an **active** account | name that account as already holding a login | a control that reaches that account's row |
| already has a **closed** account | name that account as **closed** | **Reactivate** as the remedy — not an invitation |
| already holds an outstanding invitation | say so | **Resend**, in place of a second invitation |

Case is folded at both ends: `Ada@Example.com` is recognised as `ada@example.com`.

### The control that reaches an account's row

This is the most interesting interaction on the screen and it needs drawing in two frames.

It is **not a link**. There is no route to another user's profile anywhere in this product, and the
tab is not a URL. Pressing it:

1. closes the modal and discards the field,
2. switches the selected tab to **Accounts**,
3. scrolls that account's row into view — a no-op if it is already visible,
4. marks the row transiently, **by more than colour**,
5. moves focus to the row, and announces the outcome naming the account reached.

Steps 4 and 5 happen whether or not any scrolling was needed. The marker clears after a short
interval or on the next interaction, whichever comes first. No URL change, no history entry.

---

## 6. `/settings/accounts` — the Accounts tab

### The roster

Every account on the installation: **active accounts first, then closed ones**. Inside each group,
alphabetical by display name, ties broken by email address. The order is computed on the server and
does not vary with the reader's language.

| avatar | display name | email | role | joined | projects | |
| --- | --- | --- | --- | --- | --- | --- |
| | Ada Lovelace | ada@… | Admin | … | 0 | Deactivate |
| | Grace Hopper | grace@… | Admin | … | 0 | *Deactivate (disabled)* |
| | *closed* — Alan Turing | alan@… | Member | … | 0 | Reactivate |

- **The projects column reads `0` for every account.** Project membership does not exist yet — it
  arrives two roadmap entries later. Draw a column of zeros, not plausible-looking numbers. The column
  is rendered now, not deferred.
- **Role is shown and never edited.** No control on this screen sets a role; that is command-line only.
- **Exactly one control per row** — Deactivate on an active account, Reactivate on a closed one.
- This roster is the only place in the entire product where one person sees another's email address.
- **No empty state is needed.** The admin reading the roster is on it, and the installation is never
  left with zero active accounts.
- A display name too long for its column truncates visually on one line; the untruncated name stays
  the accessible name.

### The last active admin

When exactly one active admin remains, that row's **Deactivate renders disabled, and is not hidden**,
with its reason stated inline beside it:

> **The last active admin can't be deactivated.**

Binding copy, verbatim. Further:

- the reason is **text next to the control** — a tooltip must not be the only place it appears,
- the disabled control **stays reachable by keyboard**,
- the reason is associated with the control programmatically, so a reader who never sees that text
  still meets it,
- colour alone does not carry the disabled state.

This is the first implementation of a house rule — *an unavailable action is disabled with its reason
inline, never hidden* — so whatever you draw here becomes the pattern for the rest of the product.

### The two confirmations

Each asks once. The wording is yours; what each must name is fixed.

**Deactivate** — names what **stays**: memberships, assignments, comments and activity. Nothing is
removed, and the person's name keeps rendering everywhere it already did. (What it does not say, but
does: every session that account holds is deleted, so they are signed out on every device.)

**Reactivate** — names what it **restores**: sign-in and picker eligibility, with the memberships the
account already had — and says that **no new link and no invitation is issued**. The person simply
signs in again with the password they already had.

---

## 7. `/invite/accept` — six states

One card, six things it can be. All outside the shell.

### Valid

- The invited address, shown as a **value, not a control** — it cannot be edited, and no `user`
  record is read to produce it.
- **First name**, **last name**, and **one password field** — not a New/Confirm pair. (The pair
  belongs to Change password, elsewhere.)
- The password rule: at least twelve characters, no composition rules, and refused if it appears on a
  common-password blocklist. The field must report **which** rule failed.
- No role field. The account is created as a member.
- On submit: the account comes into being, the person is signed in on the spot, and lands on `/home` —
  no second trip through sign-in.

### Submitting

In-flight state on the control, and **a second press must not be possible**. This is the one write in
the product that both creates an account and authenticates; it must not be runnable twice.

### Used · Expired · Unknown

Three separate screens, each visibly distinct from the other two. They follow the shape of the
existing dead-link screens: **a heading, one sentence, and a route onward.**

- **Used** — the link has already been taken. This state persists forever; no age turns it into
  "unknown".
- **Expired** — past its seventh day.
- **Unknown** — no invitation matches. This is also what a **revoked** link shows, and what a link
  **superseded by a resend** shows.

There is **no "request a new one" control** on any of the three. A stranger cannot invite themselves;
the remedy is to ask an admin, and the copy should read that way.

### Taken

The invited address acquired an account by some other route before this link was used. Name that the
address already has an account, and point at sign-in.

---

## 8. The four cross-cutting surfaces

These are house conventions being implemented for the first time on this screen. Whatever you draw
becomes the product's pattern, so they deserve real attention rather than defaults.

### Toasts

| Rule | |
| --- | --- |
| Kinds | four: success, info, warning, error |
| Position | top-right |
| Stacking | newest nearest the corner; no fixed limit |
| Auto-dismiss | five seconds from appearing |
| Dismiss control | **every toast carries one** — the timer is never the only way out |

Where each kind fires here:

| Event | Kind |
| --- | --- |
| Invitation created and mailed | success |
| Invitation created, **but the mail did not send** | **warning** — the invitation stands; Resend is the remedy |
| Resend, revoke, deactivate, reactivate completed | success |
| Any write the server refused | **error**, naming what failed and why |
| — | info has no caller in this feature; design it anyway, the set is four |

### Skeletons

One per panel, matching the layout it replaces — same regions, same count, same dimensions. **A
full-screen spinner must not be used**, and data landing **must not shift the layout: the tolerance is
zero.** Row height and column widths are therefore shared between the skeleton and the real table.

### The connection banner

One banner, above the tabs, reading exactly:

> **Can't reach the server. Reconnecting.**

While it is up, writes are refused with **"Changes need a connection"**. Nothing is queued for later
and nothing replays. It clears on the next request that reaches the server.

A refusal the *server itself returned* is a different thing: that is a rejected write and takes an
error toast. The banner is only for a request that never arrived.

### In-flight state

Every write on these screens waits for the server and shows in-flight state **on its own control**.
Nothing is optimistic. A rejected write rolls back and raises an error toast naming what failed.

---

## 9. Copy that is binding

Reproduce these exactly. Everything else on these screens is yours to word.

| String | Where |
| --- | --- |
| `Accounts` | the screen title |
| `Invitations` · `Accounts` | the two tab labels, in that order |
| `Invite` · `Resend` · `Revoke` · `Deactivate` · `Reactivate` | control labels |
| `No outstanding invitations` | the empty invitations list |
| `The last active admin can't be deactivated.` | the disabled control's inline reason |
| `Can't reach the server. Reconnecting.` | the connection banner |
| `Changes need a connection` | a write refused while disconnected |

---

## 10. Accessibility, stated as design constraints

Not a review checklist — these change what gets drawn.

- **Colour is never the only carrier.** Expired rows, the transient highlight, field errors, toast
  kinds, disabled state. Each needs text or shape as well.
- **Every control has a visible focus indicator** — the global 2px accent ring at 2px offset. Do not
  suppress it anywhere, and leave room for it in dense table rows.
- **Error text is associated with its control**, and sits with it — not collected at the top of a form.
- **A disabled control stays keyboard-reachable and carries its reason programmatically.** Tooltips
  are never the sole home for a reason.
- **The row jump moves focus and announces itself.** A keyboard reader lands where a sighted reader is
  looking, and hears the account named.
- **Tabs get roving tabindex and arrow-key movement** from React Aria; do not design a tab strip that
  fights it.
- Truncated names keep their full text as the accessible name.

---

## 11. Decisions genuinely left to you

Everything above is settled. These are not, and the specs are deliberately silent on them. Each needs
a choice and the choice becomes the product's convention.

1. **Table density.** Row height, cell padding, and whether rows carry dividers or zebra fill. The
   skeleton has to match whatever you pick, exactly.
2. **The avatar's shape and size** in the roster — given that a missing avatar renders the name alone,
   the layout must not reserve a hole that looks broken when the image is absent. This is the
   constraint that makes the choice non-obvious.
3. **How "expired" is marked** on an invitation row — an inline text badge, a modifier on the expires
   cell, or a status column that is otherwise empty.
4. **The transient highlight** on a jumped-to row: what carries it besides colour, and how long it
   lasts before clearing.
5. **Date and time format** for sent / expires / joined — absolute, relative, or both. Note that the
   roster's *sort* is locale-independent by requirement, but its *rendering* is not constrained.
6. **Role presentation** — the stored values are `admin` and `member`; how they read in the cell is
   open.
7. **Modal and dialog width**, and whether the two confirmations share a shape with the Invite modal.
8. **Toast width, stacking gap, and whether the four kinds differ by more than an icon.**
9. **Skeleton treatment** — a static tint or an animated shimmer. Nothing in the system has motion yet,
   so this sets a precedent.
10. **The screen title's type step.** The scale offers `title` (22px). The shipped sign-in page uses a
    `text-heading` class for its `h1` and **no `--text-heading` token exists**, so that heading is
    currently rendering at the browser default. Whatever you choose here should also settle what
    sign-in's heading was meant to be.

---

## 12. Do not design

Named so nothing above is read as covering them.

| | Why |
| --- | --- |
| The sidebar, the app shell, the Forbidden screen, `ScreenHeader` | a different roadmap entry owns them |
| The sidebar's Accounts entry | same — it is hidden for non-admins there, not here |
| Any way to edit a role | command-line only, by requirement |
| A route to view another user's profile | none exists in this product |
| A team-settings screen | out of scope; this screen is what remains of it |
| Bulk invite, address lists, CSV import | the form takes one address |
| Any picker | none is delivered here |
| An account-deletion path | closure is a deactivation instant; nothing is ever deleted |
| Any audit trail of account state changes | none is retained |
| Mobile, tablet, or dark-mode variants | out of v1 |
