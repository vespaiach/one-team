# Quickstart: validating Project Foundation (RM-1)

Runnable checks that prove RM-1 works. Commands are defined in [contracts/commands.md](./contracts/commands.md); routes, shapes and shared pieces in [contracts/ui-routes.md](./contracts/ui-routes.md), [contracts/http-api.md](./contracts/http-api.md) and [data-model.md](./data-model.md). There are no browser end-to-end tests (DEC-005).

## Prerequisites

- Node.js 24 LTS and npm.
- PostgreSQL 18 installed locally and running (for example `brew install postgresql@18 && brew services start postgresql@18`).
- Two databases: `createdb tracklite_dev` and `createdb tracklite_test`.

## 1. Fresh clone to app shell (User Story 1, SC-001)

```sh
npm ci
cp .env.example .env.local        # then set DATABASE_URL and TEST_DATABASE_URL
npm run db:migrate                # prints the applied files, or nothing pending
npm run db:migrate                # second run: nothing pending, exit 0
npm run dev                       # open http://localhost:3000
```

Expected: the shell shows "Tracklite" in the sidebar and no project list (RM-5 adds it), an empty main area; the tab title is "Tracklite". Time from clone: under 15 minutes.

Missing setting: remove `DATABASE_URL` from `.env.local` and run `npm run build && npm start` → exits 1 with `Missing setting: DATABASE_URL`, no secret value printed.

## 2. Standard commands (User Story 2, SC-002)

```sh
npm run build && npm test && npm run lint
```

Expected: all three exit 0; `npm test` first resets and migrates the test database, then runs the unit and component tests. Then, one at a time, add a failing assertion to a test, an unused variable to a source file, and a type error; the matching command (`npm test`, `npm run lint`, `npm run build`) exits non-zero and names the problem. Revert each. Set `TEST_DATABASE_URL` to the same database as `DATABASE_URL` (also written differently, e.g. `127.0.0.1` for `localhost`) → `npm test` refuses to run and changes nothing. Unset `DATABASE_URL` → `npm test` still runs (tests need only `TEST_DATABASE_URL`); unset `TEST_DATABASE_URL` → `npm test` refuses with `Missing setting: TEST_DATABASE_URL`.

## 3. Shared states (User Story 3, SC-003)

Covered by the component tests in `npm test`, each rendering its state directly: loading indicator only after 300 ms (`role="status"`, `aria-label="Loading"`), none when loading ends sooner; "No issues yet. Create one."; "Couldn't load this." with Retry that reloads; "Enter a name." under the Name field, text kept, message wraps; toasts "Couldn't save. Try again." and "You don't have permission to do that." announced, stacked, focus unchanged, each gone after 5 s; "09:00" for `02:00Z` on UTC+7; Not found page with "My issues".

By hand: open `/nothing-here`, `/issue/WEB-999` and `/project/NOPE` on the dev server → "Not found" inside the shell with a "My issues" link, HTTP `404`, title "Not found · Tracklite". With the keyboard only, the "My issues" link, the "Not found" heading (after an in-app navigation) and Hairline Buttons show a visible focus style.

Page speed (SC-007, NFR-002), by hand: on broadband with a warm cache, record `/` and then `/nothing-here` in the browser performance panel → each page is usable within 1.5 s of navigation.

## 4. Operability and safety (User Story 4, SC-004 to SC-006)

```sh
for i in $(seq 10); do curl -s -o /dev/null -m 1 -w '%{http_code} %{time_total}\n' http://localhost:3000/health; done
                                                # 10/10: 200, each within 1 s
curl -s http://localhost:3000/health            # {"status":"ok"}
brew services stop postgresql@18
for i in $(seq 10); do curl -s -o /dev/null -m 1 -w '%{http_code} %{time_total}\n' http://localhost:3000/health; done
                                                # 10/10: 503, each within 1 s
curl -s http://localhost:3000/health            # {"status":"unavailable"}
```

Start with the database stopped: stop the dev server, keep PostgreSQL stopped, run `npm run dev` again → the app starts and `curl -i http://localhost:3000/health` answers `503` `{"status":"unavailable"}`. In RM-1 only this half of the spec's "database unreachable at start" edge case applies; pages showing Retry applies from the first slice with a data page. Then:

```sh
brew services start postgresql@18
curl -s 'http://localhost:3000/api/nope?token=abc123' -H 'Cookie: s=secret'
```

Expected: the dev server's output has one JSON line per request with `method`, `path` (`/api/nope`, no query), `status`, `durationMs`, and no `abc123` or `secret`. The same rules are asserted by the unit tests of the API wrapper (T041): its per-request assertion, exactly one timing line per API request with no secrets, is the proof of SC-005, since the grep below would also pass on a run that logs nothing. For the full test run:

```sh
npm test 2>&1 | tee "$TMPDIR/rm1-test.log"
grep '^{"time"' "$TMPDIR/rm1-test.log" | grep -E 'abc123|secret|token='   # no match (JSON log lines only)
```

Repository check: for each value in `.env.local`, `git grep -F "<value>"` finds nothing; `git check-ignore .env.local` prints the file.

## 5. API convention (User Story 5)

```sh
curl -i http://localhost:3000/api/nothing        # 404, JSON {"error":{"message":"Not found"}}
curl -i http://localhost:3000/api                # 404, same JSON
```

The `401`, `403`, `404`, `422` and `500` shapes are checked by unit tests of the shared API wrapper and the `/api` catch-all (`npm test`).
