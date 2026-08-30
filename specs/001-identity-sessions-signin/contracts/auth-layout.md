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
| Vertical and horizontal centring | Its form, or its explanatory state |
| The card: surface, border, radius, padding, `max-width` | Its fields and its submit control |
| The app mark above the card | Its own error, success and in-flight states |
| The document `<main>` landmark | — |

**It performs no data access, no authorization and no redirect.** These are the public routes; there
is nothing to check. It also holds no state: the layout has no `"use client"`, imports nothing from
`react-aria-components`, and stays out of the client module graph (research A-2).

---

## Structural contract

```text
main                                  --color-page, min-h-full, grid, place-items-center, py-16
└── div                               w-full, max-w-[400px], flex-col, gap-6
    ├── p                             app mark — text-sm, --color-text, centred
    └── div                           the card — --color-surface, 1px --color-border,
                                      rounded-lg, p-8, flex-col, gap-6
        └── {children}                the page
```

`min-h-full` rather than `min-h-screen`: the root layout already sets `h-full` on `<html>` and
`min-h-full flex flex-col` on `<body>`, so the group's `<main>` inherits the height it needs.
`py-16` on the centring container means a tall state — change password with two fields and two
policy messages — scrolls instead of centring off the top of the viewport.

**Every page's first child is its `<h1>`.** The heading is not lifted into the layout because a
layout cannot receive per-page props, and passing one through a context or a slot would be
indirection where a heading in the page is plainly readable (Principle III).

---

## Token contract

Tokens land in `@theme inline` in `src/app/globals.css`. Tailwind v4 is configured in CSS; there is
no `tailwind.config.js` and none is created (AGENTS.md).

### Added by this feature

The ten-step neutral ramp and the thirteen semantic tokens in [`../research.md`](../research.md) A-4.
Components name **only** the semantic tokens; the ramp exists so a semantic token has somewhere
consistent to point.

### Taken from the specification unchanged

`--color-accent: #5b5bd6` and `--color-danger: #c8453c` are §7's accent and red. The other five
palette colours are content colours — projects, board columns, labels — and no UI surface in this
feature uses one.

### One rule the token names do not carry

`--color-text-muted` and `--color-danger` clear WCAG AA on `--color-surface` and **miss it** on
`--color-page` (4.36:1 and 4.20:1 — research A-4). All text on these screens sits inside the card
except the app mark, which therefore uses `--color-text`. A later slice rendering muted or error
text directly on the page background uses `--color-text`, or adds a `-on-page` token at
`neutral-700`.

### Deliberately **not** added

| | Why |
| --- | --- |
| A dark-mode token set | Research A-3 — out of v1; the starter's `prefers-color-scheme` block is deleted |
| Type-scale tokens | Research A-5 — Tailwind v4's default scale covers it (Principle IV) |
| A spacing unit token | Research A-6 — the built-in 0.25rem unit is already the rhythm |
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
| One focus-ring declaration: `outline: 2px solid var(--color-focus); outline-offset: 2px`, on `data-focus-visible` only | research A-8 |
| Validation per field, on blur; the submit control stays enabled and reports inline | `OT-UX-011`, research B-8 |
| `<Form validationBehavior="aria">`, controlled `isInvalid`, `<FieldError>` for the message | research B-8 |
| Every control has an accessible name, a visible focus indicator, and error text associated with it | AGENTS.md |
| State and errors are never conveyed by colour alone | AGENTS.md |
| No breakpoints — desktop only | §3, design brief |

---

## Screens rendered inside the layout

| Route | Heading | Body | States |
| --- | --- | --- | --- |
| `/signin` | Sign in | email, password, "Sign in", "Forgot password?" — **nothing else**, no sign-up link, no "remember me" | form · rejected · deactivated (with and without `SUPPORT_EMAIL`) · throttled · in-flight · success-after-reset banner |
| `/reset` | Forgot password | email, "Send reset link" — nothing else | form · in-flight · one confirmation, identical either way |
| `/reset?token=…` | Change password | New password, Confirm password | form · mismatch · policy failure (too short / blocklisted) · expired · used · unknown · in-flight |

The rejected and deactivated states must be **identical in treatment** — position, spacing, and the
element that carries them — because a visual difference is as much an account-existence oracle as a
wording difference (`FR-013`, `SC-003`).

---

## Delivered but not mounted

`MustChangePasswordBanner` (`FR-049`) is a component this feature delivers and this feature renders
nowhere: it belongs on every **authenticated** screen, and R2 builds the slot. It is not part of this
layout and must not be rendered inside it. See the plan's Complexity Tracking.
