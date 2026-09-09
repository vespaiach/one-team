# Research — R? UI reskin to the Broadsheet design system

**Input**: [`spec.md`](./spec.md). No `[NEEDS CLARIFICATION]` markers remain — the one open question
(scope of FR-006) was closed in the spec's own Clarifications section before this phase started.
This document exists to settle the *how*, which the spec deliberately leaves silent, against the
concrete state of the repository as it stands today.

**No design-handoff import exists.** Unlike 001 and 002, `specs/012-ui-reskin/` carries no
`design-brief.md` or `design-handoff/` — the spec's own prose (palette, typefaces, spacing unit,
radius, "rules not boxes") is the only design source. Every decision below reasons from that prose
plus the current `src/app/globals.css`, never from an asset this repository does not have.

## What already exists and what this feature changes

The product has been through one palette already. `src/app/globals.css` ships a system its own
comments call "the Modernist system": a monochrome red-orange (`--color-accent` `#ec3013`) on a
near-white neutral ramp, one typeface (Archivo) doing every job, a 4px spacing unit, and a hard
`* { border-radius: 0 }` reset — "nothing in this product has a rounded corner." `docs/product/
specifications.md` §7 *Palette* documents that same system as the product's current source of
truth. This feature replaces both the token *values* in `globals.css` and that paragraph of §7 with
the Broadsheet system the spec describes: a warm paper-and-ink palette (clay/terracotta accent on
cream paper), three typefaces doing three distinct jobs, a 5px spacing unit, near-square (not
zero) radii, and hairline-and-whitespace layout instead of filled panels.

Three things the codebase already has, unused, are exactly what Broadsheet needs:

- **All three typefaces are already loaded.** `src/app/layout.tsx` loads `Archivo`, `Source_Serif_4`
  and `JetBrains_Mono` via `next/font/google` and exposes them as `--font-archivo`,
  `--font-source-serif` and `--font-mono-ui`. `globals.css` declares the CSS variables but routes
  every one of `--font-heading`, `--font-body` and `--font-sans` to Archivo alone — the serif and
  mono variables are dead weight today. This feature is a token-routing change, not a font-loading
  change: no `next/font` import, subset, or variable name is added or removed.
- **The semantic-token indirection already exists.** Every component reads a semantic name
  (`--color-accent-fill`, `--color-border`, `--color-text-muted`) that itself resolves to a role or
  ramp token, never a literal hex. FR-001's "replace the values, keep no surface on the prior
  system" is achievable by rewriting the *ramp* declarations in `@theme inline` and leaving every
  semantic *name* in place — components that already reference `--color-accent-fill` do not change.
- **A palette-level contract test already runs.** `src/app/globals.test.ts` reads `globals.css` at
  test time, resolves each semantic pairing's indirection to a hex value, and asserts WCAG 2.2 AA
  contrast (4.5:1 text, 3:1 non-text) for a fixed list of token *pairs* — not fixed hex values. Once
  the new ramp lands, this test re-validates SC-003 automatically, against whatever hexes replace
  the old ones, with no edit required unless a *pairing* is added or removed.

## Decisions

### D-1 — Token values change, token names do not

**Decision**: Every `--color-*` semantic name (`--color-bg`, `--color-accent-fill`,
`--color-border`, `--color-danger-text`, …) in `@theme inline` is kept. Only the hex values behind
the role and ramp tokens (`--color-bg`, `--color-page`, `--color-accent`, `--color-accent-2`, the
`--color-neutral-*` and `--color-accent-*` ramps) change, to the Broadsheet palette: a cream paper
ground, clay/terracotta as the primary accent, an ink-black text colour, and neutral/accent ramps
recomputed around those endpoints. Every semantic token that derives from a ramp step (`--color-
surface-sunken`, `--color-border`, `--color-text-muted`, `--color-danger`, `--color-advisory`, …) is
re-pointed at whichever new ramp step reproduces the same *role*, not copied forward by position.

**Rationale**: FR-001 requires the replacement and requires "no existing UI surface may continue to
render with the prior color tokens" — but nothing in the spec asks for the semantic *names* to
change, and `theme-tokens.test.ts` (below) plus every component's `var(--color-…)` reference depend
on those names staying put. Renaming would turn a token-value swap into a full-codebase
find-and-replace across 120 component files for zero requirement gained.

**Alternative rejected**: Introduce a second, parallel token set (`--color-bg-2027` alongside `--color-
bg`) and migrate components incrementally. Rejected — FR-001 requires *zero* surfaces on the prior
system, so a coexistence period satisfies no acceptance scenario and only adds dead tokens VI would
then require removing anyway.

### D-2 — Typography: three faces, one per job, via existing variables

**Decision**: `--font-heading` and `--font-body` both route to `--font-source-serif` (headings and
body prose share the serif, per spec: "a serif for headings and prose"). `--font-sans` keeps
routing to `--font-archivo` and becomes the face applied to interface chrome — nav, buttons, labels,
toolbars, form controls — not to `<body>`. A new `--font-mono` token is added, routed to
`--font-mono-ui` (JetBrains Mono, already loaded), and applied wherever a value is machine-produced
rather than authored: issue/project identifiers, dates, timestamps, and counts. The H1–H6 scale and
body size in `@theme inline` (`--text-h1` … `--text-body`) are updated to whatever new scale the
serif needs to read well at heading weight — kept as `rem`/`px` steps in the same variables, not a
new naming scheme.

**Rationale**: FR-002 names exactly this three-way split and requires the existing H1–H6 scale to be
"updated," not replaced with a different mechanism. Reusing `--font-heading`/`--font-body`/`--font-
sans` keeps every component's Tailwind class (`font-heading`, `font-sans`) unchanged; only the
`@theme inline` line each one resolves to moves. `--font-mono` is new because nothing in the current
token set names the mono face — `--font-mono-ui` is the loader's variable name, private to
`layout.tsx`'s `className`, and components should never reference a loader variable directly.

**Alternative rejected**: One `--font-body` covering chrome and prose alike (today's state, just
re-pointed at the serif). Rejected — FR-002 explicitly requires prose and chrome to diverge, and a
serif set on every button label is the opposite of "distinct face for interface chrome."

### D-3 — Spacing: the unit changes, not the scale's shape

**Decision**: `--spacing: 4px` becomes `--spacing: 5px` in `@theme inline`. Every Tailwind spacing
utility (`p-4`, `gap-2`, `m-6`, …) is a multiple of that one variable in Tailwind v4, so this single
line moves the entire scale from a 4px grid to a 5px grid with no per-component class edit. What
*does* need a per-file sweep: literal pixel values that bypass the scale for gaps, padding, and
margins — `gap-[14px]`, `p-[10px]` and similar arbitrary-value classes found in dialog and card
components (see D-6). Each one is either confirmed as already a multiple of 5 (unchanged) or nudged
to the nearest 5px multiple that preserves its visual intent, since FR-003 requires the scale
"applied to layout spacing — gaps, padding, and margins between elements — and corner radii across
all existing surfaces." Fixed width/height values that function as layout constraints rather than
spacing — `max-w-[420px]` among them — are exempt under Rule 4 (`contracts/design-tokens.md`) and
FR-003's own carve-out: they are left untouched, not confirmed or nudged.

**Rationale**: FR-003 states the spacing scale itself, not just its unit, must move — a one-line
`--spacing` edit satisfies every utility-class usage, and grep confirms there is no
`tailwind.config.js` (AGENTS.md) to duplicate the value into. The arbitrary-value sweep is the
residual work a single variable cannot reach.

**Alternative rejected**: Leave `--spacing` at 4px and re-author every utility class by hand to a new
5px numeral scale (`p-[5px]`, `p-[10px]`, …). Rejected as needless churn across every one of 120
component files for a result the token variable already produces for free — and it would abandon
Tailwind's own scale, reintroducing exactly the arbitrary-value drift D-3 is trying to close.

### D-4 — Radius: near-square, not literally zero

**Decision**: The base-layer `* { border-radius: 0 }` reset in `globals.css` is replaced with a
small non-zero default — a `--radius-sm` (or equivalently named) token in the 2–3px range applied as
the base reset, keeping `--radius-full` (`9999px`) for the handful of `rounded-full` dots, spinners
and avatars that must stay circular regardless of the base reset. `--radius-none` (`0px`) is kept as
an explicit opt-out token for any element that genuinely needs a hard square corner the base default
doesn't give it.

**Rationale**: The spec's own vocabulary is "near-square corner radii" — not "zero," which is what
today's product ships and what the spec is explicitly moving away from. A small non-zero default
read on every bordered/filled element (buttons, inputs, cards, dialogs) is the only way "near-
square" shows up anywhere, since the current reset overrides component-level radius classes
universally via the `*` selector.

**Alternative rejected**: Set radius per component class instead of in the base reset. Rejected —
the existing `* { border-radius: 0 }` already proves a single base rule is this product's chosen
mechanism (Straightforward Over Clever, III), and 120 components would each need an added radius
utility to get the same near-square edge a one-line base change gives everywhere at once.

### D-5 — "Rules, not boxes": where a hairline replaces a filled panel, and where elevation stays

**Decision**: Flat content containers that today render as filled panels purely to separate
themselves from the page — cards, list rows, section groupings — move to a hairline border
(`--color-divider` / `--color-border`) plus whitespace, dropping any background-fill-as-separator
treatment, consistent with the spec's "hairlines and whitespace instead of filled panels." Genuinely
**elevated** surfaces — `Dialog` modals and the `Popover`-based mention picker, which React Aria
already renders in front of and disconnected from the page's normal flow — keep a shadow
(`shadow-lg`, already resolving to the token `--shadow-lg` in `@theme inline`, not a Tailwind
default). A modal floating over a dimmed page is not the "box" the convention is reacting to: it is
the one place elevation is the honest signal, and removing it would leave a floating dialog with no
visual separation from the content behind it.

**Rationale**: The spec names the convention as a layout convention for "dense application chrome
and looser editorial pages alike" — i.e., in-flow content — and FR-010 keeps any purely decorative
flourish optional, never blocking a surface's restyle. Nothing in FR-001–FR-009 asks for modal
elevation to be removed, and SC-003's contrast requirement plus the existing focus-visible rules
apply to a dialog exactly as before regardless of whether it casts a shadow.

**Alternative rejected**: Remove all `shadow-*` usage repo-wide, including dialogs and popovers.
Rejected — nothing in the spec requires it, and a shadowless modal over unstyled content reads as a
layout bug, not a design choice, the first time someone opens one.

### D-6 — The duplicated dialog-shell class string is a same-change extraction, not a separate refactor

**Decision**: Seven components (`delete-column-dialog.tsx`, `delete-label-dialog.tsx`,
`label-form-modal.tsx`, `delete-project-control.tsx`, `roster-table.tsx` ×2, `invite-modal.tsx`,
`delete-issue-control.tsx`) each hard-code the identical literal string
`"flex w-full max-w-[420px] flex-col gap-[14px] bg-(--color-bg) p-4 shadow-lg"` (or the `gap-[10px]`
variant) on their `Dialog` (confirmed: a repo-wide grep for the literal string finds exactly these
seven files, eight call sites counting `roster-table.tsx`'s two, and no eighth). Because D-3 and D-4
already require every one of those seven files to be
touched for the same reason (the `gap-[14px]` arbitrary value nudging to the nearest 5px multiple and
the radius the panel now needs — `max-w-[420px]` is a fixed layout-constraint dimension, exempt under
`contracts/design-tokens.md` Rule 4 and FR-003, and stays unchanged), Principle I's two-call-site
threshold is not being reached *by* this feature — it
was already crossed seven times over before this feature started. The dialog-shell classes are
extracted into one shared constant/component in `src/components/shared/` at implementation time,
and every one of the eight call sites is updated to use it in the same change that would have
touched each of them individually anyway.

**Rationale**: Principle I requires extraction once a pattern appears at two call sites; leaving
seven near-identical literals in place while editing seven of their values by hand independently is
the "many trivial files" failure mode in reverse — needless repetition, not needless abstraction.
Doing the extraction inside this feature (rather than filing it as a separate task) means the
07-file sweep costs one edit instead of seven, and each of the seven diffs stays traceable to FR-003
rather than to an unrelated refactor.

**Alternative rejected**: Edit each of the seven literals independently, leaving the duplication in
place. Rejected under Principle I once the change touches every call site anyway — the extraction
is strictly cheaper than the alternative it replaces, not additional scope.

### D-7 — Two literal, non-token colour pairs are folded into the semantic danger/advisory tokens

**Decision**: `src/features/shell/components/toast-region.tsx` hard-codes
`error: "border-red-600 bg-red-50"` and `warning: "border-amber-500 bg-amber-50"` — the only two
component-level usages anywhere in `src/**/*.tsx` of a default Tailwind colour class rather than
this product's own tokens (confirmed by a repo-wide grep for `bg-red-`, `text-gray-`, `bg-amber-`,
and the rest of Tailwind's default palette prefixes: these are the only two hits). `error` is
replaced with the existing `--color-danger` / `--color-danger-fill` semantic pair the rest of the
product already uses for error state, and `warning` with the matching advisory pair, matching the
other two toast variants in the same file which already reference tokens.

**Rationale**: FR-001 requires no surface to keep rendering with prior colour tokens, and literal
Tailwind red and amber are exactly "prior" (in this case, never-migrated) colours outside the token
system — left alone, they would be the error and warning toasts in the product that don't move with
the palette swap.

### D-8 — Test-first for a presentation-only change: what a "Red step" looks like here

**Decision**: Gate 1/2/7 (test-first, minimal-implementation, traceability) are satisfied at three
different levels, matched to what actually changes:

1. **Token-level contract tests** (`src/app/globals.test.ts`, and the `theme-tokens.test.ts` pattern
   already established in `src/features/projects/components/`) are the Red step for the palette and
   token-graph changes themselves — `globals.test.ts` already fails today against no palette (there
   is nothing to assert-fail *before* new hexes land, since it asserts a *relationship*, not a
   value, so its Red state is "the new ramp doesn't yet exist to compute a ratio from" wherever a
   genuinely new pairing is introduced, e.g. if Broadsheet's ramp needs a pairing the current list
   doesn't cover). Any *new* semantic pairing this feature introduces gets a new `it.each` row added
   to that list before the ramp value lands, so it is observed failing for the right reason first.
2. **Component-level class-string assertions** in the style of `primary-button-classes.test.ts` and
   `card-footer-note.test.tsx` — both of which assert on **token names**
   (`bg-[var(--color-accent-fill)]`, `border-[var(--color-divider)]`), not literal hex or px values —
   already pass unmodified through a palette-only change and do not need editing for D-1–D-5's
   *value* changes. They do need a new failing assertion, written first, for any component whose
   **class itself** changes shape under this feature: the seven dialog files gaining the shared
   shell (D-6), and `toast-region.tsx`'s error and warning variants (D-7) both get a test asserting the new class
   string before the component is edited to produce it.
3. **`theme-tokens.test.ts`'s pattern is extended repo-wide.** Today it only walks
   `src/features/projects/components/`. Since FR-001 spans every feature directory plus `src/app` and
   `src/components/shared` — the full 120-file scope this feature's Technical Context states — this
   feature adds the same "every `var(--token)` a component names resolves against `globals.css`"
   check for every other `src/features/*/components/` directory, `src/app/**/*.tsx`, and
   `src/components/shared/**/*.tsx` (or generalises the existing test to walk one glob covering all
   three, replacing the near-duplicate copies that pattern would otherwise produce — Principle I
   applies to test code exactly as it does to production code). That generalisation is itself a Red
   step: broadening the glob is expected to fail immediately against any pre-existing dangling token
   reference elsewhere in the tree, and that failure is resolved as part of this feature, not
   deferred.

**Rationale**: VII requires a failing test *for the intended reason* before implementation, not a
test for every line touched — a component whose only change is which hex a token it already
references resolves to has no new behaviour for a component test to observe, and the WCAG contract
test is what actually specifies "the new palette must still meet AA," which is a real, currently-
unverifiable claim until the new ramp exists. Where a component's *class shape* changes (D-6, D-7),
that is new behaviour with no prior test, and gets one.

## Assumptions carried forward

- **docs/product/specifications.md §7 *Palette* goes stale.** That section currently documents the
  monochrome system this feature replaces ("Monochrome. Two red-orange families and a neutral ramp
  are the whole hue set…"). AGENTS.md's Authority section says the specification "owns what is
  built" and is "silent on how," with sign-in's transport as the sole named exception — but §7
  *Palette* is a description of the shipped visual system, not a functional requirement, so this
  plan treats it as documentation of an implementation detail that has always tracked
  `globals.css` after the fact (R1's palette landed, then §7 was written to match) rather than a
  constraint this feature must design around. Updating that paragraph to describe the Broadsheet
  palette is in scope for the implementation phase, as a documentation change tracking the
  code, not a product-requirement change — flagged here so a reviewer sees it decided rather than
  missed. Per the user's memory constraint (no version bump or history-log row in this project), any
  edit to that section carries no version increment and no history-table row.
- **No dark theme is introduced** (spec *Assumptions*) — Broadsheet's paper-and-ink description is a
  single light palette; nothing in `@theme inline` or `globals.css` gains a `prefers-color-scheme`
  branch.
- **No responsive/mobile layout is introduced** (spec *Assumptions*) — the reskin is a token and
  component-styling change only; `AppShell`'s fixed-width sidebar and the 1280px minimum page width
  R2 established are untouched.
- **Reduced motion**: the product has no motion today beyond the existing `animate-pulse`/`animate-
  spin` loading indicators (skeleton rows, the sign-in submit spinner). Nothing in this feature adds
  new animation; the Edge Case naming a reduced-motion fallback is satisfied by not introducing
  motion in the first place, consistent with FR-010 treating any decorative flourish as optional and
  non-blocking.
- **Icon assets**: spec's Assumptions defer the exact icon set to planning. No icon library is
  approved in AGENTS.md's dependency table and none is proposed — existing iconography (inline SVG,
  if any) is restyled with the new stroke/fill tokens rather than replaced wholesale; introducing a
  new icon *set* is out of scope unless a later increment records that dependency under Principle IV.
- **No mixed-rollout state to design for**: Next.js's production build fingerprints (content-hashes)
  every static CSS and JS bundle it emits, so a browser cannot render fresh HTML against a stale,
  cached `globals.css` — a deploy either serves the old build's hashed assets in full or the new
  build's in full, never a mix of the two token sets. This feature adds no requirement for a
  transitional state because the build tool this product already runs on rules one out.
