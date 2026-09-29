# UI Design: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link to spec.md]

**Roadmap entry**: [RM-n: sub-feature name]

**Canvas**: [Claude Design link, or "not yet linked"] | **Canvas version**: [version or date]

**Status**: [Draft | In review | Frozen | Not applicable]

**Frozen**: [DATE, or blank until frozen]

**Authority**: `docs/tracklite-spec.md` decides behavior, permissions and copy. This file and the canvas decide layout only.

## Screens

<!--
  Every screen, overlay and email this slice builds or changes.
  Kind: page (a route from API-004), overlay (dialog, menu, picker, toast) or email.
  Route: a page's address from API-004; for an overlay, the page it opens on.
-->

| Screen | Kind | Route or host page | Signed in? | Spec rules |
|--------|------|--------------------|------------|------------|
| [Sign-in] | page | `/sign-in` | No | [REQ-004, SEC-001] |

## State inventory

<!--
  Apply this checklist to EVERY screen. Each state gets a row: either the rule
  that causes it, or N/A with a reason. A state a later slice adds is N/A with
  "RM-n" as the reason. No silent omissions.

  State checklist:
  - Populated: the normal view with typical data
  - Loading: shown after 300 ms (STD-7)
  - Empty: names the next action (STD-7)
  - Load error: with a Retry button (STD-7)
  - Field error: next to the field, input kept (STD-3)
  - Saving: submit disabled while saving (STD-5)
  - Submit failed: toast, 5 seconds, input kept (STD-9)
  - Conflict: STD-8 message in the editor
  - Not allowed: controls hidden; the STD-2 message if reached anyway
  - Not found (STD-4)
  - Signed out: redirect to sign-in and back (STD-1)
  - Archived project: read-only, no edit controls (REQ-013)
  - Deactivated member: "(deactivated)" and not pickable (REQ-007)
  - Long content: truncation with "…" and full text on hover, or sideways scroll
  - Phone width: works, not polished (section 3, NFR-006)
-->

| Screen | State | Caused by | Canvas frame |
|--------|-------|-----------|--------------|
| [Sign-in] | [Populated] | [REQ-004] | [frame name] |
| [Sign-in] | [Archived project] | N/A: [no project on this page] | — |

## Copy

<!--
  Every user-visible string. Source is a spec rule when the spec gives it,
  quoted exactly, or "design" when it doesn't. Design strings stay plain and
  never promise behavior the spec doesn't define.
-->

| Screen | Element | Text | Source |
|--------|---------|------|--------|
| [Sign-in] | [confirmation] | "Check your email" | [REQ-004.1] |

## Component map

<!--
  Each element of each screen, the shared component that renders it, and
  whether that component is reused, extended or new against the components
  already in the codebase. Name components by role (button, text field,
  dialog, menu, toast, table, card), not by library or styling.
-->

| Screen | Element | Component | Reuse / extend / new |
|--------|---------|-----------|----------------------|
| [Sign-in] | [email input] | [text field] | [new] |

## Keyboard and focus

<!--
  Per screen: tab order, initial focus, focus after every action (submit,
  close, delete, error), and the keyboard alternative to any pointer-only
  action (for example REQ-030 for dragging cards). Focus is always visible
  (NFR-007).
-->

| Screen | Tab order | Initial focus | Focus after actions | Keyboard alternatives |
|--------|-----------|---------------|---------------------|-----------------------|
| [Sign-in] | [email, Send link] | [email] | [error → email field] | — |

## Deferred UI

<!--
  Slots a later slice fills, from this entry's "Deferred" items in ROADMAP.md.
  Record where the slot sits so this slice leaves room without building it.
-->

| Slot | Screen | Filled by |
|------|--------|-----------|
| [labels on the issue page] | [Issue] | [RM-7] |

## Open questions

<!--
  Anything the spec leaves open that the layout needs. A question whose answer
  would change behavior is a DEC candidate for the owner; never answer it here.
-->

| # | Question | Behavior change? | Answer |
|---|----------|------------------|--------|
| 1 | [question] | [Yes: DEC candidate / No] | [blank until answered] |

## Freeze checklist

- [ ] Every screen in this slice's scope is listed, with a route or host page consistent with spec.md
- [ ] Every screen has a row for every state in the checklist, or N/A with a reason
- [ ] Every copy row quotes the spec exactly or is marked design
- [ ] Every element has a component, marked reuse, extend or new
- [ ] Every screen has its keyboard and focus row, with an alternative for each pointer-only action
- [ ] Every deferred slot names its RM entry
- [ ] Every open question is answered, and none changes behavior
- [ ] The canvas is linked, every non-N/A state row has a frame, and no frame shows anything outside the inventory
- [ ] Nothing adds a screen, control, state or string that changes behavior, or anything out of scope in spec section 3
