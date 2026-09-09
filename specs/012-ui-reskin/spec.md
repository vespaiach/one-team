# Feature Specification: UI Reskin to Broadsheet Design System

**Feature Branch**: `sdd/ui-reskin`

**Created**: 2026-09-08

**Status**: Draft

**Input**: User description: "Reskin the One Team application's UI to match an imported design from a Claude Design project, applying the design system to all existing UI surfaces of the product. Design system extracted from the Claude Design project 'One Team Web App mockups' — a warm editorial 'paper and ink' palette (clay/terracotta accents on a cream paper ground), a three-typeface system (a serif for headings and prose, a sans for interface chrome, a monospace for machine values), a 5px spacing scale with near-square corner radii, and a 'rules, not boxes' layout convention (hairlines and whitespace instead of filled panels) applied consistently across dense application chrome and looser editorial pages alike."

## Clarifications

### Session 2026-09-08

- Q: FR-006 and the Assumptions section say the Projects board, project details, issue detail/creation, new-project, and Settings Accounts/Labels screens are out of scope because they "are not yet built" — but the codebase already ships all of them as real, linked pages (`src/app/(app)/projects/[projectKey]/page.tsx` and its `details`, `issues/new`, and `issues/[issueNumber]/details` siblings, `src/app/(app)/projects/new/page.tsx`, `src/app/(app)/settings/accounts/page.tsx`, `src/app/(app)/settings/labels/page.tsx`), reachable today from the sidebar (`src/features/shell/components/sidebar.tsx`, `project-list-region.tsx`). Are they in scope for this reskin? → A: Yes. The feature is framed as applying the design system to "all existing UI surfaces" and "scoped to existing app surfaces only" — that framing tracks the codebase's actual routes, not the mockup commentary's outdated snapshot. FR-006, SC-001, User Story 3, and the Assumptions section are corrected to name every one of these pages; only the cross-project work list screen (genuinely not yet built) stays out of scope.
- Q: `contracts/page-inventory.md` and `tasks.md` (T018) both restyle `src/app/(auth)/error.tsx` — the `(auth)` route group's error boundary, which renders a heading, an error banner, a "request a new link" action, and the sign-in footer whenever a sign-in-flow page throws — but FR-006 and the Edge Cases section never name it, and page-inventory.md's own route table omits it despite claiming full route coverage. Is this error boundary in scope? → A: Yes. It is a boundary route reached inside a route group, exactly like the `(app)` group's `forbidden.tsx`/`not-found.tsx` boundaries the Edge Cases section already places in scope under "all existing UI surfaces" even though neither is a primary user journey; the auth error boundary is the same kind of surface and the same reasoning covers it. FR-006 and the Edge Cases bullet are corrected to name it explicitly alongside the not-found and forbidden boundaries.
- Q: FR-008 requires visible keyboard-focus indication on every focusable element, but unlike FR-007 (tied to SC-003) or FR-009 (marked vacuous in plan.md's Constitution Check), no task or plan.md line ties FR-008 to a concrete verification step. Does carrying the existing focus-ring rule forward unchanged in shape (`src/app/globals.css`'s single base-layer `[data-focus-visible], :focus-visible { outline: 2px solid var(--color-accent); ... }` rule, only re-coloured) implicitly satisfy FR-008? → A: No. An unchanged rule shape only guarantees an outline is drawn; it does not guarantee that outline stays visible once the accent colour it resolves is replaced and now sits behind newly accent-coloured control fills (a focused primary button's own background, for instance). FR-008 is corrected to require that focus visibility be verified against each element's actual restyled background, to the same 3:1 non-text contrast bar SC-003 already sets, rather than assumed from the rule's unchanged shape.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sign in and account-recovery screens carry the new look (Priority: P1)

A person arriving at One Team — signing in, recovering a forgotten password, setting a new one, or accepting a teammate's invitation — sees the product's new visual identity from the very first screen: the warm paper-and-ink palette, serif headings, and the rest of the design system, in place of the current look. Every branch these screens already support today (wrong credentials, a locked account, a closed account, an expired or already-used link) reads clearly in the new system.

**Why this priority**: These are the first screens anyone sees, whether joining the product for the first time or returning to it, and they are architecturally self-contained (their own layout, no dependency on the authenticated app shell), so they can be restyled and verified as a complete, shippable slice on their own.

**Independent Test**: Can be fully tested by visiting sign-in, forgot-password, reset-password, and accept-invitation directly (including their error, locked, expired, and used-link states) without signing in, and confirming each renders with the new palette, typography, spacing, and component styling while every existing action (submitting the form, following a link, toggling password visibility) still works.

**Acceptance Scenarios**:

1. **Given** the sign-in screen, **When** it renders, **Then** its background, text, button, and input styling match the new design system's palette, typography, and spacing, and the form still authenticates correctly.
2. **Given** a locked, closed, or otherwise rejected sign-in attempt, **When** the resulting message is shown, **Then** it is styled with the new system's warning/error treatment and remains legible and clearly distinguishable from a success state.
3. **Given** an expired or already-used password-reset or invitation link, **When** that dead-link screen renders, **Then** it uses the new design system and still offers the same recovery actions (request a new link, return to sign-in) as before.

---

### User Story 2 - The signed-in app shell carries the new look (Priority: P2)

A signed-in person sees the navigation rail and header bar — present on every page inside the product — restyled to the new design system: the grouped navigation sections, the workspace mark, hover states on nav items, and the header's search, view, and action controls all match the new visual language, while continuing to take people to exactly the destinations they do today.

**Why this priority**: The shell wraps every authenticated page, so restyling it changes the frame around all remaining work; it is also independently verifiable without touching the pages it wraps, since navigating and using shell controls doesn't depend on any individual page's content styling.

**Independent Test**: Can be fully tested by signing in and confirming the navigation rail and header bar render with the new design system, and that every existing nav destination and header control (search, profile, sign out) still functions.

**Acceptance Scenarios**:

1. **Given** a signed-in session, **When** the app shell renders, **Then** the navigation rail and header bar match the new design system's palette, typography, spacing, and component styling.
2. **Given** the navigation rail, **When** a person selects a destination they already have today, **Then** they land on that same destination exactly as before.
3. **Given** the header bar, **When** a person uses an existing control there (search, sign out), **Then** it behaves exactly as it does today.

---

### User Story 3 - Home, Notifications, Profile, and the remaining app pages carry the new look (Priority: P3)

A signed-in person viewing Home (in both its empty and populated states), Notifications, Profile, a project's board or details, an issue's detail or creation form, the new-project form, or the Accounts and Labels settings screens sees each page's content — text, cards, lists, and controls — restyled to the new design system, completing full visual consistency across every page the product offers today.

**Why this priority**: These are the remaining existing content pages; restyling them completes the reskin, but each page's content is independent of the others and of the shell, so they can be finished and verified last without blocking the higher-priority, more structural work above.

**Independent Test**: Can be fully tested by visiting Home, Notifications, Profile, a project board and its details, an issue's detail and creation forms, the new-project form, and the Accounts and Labels settings screens directly, and confirming each page's content is styled to the new design system while every existing action on that page (viewing notifications, editing a profile field, moving a board card, creating an issue or project, managing accounts or labels) still works.

**Acceptance Scenarios**:

1. **Given** Home with no data yet, **When** it renders, **Then** its empty-state messaging and any call-to-action are styled with the new design system.
2. **Given** Home with existing data, **When** it renders, **Then** its content matches the new design system's card, list, and typography treatment.
3. **Given** Notifications or Profile, **When** either renders, **Then** its content and controls match the new design system, and every existing interaction on the page continues to work exactly as before.
4. **Given** a project's board, its details, an issue's detail or creation form, the new-project form, or the Accounts or Labels settings screens, **When** any of them renders, **Then** its content and controls match the new design system, and every existing interaction there continues to work exactly as before.

---

### Edge Cases

- What happens to an error, locked, expired, or "already used" message on the auth screens? It MUST remain legible and distinguishable from ordinary content without relying on color alone (an icon, label, or text cue accompanies the color treatment).
- What happens for a person with a reduced-motion preference set? Any motion introduced by the restyle MUST be absent or minimized for that person, consistent with the source design's own reduced-motion fallback.
- What happens when navigation labels, notification text, or profile field values are longer than their container? The restyle MUST preserve whatever truncation, wrapping, or overflow handling those elements already have today.
- What happens to a person's existing data, preferences, or session when a page is restyled? Nothing about their data or session state changes — the restyle is presentation-only.
- What happens on a page this spec does not name (e.g., a not-found or forbidden boundary page reached inside either route group, the root not-found boundary reached outside both, or the `(auth)` route group's error boundary shown when a sign-in-flow page throws)? It MUST also be restyled to the new design system, since it is part of "all existing UI surfaces," even though it isn't a primary user journey.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The product's shared color tokens (background, surface, text, primary accent, secondary accent, neutral ramp, and semantic colors such as danger/advisory) MUST be replaced with the new palette's values, and no existing UI surface may continue to render with the prior color tokens.
- **FR-002**: The product's typography MUST move from its current single-typeface system to a three-typeface system: one face for headings and body prose, a distinct face for interface chrome (navigation, buttons, labels, toolbars), and a monospace face reserved for machine values (identifiers, dates, counts, timestamps). The existing heading scale (H1–H6) and body text size MUST be updated to the new system's scale.
- **FR-003**: The product's spacing scale and corner-radius values MUST be updated to the new design system's scale and applied to layout spacing — gaps, padding, and margins between elements — and corner radii across all existing surfaces. This governs spacing between elements, not fixed width/height values that function as layout constraints (for example, a sidebar's width or a form field's height), which remain out of scope for this requirement.
- **FR-004**: Every reusable UI element already in use on an existing surface — buttons (in whatever variants are already used: primary, secondary, ghost, icon), text inputs and their labels and validation/error states, cards, navigation items, badges/pills, dialogs, and tables — MUST be restyled to match the new design system's component patterns.
- **FR-005**: The signed-in navigation rail and header bar MUST be restyled to the new design system's chrome pattern (grouped navigation, hover states, workspace mark, header controls) while preserving their current information architecture: the same destinations, counts, and any collapse behavior they offer today.
- **FR-006**: Every existing page MUST be restyled to the new design system: sign-in, forgot password, reset password, accept invitation (including their error, locked, closed, expired, and already-used states); Home (in both its empty and populated states); Notifications; Profile; a project's board and its details; an issue's detail and creation forms; the new-project form; the Settings Accounts and Labels screens; the product's existing not-found and forbidden boundary pages; and the `(auth)` route group's error boundary (`src/app/(auth)/error.tsx`, shown when a sign-in-flow page throws).
- **FR-007**: Every interactive state an existing control already implements (hover, pressed, focus, selected, disabled, error, loading, empty) MUST remain visually distinguishable after the restyle and MUST continue to meet the contrast and non-color-only-signaling standards the product already commits to.
- **FR-008**: Visible keyboard-focus indication MUST be present on every focusable element on every restyled surface, using the new design system's focus treatment. Carrying a focus-ring rule forward unchanged in shape does not by itself satisfy this requirement — visibility MUST be verified against each element's actual restyled background, meeting the same 3:1 non-text contrast bar SC-003 sets for non-text UI components.
- **FR-009**: The restyle MUST NOT alter any existing page's functional behavior, data, copy, or navigation destinations — it changes visual presentation only.
- **FR-010**: A decorative flourish present in the source design but with no established equivalent in the product today (for example, an illustrative hero background or an animated ink-separation effect on marketing/auth imagery) MAY be included as optional polish, but its inclusion MUST NOT be required for, or block, the restyle of any surface listed in FR-006. Inclusion is decided per surface — a flourish present on one surface and absent from another is not a defect, since it is optional polish rather than a requirement to satisfy uniformly.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of the product's existing pages (sign-in, forgot password, reset password, accept invitation, Home, Notifications, Profile, a project's board and its details, an issue's detail and creation forms, the new-project form, and the Settings Accounts and Labels screens) and the shared app shell render using the new palette, typography, and spacing — zero surfaces retain the prior visual system.
- **SC-002**: Every automated test that passed before the restyle continues to pass afterward, with changes limited to visual/style assertions — no functional test regresses.
- **SC-003**: Every piece of text and every interactive control on every restyled surface meets a 4.5:1 (text) or 3:1 (large text and non-text UI components) contrast ratio against its background, except text and controls in a disabled state, which WCAG's own contrast criteria exempt.
- **SC-004**: A person can complete every task the product supports today (signing in, recovering a password, accepting an invitation, viewing Home, viewing Notifications, viewing and editing Profile, signing out) after the restyle with no change in the number of steps required.

## Assumptions

- The Claude Design project's own prototype commentary describes Home and a cross-project work list as gaps relative to an earlier snapshot of the codebase; the codebase has since caught up and already implements Home, Notifications, Profile, the project board (kanban), project details, issue detail and creation, the new-project form, and the Settings Accounts and Labels screens as real, linked pages. This spec restyles every one of those existing surfaces (per FR-006) — it does not add the cross-project work list screen shown in the mockup, since that one is not yet built; it will pick up the same design system when its own feature is specified.
- The product has no dark theme today, and this reskin does not introduce one.
- The signed-in app shell remains desktop-oriented, consistent with its current behavior; no new responsive/mobile layout is introduced or required by this reskin.
- Exact icon assets are an implementation decision for planning; this spec only requires that iconography read consistently with the new design system's chrome.
- The source design's own prototyping markup and runtime are a reference for the look only; the product continues to implement all restyled surfaces with its own existing UI toolkit and shared style tokens.
