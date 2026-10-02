# Roadmap: Tracklite R1

Tracklite R1 ([spec](docs/tracklite-spec.md)) is a whole product, too big to specify, plan and build in one run. This roadmap splits it into slices that each leave something demonstrable, ordered so prerequisites come first. The spec stays the source of truth for behavior; this file is the source of truth for how the work is divided.

**Status legend**: planned · in-progress · done

| ID | Sub-feature | Intent | Scope boundary | Depends on | Status | Sub-spec |
|----|-------------|--------|----------------|------------|--------|----------|
| RM-1 | Project foundation | A running app skeleton with the database, test tools and shared conventions every later slice builds on. | **In:** the section 12 stack with migrations; build, test and lint npm scripts (DEC-005) and AGENTS.md; API conventions (API-001, DEC-002); the app shell with an empty sidebar; shared field errors (STD-3), Not found page (STD-4), loading, empty and error states (STD-7) and toast (STD-9); UTC times (DATA-003); request timing logs (NFR-003) that never hold secrets (SEC-007); secrets read from a config file (OPS-006); `/health` (OPS-005). **Deferred:** sign-in → RM-3; deploying → RM-2. | — | done | [specs/001-project-foundation](specs/001-project-foundation) |
| RM-2 | Production environment | One command deploys the app to the VPS over HTTPS, with rollback, daily backups and uptime alerts. | **In:** OPS-002, OPS-003 (backups and rotation), OPS-004, OPS-005 (external uptime check), OPS-006 (server config file, log rotation), SEC-005, a reverse proxy that appends or overwrites `X-Forwarded-For` (SEC-001's per-IP limit), hosting within NFR-009. **Deferred:** restore rehearsal (OPS-003.1) → RM-14. | RM-1 | planned | — |
| RM-3 | Magic-link sign-in | The first admin, created by the setup command, signs in with an emailed link and stays signed in. | **In:** F-001 (REQ-004 to REQ-006), OPS-001, sign out, STD-1, STD-2 and SEC-006 (the one permission layer, with Admin and Member roles), SEC-001, SEC-003 (magic-link and session tokens), SEC-004, SEC-007.1; the email provider (DEC-003, API-002, NFR-008) and a failed send (STD-6); `/sign-in`, and `/my-issues` as an empty landing page and the My issues sidebar link to it; member initials (REQ-003.4). **Deferred:** invitations, profiles and deactivation → RM-4; SEC-004.1, which needs issues → RM-6; My issues content → RM-11. | RM-1 | in-progress | [specs/002-magic-link-sign-in](specs/002-magic-link-sign-in) |
| RM-4 | Invitations and members | Admins invite, deactivate, reactivate and promote members, and members fill in and edit their profile. | **In:** F-001 (REQ-001 to REQ-003, REQ-007, REQ-008), the member rows of section 7, invitation tokens (SEC-003) and emails (API-002), `/settings/members`. **Deferred:** REQ-007.2, REQ-007.4 and REQ-008.2, which need issues → RM-6. | RM-3 | planned | — |
| RM-5 | Projects | Admins create, rename, archive and delete projects, and any member keeps a project's Markdown description current. | **In:** F-002 (REQ-009 to REQ-015, REQ-046), the sidebar, the project header with its details link, the project details page (`/project/{KEY}/detail`) with the description, the Archived list, the shared Markdown renderer (DEC-001, SEC-002), stale-description check (STD-8), SEC-006.1. **Deferred:** examples that need issues (REQ-011.1, REQ-013.1, REQ-013.4, REQ-014.1, REQ-014.3) → RM-6; frozen labels (REQ-013.5, REQ-013.6) → RM-7; My issues examples (REQ-013.2, REQ-013.3) → RM-11; project comments → RM-10. | RM-3 | planned | — |
| RM-6 | Issues | Members create issues with readable IDs and track their status, priority, assignee and description. | **In:** F-003 (REQ-016 to REQ-019, REQ-022, REQ-023), New issue, `/issue/{ID}`, request IDs on create (STD-5), last save wins and stale descriptions (STD-8), and the issue examples of earlier rules (REQ-007.2, REQ-007.4, REQ-008.2, REQ-011.1, REQ-013.1, REQ-013.4, REQ-014.1, REQ-014.3, SEC-004.1). **Deferred:** labels → RM-7; board position and card order → RM-8 (until then, issues are reached from New issue or by ID); REQ-023.3 → RM-10; mentions → RM-12; assignment emails → RM-13. | RM-4, RM-5 | planned | — |
| RM-7 | Labels | Members tag issues with their project's labels and manage those labels on the project's Labels page. | **In:** F-003 (REQ-020, REQ-021), `/project/{KEY}/labels`, the label picker on the issue page, frozen labels in archived projects (REQ-013.5, REQ-013.6). **Deferred:** labels on board cards → RM-8; the label filter → RM-9; labels on My issues rows → RM-11. | RM-6 | planned | — |
| RM-8 | Board view | A project opens on a kanban board where members move issues between statuses and reorder them. | **In:** F-004 (REQ-024 to REQ-030): the shared card order, the 14-day Done and Canceled window, the ⋯ menu for keyboard and touch, NFR-002 with 300 cards in a column, NFR-005. **Deferred:** none. The board has no filters or search; those are list-only (RM-9). | RM-6, RM-7 | planned | — |
| RM-9 | List view | Members find any issue in a project, including long-finished ones, with filters, search and sort. | **In:** F-005 (REQ-036 to REQ-040), the Board and List switch, `/project/{KEY}/list` with its state in the query string (API-004), NFR-004. **Deferred:** none. | RM-6, RM-7 | planned | — |
| RM-10 | Comments | Members discuss an issue or a project in a flat thread of Markdown comments. | **In:** F-006 (REQ-031 to REQ-035) on issues and project details pages, request IDs on post (STD-5), the comment rows of section 7, REQ-023.3, DATA-003.1. **Deferred:** @mention suggestions and links → RM-12; mention emails → RM-13. | RM-5, RM-6 | planned | — |
| RM-11 | My issues | Each member lands on one page listing the issues assigned to them across active projects. | **In:** F-007 (REQ-041, REQ-042), replacing the empty landing page from RM-3, REQ-013.2, REQ-013.3, NFR-002 with 300 assigned issues. **Deferred:** none. | RM-6, RM-7 | planned | — |
| RM-12 | Mentions | Typing @ suggests teammates, and a saved @username becomes a link to that member. | **In:** DATA-001 in issue descriptions and comments, and the Mention records that let REQ-044 email only new mentions. Project descriptions have no mentions (DATA-001). **Deferred:** mention emails → RM-13. | RM-6, RM-10 | planned | — |
| RM-13 | Email notifications | Members get one email, after a 2-minute wait, when they're assigned an issue or @mentioned. | **In:** F-008 (REQ-043 to REQ-045), background jobs (DEC-004), notification records saved in the same transaction as the action (section 12), retries (STD-6), notification emails (API-002), the bounce webhook (API-003). **Deferred:** deleting old notifications (DATA-004) → RM-14. | RM-6, RM-12 | planned | — |
| RM-14 | Launch readiness | Clean up expired records, then check the whole app against its quality targets on full-size data before launch. | **In:** DATA-004; the full NFR-001 seed and a pass of NFR-002 to NFR-004 on it; DATA-002.1; browser (NFR-006) and accessibility (NFR-007) passes; NFR-008 and NFR-009 checks; restore rehearsal (OPS-003.1); confirming the team-size assumption (section 3). **Deferred:** F-009 and F-010 (release Later). | RM-2 to RM-13 | planned | — |

IDs use `RM-` rather than spec-kit's `R1`, `R2`, because the spec already uses R1 as the release name.

## Rules every slice follows

Each sub-spec applies these to the screens, actions and data it adds, rather than leaving them to a later slice:

- **Standard behaviors and permissions:** STD-1 to STD-9, and the section 7 rows for its actions, checked in the one server-side permission layer (SEC-006).
- **Archived and deleted projects:** anything that belongs to a project or issue is read-only while its project is archived (REQ-013) and is deleted with its parent (DATA-002).
- **Deactivated members:** wherever a member's name appears, a deactivated one is marked "(deactivated)" and can't be picked (REQ-007).
- **Markdown** goes through the shared renderer from RM-5 and nowhere else (SEC-002).
- **Times** are stored in UTC and shown in the browser's time zone (DATA-003).
- **Logs** never hold tokens, links, or description and comment text (SEC-007).
- **Migrations** also work with the previous release's code (OPS-004).
- **Quality:** API timing (NFR-003), browsers (NFR-006), and keyboard access, focus and contrast (NFR-007). Each slice adds its data to the NFR-001 seed script so its speed targets can be checked.
- **Examples that need a later slice:** the rule is built in its own slice and the example is checked in the later one. The Scope boundary column lists these cases.

## Not in this roadmap

- F-009 Project milestones and F-010 Rich text, planned for a later release. They get entries when that release is planned.
- Everything under "Out of scope" in section 3 of the spec.

## Working through it

1. Pick the next entry whose dependencies are all `done`. RM-2 only needs RM-1, so doing it early means every later slice ships through the real deploy.
2. Start its sub-spec with the line below, then run `/speckit.specify`, `/speckit.design`, `/speckit.plan`, `/speckit.tasks` and `/speckit.implement`. `/speckit.design` must freeze the slice's `design.md` (or mark it Not applicable) before planning.

   ```
   **Input**: Parent roadmap: `ROADMAP.md` → entry **RM-n**. <intent>
   ```

3. Set the entry to in-progress and fill in its Sub-spec path. Set it to done when its examples pass.
4. If scope changes, update this file first. Don't renumber an ID once a sub-spec refers to it. If a slice turns out too big, give it its own roadmap.
