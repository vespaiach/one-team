# Specification Quality Checklist: Comments and activity feeds

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

## Requirements coverage

Entry **R7** assigns fifteen requirement IDs. Each is cited by at least one functional requirement:

| Assigned ID | Covered by |
|---|---|
| `OT-AUTHZ-007` | FR-024 |
| `OT-AUTHZ-008` | FR-016 |
| `OT-AUTHZ-009` | FR-003, FR-018 |
| `OT-AUTHZ-014` | FR-017, FR-023 |
| `OT-DATA-009` | FR-045, FR-050, FR-051, FR-052, FR-053, FR-055, FR-056 |
| `OT-DATA-010` | FR-007, FR-008, FR-030, FR-051, FR-056 |
| `OT-DATA-011` | FR-001, FR-002 |
| `OT-DATA-014` | FR-010, FR-022 |
| `OT-DATA-016` | FR-010 |
| `OT-DATA-020` | FR-050, FR-053 |
| `OT-UX-013` | FR-027, FR-028 |
| `OT-UX-014` | FR-006, FR-033 |
| `OT-UX-015` | FR-031, FR-032 |
| `OT-INV-010` | FR-001, FR-002 |
| `OT-INV-011` | FR-003, FR-018 |

Ten further IDs are cited without being assigned, because the roadmap fixes them elsewhere and this
feature is either exercising them again or is a material caller. Citing them is not a claim on them:

- **Entry R1's conventions** — `OT-DATA-001`, `-002`, `-003` (FR-001, FR-002, FR-005, FR-041),
  `OT-DATA-013` (FR-009).
- **Entry R2's shell and cross-cutting UX** — `OT-AUTHZ-005` (FR-019, FR-049), `OT-AUTHZ-012` (FR-020),
  `OT-UX-002` (FR-021, FR-035), `OT-UX-005` (FR-060), `OT-UX-006` (FR-036), `OT-UX-008` (FR-037),
  `OT-UX-018` (FR-025, FR-038, FR-061).
- **Entry R5's write boundary and record** — `OT-AUTHZ-004` (FR-015), `OT-AUTHZ-013` (FR-053, the
  second half of a rule R5 could only deliver in part), `OT-UX-009` (FR-043, the in-place gesture this
  feature's comment editor reuses without owning it).
- **Entry R6's issue detail conventions** — `OT-UX-021` (FR-035), applied here to the composer rather
  than to Create issue's own entry points.
- **Entry R2's display-name rule** — `OT-UX-019` (FR-022), which a resolved mention exercises the same
  way every actor name on the feed already does.
- **The whole epic** — `OT-SCOPE-005` (*Out of Scope*), naming real-time push and live collaboration
  as the things this feature's feed deliberately does not gain, and `OT-AUTHZ-002` (FR-014, FR-046),
  the read boundary every comment and activity row is checked against.

## Notes

- **On "no implementation details".** The specification names UUIDv7 primary keys, `text`+`CHECK`
  enumerations, database-level cascades, one-transaction writes, and the one named exception to
  React Aria first (`Popover` + `ListBox` for `@mention`) as product requirements, by ID or by direct
  citation of `AGENTS.md` and specification §7. Restating them here is traceability to a decision
  already taken upstream — most of it inherited from entry R1's conventions or fixed by §5 and §7 of
  the product specification itself — not a technical choice this document makes. Everything that *is*
  a choice belongs to the plan this spec feeds, not to this document.
- **FR-001 through FR-013 carry no user journey.** They are structural conventions — the two tables,
  the `feed_filter` column, and the one internal activity-writing primitive — verified against the
  schema and against the writes the database refuses, rather than through a screen; the spec states
  that verification basis inline, matching the convention entry R6's own structural section set.
- **The activity-writing primitive is specified as a requirement, not left to the plan.** The roadmap
  names it only in passing — "R7 establishes the writer, R9 writes the five column events through it"
  — without saying what shape it takes. FR-011 through FR-013 fix that shape: one function, called
  only from within an already-open transaction, that performs no authorization and computes no diff
  of its own, so R8 and R9 can call it directly once their own migrations widen `activity.type`'s
  `CHECK`. FR-012 states explicitly why building it now, before either later entry exists, does not
  violate Principle I: this feature alone gives it more than the two call sites the principle asks for.
- **The `CHECK` constraint's completeness is a judgment call, recorded rather than hidden.** The
  product specification's §5 lists all fourteen `activity.type` values in one sentence describing the
  schema's eventual shape; this feature writes seven of them. Rather than declaring all fourteen now,
  FR-004 follows the precedent entry R6 already set — a later entry widens an earlier entry's
  constraint only when it needs the new value — and the *Assumptions* section names the cost of that
  call being wrong: a migration for R8 and R9, nothing else.
- **Two rules that pull in opposite directions are both stated explicitly, because their proximity
  invites conflating them.** `OT-DATA-010` freezes an activity row's display strings at write time;
  `OT-DATA-014` resolves a mention token live on every read. FR-007 and FR-022 each name the other
  rule directly, so a reader of one is pointed at why the other is not a bug.
- **Two mutators entry R5 and entry R6 already shipped are edited, not called, by this feature.** The
  roadmap and both earlier child specs already recorded that R7 would do this; FR-050 through FR-058
  are the shape those edits take, and FR-054 and FR-057 are stated as their own requirements — the
  reach-back must not change what R5's or R6's existing acceptance scenarios and success criteria
  already promised — so a reviewer has something concrete to hold the eventual diff against.
- Items marked incomplete require spec updates before `/speckit-clarify` or `/speckit-plan`.
