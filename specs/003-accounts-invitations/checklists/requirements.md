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

Each of the ten is **discharged** rather than merely cited — the requirement named carries the whole
of the index row, not a part of it. `OT-SEC-002`'s count is stated and closed (FR-024). `OT-SEC-003`
is in three parts and each has its own requirement: no public sign-up and only two origins (FR-035),
the seven-day single-use link (FR-013), and members refused on the server (FR-012). `OT-SEC-013`'s
session deletion is FR-045, its sign-in revocation FR-046, its retention FR-047, and the membership
half FR-051 — vacuously true until entry R5 creates a membership row, which the *Reconciliations*
note records. `OT-SEC-016` is completed by FR-032, entry R1 having delivered the same three states
for Change password. `OT-AUTHZ-006` is FR-040 for this screen's count only, the other two lists
being R5's. `OT-AUTHZ-011` is in two parts — no UI sets a role (FR-029, FR-042) and invitation and
deactivation do have one (FR-001, FR-042). `OT-AUTHZ-014` is FR-047 in full. `OT-DATA-005` is
FR-039, `OT-UX-011` is FR-006, and `OT-INV-013` is FR-049 with the lock it shares with entry R1.

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
  where it is labelled as inherited. Two requirements name an enforcement mechanism rather than only
  an outcome — FR-049's active-admin row lock and FR-009a's unique index over unspent invitations —
  because each states an invariant that holds only under concurrency, which `AGENTS.md` requires be
  carried by a constraint or a lock rather than by a read followed by a write. Naming the mechanism
  is what makes the invariant testable; the shape of the migration remains the plan's.

- **`OT-UX-005`, `-006`, `-016` and `-017` are settled on this entry, and no longer contingent.**
  Entry R2 originally deferred them to whichever of R3 and R4 was built first. Ownership now follows
  the first caller instead: R3 holds it for all four, R2 had already broken the same tie the same way
  for `OT-UX-002`, and R4's spec already consumes them as their second caller. `docs/ROADMAP.md` is
  amended under §5 and entry R2 is reconciled to it, so FR-054 to FR-059 stay here whatever order the
  team builds in and no scenario above depends on a scheduling decision.

- **Two source tensions are reconciled rather than assumed, and each is now closed to its mechanism.**
  §3.9 offers "a link to it" beside an address that already has an account while the same section
  states the tab is "local page state, not a route — there is nothing to link to", and §3.12 adds
  that no route exists to view another user's profile. The affordance is therefore an in-page control
  that moves the page's own tab state and brings the row into view, not an anchor (FR-008), and it
  names Reactivate where the account is closed (FR-008a). And §3.9's "revoke ... drops the row"
  against §3.1's requirement that a used token be distinguishable from an unknown one forces
  acceptance to *retain* the invitation while revoke deletes it (FR-031, FR-032); retention is
  indefinite, since any sweep horizon would collapse that distinction (FR-031a), and the "one live
  offer per address" rule that the asymmetry leaves standing is held by a unique index over unspent
  rows rather than by a read-then-write (FR-009a). None of the four is left to the plan.

- **FR-040's project count is verified as zero.** The roadmap has the roster read `project_member`
  rows, which entry R5 creates, "and reads zero until then". The assertion this feature's tests make
  is that zero; R5 makes the same column report real numbers without changing this screen's
  contract.

- Items marked incomplete require spec updates before `/speckit-clarify` or `/speckit-plan`.
