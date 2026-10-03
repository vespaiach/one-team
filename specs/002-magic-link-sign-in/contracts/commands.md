# Contract: Commands and settings (RM-3)

Adds to RM-1's `package.json` scripts (`specs/001-project-foundation/contracts/commands.md`). Each runs from the repository root, loads `.env.local` when present, and needs only `DATABASE_URL` (FR-029). Both need the schema: run `npm run db:migrate` first (FR-001, SC-001).

## `npm run setup -- --email <email> --name "<full name>" --username <username>`

`scripts/setup.ts`. Creates the first admin (OPS-001, FR-001 to FR-003; research R16). The input is validated before the existing-members check (FR-003), so invalid input gets its field lines on any database.

| Case | Output | Exit |
|------|--------|------|
| No members exist, input valid | `Created admin <username>` | 0 |
| Input valid, any member exists (also the loser of two simultaneous runs) | `Setup already done` (stderr) | 1 |
| Invalid input (any database) | one line per invalid field, e.g. `full name: Name required` (blank or whitespace-only), `full name: Too long (max 60)` (over 60 characters after trimming), `username: 2 to 20 lowercase letters, digits or hyphens`, `email: Enter a valid email address.` (stderr); nothing created | 1 |
| Missing argument | the same field line for that field | 1 |
| Schema not migrated (`npm run db:migrate` not run) | the database error (stderr); nothing created | 1 |

`--username Owner` is stored as `owner`; the email is later compared ignoring capitals. The email line uses the one email rule shared with the sign-in form (`isValidEmail` in `src/server/emailAddress.ts`: trimmed, WHATWG `type="email"`, at most 254 characters).

## `npm run db:seed`

`scripts/seed.ts`. Adds the NFR-001 seed data for this slice to the development database: the first admin and 14 more members (one deactivated); re-runnable (existing rows skipped). Later slices extend the same script (research R19).

## Settings checked at start-up (`next dev`, `next start`)

`src/instrumentation-node.ts` exits 1 with `Missing setting: <NAME>` for the first missing one, or `Invalid setting: <NAME>` for the first one present with a bad format (FR-029; research R6, R7). The setup command, `npm run db:seed` and `npm run db:migrate` don't check these:

| `NODE_ENV` | Required (besides `DATABASE_URL`) |
|------------|-----------------------------------|
| `production` | `APP_URL`, `EMAIL_FROM`, `RESEND_API_KEY` |
| anything else (local development) | `APP_URL`, `EMAIL_FROM`, `MAILPIT_HOST`, `MAILPIT_PORT` (Mailpit's web/API port, e.g. `8025`) |

Format checks:

| Setting | Valid when |
|---------|-----------|
| `APP_URL` | an absolute `http` or `https` origin: `new URL(value).origin` equals the value (no path, query or fragment), e.g. `http://localhost:3000` |
| `MAILPIT_PORT` (local development) | an integer from 1 to 65535 |
| `EMAIL_FROM` | a valid email by the one email rule (`isValidEmail`) |

`.env.example` gains placeholder lines for these settings; real values only ever go in `.env.local` (OPS-006).
