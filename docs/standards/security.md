---
type: Standard
title: Security and tenancy
description: Production headers on every response, secrets kept on the server, every write checked for its role and origin, and one organization never sees another's rows.
tags: [security, cloudflare]
status: draft
---

## Headers

- **Production headers on every response** (`public/_headers` for the app, `src/server/security.ts` for the API): a
  content security policy with no inline script and no outside origin, HSTS in production, `X-Content-Type-Options:
  nosniff`, `X-Frame-Options: DENY` with `frame-ancestors 'none'`, a strict `Referrer-Policy`, same-origin
  `Cross-Origin-Opener-Policy` and `Cross-Origin-Resource-Policy`, and `Cross-Origin-Embedder-Policy: require-corp`.
  Check: `curl -sI` on `/` and on `/api/...` under `bun run preview` shows each one.
- **No cross-origin access**: the API sends no `Access-Control-Allow-Origin`, so another site's script cannot read
  it. Check: a request with `Origin: https://example.org` gets no such header back.
- **No redirect to anywhere but our own pages**: a return address is checked against our own origin, and plain HTTP
  goes to HTTPS on the deployed copy. Check: a foreign return address is refused.
- **Subresource integrity is considered**: every script is served from our own origin under `script-src 'self'`, so
  there is no third-party script to pin; one added later carries `integrity`. Check: no outside script in the build.
- **API responses are `Cache-Control: no-store`.** Check: the header on any `/api/...` answer.
- **The deployed copy is scanned once** with the Mozilla Observatory, and its grade is reported. Without a deployed
  copy the grade is "not checked", never guessed. Check: the write-up names the grade or says "not checked".

## Secrets and writes

- **Secrets stay on the server**, are read as redacted settings ([settings](config-and-logs.md)), are never logged,
  and the pack refuses a tree that holds one. Check: `bun run check` runs the pack's key scan over every file git
  would commit (`test/scripts/KeyScan.test.ts`), and `bun run pack` runs it over the history too.
- **Cookies are `HttpOnly`, `Secure` in production and `SameSite=Lax` at least**, so no script reads a session.
  Check: the `Set-Cookie` header under `bun run preview`.
- **Every write checks the role on the server and that the request came from our own pages** (`requireRole`, and the
  browser's `Sec-Fetch-Site` or `Origin`). Check: a write as a viewer is refused, and so is one sent from another
  origin.
- **Model output is decoded before use**, and model-written HTML is shown sandboxed (pattern 6 in
  [patterns](../patterns.md)). Check: no model answer reaches the screen or the database without its Schema.

## Tenancy

- **The actor and organization come only from the session** (`CurrentActor`), never from a payload, header or URL.
  The header identity in `src/server/Identity.ts` is for tests only, and `bun run build` fails if it reaches the
  Worker. People are told apart by
  id, never by name. Check: no handler reads an organization or member id from its payload.
- **Tenancy is enforced in the app and in SQL**: every tenant table has `organizationId`, its indexes start with it,
  and a child row references its parent by `(organizationId, id)`. Every tenant-scoped endpoint has the identity
  middleware. Check: read the migrations; each foreign key to a tenant table includes `organizationId`.
- **A test proves the second organization sees none of the first's rows.** Check: the test exists and passes.
- **Switching organization drops every cached query, and signing out reloads the page.** An agent acts for a person
  and never above their role. Check: switch organization; the network panel shows every list fetched again.
