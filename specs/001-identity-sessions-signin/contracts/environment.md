# Contract — environment

**Plan**: [`../plan.md`](../plan.md)

Everything the operator supplies. `FR-058`, `OT-OPS-012` — self-hosted on a single box, with the mail
transport whatever the operator already runs.

Loaded through `@next/env`, which `drizzle.config.ts` already uses. **No `NEXT_PUBLIC_` value is
introduced by this feature**: nothing here reaches the browser (AGENTS.md).

| Variable | Required | Purpose | Failure when absent or bad |
| --- | --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL 18 connection | the app throws at startup, as it already does |
| `APP_URL` | yes | the installation's own public URL: the reset link is built from it, and it is the origin every mutating request is checked against | the app refuses to start (`FR-023`, `FR-033`, `FR-058`) |
| `ADMIN_EMAIL` | first run only | the seeded admin's address | seeding does not run; the app reports it |
| `ADMIN_PASSWORD` | first run only | the seeded admin's password | held to the password policy; a short or blocklisted value stops seeding, writes nothing, makes the app report **which rule** failed, and exits non-zero before a request is served (`FR-046`, `OT-SEC-019`) |
| `SUPPORT_EMAIL` | no | the contact the deactivated sign-in message names | the message names no address and reads "Contact your One Team administrator." (`FR-014`) |
| `SMTP_URL` | no | the reset-mail transport | reset requests answer identically and mail nothing; the failure is logged server-side only (`FR-033`) |
| `TZ` | no | the server timezone calendar dates are compared in | defaults to the host's; §5 has the operator set it once |
| `NODE_ENV` | set by the toolchain | decides the session cookie's `Secure` flag | research B-7 |

**Seeding stops the installation loudly rather than quietly creating a bad account.** Since no other
route creates the first account, a non-compliant `ADMIN_PASSWORD` ends the process with a non-zero
exit status before any request is served, rather than leaving a healthy-looking sign-in screen nobody
can pass (`FR-046`). It is first-run only, and fixed by editing the environment (§6).

**`APP_URL` is the one value two unrelated mechanisms share.** The reset mail is composed off the back
of a request that may never recur, so the link cannot be built from request headers; and an origin
check that compares a request against a value taken from that same request can never refuse anything.
One configured origin answers both (`FR-023`, `FR-033`). A value that is absent or unparseable stops
the app at startup, like `DATABASE_URL`.

`ADMIN_EMAIL` and `ADMIN_PASSWORD` are read **only** by `instrumentation.ts` at startup, and their
values never appear in a response or a log (`SC-010`).

Both are ignored entirely once any `user` row exists (`FR-047`), so leaving them in the environment
after the first start changes nothing.
