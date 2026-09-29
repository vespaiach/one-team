<!--
Sync Impact Report
- Version change: template (unversioned) → 1.0.0
- Principles defined (template placeholders → new titles):
  - [PRINCIPLE_1_NAME] → I. Simplicity First
  - [PRINCIPLE_2_NAME] → II. No Dead Code
  - [PRINCIPLE_3_NAME] → III. No Code Comments
  - [PRINCIPLE_4_NAME] → IV. Dependency Approval
- Removed sections: fifth principle slot (four principles requested)
- Added sections: Development Constraints, Development Workflow, Governance
- Deferred TODOs: none
-->

# Tracklite Constitution

## Core Principles

### I. Simplicity First

- Every change MUST use the simplest solution that meets the spec's requirements.
- Code MUST NOT add abstractions, layers, generic helpers or configuration options that serve
  only one current use or a speculative future need.
- Direct, concrete code is preferred over indirection; duplication of a few lines is acceptable
  when an abstraction would be harder to read.
- Any unavoidable complexity MUST be justified in the plan's Complexity Tracking table.

**Rationale**: Simple code is faster to build, review and change, and the product's scope does
not call for frameworks of our own.

### II. No Dead Code

- Unused code, functions, variables, imports, types, exports, files, routes, styles, assets and
  dependencies MUST be removed in the same change that makes them unused.
- Code MUST NOT be kept "for later", commented out, or left behind unused feature flags.
- Pre-existing dead code found outside the change's scope MUST be reported, and removed in its own
  change.

**Rationale**: Dead code misleads readers and reviewers and costs maintenance for no value;
version control already keeps history.

### III. No Code Comments

- Source code MUST NOT contain comments, including doc comments and commented-out code.
- Intent MUST be expressed through clear names, small functions, types and tests instead.
- The only exception is a machine-read directive that a tool requires to work (for example a
  lint-disable or type-check directive), kept to the single line that needs it.

**Rationale**: Comments drift from the code they describe; names and tests stay checked.

### IV. Dependency Approval

- No external or third-party package (runtime, dev, CLI tool or service SDK) may be installed or
  added to a manifest without asking the project owner first and receiving explicit approval.
- The request MUST state the package, what it is for, and why the platform, the existing
  dependencies or a small amount of our own code cannot do the job.
- Upgrading or removing an existing dependency does not need prior approval, but MUST be called
  out in the change description.

**Rationale**: Every dependency adds security, maintenance and upgrade cost; the owner decides
whether that cost is worth paying.

## Development Constraints

- Features MUST be built on the stack and dependencies already approved for the project; a plan
  that needs a new package MUST list it as an open question for approval before implementation.
- Behavior is defined by `docs/tracklite-spec.md`; the division of work is defined by
  `ROADMAP.md`.

## Development Workflow

- Every plan MUST pass a Constitution Check against the four principles before design and again
  after design.
- Every review MUST confirm: no unnecessary abstraction, no unused code or files, no comments, and
  no unapproved dependencies.
- A change that violates a principle MUST NOT be merged until it is fixed or the violation is
  justified and accepted in the plan.

## Governance

- This constitution supersedes other development practices when they conflict.
- Amendments are made by updating this file through a reviewed change that states the reason and
  updates the version and Last Amended date.
- Versioning follows semantic versioning: MAJOR for removing or redefining a principle, MINOR for
  adding a principle or section or materially expanding guidance, PATCH for clarifications and
  wording.
- Compliance is checked in every plan's Constitution Check and in every code review.

**Version**: 1.0.0 | **Ratified**: 2026-09-29 | **Last Amended**: 2026-09-29
