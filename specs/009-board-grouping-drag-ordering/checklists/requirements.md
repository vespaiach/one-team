# Specification Quality Checklist: Board — grouping, drag and ordering

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-04
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

## Notes

- Items marked incomplete require spec updates before `/speckit-clarify` or `/speckit-plan`
- Two named technologies appear in FR-044 and in the Assumptions' inherited-constraints list — React Aria's drag and drop, and the fractional-indexing scheme. Both are fixed by `docs/product/specifications.md` §7 as product-level constraints rather than chosen here, and the same treatment was accepted in the entry R9 checklist; no requirement in this specification selects a technology of its own.
- Seven decisions were made where the source is silent and are recorded under *Defaults chosen because the source is silent* rather than left as markers: grouping is not persisted; priority lane order; assignee lane order after Unassigned; a lane outside the assignee pool accepts no drop; the composer's create waits for the server; an unproducible index refuses the drop; a vanished drop target reports as a missing row.
- One reconciliation carries scope weight and is recorded under *Reconciliations*: `moveIssue` writes one `field_changed` activity row on a cross-lane drop, which the roadmap's R10 row neither includes nor defers and which `docs/product/specifications.md` §3.4 and §5 together require.
