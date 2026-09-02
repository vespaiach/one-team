# Feature Specification: Labels

**Feature Branch**: `claude/roadmap-r8-specifications-3a47f8`

**Parent roadmap**: `docs/ROADMAP.md` → entry **R8**

**Created**: 2026-09-01

**Status**: Draft

**Input**: User description: "create a feature specifications for roadmap entry R8, refer to @docs/ROADMAP.md"

Nothing below is invented. Every statement restates or narrows something [`docs/product/specifications.md`](../../docs/product/specifications.md) states, within the scope boundary [`docs/ROADMAP.md`](../../docs/ROADMAP.md) entry **R8** draws. Where this spec and the roadmap disagree, the roadmap is reconciled first; where this spec and the specification disagree, the specification wins.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - An admin curates the team-wide label set (Priority: P1)

An admin opens Labels from the sidebar, presses **New label**, names it, picks a colour from the fixed palette, and creates it. The label now exists once, for the whole team, and is available to be applied on any issue in any project the moment the picker is next opened. The admin can also rename or recolour an existing label — the change lands on every issue that carries it, everywhere it is shown, without touching those issues individually — and can delete a label outright, seeing first how many issues it will disappear from.

**Why this priority**: Nothing in this feature has anything to apply until a label exists. The curated set is the vocabulary every other story in this slice, and every board card a later entry renders, draws from — there is no path to labeling an issue that does not start here.

**Independent Test**: Sign in as an admin, open `/settings/labels` with no labels yet, create one with a name and a colour, and confirm it appears in the alphabetical list with a usage count of zero. Rename it and confirm the new name and colour show immediately in the list. No other story needs to exist for this to be verified.

**Acceptance Scenarios**:

1. **Given** an admin on `/settings/labels` with no labels yet, **When** they press **New label**, enter a name, and confirm with a colour already pre-selected, **Then** one label is created, appears in the alphabetical list with a usage count of zero, and the modal closes.
2. **Given** an existing label, **When** an admin opens **Edit**, changes its name and colour, and saves, **Then** the label's row updates in the list and the new name and colour are what every picker and every issue carrying it shows on next render — no per-issue update is needed.
3. **Given** a label already carried by 14 issues across several projects, **When** an admin presses **Delete**, **Then** a confirmation names the label and states "It will be removed from 14 issues. This can't be undone" before anything is destroyed.
4. **Given** an admin confirms that deletion, **When** the delete completes, **Then** the label row and all 14 of its issue attachments are gone in one operation, the 14 issues themselves are otherwise unchanged, and the label no longer appears in the list or any picker.
5. **Given** an admin typing a name that already exists on another label (case-insensitively), **When** they blur the field, **Then** an inline error names the existing label and the form is not submitted.
6. **Given** a signed-in member who is not an admin, **When** they look at the sidebar, **Then** no **Labels** entry is shown, and a direct visit to `/settings/labels` renders Forbidden.

---

### User Story 2 - A project member labels an issue (Priority: P2)

A member working an issue opens its label picker — on the issue's own detail page or while creating a new issue — and adds one or more labels from the team-wide set, or removes one that no longer applies. The picker only ever offers labels that already exist; there is no way to invent one from here.

**Why this priority**: This is the payoff the curated set in Story 1 exists for — turning a flat list of issues into something a team can filter and scan by category. It depends on Story 1 having produced at least one label to pick, which is why it sits second.

**Independent Test**: With at least one label already created (Story 1) and an issue that carries none, sign in as a member of that issue's project, open the issue, add a label from the rail's picker, and confirm it appears on the issue immediately. Remove it and confirm it is gone. This can be verified without Story 3 existing.

**Acceptance Scenarios**:

1. **Given** an issue with no labels and at least one team label existing, **When** a project member opens the issue's label picker and selects a label, **Then** the label appears on the issue and one `label_added` activity row is recorded for it.
2. **Given** an issue carrying a label, **When** a project member removes it from the picker, **Then** the label no longer shows on the issue and one `label_removed` activity row is recorded for it.
3. **Given** the Create issue form, **When** a member picks two labels before submitting, **Then** the new issue is created already carrying both.
4. **Given** a user who is not a member of the issue's project, **When** they view the issue, **Then** the label picker renders disabled with an inline reason, exactly as the rest of the rail does, and no label can be added or removed.
5. **Given** an admin curating labels, **When** they open the label picker's "Manage labels" link, **Then** they land on `/settings/labels`; a non-admin viewing the same picker does not see that link at all.
6. **Given** the picker is open and an admin deletes one of the labels it lists in another session, **When** the picker is opened again, **Then** the deleted label no longer appears as an option.

### Edge Cases

- A label name that differs from an existing one only by case (`Bug` vs. `bug`) is rejected as a clash, naming the existing label, on both create and rename.
- Deleting a label carried by zero issues still asks for one confirmation, without a count, per the product specification's own wording for that case.
- A member opens the label picker on an issue whose project they were since removed from mid-session: the picker (and the rest of the rail) is disabled with a reason on the next render, and no row is changed by anything already in flight.
- Selecting a label already applied to an issue a second time is a no-op from the picker's perspective — the picker shows applied state and only offers removal for what is already on the issue.
- A rename or recolour lands on every reference at once because a label is one row; nothing is re-tagged and no batch job runs across issues.
- A very long label name is rejected inline with the same 200-character bound applied to every short free-text field elsewhere in the product; nothing is silently truncated.

## Requirements *(mandatory)*

### Functional Requirements

**Curating the team-wide set (admin only)**

- **FR-001**: The system MUST provide a full page at `/settings/labels`, reachable only by an admin; a non-admin who visits it directly MUST see Forbidden.
- **FR-002**: The sidebar's **Labels** entry MUST be visible only to admins and hidden — not disabled — for everyone else.
- **FR-003**: The labels page MUST list every label on the team, alphabetically by name, each row showing its colour swatch, its name, and the number of issues currently carrying it across every project.
- **FR-004**: When no labels exist, the page MUST show a single quiet line reading "No labels yet" in place of the list.
- **FR-005**: Each row MUST carry an **Edit** control and a **Delete** control; the page MUST carry a **New label** control at its head.
- **FR-006**: **New label** MUST open a modal with a required name field and a colour picker; a colour MUST be pre-selected so the form is submittable with a name alone.
- **FR-007**: The name field MUST validate on blur: required, trimmed, and unique case-insensitively against every existing label; a clash MUST show an inline error naming the existing label rather than being silently suffixed or accepted.
- **FR-008**: Confirming the modal MUST create exactly one label and MUST make it available in every label picker the next time that picker is opened; canceling or dismissing the modal MUST discard the input and create nothing.
- **FR-009**: **Edit** MUST open the same modal, pre-populated with the label's current name and colour, and MUST allow changing either.
- **FR-010**: Saving an edit MUST update the single label row; because a label is not duplicated per project or per issue, the new name and colour MUST be what every issue carrying it, every board card referencing it, and every open picker shows on next render — no other row is touched.
- **FR-011**: **Delete** MUST first show one confirmation naming the label and, when it is carried by one or more issues, the exact count of issues it will be removed from; a label carried by no issues MUST still confirm once, without a count.
- **FR-012**: Confirming a delete MUST remove the label row and every one of its issue attachments in a single transaction; the issues themselves MUST be otherwise unchanged, and the response MUST reflect the fully settled state with no intermediate moment where the label is gone but an attachment survives it (or the reverse).
- **FR-013**: Creating, renaming, recolouring, or deleting a team-wide label MUST NOT write an activity record on any issue or project, and a deletion MUST NOT write an activity record on the issues it is removed from.
- **FR-014**: A label's colour MUST be one of the seven fixed palette values shared with projects and board columns; free colour entry MUST NOT be offered.

**Applying labels to issues (any project member)**

- **FR-015**: The issue detail rail MUST offer a label picker letting a member of that issue's project add or remove any number of the team's existing labels on that issue.
- **FR-016**: The Create issue form MUST offer the same label picker as an optional, multi-select field, letting labels be set at creation time.
- **FR-017**: Both pickers MUST offer only labels that currently exist; neither MUST allow creating a label from within it.
- **FR-018**: Both pickers MUST carry a "Manage labels" link to `/settings/labels` at their foot, visible to admins only and hidden — not disabled — for everyone else.
- **FR-019**: Adding or removing a label on an issue MUST require the acting user to be a member of that issue's project (admins included by the standing membership predicate); a non-member MUST see the picker rendered disabled with an inline reason, matching the rest of the rail's disabled state.
- **FR-020**: The project used to authorize a label change on an issue MUST be derived server-side from the issue's own stored `project_id`, never from a value the client supplies.
- **FR-021**: Adding a label to an issue MUST record one `label_added` activity row naming that label; removing one MUST record one `label_removed` activity row naming that label — one row per label, never one row for a multi-label change.
- **FR-022**: An issue MUST NOT carry the same label twice; adding a label already present MUST be a no-op rather than a duplicate attachment or a duplicate activity row.

### Key Entities

- **Label**: The team-wide category a project's issues may carry. Holds a name and a colour and nothing else. Exists exactly once across the whole installation — never scoped to a project — so the same set and the same row are what every project's issues, cards, and pickers reference. Its name is unique without regard to case.
- **Issue label attachment**: The fact that one specific issue currently carries one specific label. A many-to-many link between an issue and a label; a given pair exists at most once. Removing it deletes the fact, not the label or the issue; deleting the label removes every fact naming it, leaving the issues it named untouched.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A label created by an admin is selectable from every issue's label picker and from the Create issue form the next time either is opened — with no separate publishing or sync step.
- **SC-002**: Renaming or recolouring a label changes how it appears everywhere it is referenced — the team's label list, every issue that carries it, every board card, and every open picker — in the single edit that made the change, with no follow-up action anywhere else.
- **SC-003**: Deleting a label removes it from 100% of the issues that carried it, verified by the confirmation count shown before the delete matching the number of issues actually changed.
- **SC-004**: Every attempt by a non-admin to reach label curation — the hidden sidebar entry, the picker's hidden "Manage labels" link, or a direct visit to `/settings/labels` — either offers no path in or resolves to Forbidden; none exposes a create, rename, recolour, or delete control.
- **SC-005**: A project member can add or remove a label on an issue they can otherwise edit, and the change is visible on that issue immediately, with no page reload required.
- **SC-006**: A user who is not a member of an issue's project sees the label picker disabled with a stated reason on 100% of visits, and no label change from them is ever recorded.

## Assumptions

- **The activity writer this feature calls is the one entry R7 (Comments and activity feeds) establishes.** Per the roadmap's dependency order, `label_added` and `label_removed` rows (FR-021) are written through that shared writer rather than this feature inventing a second one; R7 has no child spec yet at the time of writing, so this feature's plan will need R7's writer contract in place, or stubbed to the same shape, before FR-021 can be implemented end to end. This is a build-order fact the roadmap already states (§3, the `R7 --> R8` edge), not a scope decision made here.
- **Board card label chips are out of scope for this feature.** The roadmap defers rendering labels on board cards to R10 (Board); this feature delivers the data, the curation screen, and the two pickers, but no card-facing display.
- **The five default board columns, project and issue infrastructure this feature builds on already exist**, delivered by R5 (Projects) and R6 (Issues); this feature adds no new screen route beyond `/settings/labels` and modifies no project or issue field other than an issue's set of labels.
- **No activity record is written for curating the set itself** (create, rename, recolour, delete) — this is the product specification's explicit choice (§3.10), not an omission, and FR-013 states it as a requirement rather than leaving it silent.
- **A deleted label's usage count and the delete confirmation's stated count are computed from the same query**, immediately before the delete runs, so a concurrent add or remove between the confirmation and the commit is possible under last-write-wins, consistent with how the rest of this product handles concurrent writes; no locking or live push is assumed here (out of scope, product specification §1).
