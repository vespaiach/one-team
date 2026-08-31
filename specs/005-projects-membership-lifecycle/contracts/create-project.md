# Contract — Create project, `/projects/new`

**Plan**: [`../plan.md`](../plan.md) · **Spec** §3.7 · **Mutator**: [`mutators.md`](./mutators.md) → `createProject`

A full page, not a modal (`FR-022`, §3.7). R2 registers the route with its admin guard; this feature
fills it. A signed-in non-admin gets Forbidden at this URL; an unauthenticated caller is redirected
to `/signin` and never sees Forbidden (`FR-023`, `OT-SEC-015`).

---

## Composition

```text
app/(app)/projects/new/page.tsx          async — requireActor, isAdmin or forbidden()
└── CreateProjectForm                    "use client" — useActionState(createProject)
    ├── TextField                        inline — required, trimmed, autoFocus     FR-024
    ├── ProjectKeyField                  project-key-field.tsx                     FR-025, FR-026
    ├── TextArea                         inline — grows, then scrolls; no preview  FR-027
    ├── DateRangeFields                  date-range-fields.tsx                     FR-028
    ├── PaletteField                     palette-field.tsx                         FR-029
    ├── MemberPickerField                member-picker-field.tsx                   FR-030
    └── Create / Cancel                  inline — in-flight, never disabled        FR-032, FR-033
```

**Four children are files and three are inline JSX**, and the split is Principle I's. The key field,
the date pair, the palette and the member picker each carry behaviour worth its own test file — a
derive/own rule, a cross-field comparison, a seven-way radio group, a combo box feeding a tag group.
The name, the description and the button pair are one React Aria control each with no logic above
them, so extracting them would be an abstraction at its first call site. They are asserted on
`CreateProjectForm`'s own test rather than on files of their own; `FR-024`'s trimming and focus order
and `FR-027`'s growth, scrolling and absent preview are that test's, not a missing component's.

The page is async and thin; every assertion lands on `CreateProjectForm` or below, which is
synchronous under jsdom ([`../research.md`](../research.md) D-1).

---

## Fields

| Field | Behaviour | Requirement |
| --- | --- | --- |
| **Name** | required, trimmed, first and focused | `FR-024` |
| **Project key** | derived, then owned; uppercased as typed; checked as typed and on submit | `FR-025`, `FR-026` |
| **Description** | optional, multi-line, grows, markdown source | `FR-027`, `FR-010` |
| **Start date** | optional | `FR-028` |
| **Target date** | optional, independent, must not precede start | `FR-028` |
| **Colour** | required, seven swatches, defaults to accent | `FR-029`, `OT-DATA-013` |
| **Members** | optional chips from existing accounts | `FR-030`, `OT-AUTHZ-006` |

**Not on this form**: status and columns (`FR-031`).

---

## The key field, in full

Three rules, and they are separate:

**1 · Derivation.** `deriveProjectKey(name)` — the first letter of each word, uppercased, truncated to
eight characters. `Website Redesign` → `WR`. `One Team Design Ops` → `OTDO`. A name of more than
eight words truncates silently, because the field is still editable before submit (spec, *Edge Cases*).

**2 · Ownership.** The key follows the name until the user edits the key; after that the name never
touches it again. This is one boolean of field state, not a comparison against the derived value — a
user who happens to type exactly the derived value has still taken the field, and comparing values
would silently hand it back ([`../research.md`](../research.md) D-4).

**3 · Validity.** `^[A-Z][A-Z0-9]{0,7}$`. A derived value that is empty, or that fails the pattern —
`3D Redesign` derives `3R`, which does not — leaves the field **empty and required**, not filled with
something invalid (`FR-025`). Punctuation or digits alone derive nothing and behave identically
(spec, *Edge Cases*).

**Uniqueness** is checked twice. As typed, debounced, through `checkProjectKeyAvailable`; and again
on submit, by the `UNIQUE` constraint inside `createProject`. Either failure renders the same inline
error on the key field, naming the project that holds the key. **No suffix is ever applied**
(`FR-026`, `OT-UX-012`, `SC-004`).

A key that passes the as-typed check and is taken before submit is a normal sequence: the check is an
affordance and the constraint is the enforcement (spec, *Assumptions*; `SC-003`).

Case cannot collide — the field uppercases as typed and the pattern admits uppercase and digits only.

---

## The member picker

Reads existing accounts through R1's `publicUser` projection and R3's roster
([`../data-model.md`](../data-model.md) §5).

- **Excludes deactivated accounts** (`FR-030`, §3.9).
- **Excludes the creating admin** — admins are implicitly members of every project (§2, `FR-030`).
- **Offers no invitation path.** A person with no account is invited to the team first, on R3's
  Accounts screen, and added afterwards (`FR-030`, `OT-SCOPE-005`).

Each chosen person becomes a `project_member` row **in the creating transaction** (`FR-030`,
`FR-034`), and the chips read chosen people — which on this screen is the same as reading membership
rows, since none exist yet (`FR-018`).

---

## Validation and submission

**Per field, on blur** (`FR-032`, `OT-UX-011`). Never a wall of errors on submit.

**Create stays enabled.** A missing name does not disable the control; the control submits and the
action returns `{ status: "invalid", field: "name" }`, which renders inline. `disabled={!isValid}` is
what `FR-032` forbids (US1 scenario 12).

**The write is not optimistic** (`FR-033`, `OT-UX-008`). `useActionState` gives the pending boolean
for the in-flight state, and the screen waits for the server rather than navigating optimistically
(US1 scenario 6).

**Exactly one `createProject` call** (`FR-034`), which writes the project, its five columns, its
counter row and its membership rows in one transaction.

**On success** the action redirects to `/projects/:projectKey` — the board route R10 fills. The
destination is fixed here and nothing answers at it yet (`FR-034`, spec → *Out of Scope*).

**Cancel returns to where the user came from and writes nothing** (`FR-034`, US1 scenario 15).

---

## What the tests assert, and where

| Scenario | Asserted against |
| --- | --- |
| `WR`, `OTDO`, `3R` → empty, >8 words truncated, punctuation-only → empty | `deriveProjectKey` — a pure function, no DOM |
| the key stops following the name once edited | `ProjectKeyField` under jsdom |
| the clash names the holder and applies no suffix | `ProjectKeyField` with a stubbed check; and `createProject` against real PostgreSQL |
| five columns, their order, kinds and colours | `createProject` against real PostgreSQL |
| the counter row exists and holds `0` | same |
| three chips → three membership rows, none the creating admin | same |
| two concurrent creations of one key | two transactions, real PostgreSQL (`SC-003`) |
| target before start | `createProject`, and the table `CHECK` |
| non-admin → Forbidden, unauthenticated → `/signin` | the route's guard, R2's interrupt |
