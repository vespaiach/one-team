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
| `OT-SCOPE-007` | FR-027 |
| `OT-UX-001` | FR-001, FR-003, FR-004, FR-026 |
| `OT-UX-002` | FR-022 |
| `OT-UX-003` | FR-011 |
| `OT-UX-004` | FR-021 |
| `OT-UX-005` | FR-030 |
| `OT-UX-006` | FR-031 |
| `OT-UX-007` | FR-023 |
| `OT-UX-016` | FR-032 |
| `OT-UX-017` | FR-033 |
| `OT-UX-018` | FR-028, FR-029 |
| `OT-UX-019` | FR-017 |
| `OT-UX-021` | FR-013, FR-014 |
| `OT-SEC-015` | FR-020 |
| `OT-AUTHZ-005` | FR-014, FR-015 |
| `OT-AUTHZ-012` | FR-016 |

One further ID is cited without being assigned: `OT-SCOPE-001`, which the roadmap attributes to the
whole epic, at FR-006's no-team-switcher rule. Citing it is not a claim on it.

## Notes

- **Five of the thirty-three functional requirements have no acceptance scenario, by design.**
  FR-013 and FR-022 state the disabled-control-with-inline-reason rule, and FR-030 to FR-033 state
  the toast, skeleton, re-query and connection-banner rules. This feature renders no unusable
  control, performs no write and loads no data, so none of the six can be exercised here. Each is
  recorded under *Assumptions → Reconciliations* with the entry that implements it, and change gate 1
  asks this feature for no test it cannot write. A reviewer should read the absence as deliberate
  rather than as missing coverage.
- **On "no implementation details".** FR-028 names React Aria Components, and FR-001 and FR-005 name
  a 262px sidebar. Both are product requirements taken upstream — `OT-UX-018` and §3 and §7 of the
  specification — not choices this document makes. Everything that *is* a choice appears only under
  *Assumptions → Inherited constraints*, where it is labelled as inherited.
- **The two assumptions worth clarifying first** are the minimum layout width below which the page
  scrolls horizontally, and whether sidebar entries should render before the screens they point at
  exist. The second changes what a reviewer sees on day one of every entry from R3 to R11.
- **The roadmap's *In* list and this feature's testable surface diverge in one place**, recorded as
  the first reconciliation: disabled-control-with-inline-reason is listed as in scope but has no
  caller until R5 or R6. This is a candidate for a roadmap amendment under §5 rather than a defect in
  this spec.
- Items marked incomplete require spec updates before `/speckit-clarify` or `/speckit-plan`.
