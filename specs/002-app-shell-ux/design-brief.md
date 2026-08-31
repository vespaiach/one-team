# Design brief — R2: the application shell and cross-cutting UX

**For**: Claude Design (claude.ai/design)
**Feature**: [`spec.md`](./spec.md) · roadmap entry **R2**
**Source of truth**: [`docs/product/specifications.md`](../../docs/product/specifications.md) §3 (*The shell*), §3.2, §3.11, §3.12, §4, §7
**Contracts**: [`contracts/app-shell.md`](./contracts/app-shell.md) · [`contracts/route-surface.md`](./contracts/route-surface.md) · [`contracts/sign-out.md`](./contracts/sign-out.md) · [`contracts/ux-conventions.md`](./contracts/ux-conventions.md)
**Extends**: the R1 design — project `cc49e5c8-0982-43e1-9cce-51afb954ef3b`, `Foundations.dc.html`

R2 builds a **frame, not a feature**. Eleven of the twelve remaining roadmap entries render
inside what this one produces, and almost nothing that will eventually sit in it belongs to
this entry. So the surfaces below are the frame's own behaviour — what persists, what is
hidden, what refuses — and the content region is deliberately empty in most of them.

**This is the first brief that inherits rather than proposes.** R1's design came back and its
token block has already landed in `src/app/globals.css` (`29a9ace`): the warm neutral ramp, the
accent and red ramps, six type steps in Archivo, a 4px spacing unit and radius 0 everywhere.
None of it is reopened here. What R2 decides is how that system composes into a 262px sidebar,
a header, and two refusal screens.

Deliver **visual reference**, not shipping code. Behaviour is rebuilt on React Aria Components
in the repo (`OT-UX-018`); the styling layer supplies appearance only.

---

## Non-negotiables

The specification fixes these. A design that changes one is wrong, not opinionated.

| | |
| --- | --- |
| **Sidebar width** | **262px, fixed.** Not a range, not a minimum, not resizable, and it never collapses. (`FR-001`, §3) |
| **Sidebar inventory and order** | App mark · Home · the project-list region · Notifications · Accounts · Labels · the user chip at the foot. Nothing else. (`FR-005`) |
| **262px is a width, not an edge** | The sidebar sits at the **inline start**, so a right-to-left locale puts it on the right with nothing else about the frame changed. (`FR-001`) |
| **Admin navigation is hidden, never disabled** | A member's sidebar has **no** Accounts, **no** Labels and **no** `+`. Not greyed, not present-and-dead — absent. This is the mistake the specification calls out by name. (`FR-011`, `OT-UX-003`) |
| **No team switcher** | There is one team. No control changes which team is in view. (`FR-006`, `OT-SCOPE-001`) |
| **No search, no command palette** | Out of v1 entirely. (`OT-SCOPE-005`) |
| **No current-page indicator** | The sidebar marks nothing as selected. No highlight, no rail, no `aria-current`. (spec *Assumptions*, research B-6) |
| **Home has no header** | The one authenticated screen that renders the sidebar and no title block, no per-screen control, no New issue. (`FR-003`, §3.2) |
| **Three regions, and no fourth** | Sidebar, banner slot, content region. No later entry adds a region — everything R3–R12 brings renders *inside* the content region or *inside* the header's existing slots. (`FR-009`) |
| **Viewport** | Desktop only. **No breakpoints.** Minimum page width **1280px** = 262 sidebar + 1018 content; below that the page scrolls horizontally and nothing reflows, stacks or hides. (`FR-010`, `OT-SCOPE-004`) |
| **No motion** | The frame neither transitions between screens nor animates its own parts. Nothing to reduce for a reduced-motion preference. (spec *Assumptions*) |
| **Tone** | "One quiet line per surface. No illustrations, no empty-state marketing." (§4) |
| **Accessibility** | WCAG 2.2 AA. Every surface operable by keyboard alone, focus visible at every step, focus indicator never carried by colour alone. (`FR-031`, `SC-012`) |

---

## What R1 already settled — do not re-propose

The shipped `@theme inline` block. Design against it; extend it only where §*Decisions* below asks.

**Colour, semantic layer only** — nothing names a ramp step and nothing names a hex.

| Token | Points at | Job in R2 |
| --- | --- | --- |
| `--color-page` | neutral-100 `#f4f2f0` | **The sidebar's fill** |
| `--color-surface` | `#ffffff` | **The content region's fill** |
| `--color-surface-sunken` | neutral-50 `#fbfaf9` | Neutral message grounds |
| `--color-border` | neutral-300 `#d7d3cf` | The sidebar / content divider, and any rule inside the sidebar — decorative only |
| `--color-border-control` | neutral-500 `#8f8a86` | Anything a user has to aim at |
| `--color-text` | neutral-900 `#24211f` | Sidebar entries, headings, the display name |
| `--color-text-muted` | neutral-600 `#6e6a66` | The quiet line, secondary copy |
| `--color-accent` | accent-500 `#5b5bd6` | **The focus ring** — see the correction below |
| `--color-accent-text` | accent-700 `#3c3c9c` | Links at body size |
| `--color-advisory` / `-fill` / `-text` | amber 500 / 100 / 700 | The must-change-password banner |

**Type** — Archivo, six steps, absolute line heights. `title` (22 / 28 / 600 / −0.01em) was
declared by R1 and used by no R1 surface — **it is reserved for this frame's `<h1>`**.

| `display` 32/36/700 | `title` 22/28/600 | `control` 16/24/500 | `body` 15/24/400 | `small` 13/20/400 | `micro` 11/16/600 caps |
| --- | --- | --- | --- | --- | --- |

**Space** — 4px unit. R1 used 4 · 8 · 12 · 16 · 20 · 24 · 32 and **reserved 48 and 64 for this
entry's shell gutters and page sections**.

**Geometry** — radius **0** everywhere. Nothing in this product has a rounded corner, including
the avatar.

**Focus ring** — `outline: 2px solid var(--color-accent); outline-offset: 2px`, one rule for
every control, driven off `data-focus-visible`. An outline, never a border, so it never changes
layout.

**Dark mode is out**, confirmed. The starter's `prefers-color-scheme` block is deleted.

### Three corrections to carry into the design

R2's planning documents were written before R1's design returned and cite three superseded
values. Design against the right-hand column.

| Document says | Shipped, and binding |
| --- | --- |
| `contracts/app-shell.md` names a `--color-focus` token | **There is no `--color-focus`.** R1 settled the ring as `--color-accent`; a second name that always resolves to the first is indirection with no requirement behind it |
| `research.md` B-3 puts the new `-on-page` token at "neutral-700 `#4d525a`" | `#4d525a` is the **cool** ramp R1's design replaced. Warm neutral-700 is **`#55514e`**, and it measures **7.03:1** on `--color-page` |
| `research.md` B-3 says R1 measured `--color-text-muted` at 4.36:1 on `--color-page` — below AA | That figure is the cool ramp's. On the **warm** ramp shipped, `--color-text-muted` on `--color-page` is **4.80:1** and clears AA. See decision 7 — the new token may not be needed at all |

---

## The surfaces

Eight artboards. Frame at **1440 × 900**, and mark the 1280 minimum. R1's "usable to 1024px" note
binds the three unauthenticated screens only — they are a 440px card outside the shell and this
frame never wraps them.

### 1. The frame — admin

The reference artboard. Sidebar, an empty content region, and a header with a title block, so
every measurement below is legible in one place.

```text
┌ 262px ───────────────┬─ 1018px ────────────────────────────────┐
│ app mark             │  ┌ header ──────────────────────────┐   │
│                      │  │ Title            [ctl]  [New issue]│  │
│ Home                 │  │ context line                      │  │
│                      │  └───────────────────────────────────┘  │
│ Projects        [+]  │                                         │
│   No projects yet.   │   content region — R3–R12 fill this     │
│                      │                                         │
│ Notifications  (12)  │                                         │
│ Accounts             │                                         │
│ Labels               │                                         │
│                      │                                         │
│ ─────────────────    │                                         │
│ [av] Ada Lovelace  ⏻ │                                         │
└──────────────────────┴─────────────────────────────────────────┘
   --color-page              --color-surface
```

- The sidebar is **full viewport height**; the chip is **pinned to its bottom edge**, not last in
  flow. (`FR-005`)
- The **project-list region is the only part that scrolls**, within itself, once R5 fills it. The
  app mark, Home, Notifications, Accounts, Labels and the chip stay put. Draw the region's scroll
  boundary. (`FR-005`)
- The `(12)` beside Notifications is **R11's**. R2 renders no count — but the slot's geometry is
  this design's, so show where a two- or three-digit count sits and what the entry looks like
  without one.
- The header's **height is not fixed** — it is derived from content, so a title block with a
  context line is taller than one without. This asymmetry with the sidebar's 262px is deliberate.
  (`FR-007`)
- The per-screen control slot holds **at most one** control and renders **nothing** — no
  placeholder, no second control — when a screen has none. Real occupants arriving later: the
  board's grouping control, Notifications' "mark all read". (`FR-007`, §3)
- **New issue** renders only on a project-scoped screen. Nothing in R2 is project-scoped, so the
  slot is empty on every screen this entry ships. Draw it occupied once anyway, as reference, so
  R5 and R6 inherit geometry instead of inventing it. (`FR-008`)

### 2. The frame — member

The same artboard with **Accounts, Labels and the `+` gone**. Not greyed. This pair is the
clearest statement of `OT-UX-003` in the whole product, so the two artboards should be
comparable side by side.

Note what the member still gets: Home, the project-list region, Notifications, the chip.
(`FR-012`)

### 3. Home — `/home`

**Sidebar, no header, empty content region.** The headerless exception, and the vertical origin
question it raises: with no header, where does content begin? R12 fills this region; R2 only has
to answer where its top edge is.

### 4. Forbidden (403)

Rendered **inside the shell** at the URL that refused — never a full-screen takeover, never a
redirect to a `/forbidden` path. The address bar still shows the route the user asked for.
(`FR-019`, `FR-020`, §3.11)

The full frame renders, and the header renders **titled as Forbidden itself** — not as the screen
that refused — with both slots empty. Three things in the content region:

| | |
| --- | --- |
| The error code | `403` |
| One sentence | `You don't have access to this.` |
| One route back | A link to `/home` labelled `Home` |

Both variants matter: this is what a member sees on `/settings/accounts`, and the sidebar behind
it still carries no Accounts entry — the refusal and the hidden door are consistent.

### 5. Not found — two mounts, one wording

`This doesn't exist` — **no full stop**, capitalisation and apostrophe exactly as quoted. It
answers both an unclaimed path and a screen whose record is absent, and the two must be
indistinguishable to the reader: nothing may hint at a hidden room, and the words
"you don't have access" are forbidden here by name. (`FR-022`, `OT-UX-004`, §4)

| Mount | Frame | Header |
| --- | --- | --- |
| Inside the shell — a route in the app that has nothing to show | Full frame, sidebar present | **None.** A path that matches nothing is not a screen and has no name for a title block |
| Outside the shell — a URL matching no route at all | No sidebar, no header, nothing but the page | None |

The second one is the only surface in this entry that renders with no frame around it, and it
needs an answer of its own: what does a bare page look like in this system?

### 6. The must-change-password banner, in place

R1 delivered the component and rendered it nowhere. **R2 builds the slot**, and the slot's
position is fixed by the spec: at the **top of the content region, above the header**. Vertical
order is banner → header → content, and on Home banner → content.

**Read this carefully — it corrects R1's drawing.** R1's brief described the banner as "full
bleed across the shell, above everything including the header". `FR-025` and the shell contract
place it **inside the content region**, so it starts at the sidebar's inline end and spans 1018px,
not the viewport. The spec wins. Its bottom-edge rule spans that narrower measure.

An **empty slot occupies no space** — with nothing to render, content begins exactly where it
would in a shell with no slot at all. Draw both.

The banner blocks nothing, dismisses never, and may be permanent furniture on a server whose
admin never changes their password. Copy, from R1, unchanged:
`Your password is still the one set when this server was installed.`

### 7. The user chip — four states

262px is not much room for an avatar, a name and a control. This is the tightest composition in
the entry.

| State | What it must show |
| --- | --- |
| **With avatar** | Square avatar (radius 0), display name, sign-out control |
| **No avatar** | `avatar_url` is optional. The chip renders **the name alone** — no initials circle, no silhouette, no substitute image of any kind. The name carries the identification |
| **Avatar fails to load** | Identical to *no avatar*. The two cases are one case |
| **Long name** | Two 200-character names cannot widen or wrap the sidebar. **Truncate visually on one line**; the untruncated name stays the control's accessible name |

The display name is **first name, one space, last name** — everywhere in the product, and the
chip is the first surface bound by the rule. Both parts always exist. (`FR-017`, §3.12)

The chip carries **two** interactive things side by side, never nested: a link to `/profile`, and
the sign-out control. Sign-out is the application's **only** sign-out control — there is no menu,
no popover, no second route to it — and it is the only React Aria component in the entire entry.
(`FR-018`, research B-5)

### 8. Right-to-left

The same frame mirrored: sidebar on the right, content on the left, **and nothing else changed**.
Keyboard focus order still begins at the sidebar, now on the right. One artboard is enough.

---

## What this design must not add

Each of these is a real temptation and each is refused by a document, not by taste.

| | Why |
| --- | --- |
| A component library, or shared primitives | Principle I extracts at the **second** call site. R2 builds the shell's own components and `src/components/ui` is not created. The roadmap says so in §1.1 |
| A current-page highlight, rail or `aria-current` | Nothing asks for one, and adding it makes the sidebar a client component to read the pathname. The entry that wants it introduces it (research B-6) |
| A sidebar collapse or resize control | `FR-010`: no collapse, no stack, no hide, at any width |
| A search field or command palette | `OT-SCOPE-005`, out of v1 |
| A team switcher | `FR-006`. There is one team |
| An avatar fallback — initials, silhouette, generated colour | The spec has no basis for one; the name carries identification (spec *Edge Cases*) |
| An illustration or empty-state marketing anywhere | §4, and `FR-024` fixes the empty project list at one quiet line |
| Toasts, skeletons, the connection banner, disabled-with-reason | Stated by R2, implemented by R3 or R4. They belong to no surface here — see *Deliberately absent* |
| A second `<h1>`, or a header that is its own landmark | The sidebar is the `nav` landmark and the content region is `main`; the header is composed **inside** `main` (`FR-031`) |
| Any breakpoint | `OT-SCOPE-004`. Not deferred — out of v1 |

---

## Copy

**Fixed verbatim by the specification or this feature's spec — do not rewrite:**

| String | Where | Requirement |
| --- | --- | --- |
| `You don't have access to this.` | Forbidden, the one sentence | `FR-019` |
| `403` | Forbidden, the error code | `FR-019`, §3.11 |
| `Home` | Forbidden, the label on the route back | `FR-019` |
| `This doesn't exist` | Both not-found mounts. **No full stop.** Never "you don't have access" | `FR-022`, §4 |
| `No projects yet.` | The empty project-list region | `FR-024` |
| `Your password is still the one set when this server was installed.` | The banner | R1 |

**Still to be written — propose text; nothing specifies these yet:**

- The **project-list region's heading** — the label the `+` sits beside.
- The **sign-out control's** visible label, or its accessible name if it is a glyph.
- The **bypass link's** label — the keyboard skip to the content region.
- The **sidebar's accessible name** as a navigation landmark, so it stays distinguishable from any
  navigation a later entry adds.
- The **app mark's** treatment in a 262px column. R1 returned a two-tone `One` / `Team` lockup
  left-aligned to the auth card's edge; whether it survives unchanged at this width is a decision.

---

## Decisions to settle

Nothing in the specification answers these, and every one of them propagates to R3–R12.
Return an explicit value for each.

1. **Sidebar rhythm.** Entry height, the inline padding inside 262px, the vertical gap between
   entries, and how the seven items group into visual regions. R1 reserved spacing steps 48 and 64
   for exactly this. Does anything rule between regions, or is it space alone?

2. **Sidebar entry states** — rest, hover, pressed, focus. **The trap**: there is no current-page
   indicator, so a hover treatment that reads as "selected" will be read as one on a sidebar where
   nothing is ever selected. Hover must read as *hover*.

3. **The sidebar / content boundary.** The two fills are `--color-page` and `--color-surface` — a
   contrast of **1.12:1** — and the divider at `--color-border` is **1.49:1** on white. Both are
   decorative and neither is required to meet a ratio, but this is the frame's primary structural
   line and it runs the full height of every screen in the product. Is that boundary enough? If
   not, what carries it?

4. **The user chip.** The three-part layout in 262px, the avatar's size (square, radius 0), and
   what the sign-out control is — a text label, a glyph, or a glyph with a visible label. Where
   the truncation point falls for the display name.

5. **Content-region gutters and the header block.** The padding that opens the content region; the
   header's type steps (`title` for the name — what for the context line?); the gap between name
   and context line; and whether the header is separated from content by a rule or by space alone.
   The context line is **optional** and a screen without one renders the name alone, never an
   empty second line.

6. **The two message screens.** How a code, a sentence and one route forward compose in a 1018px
   region. Do Forbidden and not-found share one geometry — they should, under §4's tone — and does
   the block sit at the top of the measure, or float? Is `403` set at `display`, or is it quieter
   than that?

7. **Whether `--color-text-muted-on-page` is added at all.** R2's contract adds one token for the
   quiet empty line, prescribed against R1's superseded cool ramp. On the warm ramp that shipped,
   `--color-text-muted` measures **4.80:1** on `--color-page` and already clears AA, so the token
   may be unnecessary. The margin is thin (4.80 against a 4.50 floor) and neutral-700 `#55514e`
   would give **7.03:1**. Decide, and say which.

8. **The New issue slot's reserve.** `FR-013` will eventually render New issue **disabled with an
   inline reason beside it** — "Only project members can create issues in Website Redesign" — not
   in a tooltip. R3 implements it, but the header's far-right slot has to be able to hold it. How
   much room does the slot reserve, and where does the reason sit?

---

## Contrast — the pairs R2 introduces

R1 measured everything on `--color-surface`. R2 puts text on `--color-page` for the first time, at
full height. Target is **WCAG 2.2 AA**.

| Pair | Ratio | Needs | |
| --- | --- | --- | --- |
| `--color-text` on `--color-page` — every sidebar entry, the display name | 14.33:1 | 4.5:1 | pass |
| `--color-text-muted` on `--color-page` — the quiet empty line | 4.80:1 | 4.5:1 | pass, thin |
| neutral-700 `#55514e` on `--color-page` — the `-on-page` alternative | 7.03:1 | 4.5:1 | pass |
| Focus ring `--color-accent` on `--color-page` | 4.81:1 | 3:1 | pass |
| `--color-border` on `--color-page` — the divider, decorative | 1.33:1 | — | n/a |
| `--color-border` on `--color-surface` — the divider, decorative | 1.49:1 | — | n/a |
| `--color-page` against `--color-surface` — the fill change at the boundary | 1.12:1 | — | n/a, see decision 3 |

Any pair the design introduces beyond these must be measured. `src/app/globals.test.ts` asserts
every declared pair directly against `globals.css` and fails the build gate if one drops below its
threshold, so a token edit cannot regress this silently.

---

## Deliberately absent, and why

Six rules R2 **states** and does not render. They have no surface in this entry — the shell loads
no data, and its one write (sign-out) ends the session and leaves the application, so there is
nothing to skeleton, nothing to re-query and no optimistic state to roll back. **Do not design
them here**; R3 or R4 briefs them with a real caller.

| | Rule | Lands with |
| --- | --- | --- |
| `FR-013`, `FR-023` | Disabled control carrying an inline reason — never a dead button, never a tooltip as the only explanation | R3 |
| `FR-032` | Per-screen skeletons matching the layout they replace; never a full-screen spinner | R3 or R4 |
| `FR-033` | A revisited screen re-queries; nothing renders from a client cache | R3 or R4 |
| `FR-034` | Toasts — success, info, warning, error; top-right, stacked, auto-dismissing at five seconds, each with a dismiss control | R3 or R4 |
| `FR-035` | The connection-lost banner: `Can't reach the server. Reconnecting.` and `Changes need a connection` | R3 or R4 |

The frame itself has **no pending state** — it renders on the server from an actor already
resolved, so no part of it ever renders as loading. There is no shell skeleton to draw.
(`FR-002`)

---

## What to send back

- **Eight artboards**: the frame (admin), the frame (member), Home, Forbidden, not-found inside
  the shell, not-found outside it, the banner in place, and the right-to-left mirror. Plus the
  chip's four states, which can share one board.
- **The eight decisions above, as values** — not as options.
- **Any token addition, as a named semantic token** pointing at a ramp step, never at a hex. The
  expected count is zero or one.
- **The copy listed under *Still to be written***.

Extend `Foundations.dc.html` in the existing project rather than starting a new system; R2 adds
shell rhythm to it and reopens none of R1's decisions.

Tokens land in `@theme inline` in `src/app/globals.css` — Tailwind v4 is configured in CSS, there
is no `tailwind.config.js` and none should be created. Sidebar entries are `next/link` anchors and
sign-out is a React Aria `Button`; the design models how things look, and React Aria supplies the
keyboard, focus and ARIA behaviour (`OT-UX-018`, §7).
