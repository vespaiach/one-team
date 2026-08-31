# Specification Quality Checklist: Projects — creation, record, membership and lifecycle

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

Entry **R5** assigns twenty requirement IDs. Each is cited by at least one functional requirement:

| Assigned ID | Covered by |
|---|---|
| `OT-SCOPE-002` | FR-001 |
| `OT-AUTHZ-001` | FR-013 |
| `OT-AUTHZ-004` | FR-014 |
| `OT-AUTHZ-006` | FR-018, FR-030 |
| `OT-AUTHZ-013` | FR-019 |
| `OT-DATA-007` | FR-049 |
| `OT-DATA-008` | FR-050 |
| `OT-DATA-013` | FR-009, FR-029 |
| `OT-DATA-015` | FR-010, FR-011, FR-039 |
| `OT-UX-008` | FR-033, FR-038, FR-041 |
| `OT-UX-009` | FR-036 |
| `OT-UX-010` | FR-037 |
| `OT-UX-011` | FR-032 |
| `OT-UX-012` | FR-026 |
| `OT-UX-020` | FR-004, FR-053 |
| `OT-OPS-010` | FR-043 |
| `OT-OPS-011` | FR-042 |
| `OT-INV-007` | FR-002, FR-016, FR-037 |
| `OT-INV-008` | FR-047 |
| `OT-INV-016` | FR-002, FR-006, FR-026 |

Seventeen further IDs are cited without being assigned, because the roadmap fixes them elsewhere and this
feature is their first or a material caller. Citing them is not a claim on them:

- **Entry R1's conventions** — `OT-DATA-001`, `-002`, `-003` (FR-012), `OT-DATA-006` (FR-008),
  `OT-SEC-015` (FR-023).
- **Entry R2's shell and cross-cutting UX** — `OT-AUTHZ-005` (FR-014), `OT-AUTHZ-012` (FR-020),
  `OT-SCOPE-007` (FR-022, FR-035), `OT-UX-002` (FR-021, FR-041, FR-047), `OT-UX-003` (FR-022),
  `OT-UX-004` (FR-040), `OT-UX-007` (FR-055).
- **Entry R12's read rule** — `OT-AUTHZ-002` (FR-017), which this feature exercises on the first
  screen everyone can read but not everyone can write.
- **Entry R6's issue numbering** — `OT-DATA-012` and `OT-INV-009` (FR-008). This feature creates the
  counter row and fixes what it holds; the numbers themselves are drawn in R6, which is where both
  are enforced.
- **Entry R9's column invariant** — `OT-INV-015` (FR-006). This feature sets `kind` at seed time and
  offers no path that changes it; the invariant's enforcement belongs to `updateColumn`, which is R9's.
- **The whole epic** — `OT-SCOPE-005` (FR-045), naming project-level invitations as the thing the
  Members section deliberately does not offer.

## Notes

- **On "no implementation details".** The specification names UUIDv7 primary keys, `text`+`CHECK`
  enumerations, database-level cascades and one-transaction deletes as product requirements, by ID
  (`OT-DATA-001`, `OT-DATA-007`, `OT-DATA-008`). Restating them here is traceability to a decision
  already taken upstream, not a technical choice this document makes. Everything that *is* a choice —
  the ORM, the runtime, the component library — appears only under *Assumptions → Inherited
  constraints*, where it is labelled as inherited.
- **FR-001 to FR-012 carry no user journey.** They are structural conventions later entries inherit,
  verified against the schema and against the writes the database refuses rather than through a
  screen; the spec states that verification basis inline under its own subheading.
- **The markdown renderer is R5's, and the roadmap now says so.** The roadmap assigned
  `OT-DATA-015` to both R5 and R6 while its §1.1 prose named R6 as the first caller. That prose was
  corrected: R5 designs and implements the subset for its own single call site, and R6 is the second
  caller, where §1.1's extraction rule decides whether it is promoted (I). Recorded under
  *Clarifications* and in FR-010.
- **Delete's confirmation counts the cascade, and later entries extend the count.** FR-048 now fixes
  the size it states as the rows the cascade actually reaches when it is shown — columns and members
  today — and puts the obligation to extend that count on each entry that attaches a table. Settled;
  no enumeration of future entities is made now.
- Items marked incomplete require spec updates before `/speckit-clarify` or `/speckit-plan`.
