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

- Mailpit, which catches the sign-in emails sent in local development. On macOS:

  ```sh
  brew install mailpit && mailpit
  ```

  Its web UI and the HTTP send API the app calls are on http://localhost:8025. Its SMTP port is not used.

### Setup

```sh
createdb tracklite_dev
createdb tracklite_test
cp .env.example .env.local
```

In `.env.local`, fill in your PostgreSQL user and password:

- `DATABASE_URL`: the development database.
- `TEST_DATABASE_URL`: the test database. It must be different from `DATABASE_URL`.

And the settings the app server checks when it starts:

- `APP_URL`: the address sign-in links point to, such as `http://localhost:3000`.
- `EMAIL_FROM`: the sender address of sign-in emails, such as `tracklite@localhost`.
- `MAILPIT_HOST` and `MAILPIT_PORT`: where Mailpit runs locally, such as `localhost` and `8025`.
- `RESEND_API_KEY`: production only, where email is sent through Resend instead of Mailpit. Leave it empty locally.

`.env.local` is git-ignored. Never commit it.

### Run

```sh
npm ci
npm run db:migrate
npm run setup -- --email you@example.com --name "Your Name" --username you
npm run dev
```

`npm run db:migrate` must run before `npm run setup`. `setup` creates the first admin and works only while no members exist.

Open http://localhost:3000, enter the admin's email, and open the sign-in link from Mailpit at http://localhost:8025.

To fill the development database with sample members instead, run `npm run db:seed` after `npm run db:migrate`, and sign in as the seeded admin `owner@example.com`. It can be run again.

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
| `npm run setup` | Creates the first admin |
| `npm run db:seed` | Adds sample data to the development database |

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
