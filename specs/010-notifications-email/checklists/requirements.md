# Specification Quality Checklist: Notifications and email

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-06
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
- The table, column and constraint vocabulary in FR-001 to FR-009 restates `docs/product/specifications.md` §5, which fixes the data model as a product-level constraint rather than a choice made here, with one deliberate exception: FR-007's send-attempt count widens §5's field list, for the reason FR-007 states and the *Reconciliations* bullet below records. The same treatment was accepted in the entry R7 and R9 checklists. No requirement in this specification selects a technology of its own, and FR-075 forbids adding one.
- Seven decisions were made where the source is silent and are recorded under *Defaults chosen because the source is silent* rather than left as markers: the list is bounded at the 200 most recent rows with no page control; the unread count renders nothing at zero; the retry schedule spreads three retries across the hour, each falling due on the row's own age; the message is plain text and its wording is not fixed; a recipient deactivated after the row is written still receives it; a duplicate message is preferred to a lost one; a mark-read write that fails during row activation is silent.
- A `/speckit-clarify` session on 2026-09-06 settled twelve points from the sources and recorded them under *Clarifications* in the spec: `markNotificationRead`'s only surface is row activation (§3.6, §3.2); the three retries are sweep retries following one immediate send, so a row sees at most four attempts (`OT-OPS-002`, `OT-OPS-007`); the first attempt belongs to the request's own process; the board's inline composer is `createIssue`, not a fourth assignment path (§3.6); the row carries its own send-attempt count so that bound survives a restart; "Mark all read" drops the sidebar count to zero as part of the mutation; the list is bounded at the 200 most recent rows; the mail is plain text; a mark-read write that fails during activation lets the navigation through silently; that send-attempt count includes the immediate attempt, so it starts at 0, reads 1 after the immediate send and stops the sweep at 4; it is incremented only once an attempt has returned, which is why a crash mid-send may produce a duplicate message; and a row falls due for its next attempt on its own age — count × 15 minutes — rather than on the sweep's tick.
- Four reconciliations are recorded under *Reconciliations*, one of which carries scope weight: the notification row carries a send-attempt count that widens §5's field list, because `OT-OPS-002`'s "up to three times" is not enforceable without it; the field reaches no read endpoint and no DTO. The other three record where the roadmap, the requirements index and the specification each attribute the same rule to a different slice.
- The `read_at` and `emailed_at` semantics, the own-`user_id` read rule and the three types are quoted from §3.6 and §5 verbatim in substance; where this specification and either source disagree, the source wins, except where this specification records a deliberate widening together with its reason — FR-007's send-attempt count is the only such widening, and it is an exception to this rule rather than a disagreement it settles.
