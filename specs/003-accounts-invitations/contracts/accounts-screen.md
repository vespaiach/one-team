# Contract — `/settings/accounts` and `/invite/accept`

**Plan**: [`../plan.md`](../plan.md) · **Research**: [`../research.md`](../research.md) C-1, D · **Spec**: [`../spec.md`](../spec.md) §3.9

Two screens. One fills a route R2 registers and leaves empty; the other opens the fourth and last
public route.

---

## `/settings/accounts` — admin, inside the shell

### The route

```text
src/app/(app)/settings/accounts/page.tsx        R2 creates this file as a guard-only route.
                                                 This feature replaces its body, keeping the guard
                                                 as its first statements.

  const actor = await requireActor()             unauthenticated → /signin, never Forbidden   FR-002
  if (actor.role !== "admin") forbidden()        member → Forbidden, in the shell, at this URL FR-002
  … load, then render                            no notFound() any more — the screen has landed
```

Registered by R2, filled here — its route-surface contract names R3 as the entry that does it. The
guard order is R2's and is not re-decided: **may you be here** before **is anything here**
(`FR-001`, `FR-002`, `OT-SEC-015`).

**No `loading.tsx` above the guard.** A skeleton there turns a `403` into a streamed `200`. The
skeletons live below it, per panel ([`../research.md`](../research.md) E-3).

### The frame

```text
<ScreenHeader name="Accounts" />                 R2's header — title block, both slots empty
<Tabs>                                           react-aria-components/Tabs
  <TabList>
    <Tab id="invitations">Invitations</Tab>      selected on arrival                 FR-003
    <Tab id="accounts">Accounts</Tab>
  </TabList>
  <TabPanel id="invitations"> … </TabPanel>
  <TabPanel id="accounts">    … </TabPanel>
</Tabs>
```

**The tab is page state, not a route** (`FR-003`, §3.9). `selectedKey` lives in this screen's one
client component; there is nothing to link to and a reload returns to Invitations. React Aria supplies
the roving tabindex, arrow keys and `aria-controls` (`FR-030`, `OT-UX-018`).

**No write moves the tab, and the outcome surfaces sit outside both panels** (`FR-003a`). The toast
region and the connection banner render at page level, so a write completed on one tab is reported
while the other is selected. Only the reader and `FR-008`'s control change `selectedKey`.

### The Invitations panel

```text
<Button>Invite</Button>                          head of the tab                     FR-005
  └─ DialogTrigger → Modal → Dialog
       TextField  name="email"                   one field, and nothing else         FR-005
       Button     type="submit"                  stays enabled; never goes dead      FR-006
       Cancel / Escape → close, discard, write nothing                               FR-011
       a press outside the dialog → nothing; the modal stays open                    FR-011

<table>                                          newest first                        FR-018
  address · invited by · sent · expires · [Resend] [Revoke]                          FR-018, FR-019
  an expired row stays, marked expired **in text, never colour alone**, resend
  still offered                                                                      FR-022
</table>

empty → one line, "No outstanding invitations"  no illustration                      FR-023
read failed → an explanatory state in the panel's place, naming that the data
  could not be loaded and offering a retry — never an empty list, and never
  a skeleton left standing                                                           FR-055a
```

**Validation is per field, on blur, and never a wall on submit** (`FR-006`, `OT-UX-011`). The shape
check is local; the two duplicate checks are `checkInviteAddress`, because the browser does not hold
the roster (`OT-DATA-005`).

| Blur answer | Inline error | Requirement |
| --- | --- | --- |
| `malformed` | names the problem | `FR-007` |
| `has_account`, active | names the account · offers the control that reaches its row | `FR-008` |
| `has_account`, deactivated | names it as **closed** · offers **Reactivate** as the remedy | `FR-008a` |
| `has_invitation` | says so · offers **Resend** in place of a second invitation | `FR-009` |

Comparison folds case at both ends — `parseEmail` lower-cases, the index is on `lower(email)`
(`FR-010`, `OT-INV-016`).

### The control that reaches an account's row

`FR-008`'s affordance, as clarified. **Not an anchor** — §3.9 says the tab has "nothing to link to",
and §3.12 says no route shows another user's profile.

```text
onPress:
  1. close the modal, discard the field                                   FR-011's discard rule
  2. setSelectedKey("accounts")                                           the tab moves as state
  3. setHighlightedAccountId(accountId)
  4. the matching row scrollIntoView's — a no-op where it is already in view —
     and carries a transient marker perceivable by more than colour       FR-008b
  5. focus moves to that row, and the outcome is announced, naming the
     account whose row was reached                                        FR-008b
  ── no href · no router.push · no URL change · no history entry
  ── steps 4 and 5 happen whether or not any scrolling was needed
```

The marker clears after a short interval or on the next interaction, whichever is first
([`../research.md`](../research.md), *Assumptions carried forward* 1). Because it is all state in one
component, US1 scenarios 15 and 16 are assertable in jsdom with no router.

### The Accounts panel

```text
<table>                                          active first, then closed           FR-036
  avatar · display name · email · role · joined · projects · [one control]
  inside each group: one fixed collation, never the reader's locale, with ties
  broken by the address, which is unique                                             FR-036
</table>
```

No empty state is needed: the admin reading the roster is on it, and `FR-049` keeps one active
account standing at every moment (`FR-036`).

| Cell | Rule | Requirement |
| --- | --- | --- |
| display name | first + `" "` + last | `FR-038`, `OT-UX-019` |
| email | from `accountUser`, the projection reserved for this screen | `FR-039`, `OT-DATA-005` |
| role | shown, never edited — no control on this screen sets one | `FR-042`, `OT-AUTHZ-011` |
| joined | the instant the account came into being | `FR-041` |
| projects | **0** for everyone until R5 | `FR-040`, `OT-AUTHZ-006` |
| control | exactly one — **Deactivate** on active, **Reactivate** on closed | `FR-042` |

**The sole active admin's Deactivate renders disabled with its reason beside it, and is not hidden**
(`FR-050`, `OT-UX-002`) — this is the first implementation of R2's disabled-with-inline-reason rule,
which R2's contract assigns here by name. The reason is text next to the control, never a tooltip and
never colour alone, and it reads **"The last active admin can't be deactivated."** The control stays
reachable by keyboard and its reason is associated with it programmatically, so a reader who never
sees that text still meets it (`FR-050`, `OT-UX-018`).

**Each confirmation names its own consequence** (`FR-044`). Deactivation's names what stays —
memberships, assignments, comments and activity (`FR-047`). Reactivation's names what it restores —
sign-in and picker eligibility, with the memberships the account already had — and says that no new
link and no invitation is issued (`FR-051`).

---

## `/invite/accept` — public, outside the shell

### The route

```text
src/app/(auth)/invite/accept/page.tsx            NEW. R1's (auth) group, whose layout is already
                                                  the full-screen card with no sidebar and no
                                                  header — FR-025 needs nothing built.

src/proxy.ts                                     EDIT — the matcher must exempt this path, or
                                                  R1's proxy redirects every stranger who has one
```

```text
matcher: ["/((?!signin$|reset$|invite/accept$|api/auth/signin$|_next/static|_next/image|favicon.ico).*)"]
```

This is `OT-SEC-002`'s fourth public route. R1 opened three and R2 recorded that the fourth stays shut
until R3; with it open the set is closed, and `FR-024` says there is no fifth.

**The matcher is routing, not authorization** (AGENTS.md). The page resolves the token itself and
refuses on its own.

### The screen

```text
valid    → first name · last name · one password field
           the invited address shown as a VALUE, not a control      FR-026, FR-033
used | expired | unknown
         → its own explanatory state, each distinguishable          FR-032
taken    → the address acquired an account; named, and pointed at
           sign-in                                                  FR-034

submitting → in-flight state on the control, and no second press    FR-028a
```

**The route renders whatever session the caller holds** (`FR-024b`), as `/signin` does. Acceptance
writes a new session and overwrites the cookie; a session already held is neither reused, extended
nor deleted.

**One password field, not two.** §3.1 gives the New/Confirm pair to Change password and describes
acceptance as "a password the user chooses" (spec assumption).

**No `user` record is read or disclosed.** The address comes from the invitation (`FR-033`,
`OT-SEC-018`) — the same rule §3.1 already applies to the deactivated sign-in message.

The three dead-link screens follow R1's `ChangePasswordForm` shape: a heading, one sentence, and a
route onward. There is no "request a new one" control here — a stranger cannot invite themselves, and
the remedy is to ask an admin.

---

## What this feature does not build

| Absent | Owner |
| --- | --- |
| The sidebar's **Accounts** entry that reaches this screen, hidden for non-admins | R2 (`OT-UX-003`) |
| `ScreenHeader`, the shell, `forbidden.tsx`, the `(app)` group and its guard | R2 |
| Any picker the closed-account exclusion applies to | R5 (member), R6 (assignee), R7 (`@mention`) — `FR-048` |
| Any route to view another user's profile | none exists — §3.12 |
| Role editing of any kind from a screen | CLI-only — `OT-AUTHZ-011` |
| A team-settings screen | out of scope; this screen is what remains of it |

`FR-048` is worth stating precisely: this feature delivers **no picker**, so the exclusion of closed
accounts takes effect in each picker as that picker lands. What this feature owes is that
`deactivated_at` is set and every session is gone, which is what the later exclusions read.
