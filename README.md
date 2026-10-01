# Tracklite

## Setup

### Prerequisites

- Node.js 24 LTS and npm.
- PostgreSQL 18 installed locally and running, no containers. On macOS:

  ```sh
  brew install postgresql@18
  brew services start postgresql@18
  ```

### Databases

Create a development and a test database:

```sh
createdb tracklite_dev
createdb tracklite_test
```

### Settings

Copy `.env.example` to `.env.local` and fill both settings with your local PostgreSQL user and password:

```sh
cp .env.example .env.local
```

- `DATABASE_URL`: the development database, e.g. `postgres://USER:PASSWORD@localhost:5432/tracklite_dev`.
- `TEST_DATABASE_URL`: the test database, e.g. `postgres://USER:PASSWORD@localhost:5432/tracklite_test`. It must differ from `DATABASE_URL`.

`.env.local` is git-ignored; never commit it.

### Run

```sh
npm ci
npm run db:migrate
npm run dev
```

Open http://localhost:3000 to see the app shell.

## Commands

The scripts (build, test, lint, migrations, dev server) are defined in `package.json`.
