<!--
SYNC IMPACT REPORT
Version change: 1.0.0 → 1.1.0
Rationale: MINOR. Technology Constraints is materially expanded — the deferred
TEST_RUNNER decision is resolved and the project's approved dependency set is recorded.
No principle is removed, redefined or weakened, so no migration plan is required.

Amendment 1.1.0 — Testing stack and dependency approvals:
- TODO(TEST_RUNNER) resolved. Vitest adopted as the single test runner, with jsdom,
  @testing-library/react and @vitejs/plugin-react, all devDependencies.
- Rationale for departing from the Principle IV-preferred `node:test`: Node strips
  TypeScript types but does not transform JSX, so `node:test` cannot execute a `.tsx`
  test at all (verified: ERR_UNKNOWN_FILE_EXTENSION). React Aria keyboard, focus and
  ARIA behaviour is a stated product requirement, so component behaviour is testable
  surface the team is accountable for. Adopting `node:test` would have required a second
  runner for that half, leaving two runners, two assertion APIs and two configs
  permanently. Vitest covers server logic and component behaviour with one tool and one
  approval. As devDependencies these carry no production bundle weight.
- Approved dependency set recorded, closing the gap where libraries the product
  specification mandates were installed or pending without a recorded approval.

Prior version below.

Version change: (unfilled template) → 1.0.0
Rationale: Initial ratification. The prior file was the unpopulated scaffold with no
adopted principles, so this is the first governing version rather than an amendment.

Modified principles:
- [PRINCIPLE_1_NAME] → I. Component-Driven Architecture
- [PRINCIPLE_2_NAME] → II. Validated Input Boundaries
- [PRINCIPLE_3_NAME] → III. Straightforward Over Clever
- [PRINCIPLE_4_NAME] → IV. Built-In Features Over Third-Party Libraries
- [PRINCIPLE_5_NAME] → V. Intention-Revealing Code Without Comments
- (new slot) → VI. No Dead Code
- (new slot) → VII. Test-First Development (NON-NEGOTIABLE)

Added sections:
- Technology Constraints (was [SECTION_2_NAME])
- Development Workflow (was [SECTION_3_NAME])
- Governance rules populated

Removed sections: none

Deferred items: none. TODO(TEST_RUNNER) is resolved in 1.1.0.
-->

# One Team Constitution

## Core Principles

### I. Component-Driven Architecture

Every user-facing surface MUST be composed from focused components, each owning a single
concern. A component that grows complex enough to handle unrelated responsibilities MUST be
broken down along those responsibilities. Shared abstractions MUST NOT be created
speculatively: a pattern MUST appear in at least two call sites before it is extracted into a
shared component, hook, or module. Large files MUST be split when their size or mixed concerns
obscure intent, but splitting MUST stop short of fragmenting the codebase into many trivial
files.

Rationale: Focused components are independently readable, testable, and replaceable.
Extracting on first use guesses at a shape the second call site has not yet confirmed, and the
resulting abstraction is usually wrong in ways that are expensive to unwind. The
anti-fragmentation limit exists because navigation cost is a real cost: a codebase of
one-export files is no clearer than a codebase of god-files.

### II. Validated Input Boundaries

All user-supplied input MUST be strictly validated and sanitized before it is processed or
persisted. This applies to every entry point without exception: form submissions, request
bodies, query parameters, route parameters, headers, and any value that originates outside the
running process. Validation MUST run on the server for every request that reads or writes data,
regardless of whether an equivalent client-side check exists. Input failing validation MUST be
rejected with an explicit error; it MUST NOT be silently coerced, truncated, or partially
accepted.

Rationale: The database is the only copy of the data, so anything that reaches persistence is
authoritative and permanent. Client-side validation is a user-experience affordance and is
trivially bypassed; it is never a security control.

### III. Straightforward Over Clever

Implementation MUST prefer straightforward, readable solutions over clever abstractions. When
two implementations satisfy the same requirement, the one a reader understands without
tracing indirection MUST be chosen. Indirection, metaprogramming, dynamic dispatch, and generic
machinery MUST be justified by a concrete requirement present in the codebase today, not by an
anticipated one.

Rationale: Code is read far more often than written. Cleverness front-loads a small authoring
convenience against a recurring comprehension cost paid by every subsequent reader, including
the original author.

### IV. Built-In Features Over Third-Party Libraries

Built-in language, runtime, and framework features MUST be preferred over third-party
libraries. Before proposing a dependency, the contributor MUST establish that no built-in
capability of TypeScript, the Node.js runtime, the Web platform, React, or Next.js covers the
need. Installing a new third-party dependency MUST NOT occur without explicit team approval,
recorded before the dependency is added. This applies to transitive-weight additions and
developer tooling alike.

Rationale: Every dependency is a permanent liability: supply-chain exposure, version drift,
bundle weight, and an upgrade obligation the team did not choose. Built-in features carry none
of these and are already covered by the platform's own support commitments.

### V. Intention-Revealing Code Without Comments

Code MUST communicate intent entirely through clear structure and intention-revealing naming.
Inline comments, block comments, and in-body explanations are prohibited. When code is unclear,
the remedy is renaming, extraction, or restructuring the code itself — never annotation.
Machine-readable directives the toolchain requires in order to function (for example, type
checker or linter suppression pragmas) are not explanatory comments and are outside this
prohibition, but every such directive MUST be the minimum scope that resolves the issue.

Rationale: A comment is an unverified claim that drifts from the code it describes, and
reviewers cannot test it. Naming and structure are checked by the compiler, the linter, and
every reader, so intent expressed through them cannot silently go stale.

### VI. No Dead Code

Dead code is prohibited. Unused imports, variables, functions, types, exports, and unreachable
code paths MUST be removed before any commit. Code that is retained for possible future use
MUST be deleted; version control is the mechanism for recovering it. Commented-out code is
prohibited under Principle V and is likewise removed rather than preserved.

Rationale: Dead code is indistinguishable from live code during review and search, so it
inflates the apparent surface area of every change, misleads readers about what the system
actually does, and is maintained at real cost by people who cannot tell it is unreachable.

### VII. Test-First Development (NON-NEGOTIABLE)

All production code MUST be written using the Red-Green-Refactor cycle: write a failing test
first, write the minimal code required to make it pass, then refactor for quality while the
test stays green. No production code may be written without a corresponding failing test
written beforehand. The test MUST be observed failing for the intended reason before any
implementation is written; a test that passes on first run is not a valid Red step and MUST be
corrected before proceeding.

Rationale: A test written after the implementation confirms what the code does, not what it was
required to do, and it has never been demonstrated to fail. Observing the Red step is the only
evidence that the test can detect the defect it claims to guard against.

## Technology Constraints

The stack is Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, and Biome for
formatting and linting. Additions to this stack are dependency decisions governed by
Principle IV and require explicit team approval.

The following dependencies are approved under Principle IV. This list is the record that
principle requires, and it is the complete set: anything absent from it needs its own
approval, recorded here by amendment before it is installed.

| Dependency | Purpose | Scope |
| --- | --- | --- |
| `drizzle-orm`, `drizzle-kit`, `postgres` | PostgreSQL access, schema and migrations | runtime, tooling |
| `react-aria-components` | Interaction behaviour, focus management, keyboard support and ARIA semantics | runtime |
| `@node-rs/argon2` | Argon2id password hashing | runtime |
| `nodemailer` | Notification mail over operator-supplied SMTP | runtime |
| `uuidv7` | Time-ordered primary keys | runtime |
| `fractional-indexing` | Board ordering index | runtime |
| `@next/env`, `server-only` | Environment loading, server-boundary enforcement | runtime |
| `vitest`, `jsdom`, `@testing-library/react`, `@vitejs/plugin-react` | Test runner and component testing | development |

Tailwind supplies the visual layer only; interaction behaviour comes from React Aria
Components. A component is custom-built only where React Aria ships no equivalent, and it
MUST reproduce the same keyboard, focus and ARIA behaviour.

This Next.js major version carries breaking changes against widely known conventions. Before
writing framework-level code, contributors and agents MUST consult the version-specific guides
resolved from `node_modules/next/dist/docs/` rather than relying on recalled API knowledge,
as directed by `AGENTS.md`.

The application is server-authoritative: the database is the single copy of the data and every
read is a query against it. Principle II is enforced at the server boundary on this basis.

Testing runs on Vitest, invoked by `npm test`. It is the single runner for both server-side
logic and component behaviour, so the project carries one assertion API and one configuration.
Component tests run against jsdom with `@testing-library/react`.

Vitest was adopted over the Principle IV-preferred `node:test` because Node strips TypeScript
types but does not transform JSX, so `node:test` cannot execute a `.tsx` test. Splitting the
suite across two runners to cover component behaviour was judged a larger and permanent cost
than one approved devDependency tree that carries no production bundle weight.

Tests that exercise persistence MUST run against a real PostgreSQL instance, not a mocked
database: invariants are enforced by database constraints and row locks, which a mock cannot
verify. `docker-compose.yml` provides a suitable instance.

## Development Workflow

Every change MUST satisfy the following gates before it is committed:

1. A test exists that was written before the implementation and was observed failing (VII).
2. The implementation is the minimal code that makes that test pass, followed by refactoring
   with the test green (VII).
3. Every input boundary the change touches validates and sanitizes on the server (II).
4. No new third-party dependency was added without recorded team approval (IV).
5. `npm run lint` passes with no findings.
6. The diff contains no comments, no commented-out code, and no dead code (V, VI).
7. Every changed line traces to the stated requirement; adjacent code is left untouched.
8. `npm test` passes with no failing or skipped tests.

Code review MUST verify each gate explicitly. A reviewer who cannot determine from the diff
that a test was written first MUST request that evidence before approving. Changes that
violate a principle MUST be corrected or accompanied by an approved amendment; they MUST NOT be
merged on the strength of an informal exception.

## Governance

This constitution supersedes all other development practices, conventions, and preferences. Where
a style guide, prior habit, or agent default conflicts with a principle here, this document wins.

Amendments MUST be proposed as a change to this file, MUST state the rationale for the change,
and MUST be approved by the team before merge. An amendment that removes or materially weakens a
principle MUST additionally state its migration plan for code written under the prior rule.

Versioning follows semantic versioning:

- MAJOR: a principle is removed, or redefined in a way that invalidates code compliant with the
  prior version.
- MINOR: a principle or section is added, or existing guidance is materially expanded.
- PATCH: clarifications, wording, and non-semantic refinements that leave obligations unchanged.

Compliance is reviewed on every pull request against the gates in Development Workflow. Agents
and contributors MUST read this constitution before beginning work and MUST treat `AGENTS.md`
as the source of runtime, framework-specific guidance.

**Version**: 1.1.0 | **Ratified**: 2026-08-27 | **Last Amended**: 2026-08-27
