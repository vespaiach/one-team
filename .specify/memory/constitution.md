<!--
Sync Impact Report
- Version change: template (unfilled) → 1.0.0 (initial ratification)
- Principles defined:
  - I. Spec Is Authoritative
  - II. One Roadmap Slice per Feature
  - III. Test-First Against Acceptance Criteria (NON-NEGOTIABLE)
  - IV. Server-Side Security
  - V. Data Integrity
  - VI. Simplicity
- Added sections: Operational Constraints; Development Workflow and Quality Gates; Governance
- Removed sections: none
- Templates: plan-template.md "Constitution Check" reads gates from this file at runtime;
  no template edits needed.
- Deferred TODOs: none
-->

# One Team Constitution

## Core Principles

### I. Spec Is Authoritative

- `docs/one-team-spec.md` (SPEC-001) defines all One Team behavior, permissions, data rules
  and acceptance criteria. Plans, tasks and code MUST NOT add, change or drop behavior that
  SPEC-001 does not describe.
- Feature specs MUST reuse SPEC-001's REQ, SEC, DATA, OPS, NFR, AC and TEST IDs unchanged.
  They MUST NOT invent new IDs for behavior SPEC-001 already covers, reword a requirement so
  its meaning changes, or redefine an ID.
- If a feature spec, plan, this constitution or the code conflicts with SPEC-001, or SPEC-001
  is silent on something the work needs, work on the affected part MUST stop until the owner
  records a resolution as a DEC entry in SPEC-001 section 15 and the spec is updated.
- The fix for a mismatch is always to the downstream artifact (feature spec, plan, code),
  never a silent reinterpretation of SPEC-001.

Rationale: SPEC-001 is the single source of truth and its IDs are append-only; traceability
from requirement to acceptance to test breaks the moment a slice restates it.

### II. One Roadmap Slice per Feature

- Each spec-kit feature MUST implement exactly one `ROADMAP.md` entry (R1 to R20, or a split
  R*n*a, R*n*b recorded in the roadmap first) and its home requirements. It MUST NOT build
  requirements whose home is another slice.
- A slice MUST NOT start until every slice it depends on is `done`.
- Each feature spec MUST list the rows of the roadmap's "Requirements that span slices"
  table that apply to it, and MUST meet them for its own features (for example SEC-026 for
  each state-changing request, SEC-002 and SEC-009 for each project resource, REQ-071 for
  each form, NFR-003 for each UI).
- A change of slice scope MUST be made in `ROADMAP.md` first, then in the affected specs.

Rationale: small, dependency-ordered slices keep each spec-kit cycle testable, and the
spanning table stops later slices from quietly dropping cross-cutting rules.

### III. Test-First Against Acceptance Criteria (NON-NEGOTIABLE)

- Every acceptance criterion of a slice's home requirements MUST have an automated test
  under the TEST ID SPEC-001 links it to, written before the code that satisfies it and
  seen to fail first.
- Where SPEC-001 names a manual or operational check instead (for example TEST-014,
  TEST-015, TEST-017), that check MUST be performed and its result recorded before the
  slice is done.
- A slice is `done` only when every one of its acceptance criteria passes, together with
  the full existing test suite, for everything built so far.
- Readiness MUST NOT be claimed from static checks or local runs alone where SPEC-001
  requires a production check.

Rationale: SPEC-001 maps every requirement to acceptance criteria and tests; building
against them first is the only proof a slice does what the spec says.

### IV. Server-Side Security

- All authorization checks MUST live in one server-side layer that every read and every
  write goes through. Client-side checks MAY hide controls but MUST NOT be the only check.
- That layer MUST read the user's state, role and project memberships from the database on
  every request; the session stores only the user's identity (SEC-019).
- State changes MUST happen only through non-GET requests whose Origin header matches the
  app's own origin (SEC-026). GET handlers MUST NOT change state.
- Sign-in, invitation and session tokens MUST have at least 128 bits of randomness, and only
  their hashes are stored (SEC-027).
- Logs MUST NOT contain sign-in or other tokens, secrets, or comment text (SEC-018).
  Secrets live only in the VPS environment file, outside the repository (SEC-015).

Rationale: one enforced layer is the only way permission rules stay consistent across
twenty slices; the rest are SPEC-001 security requirements that apply to every slice.

### V. Data Integrity

- Each user action MUST commit its data change together with its activity events,
  notification records and outgoing email records in one database transaction. Emails are
  sent after commit from those stored records, never held only in memory (OPS-005).
- Activity events MUST be append-only and never altered after they are written (DATA-003).
- Database migrations MUST be additive only: new tables, or new columns that are nullable
  or have a default, so the previous release runs on the current schema (OPS-004). No
  migration may drop, rename or retype a column or table.

Rationale: a partial write leaves feeds, notifications and emails out of step with the
data; additive migrations are what make SPEC-001's rollback (redeploy the previous
version) safe.

### VI. Simplicity

- The stack is fixed: Next.js, PostgreSQL and Drizzle ORM, on one VPS, with uploaded files
  on the VPS's local disk.
- Work MUST NOT add services, processes or infrastructure SPEC-001 does not require (no
  separate queue, cache, search engine, object store, real-time channel or staging
  environment). The only external services are those SPEC-001 names: the email vendor
  (DEP-001, DEC-011), off-VPS backup storage (DEP-002) and the uptime monitor (OPS-003).
- Work MUST NOT add abstractions, feature flags, settings or configurability beyond what
  SPEC-001 requires. Direct, readable code is preferred over layers built for hypothetical
  reuse.
- Any exception MUST be justified in the plan's Complexity Tracking table, and anything
  that changes the architecture baseline needs a DEC in SPEC-001 first.

Rationale: a small team on one VPS gains nothing from extra moving parts, and every one
adds operating and backup work the owner has to carry.

## Operational Constraints

- Environments: local development and the production VPS only (SPEC-001 section 11).
- Logs: structured, written to a file on the VPS, kept 14 days, each entry with a request ID
  (OPS-002). Security events are logged as SEC-028 lists.
- Email: invitation and notification emails are sent from stored records and retried at 1, 4
  and 10 minutes, then dropped and logged (OPS-001). Pending emails survive restarts.
- Backups: nightly database dump and uploads copy to off-VPS storage, last 14 kept
  (OPS-006).
- Scope limits in SPEC-001 (desktop browsers only and no real-time updates, section 14;
  English only, DEC-016) are accepted and MUST NOT be worked around without a DEC.

## Development Workflow and Quality Gates

- Each slice follows `ROADMAP.md` "Running a slice": `/speckit-specify` → `/speckit-clarify`
  → `/speckit-plan` → `/speckit-tasks` → `/speckit-implement`, with the spec's Input line
  pointing at its roadmap entry and SPEC-001.
- Every plan MUST pass the Constitution Check before research and again after design. The
  gates are Principles I to VI above; each unmet gate is either fixed or recorded in
  Complexity Tracking with its justification.
- Every tasks list MUST include the test tasks for each acceptance criterion ahead of the
  implementation tasks they verify (Principle III).
- Before a slice is marked `done`: static checks (type check and Biome lint) pass, the full
  automated suite passes, the slice's manual checks are recorded, and its spanning rules are
  met. Then its roadmap status and SPEC-001 section 4 requirement statuses are updated.
- Code review MUST check each change against these principles, in particular the single
  authorization layer, one-transaction writes, additive migrations and log content.

## Governance

- This constitution governs how One Team is built. SPEC-001 governs what it does. Where the
  two conflict, work stops until the owner resolves it with a DEC in SPEC-001 and, if
  needed, an amendment here.
- Amendments are made only by the owner (the sole decision owner in SPEC-001), by editing
  this file with the reason stated in the change's commit or pull request.
- Versioning follows semantic versioning: MAJOR for removing or redefining a principle,
  MINOR for adding a principle or materially expanding guidance, PATCH for wording and
  clarifications. The owner decides when the version changes.
- Compliance is checked at every plan's Constitution Check and in every code review. A
  deviation is allowed only with a justification in the plan's Complexity Tracking table.

**Version**: 1.0.0 | **Ratified**: 2026-09-25 | **Last Amended**: 2026-09-25
