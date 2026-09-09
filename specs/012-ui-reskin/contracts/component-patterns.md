# Contract — component patterns (FR-004, FR-007, FR-008)

FR-004 requires "every reusable UI element already in use on an existing surface" to be restyled —
not a new component library, not new variants nobody uses today. This contract lists what "already
in use" resolves to in this codebase, so the sweep has a fixed inventory rather than an
open-ended one, and states the interaction-state and focus rule each pattern must keep.

There is no `src/components/ui` directory today (confirmed: `find src/components/ui` returns
nothing) and this feature does not create one — restyling existing call sites is not "a pattern
appearing at a second call site" in Principle I's sense; it is the same call site, restyled. The one
exception is the dialog shell already duplicated seven times over (research.md D-6), which crosses
Principle I's threshold on its own and is extracted as part of the same edit each of those seven
files needs anyway.

## Buttons

Primary/secondary/ghost/icon variants exist as class-producing helpers (e.g.
`src/features/auth/components/primary-button-classes.ts`, asserted by
`primary-button-classes.test.ts`) and as inline `Button`/`ToggleButton` usages across features. Every
one is React Aria's `Button` or `ToggleButton` — `onPress`, not `onClick` — and every one already
styles through `data-hovered`, `data-pressed`, `data-focus-visible`, `data-disabled`. This feature
changes which hex/radius/spacing each state resolves to; it does not add a new variant, and it does
not touch the `data-*` selectors themselves.

**State check per button** (FR-007): resting, hovered, pressed, focus-visible, disabled, pending —
each still visually distinct after the ramp and radius change. `primary-button-classes.test.ts`'s existing
assertions (accent-fill resting, accent-hover while pending) continue to hold since they assert
token names, not values (D-1).

## Text inputs, labels, and validation state

React Aria `TextField`/`Input`/`Label`/`FieldError` compositions (`email-field.tsx`,
`password-field.tsx`, and the editable-field components in `projects/`, `profile/`, `issues/`).
Error text is already associated with its control via React Aria's built-in `aria-describedby`
wiring — this feature restyles the error text's colour (`--color-danger-text`) and the field's error
border, and does not touch the association itself (FR-009: no functional change).

**State check per field**: resting, focus-visible, disabled, error, placeholder — `--color-text-
placeholder` and `--color-text-disabled` already exist as separate tokens from `--color-text-muted`,
so a placeholder and a disabled value stay visually distinct from each other after the reskin, not
just from resting text.

## Cards / list rows / section groupings

Board `issue-card.tsx`, project/label/notification list rows, Home's card and list regions. Per
research.md D-5, a card that separates itself with a background fill moves to a hairline border; a
card's *content* padding and internal spacing move with the new `--spacing` unit (D-3) with no
class-name change beyond any arbitrary-pixel values a per-file sweep finds.

## Navigation items

`sidebar.tsx`, `project-list-region.tsx`, `screen-header.tsx`. FR-005 governs the shell specifically
(see the page inventory contract); this entry is the component-pattern side: hover and (where R2
defined one) selected-state styling move to the new tokens, and the sidebar's information
architecture (which items exist, in what order, admin-only hiding) is untouched — FR-005 is explicit
that the restyle preserves "the same destinations, counts, and any collapse behavior."

## Badges / pills

No dedicated `Badge`/`Pill` component exists in the codebase today (confirmed by a repo-wide
case-insensitive search for `badge`/`pill`, which returns no matches). FR-004's "badges/pills (in
whatever variants are already used)" therefore names nothing this feature must restyle as a distinct
pattern — status/role indicators that exist today (e.g. a role label in `roster-table.tsx`) are
covered under the table/text pattern they actually render as, not invented as a new badge component.

## Dialogs

`Dialog` from React Aria, eight call sites across seven files today, all sharing one literal class
string (research.md D-6). This feature extracts that string into one shared constant/component so the
`gap`, background, and radius change lands once — `max-w-[420px]` is a fixed layout-constraint
dimension, exempt under `contracts/design-tokens.md` Rule 4 and FR-003, and stays unchanged — and
every one of the eight dialogs is
verified individually (each guards a different destructive or creation action — delete project,
delete column, delete label, create/edit label, invite, delete issue, and the two roster dialogs) to
confirm the extraction changed no dialog's copy, fields, or submit behaviour.

**State check**: focus is trapped and returns to the trigger on close (React Aria's default,
unchanged); the overlay dims the page behind it; `Escape` and the explicit cancel control both close
it. None of this is new to the feature — it is the regression bar FR-009 sets.

## Tables

`roster-table.tsx` and `invitations-table.tsx` render real `<table>`/`<thead>`/`<tr>`/`<th>`/`<td>`
markup — not a div-based grid. Row separation moves from any filled striping (if present) to a
hairline row border, consistent with "rules, not boxes"; header cell type moves to `--font-sans`
(interface chrome), machine-value cells (joined date) move to `--font-mono`, and name/role cells stay
on the body/chrome face already in use for prose vs. UI text.

## Cross-cutting: focus indication (FR-008)

Every pattern above resolves its focus ring through the single base-layer rule
(`[data-focus-visible], :focus-visible { outline: 2px solid var(--color-accent); outline-offset:
2px; }`). No component pattern defines its own focus treatment — this is what makes FR-008 a
one-line token change rather than a per-component sweep, and it is a rule this contract does not
change, only re-colours.
