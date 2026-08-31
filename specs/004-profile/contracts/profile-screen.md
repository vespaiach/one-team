# Contract — the profile screen

**Plan**: [`../plan.md`](../plan.md) · **Spec**: [`../spec.md`](../spec.md) · **Research**: [`../research.md`](../research.md)

One route, one record, nine values, seven of them editable. This file fixes what the screen renders,
how a value becomes a field and back, and what is deliberately not a control.

---

## The route

| | |
| --- | --- |
| Path | `/profile` (`FR-001`, `OT-SCOPE-007`) |
| File | `src/app/(app)/profile/page.tsx` — **R2's**, whose `notFound()` body this entry replaces |
| Frame | inside the persistent shell; sidebar and header both render (`FR-001`, `OT-UX-001`) |
| Access | signed in. Nothing more — an admin has no more access than a member (`FR-018`, US2) |
| Unauthenticated | `requireActor()` redirects to `/signin`. Never the Forbidden screen (`FR-005`, `OT-SEC-015`) |
| Reached from | the sidebar's user chip, which is R2's (`FR-001`, §3, *The shell*) |
| Header | `<ScreenHeader name="Profile" />` — no context line, no per-screen control, no New issue slot (`FR-008`) |

**Order inside the page.** Guard, then query, then render. The skeleton sits below the guard inside a
`Suspense` boundary, never in a `loading.tsx` above it, because `loading.tsx` would stream the
redirect inside a response that had already started
([R2 `ux-conventions.md`](../../002-app-shell-ux/contracts/ux-conventions.md)).

**No other route reaches a profile.** There is no `/profile/[userId]`, no `?user=`, and no route
segment anywhere in `src/app` naming another user's record. `SC-004` is proved by a structural test
over the route tree, not by a permission check on a route that should not exist (`FR-002`).

---

## What renders

Nine values in one column, in the order §3.12's table gives them.

| # | Value | Kind | Empty presentation |
| --- | --- | --- | --- |
| 1 | Avatar | editable — a URL text field, never an upload (`FR-010`) | the display name alone — also when the image fails to load (`FR-012b`) |
| 2 | First name | editable, **required**, trimmed (`FR-007`) | cannot be empty |
| 3 | Last name | editable, **required**, trimmed (`FR-007`) | cannot be empty |
| 4 | Job title | editable, optional, free text (`FR-008`) | "Add a job title" (`FR-012b`) |
| 5 | Slack handle | editable, optional, no format rule (`FR-008`) | "Add a Slack handle" (`FR-012b`) |
| 6 | Phone | editable, optional, no format rule (`FR-008`) | "Add a phone number" (`FR-012b`) |
| 7 | Bio | editable, optional, multi-line, at least three rows, grows with content, no maximum (`FR-009`) | "Add a bio" (`FR-012b`) |
| 8 | Email | **shown, not a control** (`FR-024`, `OT-UX-010`) | never empty |
| 9 | Account role | **shown, not a control** (`FR-024`, `OT-UX-010`) | never empty |

**An empty line is the control.** Each of the four placeholder lines is itself the `Button` that
opens the field, so an empty optional field is reachable by the same press and the same Tab stop as a
filled one (`FR-012b`, `SC-012`).

**The bio's line breaks survive to the rendered output.** A stored newline renders as a line break —
the shown value preserves them rather than collapsing to one line — and this is presentation, not
parsing: still no markup of any kind (`FR-009`).

Plus one link: **Change password** ([`change-password-link.md`](./change-password-link.md)), which
shows in-flight state on itself while the request is out (`FR-026`).

**The bio is characters, not markup.** Stored as typed and rendered as text. No markdown is parsed
and no HTML is interpreted — `OT-DATA-016` puts profile bios in the same class as comment bodies, and
`FR-009` says so directly. React's own escaping is what makes this true; nothing in this feature
builds an HTML string and `dangerouslySetInnerHTML` never appears.

**A display name is first and last joined by one space**, wherever this screen renders one
(`FR-004`, `OT-UX-019`). The rule is R2's `src/features/shell/display-name.ts`, and this screen is
its second caller — the point at which Principle I makes promotion legitimate, and which R2's own plan
anticipates by name. This entry imports it from `src/lib/display-name.ts` if R3 has already moved it
there, and moves it there itself otherwise. The rule has one implementation either way; only its
address is in question.

---

## In-place editing

The same behaviour on every one of the seven, and the same behaviour every other surface in this
product will offer (`FR-013`, `OT-UX-009`, §3.4, §3.8).

| Interaction | Result |
| --- | --- |
| Press the value | it becomes a field carrying the current value, focused |
| `Escape` | the previous value returns; **nothing is written** |
| Blur | a changed value is written; an unchanged one is not |
| `⌘`/`Ctrl` + `Enter` | the same write, without waiting for focus to move |
| `Enter`, plain | a line break in the bio; **nothing** in the six single-line fields (`FR-013a`) |
| Any of the three | the control returns to its shown state, and focus returns to the control the field replaced (`FR-013a`) |

**The three gestures are the whole set** (`FR-013a`). A fourth save gesture would make this screen
behave differently from every other surface offering in-place editing, which is the one thing
`FR-013` forbids by name. Focus returning to the affordance is what keeps `SC-012` true: no gesture
leaves focus on an element that has just been removed.

**There is no edit mode, no form and no submit button** (`FR-013`). Each save is exactly one
`updateOwnProfile` call carrying one field name and one value; two fields edited in succession make
two independent calls, and neither carries the other's value.

**The affordance is a React Aria `Button`, and the field is a React Aria `TextField`.** No `div`
carries a click handler and no element is given a `role` to make it behave like a control
(`FR-035`, `OT-UX-018`, AGENTS.md). `onPress`, not `onClick`. Interaction state is styled through
`data-hovered`, `data-pressed` and `data-focus-visible`, which the token set in `globals.css` already
gives a single focus rule.

**Every field carries an accessible name and its error text is associated with it** — `Label` and
`FieldError` from React Aria, never a colour alone (`FR-035`, `SC-012`).

### Optimistic, and rolled back

| | |
| --- | --- |
| On save | the new value renders immediately, before the server answers (`FR-014`, US1 scenario 6) |
| On acceptance | the server's value replaces it; nothing flickers |
| On refusal | the value the server holds returns, and a message names what failed and why (`FR-014`, `FR-015`, `OT-UX-008`, `OT-UX-016`) |
| Scope of a rollback | **only the field that failed.** A second field mid-edit is untouched (`FR-015`) |
| Two saves in succession | dispatched and awaited one at a time, so their answers cannot arrive out of order ([`../research.md`](../research.md) B-3) |
| A re-query landing mid-edit | the edit in progress wins and is left alone; the arriving value is what the field returns to when the edit ends (spec edge case) |

Each field owns its own optimistic value, which is what makes the last row structural rather than a
rule to remember ([`../research.md`](../research.md) B-1, B-3).

### Validation, as the field is left

| | |
| --- | --- |
| When | per field, as the field is left. Never a wall of errors on a submit — there is no submit (`FR-017`, `OT-UX-011`) |
| Where | inline, on the field that failed |
| What stays usable | everything. No control on this screen goes dead in response to an invalid value (`FR-017`) |
| Who decides | the server, always. The browser may check the same things first; it is never the control (`FR-020`, Principle II) |

---

## Shown values are not controls

Email and account role render the way an immutable field renders everywhere else in this product —
the project key, the issue key, an issue's project (`FR-024`, `OT-UX-010`, §3.8, §3.4).

- Neither is a `Button`, a field, or anything that responds to a press — neither is focusable and neither enters the tab order (`FR-035`).
- Each carries a visible label programmatically associated with its value, so a screen reader reads the pair rather than a bare string (`FR-035`).
- Neither becomes editable under any interaction available on this screen (`SC-006`).
- Both render identically for a member and for an admin; only the role's value differs (US3 scenario 5).
- No path on this screen sets a role. Role changes stay CLI-only in v1 (`FR-025`, `OT-AUTHZ-011`).

---

## Loading

`ProfileSkeleton` renders the same block structure as `ProfileScreen`: the same rows, at the same
heights, in the same order — the bio's three-row minimum included, so data landing shifts nothing. Never a full-screen spinner, and data landing shifts nothing
(`FR-031`, `OT-UX-005`). It is authored here, for this layout, and is not shared — a skeleton matches
the layout it replaces, so there is nothing to inherit and nothing to extract
([`ux-conventions.md`](./ux-conventions.md)).

---

## Components

| Module | Boundary | Why it exists |
| --- | --- | --- |
| `src/app/(app)/profile/page.tsx` | async Server Component | guard, query, header, `Suspense` — and nothing else, so every assertion lands on a component a test can render ([`../research.md`](../research.md) A-4) |
| `src/features/profile/components/profile-screen.tsx` | synchronous Server Component | the nine values in order; takes `ProfileRecord` |
| `src/features/profile/components/profile-skeleton.tsx` | synchronous | `FR-031` |
| `src/features/profile/components/editable-field.tsx` | `"use client"` | the seven fields' one control — press, edit, Escape, blur, ⌘-enter, optimistic save |
| `src/features/profile/components/shown-value.tsx` | synchronous | email and role, `FR-024` |
| `src/features/profile/components/change-password-link.tsx` | `"use client"` | the press, `FR-026` |
| `src/features/profile/fields.ts` | shared | the seven names, labels and bounds — one place `FR-006` can be checked |

`editable-field.tsx` stays inside this feature. Seven call sites live here today and none live
anywhere else; R5's project details and R6's issue detail are where `OT-UX-009`'s convention earns a
second surface, and that is where the promotion to `src/components/ui` belongs (Principle I).
