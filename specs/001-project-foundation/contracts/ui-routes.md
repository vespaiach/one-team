# Contract: Page routes and shared UI pieces (RM-1)

Layout, copy, states, keyboard and focus are fixed by the Frozen [design.md](../design.md); this file lists only the routes and the interfaces later slices use. There is no test-only page (DEC-005); each shared piece is verified by a component test that renders it directly (FR-020, research R7).

## Routes

| Route | Result |
|-------|--------|
| `/` | App shell: sidebar with "Tracklite" only (no project list element in RM-1; RM-5 adds the list), empty main area. Title "Tracklite". |
| any unmatched address (e.g. `/nothing-here`, `/issue/WEB-999`, `/project/NOPE`, `/my-issues` until RM-3) | Not found page inside the shell, HTTP `404`, heading "Not found", link "My issues" to `/my-issues`. Title "Not found · Tracklite". The heading takes focus after a client-side navigation, not on a full page load (research R13). |

## Shared pieces for later slices

| Piece | Kind | Contract |
|-------|------|----------|
| `AppShell` | layout | Wraps every page (root layout); sidebar region with "Tracklite" as plain text and no project list element (RM-5 adds it), main region. Sidebar stacks above the main area at phone width. |
| `Loading` | component | Renders nothing until loading has taken more than 300 ms (nothing at 300 ms, shown at 301 ms), then `<div role="status" aria-label="Loading">`. |
| `EmptyState` | component | Prop: the message naming the next action (plain text). |
| `LoadError` | component | Prop: `onRetry`. Shows "Couldn't load this." and a Hairline secondary Button "Retry". |
| `useLoad(url)` | hook | Returns `{ state: "loading" \| "loaded" \| "error", data, retry }`. Any non-2xx answer or rejected `fetch` gives state `"error"`. `retry` refetches while the state stays `"error"` (it never returns to `"loading"`), so `LoadError` and Retry never unmount during a retry and focus stays on Retry after another failure; no busy or disabled Retry state. |
| `saveJson(url, body)` | function | Returns `{ ok: true, data }` on `2xx`; `{ ok: false, fields }` on `422` with `error.fields`; `{ ok: false, toast: "You don't have permission to do that." }` on `403`; `{ ok: false, toast: "Couldn't save. Try again." }` on any failure not tied to a field (`400`, `401`, `404`, `409`, `5xx`, a network error, or `422` without `fields`). Never clears form state. |
| `FieldError` | component | Props: field id and message. Message under its field, linked with `aria-describedby`; the field gets `aria-invalid="true"`; the text wraps, never truncates. |
| `useToast()` | hook (from `ToastProvider` in the root layout) | `showToast(text)`; toasts stack in one `aria-live="polite"` region, wrap their text, each disappears 5 s after it appears, no controls, never takes focus. |
| `LocalTime` | component | Prop: ISO UTC string. Renders `<time dateTime>` showing `HH:mm` (24-hour) in the browser's zone, no zone label; UTC if the zone is missing or invalid. |

## Focus owned by host pages

Host pages, not shared pieces, own these focus moves (design.md, Keyboard and focus; owner answer U1):

- **Retry success moves focus to the content**: the host renders its content in a `tabIndex={-1}` container it owns and focuses it when `useLoad`'s `state` changes from `"error"` to `"loaded"`.
- **A `422` moves focus to the invalid field**: the host focuses the field named in `saveJson`'s `fields` (the same field id it passes to `FieldError`).

Shared pieces only expose what hosts need (`state`, `fields`, the field id `FieldError` references) and never move focus themselves; their component tests do not assert these moves.
