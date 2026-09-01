# Specification Quality Checklist: Board — grouping, drag and ordering

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-01
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

- The mutator name `moveIssue` and field names (`column_id`, `assignee_id`, `priority`, `sort_order`) are carried over verbatim from `docs/product/specifications.md` §5's data model and from entry R6's own spec — they are the product's own vocabulary, not an implementation choice this feature introduces.
- One scope question with real implications — whether `moveIssue` writes activity for the fields it changes — had no explicit answer in either the roadmap or a reasonable silence; it was resolved as a documented default (Assumptions → Reconciliations) rather than a [NEEDS CLARIFICATION] marker, because the specification's own §3.4 event list and entry R9's established precedent left only one reading that keeps §3.4 satisfied. Flagged for reviewer attention.
- All items pass; no iteration was required.
