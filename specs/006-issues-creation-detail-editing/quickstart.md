# Phase 1 — Quickstart validation

**Plan**: [`plan.md`](./plan.md) · **Spec**: [`spec.md`](./spec.md) · **Contracts**:
[`contracts/`](./contracts/)

Fourteen walkthroughs. Each names the requirements it demonstrates, so a reviewer can run the list
and reach every acceptance scenario the spec states without reading the code. Five of the eighteen
success criteria are not observable from a browser at all — the counter race, the cascade, the no-op
write, the length bounds at the database and the timezone rule — and each of those names the test
that proves it instead.

---

## Prerequisites: entries R2 and R5 are implemented

**Nothing here runs until both are.** Today the repository holds R1 only. This feature consumes:

- from **R2** — the `(app)` shell and its 262px sidebar, the two guard-only pages this feature fills,
  `forbidden()` and its screen, the "This doesn't exist" notice, the header contract with its New
  issue slot, the toast conventions and the disabled-control-with-inline-reason rule;
- from **R5** — the `project`, `project_member`, `board_column` and `issue_counter` tables, the
  `isMember` predicate, the five seeded columns, the project header with its Board / Details tabs,
  `/projects/:projectKey/details` as the delete's destination, and the markdown implementation
  `FR-044` extracts.

```bash
git log --oneline -1 -- src/features/projects/server
```

An empty result means R5 has not landed and this checklist cannot be started.

R3 is **not** a prerequisite. This feature reads `user.deactivated_at`, which R1's table already
carries; it needs R3's screens for nothing.

---

## Setup

```bash
npm ci
```

```bash
npm run db:migrate
```

Then, through R5's own screens: one project — key `WEB`, name *Website Redesign* — with its five
seeded columns; a second project `API` used only by walkthrough 4. Three accounts: an admin, a member
of `WEB`, and a third who is a member of neither.

```bash
npm run dev
```

---

## 1 · One title is a whole issue · `FR-030`, `FR-032`…`FR-035`, `FR-039`, `SC-001`

As the member, open `/projects/WEB/issues/new`. The title field is first and focused. Type one and
press Create, touching nothing else.

Expect: the browser lands on the new issue's own page; the key reads `WEB-1`; the column is Backlog
— the first by board position, not by name; priority reads **No priority**; assignee reads
Unassigned; there is no due date. Under a minute, no step outside the form.

Create a second and a third. They take `WEB-2` and `WEB-3`, and neither creation changes the first
issue's number, column or position (`FR-040`, `SC-005`).

## 2 · The form refuses without going dead · `FR-030`, `FR-037`, `SC-016`

On the create form, put three spaces in the title and blur.

Expect: an inline error on the field; the **Create** control still enabled, not greyed out; nothing
written. Then paste 201 characters into the title and blur — an inline error naming the 200-character
bound, nothing shortened, no save issued. Do the same with 10 001 characters in the description.

Press Cancel: you return to where you came from and nothing was written (`FR-039`).

## 3 · No key exists before the server says so · `FR-015`, `FR-038`

Throttle the network to a slow profile and press Create.

Expect: in-flight state on the Create control, the form waiting, and **no key rendered anywhere** —
not a placeholder, not a provisional `WEB-?`. The number appears for the first time on the issue's
own page.

## 4 · The pair is the address · `FR-017`, `SC-004`, US2 scenario 5

Create issues in `API` until it holds a number 1. Then open `/projects/WEB/issues/1/details` and
`/projects/API/issues/1/details`.

Expect: two different issues. Then open `/projects/WEB/issues/999/details` and `/projects/ZZZ/issues/1/details`.

Expect: "This doesn't exist" on both — never "you don't have access" (`FR-046`, `SC-014`).

## 5 · Seven constructs, and nothing else · `FR-009`, `FR-010`, `FR-044`, `SC-013`

Set an issue's description to:

```
# Heading
**bold** and *italic* and `code`
[a link](https://example.com) and [a trap](javascript:alert(1))
- one
- two

1. first
2. second

| a | b |
<b>raw</b>
```

Expect: the heading, bold, italic, inline code, the bullet list and the numbered list all render as
themselves. The `https` link is a link. The `javascript:` construct renders as its own literal text
and is **not clickable**. The table row and `<b>raw</b>` render as the characters typed — no markup
executed, no bold.

Then click the description to edit: it shows the **raw source**, not the rendered form, and there is
no preview pane and no formatting toolbar (`FR-044`).

## 6 · One implementation renders both · `FR-044`, `SC-017`

Paste the same source into a project's description on `/projects/WEB/details` and into an issue's.

Expect: identical rendering, construct for construct. Then run R5's own description tests:

```bash
npx vitest run src/features/projects
```

They pass unchanged after the extraction. That is the regression test `FR-044` names, and a failure
here is an R5 defect fixed as one — not a change absorbed into this feature.

## 7 · Every field, edited where it stands · `FR-048`…`FR-051`, `SC-006`

As the member, on an issue page: click the title, change it, blur. Click the description, change it,
press ⌘-enter. Change the column, the priority, the assignee and the due date from the rail.

Expect on each: the new value visible immediately, before the server answers; exactly one save; no
page reload. Press Escape mid-edit on the title — it reverts and writes nothing.

Then clear the assignee and clear the due date. Both are legal; the issue becomes unassigned and
undated and both persist (`FR-006`).

Open the rail's column control: it offers **this** project's five columns and no other project's
(`FR-052`). Move the issue into Canceled and back out again — both directions legal, no confirmation
on the transition (`FR-053`).

Look for a way to change the project: there is none, and the project renders as a value rather than a
control (`FR-007`, `FR-045`, `SC-009`).

## 8 · A refusal rolls back and says why · `FR-050`, `SC-006`

With the issue page open as the member, remove that member from `WEB` in a second browser as the
admin. Back in the first, change the assignee.

Expect: the value applies, then rolls back, and a toast names what failed and why — "Only project
members can edit issues in Website Redesign". No row is removed by the membership change itself, and
the controls are disabled on the next render (`FR-025`, US4 scenario 5).

## 9 · The non-member reads everything and writes nothing · `FR-021`, `FR-023`, `FR-026`, `FR-054`, `SC-007`, `SC-012`

As the third account, open an issue in `WEB`.

Expect: every field readable. The title and description are **not clickable**. Every rail control is
visible, disabled, and carries an inline reason naming the project. Nothing is hidden. The page's
structure is identical to what the member sees (`FR-047`).

Then assign that person to the issue as the member, and reload as them.

Expect: they see their own issue, can change nothing, and the page names the project they would need
to be added to (`SC-008`).

## 10 · Two entry points, two independent refusals · `FR-028`, `FR-029`, `OT-UX-021`

Still as the non-member: the header's **New issue** control on every project-scoped screen is visible,
disabled and carries a reason naming the project — never hidden.

Then reach `/projects/WEB/issues/new` directly by URL.

Expect: the Forbidden screen, inside the shell, at that URL. The disabled control and the Forbidden
screen are independent — neither implies the other was skipped.

Sign out entirely and request the same URL: a redirect to `/signin`, and Forbidden is never reached
(`FR-029`).

## 11 · The admin needs no roster row · `FR-022`, US4 scenario 6

As the admin — who holds no `project_member` row in `WEB` — open an issue in it.

Expect: every control enabled, because `isMember` admits every admin. Open the assignee control: the
admin appears in the pool alongside `WEB`'s members, and no deactivated account appears at all
(`OT-AUTHZ-007`).

Deactivate the current assignee. Their name keeps rendering on the issue and the assignment survives;
the control no longer offers them (`FR-024`).

## 12 · Members cancel, admins delete · `FR-056`, `FR-061`, `FR-062`, `SC-010`

As the member, look at the rail beneath the four editable rows: the **Delete** control is there,
visible, disabled, with its reason. The route out for a member is the Canceled column, offered like
any other (US5 scenario 3).

As the admin, press Delete.

Expect: one confirmation naming the issue by key and title — `WEB-142 · Fix the sign-in redirect` —
and stating what will go with it. Nothing references an issue yet, so it confirms without a count,
in the same register as any other. Confirm.

Expect: the browser lands on `/projects/WEB/details`, a route that exists (`FR-060`).

Then, as the member, call the delete path directly, bypassing the disabled control.

Expect: the server refuses it (`FR-056`, US5 scenario 4).

## 13 · A freed number is gone for good · `FR-014`, `SC-003`, US5 scenario 5

With `WEB`'s highest issue at number 12, delete issue 12 as the admin, then create a new issue.

Expect: `WEB-13`. Never `WEB-12`.

## 14 · Keyboard alone · `OT-UX-018`, `AGENTS.md` → React Aria

Complete walkthrough 1 without touching the mouse: Tab to each field, open each `Select` with Enter
or Space, choose with the arrow keys, submit. Then on an issue page, Tab to the title, press Enter to
edit, Escape to revert.

Expect: a visible focus indicator on every stop, no focus trap outside the confirmation dialog, and
inside it a real trap that Escape releases. No state is conveyed by colour alone — every disabled
control carries its reason as text.

---

## What a browser cannot show you

Five criteria have no walkthrough, by their nature. Each names the test that proves it.

| Criterion | Proved by |
| --- | --- |
| `SC-002` — racing creations get distinct numbers | the two-connection persistence test ([`research.md`](./research.md) E-2) |
| `SC-011` — nothing survives a deleted issue, and nobody sees it half-gone | the cascade test, asserting from a second connection outside the transaction |
| `SC-016` — the server refuses an over-length value when the client's check is bypassed | the mutator tests, calling `createIssue` and `updateIssue` directly, plus the `CHECK` tests |
| `SC-018` — a save that changes nothing writes nothing | `updated_at` byte-identical after a no-op `updateIssue` ([`research.md`](./research.md) B-7) |
| `SC-015` — a due date means the same day for everyone | the column is `date` read in string mode, so no instant exists to shift ([`research.md`](./research.md) A-8) |

---

## The gate

```bash
npm run verify
```

`style-check`, then `type-check`, then `test`, then `build`. CI runs exactly this and nothing else.

`npm test` runs with `--passWithNoTests`, so a green run is not by itself evidence of gate 1 — the
commit order, one Red step per acceptance scenario, is.
