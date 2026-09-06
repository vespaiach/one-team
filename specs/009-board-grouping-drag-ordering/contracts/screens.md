# Contract — screens

**Feature**: `specs/009-board-grouping-drag-ordering`

One new screen at an existing route, and four small edits to existing files that a requirement
forces. No new route, no modal, no second board URL (FR-001, FR-020).

---

## `/projects/:projectKey` — the board

`src/app/(app)/projects/[projectKey]/page.tsx`, today a `requireActor()` followed by `notFound()`.

### Server Component

```text
const actor = await requireActor()                 unauthenticated → sign-in, never Forbidden  FR-003
const { projectKey } = await params                params is async                            Next 16
const board = await loadBoard(projectKey, actor)
if (!board) notFound()                             an unheld key → "This doesn't exist"        FR-003
```

There is **no** membership gate on the route. Every signed-in user reads every board; membership is a
write boundary and never a visibility one (FR-002, `OT-AUTHZ-002`). `forbidden()` is never called
here.

The page renders `ProjectHeader` and, inside a `Suspense` boundary with `BoardSkeleton` as its
fallback, the client `BoardScreen` (FR-007).

### Component tree

```text
ProjectHeader  current="board"                                             FR-004
├── control    <GroupingControl>            the header's one per-screen slot   FR-005
└── newIssue   <NewIssueControl>            R2/R6's, passed through untouched   FR-005

<Suspense fallback={<BoardSkeleton/>}>                                     FR-007
  <BoardScreen>                             "use client"
    └── <BoardLane>  one per lane, horizontally scrolling                  FR-006
        ├── header   name + live count                                     FR-009
        ├── <GridList aria-label={lane.name}> … <IssueCard>                FR-010
        │   └── empty → one quiet line, no illustration                    FR-008
        └── <CardComposer>  "Add a card" + chevron                         FR-046, FR-048
```

### Roles, names and focus

| element | role | accessible name |
| --- | --- | --- |
| grouping control | React Aria `Select` | "Group by" |
| a lane | `GridList` | the lane's name — every drop target has a name (FR-043) |
| a card | `GridListItem` | the issue's key and title (`textValue`) |
| a card's drag handle | `Button slot="drag"` | "Reorder <key>" — the keyboard drag entry point |
| the composer | `TextField` | "Add a card", or the refusal reason when disabled (FR-052) |
| the chevron | `Button` | "Open the full form" |
| a refusal | toast, via R2's `showToast` | — (FR-041) |

Interaction state is styled through `data-hovered`, `data-pressed`, `data-selected` and
`data-focus-visible`, never hand-rolled. Every control carries a visible focus indicator and no state
or error is conveyed through colour alone (FR-043, SC-015).

### The card face — exactly this and nothing else

Key · title · then, **only when set**: a priority glyph, its labels, its assignee's avatar, its due
date, its comment count (FR-010). No placeholder, no empty slot, no "unassigned" chip for an unset
field. **No colour identifies a project, a column or a label anywhere** — a label is told apart by
its name and carries no swatch (FR-011, SC-016). The key is R6's `formatIssueKey` output, passed
through, never recomputed (FR-012). Activating a card navigates to that issue's own page; there is no
peek panel (FR-013).

Every value on a card is read live on each render, never frozen, so a rename elsewhere follows on the
next re-query (FR-014).

### Grouping

Three options, exactly: Column (default), Assignee, Priority (FR-015). **No sort control and no
filter control exists on this screen** — drop position is the only ordering input. The choice is
`useState` in `BoardScreen`: not in the URL, not in a cookie, not on the user record, so a revisit
renders Column again (FR-020, the fifth Clarification).

Lane sets and their order are fixed in [`data-model.md`](../data-model.md). The card face, the drag
gesture and the composer are **identical** under all three; only what a lane means differs, and
therefore which field a cross-lane drop writes (FR-021).

### Layout

Desktop only. No responsive layout and no mobile breakpoint anywhere in this feature; a board wider
than the viewport is reached by scrolling (FR-006, `OT-SCOPE-004`). A lane renders every card it
holds — no pagination, no "show more" (the spec's *Out of Scope*).

### Loading

`BoardSkeleton` matches the lane layout it replaces — lane-shaped, never a full-screen spinner — and
the layout does not shift when the data lands. **A re-query of an already-rendered board shows no
skeleton** (FR-007, FR-059): the interval and focus refreshes update in place.

---

## The drag

Wired with `useDragAndDrop` from `react-aria-components`, one hook set per lane (research C-1, C-2).
Nothing else supplies the interaction; Tailwind is the visual layer only (FR-044).

| gesture | handler | `moveIssue` call |
| --- | --- | --- |
| dropped between cards in its own lane | `onReorder` | same lane; `targetIssueId` = `target.key`, `placement` = `target.dropPosition` |
| dropped between cards in another lane | `onInsert` | that lane; same target and placement |
| dropped on an empty lane | `onRootDrop` | that lane; `targetIssueId: null`, `placement: "after"` |
| Escape, or dropped outside any lane | — | **none** — nothing is written and the card returns (FR-042) |
| dropped where it already sits | resolves to a no-op | the call is made and writes nothing (FR-032) |

`acceptedDragTypes` is a single board-card drag type, so nothing else on the page — or dragged in
from outside the browser — can land on a lane. `getDropOperation` returns `"cancel"` for a lane
outside the assignee pool (FR-037, US3 sc.12). A non-member's lanes receive
`dragAndDropHooks={undefined}`, so no drag begins and no call is made (US6 sc.2) — the pattern
`columns-section.tsx` already uses.

Every drop is completable with the keyboard alone (FR-043, SC-015).

### Optimism and refusal

A drop renders in its new position **before** the server answers (FR-041). On a refusal the card
returns to the exact position it came from and a toast names what failed:

| outcome | message names |
| --- | --- |
| `forbidden` | the reason the mutator returned, which names the project (FR-041) |
| `not_found` | that the card or its lane is gone, and the board refreshes (FR-034, US5 sc.8) |
| `invalid_target` | that the drop was not a legal one for that lane (FR-035) |
| `no_index_available` | that the card could not be placed between those two, and nothing was moved (FR-031) |
| the call **rejects** | the connection message; **nothing is queued for later** (FR-045) |

Four distinct messages, never one generic one (FR-041).

### Freshness

`BoardScreen` calls `router.refresh()` every thirty seconds while the tab is visible, and immediately
on window focus (FR-054). A re-query landing mid-drag updates the board underneath the drag without
cancelling it, and the drop then resolves against the neighbours that are actually there (FR-055).
A re-query **never** overwrites the caller's own in-flight drop with older data (FR-056) — the board
replays its pending drops over each set of fresh rows rather than using `useOptimistic`, for the
reason research D-1 records. Unchanged data causes no visible change and no layout shift (FR-059).

There is no locking, no socket and no live push. The last write wins and a losing client learns of
staleness only here (FR-057).

---

## The composer

One "Add a card" at the foot of **every** lane, under every grouping (FR-046). It takes a title and
nothing else; enter creates the issue.

| gesture | result |
| --- | --- |
| enter | one `createIssue` in this lane's meaning; the field clears and stays ready (FR-047) |
| shift-enter, or the chevron | the Create issue page opens, preselecting exactly what the composer would have written, carrying across any typed title (FR-048) |
| empty or whitespace-only | nothing is created; the refusal is inline on the field, not a toast (FR-051) |
| in flight | in-flight state on the control; the card appears only after the server answers (FR-050) |

**Disabled, never hidden** (FR-052, `OT-UX-021`):

| viewer / lane | composer |
| --- | --- |
| a non-member, any lane | rendered, disabled, its placeholder carrying the reason and naming the project — and so is the chevron |
| a member, a lane outside the assignee pool | rendered, disabled, the same reason inline — and so is the chevron, because FR-037 excludes that person from the pool the composer would have to write and from the preselection the chevron would have to carry (the fourth Clarification, and Clarifications 2026-09-05) |
| a member, an archived project | works exactly as on an active project (FR-039, US4 sc.11) |

The hide-rather-than-disable rule covers admin-only navigation only; nothing here is hidden.

---

## Edits to existing files

Four, each named with the requirement that forces it. Nothing adjacent is changed (gate 7).

### `src/features/projects/components/project-header.tsx` — one prop

Gains `control?: ReactNode` and forwards it to `ScreenHeader`. **`ScreenHeader` already declares and
renders a `control` slot** — R2 built it and nothing had used it yet — so the header contract is not
changed and nothing is added to the header but its one per-screen control (FR-004, FR-005). The
**New issue** button is passed through exactly as R2 and R6 deliver it.

### `src/app/(app)/projects/[projectKey]/issues/new/page.tsx` — reads `searchParams`

The chevron opens this route with a preselection. The page reads `searchParams` (async in Next 16)
and passes a value to the form **only when the project actually admits it** — the column must be in
`listProjectColumns`, the assignee in `listAssigneePool`, the priority one `parsePriority` accepts.
Anything else is dropped and the form renders its own default (II, gate 3, research E-3). The chevron never offers a value outside those sets — it is disabled in a lane whose person is outside the pool — so that drop can only ever answer a hand-typed URL, never a link the board produced.

`createIssue` re-validates all four on submit regardless, so this is not the security boundary; it is
the rule that input failing validation is rejected rather than silently rendered. The route's
existing `forbidden()` for a non-member is untouched (FR-053) — the disabled control and the
Forbidden screen stay independent, neither implying the other was skipped.

### `src/features/issues/components/create-issue-form.tsx` — four optional initial values

`initialTitle`, `initialColumnId`, `initialAssigneeId`, `initialPriority`, each seeding the `useState`
that is there today (`useState("")`, `useState(columns[0]?.id ?? "")`, …). Callers that pass none
behave exactly as they do now, so the existing New issue page is unaffected (FR-048).

### `src/features/issues/actions.ts` — the `moveIssue` action

One export, following the preamble the three actions there already share. Contract in
[`mutators.md`](./mutators.md).

---

## Screens this feature does **not** touch

Project details and its Columns section (R9's — column editing is never offered on the board,
FR-016) · issue detail and its rail (R6's — the board offers no inline field control on a card) ·
the activity feed, its toggle, its collapsing and its pagination (R7's) · Labels (R8's — the board
renders a card's labels and offers no way to change them) · Home (R12's progress figure reads
`done`- and `canceled`-kind columns; **this feature reads a column's `kind` for nothing at all**) ·
Notifications (R11's) · the shell, sidebar, Forbidden and "This doesn't exist" screens (R2's, rendered
into unchanged).
