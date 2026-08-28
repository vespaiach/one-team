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

Amendment **v1.4.1** condensed the runtime and framework guidance `AGENTS.md` hosts, removing
the restatements of Principles II, IV and VII and the general-practice material an agent applies
without instruction, and recording two facts the prior text omitted: Biome fails `style-check`
on unused imports and variables, so gate 5 enforces most of VI mechanically, and `npm test` runs
with `--passWithNoTests`, so gate 8 is green on an empty suite and is not on its own evidence of
VII. No principle, technology constraint or change gate changed its obligation, numeral or number,
which is why this is a PATCH; the team may record it as MINOR instead, since the versioning scheme
above has no category for a reduction in guidance.

**Version**: 1.4.1 | **Ratified**: 2026-08-27 | **Last Amended**: 2026-08-28
