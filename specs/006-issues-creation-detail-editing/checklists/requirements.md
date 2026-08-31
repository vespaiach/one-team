# Specification Quality Checklist: Issues — creation, detail and editing

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

Entry **R6** assigns nineteen requirement IDs. Each is cited by at least one functional requirement:

| Assigned ID | Covered by |
|---|---|
| `OT-SCOPE-003` | FR-002 |
| `OT-AUTHZ-007` | FR-022 |
| `OT-AUTHZ-015` | FR-023 |
| `OT-DATA-004` | FR-006 |
| `OT-DATA-007` | FR-057 |
| `OT-DATA-008` | FR-058 |
| `OT-DATA-012` | FR-013, FR-014, FR-016 |
| `OT-DATA-015` | FR-009, FR-010, FR-044 |
| `OT-DATA-018` | FR-040, FR-055 |
| `OT-UX-008` | FR-015, FR-038, FR-050, FR-051 |
| `OT-UX-009` | FR-048 |
| `OT-UX-010` | FR-007, FR-011, FR-012, FR-045 |
| `OT-UX-011` | FR-037 |
| `OT-UX-021` | FR-028, FR-029 |
| `OT-INV-001` | FR-001 |
| `OT-INV-002` | FR-007, FR-055 |
| `OT-INV-003` | FR-002 |
| `OT-INV-004` | FR-005, FR-052 |
| `OT-INV-009` | FR-013, FR-014, FR-055 |

Sixteen further IDs are cited without being assigned, because the roadmap fixes them elsewhere and this
feature is their first or a material caller. Citing them is not a claim on them:

- **Entry R1's conventions** — `OT-DATA-001`, `-002`, `-003` (FR-008), `OT-AUTHZ-004` (FR-019),
  `OT-SEC-015` (FR-029).
- **Entry R2's shell and cross-cutting UX** — `OT-SCOPE-007` (FR-027, FR-041), `OT-AUTHZ-005` (FR-019),
  `OT-AUTHZ-012` (FR-025), `OT-UX-001` (FR-041), `OT-UX-002` (FR-026, FR-047, FR-051, FR-061),
  `OT-UX-004` (FR-046).
- **Entry R3's account state** — `OT-AUTHZ-014` (FR-024), which this feature exercises on the assignee
  a project has since removed or deactivated.
- **Entry R5's project rules** — `OT-SCOPE-002` (FR-001) and `OT-OPS-011` (FR-053), the latter applied
  here to column transitions rather than to a project's status.
- **Entry R10's ordering rule** — `OT-DATA-017`, named in *Out of Scope* and in FR-055 as the thing
  this feature does not write. Only `OT-DATA-018`'s creation index is written here.
- **Entry R11's assignment rule** — `OT-OPS-016`, named in *Out of Scope* because both mutators here
  set the assignee and R11 reaches back into each.
- **Entry R12's read rule** — `OT-AUTHZ-002` (FR-021, FR-041), which this feature exercises on the
  screen most users can read and most cannot write.
- **The whole epic** — `OT-SCOPE-005` (*Out of Scope*), naming sub-issues, attachments, estimates and
  search as the things an issue deliberately does not gain.

## Notes

- **On "no implementation details".** The specification names UUIDv7 primary keys, `text`+`CHECK`
  enumerations, a counter row lock, database-level cascades and one-transaction deletes as product
  requirements, by ID (`OT-DATA-001`, `OT-DATA-012`, `OT-DATA-007`, `OT-DATA-008`). Restating them
  here is traceability to a decision already taken upstream, not a technical choice this document
  makes. Everything that *is* a choice — the ORM, the runtime, the component library — appears only
  under *Assumptions → Inherited constraints*, where it is labelled as inherited.
- **FR-001 to FR-011 carry no user journey.** They are structural conventions later entries inherit,
  verified against the schema and against the writes the database refuses rather than through a
  screen; the spec states that verification basis inline under its own subheading.
- **The delete control is specified now, not assumed.** §2 gives `deleteIssue` to admins and §4 gives
  it a cascade, but no screen section placed the control or said whether it confirms. `/speckit-clarify`
  settled it on 2026-08-30: the issue rail, admin-only, disabled with an inline reason for everyone else,
  confirming once and stating the size of what the cascade destroys, then landing on the project's
  details page (FR-060, FR-061, FR-062). The same session closed a gap the source never covered — what
  a user sees on an over-length title or description, which had existed only as a database `CHECK`
  (FR-037, FR-049, SC-016). All four answers are recorded under *Clarifications* in the spec.
- **The markdown reconciliation inverts entry R5's.** Roadmap §1.1 names R6 as where `OT-DATA-015`
  bites first; R5's own spec already recorded that it ships project descriptions earlier. This spec
  records the consequence rather than re-litigating it: R6 is the second call site, which under
  Principle I is where the shared renderer is extracted rather than guessed. The dependency decision
  is untouched — the subset stays hand-written.
- **Four later entries reach back into this feature.** R7 (activity), R8 (labels and one cascade arm),
  R10 (`moveIssue` as a second writer of column, assignee and priority) and R11 (assignment
  notifications and one cascade arm) all modify mutators delivered here. `/speckit-plan` should keep
  `createIssue`, `updateIssue` and `deleteIssue` shaped so those additions are extensions rather than
  rewrites.
- Items marked incomplete require spec updates before `/speckit-clarify` or `/speckit-plan`.
