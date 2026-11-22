---
type: Reference
title: Plain HTTP and OpenAPI (toHttpApi)
description: toHttpApi publishes the calls of an Api you list as an Effect HttpApi group with an OpenAPI document; this page's reading keeps /api/v1 for the screens and uses it only for internal tools, while the brief's decision 31 recommends the screens call the model's Api.
tags: [alchemy-domain, surface]
---

# Plain HTTP and OpenAPI (toHttpApi)

An [Api](./api.md)'s typed client speaks Effect RPC. `toHttpApi` from `@alchemy.run/domain/Http` publishes the calls
you list as plain HTTP and JSON instead: an Effect `HttpApiGroup` with one endpoint per call, an `HttpApi` holding only
that group, the Layer of its handlers, and so an OpenAPI document. Every endpoint calls the Api in process with the
HTTP request's headers, so the middleware, `validate` and rejections run as for any client. Its bodies and answers are
the domain's own payloads, replies and states, which is why the docs keep it for internal tools: "For a public or
partner API, write your own `HttpApi` with its own response schemas" [https://alchemy.run/domain/http-api].

## When to reach for it

- A script, an ops dashboard or another internal service that is not Effect and wants JSON over HTTP, with an OpenAPI
  document to generate its client from.
- A browser page that only needs `EventSource` on a view's `watch`, without the Effect RPC client.
- Not for a surface people outside the team depend on, and not as a replacement for a contract you already own: a field
  a reply or a view later gains is published without anyone touching `expose`.

## How it is declared

```ts
// SKETCH: not compiled
import * as DomainHttp from "@alchemy.run/domain/Http"
import { AdminApi } from "@inventory/access-model/AdminApi"

export const PeopleOps = DomainHttp.toHttpApi(AdminApi, {
  expose: ["ChangeRole", "MemberSummary.get", "MemberSummary.watch", "AuditTrail"]
})
// PeopleOps.group, PeopleOps.api, PeopleOps.layer, PeopleOps.layerFor(MyHttpApi)
```

- `toHttpApi(api, { expose })` (`Http.ts` lines 408-476). `expose` defaults to `[]`: nothing is published unless
  listed. A command or a query is listed by name; a read as `<Name>.<operation>` (`MemberSummary.get`, `.snapshot`,
  `.list`, `.watch`, `.events`; a stream's `.peek`). A name the Api does not serve is a type error (`Exposable`,
  `CallName` in `ReadRpcs.ts` lines 285-289).
- It returns `group` (one endpoint per published call, the group named after the Api), `api` (an `HttpApi` with only
  that group, for `HttpApiBuilder.layer` and `OpenApi.fromApi`), `layer` (the group's handlers in `api`), and
  `layerFor(httpApi)` (the group's handlers in your own `HttpApi`, which may add a prefix, middleware or other groups).
  `layerFor` on an `HttpApi` that lacks the group dies with a `DefinitionError` (`MissingGroup`, lines 434-439).
- The Layers require what serving the Api requires (the hosted model and the server Layers of its middleware), minus
  `Scope` and the client half of any middleware: the HTTP caller sends its own headers (`Requirements`, lines 52-55).

The routes and bodies, one rule per kind of call (endpoints are named after the call's RPC tag):

| Call | Route | Input | Answer |
| --- | --- | --- | --- |
| command | `POST /<Command>` | JSON body, the command's RPC payload: `target`, optional `commandId`, `input` | the receipt `{ reply, stream, version }` |
| query | `QUERY /<Query>` | JSON body: `input`, optional `atLeast`, `after`, `take` | the result; a paged one `{ entries, cursor }` |
| view `get`, stream `peek` | `GET /<Name>/:key` | `?stream=&version=` (both or neither) waits for that write | the state, `null` for an empty key |
| view `snapshot` | `GET /<Name>/:key/snapshot` | `?stream=&version=` | `{ state, cursor }` |
| view or stream `list` | `GET /<Name>/:key/list` | `?order=&take=&after=` | a page |
| `watch` | `GET /<Name>/:key/watch` | none | Server-Sent Events |
| `events` | `GET /<Name>/:key/events` | `?after=` a cursor | Server-Sent Events |

- A query uses the `QUERY` method, the safe and idempotent method that carries a body, because a query's input can be
  any schema.
- Status codes: a typed failure answers with its JSON (`_tag` and data) at the status its schema's `httpApiStatus`
  annotation gives (on a [rejection](./rejection.md): `Domain.Rejection("NotOwner", {}, { httpApiStatus: 403 })`; on a
  middleware error, `HttpApiSchema.status(401)`), and 422 when it has none (`DEFAULT_STATUS`, line 92). Input the
  call's schema refuses is a 400 before it reaches the model. Any failure the call does not declare is a defect, a 500.
  Each declared failure appears in the OpenAPI document under its status.
- `cache-control: private, no-store` on every answer. A query or a once-only read whose declaration carries the
  `httpApiCacheControl` [annotation](./annotations.md) uses that value on its successful answers; failures, live reads
  and commands stay `private, no-store`.
- OpenAPI: each endpoint's `description` is the `description` annotation of the entry it serves (for a command without
  one, its Schema description); the group's and the document's `info.description` is the Api's. `OpenApi.fromApi(x.api)`
  gives the same document `HttpApiBuilder.layer(x.api, { openapiPath })` serves.
- Live reads: one SSE event per value the typed client would receive, its JSON in `data` (`{ state, cursor }` for
  `watch`; for `events` each entry, a `CaughtUp` frame, then live entries). The first value is read before the response
  starts, so a refusal by middleware or `validate` answers with its own status. After that, a failure ends the stream
  with an `effect/http-api/stream/failure` event whose `data` is the typed failure. `events?after=<cursor>` resumes.
- Every call runs through the Api's own handlers in process (its `clientInProcess`, without client middleware halves),
  so the input is decoded once, by the endpoint.

Limits the docs state: a read's `where` filter is not published (a filter does not fit in a URL); an endpoint's input
and answer are the call's own JSON. The docs' route table also names "an aggregate's `get`" (`http-api.mdx` line 75),
but an Api never serves an aggregate (`Servable` in `Api.ts` line 52), so that row cannot be reached through
`Domain.Api`.

Types and helpers (all in `packages/domain/src/Http.ts`):

| Name | What it is | Where (beta.87) |
| --- | --- | --- |
| `Publishable` | what `toHttpApi` reads from an Api class: `apiName`, `annotations`, `serves`, `group`, `clientInProcess` | lines 39-45 |
| `Requirements<A>` | the services the Layers need: the in-process client's, minus `Scope` and client middleware halves | lines 52-55 |
| `Exposable<A>` | a call name `expose` accepts | line 61 |
| `HttpApiOptions<A>` | the options: `expose` (default `[]`) | lines 64-72 |
| `HttpApiSurface<Name, R>` | what `toHttpApi` returns: `group`, `api`, `layer`, `layerFor` | lines 75-89 |
| `toHttpApi` | the function | lines 408-476 |

Checked in: `packages/domain/src/Http.ts` lines 39-89 (`Publishable`, `Requirements`, `Exposable`, options, surface),
91-104 (422 default, the `stream`/`version` query), 121-136 (failures of a call), 155-193 (how a request becomes a
call), 195-220 (SSE, first value before the response), 222-247 (`cache-control`), 270-338 (one endpoint per call),
340-476 (`toHttpApi`, `layerFor`, OpenAPI descriptions); `packages/domain/src/ReadRpcs.ts` lines 224-349 (`Operation`,
`operationsOf`, `exposedOf`, `outsideClient`); `packages/domain/src/Annotations.ts` lines 33-53, all at
`v2.0.0-beta.87`. In Effect 4.1.4, `effect/http-api`: `HttpApi.ts` lines 96-108 and 179-190 (`prefix` and
`middleware` apply to the groups present when they are called), lines 146-159 (`add`); `HttpApiGroup.ts` lines
338-349; `HttpApiBuilder.ts` lines 148-178 (`group` binds handlers to the group as the given `HttpApi` holds it).

### What main changes

- A command's body is `{ commandId?, input, consistency? }`, with no `target`; the key is a field of `input`
  (`Http.ts` line 161 and the docstring table at line 337 on main, through `sendPayload` in
  `packages/domain/src/internal.ts` lines 255-271). `consistency: "strong"` makes the POST answer only after the views
  have applied the command (commit `bc0024faf`, #3469).
- Every command's error union now holds `ConsistencyTimeout` (`Command.ts` line 328 on main). It has no
  `httpApiStatus`, so every command endpoint also declares it at 422.
- The receipt is `{ reply, stream, version, commits }` (see [Api](./api.md), "What main changes").
- A read's `?stream=&version=` is passed on as one receipt; the RPCs underneath accept several (`Query.AtLeastJson`,
  `ReadRpcs.ts` lines 99 and 129 on main), but the HTTP query string still carries one (`AtLeastQuery`, `Http.ts`
  lines 96-105 on main).
- Undeclared errors and middleware defects are logged and sent as one generic defect (`Api.ts` lines 510-578 on main).
  Commit not known.

## Rules, and the mistakes to avoid

- List every call on purpose. Do not expose a command because a script might need it one day.
- Do not mount it as the screens' API. The screens' contract is a promise the app owns; a reply that gains a field
  would silently change it.
- Put an `httpApiStatus` on every rejection a non-Effect client must tell apart; otherwise all of them are 422.
- `public` in `httpApiCacheControl` only when the answer is the same for every caller: a shared cache does not know a
  session was read.
- Live reads hold a scope (the in-process client) for as long as the SSE stream is open.
- The endpoints authenticate through the domain's own (RPC) middleware, from the forwarded headers. An
  `HttpApiMiddleware` such as the app's `Identity` is not on the group unless you add it, and even then the domain's
  commands read what the domain's middleware provides, not what `Identity` provides. See [sessions](./sessions.md).
- Effect's `HttpApi.prefix` and `HttpApi.middleware` change only the groups already added when they are called. A group
  added to an `HttpApi` after its `.prefix(...)` gets neither the prefix nor that middleware.

## In this app

The app already has its own Effect `HttpApi`: `Api` in `apps/inventory/src/api/v1/Api.ts` adds the groups `system`
(in that file), `identity`, `activity`, `people` (`packages/access/contract/src/Access.contract.ts`) and `imports`,
`items`, `assistant` (`packages/catalog/contract/src/Catalog.contract.ts`), then applies
`HttpApiMiddleware.ProblemDetails` and `SameOrigin` and prefixes everything with `/api/v1` (`Api.ts` lines 118-128;
`apiPrefix` in `apps/inventory/src/api/v1/Version.ts` line 7). It is served by `HttpApiBuilder.layer(Api, { openapiPath
})` in `makeRoutes` (`apps/inventory/src/server/App.ts` lines 72-84), beside Better Auth's `/api/auth/*`
(`SignInRoute`). Each group carries the `Identity` middleware (`packages/kernel/src/Identity.middleware.ts`), which
provides `CurrentActor` or fails with `NotSignedIn` (401); the errors carry their own statuses (`Forbidden` 403,
`ImportNotFound` 404, `AlreadyImported` 409, `LastAdmin` 409, `ModelCallsUsedUp` 429).

What happens to it when the domain comes in. The domain names below are the ones these pages and the trial model use
(`StageImport`, `SettleRow`, `LeaveRowOut`, `RecordSuggestion`, `ConfirmImport`, `TakeBackImport`, `EditItem`,
`ChangeRole`, `RemoveMember`, `TakeModelCall`); the final names are a design decision.

| Endpoint (under `/api/v1`) | What it becomes |
| --- | --- |
| `imports.commit` `POST /imports/:id/commit` | thin handler: sends `ConfirmImport`, reads the import's view at the receipt, maps it to `ImportView` |
| `imports.takeBack` `POST /imports/:id/take-back` | thin handler: sends `TakeBackImport` |
| `imports.decide` `PUT /imports/:id/decisions` | goes. Its payload is the difference between two pictures of the draft, which no handler can turn back into what the person did; the screen sends each act as a command (`DecideRow`, `UndoRowStep`) instead, through the Api's typed client or a thin handler, as the brief's decision 31 settles ([the brief](../../BRIEF.md), [the trial](../07-review-decisions-trial.md)) |
| `imports.reopen` `POST /imports/:id/reopen`, `imports.remove` `DELETE /imports/:id` | thin handlers over a command each |
| `imports.match` `POST /imports/:id/mapping` | thin handler over a command, once matching is modelled |
| `imports.open`, `imports.past`, `imports.changes`, `imports.get` | thin handlers over queries and the import's view |
| `items.list`, `items.page`, `items.facets` | thin handlers over queries (the full-text search stays in the store the query reads) |
| `items.edit` `PUT /items/:id` | thin handler: sends `EditItem` (rejected when the revision is not the current one) |
| `people.add`, `people.setRole`, `people.remove`, `people.list`, `activity.recent` | thin handlers over the access model's commands and queries |
| `imports.suggest` | stays a handler that takes the allowance (`TakeModelCall`) and asks the model, then sends `RecordSuggestion`: the model's answer is never a command of its own |
| `imports.beginUpload`, `putChunk`, `finishUpload`, `discardUpload` (the upload in pieces), `imports.table` | stay as they are: the file's bytes and staged rows stay in the staging tables, not in events; `finishUpload` may send `StageImport` once the file is staged |
| `assistant.view`, `system.status`, `system.checkAi`, `identity.session`, `identity.members`, `identity.me` | stay as they are |
| `/api/auth/*` (Better Auth), `/api/v1/openapi.json`, `/api/v1/docs` | stay as they are, outside the `HttpApi` groups or generated from it |

A thin handler keeps its route, its payload, its success schema and its error list, so the browser's client and the
OpenAPI document do not change. It builds `clientInProcess` per request (in `Effect.scoped`), calls with the request's
headers so the domain's session middleware sees the same cookie, and maps each domain rejection to the error the
endpoint already declares (for example a confirm of a closed import becomes `AlreadyImported`, 409). The hand-written
handler is the docs' advice for an API whose shape you own (http-api.mdx, "Shape a public API").

What `toHttpApi` would add beside it is an internal surface for operators. Mounted in its own `HttpApi`, for example
`OpsApi` with `.prefix("/api/ops")` and its own `HttpApiBuilder.layer(OpsApi, ...)` merged into `makeRoutes`, it stays
out of the screens' OpenAPI document and the browser's client. If it were added to the app's `Api` instead, it would
take the `/api/v1` prefix, `ProblemDetails` and `SameOrigin` only if added before `.middleware(...)` and
`.prefix(apiPrefix)` in that chain; it would not get `Identity` (a per-group middleware) unless given it; its handlers
would be `PeopleOps.layerFor(Api)` in the app's `Handlers`; and it would appear in `/api/v1/openapi.json` and in the
browser's typed client. Read from Effect's source, not run.

The route a confirm has, each way (beta.87 shapes):

```text
Hand-written (today, and after the change):
  POST /api/v1/imports/<importId>/commit
  body   ConfirmRequest (the revision the screen shows; the decisions not saved yet, with their madeOn)
  200    ImportView
  401 NotSignedIn · 403 Forbidden · 404 ImportNotFound · 409 AlreadyImported, DraftMoved, AcceptsTakenBack or
  DraftBusy · 400 RevisionAhead or a problem document

toHttpApi(MemberApi, { expose: ["ConfirmImport"] }):
  POST /ConfirmImport                   in toHttpApi's own api
  POST /api/ops/ConfirmImport           in an OpsApi prefixed /api/ops
  POST /api/v1/ConfirmImport            added to the app's Api before its .prefix(apiPrefix)
  body   { "target": "<importId>", "commandId": "c-1", "input": { "decisions": [] } }
  200    { "reply": { ... }, "stream": "ImportDraft/<importId>", "version": 9 }
  each rejection at its httpApiStatus, 422 when it has none · 400 bad body · 500 undeclared
```

On main the same POST takes `{ "commandId": "c-1", "input": { "importId": "<importId>", ... }, "consistency":
"strong" }` and answers with `commits` as well.

```ts
// SKETCH: not compiled. beta.87 call shape. The hand-written commit handler calling the domain in process.
import * as Effect from "effect/Effect"
import { MemberApi } from "@inventory/catalog-model/MemberApi"
import { AlreadyImported } from "@inventory/catalog-contract/ImportRejection"

const commit = Effect.fn("imports.commit")(function* ({ params, payload, request }) {
  const catalog = yield* MemberApi.clientInProcess
  const receipt = yield* catalog.ConfirmImport(params.id, { decisions: payload }, { headers: request.headers }).pipe(
    // The domain's rejection becomes the error this endpoint already declares (409).
    Effect.catchTag("NotOpen", () =>
      Effect.fail(AlreadyImported.make({ reason: "This import was already confirmed: nothing was written." }))
    )
  )
  const summary = yield* catalog.ImportSummary.get(params.id, {
    headers: request.headers,
    atLeast: { stream: receipt.stream, version: receipt.version }
  })
  return toImportView(summary)
}, Effect.scoped)
```

`toImportView` stands for the mapping from the domain's view to the contract's `ImportView`. `NotOpen` is the
rejection of the trial model; `AlreadyImported` carries one field, `reason`
(`packages/catalog/contract/src/Import/Import.rejection.ts` lines 31-36).

- **Used today:** no. The app's own `HttpApi` (`apps/inventory/src/api/v1/Api.ts`) is served at `/api/v1` with its
  OpenAPI document at `/api/v1/openapi.json`; its handlers call ports, not a domain Api.
- **Where it goes:** the hand-written handlers in `packages/catalog/model/src/Import/Imports.handler.ts`,
  `packages/catalog/model/src/Item/Items.handler.ts` and `packages/access/model/src/People/People.handler.ts` call
  `clientInProcess`; a `toHttpApi` group, if any, goes in its own `HttpApi` mounted from
  `apps/inventory/src/server/App.ts` for operators only.
- **What the person gets:** nothing they can see; the screens' contract does not change.

## How to check it

- `OpenApi.fromApi(PeopleOps.api)`: assert the path keys are exactly the exposed calls, and that a rejection with
  `httpApiStatus: 409` appears under 409 and one without a status under 422.
- A slow test against a local Worker: `POST /api/ops/ChangeRole` with a viewer's cookie answers 403 `Forbidden`; with
  an admin's, 200 and a receipt; the same `commandId` twice answers the same receipt.
- For the hand-written routes, the existing tests of `/api/v1/imports/:id/commit` and the others in the table must pass
  unchanged after their handlers move to `clientInProcess`: that is the proof the contract did not move.
- Not run in either trial on 2026-11-19: no Api was served, over HTTP or otherwise.

## What it needs

- Effect 4.1.4's `effect/http-api` (`HttpApiBuilder`, `OpenApi`) and, in a Worker, `HttpPlatform.layer` and
  `Etag.layer`, as the docs' example provides them.
- A host providing the model, and the server Layers of the Api's middleware.
- beta.87 for the published shape; main for target-less bodies, `consistency` and `commits`.

## Verdict

**Use:** keep `/api/v1` hand-written and move the handlers in the table onto `clientInProcess`; use `toHttpApi` only
for an operators' `HttpApi` of its own, with a short, explicit `expose` list.

The brief recommends otherwise in its decision 31: the screens call the model's Api, and `/api/v1` keeps what does
not move (uploads, the staged table, sign-in, the status); `toHttpApi` serves the operator's document over `AdminApi`.

## Where this was read

- https://alchemy.run/domain/http-api (the live site documents beta.87)
- `website/src/content/docs/domain/http-api.mdx` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: same path, changed
- `packages/domain/src/Http.ts` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: same path, changed
- `packages/domain/src/ReadRpcs.ts` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: same path, changed
- `packages/domain/src/internal.ts` on `main@dbfd0ddb` (lines 255-271, `sendPayload`)
- `packages/domain/skills/alchemy-domain/references/hosting.md` at `v2.0.0-beta.87`, "Public and partner APIs" and
  "Plain HTTP and OpenAPI"; on `main@dbfd0ddb`: same path, changed
- `packages/effect/src/http-api/{HttpApi,HttpApiGroup,HttpApiBuilder}.ts` at `effect@4.1.4`
- The app: `apps/inventory/src/api/v1/Api.ts`, `apps/inventory/src/api/v1/Version.ts`,
  `apps/inventory/src/server/App.ts`, `packages/catalog/contract/src/Catalog.contract.ts`,
  `packages/access/contract/src/Access.contract.ts`, `packages/kernel/src/AccessError.errors.ts`
