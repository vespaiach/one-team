# Feature Specification: Project Foundation

**Feature Branch**: `claude/speckit-sdd-orchestrator-aa4295`

**Created**: 2026-09-29

**Status**: Implemented

**Input**: User description: "**Input**: Parent roadmap: `ROADMAP.md` → entry **RM-1**. A running app skeleton with the database, test tools and shared conventions every later slice builds on."

**Parent**: `ROADMAP.md` → RM-1 (Project foundation). Behavior source: `docs/tracklite-spec.md` (STD-3, STD-4, STD-7, STD-9, API-001, DEC-002, DEC-005, DATA-003, NFR-003, SEC-007, OPS-005, OPS-006, section 12).

## Clarifications

### Session 2026-09-29

- Q: How are the shared loading, empty, error, field-error and toast states proven working when no RM-1 page has data (User Story 3, SC-003)? → A: **Superseded** by the automated-checks answer below (DEC-005): the test-only fixture page is dropped. (Original answer: a test-only fixture page that exists only in development and test builds and uses each state.)
- Q: How does a developer get the database server on a fresh clone (SC-001, User Story 1)? → A: A local install of a documented database server version; no containers.
- Q: Does the unit test command use its own database (FR-004, SC-002)? → A: Yes, a separate test database that the unit test command prepares and resets before each run (unit tests only; there are no end-to-end tests, per DEC-005).
- Q: What is removed from a request's address before it is logged (FR-016, User Story 4 scenario 3)? → A: The whole query string is dropped and only the path is logged; AGENTS.md states that tokens never go in path segments.
- Q: Where do per-request log lines go, and in what format (FR-015, SC-005)? → A: One JSON object per line to standard output; rotation is left to RM-2.
- Q: How are automated checks run, and how are the shared screen states verified (FR-004, FR-020, User Stories 2 and 3, SC-002, SC-003)? → A: There are no browser end-to-end tests (DEC-005). The standard commands are build, unit test and lint (three). Automated tests are unit and component tests. Shared screen states (loading after 300 ms, empty, load error with Retry, field error, toast, time display) are verified by component tests that render each state directly; the test-only fixture page is dropped.

## User Scenarios & Testing *(mandatory)*

The people served by this slice are the developers and coding agents who build every later slice, and the team members who will open the app. This slice delivers no product feature of its own; its value is a working, checked base that later slices extend instead of re-inventing.

### User Story 1 - Start the app from a fresh checkout (Priority: P1)

A developer clones the repository, provides a local configuration file, prepares the database with one command, starts the app, and opens it in a browser. They see the Tracklite app shell: a sidebar with the product name and no project entries, and an empty main area.

**Why this priority**: Nothing else in the roadmap can be built or demonstrated until the app runs and its database schema can be created and evolved.

**Independent Test**: On a machine with only the documented prerequisites (including a local install of the documented database server version), follow the documented steps from a fresh clone; the shell renders in the browser and the database schema is at the latest version.

**Acceptance Scenarios**:

1. **Given** a fresh clone and a local configuration file, **When** the developer runs the database preparation command, **Then** every pending schema change is applied in order and running it again changes nothing.
2. **Given** a prepared database, **When** the developer starts the app and opens its root address, **Then** the app shell shows a sidebar with the product name, no project entries, and an empty main area.
3. **Given** the configuration file is missing or lacks a required secret, **When** the developer starts the app, **Then** it refuses to start and names the missing setting (without printing any secret value).

---

### User Story 2 - Check every change with standard commands (Priority: P1)

A developer or coding agent runs the project's standard build, unit test and lint commands. Each command exists, runs from the project root, and passes on the skeleton. The agent guide (AGENTS.md) tells agents to use those commands and the project conventions, without copying the commands.

**Why this priority**: Every later slice verifies its examples (`Verify: auto`) through these commands; without them no slice can be marked done.

**Independent Test**: Run each of the three commands on a clean checkout; each exits successfully, and the unit test command runs the unit and component tests.

**Acceptance Scenarios**:

1. **Given** a clean checkout with the database server running, **When** the developer runs the build, unit test and lint commands, **Then** each completes successfully.
2. **Given** a deliberately broken unit test or lint rule violation, **When** the matching command runs, **Then** it exits with a failure and names the problem.
3. **Given** AGENTS.md, **When** an agent reads it, **Then** it points to the project scripts for build, test and lint, to the spec, roadmap and constitution, and does not duplicate the script contents.

---

### User Story 3 - Shared screen states later slices reuse (Priority: P2)

Members see the same behavior everywhere for an unknown address, a slow load, an empty list, a failed load, a field error and a failed submission. This slice provides those shared pieces and proves each of them works once, through component tests that render each state directly, so later slices only plug them in.

**Why this priority**: STD-3, STD-4, STD-7 and STD-9 apply to every screen; building them once avoids each slice inventing its own version.

**Independent Test**: Component tests render the Not found page and each shared state directly, and each matches the text and timing below; that an address that doesn't exist shows the Not found page is checked by hand.

**Acceptance Scenarios**:

1. **Given** any address that doesn't match a page (for example `/nothing-here`), **When** a person opens it, **Then** a "Not found" page shows, inside the app shell, with a link to My issues (STD-4).
2. **Given** a screen whose data takes more than 300 ms to load, **When** it is loading, **Then** a loading indicator shows; if loading finishes within 300 ms, no indicator flashes (STD-7).
3. **Given** a screen with no items, **When** it shows, **Then** it displays an empty state that names the next action (STD-7).
4. **Given** a screen whose load fails, **When** it shows, **Then** it offers a Retry button that reloads the data (STD-7).
5. **Given** a form submitted with an invalid field, **When** the server rejects it, **Then** the error shows next to that field, everything typed is kept, and nothing is saved (STD-3).
6. **Given** a form submission fails for a reason not tied to one field (network error, server error, `403`), **When** the failure comes back, **Then** a toast error appears, disappears after 5 seconds, and the form keeps everything typed (STD-9).

---

### User Story 4 - Operable and safe from day one (Priority: P2)

The owner can tell whether the app and its database are up, see how long each API request took, and trust that logs and the repository hold no secrets. Times are stored in UTC and shown in each viewer's time zone.

**Why this priority**: The uptime check (RM-2), speed targets (NFR-003) and log rules (SEC-007) are checked in every later slice; the mechanisms must exist from the start.

**Independent Test**: Call `/health` with the database up and down; make API requests and read the log lines; search the repository for secret values; render a stored UTC time through the shared time display, in a component test, with the viewer's time zone set to another zone.

**Acceptance Scenarios**:

1. **Given** the database responds, **When** `/health` is called, **Then** it answers `200`; **Given** the database is stopped, **Then** it answers `503` (OPS-005).
2. **Given** any API request, **When** it completes, **Then** one log line records its method, path, status and duration, and never a token, link, cookie, request body, or description or comment text (NFR-003, SEC-007).
3. **Given** a request whose query string or headers carry a token, **When** it is logged, **Then** only the path is logged (the whole query string is dropped) and the token value is not in the log.
4. **Given** the repository, **When** it is searched for the values in the local configuration file, **Then** there is no match, and the configuration file is excluded from version control (OPS-006.1).
5. **Given** a time stored as 02:00 UTC, **When** a browser set to UTC+7 shows it through the shared time display, **Then** it reads 09:00 (DATA-003).

---

### User Story 5 - One API convention for every endpoint (Priority: P3)

A developer adding an endpoint in a later slice follows one documented convention for paths, JSON bodies, error status codes and per-field validation errors, and gets the STD-1 to STD-4 responses for free.

**Why this priority**: Consistency matters from the first real endpoint (RM-3), but the only endpoint this slice needs is `/health`, so it can follow the other stories.

**Independent Test**: Unit tests call a request under `/api/…` that doesn't exist, and one that fails validation, and check the status and body shape.

**Acceptance Scenarios**:

1. **Given** a request to an `/api/…` path that doesn't exist, **When** it is sent, **Then** the answer is `404` with a JSON error body, not an HTML page.
2. **Given** a request that fails validation, **When** it is handled through the shared convention, **Then** the answer is `422` with one error message per invalid field.
3. **Given** the shared convention, **When** a later slice raises "not signed in", "not allowed" or "not found", **Then** the answers are `401`, `403` and `404` with the same JSON error shape.

---

### Edge Cases

- The database is unreachable when the app starts: the app still starts, `/health` answers `503`, and pages show the STD-7 error state with Retry rather than crashing.
- A schema change fails partway: the database is left at the last fully applied version, and the command reports the failing change and exits with a failure.
- An issue-style or project-style address such as `/issue/WEB-999` or `/project/NOPE` before those slices exist: shows the Not found page (STD-4).
- Two toasts are raised in quick succession: both are readable, and each disappears 5 seconds after it appeared.
- A request's duration can't be measured because it errors inside the server: it is still logged with status `500` and its duration.
- An unexpected server error on an `/api/…` request: `500` with a generic JSON error body, with no stack trace or internal detail sent to the browser.
- A viewer's browser time zone is unknown or invalid: times show in UTC.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The project MUST use the stack fixed in section 12 of `docs/tracklite-spec.md`, and MUST NOT add any package beyond it without owner approval (Constitution IV); the test tools chosen for DEC-005 are approved by the owner (plan Q2).
- **FR-002**: The system MUST manage the database schema through ordered, versioned schema changes applied by one command, which is safe to run repeatedly and stops at the first failure.
- **FR-003**: Every schema change MUST keep working with the previous release's code (OPS-004); this slice records that rule where later slices will follow it (AGENTS.md).
- **FR-004**: The project MUST provide three standard commands, for build, unit test and lint, run from the project root, each exiting non-zero on failure (DEC-005, section 12). Automated tests MUST be unit and component tests only; there are no browser end-to-end tests. The unit test command MUST use a separate test database, never the development database, and MUST prepare and reset it before each run.
- **FR-005**: The repository MUST contain AGENTS.md, which points agents to those commands, the spec, the roadmap and the constitution without copying the commands' contents.
- **FR-006**: The system MUST show an app shell on every page: a sidebar with the product name and no project entries (RM-5 adds the list), and a main content area. No sign-in is required in this slice (sign-in arrives in RM-3).
- **FR-007**: The system MUST show a "Not found" page, with a link to My issues (`/my-issues`), for any unknown page address, inside the app shell (STD-4).
- **FR-008**: The system MUST provide shared loading, empty and error states: a loading indicator that appears only when loading takes more than 300 ms; an empty state that takes a message naming the next action; and an error state with a Retry button (STD-7).
- **FR-009**: The system MUST provide shared field errors: a message next to each invalid field, keeping everything typed, with nothing saved (STD-3).
- **FR-010**: The system MUST provide a shared toast for submission failures that aren't tied to one field; it disappears after 5 seconds and doesn't clear the form (STD-9).
- **FR-011**: The app's HTTP API MUST live under `/api/…`, exchange JSON, use resource-style paths, and answer errors with `401`, `403`, `404` and `422` in one shared error shape, with `422` carrying one message per field (API-001, DEC-002).
- **FR-012**: Unknown `/api/…` paths MUST answer `404` with the shared JSON error shape, and unexpected failures `500` with a generic message and no internal detail.
- **FR-013**: The API convention MUST accept a client-generated request ID on create requests so later slices can make creates safe to retry (STD-5, DEC-002); this slice defines the convention only.
- **FR-014**: The system MUST store all times in UTC and provide one shared way to show a time in the viewer's browser time zone (DATA-003).
- **FR-015**: The system MUST log one line per API request, written to standard output as one JSON object per line, with method, path, status and duration in milliseconds, so the 95th-percentile read and write times can be computed from the logs (NFR-003).
- **FR-016**: Logs MUST never contain tokens, magic links, cookies, request or response bodies, or description and comment text; the whole query string MUST be dropped before logging so only the path is logged, and AGENTS.md MUST state that tokens never go in path segments (SEC-007).
- **FR-017**: Secrets and environment-specific settings (such as the database password and, later, the email API key) MUST be read from a configuration file that is excluded from version control; the repository MUST hold only an example file with placeholder values (OPS-006).
- **FR-018**: The app MUST refuse to start when a required setting is missing, naming the setting but never printing a secret value.
- **FR-019**: The system MUST answer `GET /health` with `200` when the database responds and `503` when it doesn't, without requiring sign-in and without revealing internal details (OPS-005).
- **FR-020**: Each shared piece in FR-007 to FR-019 MUST be covered by at least one automated test run through the FR-004 commands; each shared screen state in FR-007 to FR-010 and FR-014 (Not found, loading after 300 ms, empty, load error with Retry, field error, toast, time display) MUST be verified by a component test that renders that state directly.

### Key Entities

- **Schema version**: the record of which schema changes have been applied to a database, so the preparation command knows what is pending.
- **Configuration**: the set of named settings (database connection, secrets, environment) read at start-up from the local configuration file, including the separate test database connection used by the test commands.
- **API error**: the shared shape of every API error answer: a status code, a human-readable message, and for `422` a message per field.
- **Request log entry**: one JSON object per line on standard output per API request: time (UTC), method, path (query string dropped), status, and duration.

No product entities (members, projects, issues) are created in this slice; each later slice adds its own tables.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A developer new to the project gets from a fresh clone to the app shell in a browser in under 15 minutes by following the documented steps alone.
- **SC-002**: All three standard commands (build, unit test, lint) pass on a clean checkout, and each fails when a deliberate defect of its kind is introduced.
- **SC-003**: 100% of the shared states in User Story 3 are exercised by automated component tests that render each state directly and pass.
- **SC-004**: The health check reports the correct state within 1 second in 10 out of 10 checks with the database up, and 10 out of 10 with it down.
- **SC-005**: A search of the logs produced by the full test run finds zero secret values, tokens, cookies or request bodies, and every API request in the run has exactly one timing line.
- **SC-006**: A search of the repository finds zero values from the local configuration file.
- **SC-007**: The app shell and Not found page are usable within 1.5 s of navigation on broadband with a warm cache (NFR-002).

## Assumptions

- The stack (section 12 of `docs/tracklite-spec.md`) is fixed and approved (plan Q1), and the owner has approved the DEC-005 test tools (plan Q2); any other new package still needs the owner's approval before it is added (Constitution IV).
- There is no sign-in yet, so the shell and every page in this slice are open to anyone who can reach the local app; STD-1, STD-2 and the permission layer (SEC-006) arrive with RM-3. The shell is only run locally until RM-2 deploys it.
- The sidebar's "My issues" link and the `/my-issues` page arrive with RM-3; until then, the Not found page's link to My issues leads to the Not found page itself, which is acceptable for this slice.
- The root address `/` shows the empty app shell in this slice; RM-3 changes it to send members to My issues or sign-in.
- The same configuration-file mechanism serves local development and the production server; the production file, capturing and rotating the standard-output logs (OPS-006) and the external uptime check (OPS-005) are set up in RM-2.
- Request timing logs cover API requests; page-load speed (NFR-002) is measured in the browser, not from these logs.
- The database server is installed locally at the version documented in the setup steps; no container tooling is required or provided in this slice.
- Shared screen states are verified by component tests that render each state directly, so no test-only page or other test scaffolding ships in the app (Constitution II).
- The NFR-001 seed script is started in the first slice that adds product data (RM-3 onward); this slice has no product data to seed.
- The UI design for the shell and shared states is recorded by `/speckit-design` before planning (Constitution V).
