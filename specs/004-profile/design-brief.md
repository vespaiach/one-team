# Design Brief — Profile

**For**: Claude Design · **Feature**: entry **R4**, [`spec.md`](./spec.md) · **Route**: `/profile`

**Reads from**: [`spec.md`](./spec.md), [`contracts/profile-screen.md`](./contracts/profile-screen.md),
[`contracts/change-password-link.md`](./contracts/change-password-link.md),
[`contracts/ux-conventions.md`](./contracts/ux-conventions.md), [`data-model.md`](./data-model.md),
[`docs/product/specifications.md`](../../docs/product/specifications.md) §3.12 and §7, and the token
set that already ships in [`src/app/globals.css`](../../src/app/globals.css).

**What is wanted**: the visual design of one screen and its states. Nothing here asks for code, and
nothing here may add a token, a colour, a radius, a type step or a breakpoint. Where this brief and
the spec disagree, the spec wins and the disagreement is a bug in this brief.

**Status of the code**: nothing on this screen is drawn or built yet. Only entry R1 exists in `src/`
— sign-in, reset, the user record and the token set. The shell (R2) and the two app-wide surfaces
this screen consumes (R3) are specified and unbuilt. The behaviour and the quoted copy are settled
and are not open to redesign; what is open is listed in §15 and nowhere else.

**Product**: *One Team* — a self-hosted issue tracker for one small team. There is no public sign-up:
an installation begins with one seeded admin, and every other account exists because an admin invited
an address. This screen is where any of those people corrects their own record.

---

## Conflicts in the source, and how this brief resolves them

Three places where R4's spec and its upstream owners state different things. Each is resolved here in
favour of the owner, and each is a spec defect worth fixing rather than a choice for the designer.

| # | The conflict | Resolved as |
| --- | --- | --- |
| 1 | **The offline banner's text.** R4 `FR-034` says "You're offline. Changes can't be saved." R2 `FR-035`, R3's contract and [`specifications.md`](../../docs/product/specifications.md) §4 all say **"Can't reach the server. Reconnecting."**, binding exactly as quoted | **Draw the upstream string.** The banner is one app-wide instance R3 builds; R4 consumes it and cannot give a shared singleton a second wording. R4's own preamble says the specification wins |
| 2 | **A dismiss control on a message.** R2 `FR-034` requires that **every toast carries one**, "so the timer is never the only way out". R4 `FR-033` is silent on it | **Draw the dismiss control.** Silence in R4 does not repeal a requirement in the entry that owns the convention |
| 3 | **How many messages stand at once.** R4 `FR-033` fixes "at most three, the rest queued". R2 `FR-034` deliberately fixes no limit, and R3's brief says "no fixed limit" | **Draw the three-visible cap**, since it is the only number any spec states — but mark it as R3's to settle, because R3 builds the host |

Conflict 1 is the one that would ship wrong text if it went unnoticed. It is reported alongside this
brief, not silently absorbed by it.

---

## 1. The screen in one paragraph

One person's own record, in one column, inside the app shell. Nine values — seven of them editable,
two of them shown and never editable — plus one link that mails a password reset. There is no edit
mode, no form, no submit button and no save button. A value is a line of text; you press it, it
becomes a field, and it saves when you leave it. That is the entire interaction model, and it is the
one this product will use on project details and issue detail too, so what is drawn here sets the
pattern for those.

**The hard problem, stated up front.** A value at rest must not look like an input, and must still
look pressable. Draw it as an input at rest and the screen becomes a form, which `FR-013` forbids by
name. Draw it with no affordance at all and nobody discovers that the screen is editable. This is the
single judgement the brief is commissioning; everything else below is constraint.

---

## 2. Non-negotiables

These already exist. They are not proposals and they are not this brief's to revisit. An unconsidered
default violates every one of them.

1. **Nothing in this product has a rounded corner.** `globals.css` enforces `border-radius: 0` on
   every element globally. No pills, no rounded fields, no circular avatar, no rounded buttons.
2. **No dark mode.** Not deferred — it does not exist, and the token set has no dark block.
3. **No responsive design.** A hard 1280px minimum and no breakpoint anywhere; below it the document
   scrolls horizontally. Do not produce mobile or tablet frames (`OT-SCOPE-004`).
4. **No illustrations and no empty-state marketing.** An empty value is one quiet line of text.
5. **No avatar fallback image.** No avatar, or one that fails to load, renders **the display name
   alone** — no initials circle, no silhouette, no generated colour block, no broken-image frame.
6. **No hex outside the token set**, no seventh type step, no second focus treatment.

### Geometry

| | |
| --- | --- |
| Corner radius | **`0` everywhere.** `globals.css` sets `* { border-radius: 0 }`. Nothing in this product has a rounded corner |
| Spacing unit | `4px`. Structure lands on multiples of **8**; `4` is only ever the gap between a control and the text annotating it |
| Field height | `--size-field: 44px` — the height of a single-line input |
| Shell width | sidebar `262px` fixed; page `min-width: 1280px`; the document scrolls horizontally below that |
| Breakpoints | **none.** No mobile layout, no responsive rule, not deferred — out of v1 (`OT-SCOPE-004`). This screen adds no breakpoint of its own |
| Direction | the app resolves a locale per request and sets `dir`. Use logical properties — inline start/end, never left/right |

### Colour — semantic tokens only, never a hex

| Token | Value | Use here |
| --- | --- | --- |
| `--color-surface` | `#ffffff` | the content region this screen fills |
| `--color-page` | `#f4f2f0` | the sidebar beside it — not this screen's fill |
| `--color-surface-sunken` | `#fbfaf9` | available, unused so far |
| `--color-border` | `#d7d3cf` | dividers, row rules |
| `--color-border-control` | `#8f8a86` | the border of a field being edited |
| `--color-text` | `#24211f` | a stored value, a label |
| `--color-text-muted` | `#6e6a66` | secondary text |
| `--color-text-placeholder` | `#6e6a66` | the empty-field line — **the same value as `-muted` today** |
| `--color-accent` | `#5b5bd6` | the focus ring, and link text via `--color-accent-text` `#3c3c9c` |
| `--color-danger` / `-fill` / `-text` | `#c8453c` / `#fbe4e2` / `#8c2b25` | inline field errors |
| `--color-success` / `-fill` / `-text` | `#3a9d5d` / `#e7f4ec` / `#27713f` | — the message host's, see §9 |
| `--color-advisory` / `-fill` / `-text` | `#d4a017` / `#fbf2dc` / `#8a6708` | — the message host's, see §9 |

`--color-text-muted` at `#6e6a66` is **4.80:1** on `--color-page` and higher on `--color-surface`,
so muted 13px text passes AA on both fills. Do not invent a lighter grey to get below it.

**There is no `--color-focus` token.** Focus is one global rule and this screen inherits it:
`outline: 2px solid var(--color-accent); outline-offset: 2px`, applied on `:focus-visible` and on
React Aria's `[data-focus-visible]`. Do not design a second focus treatment.

### Type — Archivo, six steps, no others

| Step | Size / line | Notes |
| --- | --- | --- |
| `micro` | 11 / 16 | weight 600, tracking `+0.08em` |
| `small` | 13 / 20 | labels, inline error text |
| `body` | 15 / 24 | a stored value at rest |
| `control` | 16 / 24 | text inside a field being edited |
| `title` | 22 / 28 | tracking `−0.01em` |
| `display` | 32 / 36 | tracking `−0.02em` |

Note the deliberate step **up** from `body` 15px at rest to `control` 16px while editing. Whatever
row anatomy you draw has to absorb that 1px without the line jumping when a value becomes a field —
`FR-031`'s "data landing must not shift the layout" is about loading, but the same discipline is what
makes in-place editing feel like editing rather than replacing.

---

## 3. The frame, and what is not yours

```
┌──────────────┬───────────────────────────────────────────────┐
│ sidebar      │ banner slot            ← R2's region, R3 fills │
│ 262px        ├───────────────────────────────────────────────┤
│ --color-page │ header  <ScreenHeader name="Profile" />       │
│              ├───────────────────────────────────────────────┤
│  … user chip │                                                │
│    links here│ THE PAGE  ← this brief                         │
│              │ --color-surface                                │
└──────────────┴───────────────────────────────────────────────┘
```

| Region | Owner | Draw it? |
| --- | --- | --- |
| Sidebar, and the user chip that links here | **entry R2** | as a correctly-proportioned grey box only. Its own design is not settled and this brief does not propose one |
| Header | **entry R2**'s `ScreenHeader` | yes, with `name="Profile"`, **no context line, no per-screen control, no New issue slot** (`FR-008`). Do not restyle it |
| Banner slot, above the header | **R2**'s region, **R3**'s banner | see §10 — placement is real, appearance is R3's |
| Message host, top-right | **entry R3** | see §9 — placement and copy are real, appearance is R3's |
| The page itself | **this brief** | yes, fully |

R4 consumes the message host and the connection banner; it does not build them (`FR-033`, `FR-034`,
[`contracts/ux-conventions.md`](./contracts/ux-conventions.md)). Draw them so the page can be judged
in their presence, and label them as context.

---

## 4. What renders — nine values, in this order

The order is §3.12's own table and is fixed (`FR-006`, `FR-024`).

| # | Value | Kind | At rest, when empty |
| --- | --- | --- | --- |
| 1 | **Avatar** | editable — a **URL text field**. No upload, no file picker, no cropper | the display name alone. No substitute image, no initials circle, no broken-image frame (`FR-012b`) |
| 2 | **First name** | editable, **required**, trimmed | cannot be empty |
| 3 | **Last name** | editable, **required**, trimmed | cannot be empty |
| 4 | **Job title** | editable, optional, free text | "Add a job title" |
| 5 | **Slack handle** | editable, optional, no format rule | "Add a Slack handle" |
| 6 | **Phone** | editable, optional, no format rule | "Add a phone number" |
| 7 | **Bio** | editable, optional, multi-line, ≥ 3 rows, grows, no maximum | "Add a bio" |
| 8 | **Email** | **shown, not a control** | never empty |
| 9 | **Account role** | **shown, not a control** — `admin` or `member` | never empty |

Plus, somewhere on the page, one **Change password** link (§8).

**The empty line is itself the button.** Each of the four placeholder lines is the pressable
affordance, so an empty optional field takes the same press and the same Tab stop as a filled one
(`FR-012b`, `SC-012`). It must read as a placeholder and not as a stored value — and since
`--color-text-placeholder` and `--color-text-muted` are the same colour today, the distinction you
have to make is **stored value in `--color-text` versus placeholder in `--color-text-placeholder`**,
plus whatever weight or style you add on top. Do not add a token to solve this.

**The avatar is two things at once, and that is the trap.** At rest the row shows the *image*; the
*value* is the URL, which appears only once the field is open. When there is no image the row shows
the display name — which the first and last name rows are also showing, two lines below. Draw this
so it reads as one record and not as a duplicated field.

**Length bounds, because they change how a row wraps or truncates.** Names, job title, Slack handle,
phone: 200 characters. Avatar URL: **2000**. Bio: **10000**. A 2000-character URL and a 200-character
job title are legal stored values; decide what a row does with them (§15).

---

## 5. Row anatomy — the five states to draw

For one representative single-line row, draw all five and show them adjacent so the transitions can
be read:

1. **Shown, filled** — the value in `--color-text` at `body` 15/24, with its label.
2. **Shown, hovered** — `data-hovered`. The affordance that says "this is pressable".
3. **Shown, focused by keyboard** — `data-focus-visible`, carrying the global 2px accent outline at
   2px offset. Tab must reach every editable value; this is how `SC-012` is met.
4. **Editing** — a React Aria `TextField`: `44px` tall, `1px --color-border-control`, `--color-surface`
   fill, `control` 16/24 text, focused, carrying the current value.
5. **Invalid** — the same field with `--color-danger` border and inline error text at `small` 13/20
   in `--color-danger`, associated with the field. Never colour alone; the error is words.

The gestures, which the drawing must make legible and must not add to (`FR-013a`):

| Gesture | Result |
| --- | --- |
| Press the value | it becomes a field, focused, carrying the current value |
| `Escape` | previous value returns, **nothing is written** |
| Blur | a changed value is written; an unchanged one is not |
| `⌘`/`Ctrl` + `Enter` | the same write, without waiting for focus to move |
| plain `Enter` | a line break **in the bio**; nothing in the other six |
| after any of them | focus returns to the affordance the field replaced |

**Saving is optimistic.** The new value appears immediately, before the server answers (`FR-014`).
There is therefore **no spinner, no "Saving…" label and no in-flight state on an editable row** —
the row simply shows the new value. If the server refuses, the previous value returns on that row
alone and a message appears top-right. Draw the refused case as: row back to its old value, message
in the host. Nothing else on the screen reacts.

**No control on this screen ever goes dead** (`FR-017`). There is no disabled state to draw — R2's
disabled-control-with-inline-reason convention deliberately does not land on this screen, because a
profile has exactly one person who may edit it and they are the only one who can reach it.

---

## 6. The bio

| | |
| --- | --- |
| Minimum | **three rows** when empty, in both the shown state and the field |
| Growth | grows to fit content, **no maximum height**. The page scrolls, the field never does |
| Content | plain text. Markdown syntax renders as characters — `**bold**` shows asterisks (`FR-009`, `OT-DATA-016`) |
| Line breaks | a stored newline **renders as a line break** at rest. This is presentation, not parsing |
| `Enter` | inserts a line break. `⌘`-`Enter` saves |

The three-row minimum has to hold in the skeleton too (§11), or the layout shifts when data lands.

---

## 7. The two shown values

Email and account role render the way an immutable field renders everywhere in this product — the
project key, the issue key (`FR-024`, `OT-UX-010`).

- Not a button, not a field, **not focusable, not in the tab order** (`FR-035`).
- Each carries a **visible label programmatically associated with the value**, so a screen reader
  reads the pair and not a bare string.
- Nothing about them responds to a press. No hover affordance, no cursor change.
- **Identical for a member and an admin.** Only the role's text differs — no badge, no colour coding,
  no admin chrome. Draw both to prove it.

They sit at the foot of the same column as the seven. Making them visually distinct from a shown
editable value, without making them look disabled, is part of the ask.

---

## 8. Change password

A **link**, not a field. There is no password input anywhere on this screen and there never will be
(`FR-027`).

| State | What shows |
| --- | --- |
| Rest | a link. One press sends; there is no confirmation step and no "are you sure" |
| In flight | the state renders **on the link itself** — never a separate indicator, never full-screen. It cannot be pressed a second time while out. Conveyed programmatically as well as visually, never by colour or motion alone |
| Success | a **success** message: "Check your email for a link to reset your password." |
| Throttled | an **error** message: "Too many requests. Try again in 3 minutes." |
| Failed to send | an **error** message: "Something went wrong. Try again." |

This is the one write on the screen that waits for the server rather than applying optimistically —
it has nothing on screen to apply. Its in-flight treatment is therefore the only busy state in the
whole design, and it belongs to one link.

---

## 9. Messages — placement is yours to respect, appearance is R3's

| Rule | | Source |
| --- | --- | --- |
| Kinds | four: success, info, warning, error | `FR-033` |
| Position | top-right | `FR-033` |
| Stacking | newest nearest the corner | `FR-033`, R2 `FR-034` |
| Auto-dismiss | five seconds from appearing | `FR-033` |
| Dismiss control | **every message carries one** — the timer is never the only way out | R2 `FR-034` (conflict 2) |
| How many stand at once | at most three, the rest queued | `FR-033`, and R3's to settle (conflict 3) |
| Repeats | **never coalesced.** Two identical refusals are two entries — a second refusal answers a second attempt | `FR-033` |

What this screen raises, and in which kind:

| Event | Kind |
| --- | --- |
| A save the server refused | **error**, naming what failed and why |
| A write refused while offline | **error** — "Changes need a connection" |
| Change password sent | **success** — the §13 string |
| Change password throttled | **error** — the §13 string |
| — | info and warning have no caller on this screen |

Draw them at **placement fidelity** — position, stacking, the cap, the dismiss control and the
verbatim copy — and treat their styling as **entry R3's**, since R3 builds and mounts the host. One
note for R3 rather than for this screen to settle: the token set has trios for success, danger and
advisory but **none for "info"**, so info needs either the accent ramp or a neutral, and that choice
belongs with the host.

---

## 10. Offline

| | |
| --- | --- |
| The banner | one, app-wide, in R2's banner slot above the header, reading **"Can't reach the server. Reconnecting."** — the upstream string, per conflict 1. It stacks with the must-change-password banner rather than replacing it |
| The refusal | a write attempted while offline is refused with **"Changes need a connection"** — a different string from the banner's, deliberately |
| When it shows | only for a **transport** failure, a request that never arrived. A refusal the server itself returned is a rejected write and takes an error message instead |
| When it clears | on the next request that does reach the server. "Reconnecting" obliges no retry cadence, so there is no progress or countdown to draw |
| Queueing | **none.** Nothing is held to be sent later, so there is no pending or retry state to draw |

The refusal takes the same rollback path as any other refusal, so offline is not a second visual
failure mode. Same rollback, same message host, different words.

The banner is **entry R3's** to build. Draw it for fit; its appearance is not this brief's.

---

## 11. The skeleton

`ProfileSkeleton` renders **the same rows, at the same heights, in the same order** as the loaded
screen — the bio's three-row minimum included — so that data landing shifts nothing (`FR-031`,
`OT-UX-005`).

- **Never a full-screen spinner.** Never a spinner at all.
- It is authored for this layout and shared with nothing — a skeleton that also matched R3's Accounts
  roster would match neither.
- Draw it as its own artboard, at the same canvas position as the loaded screen, so the two can be
  flipped between and the shift measured at zero.

---

## 12. Accessibility, as a design constraint rather than an audit

- Every field carries an **accessible name** and its error text is **associated with it** (`FR-035`).
  Labels are visible; a placeholder is not a label.
- **Never state or error by colour alone.** Every error is words.
- The whole screen — every edit, save, revert, and the change-password link — is completable **by
  keyboard alone** (`SC-012`). Every editable value is a Tab stop; the two shown values are not.
- Focus is visible on every stop, using the one global rule. No stop may lose it.
- Focus returns to the affordance after every save, rollback and Escape, so no gesture strands focus
  on an element that has been removed.
- The layout must survive RTL: inline start/end, never left/right.

---

## 13. Verbatim copy — do not paraphrase

| Where | Text |
| --- | --- |
| Empty job title | `Add a job title` |
| Empty Slack handle | `Add a Slack handle` |
| Empty phone | `Add a phone number` |
| Empty bio | `Add a bio` |
| Change-password success | `Check your email for a link to reset your password.` |
| Change-password throttled | `Too many requests. Try again in 3 minutes.` |
| Generic write failure | `Something went wrong. Try again.` |
| Offline banner | `Can't reach the server. Reconnecting.` — upstream's, per conflict 1, **not** R4 `FR-034`'s wording |
| Offline write refusal | `Changes need a connection` |

Every other string on the screen — the nine labels, the header — is not fixed by the spec and is
yours to propose. §4's row names are the obvious labels; say so if you would word one differently.

---

## 14. Deliverables

One canvas, roughly ten artboards, at the shell's real width (1280px minimum, content region
1018px):

1. **Loaded, complete** — every optional field filled, avatar image present.
2. **Loaded, sparse** — all five optionals empty, avatar unset so the display name stands alone.
   This is what a freshly invited account looks like, and it is the more common first render.
3. **Skeleton** — same rows, same heights, same order.
4. **Row anatomy** — one single-line row in the five states of §5, adjacent.
5. **Bio** — shown with line breaks, editing at three rows, editing grown well past three.
6. **Shown values** — email and account role, drawn once as a member and once as an admin.
7. **Change password** — rest and in-flight, with the success and throttle messages.
8. **Messages** — the four kinds, each with its dismiss control, and a stack at the three-visible cap
   with one queued.
9. **Offline** — banner in the slot above the header, plus a row that has just been refused.
10. **In frame** — the whole page inside the shell at 1280px, sidebar and header as grey boxes, to
    check that one column of nine values reads at that width rather than stranding in it.

---

## 15. Decisions this brief deliberately leaves open

These are not specified anywhere upstream. Decide them, and say what you decided.

1. **The page's own padding and vertical rhythm.** R2 fixes the shell's geometry and nothing fixes
   the content region's inset. Land it on the 8px grid.
2. **Row structure** — label above value, or a two-column label/value pair? The spec requires only a
   visible associated label; the shape is yours. Whichever you pick has to hold for the bio and for
   the two shown values as well.
3. **The at-rest affordance for an editable value.** §1's hard problem. A hover fill, a rule that
   appears, a pencil that appears on hover, an always-present underline — all are open, and the
   choice sets the pattern for R5 and R6.
4. **How a placeholder line reads as a placeholder**, given the placeholder and muted tokens are the
   same colour.
5. **The avatar's at-rest size and placement**, and how the display-name fallback avoids reading as a
   duplicate of the name rows below it.
6. **Long values.** A 2000-character avatar URL, a 200-character job title, a long email — truncate,
   wrap, or middle-ellipsis? Whatever you choose must not shift the layout when a value lands.
7. **Where Change password sits**, and whether the two shown values plus the link form a visually
   distinct group at the foot of the column.
8. **Whether the column is grouped or continuous** — dividers, section headings, or nine rows in a
   row. The spec fixes the order, not the grouping.
9. **The header's h1 type step.** `ScreenHeader` is R2's and its typography is not settled — and there
   is a live gap behind it: [`(auth)/signin/page.tsx`](../../src/app/(auth)/signin/page.tsx) styles its
   `h1` with a `text-heading` class that **no `--text-heading` token backs**, so that heading renders at
   the browser default today. R3's brief records the same finding. Propose a step from the six if it
   helps the page read, and mark it as a note to R2 — the Profile title, the Accounts title and
   sign-in's should settle together, not one screen at a time.

---

## 16. Do not draw

Each of these is out of scope by the spec, not by omission (§*Out of Scope*, `FR-010`, `FR-025`,
`FR-036`):

- Any view of **another user's** profile. No route to one exists in the product.
- An **avatar upload**, file picker, drag-and-drop target, cropper or image preview control.
- Any control that **sets the account role** or edits the **email address**.
- A **password field**, a password strength meter, or a password policy hint. The link is the only
  password-related thing on this screen.
- A **submit button**, a save button, a "Done editing" affordance, an edit-mode toggle, or a dirty-state
  indicator.
- A **confirmation dialog** before sending the reset link.
- Anything **activity- or notification-shaped**. A profile edit records nothing and notifies nobody.
- A **mobile or tablet layout**, a collapsed sidebar, or any breakpoint.
- **Empty-state illustration or marketing.** The product's rule is one quiet line per surface.
- A **rounded corner**, anywhere, on anything.

---

## 17. How the result gets checked

| Check | Against |
| --- | --- |
| Nine values, in §4's order, seven editable and two not | `FR-006`, `FR-024` |
| A value at rest is not an input, and is visibly pressable and Tab-reachable | `FR-013`, `SC-012` |
| The skeleton and the loaded screen differ by zero layout shift | `FR-031` |
| Every editable row has a visible label and an inline error position that does not move the layout | `FR-035`, `FR-017` |
| Email and role carry labels, carry no affordance, and are identical for member and admin | `FR-024`, US3 scenario 5 |
| Exactly one busy state exists in the whole design, and it is on the change-password link | `FR-014`, `FR-026` |
| Every string in §13 appears verbatim, including the banner's upstream wording | `FR-012b`, `FR-028`, `FR-029`, R2 `FR-035` |
| No hex outside the token set, no radius, no seventh type step, no breakpoint, no dark mode | §7, `globals.css` |
| No avatar fallback image anywhere — the display name alone, in both empty and failed-load cases | `FR-012b` |
