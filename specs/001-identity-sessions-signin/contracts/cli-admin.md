# Contract — operator commands

**Plan**: [`../plan.md`](../plan.md)

`FR-051`…`FR-057`, §6 *Break-glass and user administration*, `OT-SEC-019`, `OT-AUTHZ-011`,
`OT-INV-013`.

The total-lockout recovery, and the **only** route to a role change in v1. Run over SSH on the box.
Both commands validate every argument before touching the database (Principle II) and both write
through the same server functions the web surface uses.

---

## `npm run admin:grant -- --email=… --first-name=… --last-name=…`

Creates or promotes an admin.

| Effect | |
| --- | --- |
| Address has no account | creates an admin with the password typed at the prompt (`FR-051`) |
| Address has a member account | promotes to admin, replaces the password, clears `deactivated_at`, clears `must_change_password` (`FR-051`, `FR-050`) |
| Address has a deactivated account | reopens it as an admin (spec scenario 8) |
| Address is already an active admin | password replaced, `must_change_password` cleared; role and `deactivated_at` are already right and are left alone. **Not an error** (`FR-077`) |

**The password is read from the terminal and is never a command-line argument** (`FR-052`,
`OT-SEC-019`). A value passed as a flag is not accepted as the password — the command runs on the
box, where an argument would land in shell history and in the process table. `--password=…` is an
unrecognised flag, and an unrecognised flag is a usage error rather than something silently ignored:
`parseArgs` runs strict, the command writes nothing and exits `2` (`FR-075`).

The prompt does not echo. **Where the terminal cannot suppress echo the command refuses to prompt**
and exits non-zero, rather than reading a password that would be displayed and left on screen
(`FR-076`).

**The policy is enforced here exactly as everywhere else** (`FR-053`). A password under twelve
characters or on the blocklist is refused, the command names the one rule that failed, and **nothing
is written** — no partial user row, no credential.

The address is validated as an address and folded to lower case before any lookup, so
`Ada@Example.com` and `ada@example.com` are the same account (`FR-006`).

---

## `npm run admin:deactivate -- --email=…`

Closes an account.

| Effect | |
| --- | --- |
| Sets `deactivated_at` | the account is closed; its rows are retained, so a later reactivation restores what it had (`FR-057`) |
| Deletes every `session` row for that user | reads and writes stop on that user's next request, on every device (`FR-054`, `SC-013`) |
| Never deletes the `user` row | `FR-007`, `OT-INV-017` |
| Address has no account | refused; nothing written; the command names the address it could not find (`FR-078`) |

**Refused if it would leave the installation with zero active admins** (`FR-056`). The count is taken
under a row lock in the same transaction as the change, through the shared
`withLastAdminGuard` in [`server-contracts.md`](./server-contracts.md), so two concurrent attempts to
close the last admin cannot both succeed (`SC-012`).

---

## Role changes are CLI-only

`admin:grant` is the whole role-change surface in v1. **No screen this feature delivers sets a role,
and none exists elsewhere in the product** (`FR-055`, `OT-AUTHZ-011`). R3's Accounts screen delivers
deactivation and invitation because those are needed routinely; role changes stay here.

---

## Exit statuses and output

Both commands, so an operator can branch on the status without parsing the text (`FR-074`).

| Status | Means | Output |
| --- | --- | --- |
| `0` | the change was made | one line on **stdout** naming what changed |
| `1` | refused, and the operator can act on it — a non-compliant password, an unknown address, the last active admin | one line on **stderr** naming the one rule or condition that refused it |
| `2` | usage error — an unrecognised flag, a missing required flag, a malformed address | one line on **stderr**, and the usage line |

Nothing is written to the database on `1` or `2`.

---

## Execution

Both commands run under the Node.js runtime with the app's own environment loaded through
`@next/env`, the same way `drizzle.config.ts` already does — no separate configuration path, and no
new dependency for argument parsing or prompting (Principle IV): `node:util`'s `parseArgs` reads the
flags and `node:readline`'s hidden-input mode reads the password.

Neither command starts the app, and neither runs the first-run seed — seeding belongs to
`instrumentation.ts` and is skipped whenever any `user` row exists (`FR-047`).
