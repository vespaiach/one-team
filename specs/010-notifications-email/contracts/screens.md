# Contract — the Notifications screen and the sidebar's unread count

**Feature**: R11 · **Spec**: [`spec.md`](../spec.md) · **Research**: [`research.md`](../research.md)

Screen 6 of §3's table, at `/notifications`, replacing the route that answers "This doesn't exist"
today. Plus one number in R2's sidebar. **No second notifications route, no notifications modal, no
responsive layout and no mobile breakpoint** (FR-010, FR-023).

---

## 1. The route

`src/app/(app)/notifications/page.tsx` — **EDIT**, replacing:

```tsx
export default async function NotificationsPage() {
  await requireActor();
  notFound();                     // ← the placeholder R2 registered
}
```

with the shape `src/app/(app)/settings/labels/page.tsx` already uses:

```tsx
export default async function NotificationsPage() {
  const actor = await requireActor();                       // FR-019
  const unreadCount = await countUnreadNotifications(actor.id);   // FR-021 needs it here
  return (
    <>
      <ScreenHeader
        name="Notifications"
        control={<MarkAllReadControl unreadCount={unreadCount} …/>}
      />
      <Suspense fallback={<NotificationsSkeleton />}>
        <NotificationsList … />
      </Suspense>
    </>
  );
}
```

| Requirement | How |
| --- | --- |
| FR-019 — an unauthenticated request redirects to sign-in and reaches neither the screen nor Forbidden | `requireActor()` redirects to `/signin`; there is no `forbidden()` on this route |
| FR-020 — renders inside R2's shell, "Mark all read" in the header's single per-screen control slot | `ScreenHeader`'s existing `control?: ReactNode` |
| FR-020 — the **New issue** slot stays empty: this is not a project-scoped route | `newIssue` is not passed; `ScreenHeader` renders the slot only when it is |
| FR-017 — a skeleton matching the row layout, never a full-screen spinner, no layout shift | the `Suspense` boundary and `NotificationsSkeleton` |
| FR-018 — a revisited screen re-queries and renders nothing from a client cache | no `fetch`, no `revalidate` export, no client-side store; the page is dynamic |
| FR-022 — no page control, no infinite scroll | **no `searchParams` are read at all** |
| FR-010 — no second route, no modal | one `page.tsx` |

**The unread count is awaited before the header renders**, outside the Suspense boundary, because
FR-021 requires "Mark all read" to render *disabled with its reason inline* when there is nothing to
clear — the control cannot render without knowing. It is one count over the partial unread index. The
list, which is the expensive read, still streams behind the skeleton.

---

## 2. Server queries

`src/features/notifications/server/notification-queries.ts` (`import "server-only"`)

```ts
export async function listNotifications(userId: string): Promise<NotificationListItem[]>;
export async function countUnreadNotifications(userId: string): Promise<number>;
```

### `listNotifications`

```sql
SELECT … FROM notification
  JOIN "user"  actor ON actor.id = notification.actor_id
  LEFT JOIN issue   ON issue.id   = notification.issue_id
  LEFT JOIN project ON project.id = COALESCE(notification.project_id, issue.project_id)
 WHERE notification.user_id = $userId
 ORDER BY notification.created_at DESC, notification.id DESC
 LIMIT 200
```

| Requirement | How |
| --- | --- |
| FR-011, FR-024, SC-001 — the caller's own rows and nobody else's | `user_id = $userId`, the system's one row-level read rule |
| FR-011 — reverse-chronological | `created_at DESC`, tie-broken by `id DESC` — ids are UUIDv7, so the tie-break agrees with the timestamp and makes the order total |
| FR-022 — at most the 200 most recent, nothing paged, nothing deleted | `LIMIT 200`, no cursor, no offset, no `DELETE` |
| Story 1 sc. 10 — a deactivated or removed actor still renders | the join reads `deactivated_at` for nothing |
| FR-073 — `send_attempts`, `emailed_at` and `user.email` are not selected | they are not in the projection |

Maps to `NotificationListItem` ([`data-model.md`](../data-model.md) §3), with `href` composed
server-side (§4 there) and `isUnread` = `read_at is null`.

### `countUnreadNotifications`

```sql
SELECT count(*) FROM notification WHERE user_id = $userId AND read_at IS NULL
```

**No `LIMIT`.** FR-033 is explicit that the count is not bounded by FR-022's 200-row list cap and may
exceed the number of unread rows the screen shows; SC-012 asserts exactly that. It rides the partial
unread index.

---

## 3. Components

All under `src/features/notifications/components/`. Principle I: each owns one concern, and nothing is
extracted to `src/components/shared` or `src/components/ui` — every one of these has a single call
site, and `src/components/ui/` is still not created.

| Component | Kind | Owns | Requirements |
| --- | --- | --- | --- |
| `notifications-list.tsx` | Server | the query, the empty line, the ordered list | FR-011, FR-016, FR-022 |
| `notification-row.tsx` | Client (`"use client"`) | one row: the link, the mark-read call, the dot, the type phrase, the target, the relative time | FR-012…FR-015, FR-025 |
| `mark-all-read-control.tsx` | Client | the header button, its disabled state and its inline reason | FR-021, FR-028, FR-036 |
| `notifications-skeleton.tsx` | Server | the loading shape | FR-017 |

### `notifications-list.tsx`

Renders a `<ul>` of rows, or — when the caller holds none — **one quiet line**, no illustration and no
empty-state marketing (FR-016, §4 *Empty*). The empty line is the whole empty state.

### `notification-row.tsx`

A `next/link` anchor whose `onNavigate` fires the mutator:

```tsx
<Link
  href={item.href}
  onNavigate={() => { markNotificationRead({ notificationId: item.id }).catch(() => undefined); }}>
  …
</Link>
```

| Requirement | How |
| --- | --- |
| FR-014, FR-025 — one gesture opens the target **and** marks it read | the anchor navigates; `onNavigate` fires the action |
| FR-025 — a failed write blocks nothing, raises no toast, leaves the row unread | the call is **not awaited** and its rejection is swallowed; `showToast` is not imported by this component at all |
| FR-014 — a row carrying a comment lands on `#comment-<id>`, not the top of the page | the anchor's `href` carries the fragment R7 emits |
| FR-015 — an issue row opens the issue's detail page, a project row the project's details page | `href`, composed server-side |
| FR-013 — *mentioned you* / *assigned you* / *commented* | a three-way map on `item.type` |
| FR-012 — actor's display name, the issue or project, a relative time | `actorName`, `targetLabel`, `Intl.RelativeTimeFormat` |
| FR-012, SC-016 — the unread state is **not** colour alone | a visually-hidden "Unread" text node inside the link, so the accessible name carries it; the dot is decorative and `aria-hidden` |
| FR-074 — accessible name, visible focus indicator, keyboard operable | a native anchor: content is its name, `:focus-visible` is styled, `Enter` activates |

**Why `next/link` and not `react-aria-components`' `Link`.** React Aria's `Link` routes through a
`RouterProvider`, and this app installs none — `src/app/provider.tsx` has `I18nProvider` and nothing
else. Adding one is a change to R2's shell provider affecting every link in the app (gate 7). R2's own
`Sidebar` reaches the same conclusion for all five of its entries. An anchor is the element React
Aria's `Link` itself renders, and `onNavigate` is verified present on the pinned Next 16.3.2
(`next/dist/client/app-dir/link.d.ts:170`).

Relative time uses `Intl.RelativeTimeFormat` — a Web platform built-in, already used by
`src/features/activity/components/comment-row.tsx` (Principle IV: no dependency, and the second call
site is the formatter, not a shared module — the two render different rows and each owns four lines).

### `mark-all-read-control.tsx`

A `react-aria-components/Button` — this is a control, not a link, and R7 and R8 already use exactly
this for header actions.

| Requirement | How |
| --- | --- |
| FR-020 — occupies the header's one per-screen control slot | passed as `ScreenHeader`'s `control` |
| FR-028 — one call over the caller's own unread rows | one `markAllNotificationsRead()` |
| FR-021 — with nothing to clear it renders **disabled with its reason inline**, never hidden | `isDisabled={unreadCount === 0}` plus a visible reason beside it; `OT-UX-021` |
| FR-036, SC-012 — the sidebar count reads zero as part of the same interaction | the action's `refresh()`; no polling, socket or push in this component |
| FR-074 — accessible name, focus ring, keyboard | React Aria's `Button` |
| §4 *Slow write* | in-flight state on the button itself, blocking only itself |

### `notifications-skeleton.tsx`

Row-shaped pulse blocks matching the list layout, in the repo's established form
(`animate-pulse bg-(--color-divider)`, as `issue-skeletons.tsx` and `labels-skeleton.tsx` do). Never a
full-screen spinner; the shape must not shift when the data lands (FR-017).

---

## 4. The sidebar's unread count

Three files, each gaining one prop or one read. All three are R2's, and the edits are additive.

### `src/app/(app)/layout.tsx` — **EDIT**

```tsx
const projects = await listProjectsForSidebar();
const unreadNotificationCount = await countUnreadNotifications(actor.id);   // added
…
<AppShell … unreadNotificationCount={unreadNotificationCount}>
```

The layout already loads the actor and the sidebar's projects; the count joins them. Because it is the
shared `(app)` layout, FR-033's "on every authenticated screen" is satisfied by placement.

### `src/features/shell/components/app-shell.tsx` — **EDIT**

One prop added and forwarded to `Sidebar`. `AppShell` renders nothing with it — the same pass-through
it already does for `projects`.

### `src/features/shell/components/sidebar.tsx` — **EDIT**

```tsx
<Link
  href="/notifications"
  aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : undefined}
  className={NAV_LINK_CLASSES}>
  Notifications
  {unreadCount > 0 ? <span aria-hidden="true">{unreadCount}</span> : null}
</Link>
```

| Requirement | How |
| --- | --- |
| FR-033 — the number of unread rows the signed-in user holds, on every authenticated screen | the shared layout's read |
| FR-033 — **not** bounded by the 200-row list cap | `countUnreadNotifications` has no `LIMIT` |
| FR-034 — nothing at zero: no count and no zero | the ternary, and no `aria-label` override at zero |
| FR-035 — scoped from the session, the caller's own rows only | `actor.id` from `loadActor()` |
| FR-035, SC-016 — the value is part of the entry's **accessible name**, not a visual badge alone | `aria-label` carries it; the badge is `aria-hidden` |
| FR-036, SC-012 — reaches zero in the same interaction that clears the rows | the mutators' `refresh()` |
| FR-036 — no polling, no socket, no live push | none is added; `setInterval` appears in this feature nowhere |
| Story 4 sc. 5 — two users each see only their own | the count is per-request from the session |

**The one thing to verify in implementation, not on paper.** `(app)/layout.tsx` is shared between
`/notifications` and every project and issue route, so a client-side soft navigation does not by
itself re-render it — which is why `markNotificationRead` calls `refresh()` too, and not only
`markAllNotificationsRead`. The task list carries an explicit test: activate a row, assert the sidebar
count dropped, with no navigation and no reload in between. If `refresh()` proves insufficient in the
presence of a simultaneous navigation, `revalidatePath("/", "layout")` is the fallback — already
imported in `src/features/issues/actions.ts`, no new dependency, no design change.

---

## 5. Files this feature does **not** touch in the shell

`screen-header.tsx` — its `control` and `newIssue` slots are used exactly as R2 delivered them ·
`toast-region.tsx` / `showToast` — **this feature raises no toast at all**, which FR-025 requires for
the mark-read failure and which no other write here has a refusal path for · `connection-banner.tsx`,
`user-chip.tsx`, `project-list-region.tsx`, `not-found-notice.tsx`, `forbidden-notice.tsx` ·
`src/app/provider.tsx` (no `RouterProvider` is added — §3) · `src/app/(app)/home/page.tsx`, which is
R12's and reads this table under the same own-`user_id` rule when it lands · every other screen in the
app.

---

## 6. Explicitly out of scope on this screen

Named so no task claims them: per-row mark-read controls beside the row's own activation (FR-025 —
"the only surface `markNotificationRead` has") · an unread toggle, a mark-unread control, and any
edit or delete of a notification (*Out of Scope*; FR-032) · search, filtering, grouping or sorting of
the list (*Out of Scope*; §1) · a page control, a "load more" and infinite scroll (FR-022) · any
notification preference, mute or per-project subscription · Home's unread stat card and its Mentions
list, both R12's · a mobile or responsive layout (FR-023, `OT-SCOPE-004`) · any colour-only state
(§7, *Palette*; FR-012).
