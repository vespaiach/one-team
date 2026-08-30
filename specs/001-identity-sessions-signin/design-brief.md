# Design brief — R1: identity, sessions and sign-in

**For**: Claude Design (claude.ai/design)
**Feature**: [`spec.md`](./spec.md) · roadmap entry **R1**
**Source of truth**: [`docs/product/specifications.md`](../../docs/product/specifications.md) §3.1, §3 screen 13, §4, §6, §7

Three public screens plus one banner. They are the only surfaces this feature renders, and
they are the first surfaces the product renders at all — so the visual decisions made here
become the baseline every later screen inherits. There is no design system yet:
`src/app/globals.css` is still the untouched Next.js starter.

Deliver **visual reference**, not shipping code. Behaviour is rebuilt on React Aria
Components in the repo (`OT-UX-018`); Tailwind supplies the visual layer only.

---

## Non-negotiables

The specification fixes these. A design that changes one is wrong, not opinionated.

| | |
| --- | --- |
| **Frame** | All three screens render **outside the application shell** — no sidebar, no header, no nav. A full-screen card on the page background. This never changes; the shell arriving in R2 does not later wrap them. (`OT-UX-001`) |
| **Field inventory** | Exactly what each screen lists below, and "nothing else" — the specification's own phrase. |
| **No sign-up link.** | "There is nothing for a stranger to do here." No social sign-in, no SSO, no registration route. |
| **No "remember me"** | The cookie is always 30 days sliding. There is no control for it. |
| **Validation** | Per-field, **on blur**. Never a wall of errors on submit. The submit control **stays enabled** and reports what is missing inline rather than going dead. (`OT-UX-011`) |
| **Viewport** | Desktop only. No breakpoints, no mobile layout. |
| **Tone** | "One quiet line per surface. No illustrations, no empty-state marketing." (§4) |

---

## Colour — and the gap in it

The product defines **seven** colours (§7), lowercase six-digit hex, no free entry:

| | | | |
| --- | --- | --- | --- |
| accent | `#5b5bd6` | grey | `#8b909a` |
| blue | `#2f7fc4` | amber | `#d4a017` |
| green | `#3a9d5d` | red | `#c8453c` |
| violet | `#9b5de5` | | |

**Read this carefully before designing:** that palette is for *content* — projects, board
columns and labels. It is not a UI palette. On these three screens only **accent**
(the default wherever a colour is required) and **red** (error) have an obvious role.

There is **no defined neutral scale** — no page background, surface, border, muted-text or
disabled token anywhere in the product specification. Proposing one is part of this work,
and it is the single most load-bearing thing you will decide, because all eleven later
slices inherit it.

---

## The surfaces

### 1. Sign in — `/signin`

Full-screen card on the page background.

**Form** — email field, password field, a "Sign in" control, a "Forgot password?" link. Nothing else.

Four states, each replacing or annotating the form:

| State | Content |
| --- | --- |
| **Form** | The default. |
| **Rejected** | One message covering both a wrong password and an unknown email. Never reveals whether an account exists — so the treatment must be identical in both cases, down to spacing and position. |
| **Deactivated** | Its own distinct message: the credentials were right, the account is closed. Names an operator-configured contact address when one is set; names none when it isn't. Design both. |
| **Throttled** | Sign-in is refused while the window holds too many failures, for up to fifteen minutes, and states the **remaining time**. The value is whole minutes **rounded up**, computed server-side on each refused attempt, not a ticking client countdown (research A-10). |

Also needed: the **in-flight state** of the Sign in control while the request is out (§4, *Slow write*).

### 2. Forgot password — `/reset`

Same full-screen card treatment. An email field and a "Send reset link" control, nothing else.

One outcome state — the same confirmation whether or not the address exists. There is no
error state and no success/failure divergence to design, by design.

### 3. Change password — `/reset?token=…` (screen 13)

Full page outside the shell, "exactly like Sign in itself". Reachable only through an
emailed link — never entered directly.

**Form** — two required fields: **New password** and **Confirm password**.

| State | Content |
| --- | --- |
| **Mismatch** | Inline error on *Confirm password*. |
| **Policy failure** | The field reports **which rule failed** — minimum twelve characters, maximum 128, or "on the common-password blocklist". No composition rules, so never a checklist of symbol/number requirements. |
| **Expired token** | Its own explanatory state. |
| **Used token** | Its own explanatory state. |
| **Unknown token** | Its own explanatory state. |

The three token states must be **distinguishable from one another**. Each needs a route
forward — realistically back to `/reset` to request a fresh link.

On success the screen redirects to `/signin` carrying a success message, so `/signin`
needs a **success-banner variant** of its form state.

### 4. Must-change-password banner

A component only — R2 builds the slot that hosts it, so it has nowhere to render yet.

Advisory. **Blocks nothing** — every control on the screen still works. It appears on
every authenticated screen until the seeded admin changes their password, which may be
never, so it must be liveable-with rather than alarming. Not an error, not a modal,
not dismissible.

---

## Copy

**Fixed — use verbatim, do not rewrite:**

- `That email and password don't match.` — the rejected state
- `Contact your One Team administrator.` — deactivated, where no contact address is configured
- `If that address has an account, a link is on the way` — the reset request answer

**Still to be written** (propose text; it is not yet specified anywhere):

- The deactivated message where a contact address *is* configured
- The throttle message carrying remaining time
- Expired / used / unknown token — three distinct explanations
- The success message `/signin` shows after a completed reset
- The must-change-password banner

---

## Decisions to settle

These six are undecided in the product specification and propagate to every later slice.
Return an explicit value for each.

1. **Card max-width** and its vertical placement on the page
2. **Type scale** — how many steps, and their values
3. **Spacing unit** and the rhythm built on it
4. **Field height**, and the input treatment (border, radius, fill)
5. **Focus ring** — this one is load-bearing. React Aria drives focus via
   `data-focus-visible`, and every control in the product needs a visible indicator.
6. **Dark mode: in or out?** Nothing in the specification mentions it. `globals.css`
   carries a `prefers-color-scheme: dark` block only because the Next.js starter shipped
   one. If it's out, that block gets deleted. If it's in, every token needs a second value
   and the cost lands on all eleven slices.

Plus the neutral scale described under *Colour* above.

---

## What to send back

- The three screens in all their states, and the banner
- The neutral scale, as named tokens
- The six decisions above, as values

Tokens land in `@theme inline` inside `src/app/globals.css` (Tailwind v4 is configured in
CSS — there is no `tailwind.config.js` and none should be created). Components are rebuilt
on React Aria `TextField`, `Button`, and `Form`; the design does not need to model
keyboard, focus, or ARIA behaviour, only how the states look.
