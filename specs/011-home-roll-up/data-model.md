# Phase 1 data model: Home roll-up (R12)

**This feature adds no table, no column, no constraint, no index and no migration.**
`src/db/schema.ts`, `src/db/tables.ts`, `drizzle.config.ts` and every file under `drizzle/` are
untouched (FR-004, [`research.md`](./research.md) A-2). What follows is therefore not a schema change
but a **read model**: which shipped columns each surface reads, and the DTO each query returns.

---

## 1. Tables read, and the columns each surface needs

| Table (owner) | Columns read | Read by |
| --- | --- | --- |
| `user` (R1) | `first_name`, `last_name` via `displayName`; `publicUser`'s projection for every actor name | greeting (FR-005), **Mentions**, **Recent activity** |
| `notification` (R11) | `user_id`, `read_at` for the count; `id`, `type`, `actor_id`, `issue_id`, `project_id`, `comment_id`, `read_at`, `created_at` for the rows | unread card (FR-009), **Mentions** (FR-021…FR-027) |
| `issue` (R6) | `id`, `number`, `title`, `assignee_id`, `due_date`, `project_id`, `column_id`, `created_at` | assigned card, due-this-week card, **Assigned to you**, **Your projects**' counts, **Recent activity**'s targets |
| `board_column` (R5, R9) | `kind`, `project_id`, `id` | **Your projects**' progress numerator and excluded set (FR-017, FR-020) |
| `project` (R5) | `id`, `key`, `name`, `status` | **Your projects** (FR-014, FR-016), and the project label on every cross-project row |
| `project_member` (R5) | `project_id`, `user_id` | **Your projects**' membership **list** (FR-015) |
| `activity` (R7) | `id`, `actor_id`, `type`, `issue_id`, `project_id`, `field`, `from_value`, `to_value`, `created_at` | **Recent activity** (FR-028…FR-031) |
| `comment` (R7) | `id`, `author_id`, `issue_id`, `project_id`, `created_at` | **Recent activity** |

**Columns deliberately not read.** `user.feed_filter` (FR-032) · `user.email`, `slack_handle`,
`phone`, `bio` — outside `publicUser`, and FR-037 confines every actor to the shared public projection
· `notification.emailed_at` and `send_attempts` — R11's delivery state reaches no surface ·
`comment.body` (E-3) · `issue.description`, `priority`, `sort_order` · `project.description`,
`start_date`, `target_date`.

---

## 2. The read boundary

`notification` is the system's one row-level read rule (`OT-AUTHZ-003`) and it binds both surfaces
that touch it. Every other table on this page is readable by every signed-in user (`OT-AUTHZ-002`), so
**Recent activity** and **Assigned to you** carry no membership predicate and no project-status
predicate at all (FR-012, FR-014, FR-034).

| Surface | Scope | Where the scope comes from |
| --- | --- | --- |
| unread card | `notification.user_id = actor.id` | the session, via `requireActor()` |
| **Mentions** | `notification.user_id = actor.id and notification.type = 'mention'` | the session |
| **Assigned to you** | `issue.assignee_id = actor.id` | the session — a preference of the *viewer*, not a permission |
| **Your projects** | `project_member.user_id = actor.id and project.status = 'active'` | the session; the only status filter on the page |
| **Recent activity** | none | `OT-AUTHZ-002`; every signed-in user reads everything (FR-034, US4 s5) |

**No function in this feature accepts a user id from anything the client sends.** The four queries
that take one take it from `requireActor()`'s return value and from nowhere else, and the page
component declares no `searchParams` (FR-027, FR-035, SC-007, [`research.md`](./research.md) D-4).

---

## 3. DTOs

Row types are defined at the boundary; no `$inferSelect` row is handed to a component
(`AGENTS.md`, TypeScript).

### 3.1 `AssignedIssueRow` — `src/features/home/server/assigned-queries.ts`

```ts
type AssignedIssueRow = {
  id: string;
  key: string;          // formatIssueKey(projectKey, number) — "WEB-142"      FR-011
  title: string;
  projectName: string;  // the section spans projects; a key alone is not enough  FR-011
  href: string;         // /projects/<KEY>/issues/<number>/details               FR-013
  dueThisWeek: boolean; // computed by PostgreSQL, never by the browser          FR-008
};
```

`dueThisWeek` is the only derived field and it is derived **in SQL**:
`due_date between current_date and current_date + 6`. A null `due_date` and an overdue `due_date` both
yield `false` ([`research.md`](./research.md) B-1). The DTO carries no `due_date`, because no surface
renders the date itself.

### 3.2 `ProjectProgressRow` — `src/features/home/server/project-queries.ts`

```ts
type ProjectProgressRow = {
  key: string;
  name: string;
  status: "active";     // the query filters to it; the field is rendered   FR-016
  href: string;         // /projects/<KEY>
  done: number;         // issues in a done-kind column                     FR-017
  counted: number;      // total issues minus those in a canceled-kind column
};
```

The percentage is **not** a field. It is `progressPercent(done, counted)`, a pure function in
`src/features/home/progress.ts`:

| `done` | `counted` | result | rule |
| --- | --- | --- | --- |
| 3 | 8 | `38` | nearest whole number, halves up (FR-019, US2 s1) |
| 0 | 0 | `0` | zero denominator (FR-018, US2 s2, s3) |
| 199 | 200 | `99` | rounding may not reach 100 while one counted issue is open (FR-019, US2 s6) |
| 200 | 200 | `100` | a complete project reads 100 — the clamp must not fire (*Edge Cases*) |
| 0 | 5 | `0` | no clamp at the bottom |

### 3.3 `NotificationListItem` — reused verbatim from R11

`listRecentMentions(userId, limit)` returns R11's existing
`NotificationListItem` — `{ id, type, actorName, targetLabel, href, isUnread, createdAt }` — built by
the same private `composeHref` / `composeTargetLabel` helpers, so the Home row and the Notifications
row are the same row (FR-024, FR-025, [`research.md`](./research.md) C-1). `href` carries the
`#comment-<id>` anchor whenever the notification carries a `comment_id`; `isUnread` is `readAt === null`
and **is never written from this page** (FR-026).

### 3.4 `InstallationActivityRow` — `src/features/home/server/activity-queries.ts`

```ts
type InstallationActivityRow = {
  id: string;
  kind: "comment" | ActivityType;   // ActivityType minus "comment"        FR-029
  actor: PublicUser;                // the shared public projection only   FR-037
  targetLabel: string;              // "WEB-142 · Fix the header" or the project's name
  projectName: string;              // named on every row; the section spans projects  FR-030
  href: string;
  createdAt: Date;
  field: string | null;
  fromValue: string | null;
  toValue: string | null;
};
```

`kind` is `"comment"` only for rows drawn from the `comment` table; the `activity` row of type
`comment` that `createComment` writes alongside it is excluded by the query
([`research.md`](./research.md) B-5). `field`, `fromValue` and `toValue` are `null` on a comment row
and feed R7's `ActivityRow` on the others.

---

## 4. The four queries, as SQL shapes

Written as shapes rather than as code; the exact Drizzle expressions are the implementation's.

**`listAssignedIssues(userId)`** — one statement.
`issue` inner join `project` on `issue.project_id`; `where issue.assignee_id = $1`;
`order by issue.created_at desc, issue.id desc`; **no** limit (FR-010), **no** column-kind filter
(US1 s5), **no** project-status filter (*Edge Cases*). Selects
`due_date between current_date and current_date + 6` as `due_this_week`.

**`listMemberProjectsWithProgress(userId)`** — one statement.
`project_member` inner join `project` (`status = 'active'`) left join `issue` on `issue.project_id`
left join `board_column` on `issue.column_id`; `where project_member.user_id = $1`;
`group by project.id`; `count(*) filter (where board_column.kind = 'done')` and
`count(*) filter (where board_column.kind <> 'canceled')`; `order by lower(project.name), project.key`.
The left joins are what make a project with no issues return `0 / 0` rather than no row at all
(US2 s2).

**`listRecentMentions(userId, limit)`** — one statement, R11's module.
`notification` inner join actor `user`, left join `issue`, left join `project` on
`coalesce(notification.project_id, issue.project_id)`;
`where notification.user_id = $1 and notification.type = 'mention'`;
`order by notification.created_at desc, notification.id desc`; `limit $2` (5).

**`listInstallationActivity(limit)`** — one union, then one actor hydration.
`comment` rows `union all` `activity` rows `where type <> 'comment'`;
`order by created_at desc, id desc`; `limit $1` (20); then a second statement selecting `publicUser`
for the distinct actor ids and a third resolving the distinct issue and project targets — the same
three-step shape `listFeed` already uses, so the union stays a union and the join fan-out stays out of
the `LIMIT`.

---

## 5. State transitions

**None.** No row this feature reads changes state because of anything this feature does. The one state
a reader might expect to change — a notification's `read_at` when its Home row is activated — is
explicitly required *not* to (FR-026, SC-006), and no code path in this feature can write it.
