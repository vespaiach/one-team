# Specification Quality Checklist: Application shell and cross-cutting UX

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-08-30
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Requirements coverage

Entry **R2** assigns seventeen requirement IDs. Each is cited by at least one functional requirement:

| Assigned ID | Covered by |
|---|---|
| `OT-SCOPE-004` | FR-010 |
| `OT-SCOPE-007` | FR-028, FR-029 |
| `OT-UX-001` | FR-001, FR-003, FR-004, FR-027 |
| `OT-UX-002` | FR-023 |
| `OT-UX-003` | FR-011 |
| `OT-UX-004` | FR-022 |
| `OT-UX-005` | FR-032 |
| `OT-UX-006` | FR-033 |
| `OT-UX-007` | FR-024 |
| `OT-UX-016` | FR-034 |
| `OT-UX-017` | FR-035 |
| `OT-UX-018` | FR-030, FR-031 |
| `OT-UX-019` | FR-017 |
| `OT-UX-021` | FR-013, FR-014 |
| `OT-SEC-015` | FR-021 |
| `OT-AUTHZ-005` | FR-014, FR-015, FR-029 |
| `OT-AUTHZ-012` | FR-016 |

One further ID is cited without being assigned: `OT-SCOPE-001`, which the roadmap attributes to the
whole epic, at FR-006's no-team-switcher rule. Citing it is not a claim on it. FR-018 (sign-out) cites
`OT-SEC-009` and `OT-AUTHZ-004`, both entry R1's, because it is this feature's only mutating request and
they are the rules that protect one; no index ID covers the control itself — §6 requires the capability
and entry R1 defers the control here.

## Notes

- **Six of the thirty-five functional requirements have no acceptance scenario, by design.**
  FR-013 and FR-023 state the disabled-control-with-inline-reason rule, and FR-032 to FR-035 state
  the toast, skeleton, re-query and connection-banner rules. This feature renders no unusable
  control, loads no data, and its one write — sign-out, FR-018 — ends the session and leaves the
  application, so none of the six can be exercised here. Each carries an inline marker naming the
  entry that implements it, so the absence is visible on the requirement's own line rather than only
  in this note, and change gate 1 asks this feature for no test it cannot write. A reviewer should
  read the absence as deliberate rather than as missing coverage.
- **On "no implementation details".** FR-030 names React Aria Components, and FR-001 and FR-005 name
  a 262px sidebar. Both are product requirements taken upstream — `OT-UX-018` and §3 and §7 of the
  specification — not choices this document makes. Everything that *is* a choice appears only under
  *Assumptions → Inherited constraints*, where it is labelled as inherited.
- **Both open assumptions were settled** in *Clarifications → Session 2026-08-30*: the minimum page
  width is 1280px with horizontal scrolling below it (FR-010), and sidebar entries render from this
  entry onward with undelivered routes answering the not-found convention (FR-029). Nothing in
  *Assumptions* is now marked as awaiting confirmation.
- **The roadmap divergence is closed.** `docs/ROADMAP.md` has been amended under §5 in the same
  change: disabled-control-with-inline-reason moved out of R2's *In* list into its *fixed here as
  rules, not implemented here* sentence, and the R2 row now names sign-out on the user chip. The
  rule's first caller is entry R3's last-active-admin `Deactivate` control (§3.9) — earlier than the
  R5/R6 this checklist previously guessed, and earlier than R4, which has no such control at all.
- **The count was nearly eight, not six.** As first written, FR-029 had every undelivered route answer
  "This doesn't exist", and in this feature every admin-only route is undelivered — which left FR-019
  and FR-020 with no reachable caller and made four acceptance scenarios untestable, on a screen the
  roadmap lists under R2's *In*. FR-029 now orders the two checks, authorization before existence, and
  the route group registers each guard alongside its route. Forbidden is testable here against a real
  route, and the six remain six.
- Items marked incomplete require spec updates before `/speckit-clarify` or `/speckit-plan`.
