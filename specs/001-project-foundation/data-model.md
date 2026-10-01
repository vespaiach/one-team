# Data Model: Project Foundation (RM-1)

RM-1 adds no product entity (members, projects, issues arrive in later slices). It has one database table and three in-memory shapes. See [research.md](./research.md) R2, R3, R5, R8, R9.

## schema_migrations (database table)

The schema version: which schema change files have been applied.

| Column | Type | Rules |
|--------|------|-------|
| `name` | `text`, primary key | File name in `migrations/`, e.g. `0001_members.sql`. Files apply in ascending name order. |
| `applied_at` | `timestamptz`, not null, default `now()` | UTC (DATA-003). |

- Created by the migration runner itself (`create table if not exists`) before it reads the list, so an empty database needs no baseline file.
- State per file: **pending** (file present, no row) → **applied** (row inserted in the same transaction as the file's SQL). A failing file stays pending; the runner stops and exits non-zero, naming the file; files after it are not attempted.
- Running the command with nothing pending changes nothing and exits 0.
- A row whose file no longer exists is ignored (files are never deleted or renamed once applied; stated in AGENTS.md with the OPS-004 rule that each change works with the previous release's code).

## Configuration (in memory, read at start-up)

| Setting | Required by | Secret | Rules |
|---------|-------------|--------|-------|
| `DATABASE_URL` | app, `db:migrate` | Yes (holds the password) | Must be set for the app and `db:migrate`; empty counts as missing. Optional for `npm test`. |
| `TEST_DATABASE_URL` | `npm test` (Vitest global setup) | Yes | Must be set for the test command (missing or empty → `Missing setting: TEST_DATABASE_URL`, nothing changed); the only setting tests need. When `DATABASE_URL` is set, must name a different database from it, compared by parsed host, port and database name (`localhost`, `127.0.0.1` and `::1` are the same host; a missing port is `5432`), not as raw strings. During tests it replaces `DATABASE_URL` for the code under test. |

- Source: `.env.local` (git-ignored); `.env.example` holds placeholder values only.
- Missing setting → the process stops with `Missing setting: NAME`; values are never printed.
- Later slices add settings here (for example the email API key in RM-3).

## API error (response body)

| Field | Type | Rules |
|-------|------|-------|
| `error.message` | string | Human-readable; generic for `500`, no internal detail. |
| `error.fields` | object, field name → message | Only on `422`; one message per invalid field. |

Status codes: `401` not signed in, `403` not allowed, `404` not found, `422` invalid input, `500` unexpected (contracts/http-api.md).

## Request log entry (standard output, one JSON object per line)

| Field | Type | Rules |
|-------|------|-------|
| `time` | string | ISO 8601 UTC, when the response was ready. |
| `method` | string | HTTP method. |
| `path` | string | URL path only; the query string is never included. |
| `status` | number | Final status, including `500` for unexpected errors. |
| `durationMs` | number | Whole milliseconds from handler start to response. |

Never contains headers, cookies, tokens, request or response bodies, or description and comment text (SEC-007). An unexpected error adds a separate line with `level: "error"` and the error's name only.
