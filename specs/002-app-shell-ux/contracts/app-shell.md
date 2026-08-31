# Contract — the application shell

**Plan**: [`../plan.md`](../plan.md) · **Research**: [`../research.md`](../research.md) A-1…A-3, B-1…B-8

The frame every authenticated screen from R3 onward renders inside. R1's
[`auth-layout.md`](../../001-identity-sessions-signin/contracts/auth-layout.md) is this contract's
sibling: that one owns the three screens outside the shell, this one owns everything inside it, and
`OT-UX-001`'s boundary between them is the two route groups.

---

## Route structure

```text
src/app/
├── layout.tsx                  root — html, body, fonts, dir, I18nProvider          R1, untouched
├── page.tsx                    / → /home                                            R1, untouched
├── not-found.tsx               unmatched URL, outside the shell                     R2
├── (auth)/                     the three screens outside the shell                  R1, untouched
└── (app)/
    ├── layout.tsx              THE SHELL — sidebar, banner slot, content region
    ├── forbidden.tsx           §3.11, inside the shell
    ├── not-found.tsx           "This doesn't exist", inside the shell
    ├── home/page.tsx           /home — the headerless exception
    └── …                       every other route in route-surface.md
```

`(app)` is a route group and contributes no URL segment, so the surface stays exactly the paths §3's
screen table assigns (`FR-028`). The two groups cannot leak into each other, which is what makes
`FR-004` structural rather than a rule three pages have to remember.

---

## What the layout owns, and what the page owns

| The shell layout owns | Each page owns |
| --- | --- |
| The sidebar, entire | Its `<ScreenHeader>`, or none on `/home` |
| The banner slot, and whether the banner is in it | Its own authorization check |
| The content region and its fill | Its content |
| The 1280px minimum and the flex row | Its own empty, loading and error states |

**The layout reads the actor; it does not check it.** `loadActor()` for presentation, and every page
below repeats the check that actually protects the route
([`../research.md`](../research.md) A-3, and R1's `loadActor` contract). With no actor the layout
renders its `children` and no frame — a branch that runs and is never seen. The framework renders a
layout concurrently with the page beneath it, so on a request carrying no session the layout resolves
`null` while the page's `requireActor()` redirects, and the output is discarded. It exists so the
layout cannot throw on a request already leaving; `src/proxy.ts` redirects most such requests before
they match anything, and `FR-021` covers the rest.

**The header is the page's.** A layout cannot receive the page's title, and `FR-019` requires the
refusing route's header to name Forbidden rather than the screen that refused — both point the same
way ([`../research.md`](../research.md) A-2).

---

## Structural contract

```text
div                              min-w-[1280px], flex, min-h-full          ← inline start = DOM order
├── a  #main-content             the keyboard bypass — first focusable on the page,     FR-031
│                                visually hidden until focused, never display:none
├── nav  aria-label              w-[262px], shrink-0, sticky start-0, border-e            FR-031
│                                --color-border, --color-page fill, flex-col, h-full,
│                                overflow-y-auto — sticky so the document's own horizontal
│                                scroll below 1280px leaves the sidebar in place          FR-005
│   ├── p / span                 the app mark — presentational, not a second route to /home
│   ├── a  /home                 Home
│   ├── section                  the project-list region — overflow-y-auto: this is the  FR-005
│   │   │                        part that grows, and the only part that scrolls
│   │   ├── header + a /projects/new       the `+` — rendered only when isAdmin
│   │   └── p                    the quiet empty line, "No projects yet."               FR-024
│   ├── a  /notifications        Notifications — no count until R11
│   ├── a  /settings/accounts    rendered only when isAdmin
│   ├── a  /settings/labels      rendered only when isAdmin
│   └── div                      the chip, pinned to the foot (mt-auto)                  FR-005
│       ├── a  /profile          avatar (or none, or one that failed to load) + name     FR-017
│       └── form → signOut       the sign-out control, a sibling of the link
└── main id="main-content"       flex-1, --color-surface fill, flex-col                  FR-031
    ├── {banner}                 the banner slot — above the header, so /home still has  FR-025
    │                            one; occupies no space when there is nothing to render
    └── {children}               the page, whose first child is its own header
```

`min-h-full` rather than `min-h-screen`: the root layout already sets `h-full` on `<html>` and
`min-h-full flex flex-col` on `<body>`, exactly as R1's layout relies on.

### The header, rendered by the page

```text
header                           flex, items-start, justify-between
├── div                          the title block
│   ├── h1                       the name
│   └── p                        the context line — omitted entirely when absent, never left empty
├── div                          the one per-screen control slot — renders nothing when empty,
│                                never a placeholder                                     FR-007
└── div                          the New issue slot, pinned to the far inline end        FR-008
```

`/home` renders no header at all — no title block, no slots (`FR-003`). Forbidden renders one, titled
as itself, with both slots empty (`FR-019`).

---

## Direction, width and the absence of breakpoints

| Rule | How | Requirement |
| --- | --- | --- |
| The sidebar occupies the inline start | first child of a flex row; the root layout already sets `dir` | `FR-001` |
| 262px is a width, not an edge | `w-[262px]`; the divider is `border-e`, not `border-r` | `FR-001` |
| No collapse, stack or hide at any width | `shrink-0`, and no media query anywhere in the feature | `FR-010` |
| Below 1280px the page scrolls horizontally | `min-w-[1280px]` on the shell root; the document scrolls itself | `FR-010` |
| That scrolling does not carry the sidebar away | `sticky` with `start-0` on the nav — an inline-start inset, so the pin follows the resolved direction as the width does | `FR-005` |
| No responsive layout, no mobile breakpoint | none is written; not deferred, out of v1 | `OT-SCOPE-004` |

The content region needs no `min-width`: `262 + 1018 = 1280` is the spec's own arithmetic.

---

## Token contract

### Added by this feature

**None.** `src/app/globals.css` is untouched.

R1's `-on-page` remedy was written against the cool ramp it then replaced. The warm ramp that shipped
puts `--color-text-muted` at `neutral-600` `#6e6a66`, which is **4.80:1** on `--color-page`
`#f4f2f0` — over AA — and `src/app/globals.test.ts` already asserts that pair. The project-list
region's empty line, the only muted text this feature puts on the page background, uses it directly
([`../research.md`](../research.md) B-3).

### Used unchanged, from R1

`--color-page` (the sidebar fill), `--color-surface` (the content region fill), `--color-border` (the
divider), `--color-text`, `--color-text-muted` (the empty line), `--color-focus`, and the neutral ramp
beneath them.

### Still deliberately not added

A dark-mode set, a type scale, a spacing unit, a component library — R1 rejected all four with
reasons that have not changed, and the roadmap's §1.1 says R2 ships no component library.

---

## Interaction contract

| Rule | Source |
| --- | --- |
| Sidebar entries are `next/link` anchors; their keyboard, focus and ARIA behaviour is the platform's | `FR-030`, [`../research.md`](../research.md) B-4 |
| The sign-out control is a `react-aria-components` `Button`, and is this feature's only React Aria component and only `"use client"` module | `FR-030`, §7 |
| Focus travels through the sidebar in visual order, which is DOM order — and in a right-to-left locale that order still begins at the sidebar, now on the right | `FR-031`, `FR-001` |
| The bypass link is the first focusable element and moves focus to `main`, so the sidebar is never a 9-stop toll gate on every screen | `FR-031` |
| The sidebar is a `nav` landmark carrying its own `aria-label`; the content region is the `main` landmark. The page's header is not a landmark — it is composed inside `main` | `FR-031` |
| The focus ring is an outline, not a colour change, so it survives a viewer who cannot separate the two | `FR-031` |
| One focus-ring declaration, R1's: `outline: 2px solid var(--color-focus); outline-offset: 2px`, on `data-focus-visible` only | R1 research A-8 |
| Every control carries an accessible name; the chip's full display name reaches assistive technology even when the visible text is truncated | `FR-031`, spec edge case |
| No state is conveyed by colour alone | AGENTS.md |
| No active-entry indicator, no `aria-current` | spec *Assumptions*, [`../research.md`](../research.md) B-6 |
| Toasts, skeletons, the connection banner and disabled-with-reason appear nowhere in this contract — they are stated by `FR-013`, `FR-023` and `FR-032`…`FR-035` and built by R3 | spec *Conventions fixed here* |
| No breakpoints | §3, `FR-010` |

---

## Components

Each is synchronous and takes plain props, so every requirement above is reachable by a
`@testing-library/react` test ([`../research.md`](../research.md) D-1).

```text
src/features/shell/
├── components/
│   ├── app-shell.tsx           the frame          FR-001, FR-002, FR-009, FR-010, FR-025…FR-027
│   ├── sidebar.tsx             the entries        FR-005, FR-006, FR-011, FR-012, FR-031
│   ├── project-list-region.tsx the empty line     FR-024
│   ├── user-chip.tsx           name + avatar      FR-017, FR-018
│   ├── sign-out-control.tsx    "use client"       FR-018
│   ├── screen-header.tsx       the header         FR-007, FR-008
│   ├── forbidden-notice.tsx    §3.11              FR-019
│   └── not-found-notice.tsx    one wording        FR-022
└── display-name.ts             first + " " + last FR-017
```

`display-name.ts` sits outside any `server/` directory because the rule has to be callable from a
client component, and outside `src/lib` because Principle I extracts at the second call site — R3's
roster or R4's profile, whichever lands first, makes that promotion.
