# Specification Quality Checklist: Accounts and invitations

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

Entry **R3** assigns ten requirement IDs. Each is cited by at least one functional requirement:

| Assigned ID | Covered by |
|---|---|
| `OT-SEC-002` | FR-024 |
| `OT-SEC-003` | FR-012, FR-013, FR-035 |
| `OT-SEC-013` | FR-045, FR-046, FR-047 |
| `OT-SEC-016` | FR-032 |
| `OT-AUTHZ-006` | FR-040 |
| `OT-AUTHZ-011` | FR-029, FR-042 |
| `OT-AUTHZ-014` | FR-047 |
| `OT-DATA-005` | FR-039 |
| `OT-UX-011` | FR-006 |
| `OT-INV-013` | FR-049 |

Twenty-one further IDs are cited without being assigned, because the roadmap fixes them elsewhere and
this feature is a caller rather than their owner. Citing them is not a claim on them.

| Cited ID | Owner | Cited by |
|---|---|---|
| `OT-SCOPE-005` | the whole epic | FR-016, Out of Scope |
| `OT-SCOPE-007` | R2 | FR-001 |
| `OT-SEC-004`, `OT-SEC-019` | R1 | FR-027 |
| `OT-SEC-006` | R1 | FR-014 |
| `OT-SEC-015` | R1 | FR-002 |
| `OT-SEC-018` | R1 | FR-033 |
| `OT-DATA-006` | R1 | FR-015 |
| `OT-AUTHZ-004` | R1 | FR-060 |
| `OT-AUTHZ-005`, `OT-AUTHZ-012` | R2 | FR-061, FR-062 |
| `OT-UX-001` | R2 | FR-025 |
| `OT-UX-002` | R2 | FR-050 |
| `OT-UX-005`, `OT-UX-006`, `OT-UX-016`, `OT-UX-017` | R2 | FR-054…FR-057 |
| `OT-UX-007` | R2 | FR-023 |
| `OT-UX-019` | R2 | FR-038 |
| `OT-UX-003` | R2 | Out of Scope |
| `OT-UX-008` | R5 | Assumptions |
| `OT-UX-010` | R5 | FR-026 |
| `OT-OPS-004` | R11 | Out of Scope |
| `OT-INV-016` | R1 | FR-010, FR-034 |
| `OT-INV-017` | R1 | Out of Scope |

## Notes

- **On "no implementation details".** The specification names 32-byte secrets stored as SHA-256
  digests, Argon2id hashing and the two `user` projections as product requirements, by ID
  (`OT-SEC-006`, `OT-SEC-005`, `OT-DATA-005`). Restating them is traceability to a decision already
  taken upstream, not a technical choice this document makes. Everything that *is* a choice — the
  ORM, the runtime, the mutator shape — appears only under *Assumptions → Inherited constraints*,
  where it is labelled as inherited.

- **`OT-UX-005`, `-006`, `-016` and `-017` are the one genuinely contingent block.** Entry R2 defers
  them to "R3 or R4, whichever is built first". This spec takes R3 as first — it is on the critical
  path and R5 depends on it, while R4 is explicitly parallel and off it — and carries FR-054 to
  FR-059 accordingly. If the team builds R4 first, those six requirements move there and this
  feature simply consumes them. **This is the first question `/speckit-clarify` should put to the
  team**, because it is the only assumption in the document that changes what is built rather than
  how a detail behaves.

- **Two source tensions are reconciled rather than assumed.** §3.9 offers "a link to it" beside an
  address that already has an account while §3.12 states no route exists to view another user's
  profile — the link is resolved to that account's row on the Accounts tab, the only surface that
  shows another user's account. And §3.9's "revoke ... drops the row" against §3.1's requirement
  that a used token be distinguishable from an unknown one forces acceptance to *retain* the
  invitation while revoke deletes it; that asymmetry is stated in FR-031 and FR-032 rather than left
  to the plan.

- **FR-040's project count is verified as zero.** The roadmap has the roster read `project_member`
  rows, which entry R5 creates, "and reads zero until then". The assertion this feature's tests make
  is that zero; R5 makes the same column report real numbers without changing this screen's
  contract.

- Items marked incomplete require spec updates before `/speckit-clarify` or `/speckit-plan`.
