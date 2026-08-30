# Contract — environment

**Plan**: [`../plan.md`](../plan.md)

Everything the operator supplies. `FR-058`, `OT-OPS-012` — self-hosted on a single box, with the mail
transport whatever the operator already runs.

Loaded through `@next/env`, which `drizzle.config.ts` already uses. **No `NEXT_PUBLIC_` value is
introduced by this feature**: nothing here reaches the browser (AGENTS.md).

| Variable | Required | Purpose | Failure when absent or bad |
| --- | --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL 18 connection | the app throws at startup, as it already does |
| `ADMIN_EMAIL` | first run only | the seeded admin's address | seeding does not run; the app reports it |
| `ADMIN_PASSWORD` | first run only | the seeded admin's password | held to the password policy; a short or blocklisted value stops seeding, writes nothing, and the app reports **which rule** failed (`FR-046`, `OT-SEC-019`) |
| `SUPPORT_EMAIL` | no | the contact the deactivated sign-in message names | the message names no address and reads "Contact your One Team administrator." (`FR-014`) |
| `SMTP_URL` | no | the reset-mail transport | reset requests answer identically and mail nothing; the failure is logged server-side only (`FR-033`) |
| `TZ` | no | the server timezone calendar dates are compared in | defaults to the host's; §5 has the operator set it once |
| `NODE_ENV` | set by the toolchain | decides the session cookie's `Secure` flag | research B-7 |

**Seeding stops the installation loudly rather than quietly creating a bad account.** Since no other
route creates the first account, an installation with a non-compliant `ADMIN_PASSWORD` stays
uninstalled until the operator fixes the value — first-run only, and fixed by editing the
environment (§6).

`ADMIN_EMAIL` and `ADMIN_PASSWORD` are read **only** by `instrumentation.ts` at startup, and their
values never appear in a response or a log (`SC-010`).

Both are ignored entirely once any `user` row exists (`FR-047`), so leaving them in the environment
after the first start changes nothing.
