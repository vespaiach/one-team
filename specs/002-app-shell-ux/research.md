# Phase 0 — Outline & research

**Plan**: [`plan.md`](./plan.md) · **Spec**: [`spec.md`](./spec.md) · **Parent**: [`docs/ROADMAP.md`](../../docs/ROADMAP.md) entry **R2**

Twenty-four decisions. Group **A** is the framework's own mechanics, because R2 is mostly a routing
and composition problem and Next.js 16 answers three of its requirements directly. Group **B** is the
frame itself. Group **C** is the one write. Group **D** is how change gate 1 is met on a feature made
almost entirely of Server Components.

Every framework claim below was checked against `node_modules/next/dist/docs/` for the pinned
16.3.2, or against the shipped source, as AGENTS.md requires. The file is named at each claim.

---

## A. Framework mechanics

### A-1. The `(app)` route group carries the shell; `/home` sits inside it and renders no header

**Decision.** One route group, `src/app/(app)/`, whose `layout.tsx` is the shell. `/home` lives
inside that group like every other authenticated route; what makes it headerless is that its page
renders no header, not that it sits somewhere else.

**Rationale.** R1's contract already reserves this name — "R2 adds `src/app/(app)/layout.tsx` as a
sibling for the 262px sidebar and header; the two groups cannot leak into each other, which is
`OT-UX-001` made structural" ([`auth-layout.md`](../001-identity-sessions-signin/contracts/auth-layout.md)).
A route group contributes no URL segment (`03-file-conventions/route-groups.md`), so the thirteen
routes of `FR-028` stay exactly the paths §3's screen table assigns.

**Alternatives rejected.** *A nested `(framed)` group whose layout renders the header, with `/home`
outside it.* This is the structural version of `FR-003`, and it cannot work: a layout cannot receive
the page's title, and the title block is per-screen by `FR-007`. The group would wrap a header that
had nothing to put in it. *Two root layouts.* Navigating between two root layouts forces a full
document load (`03-file-conventions/layout.md`), and `(auth)` and `(app)` already share the root
layout that resolves the locale.

### A-2. The header is composed by the page, not by the layout

**Decision.** `(app)/layout.tsx` owns the sidebar, the banner slot and the content region. Each
framed page renders `<ScreenHeader>` as its own first child. `/home` renders none, and that is
`FR-003`.

**Rationale.** Three requirements force it, and one framework fact permits nothing else.

- `FR-007` gives the header a per-screen title block and a per-screen control slot. Layouts cannot
  receive data from the page below them (`03-file-conventions/layout.md`, *Fetching Data*), so a
  layout-owned header would need the title routed to it some other way.
- `FR-019` requires the refusing route to render the header with **the Forbidden screen's own title**
  rather than the title of the screen that refused. A header owned by the layout would still be
  showing the refused screen's title when `forbidden.tsx` replaced the page beneath it — the exact
  thing `FR-019` forbids. A header owned by the page disappears with the page, and `forbidden.tsx`
  renders its own.
- `FR-002`'s persistence claim is about the sidebar — "position, width and entries unchanged" — and
  the header changes per screen by definition.

**Alternatives rejected.** *A parallel route slot, `(app)/@header/…`.* It is the only way to keep a
header in the layout with per-route content, and it costs a second, mirrored route tree for all
thirteen screens plus a `default.tsx` for every one of them — indirection every later entry pays for
(III), and it still gives Forbidden the wrong title. *A React context the page writes its title
into.* The layout renders before the page, so the context is empty when the header renders; the fix
is a client-side store, which is indirection standing in for a prop.

### A-3. Authorization runs in the page; the layout reads the actor for presentation only

**Decision.** `(app)/layout.tsx` calls `loadActor()` to render the chip, the banner slot and the
role-dependent entries. Every page under it calls `requireActor()` itself and applies its own
Access-column check. When `loadActor()` returns `null` the layout renders its `children` and no
frame.

**Rationale.** R1 fixes the rule and the reason: `loadActor()` is "called from pages, Server Actions
and route handlers. **Never from a layout** — layouts do not re-render on client-side navigation and
do not control whether the rest of the route renders, so a check placed there is not a check"
([`server-contracts.md`](../001-identity-sessions-signin/contracts/server-contracts.md)). Reading the
actor for presentation is not a check, and `FR-014` and `FR-015` say so in the spec's own words:
the client may evaluate the same predicates to decide what to show, and that evaluation is
presentation only.

The double read costs nothing: `loadActor()` is wrapped in React's `cache()`, so the layout and the
page share one query within a render pass (R1 research B-2).

The `null` branch is reachable — R1's `proxy.ts` redirects only when the cookie is **absent**, so a
cookie naming no live session reaches the layout — and it is unobservable, because the page's
`requireActor()` redirects and the layout's output is discarded. It is one line and it carries a
test (`AppShell` renders no sidebar without an actor), so it is a branch, not decoration (VI).

**Alternatives rejected.** *`requireActor()` in the layout.* It would remove the branch and
contradict an inherited contract in the same stroke, and a reviewer would reasonably read it as the
enforcement. *No actor in the layout at all.* Then the sidebar cannot render the chip or hide the
admin entries, and the sidebar is the layout's entire reason for existing.

### A-4. Forbidden is `forbidden()` with `(app)/forbidden.tsx`, and `experimental.authInterrupts` is turned on

**Decision.** A route that refuses calls `forbidden()` from `next/navigation`. `(app)/forbidden.tsx`
renders the screen, inside the shell. `next.config.ts` gains `experimental: { authInterrupts: true }`.

**Rationale.** This is the framework's own answer to §3.11, and it satisfies the requirement more
completely than anything written by hand:

| Requirement | How the built-in meets it |
| --- | --- |
| `FR-019` — rendered inside the shell, not a takeover | `forbidden.tsx` at the `(app)` segment renders inside `(app)/layout.tsx` (`04-functions/forbidden.md`) |
| `FR-020` — no route of its own, the URL is unchanged | `forbidden()` throws and terminates the segment; nothing navigates |
| §3.11 — "the error code" | Next returns a real `403` and injects `<meta name="robots" content="noindex">` |
| `FR-029` — authorization decided before existence | `forbidden()` throws, so a caller cannot forget to stop; a `return` can be forgotten |

The `403` is real rather than a streamed `200` only because the check runs at the top of the page
component with no `loading.tsx` above it (`04-functions/forbidden.md`, *Status codes*). **This is a
constraint on later entries**: a per-screen skeleton (`FR-032`) placed above one of these guards
turns the refusal into a `200`. R3 and R4 put their skeletons below the guard.

**Cost, recorded rather than hidden.** `forbidden()` is experimental and gated: the shipped source
throws `E488` unless `process.env.__NEXT_EXPERIMENTAL_AUTH_INTERRUPTS` is set
(`dist/client/components/forbidden.js`), which the config flag does. The flag is typed and
schema-validated in this exact release (`dist/server/config-shared.d.ts:1055`,
`dist/server/config-schema.js:456`), and `next` is pinned to `16.3.2` exactly, so the API cannot move
underneath the code without a deliberate upgrade. See Complexity Tracking in [`plan.md`](./plan.md).

**Alternative rejected.** *Return a `<ForbiddenScreen />` element from the page.* No experimental
flag, and it satisfies `FR-019` and `FR-020` as well. It forfeits the `403` status and the `noindex`
tag, and it makes the refusal a value every future route author must remember to `return` — on a
convention twelve entries inherit, an interrupt that cannot be forgotten is worth an experimental
flag on a pinned version.

### A-5. Not found is `notFound()` with two boundaries and one notice

**Decision.** Two files, one component. `(app)/not-found.tsx` catches `notFound()` thrown by any
route in the group and renders inside the shell. `src/app/not-found.tsx` answers URLs that match no
route at all and renders inside the root layout. Both render the same `NotFoundNotice`.

**Rationale.** `FR-022` and `SC-008` require one wording for a missing row and an unclaimed path;
Next.js reaches the two cases through two different boundaries — the root `not-found` "handles any
unmatched URLs for your whole application" while a segment-level one catches thrown calls
(`03-file-conventions/not-found.md`). One shared notice with two mounts is Principle I's second call
site arriving on day one, so the extraction is a fact rather than an anticipation.

The frames differ: the shell case keeps the sidebar, the unmatched-URL case cannot, because
`(app)/layout.tsx` is not in the tree of a path that matched nothing. `SC-008` asks for the same
**wording**, and gets it; and since everyone can read everything (§2), a reader learning that a path
is not one of the app's own is not learning about access.

**Alternative rejected.** *A catch-all `(app)/[...unclaimed]/page.tsx` so every unmatched path renders
inside the shell.* It would make the frames identical, and it would turn every unmatched path in the
installation into an authenticated route — a signed-out stranger typing a typo would be redirected to
`/signin` by a rule `OT-SEC-015` never asked for — and it leaves a dynamic segment in the tree that
every later entry has to reason about when adding a route.

### A-6. The undelivered screens ship as guard-only routes

**Decision.** Every route in `FR-028`'s table that this feature does not fill gets a `page.tsx`
whose whole body is: await the actor, apply the Access-column check, call the interrupt.

```text
requireActor()  →  admin check, when the Access column says admin  →  notFound()
```

**Rationale.** `FR-029` states it directly and `SC-014` measures it: a route whose screen has not
been delivered must still decide whether the caller may be there **before** it reports whether
anything is there. Without these files, all three admin-only routes in the surface — `/projects/new`
(R5), `/settings/accounts` (R3), `/settings/labels` (R8) — would answer nothing, Forbidden would have
no reachable caller, and `FR-019`, `FR-020` and four acceptance scenarios would ship untested on a
screen the roadmap lists inside R2.

These files look like placeholders and are not: each is the minimal implementation of `FR-029` for
its route, each carries a test, and each is replaced — not deleted — by the entry that fills it.

**What the guard can be, per route.** The Access column of §3's screen table, reduced to what exists
in this entry:

| Access in §3 | Guard R2 registers | The rest |
| --- | --- | --- |
| admin | `requireActor()` then the role check | complete |
| any signed-in user · read all · own only | `requireActor()` | complete |
| member | `requireActor()` | the membership half arrives with R5, which brings `project_member` |

`isMember` cannot be evaluated in this entry: neither `project` nor `project_member` exists until R5,
which is why the spec's own *Inherited constraints* say every visibility rule this feature can
exercise is the admin one. `SC-014` is scoped to **admin-only** routes for exactly this reason.

### A-7. A stale sidebar is the framework's behaviour, and the specification's own expectation

**Decision.** The sidebar lives in the layout and is re-rendered on every fresh document request.
On a client-side transition between two routes in the group it is reused, not re-rendered, and no
mechanism is added to defeat that.

**Rationale.** Two framework facts, checked: "Layouts are cached in the client during navigation…
Layouts do not rerender" (`03-file-conventions/layout.md`), and the client cache's `dynamic` stale
time — the page segment's — defaults to `0`, meaning the **page** is refetched on every navigation
while "shared layouts won't automatically be refetched"
(`05-config/01-next-config-js/staleTimes.md`). So the page's authorization check runs afresh on every
navigation, and only the sidebar's appearance can lag.

That is precisely the case the spec anticipates and answers. `FR-014` makes the route the
enforcement and the navigation never it; US3 scenario 7 is "a stale tab whose sidebar still shows an
entry the user's current role no longer permits" and its Then is that the route refuses. `FR-016`'s
"next render" is a statement about the server recomputing per request, which `OT-SEC-008` already
guarantees by caching nothing about identity anywhere — and §1 puts live push and real-time
collaboration out of scope, so a change made by someone else was never going to reach another
person's open tab in this product.

`OT-UX-006` (`FR-033`, "nothing renders from a client cache") is satisfied for pages by the `0`
default, and this entry changes no cache setting.

**Alternatives rejected.** *Make sidebar entries plain anchors so every navigation is a full document
load.* It makes the sidebar always fresh and throws away client-side transitions app-wide to fix a
lag the enforcement already covers. *Put the shell in `template.tsx`.* Templates re-render on
navigation, but only when the key at their own segment level changes — `/projects/a` → `/projects/b`
would not re-render it — and "DOM elements inside the template are fully recreated"
(`03-file-conventions/template.md`), so the sidebar would rebuild and drop focus on most navigations
to fix the same lag partially.

### A-8. `proxy.ts` is unchanged, and `/invite/accept` stays closed

**Decision.** This feature does not touch `proxy.ts`, and it registers no public route.

**Rationale.** R1's matcher is an allowlist — everything except `/signin`, `/reset`,
`/api/auth/signin`, `/_next/*` and static assets redirects to `/signin` when the session cookie is
absent (R1 research B-3). Every route this feature adds is authenticated, so all of them are already
covered, and `FR-021` holds without an edit.

`/invite/accept` appears in the spec's surface table, and this feature deliberately leaves it
unregistered. It is a **public** route: `OT-SEC-002` fixes the reachable-by-a-stranger set at four,
R1 opened three of them and left the fourth closed until R3, and nothing in `FR-029`'s reasoning
applies to it — a public route needs no guard, so leaving it closed makes no screen untestable. The
registration note under the spec's surface table is about the authenticated group this feature owns.

### A-9. `unauthorized()` is deliberately not used

**Decision.** No `unauthorized()` call and no `unauthorized.tsx`. An unauthenticated caller is
redirected, not answered.

**Rationale.** `FR-021` and `OT-SEC-015` require `/signin`, and `requireActor()` already redirects
(R1). A `401` screen would be a second answer to a question the product has already answered, and it
would give the Forbidden screen a sibling that `FR-020`'s "no route of its own" reasoning would then
have to cover twice.

---

## B. The frame

### B-1. The sidebar is at the inline start by DOM order, and nothing else is needed for RTL

**Decision.** The shell root is a flex row whose first child is the sidebar. No logical-property
utilities are used for placement; the sidebar's divider is `border-e`.

**Rationale.** The root layout already sets `dir` from the locale it resolves (`src/app/layout.tsx`),
and a flex row's main axis follows the document direction, so first-in-DOM *is* inline start in both
directions. `FR-001` asks for exactly that — "262px fixes its width and not its edge" — and US1
scenario 10 is satisfied without a second code path to test. The one place direction has to be said
out loud is the divider, where `border-e` is the inline-end edge in both directions.

### B-2. 1280px is a `min-width` on the shell, and the document does the scrolling

**Decision.** The shell root carries `min-w-[1280px]`; the sidebar is `w-[262px] shrink-0`; the
content region takes the rest. Nothing sets an `overflow` rule.

**Rationale.** `FR-010` wants no reflow, no collapse and a horizontal scroll below the minimum. A
`min-width` wider than the viewport makes the document wider than the viewport, which is already a
horizontally scrolling page — the browser's own behaviour, no `overflow-x` declaration and no media
query (III, IV). It sits on the group's root rather than on `<body>` so the three unauthenticated
screens, which are a centred 400px card, are unaffected.

`262 + 1018 = 1280` is the spec's own arithmetic (`FR-010`), so the content region needs no
`min-width` of its own.

### B-3. The sidebar sits on `--color-page`, the content region on `--color-surface`, and one token is added

**Decision.** Sidebar fill `--color-page`, content region fill `--color-surface`, divider
`--color-border`. One token is added to `@theme inline` in `src/app/globals.css`:
`--color-text-muted-on-page` at `neutral-700` `#4d525a`.

**Rationale.** R1 measured the contrast and left the instruction: `--color-text-muted` and
`--color-danger` clear WCAG AA on `--color-surface` and **miss** it on `--color-page` (4.36:1 and
4.20:1), and "a later slice rendering muted or error text directly on the page background uses
`--color-text`, or adds a `-on-page` token at `neutral-700`" (R1 research A-4,
[`auth-layout.md`](../001-identity-sessions-signin/contracts/auth-layout.md)). `neutral-700` on
`--color-page` is 6.88:1, which R1 already computed.

Putting the content region on white is what makes this a one-token problem instead of a four-token
one: the Forbidden sentence, the not-found sentence and the banner all sit there, and all of them
stay on the surface R1 measured them safe against. The only muted text this feature puts on the page
background is the project-list region's quiet empty line (`FR-024`), and that one token covers it.

No other token is added. No dark-mode set, no type scale, no spacing unit — R1 rejected all three
with reasons that have not changed (research A-3, A-5, A-6).

**Alternative rejected.** *Sidebar on `--color-surface`, content on `--color-page`.* The usual look,
and it moves every refusal and every empty state onto the background R1 measured as failing, which
would need the new token anyway plus care at every later entry's empty state.

### B-4. Sidebar entries are `next/link`; React Aria supplies the one control that is not a link

**Decision.** The sidebar's entries — Home, Notifications, Accounts, Labels, the `+`, and the chip's
route to `/profile` — are `next/link` anchors. The sign-out control is a `react-aria-components`
`Button`, and it is the only React Aria component in this feature.

**Rationale.** `FR-030` and §7 require React Aria for "interaction behaviour, focus management,
keyboard support and ARIA semantics", and name the components they mean: "buttons, fields, selects,
checkboxes, dialogs, popovers, menus, tabs, tooltips, list boxes, toasts". Links are not in that
list, and they are not in it because an anchor's keyboard, focus and ARIA behaviour is the
platform's; there is nothing for a library to supply. `next/link` is the framework's own built-in
(IV), and it is what gives the sidebar client-side transitions and prefetching.

Two facts settle the alternative. React Aria's `Link` navigates the document unless the tree is
wrapped in `RouterProvider`, and `RouterProvider` has **no subpath export** in the pinned 1.20.0 — it
is re-exported only from the package root (`dist/types/exports/index.d.ts:73`), against R1's
established convention of importing from subpaths, and its underlying home, `react-aria`, is a
transitive dependency that IV's table does not list. Choosing React Aria for the links therefore
means either a barrel import or losing client-side navigation, to replace behaviour the platform
already provides.

**A consequence worth stating.** Every module that imports a React Aria component imports
`client-only` (`dist/exports/Button.mjs`) and none of them carries a `"use client"` directive of its
own, so each must sit inside a module this application marks `"use client"`. `I18nProvider` is one of
the twelve exports that does not, which is why the root layout can import `isRTL` from it today. The
sign-out control is therefore this feature's only client module, which is the narrowest interactive
boundary AGENTS.md asks for.

No `prefetch` override is set on the sidebar links. Until the screens land every one of them
prefetches a `notFound()`, which is cheap and briefly wasteful; setting a knob now and unsetting it
per entry later is the worse trade.

### B-5. The chip is a link and a control side by side, never one inside the other

**Decision.** The user chip is a `next/link` to `/profile` carrying the avatar and the display name,
with the sign-out control as its **sibling** inside the chip's container.

**Rationale.** §3.12 makes the chip Profile's only entry point and §6 makes it sign-out's only
surface (`FR-018`), so the chip carries two interactive things. A button nested inside an anchor is
invalid HTML and produces an element whose keyboard behaviour no library can repair, so the two are
laid out as siblings.

### B-6. No active-entry indicator

**Decision.** The sidebar marks no entry as current. No `aria-current`, no `usePathname`.

**Rationale.** Nothing in §3, `OT-UX-018` or `FR-031` asks for one; `FR-031` asks for focus order,
visible focus indicators and accessible names, all of which the anchors have. Adding it would make
the sidebar a client component to read the pathname (`03-file-conventions/layout.md`, *Pathname*) and
would be a feature beyond what was asked (III, VI). The entry that wants it can add it.

### B-7. `Actor` gains `avatarUrl` and `mustChangePassword`

**Decision.** R1's `Actor` is extended from `{ id, role, firstName, lastName }` to
`{ id, role, firstName, lastName, avatarUrl, mustChangePassword }`, read in the same single
`loadActor()` query.

**Rationale.** The spec's *Key Entities* names four things the shell reads from the actor — display
name, avatar URL, role, and the must-change-password flag — and two of them are not on the shape R1
defined ([`server-contracts.md`](../001-identity-sessions-signin/contracts/server-contracts.md)).
Both columns are on the `user` row `loadActor()` already joins, so this adds two selected columns and
no round trip, and `OT-SEC-008` is untouched because nothing is cached either way.

`Actor` is not a `user` row and not a projection, so the read boundary of §5 is unaffected: this is
the caller's own record, reaching only the caller.

**Alternative rejected.** *A second query in the layout for the chip's fields.* Two round trips on
every authenticated request to avoid two columns, and a second place where "who is the actor" is
answered.

### B-8. `displayName()` lives outside `server/`, in the shell feature

**Decision.** `src/features/shell/display-name.ts` exports one function joining first and last name
with a single space. Not in `src/lib`, not in R1's `projections.ts`.

**Rationale.** `FR-017` makes it an application-wide rule whose first surface is the chip, and R3's
roster and R4's profile are its next callers. It cannot live beside R1's projections, because every
module under a feature's `server/` directory imports `server-only` and the rule has to be callable
from a client component. It is not promoted to `src/lib` because Principle I extracts at the second
call site, and there is one today; the promotion is R3's or R4's to make, and is recorded here so it
arrives as a plan rather than a surprise.

---

## C. The one write

### C-1. Sign-out is a Server Action, in R1's actions module

**Decision.** `signOut` is added to `src/features/auth/actions.ts`, the `"use server"` module R1
creates. It is not a route handler.

**Rationale.** AGENTS.md is explicit: Server Actions for this application's mutations, and sign-in is
"the only mutation that is not a Server Action". It belongs in the auth feature rather than the shell
because the capability is R1's — the spec says the control ends the session "through the session
deletion entry R1 delivers", and R1's Out of Scope says the same from the other side.

The control renders as a `<form action={signOut}>` with a React Aria `Button` of `type="submit"`, so
the mutation is a form post that works before hydration and needs no `onPress` handler.

### C-2. It ends the caller's session and no other

**Decision.** `signOut` deletes exactly one `session` row, the one the request's own cookie names,
and clears the cookie. It does not delete the user's other sessions.

**Rationale.** §6's sentence — "Signing out, a password reset, or deactivation deletes the rows and
takes effect immediately, everywhere, including other devices" — groups three operations whose scope
differs, and the spec has already resolved which one applies here: `FR-018` says "end **the
caller's** session" and derive it "from the request's own cookie rather than from anything the client
sends", and `SC-013` measures it as "no request from **that browser** is answered as them
afterwards". A reset ends every session because the credential changed; signing out on a laptop is
not a reason to sign someone out on their phone.

**What R1 owes it.** R1's `sessions.ts` is contracted for issue, refresh and delete-all. The
single-session delete is the piece this feature needs; it belongs in that module, and R2 adds it
there if R1's implementation has not already.

`assertSameOrigin()` runs as the action's first statement, which is R1's rule for every Server
Action and is what `FR-018` restates for this one (`OT-SEC-009`).

### C-3. It succeeds when there is nothing to delete

**Decision.** A delete affecting zero rows is a success. The cookie is cleared and the caller is
redirected to `/signin` either way.

**Rationale.** `FR-018` requires it and the spec's edge case explains it: "there is nothing left to
delete and nothing to report". The alternative — reporting an error — would tell a caller whose
session was ended elsewhere something about server state on the one path where they can do nothing
with it, and would leave a cookie in the browser that the next request has to reject again.

---

## D. Meeting change gate 1 on a feature made of Server Components

### D-1. Every requirement is tested through a synchronous component or a thrown interrupt

**Decision.** No test renders an `async` Server Component. Each async file is a thin wrapper — read
the actor, decide, hand plain props to a synchronous component — and the two halves are tested
differently:

| What | Where | How |
| --- | --- | --- |
| `AppShell`, `Sidebar`, `UserChip`, `ScreenHeader`, `ForbiddenNotice`, `NotFoundNotice` | jsdom project | rendered with `@testing-library/react`, queried by role, label and visible text |
| `(app)/layout.tsx` and every `page.tsx` | node project | the function is called; the test asserts the interrupt it throws, or the props it hands down |
| `signOut` | node project, real PostgreSQL | the row is gone, the cookie is cleared, the second call still succeeds |

**Rationale.** The framework's own testing guide is unambiguous: "Since `async` Server Components are
new to the React ecosystem, Vitest currently does not support them. While you can still run **unit
tests** for synchronous Server and Client Components, we recommend using **E2E tests** for `async`
components" (`02-guides/testing/vitest.md`). This project has no E2E runner and cannot add one
without an amendment (IV), and gate 1 is non-negotiable — so the decomposition is chosen to leave
nothing untestable inside an async boundary. That constraint, not a taste for small files, is why
`AppShell` is a separate component from the layout that renders it.

A thrown interrupt is assertable precisely: `forbidden()` and `notFound()` set
`error.digest` to `NEXT_HTTP_ERROR_FALLBACK;403` and `…;404` respectively
(`dist/client/components/forbidden.js`, `dist/client/components/not-found.js`), so a route's guard
order — `FR-029`, `SC-014` — is a direct assertion on which digest comes back for which actor.

### D-2. The runner needs `__NEXT_EXPERIMENTAL_AUTH_INTERRUPTS`

**Decision.** `vitest.config.mts` sets `__NEXT_EXPERIMENTAL_AUTH_INTERRUPTS=true` for both projects.

**Rationale.** `forbidden()` reads that variable at call time and throws `E488` — "`forbidden()` is
experimental and only allowed to be enabled when `experimental.authInterrupts` is enabled" — when it
is unset (`dist/client/components/forbidden.js`). Vitest does not load `next.config.ts`, so without
this every Forbidden test fails with the wrong error and looks like a Red step that is passing for
the wrong reason. This is the one place the experimental flag of A-4 costs something beyond a config
line.

### D-3. One test needs a real database, and the rest need none

**Decision.** `signOut` is tested against the real PostgreSQL instance R1's `TEST_DATABASE_URL`
names. Nothing else in this feature is.

**Rationale.** AGENTS.md requires persistence tests against real PostgreSQL because invariants are
enforced by constraints and locks; sign-out writes a row deletion and is the only thing here that
touches the database. Everywhere else the actor is a value the test supplies, which is what makes
the guard tests fast and exhaustive — every route in the surface table, under an admin actor and a
member actor, is a table-driven test rather than a fixture per route.

### D-4. Six requirements are stated with no test, by the spec's own design

**Decision.** `FR-013`, `FR-023` and `FR-032`…`FR-035` carry no test in this feature.

**Rationale.** Each is a convention this entry fixes and the first entry with a surface implements,
and each says so inline in the spec. The roadmap's R2 row records the same reconciliation, and gate 1
"asks for no test R2 cannot write". They are listed here so a reviewer counting tests against
requirements finds the six accounted for rather than missing — and so the count stays six: A-6 exists
precisely so that `FR-019`, `FR-020` and their four scenarios do not silently join them.

---

## Assumptions carried forward

Two, none blocking. Each is a candidate for `/speckit-clarify` before `/speckit-implement`.

1. **`/home` renders nothing until R12.** The route exists, the sidebar renders, the header does not,
   and the content region is empty — which means the page has no heading. The spec is explicit that
   Home's content is R12's, so inventing one here would be content this entry has no basis for; the
   consequence is that `/home` has no `<h1>` until R12 supplies it.
2. **The not-found screen renders no header.** `FR-019` gives Forbidden a header because Forbidden is
   screen 11 in §3's table and has a name; a path that matches nothing is not a screen and has no
   name to put in a title block. Both not-found mounts therefore render the notice alone.
