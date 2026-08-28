<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Instruction Conflict Guide

When instructions conflict, follow the user's current request first, then the most specific repository guidance. Do not silently reinterpret product or architecture decisions.

# Project overview

- Framework: Next.js 16.x using the App Router
- Language: TypeScript 7 in strict mode
- UI: React, React Aria library, TailwindCss
- Database: PostgreSQL 18
- ORM and migrations: Drizzle ORM and Drizzle Kit
- Formatting and linting: Biome
- Package manager: npm

# Working principles (follow strictly)

1. Read the relevant route, feature, tests, schema, and configuration before editing.
2. Make the smallest cohesive change that fully solves the request.
3. Preserve unrelated work. Never rewrite, remove, or reformat unrelated files.
4. Reuse established patterns before adding a new abstraction.
5. Do not install a package or introduce an external service without approval.
6. Do not claim a check passed unless you ran it and saw it pass.
7. Treat all client input, Server Action arguments, route parameters, headers, cookies, and external responses as untrusted.
8. Keep secrets, database access, and authorization logic on the server.

# Recommended project structure

```text
.
├── drizzle/                     # Generated, committed SQL migrations and metadata
├── public/                      # Static assets
├── src/
│   ├── app/                     # Routing, layouts, pages, route handlers
│   │   ├── (public)/            # Route group for public pages
│   │   ├── (app)/               # Route group for authenticated product pages
│   │   ├── api/                 # HTTP endpoints only when an HTTP API is needed
│   │   ├── globals.css
│   │   └── layout.tsx
│   ├── components/
│   │   ├── ui/                  # Shared, styled React Aria primitives
│   │   └── shared/              # Cross-feature composed components
│   ├── features/
│   │   └── feature-name/
│   │       ├── components/      # Feature-specific UI
│   │       ├── server/          # Server-only queries, actions, and services
│   │       │   ├── actions.ts
│   │       │   ├── queries.ts
│   │       │   └── service.ts
│   │       ├── model.ts         # Domain rules and pure transformations
│   │       └── types.ts         # Feature-owned public types
│   ├── db/
│   │   ├── client.ts            # Drizzle client construction
│   │   └── schema/              # Tables, constraints, relations, and indexes
│   │       └── index.ts
│   ├── lib/                     # Small cross-cutting utilities and infrastructure
│   │   ├── env.ts
│   │   └── errors.ts
│   └── test/                    # Shared test setup, factories, and helpers
├── biome.json
├── drizzle.config.ts
├── next.config.ts
├── package.json
└── tsconfig.json
```

## Structure rules

- Keep `src/app` focused on routing and composition. Do not turn pages or layouts into large domain modules.
- Colocate code that is used by only one route or feature. Promote it to `components/shared` or `lib` only after there is a real second use.
- Put reusable, accessible UI primitives in `components/ui`. They must not import feature, authentication, or database code.
- Put business behavior in `features/<feature>`, not in generic utility files.
- Database schema and client setup belong in `db`. Feature-specific queries may live in `features/<feature>/server` and import `db`.
- Client Components must never import database clients, secrets, or arbitrary server-only modules. They may import Server Functions only from a dedicated module marked with top-level `"use server"`.
- Avoid barrel files that mix server and client exports. Import from the owning module when a barrel could blur that boundary.
- Route groups such as `(public)` and `(app)` organize layouts; they do not add URL segments.

# Next.js 16 and App Router

- Pages and layouts are Server Components by default. Keep them server-side unless interactivity, browser APIs, effects, or local state require a Client Component.
- Add `"use client"` only at the narrowest interactive boundary. Everything imported below that boundary joins the client module graph.
- Fetch data in Server Components or server-only feature modules. Pass only minimal, serializable data into Client Components.
- Treat `params`, `searchParams`, `cookies()`, and `headers()` as asynchronous APIs.
- Use Server Actions for mutations initiated by this application. Use Route Handlers for public APIs, webhooks, callbacks, feeds, or endpoints that require HTTP semantics.
- Treat every Server Action as a public server entry point: validate input, authenticate, authorize the exact resource, and return a safe result.
- Do not rely on proxy checks as authoritative authorization. If `proxy.ts` is used, use it for fast routing or redirects and repeat authorization at the protected server boundary.
- Choose caching behavior deliberately. Do not assume a database query or `fetch` call is cached. Revalidate or invalidate affected data after mutations when the route uses caching.
- Use `loading.tsx`, `error.tsx`, and `not-found.tsx` where they materially improve the route experience.
- Do not expose internal errors, SQL, stack traces, or secret configuration to the browser.

# TypeScript

- Keep `strict: true`. Do not weaken compiler options to make a change pass.
- Prefer precise domain types, discriminated unions, and `unknown` at untrusted boundaries.
- Avoid `any`, non-null assertions, `@ts-ignore`, and unsafe type casts. If one is truly unavoidable, keep it narrow and explain why.
- Use `import type` for type-only imports.
- Use `satisfies` when validating an object's shape while preserving inference.
- Derive persistence types from Drizzle with `$inferSelect` and `$inferInsert` when appropriate, but do not expose database rows directly as public API or UI models.
- Model expected failures as typed results or domain errors. Reserve thrown errors for exceptional failures and map them at the server boundary.
- Do not duplicate equivalent domain types merely to avoid importing their owner. Define an explicit DTO or boundary type when trust, serialization, visibility, or lifecycle requirements differ.
- Validate runtime data; a TypeScript type alone is not runtime validation. Reuse the repository's existing validation approach and ask before adding a library.

# Drizzle ORM and PostgreSQL 18

## Schema and migrations

- The TypeScript schema under `src/db/schema` is the code-first source of truth.
- Generate migrations with Drizzle Kit, inspect the generated SQL, and commit the migration plus its metadata.
- Never edit a migration that may already have run in a shared environment. Add a new migration instead.
- Do not use `drizzle-kit push` against production. Production changes must use reviewed, versioned migrations.
- Prefer backward-compatible expand/migrate/contract changes for live tables.
- Name constraints and indexes when the name improves diagnostics or operations.

## Data integrity

- Every table needs a stable primary key.
- Enforce invariants in PostgreSQL with `NOT NULL`, `UNIQUE`, `CHECK`, and foreign key constraints whenever the database can express them.
- Define foreign-key delete and update behavior explicitly when the default is not the intended domain behavior.
- Remember that PostgreSQL does not automatically index the referencing side of a foreign key. Add an index when the real access or delete/update pattern needs it.
- Use `timestamp with time zone` for real-world instants and keep application logic in UTC. Use a date type for calendar dates that are not instants.
- Use exact numeric types for money or other exact decimal values; do not use floating-point storage for them.

## Queries and transactions

- Select only the columns needed by the caller. Do not return sensitive fields by default.
- Bound list queries and use deterministic ordering. Prefer cursor-based pagination for large or frequently changing datasets.
- Use a transaction when multiple writes must succeed or fail together.
- Protect concurrency-sensitive invariants with database constraints, atomic statements, appropriate conflict handling, or locks. A read followed by a write is not sufficient protection.
- Avoid N+1 queries. Batch or join when it improves the measured access pattern.
- Use Drizzle parameterization. Never interpolate untrusted input into raw SQL.
- Raw SQL is acceptable only when Drizzle cannot express the operation clearly; keep it localized, parameterized, typed, and tested.
- Do not create speculative indexes. Add them for known query patterns and inspect query plans when performance is the reason for the change.

## Database lifecycle

- Use a separate database for automated tests. Never point tests at development, staging, or production data.
- Apply migrations before tests that depend on the schema.
- Keep seeds deterministic and safe to rerun when practical.
- Never log connection strings, credentials, tokens, or sensitive row contents.

# React Aria Components

- Build shared interactive primitives with `react-aria-components` rather than recreating ARIA behavior, focus management, selection, overlays, or keyboard interactions manually.
- Prefer native semantic HTML for simple, non-composite content. Do not add ARIA when native semantics already express the behavior.
- Every control must have an accessible name. Prefer a visible `<Label>`; use `aria-label` or `aria-labelledby` only when a visible label is not appropriate.
- Preserve React Aria's structure and semantics. Do not add roles or keyboard handlers to patch around an incorrectly composed component.
- Use `onPress` for React Aria press interactions. Do not assume mouse-only `onClick` behavior is equivalent.
- Style interaction state through React Aria data attributes or render props such as `data-hovered`, `data-pressed`, `data-selected`, and `data-focus-visible`.
- Provide a visible focus indicator, sufficient contrast and target size, useful error text, disabled and pending states, and reduced-motion behavior.
- Associate descriptions and validation errors with their controls. Do not convey state or errors through color alone.
- Test keyboard, pointer, touch-relevant, focus, dismissal, and screen-reader semantics for interactive patterns.
- Query UI tests by role, label, and visible text before using `data-testid`.
- Use `@react-aria/test-utils` for supported ARIA patterns. Use explicit keyboard events when verifying exact focus order or key behavior.
- Set the document `lang` and `dir` on the server. When locale is configurable, pass the same locale to a client-side `I18nProvider` to avoid server/client mismatch.

# Biome

- Biome is the only formatter and linter. Do not add ESLint or Prettier unless the project explicitly changes this decision.
- Keep `biome.json` as the formatting and linting source of truth. Do not hand-format code against it.
- Run write-mode formatting only on files in scope so unrelated files are not rewritten.
- Use `npm run check:local` for local analysis and `npm run check:ci` for the full non-writing CI gate.
- Next.js 16 does not run linting as part of `next build`; lint and build are separate required checks.
- Do not suppress a rule globally to resolve one local violation. Fix the code or use the narrowest justified suppression.

# Security and server boundaries

- Validate content type, shape, size, range, and identifiers at every external boundary.
- Expose only intentionally public values with `NEXT_PUBLIC_`. Treat all other environment variables as server-only.
- Avoid open redirects, unsafe URL construction, and trusting forwarded headers without a defined proxy policy.
- Use secure, HTTP-only, same-site cookies as appropriate for sensitive sessions.
- Return generic messages to clients and retain actionable diagnostics only in protected server logs.

# Testing strategy

Use the test tools already present in the repository. Do not introduce a new test framework for a single change.

For each behavior change, cover the lowest useful level:

- Pure domain rules: unit tests
- Drizzle queries, constraints, and transactions: PostgreSQL integration tests
- Server Actions and Route Handlers: boundary, authorization, and failure tests
- React Aria UI: semantic interaction tests using realistic user events
- Critical cross-page flows: browser-level tests

Tests should assert user-visible behavior, domain outcomes, database state, and accessibility semantics. Avoid snapshots as the only proof of interactive behavior.

Include failure cases, empty states, pending states, unauthorized access, invalid input, duplicate/concurrent writes, and relevant database constraint failures.

# Commands and validation

Use the scripts in `package.json` as the canonical interface. The following names are recommended; update this section if the project uses different names.

Before finishing a change:

1. Run Biome on the changed files.
2. Run TypeScript type checking.
3. Run the smallest relevant test set, then the broader suite when risk warrants it.
4. Run a production build for changes to routes, configuration, rendering, or the
   server/client boundary.
5. For schema changes, inspect the generated SQL and test the migration against an
   isolated PostgreSQL 18 database.
6. Report exactly which checks ran and any checks that remain unrun.

# Prohibited shortcuts

- Do not move database access into a Client Component.
- Do not use `"use client"` on an entire route merely to support one interaction.
- Do not trust TypeScript types as runtime validation.
- Do not bypass authorization because the UI hides an action.
- Do not use a read-then-write sequence as the sole concurrency control.
- Do not edit deployed migration history.
- Do not use production data for tests.
- Do not disable strict TypeScript or Biome rules to hide errors.
- Do not add ARIA roles to compensate for non-semantic or incorrectly composed UI.
- Do not report tests, builds, migrations, or accessibility checks that were not run.
