# Contract: Project commands (RM-1)

npm scripts in `package.json`, run from the repository root (section 12, DEC-005, FR-004). The three standard commands are build, test and lint. AGENTS.md points to `package.json` and does not copy these.

| Script | Does | Exit |
|--------|------|------|
| `npm run build` | Production build (`next build`), including the type check. | non-zero on a type or build error |
| `npm test` | Vitest run: global setup resets and migrates the test database (`TEST_DATABASE_URL`, refused if it names the same host, port and database name as `DATABASE_URL`), then runs unit tests (Node) and component tests (jsdom). | non-zero on any failing test, naming it |
| `npm run lint` | `eslint . --max-warnings 0` with `eslint-config-next`. | non-zero on any rule violation or warning, naming file, line and rule |
| `npm run dev` | Development server (Next.js) with `.env.local`. | — |
| `npm start` | Serves the production build. Stops with `Missing setting: NAME` if a required setting is missing. | 1 on missing setting |
| `npm run db:migrate` | Applies pending `migrations/*.sql` files in name order to `DATABASE_URL`, one transaction each; prints each applied file; stops at the first failure and names it. | non-zero on failure; 0 when nothing is pending |

There is no end-to-end test command (DEC-005).

Prerequisites (documented in the setup steps of `README.md`, which AGENTS.md points to): Node.js 24 LTS, PostgreSQL 18 running locally with a development and a test database, and `.env.local` copied from `.env.example`.
