# UI Design: Project Foundation

**Branch**: `claude/speckit-sdd-orchestrator-aa4295` | **Date**: 2026-09-30 | **Spec**: [spec.md](./spec.md)

**Roadmap entry**: RM-1: Project foundation

**Canvas**: [Tracklite RM-1 foundation](https://claude.ai/design/p/7dc7082d-0aee-4b0b-ba4b-e287873f44f1?file=Tracklite.dc.html&via=share), file `Tracklite.dc.html`, page "RM-1 Project foundation" (replaces the Hairline Design System link; open question 9) | **Canvas version**: re-read 2026-09-30 (link mode, after the FR-006 spec change; unchanged: frames 1a to 1f, 1h to 1l, all mapped, nothing outside the inventory; 1a and 1b show no project entries, matching FR-006); earlier re-read 2026-09-30 (link mode, after the 2026-09-30 spec change; unchanged: frames 1a to 1f, 1h to 1l, all mapped, nothing outside the inventory); earlier re-read 2026-09-30 after the owner's redraw of 1e (frames 1a to 1f, 1h to 1l; 1g deleted); the canvas exposes no version stamp; 1e, 1f, 1h to 1l are standalone (1e now shows only the loading indicator, the empty message, the load error with Retry and "09:00", with no app shell, fixture heading, section panels or "/dev/states" label; open question 15); 1k keeps the phone-width app shell as context (open question 18)

**Status**: Frozen

**Frozen**: 2026-09-30 (re-frozen after the FR-006 spec change below; earlier frozen 2026-09-30, cleared 2026-09-30; earlier frozen 2026-09-30, re-frozen after the earlier 2026-09-30 spec change; earlier frozen 2026-09-30, cleared 2026-09-30; first frozen 2026-09-29, cleared 2026-09-29)

**Spec change after freeze (2026-09-29)**: spec.md and `docs/tracklite-spec.md` v0.4 (DEC-005) drop browser end-to-end tests and the test-only fixture page `/dev/states` (former FR-021); shared screen states are verified by component tests that render each state directly (FR-020, SC-003). Rows affected:
- Screens: "Shared states fixture" removed; "Toast" host page changed (open question 14).
- State inventory: all 15 "Shared states fixture" rows removed (frames 1e, 1f, 1g, 1h, 1l lose their rows); the 15 "Toast" rows stay, pending open question 14; its 5 framed rows (Populated, Submit failed, Not allowed, Long content, Phone width; frames 1h, 1i, 1j, 1k) have frames marked pending.
- Copy: fixture page heading and section headings removed; the other fixture rows moved to "Shared components" (no page in RM-1); Name form strings pending open question 16.
- Component map: fixture page heading, section heading and section panel removed; the other fixture rows moved to "Shared components".
- Keyboard and focus: the fixture row replaced by a "Shared components" row.
- Open questions 1, 7, 11, 12 superseded by DEC-005; open questions 14 to 16 added.
- Freeze checklist: items 1, 7 and 8 unticked.
App shell and Not found rows are unchanged.

**Spec change after freeze (2026-09-30)**: spec.md changed after /speckit-analyze: I2, User Story 3's Independent Test says component tests render the Not found page and each shared state, and a person checks by hand that an unknown address shows Not found; I3, FR-001 and Assumptions say the stack and the test tools are approved (plan Q1, Q2); I5, spec Status Draft → Approved. None changes a screen, state, string, component, keyboard path or canvas frame. Rows affected: none. Traceability only: the Not found and Shared components rows are verified as the revised User Story 3 Independent Test says (component tests, plus a manual check that an unknown address shows Not found). Freeze checklist items stay ticked; re-freeze needs no canvas change.

**Spec change after freeze (2026-09-30, FR-006)**: spec.md FR-006 now reads "a sidebar with the product name and no project entries (RM-5 adds the list), and a main content area" (owner decision A3: RM-1 renders no project list element). Rows affected: State inventory, App shell Populated (wording only: "an empty project list" → "no project entries"). Traceability only: frames 1a and 1b already show no project list; no screen, state, string, component, keyboard path, deferred slot or canvas frame changes. Freeze checklist items stay ticked; re-freeze needs no canvas change.

**Authority**: `docs/tracklite-spec.md` decides behavior, permissions and copy. This file and the canvas decide layout only.

## Screens

| Screen | Kind | Route or host page | Signed in? | Spec rules |
|--------|------|--------------------|------------|------------|
| App shell | page | `/` (and the frame around every page) | No (sign-in arrives in RM-3) | FR-006, NFR-007 |
| Not found | page | Any unknown address, for example `/nothing-here`, `/issue/WEB-999`, `/project/NOPE`; shown inside the app shell | No | STD-4, FR-007 |
| Toast | overlay | None in RM-1, rendered by component tests (FR-010, FR-020; the fixture page is dropped, DEC-005); shared by every later page (open question 14) | No | STD-9, DEC-006, FR-010, FR-020 |
| Shared components | components (no page) | None in RM-1, rendered by component tests (FR-008, FR-009, FR-014, FR-020, SC-003); placed by later pages (open question 15) | No | STD-3, STD-7, DATA-003.1, FR-008, FR-009, FR-014, FR-020 |

`/health` and the `/api/…` JSON answers are not screens: they have no layout.

The other shared state components (loading indicator, empty state, load error with Retry, field error message, time display) appear on no page in RM-1: they are rendered directly by component tests (FR-008, FR-009, FR-014, FR-020, SC-003). They are listed as "Shared components" in every section below and framed by standalone component frames (open question 15).

## State inventory

| Screen | State | Caused by | Canvas frame |
|--------|-------|-----------|--------------|
| App shell | Populated | FR-006: sidebar with the product name and no project entries (RM-5 adds the list; owner decision A3), empty main area (spec User Story 1, scenario 2) | 1a App shell |
| App shell | Loading | N/A: the shell loads no data in RM-1; the project list arrives in RM-5 | — |
| App shell | Empty | N/A: FR-006 fixes the main area as empty; the sidebar project list and its empty state are RM-5 (REQ-015) | — |
| App shell | Load error | N/A: the shell loads no data in RM-1 (RM-5) | — |
| App shell | Field error | N/A: no form | — |
| App shell | Saving | N/A: no form | — |
| App shell | Submit failed | N/A: no form | — |
| App shell | Conflict | N/A: no editor (RM-5, RM-6) | — |
| App shell | Not allowed | N/A: no permissions until RM-3 | — |
| App shell | Not found | N/A: shown by the Not found screen inside the shell | — |
| App shell | Signed out | N/A: RM-3 | — |
| App shell | Archived project | N/A: no projects until RM-5 | — |
| App shell | Deactivated member | N/A: no members until RM-4 | — |
| App shell | Long content | N/A: the only text is the fixed product name; long project names are RM-5 (REQ-015) | — |
| App shell | Phone width | Section 3, NFR-006: works, not polished; the sidebar stacks above the main area (open question 5) | 1b App shell phone |
| Not found | Populated | STD-4, FR-007: "Not found" with a link to My issues, inside the shell | 1c Not found |
| Not found | Loading | N/A: static page, no data | — |
| Not found | Empty | N/A: static page, no list | — |
| Not found | Load error | N/A: static page, no data | — |
| Not found | Field error | N/A: no form | — |
| Not found | Saving | N/A: no form | — |
| Not found | Submit failed | N/A: no form | — |
| Not found | Conflict | N/A: no editor | — |
| Not found | Not allowed | N/A: no permissions until RM-3 | — |
| Not found | Not found | This screen is the state (STD-4) | 1c Not found |
| Not found | Signed out | N/A: RM-3 | — |
| Not found | Archived project | N/A: no project on this page | — |
| Not found | Deactivated member | N/A: no member on this page | — |
| Not found | Long content | N/A: the unknown address is not shown, only fixed text | — |
| Not found | Phone width | Section 3, NFR-006: works, not polished | 1d Not found phone |
| Toast | Populated | STD-9, DEC-006: one toast with the failure text; it disappears after 5 seconds and has no dismiss or pause control | 1h Toast failed save |
| Toast | Loading | N/A: a toast loads nothing | — |
| Toast | Empty | N/A: a toast always carries text | — |
| Toast | Load error | N/A: a toast loads nothing | — |
| Toast | Field error | N/A: validation errors stay next to their fields (STD-9) | — |
| Toast | Saving | N/A: a toast saves nothing | — |
| Toast | Submit failed | This overlay is the state (STD-9) | 1h Toast failed save |
| Toast | Conflict | N/A: the STD-8 message stays in the editor (STD-9) | — |
| Toast | Not allowed | STD-2, STD-9: a `403` on submit shows "You don't have permission to do that." as a toast | 1i Toast 403 |
| Toast | Not found | N/A: Not found is a page (STD-4) | — |
| Toast | Signed out | N/A: RM-3 | — |
| Toast | Archived project | N/A: "This project is archived" toast is RM-5 (REQ-013.4) | — |
| Toast | Deactivated member | N/A: no member shown | — |
| Toast | Long content | Spec edge case: two toasts raised in quick succession both stay readable (stacked), each disappearing 5 seconds after it appeared; text wraps, not truncated, shown with the two Copy toast strings at a narrower width (open question 13) | 1j Toast stacked |
| Toast | Phone width | Section 3, NFR-006: works, not polished; the phone-width app shell is shown as context only, to place the toast on a small screen (open question 18) | 1k Toast phone |
| Shared components | Populated | FR-014, DATA-003.1: the time display shows "09:00" for 02:00 UTC in a browser on UTC+7 | 1e Shared states |
| Shared components | Loading | STD-7, FR-008: the loading indicator, shown only after 300 ms | 1e Shared states |
| Shared components | Empty | STD-7, FR-008: the empty state with "No issues yet. Create one." as plain text | 1e Shared states |
| Shared components | Load error | STD-7, DEC-006, FR-008: "Couldn't load this." with a Retry button | 1e Shared states |
| Shared components | Field error | STD-3, FR-009: "Enter a name." under the empty Name field, with Save (open questions 11, 16 and 17) | 1f Field error |
| Shared components | Saving | N/A: dropped from RM-1 (open question 16); FR-008 to FR-010 list no saving component; the first slice with a real form records STD-5 | — |
| Shared components | Submit failed | N/A: shown by the Toast screen | — |
| Shared components | Conflict | N/A: no editor (RM-5, RM-6) | — |
| Shared components | Not allowed | N/A: shown by the Toast screen (STD-2) | — |
| Shared components | Not found | N/A: shown by the Not found screen (STD-4) | — |
| Shared components | Signed out | N/A: RM-3 | — |
| Shared components | Archived project | N/A: no projects until RM-5 | — |
| Shared components | Deactivated member | N/A: no members until RM-4 | — |
| Shared components | Long content | FR-009: the field error message wraps under the empty Name field at a narrower width, not truncated (open question 17) | 1l Field error wraps |
| Shared components | Phone width | N/A: the components have no page in RM-1; phone width is recorded for the Toast (1k) and by each later host page | — |

## Copy

| Screen | Element | Text | Source |
|--------|---------|------|--------|
| App shell | product name in the sidebar (plain text, not a link; open question 8) | "Tracklite" | spec section 1 (product name) |
| App shell | document title at `/` | "Tracklite" | design |
| Not found | page heading | "Not found" | STD-4 |
| Not found | link to `/my-issues` | "My issues" | STD-4, F-007 |
| Not found | document title | "Not found · Tracklite" | design |
| Shared components | loading indicator, accessible name | "Loading" | design |
| Shared components | empty state message, example used by the component test (plain text, no link; open question 7) | "No issues yet. Create one." | STD-7 |
| Shared components | load error message | "Couldn't load this." | STD-7, DEC-006 |
| Shared components | load error button | "Retry" | STD-7 |
| Shared components | field label in the field error example (open question 16: design example) | "Name" | design |
| Shared components | field error message example (open question 16: design example) | "Enter a name." | design |
| Shared components | submit button in the field error example (open question 16: design example) | "Save" | design |
| Shared components | time example | "09:00" for a time stored as 02:00 UTC in a browser on UTC+7; 24-hour `HH:mm`, no zone label (open question 6) | DATA-003.1 |
| Toast | text on a `403` | "You don't have permission to do that." | STD-2 |
| Toast | text on a network or server error | "Couldn't save. Try again." | STD-9, DEC-006 |

## Component map

No shared UI components exist in the codebase yet. Hairline's Button and TextInput are reused (constitution IV and V); every other component is new, built from Hairline tokens.

| Screen | Element | Component | Reuse / extend / new |
|--------|---------|-----------|----------------------|
| App shell | page frame (sidebar + main area) | app shell layout | new |
| App shell | sidebar | navigation region | new |
| App shell | product name | text (sidebar heading) | new |
| App shell | main area | main content region | new |
| Not found | "Not found" | page heading | new |
| Not found | "My issues" | link | new |
| Shared components | loading indicator (after 300 ms) | loading indicator | new |
| Shared components | empty message | empty state | new |
| Shared components | error message and Retry | error state (message + button) | new (its button is Hairline Button) |
| Shared components | "Retry" | button: Hairline Button, secondary | reuse |
| Shared components | "Save" | button: Hairline Button, primary | reuse |
| Shared components | "Name" field | text field: Hairline TextInput | reuse |
| Shared components | "Enter a name." under the field | field error message | new |
| Shared components | the Name form (field error example only; open question 16) | form | new |
| Shared components | time example | time display | new |
| Toast | toast | toast | new |
| Toast | stacked toasts | toast region (holds several toasts) | new |

No icons are used, and no component library beyond the approved Hairline components is needed for this layout.

## Keyboard and focus

| Screen | Tab order | Initial focus | Focus after actions | Keyboard alternatives |
|--------|-----------|---------------|---------------------|-----------------------|
| App shell | Nothing focusable in RM-1 (the product name is plain text); later slices add sidebar links then main-area controls, sidebar first | Browser default (document start) | — | — (no pointer-only action) |
| Not found | "My issues" link | Browser default on a full load; on an in-app navigation, the "Not found" heading | Following "My issues" → the target page's heading | — |
| Shared components | Set by the page that places them (no page in RM-1); within the load error state, Retry is the only control; within the field error example, Name field then Save (open question 16) | Set by the host page | Retry → focus moves to the reloaded content; if it fails again, stays on Retry. Save with a field error → the invalid field, text kept | — (no pointer-only action) |
| Toast | Not in the tab order (it has no controls: STD-9, DEC-006) | Never takes focus; its text is announced to screen readers when it appears | On appearing, focus stays where it was (for example on the submit button that failed); on disappearing after 5 seconds, focus is unchanged | — |

Focus is always visible on every focusable element (NFR-007).

## Deferred UI

| Slot | Screen | Filled by |
|------|--------|-----------|
| Sign-in page and sign-out; `/` sends members to My issues or sign-in | App shell | RM-3 |
| "My issues" link in the sidebar, and `/my-issues` as an empty landing page | App shell (sidebar) | RM-3; its content RM-11 |
| Active project list ("Website · WEB"), with its empty state | App shell (sidebar, under the product name) | RM-5 (REQ-015) |
| Archived list | App shell | RM-5 (REQ-013) |
| Project header in the main area | App shell (main area) | RM-5 |
| Members settings (`/settings/members`) entry point | App shell | RM-4 |
| New issue | App shell | RM-6 |

## Open questions

| # | Question | Behavior change? | Answer |
|---|----------|------------------|--------|
| 1 | The spec gives no route for the test-only fixture page, nor how each state is reached. Options: (a) one dev/test-only page (for example `/dev/states`) with one section per state, driven by test-controlled responses and no extra trigger controls; (b) one route per state. Recommendation: (a). | No (development and test builds only) | (a): one page at `/dev/states`, development and test builds only, one section per state, driven by test-controlled responses, no extra trigger controls (owner, 2026-09-29). Superseded 2026-09-29: DEC-005 drops the fixture page; states are verified by component tests (FR-020) |
| 2 | STD-9 gives no toast text for a network or server error. Options: (a) "Couldn't save. Try again."; (b) "Something went wrong. Try again."; (c) the owner adds a string to STD-9. Recommendation: the owner adds (a) to STD-9, since the spec owns copy. | Yes: DEC candidate (spec copy, shown app-wide) | Resolved in the spec: DEC-006 adds "Couldn't save. Try again." to STD-9 (spec v0.3) |
| 3 | STD-7 gives no message for the load error state beside Retry. Options: (a) "Couldn't load this."; (b) "Something went wrong."; (c) the owner adds a string to STD-7. Recommendation: the owner adds (a) to STD-7. | Yes: DEC candidate (spec copy, shown app-wide) | Resolved in the spec: DEC-006 adds "Couldn't load this." beside Retry to STD-7 (spec v0.3) |
| 4 | STD-9 fixes the toast at 5 seconds with no controls; WCAG 2.2 timing guidance favors a way to dismiss or pause it, but NFR-007 only requires AA contrast, keyboard and focus. Options: (a) no controls, 5 seconds as STD-9 says; (b) add a close button; (c) pause while hovered or focused. Recommendation: (a) unless the owner amends STD-9. | Yes: DEC candidate | Resolved in the spec: DEC-006 keeps 5 seconds with no dismiss or pause control (STD-9, spec v0.3) |
| 5 | Where the sidebar goes at phone width (section 3: works, not polished). Options: (a) the sidebar stacks above the main area; (b) a menu button that opens it (a new control). Recommendation: (a). | No for (a); (b) would be a DEC candidate | (a): the sidebar stacks above the main area (owner, 2026-09-29) |
| 6 | DATA-003.1 shows "09:00" but the spec sets no time format (24-hour or 12-hour, whether a date part or a zone label shows, what shows when the browser zone is invalid besides using UTC). Options: (a) 24-hour `HH:mm` as in DATA-003.1, no zone label, date format left to the first slice that shows dates (RM-6, RM-10); (b) the owner fixes a date-time format in the spec now. Recommendation: (a). | No (display format only) | (a): 24-hour `HH:mm`, no zone label; date format left to the first slice that shows dates (RM-6, RM-10) (owner, 2026-09-29) |
| 7 | The fixture's empty state: quote the STD-7 example "No issues yet. Create one." as plain text (no link, since nothing can be created in RM-1), or use a design string. Recommendation: quote STD-7 as plain text. | No (test-only page) | Quote STD-7 "No issues yet. Create one." as plain text, no link (owner, 2026-09-29). The fixture page is dropped (DEC-005); the string stays as the empty state example in Copy under Shared components |
| 8 | Is the sidebar product name "Tracklite" a link to `/`, or plain text? Recommendation: plain text in RM-1; RM-3 decides when `/` starts redirecting. | No | Plain text in RM-1; RM-3 decides when `/` redirects (owner, 2026-09-29) |
| 9 | The linked canvas is the "Hairline Design System" project: tokens, guidelines, shared components (Button, TextInput, StatusBadge, cards, TopNav, Footer) and a marketing UI kit (Home, Pricing, Changelog, Contact, and an AppMock issue list). It has no frame for any RM-1 screen or state, and adopting it would choose tokens, fonts and components, which constitution V says not to do here (no design system yet); its icons also load a library (Lucide) from a CDN (constitution IV). Options: (a) link a Tracklite canvas with one page for RM-1 holding the listed frames; (b) the owner adopts Hairline as the design system through a constitution amendment and the dependency approval, then frames RM-1 on a Tracklite canvas. Recommendation: (a). | Yes: DEC candidate for (b) (design system and dependency choice) | (a): the owner linked the Tracklite canvas "Tracklite RM-1 foundation" (`Tracklite.dc.html`), replacing the Hairline link (owner, 2026-09-29) |
| 10 | The Tracklite canvas renders its frames with the Hairline Design System: it loads Hairline tokens (fonts, colors, typography, spacing), its Button and TextInput components and its script bundle, and uses a dark page background. Constitution V says there is no design system yet and no tokens, colors, fonts or component library are chosen here; adopting one needs a constitution amendment and the owner's dependency approval (IV). Options: (a) treat the Hairline styling as incidental: the canvas decides layout only, nothing from it reaches code or plan.md, and the frames are optionally restyled neutral; (b) the owner adopts Hairline as the design system through a constitution amendment and the dependency approval. Recommendation: (a). | Yes: DEC candidate for (b) (design system and dependency choice) | (b): the owner adopted the Hairline Design System (constitution v1.2.0, Principles IV and V; Hairline tokens, `_ds_bundle.js`, Button, TextInput and Lucide approved). Components map to Hairline components where one fits (reuse), otherwise new, built from Hairline tokens; the canvas's Hairline styling is correct (owner, 2026-09-29) |
| 11 | Frames 1e and 1f show the Name field filled with "Q3 roadmap" while its error reads "Enter a name.", which only makes sense for an empty field; "Q3 roadmap" is also not in Copy. Options: (a) show the field empty with "Enter a name." beneath it (typed text kept means empty stays empty); (b) keep a filled value and change the design error string to a rule it breaks. Recommendation: (a). | No (test-only page, design strings) | (a): the Field error frames show the Name field empty with "Enter a name." beneath it (owner, 2026-09-29). Frames 1e and 1f lose their rows with the fixture page (DEC-005); see open question 15 |
| 12 | Frames 1g (Saving), 1h (Failed submit) and 1k (Toast phone) show "Q3 roadmap" typed into the Name field; the text is not in Copy. A filled field is needed there, since saving an empty Name gives the field error instead. Options: (a) record "Q3 roadmap" in Copy as design example input typed by the test (not text the app renders); (b) use another example value. Recommendation: (a). | No (test-only page, example input) | (a): "Q3 roadmap" is recorded in Copy as design example input typed by the test into the Name field (frames 1g, 1h, 1k) (owner, 2026-09-29). Those frames showed the fixture form, dropped by DEC-005; see open question 16 |
| 13 | Frame 1j shows a toast text not in Copy ("You don't have permission to do that. This longer message shows how text wraps…") to show wrapping; STD-9, STD-2 and DEC-006 give the only toast strings. Options: (a) show the two Copy strings only, wrapping them at a narrower width (as on phone, 1k); (b) record the longer text as a design test string for the fixture. Recommendation: (a). | No (layout; (b) adds a test-only string) | (a): frame 1j shows only the two Copy toast strings ("Couldn't save. Try again." and "You don't have permission to do that."), stacked and wrapped at a narrower width; no long demo string (owner, 2026-09-29) |
| 14 | With the fixture page dropped (DEC-005), the Toast overlay opens on no RM-1 page, but an overlay names the page it opens on. Options: (a) keep Toast as a screen with host page "none in RM-1, rendered by component tests", keep its 15 state rows, and redraw frames 1h, 1i, 1j, 1k as standalone toast frames (no fixture page, no Name form or Save button): one toast, the `403` toast, two stacked and wrapped, phone width; (b) drop Toast as a screen in RM-1, record its behavior (5 seconds, no controls, stacking, wrapping, never takes focus) only in Copy, Component map and Keyboard under Shared components, delete frames 1h to 1k, and let the first later slice with a form frame it on its host page. Recommendation: (a), since stacking, position and wrapping are layout that no other frame records. | No (layout record only) | (a): Toast stays a screen with host page "none in RM-1, rendered by component tests", keeping its state rows; frames 1h, 1i, 1j, 1k are redrawn as standalone toasts (no fixture page, no Name form, no Save, no "Q3 roadmap") (owner, 2026-09-30) |
| 15 | The other shared state components (loading indicator, empty state, load error with Retry, field error message wrapping under its field, time display) appear on no RM-1 page. Their frames 1e, 1f and 1l showed them inside the fixture page. Options: (a) redraw them as standalone component frames (no fixture page heading, section headings or section panels) and list them in the state inventory under a "Shared components" entry; (b) record them only in Copy, Component map and Keyboard, with no frame, and delete 1e, 1f and 1l. Recommendation: (a), matching open question 14 (a). | No (layout record only) | (a): a "Shared components" entry in the state inventory, framed by standalone component frames redrawn from 1e, 1f and 1l (owner, 2026-09-30) |
| 16 | The Name form ("Name" label, "Save" button, "Enter a name." error, "Q3 roadmap" example input) and its Saving state (STD-5: Save disabled while saving, frame 1g) existed only as fixture scaffolding. FR-008 to FR-010 do not list a Saving component, and the field error and toast components need a field or form to render next to only in tests. Options: (a) keep the Name form strings as design examples for the field error and toast frames, and drop the Saving state and frame 1g from RM-1 (its first real form slice records it); (b) drop the Name form, its strings and 1g entirely, showing the field error message and toast without a form; (c) keep everything, including Saving, as a standalone form example frame. Recommendation: (a). | No (design example strings; STD-5 behavior unchanged) | (a): keep "Name", "Save", "Enter a name." and "Q3 roadmap" as design example strings for the field error frames; drop the Saving state (STD-5, not in RM-1) and frame 1g (owner, 2026-09-30). "Q3 roadmap" later dropped by open question 17 |
| 17 | Open question 16 (a) keeps "Q3 roadmap" for the field error frames, but open question 11 (a) shows the Name field empty under "Enter a name.", and with the Saving state (1g) and the toast form (1h, 1k) gone no remaining frame shows a filled Name field. Options: (a) drop "Q3 roadmap" from Copy, since no frame shows it; (b) keep it and show it in one field error frame (for example 1l, the field filled before the error appears), which needs a design error string the value breaks (see open question 11 (b)). Recommendation: (a). | No (design example string only) | (a): "Q3 roadmap" is dropped from Copy; the field error frames (1f, 1l) keep the Name field empty under "Enter a name." (owner, 2026-09-30) |
| 18 | Frame 1k (Toast, phone width) shows the toast over the phone-width app shell (sidebar "Tracklite" stacked above an empty main area), while Toast has host page "none in RM-1, rendered by component tests" and 1h to 1j show the toast alone. Options: (a) accept the app shell as phone-width context only (the toast region spans the width with 12 px margins), with no change to the inventory; (b) redraw 1k as the toast alone in a 390 px frame. Recommendation: (a). | No (layout record only) | (a): frame 1k keeps the phone-width app shell as context only (showing where the toast sits on a small screen); the Toast's host page stays "none in RM-1, rendered by component tests" (owner, 2026-09-30) |

## Freeze checklist

- [x] Every screen in this slice's scope is listed, with a route or host page consistent with spec.md
- [x] Every screen has a row for every state in the checklist, or N/A with a reason
- [x] Every copy row quotes the spec exactly or is marked design
- [x] Every element has a component, marked reuse, extend or new
- [x] Every screen has its keyboard and focus row, with an alternative for each pointer-only action
- [x] Every deferred slot names its RM entry
- [x] Every open question is answered, and none changes behavior
- [x] The canvas is linked, every non-N/A state row has a frame, and no frame shows anything outside the inventory
- [x] Nothing adds a screen, control, state or string that changes behavior, or anything out of scope in spec section 3
