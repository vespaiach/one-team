# Contract — design tokens (`src/app/globals.css`)

This is the contract every component in the product styles against. It does not change the shape of
`@theme inline` — the block that exists today — it changes the values inside it and adds the two
tokens Broadsheet's three-typeface split requires (`--font-mono`, `--radius-sm`). A component that
follows this contract needs no other change to pick up the reskin.

## Rule 1 — a component names a semantic token, never a ramp step or a hex

Right: `bg-(--color-accent-fill)`, `text-(--color-text-muted)`, `border-(--color-border)`.
Wrong: `bg-(--color-accent-600)`, `bg-[#c9502f]`, `bg-orange-600`.

This is not a new rule — it is the rule the codebase already follows (confirmed: a repo-wide grep for
Tailwind's default palette classes against `src/**/*.tsx` found exactly two violations, both in
`toast-region.tsx` — its error and warning variants, fixed by this feature per research.md D-7). This
feature's job is to keep the rule true while every value behind it changes.

## Rule 2 — every semantic token still resolves

`theme-tokens.test.ts`'s pattern (today scoped to `src/features/projects/components/`, generalised
repo-wide by this feature) is the enforcement: any `var(--color-*)` a component names that is not
declared in `globals.css` fails the build's test suite. No token is renamed by this feature (D-1),
so no component that passes this check today needs an edit to keep passing it — only components
whose *class shape* changes (the dialog-shell extraction, the toast fix) touch this surface.

## Rule 3 — the three typefaces, and where each one applies

| Token | Face | Applies to |
| --- | --- | --- |
| `--font-heading` | Source Serif 4 | `h1`…`h6` (via the base-layer rule already in `globals.css`) |
| `--font-body` | Source Serif 4 | body prose — paragraph text, descriptions, comment bodies |
| `--font-sans` | Archivo | interface chrome — nav items, buttons, form labels, toolbars, table headers |
| `--font-mono` *(new)* | JetBrains Mono | machine values only — issue/project identifiers (`OT-42`), dates, timestamps, counts |

A component that renders a machine value (an issue key, a `createdAt` timestamp, an unread count)
adds `font-mono` to that specific element; it does not change the face of the row or card the value
sits in. Everything else keeps whichever of `--font-heading`/`--font-body`/`--font-sans` it already
uses — no component's *chosen* face changes, only what each face renders as.

## Rule 4 — spacing is a scale, not a pixel value

Prefer a Tailwind spacing utility (`p-3`, `gap-2`, `mt-4`) over an arbitrary pixel value
(`p-[14px]`). Every spacing utility is `--spacing` (5px) × its numeral, so the scale moves as one
unit. Where an arbitrary pixel value is unavoidable (a fixed dialog width like `max-w-[420px]`,
which is not a spacing value at all but a layout constraint), it does not need to be a multiple of
5 — the spacing *scale* is about padding, gaps and margins between elements, not about every pixel
figure in the file.

## Rule 5 — radius comes from the base reset, not a per-component class

`globals.css`'s base layer sets `border-radius: --radius-sm` (near-square) on `*`, replacing today's
hard `0`. A component needs no radius utility to get this — it inherits the base reset exactly as it
inherits `border-radius: 0` today. A component only adds an explicit radius class when it needs to
*opt out* of the default: `rounded-full` for a dot, spinner, or avatar; `rounded-[--radius-none]` for
the rare element that must stay hard-square despite the new default.

## Rule 6 — a filled panel becomes a hairline, unless it is genuinely elevated

A card, list row, or section grouping that today separates itself from the page with a background
fill moves to a `border` in `--color-divider` (or `--color-border`) plus whitespace — no
`bg-(--color-surface)` used purely as a separator. `Dialog` and `Popover` content — anything React
Aria renders detached from normal flow, above a dimmed or unrelated background — keeps `shadow-lg`
(`--shadow-lg`). See research.md D-5 for the reasoning and the full list of dialogs this applies to.

## Non-negotiables from the spec

| | |
| --- | --- |
| **No dark theme** | `globals.css` gains no `prefers-color-scheme` branch (spec *Assumptions*). |
| **AA contrast, everywhere** | Every pair `globals.test.ts` asserts on clears 4.5:1 (text) or 3:1 (non-text) against the *new* hexes (FR-007, SC-003). A ramp that fails this test is not a valid ramp — the test is the acceptance gate, not a follow-up check. |
| **Focus indication survives** | The base layer's `[data-focus-visible], :focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }` rule is unchanged in shape; only the accent hex it resolves changes (FR-008). `globals.test.ts`'s `controlBoundaryPairs` list does not yet include `--color-accent` against `--color-accent-fill` — needed because a focused accent-filled control (e.g. a focused primary button) puts the outline and its own background in the same hue family; this pairing is added to that list before the new ramp lands, so a focus ring that blends into an accent-filled surface fails the contract rather than shipping unnoticed. |
| **No functional change** | No component prop, no Server Action signature, no query, no route changes because of this contract (FR-009). |
