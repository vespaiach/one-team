# Tracklite

Tracklite is a small issue tracker for one invite-only team. It has projects, issues, comments, a kanban board and a list view, and leaves out the heavier features of tools like Linear, such as cycles, roadmaps and integrations.

**Status:** early development. Work is built in slices, listed in [ROADMAP.md](ROADMAP.md).

## Tech stack

Next.js 16, React 19, React Aria Components, Tailwind CSS 4, PostgreSQL 18, Vitest and Biome.

## Getting started

### Prerequisites

- Node.js 24 LTS and npm.
- PostgreSQL 18, installed locally and running (no containers). On macOS:

  ```sh
  brew install postgresql@18
  brew services start postgresql@18
  ```

### Setup

```sh
createdb tracklite_dev
createdb tracklite_test
cp .env.example .env.local
```

In `.env.local`, fill in your PostgreSQL user and password:

- `DATABASE_URL`: the development database.
- `TEST_DATABASE_URL`: the test database. It must be different from `DATABASE_URL`.

`.env.local` is git-ignored. Never commit it.

### Run

```sh
npm ci
npm run db:migrate
npm run dev
```

Open http://localhost:3000.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Starts the dev server |
| `npm run build` | Builds for production |
| `npm start` | Serves the production build |
| `npm test` | Runs the tests with Vitest |
| `npm run lint` | Checks code with Biome |
| `npm run typecheck` | Checks types with TypeScript |
| `npm run db:migrate` | Applies pending migrations |
| `npm run deploy` | Deploys `main` to production |
| `npm run rollback` | Switches production back to the previous release |

## Project structure

```
src/app         routes and layouts
src/components  shared UI (ui/, layout/)
src/features    code for one feature
src/server      server-only code
migrations/     SQL migrations, applied in name order
specs/          spec, plan and tasks for each slice
docs/           product spec
```

## Documentation

- [docs/tracklite-spec.md](docs/tracklite-spec.md): what the product does.
- [ROADMAP.md](ROADMAP.md): the slices and their order.
- [AGENTS.md](AGENTS.md): coding conventions.
- [docs/production.md](docs/production.md): production server setup, deploy, rollback, backups and logs.
