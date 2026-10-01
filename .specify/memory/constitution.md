<!--
Sync Impact Report
- Version change: 1.7.0 → 1.8.0
- Modified principles: III. No Code Comments (now scoped to JavaScript and TypeScript files under
  `src/`: `.js`, `.jsx`, `.mjs`, `.cjs`, `.ts`, `.tsx`, `.mts` and `.cts`; config and directive
  files such as `.gitignore` and `biome.json`, CSS, SQL migrations, and code outside `src/` such
  as `scripts/` are out of scope)
- Added sections: none
- Removed sections: none
- Templates checked: plan-template.md, spec-template.md, tasks-template.md and
  design-template.md (no change needed; none restates the comment rule)
- Dependent files: none
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
- Exception: a new shared component in `src/components/` (with its own tests) MAY be added and kept
  before any code uses it. The rules above still apply inside it: unused imports, variables,
  props, styles and helpers in the component MUST be removed. The exception does not cover code
  outside `src/components/`.

**Rationale**: Dead code misleads readers and reviewers and costs maintenance for no value;
version control already keeps history.

### III. No Code Comments

- JavaScript and TypeScript files under `src/` (`.js`, `.jsx`, `.mjs`, `.cjs`, `.ts`, `.tsx`,
  `.mts`, `.cts`) MUST NOT contain comments, including doc comments and commented-out code.
- Other files are out of scope: config and directive files (for example `.gitignore` and
  `biome.json`), CSS, SQL migrations, and any code outside `src/`.
- Intent MUST be expressed through clear names, small functions, types and tests instead.
- The only exception is a machine-read directive that a tool requires to work (for example a
  lint-disable or type-check directive), kept to the single line that needs it.

**Rationale**: Comments drift from the code they describe; names and tests stay checked.

### IV. Dependency Approval

- A third-party package MUST be approved by the project owner before it is installed or used.
- The packages already in `package.json` are approved.

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
- The project's design system is the Hairline Design System, from the Claude Design project
  "Hairline Design System" (https://claude.ai/design/p/81b94f56-0ba4-49c6-a8c1-99b52fbd73b0):
  its tokens (colors, type, spacing, radii, elevation, wordmark), guidelines and shared
  components (for example Button and TextInput), built on React Aria Components. UI work MUST use
  Hairline's components where one fits and otherwise style elements with Tailwind utility classes
  from Hairline's theme, rather than inventing new styling.
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
- Every review MUST confirm: no unnecessary abstraction, no unused code or files (apart from the
  shared components Principle II allows), no comments in the files Principle III covers, no
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

**Version**: 1.8.0 | **Ratified**: 2026-09-29 | **Last Amended**: 2026-10-01
