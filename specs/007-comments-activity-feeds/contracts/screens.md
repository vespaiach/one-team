# Contract — the shared feed, the composer, and the mention picker

**Plan**: [`../plan.md`](../plan.md) · **Spec**: [`../spec.md`](../spec.md) · **Research**:
[`../research.md`](../research.md) groups E, F

No route is added by this feature. It fills two slots R6 and R5 each left unbuilt — the issue detail
page's main column, after the description (`§3.4`, R6 `contracts/screens.md`: *"Activity does not
appear. Entry R7"*), and project details' foot (`§3.8`, R5 `contracts/project-details.md`: *"The
Activity feed, its composer, its filter toggle and its collapsing — R7"*) — and fills the project
header's comment count (`§3`, The shell), R5's `project-header.tsx`.

---

## Component structure

Every component is synchronous and takes plain props, matching R2's and R6's constraint that Vitest
cannot render async Server Components (R6 research D-2). Only the page that hosts each feed resolves
data; the feed component itself is a Client Component from `Feed` down, because it owns pagination
state, the optimistic post and the collapsing toggle.

```
src/features/activity/components/
  feed.tsx                 "use client"   the stream, its pagination and its filter    FR-026…FR-038
  feed-row.tsx              synchronous    switches on `kind`: CommentRow | ActivityRow FR-028, FR-030
  comment-row.tsx           synchronous    author, body with mentions resolved, edit/delete FR-028
  activity-row.tsx          synchronous    one sentence, or a collapsed group           FR-030, FR-031
  composer.tsx              "use client"   the field, ⌘-enter, the mention trigger      FR-039…FR-044
  mention-picker.tsx        "use client"   Popover + ListBox, ranked, debounced          FR-024, FR-025
  feed-filter-toggle.tsx    "use client"   Comments only / All activity                  FR-033, FR-034
  feed-skeleton.tsx         synchronous    the loading shape                             FR-060
```

**One `Feed` component renders on both call sites in the commit that creates it** — research F-3.
Principle I's precondition is met on arrival: the issue page and the project page are not a first
caller and a hoped-for second one, they are two renders inside this same feature.

`comment-row.tsx` and `activity-row.tsx` are not merged into `feed-row.tsx` directly, despite each
having exactly one caller: a comment row carries controls and a body; an activity row never carries a
control and its sentence construction (`FR-030`) is a small enough switch that splitting it out is
what keeps `feed-row.tsx` a dispatcher rather than a second copy of either row's logic (Principle III).

---

## `Feed`

**Props**: `{ target: { issueId: string } | { projectId: string }; initialPage: FeedPage; canPost:
boolean; postReason: string | null; feedFilter: 'comments' | 'all' }`. `initialPage` is the host
page's own first-page read (`listFeed`, [`../data-model.md`](../data-model.md) §4) — the feed never
issues its own first fetch, so there is no loading flash on open beyond the host page's own `Suspense`
boundary (`FR-060`).

**Rendering** (`FR-027`, `FR-028`): one reverse-chronological list, `Composer` fixed at the head,
`FeedFilterToggle` above the stream, no tabs. A `comment` row shows avatar, display name, live body
with mentions resolved (research E-1), a relative time, and an edit control when `canEdit` and a
delete control when `canDelete` (data-model §4) — no other row ever carries either.

**Anchor ids** (`FR-029`): every comment row's outermost element carries `id="comment-<id>"`, present
in the markup unconditionally, so a URL fragment scrolls to it with no script of this feature's own.

**Collapsing** (`FR-031`, research F-2): a pure function over the current page's rows, applied at
render time — consecutive non-`comment` rows by the same `actorId` within five minutes of the one
before collapse into one `<CollapsedGroup>` line reading the actor and the count, expandable. A
`comment` row is never a candidate, whatever its neighbours' timing.

**Pagination** (`FR-032`, research F-1): scrolling to the foot of the loaded rows calls `listFeed`
again with the last row's `(createdAt, id)` as the cursor and appends the result; the 50-row count is
of raw rows fetched, not of the (possibly fewer) lines the page renders after collapsing.

**The filter** (`FR-033`, `FR-034`): a two-state toggle calling `setFeedFilter` on change. `Comments
only` renders only `kind === 'comment'` rows from what is already loaded — filtering is client-side
over the fetched page, so switching the filter never re-fetches and never starves the page of rows to
append (spec, US5 scenario 5). The initial `feedFilter` prop comes from the host page's own read of
`user.feed_filter`, so the very first render already reflects the choice — no flash of the other state
(`SC-009`).

**Posting** (`FR-037`): `Composer`'s submit calls `createComment` inside a transition wrapping
`useOptimistic`; the new row renders at the head immediately, keyed by a client-generated temporary id
swapped for the server's once the action resolves, and a failure ends the transition, discards the
optimistic row, and raises a toast naming what failed and why — the same rollback shape R5's and R6's
in-place edits already use (R6 research D-5).

**No polling** (`FR-036`): `Feed` re-queries only when its host page does — on navigation — never on
an interval. A row another user wrote appears on this reader's next visit or revalidation, matching
`OT-UX-006`.

---

## `Composer`

**Props**: `{ target; canPost: boolean; postReason: string | null }`.

| Rule | Requirement |
| --- | --- |
| Plain text only, grows with content | `FR-039`, `FR-042` |
| `@` opens `MentionPicker` at the cursor | `FR-039` |
| ⌘-enter posts; on a platform with no ⌘ key, Ctrl-enter | `FR-039`, matching `OT-UX-009`'s own accelerator rule |
| Submitting trims first; empty after trimming is refused inline, no call issued | `FR-040` |
| Over 10 000 characters is refused on the field, naming the bound; never truncated | `FR-041` |
| Disabled, with `postReason` as its accessible description, when `canPost` is false | `FR-021`, `FR-035`, `FR-061` |

**Disabled is never hidden** — visible, inert, carrying `postReason` (`OT-UX-002`). A member who loses
`isMember` mid-composition sees the control disable on its next render; a bypassed direct call is
refused server-side independently of the control's state (`FR-020`).

---

## `MentionPicker`

**Props**: `{ target; onSelect(userId: string): void }`.

Built from React Aria's `Popover` and `ListBox`, the one named exception to the component-first rule
(`FR-025`, research E-4). Opens on `@`, closes on Escape, selection with arrow keys and Enter or a
pointer.

**Query**: `listMentionCandidates(target)`, re-run on every keystroke after `@`, debounced on the same
schedule as R5's `checkProjectKeyAvailable` (research E-3) — not cached from when the composer opened,
so a deactivation between two keystrokes removes that account from the list on the very next one
(`FR-024`).

**Ranking**: the `scoped` group (that target's project's members and every admin) renders above
`everyoneElse`, both alphabetized within their group, both excluding deactivated accounts
unconditionally (`FR-024`). Opening `@` with no letters typed yet shows the full ranked list rather
than staying empty (US4 scenario 4).

**On select**: `onSelect` inserts `@[<userId>]` into the composer's value at the trigger position,
rendered to the typist as that person's display name over the token — the same live-resolution the
feed itself applies on read (`FR-022`), so the author never sees the raw bracket syntax either.

---

## `ActivityRow`

One sentence per `FR-030`'s table, built from `type`, `field`, `fromValue` and `toValue`:

| `type` | Sentence shape |
| --- | --- |
| `created` | "{actor} created this" |
| `field_changed` | "{actor} changed {field} from {fromValue} to {toValue}" — either side rendered as the product's "none" wording when null |
| `member_added` | "{actor} added {toValue}" |
| `member_removed` | "{actor} removed {fromValue}" |
| `archived` | "{actor} archived this" |
| `reopened` | "{actor} reopened this" |

No row of any type ever carries a control (`FR-028`). A `<CollapsedGroup>` wrapping several rows
renders "{actor} made {n} changes", expandable to the individual sentences above (`FR-031`).

---

## Where this feature edits R6's issue detail and R5's project details

**Issue detail** (`src/features/issues/components/issue-detail.tsx`, R6's). One addition: `<Feed
target={{ issueId }} … />` immediately after the description, which is where R6's own contract left
the slot (`FR-026`, §3.4's ordering: "key, title, description, then Activity").

**Project details** (`src/features/projects/components/project-details-screen.tsx`, R5's). One
addition: `<Feed target={{ projectId }} … />` as the screen's last section, after
`DeleteProjectControl`, matching §3.8's own ordering: *"The project's feed sits at the foot of this
screen, not on a page of its own."*

**Project header** (`src/features/projects/components/project-header.tsx`, R5's). One addition: the
comment count beside the colour dot and the Board/Details tabs, reading `countProjectComments`
([`../data-model.md`](../data-model.md) §4) live on every render (`FR-059`).

Both host pages compute `canPost` and `postReason` the same way R5's and R6's pages already compute
`canWrite`/`canEditRecord` — `isMember` of the relevant project, resolved server-side, never
re-derived by the client (`FR-019`).

**What is consumed unchanged**: the skeleton-below-the-guard convention (`FR-060`, R2's
`route-surface.md`), the toast primitive, the disabled-control-with-accessible-reason pattern
(`FR-061`, R2's `ux-conventions.md`), and both hosts' own existing sections — nothing about either
page's record, status, columns, members, rail or delete control changes.

---

## Accessibility, on the feed and the composer together

`FR-038`, `FR-061`. Every state a colour alone would otherwise convey — a comment's own controls, a
collapsed group's expand affordance, a disabled composer — carries a text or shape equivalent. Every
control carries an accessible name and a visible focus indicator. A disabled control's reason is
associated with it programmatically (React Aria's own slot mechanism, not adjacent text or a `title`
attribute — R6 research D-11's rejected alternative applies here unchanged).
