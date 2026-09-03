# Phase 1 — Quickstart validation

**Plan**: [`plan.md`](./plan.md) · **Spec**: [`spec.md`](./spec.md) · **Contracts**: [`contracts/`](./contracts/)

Twelve walkthroughs that prove R5 end to end. Each names the requirements and success criteria it
settles. They are a validation guide, not an implementation guide — the code belongs in `tasks.md`.

---

## Prerequisite: entries R2 and R3 are implemented

R5 is planned in full and `/speckit-tasks` can be run against this plan, but **it cannot be walked
through until R2 and R3 land**. At the time of writing only R1 is built.

What these walkthroughs need and do not yet exist:

| | Owner |
| --- | --- |
| the `(app)` route group, its shell and sidebar, the `+` beside the project list | R2 |
| the Forbidden screen, and `/projects/new` and `/projects/:projectKey/details` registered with their guards | R2 |
| the "This doesn't exist" notice, and the disabled-control-with-inline-reason convention | R2 |
| the toast that names a rejected write | R3 or R4, whichever is built first |
| a second account for the member and non-member roles below | R3 |

Until then, everything under *The gate* still runs: the schema, the constraints, the six mutators and
the markdown renderer are all testable without a screen.

---

## Setup

```bash
docker compose up -d
```

```bash
npm run db:migrate
```

```bash
npm run dev
```

Seed the first admin as R1 specifies, then create a second account through R3's Accounts screen — one
plain member — and sign in as each in a separate browser profile. Three roles appear below: **admin**,
**project member**, and **non-member** (a signed-in account holding no row in the project).

---

## 1 · A project comes into being from a name alone · `FR-024`, `FR-025`, `FR-034`, `SC-001`

As the admin, open the sidebar's `+` beside Projects, land on `/projects/new`, type
`Website Redesign` into Name, and touch nothing else.

**Expect**: the key field shows `WR` as you type. Create is submittable. Pressing it shows in-flight
state on the button, the screen waits rather than navigating optimistically, and the browser lands on
`/projects/WR`.

Repeat with `One Team Design Ops` → the key shows `OTDO`. Repeat with `3D Redesign` → the key field is
**empty and reports that a key is required**, because `3R` fails the pattern.

---

## 2 · What a create actually wrote · `FR-007`, `FR-008`, `FR-030`, `SC-002`

Open `npm run db:studio` against the project created above.

**Expect**: one `project` row, `status = 'active'`. Exactly five `board_column`
rows — Backlog, Todo, In Progress, Done, Canceled, in that `sort_order` — with kinds
`open, open, open, done, canceled`. One `issue_counter` row
for the project with `last_number = 0`. No `created_at` or `updated_at` column on that table at all.

Create a second project with three member chips: **expect** three `project_member` rows, and the
creating admin among none of them.

---

## 3 · The key is decided by the database, and the clash is named · `FR-026`, `SC-003`, `SC-004`

Type `WR` into the key field of a new create form. **Expect** an inline error on the key field naming
*Website Redesign*, and no suffix anywhere.

Then, for the concurrent case, run the two-transaction test rather than the browser:

```bash
npx vitest run -t "two concurrent creations of the same key"
```

**Expect**: exactly one commits; the other reports the holder by name.

---

## 4 · Everyone reads, members write · `FR-017`, `FR-036`, `FR-038`, `SC-006`, `SC-015`

Open `/projects/WR/details` as all three roles.

**Expect**, for every one of them: the whole record renders — key, name, description, status, dates,
columns and members — with no membership check on the read.

As the **member**: click the name. It becomes a field in place, with no edit mode and no separate
form. Escape returns the previous value and writes nothing. Change it and blur: the new value appears
immediately and exactly one `updateProject` call goes out.

As the **non-member**: every record field is visible, not clickable, and carries an inline reason
naming the project they would need to be added to. No control on the page is dead, and none is hidden
for a permission reason.

---

## 5 · The key cannot be changed by anyone · `FR-037`, `SC-005`, `OT-INV-007`

As the admin, look at the key on project details.

**Expect**: it renders as a shown value rather than a control, and the screen says it is immutable.
There is no route that changes it — `updateProject`'s input carries no `key` field.

---

## 6 · The dates hold each other, on the server · `FR-028`

As a member, set a start date, then set a target date **earlier** than it.

**Expect**: an inline error on the target field, and the previous value standing. Then set a start
date **later** than an already-saved target: the same refusal, from the same rule.

Both are refused by the server, not by the field alone:

```bash
npx vitest run -t "refuses a target date before the start date"
```

---

## 7 · A description is markdown, and only the subset · `FR-010`, `FR-011`, `FR-039`

Put this in a description and save it:

```text
# Heading
**bold** *italic* `code` [ok](https://example.com) [no](javascript:alert(1))
- one
- two

| a | b |
<script>alert(1)</script>
```

**Expect**: the heading, the bold, the italic, the inline code and the bullet list render. `ok` is a
link; `no` renders as the text `no`. The table row renders as its own literal text. The `<script>`
tag is shown as text and is not interpreted.

Then click the description to edit it: **expect** the raw markdown source in the field, not the
rendered form.

---

## 8 · Membership is the write boundary and nothing else · `FR-019`, `FR-045`, `FR-046`, `SC-007`, `SC-008`

As the admin on the Members section, open Add member.

**Expect**: accounts that exist, deactivated accounts absent, people already on the roster absent, and
no route to invite anyone from here.

Add the non-member. Without signing out, have them edit the project name in their own browser:
**expect** it saves, on their very next request.

Remove them. **Expect**: their next write is refused, and every row they authored survives.

Remove the roster's last remaining member. **Expect**: it succeeds, with no guardrail and no
confirmation, and the project stays writable by every admin.

Look at the roster as an admin who was never explicitly added. **Expect**: they are absent from it,
and can still write in the project.

---

## 9 · Archiving is the only lifecycle act, and it changes nothing else · `FR-042`, `FR-043`, `SC-009`

As the admin, flip Status to archived and back.

**Expect**: both directions succeed with no confirmation. No column, membership or issue is touched —
compare the tables before and after in `db:studio`; the only difference is `project.status` and
`project.updated_at`.

As a member: **expect** the switch shows the current state, is disabled, and carries its reason.

---

## 10 · Delete is archived-only, states its size, and leaves nothing · `FR-047`, `FR-048`, `SC-010`…`SC-012`

On an **active** project as the admin: **expect** Delete disabled with a reason stating the project
must be archived first. Call the mutator directly with the control bypassed — **expect** it refuses.

Archive it, then press Delete. **Expect** a confirmation stating the size of what will be destroyed:
the count of board columns plus membership rows.

Confirm. **Expect**: the project, its five columns, its memberships and its counter row are all gone
together, the browser navigates away, and creating a new project with the same key succeeds
immediately.

For the race:

```bash
npx vitest run -t "observes the archived status inside its own transaction"
```

---

## 11 · The sidebar is the same for everyone · `FR-053`…`FR-055`, `SC-013`

Create projects named `Zephyr`, `atlas` and `Beacon`, all active, and archive a fourth.

**Expect**, identically for the admin, the member and the non-member: *atlas, Beacon, Zephyr*, then
the archived one, dimmed. Rename one to sort differently and it moves with no other action. Every
project is listed for every role.

On an installation with no projects: **expect** one quiet line in the project region, not an
illustration.

---

## 12 · Every project screen knows where it is · `FR-056`

Open project details.

**Expect**: the header carries the project's name, and the Board and Details tab pair,
with Details marked current. Pressing Board goes to `/projects/:projectKey` — R10's route, which
answers nothing yet.

---

## The gate

```bash
npm run verify
```

`style-check`, then `type-check`, then `test`, then `build` — what CI runs, and nothing else.

`npm test` runs with `--passWithNoTests`, so a green run is not by itself evidence that a test was
written first (gate 1). The evidence is the commit order in `tasks.md`.

The database tests need a real PostgreSQL instance on a separate database:

```bash
TEST_DATABASE_URL=postgres://…/one_team_test npm test
```

Never point it at development, staging or production data.
