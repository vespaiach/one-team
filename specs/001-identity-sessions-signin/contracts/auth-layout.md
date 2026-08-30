# Contract — the common layout for the unauthenticated screens

**Plan**: [`../plan.md`](../plan.md) · **Research**: [`../research.md`](../research.md) A-1…A-9 ·
**Design brief**: [`../design-brief.md`](../design-brief.md)

This is the contract the `/speckit-plan` input asked for: one layout the three unauthenticated
screens share, and the token set it rests on. R3's `/invite/accept` joins it unchanged.

---

## Route structure

```text
src/app/
├── layout.tsx                      root — html, body, fonts, I18nProvider (exists, edited only for A-9)
├── page.tsx                        / → redirect to /home (research B-6)
└── (auth)/
    ├── layout.tsx                  THE COMMON LAYOUT — Server Component
    ├── signin/page.tsx             /signin
    └── reset/page.tsx              /reset  and  /reset?token=…
```

`(auth)` is a route group, so it contributes no URL segment: the routes stay exactly the four
`OT-SEC-002` allows and §3 names. R2 adds `src/app/(app)/layout.tsx` as a sibling for the 262px
sidebar and header; the two groups cannot leak into each other, which is `OT-UX-001` made structural.

**`/reset` serves two screens.** The Forgot-password request and Change password (screen 13) are one
route discriminated by `searchParams.token`. Both render inside the same layout, so no branch on the
frame is needed — only on the body.

---

## What the layout owns, and what it does not

| The layout owns | Each page owns |
| --- | --- |
| The page background (`--color-page`) | Its `<h1>` |
| Horizontal centring and the card's vertical anchor | Its form, or its explanatory state |
| The card: surface, border, radius, padding, `max-width` | Its fields and its submit control |
| The app mark above the card | Its own error, success and in-flight states — **all three routes have an in-flight state**, not only `/signin` |
| The document `<main>` landmark | — |

**It performs no data access, no authorization and no redirect.** These are the public routes; there
is nothing to check. It also holds no state: the layout has no `"use client"`, imports nothing from
`react-aria-components`, and stays out of the client module graph (research A-2).

---

## Structural contract

```text
main                                  --color-page, min-h-full, flex-col, items-center,
                                      pt-[max(12vh,96px)], pb-16
└── div                               w-full, max-w-[440px], flex-col, gap-6
    ├── p                             app mark — the One/Team lockup, aligned to the card's left edge
    └── div                           the card — --color-surface, 1px --color-border,
                                      radius 0, p-8, flex-col, gap-6
        └── {children}                the page
```

`min-h-full` rather than `min-h-screen`: the root layout already sets `h-full` on `<html>` and
`min-h-full flex flex-col` on `<body>`, so the group's `<main>` inherits the height it needs.

**The card is never vertically centred.** Its top edge sits at `12vh` with a `96px` floor. These
screens add and remove message blocks between states, and a vertically centred card slides under the
reader while they are reading the error that just appeared; the floor means a short window rises
rather than clipping, and `pb-16` means a tall state — change password with two fields and two policy
messages — scrolls instead of running off the bottom.

**Every page's first child is its `<h1>`.** The heading is not lifted into the layout because a
layout cannot receive per-page props, and passing one through a context or a slot would be
indirection where a heading in the page is plainly readable (Principle III).

---

## Token contract

Tokens land in `@theme inline` in `src/app/globals.css`. Tailwind v4 is configured in CSS; there is
no `tailwind.config.js` and none is created (AGENTS.md).

### Added by this feature

The eleven-step warm neutral ramp and the semantic layer in [`../research.md`](../research.md) A-4,
the six type steps in A-5, and `--spacing`, `--size-field` and `--size-card` in A-6 and A-7.
Components name **only** the semantic tokens; the ramps exist so a semantic token has somewhere
consistent to point, which is what keeps A-3's dark-mode reversal a one-block edit.

### Taken from the specification unchanged

`--color-accent-500: #5b5bd6` and `--color-red-500: #c8453c` are §7's accent and red, each extended
into a ramp so both have a tint, the declared value, and a step dark enough to set text on their own
tint. The other five palette colours are content colours — projects, board columns, labels — and no
UI surface in this feature uses one as chrome; green and amber are borrowed through
`--color-success-*` and `--color-advisory-*` for the post-reset and must-change blocks.

### The one rule that lives in a token name

`--color-border` is **decorative** — the card edge and dividers, 1.49:1 on the card. Anything a user
has to aim at uses `--color-border-control` (3.42:1), and that includes **every field border from
rest**, because a field carries no fill of its own and its border is the only thing separating white
from white (WCAG 1.4.11, `FR-012`). The names carry the distinction because that is the only place it
survives eleven later slices.

`src/app/globals.test.ts` asserts every foreground/background pair the screens use directly against
`globals.css`, so a token edit that drops a pair below 4.5:1 (text) or 3:1 (non-text) fails gate 8.

### Deliberately **not** added

| | Why |
| --- | --- |
| A dark-mode token set | Research A-3 — out of v1; the starter's `prefers-color-scheme` block is deleted |
| A `--color-focus` token | Research A-8 — the ring is `--color-accent`; a second name that always resolves to it is indirection with no requirement today (Principle III) |
| A component library | Principle I, and the roadmap's §1.1: R2 ships none either; a shared primitive is extracted at its second call site |

---

## Interaction contract for everything inside the card

Fixed here because these three screens are the first surfaces the product renders, and every later
slice inherits them.

| Rule | Source |
| --- | --- |
| Behaviour, focus, keyboard and ARIA come from `react-aria-components`; Tailwind is the visual layer only | `OT-UX-018`, §7 |
| Import from the package's subpath exports — `react-aria-components/TextField`, `/Form`, `/Button` — matching the root layout's existing `react-aria-components/I18nProvider` | pinned 1.20.0 package layout |
| `onPress`, never `onClick` | AGENTS.md |
| Visual state through `data-hovered`, `data-pressed`, `data-focus-visible` — never a hand-rolled `:hover` on an interactive element | AGENTS.md |
| One focus-ring declaration: `outline: 2px solid var(--color-accent); outline-offset: 2px`, on `data-focus-visible` only | research A-8 |
| Validation per field, on blur; the submit control stays enabled and reports inline | `OT-UX-011`, research B-8 |
| `<Form validationBehavior="aria">`, controlled `isInvalid`, `<FieldError>` for the message | research B-8 |
| Every control has an accessible name, a visible focus indicator, and error text associated with it | AGENTS.md |
| The conformance target is **WCAG 2.2 Level AA** — the bar A-4's contrast figures are asserted against, and one A-7's 44px fields and 44px button clear for 2.2's 24×24 target-size minimum | `FR-012` |
| State and errors are never conveyed by colour alone | AGENTS.md |
| Each screen sets its own document title and carries exactly one `<h1>`; language and direction come from the root layout | `FR-079` |
| A refused submit moves focus to the first invalid field. **No error summary** — the failure belongs on the field | `FR-081` |
| A form-level outcome — rejected, deactivated, throttled, a token state, the success banner — is announced when it appears, not only rendered | `FR-082` |
| Every screen is completable by keyboard alone, focus order following the card's visual order | `FR-083` |
| A long address or message wraps and grows the card. Never truncated, never overflowing, never a horizontal scroll | `FR-084` |
| Validation also runs on submit for a field that was never blurred, so an autofilled value is still checked | `FR-085` |
| No animation and no transition, so there is no motion for a reduced-motion preference to reduce | `FR-086` |
| No breakpoints — desktop only, usable down to a **1024px** viewport; below that is unsupported and not designed for | §3, design brief, `FR-080` |

---

## Screens rendered inside the layout

| Route | Heading | Body | States |
| --- | --- | --- | --- |
| `/signin` | Sign in | email, password, "Sign in", "Forgot password?" — **nothing else**, no sign-up link, no "remember me" | form · rejected · deactivated (with and without `SUPPORT_EMAIL`) · throttled · in-flight · success-after-reset banner |
| `/reset` | Forgot password | email, "Send reset link" — nothing else | form · in-flight · one confirmation, identical either way · **throttled** (`FR-087`) |
| `/reset?token=…` | Change password | New password, Confirm password | form · mismatch · policy failure (too short / too long / blocklisted) · expired · used · unknown · in-flight |

The rejected and deactivated states must be **identical in treatment** — position, spacing, and the
element that carries them — because a visual difference is as much an account-existence oracle as a
wording difference (`FR-013`, `SC-003`).

---

## Delivered but not mounted

`MustChangePasswordBanner` (`FR-049`) is a component this feature delivers and this feature renders
nowhere: it belongs on every **authenticated** screen, and R2 builds the slot. It is not part of this
layout and must not be rendered inside it. See the plan's Complexity Tracking.
