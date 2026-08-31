# Specification Quality Checklist: Profile

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

Entry **R4** assigns eight requirement IDs. Each is cited by at least one functional requirement:

| Assigned ID | Covered by |
|---|---|
| `OT-AUTHZ-001` | FR-018 |
| `OT-DATA-005` | FR-003 |
| `OT-DATA-016` | FR-009 |
| `OT-UX-009` | FR-013, FR-013a |
| `OT-UX-010` | FR-024 |
| `OT-UX-019` | FR-004 |
| `OT-SEC-004` | FR-027 |
| `OT-SEC-012` | FR-030 |

Seventeen further IDs are cited without being assigned, because the roadmap fixes them elsewhere and
this feature exercises or first calls them: `OT-SCOPE-007` and `OT-UX-001` (R2) on the route and its
frame; `OT-SEC-015` (R1) on the unauthenticated redirect; `OT-AUTHZ-004` (R1) and `OT-DATA-002` (R1)
on the new mutator; `OT-AUTHZ-011` (R1) on role changes staying off the UI; `OT-SEC-017` (R1)
on the change-password request keeping its own counter; `OT-UX-011` (R5) on
per-field validation; `OT-UX-007` (R2) on the one quiet line an empty optional field renders;
`OT-UX-005`, `-006`, `-008`, `-016`, `-017` and `-018` (R2) on the conventions
this screen is the first surface to exercise; and `OT-INV-010` with `OT-DATA-009` (R1, R7) on why a
profile edit has no feed to write to. Citing them is not a claim on them.

## Notes

- **On "no implementation details".** `updateOwnProfile`, the `accountUser` projection and the seven
  field names are the specification's own vocabulary (§2, §3.12, §5), not choices this document
  makes. Where a technology would otherwise have to be named — the component library behind
  `OT-UX-018`, the helper behind `OT-DATA-002` — the requirement describes the obligation and leaves
  the name to the plan. Everything genuinely inherited is labelled as such under
  *Assumptions → Inherited constraints*.
- **This feature adds no data.** FR-037 states it plainly: entry R1 created every column this screen
  reads or writes, with its bounds and its two projections. A plan that generates a migration has
  gone outside the boundary.
- **The avatar's scheme rule was the one real silence in the source, and is now settled.** §3.12 says
  "a URL text field" and stops. R1 bounded the column's length and left its content unconstrained, and
  this feature is its only writer, so the rule had to be decided here. Clarification fixed it at
  `http` and `https` only — `mailto`, which the repository's markdown link rule allows, is excluded as
  unresolvable for an image source — and the comparison is case-insensitive (FR-011).
- **The cross-cutting UX conventions are split by kind, not assigned by build order.** Entry R2 leaves
  toasts, skeletons, re-query and the connection-lost banner to whichever of R3 or R4 is built first.
  Clarification removed that conditional: the message host and the connection banner are single
  app-wide shell instances no entry owns, and the skeleton and re-query are per-screen work this
  screen authors for itself. FR-031 to FR-034 are obligations on this screen under every build order,
  this entry adds no dependency on R3, and R3's spec states the same split for its own screens. No
  shared primitive is extracted for them, because two of the four are singletons rather than
  primitives and the other two are per-screen by definition.
- Items marked incomplete require spec updates before `/speckit-clarify` or `/speckit-plan`.
