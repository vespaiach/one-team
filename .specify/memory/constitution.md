<!--
SYNC IMPACT REPORT
Version change: 1.3.1 → 1.4.0
Rationale: MINOR. Technology Constraints and Development Workflow are materially reorganised: their
normative content moves to AGENTS.md, which 1.3.0 established as the primary source, and both
sections become pointers. One broken gate is corrected. No principle or gate is removed or
weakened, and no code compliant with 1.3.1 becomes non-compliant, so no migration plan is required.

Amendment 1.4.0 — constraints and gates follow the principles to AGENTS.md:
- Relocated to AGENTS.md verbatim: the approved-dependency table, the Tailwind/React Aria division,
  the server-authoritative rule, the Vitest/jsdom testing stack, the real-PostgreSQL rule for
  persistence tests, the eight change gates, and the reviewer's verification obligation.
- Gate 5 corrected. It required `npm run lint`, which has never existed in package.json; the gate was
  therefore unsatisfiable as written. It now requires `npm run style-check:ci`, the Biome check that
  CI actually runs. This restores the gate's original intent rather than changing it. AGENTS.md notes
  that `npm run verify` clears gates 5 and 8 together.
- Gate numbering is unchanged: eight gates, 1 to 8, so "gate 1" and "gate 8" in docs/ROADMAP.md still
  resolve.
- Dropped as false rather than relocated: the claim that `docker-compose.yml` provides a suitable
  PostgreSQL instance for tests. Its `postgres` service publishes no ports and sits on the internal
  network, so it is not reachable from a test run on the host. The obligation it accompanied — that
  persistence tests run against real PostgreSQL — is retained in full in AGENTS.md. Providing a
  reachable instance is open work, not a rule change.
- Retained here: the Vitest-over-`node:test` decision record, as the Principle IV departure it
  documents.
- Duplication removed: the paragraph directing contributors to `node_modules/next/dist/docs/`, which
  AGENTS.md already carries in its opening block.
- Modified principles: none. Added sections: none. Removed sections: none — both become pointers.
- Templates: no change required. Deferred items: none.

Version change: 1.3.0 → 1.3.1
Rationale: PATCH. The principles hosted in AGENTS.md are condensed for length. This is wording only:
every obligation is retained and the normative markers are unchanged in count and force — 23 MUST, of
which 3 are MUST NOT, plus 4 prohibitions, identical to 1.3.0. No principle is added, removed,
redefined or weakened, so no migration plan is required.

Amendment 1.3.1 — principles condensed:
- Each principle is now one paragraph: its obligations, then its rationale as a trailing italic
  sentence. Numerals, names and normative substance are unchanged; 830 words become 661.
- Principle IV additionally names where approval is recorded — the approved-dependency table in this
  file's Technology Constraints. That states an existing mechanism rather than adding one.
- Principle IV's rationale still names all four liabilities the 1.2.0 report cites.
- Modified principles: none in substance. Added sections: none. Removed sections: none.
- Templates: no change required. Deferred items: none.

Version change: 1.2.0 → 1.3.0
Rationale: MINOR. Existing guidance is materially reorganised and the authority relationship with
AGENTS.md is expanded. The seven principles move to AGENTS.md verbatim — numerals, names,
normative text and rationales unchanged — so no principle is removed, redefined or weakened, and
no code compliant with 1.2.0 becomes non-compliant. MAJOR is therefore not triggered and no
migration plan is required.

Amendment 1.3.0 — AGENTS.md becomes the primary source:
- Core Principles I–VII relocated to AGENTS.md verbatim. This section is retained as the citation
  index. Numerals and names are stable, so every existing citation still resolves: "(VII)",
  "(II)", "(IV)" and "(V, VI)" in Development Workflow, "Principle IV" in Technology Constraints,
  and "Principle I", "Principle VI", "Principle VII" across docs/ROADMAP.md.
- Rationale for the move: AGENTS.md is the only document loaded into every agent session — CLAUDE.md
  is a one-line import of it. Principles binding every change lived in a file agents were told to
  read but did not load by default, while AGENTS.md restated four of them (I, II, III, IV) in
  weaker words as "working principles". Two homes for one rule set had already drifted. One home,
  loaded by default, ends that.
- Governance updated: AGENTS.md is primary; where the two documents disagree, this file is
  reconciled to it. This file retains Technology Constraints, Development Workflow and the
  amendment procedure, and remains the version record for the principles it no longer hosts.
- Modified principles: none. Added sections: none. Removed sections: none.
- Templates: no change required. No template layer reproduces principle text.
- Deferred items: none.

Prior versions below.

Version change: 1.1.0 → 1.2.0
Rationale: MINOR. The approved dependency table gains a member. That table is normative —
Development Workflow gate 4 is checked against it — so recording a further approval materially
expands what Technology Constraints permits. No principle is added, removed, redefined or
weakened, so no migration plan is required.

Amendment 1.2.0 — React Compiler approval:
- babel-plugin-react-compiler added to the approved dependency set. It entered the tree with the
  create-next-app scaffold that seeded the repository, before this constitution existed, and is
  enabled by reactCompiler: true in next.config.ts. The table declares itself the complete set, so
  the record and the working tree disagreed about a dependency already running (roadmap RD-006).
- Approved rather than removed. The React Compiler is a first-party React capability reached
  through a Next.js configuration flag, and the package is Next's own optional peer dependency,
  not a library chosen in place of a built-in. As a devDependency it runs at build time and adds
  nothing to the production bundle, so of the liabilities Principle IV's rationale names it
  carries only the upgrade obligation React and Next already own.
- Modified principles: none. Added sections: none. Removed sections: none.
- Templates: no change required. No template layer references the dependency table.
- Deferred items: none.

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

The seven core principles are hosted in [`AGENTS.md`](../../AGENTS.md), which is the primary
source for how code is written in this repository. They are cited throughout this document and
across `docs/` by numeral and name:

| | Principle |
| --- | --- |
| I | Component-Driven Architecture |
| II | Validated Input Boundaries |
| III | Straightforward Over Clever |
| IV | Built-In Features Over Third-Party Libraries |
| V | Intention-Revealing Code Without Comments |
| VI | No Dead Code |
| VII | Test-First Development (NON-NEGOTIABLE) |

The numerals and names are stable and MUST NOT be renumbered. Amending a principle means editing
`AGENTS.md` under the Governance procedure below and recording the amendment in this file's
version history; this file remains the version record for the principles it no longer hosts.

## Technology Constraints

Refer to [`AGENTS.md`](../../AGENTS.md)

## Development Workflow

The eight gates every change MUST satisfy before it is committed, and the reviewer's obligation
to verify each one explicitly, are held in [`AGENTS.md`](../../AGENTS.md) under **Change gates**.
They are numbered 1 to 8 and cited by number; the numbering is stable and MUST NOT be changed.

## Governance

`AGENTS.md` and this constitution together supersede all other development practices,
conventions, and preferences. Where a style guide, prior habit, or agent default conflicts with a
core principle in `AGENTS.md`, or with a constraint or gate in this document, those two documents
win. Where the two themselves disagree, `AGENTS.md` is primary and this file is reconciled to it.

Amendments MUST be proposed as a change to this file, MUST state the rationale for the change,
and MUST be approved by the team before merge. An amendment that removes or materially weakens a
principle MUST additionally state its migration plan for code written under the prior rule.

Versioning follows semantic versioning:

- MAJOR: a principle is removed, or redefined in a way that invalidates code compliant with the
  prior version.
- MINOR: a principle or section is added, or existing guidance is materially expanded.
- PATCH: clarifications, wording, and non-semantic refinements that leave obligations unchanged.

Compliance is reviewed on every pull request against the change gates in `AGENTS.md`. Agents
and contributors MUST read `AGENTS.md` before beginning work — it carries the core principles and
this project's runtime and framework guidance — and MUST read this constitution for the decision
records, the version history, and the amendment procedure.

**Version**: 1.4.0 | **Ratified**: 2026-08-27 | **Last Amended**: 2026-08-28
