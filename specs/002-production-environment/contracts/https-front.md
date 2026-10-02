# Contract: HTTPS front server (RM-2)

Caddy 2 on the VPS, configured by the committed `ops/Caddyfile` (installed as `/etc/caddy/Caddyfile`). App instances listen on `127.0.0.1:3001` and `127.0.0.1:3002` only and are unreachable from outside except through Caddy. App responses (pages, `/api/…`, `/health`) are unchanged from RM-1 ([../../001-project-foundation/contracts/http-api.md](../../001-project-foundation/contracts/http-api.md)).

| Request | Response |
|---------|----------|
| `http://<domain><path>?<query>` (any method) | `308` permanent redirect to `https://<domain><path>?<query>`, path and query kept (FR-013, SEC-005.1) |
| `https://<domain>/_next/static/<file>?dpl=<release id>`, file present in `/srv/tracklite/releases/<release id>/.next/static/` | that file, `Cache-Control: public, max-age=31536000, immutable`. Present for the live release, `previous`, and the `.next/static/` folders kept for the 5 most recent earlier live releases, so every page keeps loading its own release's files across up to 5 later deploys or rollbacks (FR-005; research R3). Those kept folders are served only here; their releases are never started or rolled back to |
| any other `https://<domain>/…` | proxied to the live release: `127.0.0.1:3001` if `/srv/tracklite/current/port-3001` exists, otherwise `127.0.0.1:3002`; one lookup per request, so each request goes wholly to one release (FR-005) |
| every HTTPS response | `Strict-Transport-Security: max-age=31536000` (one year, this host only, no `includeSubDomains`, no `preload`; FR-014) |
| before the first deploy | `502` from Caddy (nothing listens yet) |

- **Switching**: Caddy is never reloaded or reconfigured by a deploy or rollback. The atomic rename of `/srv/tracklite/current` moves traffic from the next request on; requests already proxied to the old release finish there: its instance is stopped 2 s after the switch with SIGTERM, on which `next start` stops accepting and finishes requests in progress, and is killed 30 s later, so a request in progress at the switch completes normally if it finishes within 30 s of the switch (FR-005; longer ones may be cut). Being killed at that limit is a post-switch warning, not a failure (FR-007).
- **Certificate**: Let's Encrypt, obtained and renewed by Caddy with no manual step (FR-012, FR-015). A failed renewal is logged to the journal; the current certificate keeps working until it expires.
- **Logging**: no access log; Caddy's errors go to the journal (FR-025). A log filter in `ops/Caddyfile` applies to every error line: it keeps only the method, the path without the query string, the status and the error, and deletes every other request field (the query string from `uri`, `headers`, `remote_ip`, `remote_port`, `client_ip`, `proto`, `host`, `tls` and any other `request>…` field), so a token sent in a query string or header never reaches the journal (FR-026, SEC-007; research R9).
- **Path safety**: the `dpl` value and the path are joined under `/srv/tracklite/releases/` with path cleaning and only `.next/static/` files are served; release directories hold no secrets.
- The domain is not submitted to any browser preload list. DNS points straight at the VPS (Cloudflare proxy off, if Cloudflare is used), so Caddy terminates HTTPS.
- Ports open to the internet: 80 and 443 (Caddy), 22 (SSH). PostgreSQL listens on `localhost` and its Unix socket only.
