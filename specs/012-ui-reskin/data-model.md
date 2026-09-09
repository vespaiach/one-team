# Data model — UI reskin to the Broadsheet design system

**No database entity is added, changed, or removed.** `src/db/schema.ts` is untouched, no migration
is generated, and FR-009 requires the restyle to change presentation only. What this feature does
define is a *design-token model*: the set of named values `src/app/globals.css` declares and every
component consumes, which is the closest thing this feature has to entities, fields, and
relationships.

## Token entities

### Palette role token

The seven hand-picked colours the rest of the palette is built from: four role tokens
(`--color-bg`, `--color-page`, `--color-surface`, `--color-text`), two accent role tokens
(`--color-accent`, `--color-accent-2`), and `--color-divider`.

| Field | Description |
| --- | --- |
| `--color-bg` | Page background — the cream paper ground. |
| `--color-page` | The lighter of the two surface levels (currently `#ffffff`; stays the palette's lightest neutral). |
| `--color-surface` | The sunken/secondary surface level, one step off `--color-bg`. |
| `--color-text` | Primary ink colour — near-black, not pure black, matching "paper and ink." |
| `--color-accent` | Primary clay/terracotta accent — replaces the current red-orange. |
| `--color-accent-2` | Secondary accent, a distinguishable tone from `--color-accent` (advisory state). |
| `--color-divider` | The hairline colour used everywhere a border replaces a filled panel (D-5). |

**Validation rule**: every role token must be a value at least one text/background pairing in
`globals.test.ts` resolves to and clears its WCAG threshold (FR-007, SC-003) — a role token that no
pairing in the test list references is dead (VI) and must not ship.

**Source of truth for exact values**: no design-brief or handoff file fixes the literal hex for
"cream paper," "clay/terracotta," or "ink-black" (research.md preamble) — the qualitative anchors
above are the only input. The exact hex each role token ships with is therefore chosen at
implementation time, in `src/app/globals.css` itself, constrained by two things: it must read as the
named colour family, and it must be a value `globals.test.ts` proves clears its WCAG pairing (D-8).
`globals.css` is the single place the resolved values live; this document and `research.md` fix the
constraints a value must satisfy, not the value itself.

### Neutral ramp / accent ramp / accent-2 ramp (nine steps each)

| Field | Description |
| --- | --- |
| `--color-neutral-100`…`900` | Nine-step neutral ramp recomputed around the new `--color-bg`/`--color-text` endpoints. |
| `--color-accent-100`…`900` | Nine-step ramp around the new `--color-accent`. |
| `--color-accent-2-100`…`900` | Nine-step ramp around the new `--color-accent-2`. |

**Relationship**: every semantic token below points at exactly one ramp step or one role token —
never at a literal hex — so a ramp recompute propagates without touching a semantic name.

### Semantic token

The names every component actually imports. Unchanged by this feature (D-1) except for which ramp
step or role token each one now points at.

| Token | Points at (role) |
| --- | --- |
| `--color-surface-sunken`, `--color-border`, `--color-border-control`, `--color-border-strong` | surface/structure |
| `--color-text-muted`, `--color-text-placeholder`, `--color-text-disabled` | de-emphasised text |
| `--color-accent-fill`, `--color-accent-hover`, `--color-accent-pressed`, `--color-accent-text`, `--color-on-accent` | interactive accent states |
| `--color-danger`, `--color-danger-fill`, `--color-danger-text` | error state |
| `--color-success`, `--color-success-fill`, `--color-success-text` | success state |
| `--color-advisory`, `--color-advisory-fill`, `--color-advisory-text` | advisory state |

**Validation rule**: every `var(--color-*)` a component file names must resolve to a token declared
in `globals.css` (the `theme-tokens.test.ts` contract, generalised repo-wide per research.md D-8.3).

### Type step

| Field | Description |
| --- | --- |
| `face` | One of `--font-heading` (serif), `--font-body` (serif), `--font-sans` (chrome), `--font-mono` (new — machine values). |
| `size` | `--text-h1`…`--text-h6`, `--text-body`, `--text-control`, `--text-label`, `--text-caption`. |
| `line-height`, `letter-spacing` | Per-step, as today (`--text-h1--line-height`, etc.). |
| `weight` | `--font-weight-heading` and any weight the serif needs at heading sizes. |

**Relationship**: a heading element (`h1`…`h6`) always pairs `--font-heading` with its matching
`--text-hN` step; a machine value (identifier, date, timestamp, count) always pairs `--font-mono`
with `--text-control` or `--text-caption`, never a heading step.

**Validation rule**: FR-002's existing constraint carries forward unchanged — the H1–H6 scale and
body size are "updated," not removed or given a different mechanism; every heading element still
resolves through the same six `--text-hN` variables.

### Spacing step

| Field | Description |
| --- | --- |
| `--spacing` | The one base unit (5px, changed from 4px — D-3). Every Tailwind spacing utility is `--spacing` × its numeral. |

**Relationship**: no other spacing token exists in this system — `p-4`, `gap-2`, and every other
spacing utility derive from this single value. An arbitrary-value class (`gap-[14px]`) is, by
definition, outside this relationship and is the thing D-3's per-file sweep targets.

### Radius step

| Field | Description |
| --- | --- |
| `--radius-none` | `0px` — explicit hard-square opt-out, declared only if the implementation sweep finds an element that genuinely needs it; a token no component references is dead (VI) and is omitted rather than shipped speculatively. |
| `--radius-sm` *(new)* | The near-square default, applied via the base `*` reset (D-4), replacing today's `border-radius: 0`. |
| `--radius-full` | `9999px` — unchanged, for circular dots/spinners/avatars. |

**Validation rule**: every element that is `rounded-full` today (dots, spinners, the roster avatar
placeholder) stays circular — the base-reset change must not regress those, since FR-009 forbids any
functional or already-established visual behaviour from moving except where the spec asks for it.

### Shadow step

| Field | Description |
| --- | --- |
| `--shadow-sm`, `--shadow-md`, `--shadow-lg` | Unchanged token *names*; values may be retuned to sit correctly against the new paper background. Usage is narrowed per D-5 to genuinely elevated surfaces (`Dialog`, the mention `Popover`) — no new call site is added, and no in-flow card/panel keeps a shadow as its separation mechanism. |

## Non-entities (explicitly out of scope)

- **No new database table, column, or enum.** `deleteAllSessionsForUser`, `session`, `user`, and
  every other persisted shape are untouched.
- **No new DTO or API contract.** Nothing this feature changes crosses a server/client boundary
  differently than before — the same props, the same Server Actions, the same query results.
- **No new component prop or state.** FR-009 forbids functional change; a component's `props` type
  is unchanged by this feature unless a specific FR requires new interaction (none does).
