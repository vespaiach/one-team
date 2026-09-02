# Handoff: One Team app shell

## Overview

The persistent chrome every authenticated screen of One Team sits inside: a fixed 262px sidebar, a per-screen header bar, and the content region. Screens 05–16 (Home, Board, issue detail, create issue, notifications, project screens, accounts, labels, profile, 401) all render inside it. The four auth screens (01–04, handed off separately in `design_handoff_auth/`) render **outside** it.

The shell is drawn twice in the reference — once as an **admin** sees it, once as a **member** — because role is the only thing that changes it.

## About the design files

`app-shell.html` and `styles.css` in this bundle are **design references created in HTML** — a prototype showing intended look, structure and copy. They are not production code to lift.

The task is to **recreate this design in the target codebase's existing environment** (React, Vue, SwiftUI, native — whatever is already there), using its established component library, routing and design tokens. If no environment exists yet, choose the most appropriate framework and implement it there.

The originating prototypes assumed React Aria Components for focus management, labelling and live-region announcements. Any equivalent accessible primitive is fine; the requirement is the behaviour, not the library.

## Fidelity

**High fidelity.** Colors, typography, spacing and copy are final. All values come from the Modernist design system tokens in `styles.css` — prefer the codebase's equivalent token if one exists, and only fall back to the raw values listed under Design tokens.

---

## Layout

Two columns, full viewport height, no page scroll on the shell itself — the content region scrolls.

```
┌──────────────┬──────────────────────────────────────────┐
│ sidebar      │ header  (border-bottom 2px)              │
│ 262px fixed  ├──────────────────────────────────────────┤
│ border-right │ content region (scrolls)                 │
│ 2px          │                                          │
└──────────────┴──────────────────────────────────────────┘
```

- Page background `--color-bg` #f3f2f2. Radius 0 everywhere.
- Sidebar: `width: 262px; flex: none; border-right: 2px solid var(--color-divider); display: flex; flex-direction: column; padding: 16px 0;` Full height, **never collapsible**, no hamburger, no resize handle.
- Content column: `flex: 1; min-width: 0; display: flex; flex-direction: column`.
- No team switcher and no breadcrumb: there is one team, and the sidebar already states which project you are in.

---

## Sidebar

Nine entries and no more, top to bottom. Every row is a flex row, `gap: 10px`, `font-size: 14px`.

1. **Brand** — 20px logo mark + "One Team" in `--font-heading` 800 / 15px. `padding: 0 16px 20px`. Links to Home.
2. **Home** — 20px Lucide `home` icon + label. `padding: 8px 16px`. Route `/`.
3. **Projects section header** — `.oseyebrow` "PROJECTS" (11px, letter-spacing .1em, uppercase, `color-mix(--color-text 55%)`), `padding: 20px 16px 6px`, `border-bottom: 1px solid var(--color-divider)`. **Admin only:** a 20px accent-red `plus` icon button pushed right (`justify-content: space-between`), opens Create project.
4. **Project rows** — one per project, flat (no nesting, no expand/collapse). Each: a 10×10 square colour dot, the project name, and the project key right-aligned in `.oskey` (Archivo 600 / 11.5px / letter-spacing .06em, muted). `padding: 9px 16px`.
   - **Active project:** `padding: 8px 14px; background: var(--color-surface); border-left: 2px solid var(--color-accent);` name in Archivo 800, dot in `--color-accent`.
   - **Archived project:** stays in the list at `opacity: .45`, key replaced by the eyebrow word "archived". Never hidden — a project must not silently disappear.
   - Reference data: Website Redesign / WEB (active, accent dot) · Design Ops / OTDO (`--color-neutral-900`) · Platform Migration / PLAT (`--color-neutral-700`) · Docs & Guides / DOCS (`--color-neutral-500`) · Billing v2 (archived, `--color-neutral-400`).
5. **Divider** — `height: 2px; background: var(--color-divider); margin: 16px 0`.
6. **Notifications** — 20px `bell` + label + unread count badge pushed right: Archivo 800 / 11px, `background: var(--color-accent); color: var(--color-bg); padding: 1px 7px`. Badge is omitted at zero.
7. **Accounts** — *admin only.* 20px `users` + label + eyebrow tag "admin" right-aligned.
8. **Labels** — *admin only.* 20px `tag` + label + eyebrow tag "admin".
9. **User chip** — pinned to the bottom with `margin-top: auto`, `border-top: 2px solid var(--color-divider)`, `padding: 14px 16px 0`. A 28px square avatar (initials, Archivo 800 / 10px, `--color-bg` on a role colour — accent for admin, `--color-neutral-800` for member), then name (Archivo 800 / 13px) over "role · Profile" (11px muted). The chip itself links to Profile; **sign out is the 16px `log-out` icon beside it**, not a menu.

Admin and Labels carry an inline "admin" tag rather than sitting under a Settings parent — two screens do not need a section.

**Hover / active states.** Rows tint on hover with `--color-neutral-200`; the active row is the surface-fill + accent left border described above. Keyboard focus is the system ring: `:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px }`.

---

## Header

`border-bottom: 2px solid var(--color-divider); display: flex; align-items: center; gap: 14px; padding: 12px 18px; flex-wrap: wrap`.

Order, left to right — **title block · at most one per-screen control · search · New issue**:

1. **Title block** (`flex: 1 1 220px; min-width: 200px`) — a row with the project colour dot, the title in Archivo 800 / 16px, and the key in `.oskey` muted; below it a 12px muted meta line ("32 issues · 5 members · target 12 Sep").
2. **Per-screen control** — at most one. On Board this is the grouping segmented control: `.osseg`, 1px divider border, options in Archivo 600 / 11px uppercase letter-spacing .05em, `padding: 6px 10px`, each with a 16px leading icon; selected option `background: var(--color-accent); color: var(--color-bg)`. Board options: Column (`columns`, selected) / Assignee (`user`) / Priority (`signal-high`). Screens with nothing to control leave this slot empty.
3. **Search** — `.ossrch`: 1px divider border, `background: var(--color-neutral-100)`, `padding: 7px 10px`, 12.5px muted, a 16px `search` icon + the word "Search", and the `/` shortcut key right-aligned in `.oskey`. Default width 140px. **Collapsed form:** when the per-screen control needs the room, search gives up its width and renders as an icon-only `.osbtn` (`padding: 8px 10px`, `aria-label="Search"`).
4. **New issue** — the one primary action: `.osbtn.pri`, accent fill, `--color-bg` label, Archivo 800 / 12.5px, `padding: 8px 12px`, 16px leading `plus` icon. Hover `--color-accent-600`.

**Home drops the header entirely** — it is its own page-level composition.

---

## Role behaviour

The shell **hides only what a role has no screen for.**

| Element | Admin | Member |
| --- | --- | --- |
| Home, Projects list, Notifications, user chip | yes | yes |
| `+` beside Projects (create project) | yes | no |
| Accounts | yes | no |
| Labels | yes | no |
| New issue in header | yes | yes (when a member of that project) |

Everyone reads every project, so the project list is identical for both roles. Actions a role *cannot take* on a screen render **disabled with a reason on the screen itself** — never quietly removed from the chrome.

---

## Interactions & behaviour

- Sidebar navigation is client-side routing; the active project row is derived from the route, not from click state.
- The `/` key focuses search from anywhere in the shell (except when a text input has focus). Escape closes it.
- The notification badge count comes from unread notifications and updates without a reload.
- No transitions on nav rows beyond an instant background tint — this system does not animate chrome.
- Responsive: the shell targets desktop widths. Below ~900px the header wraps (already `flex-wrap: wrap`); the sidebar does not collapse — a narrow-viewport treatment is out of scope for this handoff.

## State management

- `currentUser { id, name, initials, role: 'admin' | 'member' }`
- `projects [{ id, name, key, dotColor, archived }]`, ordered active-first
- `activeProjectId` (from route)
- `unreadNotificationCount`
- Per-screen header slot: `{ title, meta, control?, showNewIssue }` — supplied by the routed screen, rendered by the shell.
- Board only: `grouping: 'column' | 'assignee' | 'priority'`.

## Design tokens

Colors: bg `#f3f2f2` · surface `#eae9e9` · text `#201e1d` · accent `#ec3013` · divider `color-mix(in srgb, #201e1d 40%, transparent)`.
Neutral ramp 100–900: `#f8f4f4 #eae7e7 #d7d3d3 #bab6b6 #9b9797 #7d7979 #605d5d #444141 #2d2b2b`.
Accent ramp 100–900: `#fff2ef #ffe0d9 #ffc4b8 #ff9783 #ff563c #dd2b0f #ae1800 #7c1405 #4d170e`.

Type: **Archivo** for headings and body. Heading weight 800, letter-spacing −0.015em. Sizes in the shell: brand 15, header title 16, nav row 14, project name 14, card title 13, user name 13, search 12.5, button 12.5, meta 12, key 11.5, badge 11, eyebrow 11.

Spacing scale: 4 · 8 · 12 · 16 · 24 · 32. **Radius: 0 everywhere.** Shadows: none in the shell.

Rules: 2px `--color-divider` for structural edges (sidebar right edge, header bottom, section divider, user-chip top); 1px for internal separators (project section header, board column edges). Do not soften either to a hairline.

## Assets

- **Logo mark** — inline SVG, 32×32 viewBox: a `1,1` 30×30 square stroked 2px `currentColor`, an accent numeral-one polygon, and a `currentColor` 4×20 bar at x=20. Rendered at 20px in the sidebar.
- **Icons** — Lucide (https://lucide.dev). 20px in sidebar rows, 16px in header controls and buttons, stroke-width 1.25 at 16px. Used here: `home`, `plus`, `bell`, `users`, `tag`, `log-out`, `columns`, `user`, `signal-high`, `search`.
- **Fonts** — Archivo (Google Fonts), weights 400 / 600 / 800.
- No photography in the shell.

## Files in this bundle

- `app-shell.html` — the design reference: admin and member shells, with Board behind them because Board carries the busiest header. Open directly in a browser.
- `styles.css` — the Modernist design system stylesheet the reference reads its tokens and `.tag` / `.btn` classes from.
- `ADOPT-DESIGN-SYSTEM.md` — the prompt to hand Claude Code, telling it how to adopt Modernist in the target codebase.

Source documents in the originating project: `One Team: UIs Modernist - Picked.dc.html` (screen 17 is the shell), `One Team: Foundations Modernist.dc.html`, `One Team: Logo Modernist.dc.html`, `One Team - product specification.md`.
