<!--
Sync Impact Report
- Version change: 1.0.0 → 1.1.0
- Added principles: V. UI Design Gate
- Modified sections: Development Workflow (design gate before planning)
- Added templates: .specify/templates/design-template.md (used by /speckit-design)
- Templates checked: plan-template.md (Constitution Check reads this file; no change needed)
- Deferred TODOs: none; no design system yet, so Principle V covers layout, states, copy and
  keyboard only
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

### V. UI Design Gate

- Every slice that adds or changes a screen, overlay, email or other user-visible text MUST have a
  `design.md` in its feature directory with Status Frozen before `/speckit-plan` runs. A slice
  with no UI records Status Not applicable instead.
- `design.md` MUST cover every screen the slice touches, each state from the design template's
  checklist (or N/A with a reason), the exact copy, the component for each element, and the
  keyboard and focus path.
- `docs/tracklite-spec.md` decides behavior, permissions and copy; `design.md` and its canvas
  decide layout only. A design that needs new behavior MUST stop and raise it as a DEC candidate.
- Implementation MUST match the frozen `design.md`; changing it needs a re-freeze.

**Rationale**: Deciding screens, states and copy before planning keeps the plan and the build from
guessing at UI, and catches missing states while they are cheap to add.

## Development Constraints

- Features MUST be built on the stack and dependencies already approved for the project; a plan
  that needs a new package MUST list it as an open question for approval before implementation.
- Behavior is defined by `docs/tracklite-spec.md`; the division of work is defined by
  `ROADMAP.md`.

## Development Workflow

- Every slice MUST run `/speckit-design` after `/speckit-specify` (and `/speckit-clarify`, if run)
  and before `/speckit-plan` (Principle V).
- Every plan MUST pass a Constitution Check against the five principles before design and again
  after design.
- Every review MUST confirm: no unnecessary abstraction, no unused code or files, no comments, no
  unapproved dependencies, and UI that matches the frozen `design.md`.
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

**Version**: 1.1.0 | **Ratified**: 2026-09-29 | **Last Amended**: 2026-09-29
