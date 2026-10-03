# Contract: Magic-link email (RM-3)

Copy and format are fixed by [design.md](../design.md) (plain text only, open question 11). Sending rules: research R2, R3.

## Message

| Field | Value |
|-------|-------|
| From | `Tracklite <{EMAIL_FROM}>` |
| To | the member's stored email |
| Subject | `Sign in to Tracklite` |
| Body (text/plain, no HTML part) | see below |

```text
Use this link to sign in to Tracklite:

{APP_URL}/sign-in?token={token}

The link expires in 15 minutes and works once.

If you didn't ask to sign in, you can ignore this email.
```

The token is in the query string, never a path segment (FR-010, SEC-007). The link is built from the `APP_URL` setting, never from the request. The destination page is stored with the link (data-model.md `magic_links.destination`), not in the URL.

## Transport: `sendEmail({ to, subject, text })` in `src/server/email.ts`

| Environment | Call | Failure |
|-------------|------|---------|
| production | `POST https://api.resend.com/emails`, `Authorization: Bearer {RESEND_API_KEY}`, JSON `{ "from", "to": [to], "subject", "text" }` | non-2xx, network error or 10 s timeout → throws (a timed-out send counts as failed even if the provider still delivers it) |
| local development (owner answer Q1) | `POST http://{MAILPIT_HOST}:{MAILPIT_PORT}/api/v1/send` (Mailpit's web/API port, default 8025), JSON `{ "From": { "Email": EMAIL_FROM, "Name": "Tracklite" }, "To": [{ "Email": to }], "Subject", "Text" }`, no credentials | same (Mailpit not running is a network error) |

Never sends to the real provider outside production (FR-031). A throw becomes the `503` answer of `POST /api/sign-in-links`, and that request's link row is deleted (FR-009). If a timed-out email is delivered anyway, its link no longer exists, so its Sign in button shows "This link has expired" with "Request a new link" (spec edge case, accepted).
