# Design brief — R1: identity, sessions and sign-in

**For**: Claude Design (claude.ai/design)
**Feature**: [`spec.md`](./spec.md) · roadmap entry **R1**
**Source of truth**: [`docs/product/specifications.md`](../../docs/product/specifications.md) §3.1, §3 screen 13, §4, §6, §7
**Design returned**: project `cc49e5c8-0982-43e1-9cce-51afb954ef3b` — `Foundations.dc.html` (the system) and
`Sign-In Screens.dc.html` (the surfaces)

Three public screens plus one banner. They are the only surfaces this feature renders, and
they are the first surfaces the product renders at all — so the visual decisions made here
become the baseline every later screen inherits.

**The design is back.** This brief no longer asks; it records what came back and what is built.
The token block it returned has already landed in `src/app/globals.css` (`29a9ace`), so parts of the
repository have taken the design's side of decisions its planning documents still record the other
way.

Where the returned design and the specification disagree, **the specification wins** — this brief
records the specification's answer as the built one and the design as the thing to amend. Those six
are listed under *Where the design loses to the specification*; what the specification does not
decide is under *Decided beyond the specification*.

---

## Non-negotiables

The specification fixes these. A design that changes one is wrong, not opinionated. All seven survived.

| | |
| --- | --- |
| **Frame** | All three screens render **outside the application shell** — no sidebar, no header, no nav. A card on the page background. This never changes; the shell arriving in R2 does not later wrap them. (`OT-UX-001`) |
| **Field inventory** | Exactly what each screen lists below, and "nothing else" — the specification's own phrase. |
| **No sign-up link.** | "There is nothing for a stranger to do here." No social sign-in, no SSO, no registration route. |
| **No "remember me"** | The cookie is always 30 days sliding. There is no control for it. |
| **Validation** | Per-field, **on blur**. Never a wall of errors on submit. The submit control **stays enabled** and reports what is missing inline rather than going dead. (`OT-UX-011`) |
| **Viewport** | Desktop only. No breakpoints, no mobile layout; usable down to **1024px**, unsupported below (`FR-080`). The design frames at 1440 × 900. |
| **Tone** | "One quiet line per surface. No illustrations, no empty-state marketing." (§4) |

---

## The six decisions, settled

The brief asked for an explicit value for each. These are the values.

| | Decision | Value |
| --- | --- | --- |
| 1 | **Card** | **440px**, horizontally centred, top edge at **12vh with a 96px floor**. **Never vertically centred** — states add and remove height, and a centred card slides under the reader while they are reading the error. |
| 2 | **Type scale** | **Six steps, 11 → 32px**, one family: **Archivo**. Line heights absolute so every step lands on the 4px unit. |
| 3 | **Spacing** | **4px unit.** Everything structural lands on 8; 4 exists only for the gap between a control and the text annotating it. |
| 4 | **Field** | **44px, ruled, unfilled.** 1px border, **zero radius**, no fill of its own. The border carries state; nothing else moves. Ruled at **neutral-500 from rest** — the design's lighter resting border fails WCAG 1.4.11, see L5. |
| 5 | **Focus ring** | **2px accent at 2px offset**, one rule for every control, driven off `data-focus-visible`. An outline, not a border, so it never changes layout. |
| 6 | **Dark mode** | **Out.** Delete the starter's `prefers-color-scheme` block. Every semantic token points at a ramp step rather than a hex, so adding it later is one remap of the semantic layer and no component edits. |

---

## Colour

### Neutral — eleven steps, warm

A trace of yellow in the hue, so the page reads as paper rather than as screen grey.

| | | | | | |
| --- | --- | --- | --- | --- | --- |
| 50 | `#fbfaf9` | 400 | `#b3aeaa` | 800 | `#3a3735` |
| 100 | `#f4f2f0` | 500 | `#8f8a86` | 900 | `#24211f` |
| 200 | `#e8e5e2` | 600 | `#6e6a66` | 950 | `#151312` |
| 300 | `#d7d3cf` | 700 | `#55514e` | | |

- **50–200** grounds and tinted fills. The page is 100; cards are pure white so they lift off it without a shadow.
- **300–400** rules and disabled ink. 300 is the card edge and dividers; 400 is the lightest thing allowed to hold a glyph.
- **500–600** secondary text, and 500 is the field border (L5). 600 carries all muted copy, and placeholders where a screen keeps one (L6).
- **700–950** ink. Body text is 900. 950 is reserved for an eventual dark-mode ground.

**The scale is warm and §7's `grey #8b909a` is cool, and they deliberately never touch.** §7's grey
stays a *content* colour — a value someone chose for a project or a label — so it must not read as
chrome.

### Accent and red — full ramps

The two §7 colours with a job on these screens. Both get a ramp because both need a tint, the
declared base, and a step dark enough to set body copy on their own tint.

| Accent — `#5b5bd6` is 500 | | Red — `#c8453c` is 500 | |
| --- | --- | --- | --- |
| 50 `#f2f2fc` · 100 `#e4e4f9` · 200 `#c9c9f2` | 300 `#a5a5e9` · 400 `#8080df` | 50 `#fdf3f2` · 100 `#fbe4e2` · 200 `#f5c4c0` | 300 `#ec9a94` · 400 `#dd6b63` |
| **500 `#5b5bd6`** · 600 `#4a4ac0` · 700 `#3c3c9c` | 800 `#2f2f78` · 900 `#23235a` | **500 `#c8453c`** · 600 `#ad3730` · 700 `#8c2b25` | 800 `#6b211d` · 900 `#4f1917` |

Accent 500 fills the primary control and draws the focus ring; 600 is hover, 700 pressed and the
only accent step allowed to set text, including the "Forgot password?" link. Red 500 draws the
errored field border, 100 is the message fill, 700 the text on it. **Red never fills a button** —
nothing on these screens is destructive.

### Content colours — three steps each, unused on R1

The remaining five from §7. They label projects, board columns and tags, carry no interface meaning,
and appear on none of these screens.

| | | | |
| --- | --- | --- | --- |
| blue | `#e7f1f9` · `#2f7fc4` · `#1f5c92` | green | `#e7f4ec` · `#3a9d5d` · `#27713f` |
| violet | `#f3ebfd` · `#9b5de5` · `#6f39ad` | amber | `#fbf2dc` · `#d4a017` · `#8a6708` |
| grey | `#eff0f2` · `#8b909a` · `#5a5f68` | | |

Green and amber are the exception to "unused": the post-reset success block and the
must-change-password banner borrow their tint / deep pair through the semantic layer.

### Semantic layer — the only names a component uses

Nothing in a component file names a ramp step and nothing names a hex. That is what makes decision 6
cheap to reverse.

| Token | Points at | Where |
| --- | --- | --- |
| `--color-page` | neutral-100 | The ground behind the card on all three screens |
| `--color-surface` | `#ffffff` | The card, and the inside of every field |
| `--color-surface-sunken` | neutral-50 | Neutral message blocks — the token states, which explain rather than accuse |
| `--color-border` | neutral-300 | Card edge and dividers **only** — decorative, never a control boundary (L5) |
| `--color-border-control` | neutral-500 | Every field border, from rest (L5) |
| `--color-border-strong` | neutral-900 | The 2px rule that opens a section or a message block |
| `--color-text` | neutral-900 | Headings, labels, field values |
| `--color-text-muted` | neutral-600 | The one quiet line per surface, helper text |
| `--color-text-placeholder` | neutral-**600** | Placeholders only — never a value the reader has to keep. neutral-500 as returned fails 4.5:1 (L6) |
| `--color-text-disabled` | neutral-400 | Rare here — the submit control never goes dead (`OT-UX-011`) |
| `--color-accent` / `-hover` / `-pressed` | accent-500 / 600 / 700 | Primary fill, and the focus ring |
| `--color-accent-text` | accent-700 | Links at body size |
| `--color-danger` / `-fill` / `-text` | red-500 / 100 / 700 | Errored border, error ground, error ink |
| `--color-success` / `-fill` / `-text` | green-500 / 100 / 700 | The post-reset banner on `/signin` |
| `--color-advisory` / `-fill` / `-text` | amber-500 / 100 / 700 | The must-change-password banner |

---

## Type, space, geometry

**Type** — Archivo, six steps, absolute line heights.

| Step | Size / line-height / weight | Job |
| --- | --- | --- |
| `display` | 32 / 36 / 700 / −0.02em | The card heading |
| `title` | 22 / 28 / 600 / −0.01em | Reserved — no R1 surface uses it |
| `control` | 16 / 24 / 500 | Field values and button labels |
| `body` | 15 / 24 / 400 | Message blocks, the quiet line, links |
| `small` | 13 / 20 / 400 | Inline field errors, helper text |
| `micro` | 11 / 16 / 600 / +0.08em / caps | Field labels |

Body is 15 rather than 16 because the only long-form text in the product is an issue description,
and 15/24 sets a comfortable measure at 440px. Control text stays 16 so a value never looks smaller
than the label above it.

**Space** — unit 4px, nine steps, the card uses five.

| | | | |
| --- | --- | --- | --- |
| 4 | control → its inline error | 20 | field group → field group |
| 8 | label → field | 24 | last field → submit; message block → form |
| 12 | inside a message block, vertical | 32 | card padding; title → form |
| 16 | field padding, inline | 48 / 64 | reserved for R2 — shell gutters, page sections |

**Geometry** — card 440px wide, 32px padding, form column 376px. Radius is **0** everywhere.

**Message blocks** — four treatments, one geometry: a 2px rule on top, a tinted ground, 12/16
padding, full form width. Error (rejected, throttled), Notice (deactivated, token states), Success
(after a completed reset), Advisory (the banner — the only one that rules along its *bottom* edge,
because it sits at the top of the shell rather than inside a card).

---

## The surfaces

### 1. Sign in — `/signin`

**Form** — email field, password field, a "Sign in" control, a "Forgot password?" link. Nothing else.
Quiet line: `Accounts exist only by invitation.`

| State | Delivered |
| --- | --- |
| **Form** | The default. |
| **Rejected** | Error block. One message covering both a wrong password and an unknown email. |
| **Deactivated** | Notice block, both variants drawn — contact configured and not. |
| **Throttled** | Error block, stating **whole minutes rounded up** (`FR-039`). The design returned an `mm:ss` countdown; it is superseded (L1). |
| **In flight** | The submit label is replaced by a spinner and `Signing in…`; the control stops accepting a second press; fields stay readable, not greyed. |
| **Success banner** | Success block above the form, for arrival from a completed reset. |
| **Per-field, on blur** | Errored field takes a red border with the message below it in `small`; the submit stays live. |

**Rejected and deactivated share block position, height and rhythm exactly.** Only the colour
differs, and the colour alone reveals nothing about whether an account exists — deactivated is
reachable only with correct credentials, so it is not an oracle (`FR-013`, `SC-003`).

### 2. Forgot password — `/reset`

An email field and a "Send reset link" control, nothing else. Quiet line:
`We'll email a link that sets a new one.`

One outcome state — the same confirmation whether or not the address exists, in a Notice block under
its own `Check your email` heading. **The form does not stay on screen underneath it**, so an unknown
address cannot try again and read the difference.

**Two further states are built that the design did not draw**: the throttled state `FR-087` requires,
in the sign-in Error block with the same string (L2), and the in-flight state (L3).

### 3. Change password — `/reset?token=…` (screen 13)

Full page outside the shell, exactly like Sign in itself. Reachable only through an emailed link.

**Form** — **New password** and **Confirm password**. Quiet line:
`At least twelve characters. Nothing else is required.`

| State | Delivered |
| --- | --- |
| **Mismatch** | Inline error on *Confirm password*. |
| **Policy failure** | The field names the rule that failed and nothing else. Drawn: too short, on the blocklist. No composition checklist, because there are no composition rules. |
| **Expired / used / unknown token** | Three cards, each with its own `<h1>` and its own sentence in a Notice block. |

**The three token states are distinguishable by their heading, not by colour** — all three use the
neutral Notice block, because none of them is the reader's fault. Each carries the same route
forward: a `Request a new link` control under the message, back to `/reset`.

**Also built, not drawn**: the in-flight state (L3), and the "too long" policy failure at the
128-character maximum, which takes the same inline treatment as "too short".

On success the screen redirects to `/signin` carrying the success message, which is the success-banner
variant above.

### 4. Must-change-password banner

Full bleed across the shell, above everything including the header. **It pushes content down rather
than overlaying it**, so nothing is ever hidden behind it. Amber, no icon, **no close control** —
dismissing it would be the only way to make it a lie, since the condition it reports is still true
afterwards. It may be permanent furniture on a server whose admin never changes their password.

**One quiet line and no control.** The design returned a "Change it" link; R1 ships no screen a
signed-in user can change a password from, so the link is dropped and R4's Profile adds it with the
route (L4).

R2 builds the slot; this feature delivers the component and renders it nowhere.

---

## Copy

**Fixed by the specification — verbatim:**

- `That email and password don't match.` — the rejected state
- `Contact your One Team administrator.` — deactivated, where no contact address is configured
- `If that address has an account, a link is on the way` — the reset request answer

**Written by the design.** These were the seven the brief listed as unspecified.

| State | Block | Text |
| --- | --- | --- |
| Deactivated, no contact | Notice | `This account has been deactivated. Contact your One Team administrator.` |
| Deactivated, contact set | Notice | `This account has been deactivated. Contact <SUPPORT_EMAIL>.` |
| Throttled | Error | `Too many attempts. Try again in <n> minutes.` — `<n>` whole minutes rounded up, computed server-side (`FR-039`). **Corrected from what the design returned.** |
| Expired token | Notice | `This link has expired. Reset links last one hour.` |
| Used token | Notice | `This link has already been used. Your password was changed with it.` |
| Unknown token | Notice | `This link isn't one we recognise. Check the whole address came across from the email.` |
| Reset complete | Success | `Your password has been changed. Sign in with it now.` |
| Must change password | Advisory | `Your password is still the one set when this server was installed.` |

Both deactivated variants open on the same sentence, so the two differ only in whether an address
follows — no `user` row is disclosed either way (`OT-SEC-018`). All three token states end without an
instruction, because the route forward is the same control in all three and naming it in the sentence
would say it twice.

---

## Contrast — measured, not assumed

WCAG ratios for the pairs the screens actually use. **The conformance target is WCAG 2.2 AA**
(`FR-012`).

| Pair | Ratio | Needs | |
| --- | --- | --- | --- |
| `--color-text` on page | 14.33:1 | 4.5:1 | pass |
| `--color-text` on surface | 16.00:1 | 4.5:1 | pass |
| `--color-text-muted` on surface | 5.36:1 | 4.5:1 | pass |
| `--color-text-muted` on **page** | 4.80:1 | 4.5:1 | pass |
| `--color-accent-text` on surface | 9.06:1 | 4.5:1 | pass |
| `#ffffff` on `--color-accent` | 5.37:1 | 4.5:1 | pass |
| `--color-danger-text` on `--color-danger-fill` | 6.95:1 | 4.5:1 | pass |
| `--color-success-text` on `--color-success-fill` | 5.27:1 | 4.5:1 | pass |
| `--color-advisory-text` on `--color-advisory-fill` | 4.68:1 | 4.5:1 | pass |
| Focus ring on surface / on page | 5.37:1 / 4.81:1 | 3:1 | pass |
| `--color-border-control` on surface — the field border | 3.42:1 | 3:1 (1.4.11) | pass |
| `--color-danger` border on surface | 4.80:1 | 3:1 (1.4.11) | pass |
| `--color-text-placeholder` at neutral-600 on surface | 5.36:1 | 4.5:1 | pass |
| ~~neutral-300 as a field border, **as returned**~~ | 1.49:1 | 3:1 (1.4.11) | **fail — L5** |
| ~~neutral-500 as placeholder ink, **as returned**~~ | 3.42:1 | 4.5:1 | **fail — L6** |

The warm ramp fixes the failure the planning documents recorded against the earlier cool one: muted
text now clears 4.5:1 on the page background as well as on the card. The two struck rows are the
values the design returned; the rows above them are what is built.

---

## Where the design loses to the specification

Six, and all six are settled: the specification's answer is what is built, and the design file is
what gets amended. Cited elsewhere in this brief as **L1**…**L6**.

**L1 · The throttle is a countdown, and must not be.** `Foundations` specifies "tabular figures,
mm:ss, counting down" and the screen renders `14:52`. `FR-039` requires the remaining time
"expressed to the caller as whole minutes rounded up", computed server-side on each refused attempt.
A ticking client timer is state the server does not own, and it reaches `00:00` while the refusal is
still in force. **Built**: the *Copy* string, whole minutes. `Foundations` §10 and the throttled card
both need amending, and `checklists/ux.md` CHK018 already recorded this decision once.

**L2 · `/reset` gets the throttled state it was not drawn.** `FR-087` requires one — reset requests
are throttled under their own counter (`FR-040`), so a refusal is reachable there and has to explain
itself as it does on sign-in. **Built**: the sign-in Error block, same string.

**L3 · In-flight applies to all three screens.** The design drew it only on `/signin`; §4's *Slow
write* is not screen-specific. **Built**: the sign-in treatment — spinner, replaced label, the
control refusing a second press, fields readable rather than greyed — on `/reset` and
`/reset?token=…` unchanged.

**L4 · The banner's "Change it" link is dropped.** `FR-049` makes the banner advisory and blocking
nothing, and R1 delivers no screen from which a signed-in user can change a password — the link
resolves nowhere until R4's Profile. **Built**: the sentence alone. R4 adds the control and amends
the string when it has somewhere to point.

**L5 · The resting field border is ruled at neutral-500.** `FR-012` pins **WCAG 2.2 AA**, and 1.4.11
wants 3:1 for anything identifying a control. The field carries no fill of its own, so its border is
the only thing delimiting white-on-white — neutral-300 gives 1.49:1. **Built**: `--color-border-control`
(neutral-500, 3.42:1) from rest, with `--color-border` demoted to the card edge and dividers, which
are decorative. *This costs the design one affordance*: the border can no longer darken to mark a
field that holds a value, because it starts there. Rest, focus and invalid are the states that
carry meaning, and all three still read.

**L6 · Placeholder ink darkens to neutral-600.** neutral-500 is 3.42:1 against the card, and a
placeholder is text — 4.5:1 applies. **Built**: neutral-600 (5.36:1). Worth noting every field here
already has a visible label, so a screen that drops its placeholder rather than darkening it loses
nothing.

L5 and L6 are token values and are applied: `--color-border-active` is renamed
`--color-border-control` so the 3:1 rule lives in the name, and `--color-text-placeholder` moves to
neutral-600. `src/app/globals.test.ts` asserts every pair in *Contrast* against `globals.css` and
fails the gate if one drops below its threshold, so this cannot regress silently. L1–L4 are surface
decisions and land when the screens are built.

---

## Decided beyond the specification

The specification is silent on these, so the design stands unless there is a reason in the codebase
today to overrule it. Two needed a choice made.

**The focus ring is drawn in `--color-accent`; there is no `--color-focus`.** `research.md` A-8 and
`contracts/auth-layout.md` both named a `--color-focus` token that the shipped block never declared,
so a component written against the recorded rule would emit an outline with no colour. A second
semantic name that always resolves to `--color-accent` is indirection with no requirement behind it
today (Principle III), and adding it later is one declaration. Both documents now name
`--color-accent`.

**Archivo is loaded through `next/font/google`; Geist is gone.** `globals.css` named Archivo while
`layout.tsx` loaded Geist, so the declared family was never fetched and silently fell back. The six
type steps were drawn in Archivo and assume its weights and tracking, so Archivo wins and Geist Sans
goes with it. `Geist_Mono` went too: it was loaded on every request and referenced by no token, which
is dead code (Principle VI). `next/font/google` self-hosts at build time — no runtime request to
Google, no layout shift, no new dependency (Principle IV).

**Six planning decisions were superseded by the returned design, and are now propagated.**
`research.md` A-4 through A-9 and `contracts/auth-layout.md` recorded the pre-design answers while
the shipped token block already had the design's:

| Was recorded | Now |
| --- | --- |
| A-4 — ten-step cool ramp, 500 = `#8b909a` | Eleven-step warm ramp; §7's grey stays a content colour |
| A-5 / auth-layout "deliberately not added" — no type tokens | Six named steps, 11 → 32px, none of them Tailwind's values |
| A-6 / auth-layout "deliberately not added" — no spacing token | `--spacing: 4px` declared |
| A-7 / auth-layout structural contract — 400px card, `rounded-lg`, `rounded-md` inputs, 40px field, vertically centred | 440px, radius 0 throughout, 44px field, top edge at 12vh and never vertically centred |
| auth-layout — app mark centred, `text-sm` | The two-tone `One`/`Team` lockup, left-aligned to the card's edge |
| A-3 — dark mode out | Unchanged, confirmed |

**One consequence worth knowing.** Type and spacing are both absolute, following the design's "line
heights are absolute so every step lands on the 4px unit". The surfaces therefore respond to browser
zoom but not to a raised default font size. WCAG 1.4.4 is met through zoom; this is a deliberate
trade, and reversing it means moving the whole type scale to `rem`.

---

## Where it lands

Tokens are in `@theme inline` in `src/app/globals.css` (Tailwind v4 is configured in CSS — there is
no `tailwind.config.js` and none should be created). Components are built on React Aria `TextField`,
`Button` and `Form`; the design models how the states look, and `react-aria-components` supplies the
keyboard, focus and ARIA behaviour (`OT-UX-018`).
