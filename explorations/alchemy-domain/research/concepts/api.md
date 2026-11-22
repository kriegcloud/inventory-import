---
type: Reference
title: Api
description: The published slice of a domain model for one kind of client, served from a Worker and called through typed clients; inventory-import would use one Api for the screens and keep its hand-written HttpApi in front of it.
tags: [alchemy-domain, surface]
---

# Api

An Api is the list of what one kind of client may reach in a [model](./model.md): the [commands](./command.md) it may
send, the [views](./view.md) and [streams](./stream.md) it may read one key at a time, and the [queries](./query.md) it
may ask across keys. It has no handlers of its own: aggregates decide commands and views answer reads, and the Api only
chooses which of them leave the model. The class is itself an Effect: `yield* MyApi` gives a Worker its `fetch`, and the
same class builds typed clients over HTTP, WebSockets or in process. The docs call it "the interface a model publishes"
[https://alchemy.run/domain/api]. Everything else built on top of a domain (the plain [HTTP API](./http-api.md), the
[CLI](./cli.md), the [agent tools](./ai-and-mcp.md)) is built from an Api.

## When to reach for it

- Whenever a model has to be reached from outside its own process: the browser, an operator's terminal, an agent, a
  webhook, a scheduled job.
- When two kinds of client need different surfaces over one model (a member's screens and an admin console). Each gets
  its own Api; an entry may sit on both.
- When code in the same Worker (a hand-written `HttpApi` handler, a cron job) must run a command through the same
  middleware and checks every other client gets: `clientInProcess`.
- Not for an aggregate's state: an Api never serves an aggregate. A view projects what clients may see of it
  (`Servable` is commands, views, streams and queries only, `Api.ts` line 52).

## How it is declared

```ts
// SKETCH: not compiled
import * as Domain from "@alchemy.run/domain"
import { Catalog } from "./Catalog.model.ts"

export class MemberApi extends Domain.Api(
  "MemberApi",
  {
    model: Catalog,
    commands: ["StageImport", "SettleRow", "LeaveRowOut", "ConfirmImport", "TakeBackImport"],
    views: ["ImportSummary"],
    streams: [],
    queries: ["ItemPage", "ItemFacets"]
  },
  { description: "What a member of an organization reaches from the screens." }
) {}
```

- `Domain.Api(name, options, annotations?)` (`Api.ts` lines 1222-1264). `options.model` is required; `commands`,
  `views`, `streams` and `queries` are optional arrays of names. A kind left out is served whole (every command, view,
  stream or query of the model); `[]` serves none of that kind. The third argument is
  [annotations](./annotations.md), default `{}`; its `description` heads the CLI's root help and is the OpenAPI
  document's `info.description`.
- Naming something the model does not hold is a type error. With a model typed as `Model.Any` the name is collected
  and serving the Api dies with a `DefinitionError` (`NotInModel`); a listed command no aggregate handles dies with
  `UnroutedCommand` (`Api.ts` lines 562-590).
- What the class carries: `kind: "Api"`, `apiName`, `model`, `serves`, `commands` (the command classes, in order),
  `rejections` (one Schema for every rejection its commands declare, `Schema.Never` when none), `group` (the Effect RPC
  group), `annotations`.

What `yield* MyApi` gives: `{ fetch }` (`ApiServer`), an `HttpEffect` to return as the Worker's own fetch. It requires
`Model.Internals` (the hosted model) and the server Layer of every middleware the served entries declare. It builds one
RPC server per request, because Workers forbid sharing I/O across requests. A request with `upgrade: websocket` is a
live read and is handed to the store that owns the key; on a platform whose store cannot accept a socket it answers
501 "This platform streams live reads as responses" (`Api.ts` line 841).

The client forms, all typed from the entries (`ApiClient`, `Api.ts` lines 393-446):

| Member | What it is | Needs |
| --- | --- | --- |
| `client` | an Effect that builds the typed client | `Scope`, `RpcClient.Protocol`, client halves of middleware |
| `Client` | the client as a `Context.Service` | |
| `layerClient` | `Client` for the life of the Layer | `RpcClient.Protocol`, client halves |
| `clientHttp(url)` / `layerClientHttp(url)` | the above over `Domain.protocolHttp(url)` | `HttpClient`, client halves (`Scope` for `clientHttp`) |
| `clientWebSocket(url)` / `layerClientWebSocket(url)` | over `Domain.protocolWebSocket(url)` | `HttpClient`, `Socket.WebSocketConstructor`, client halves (`Scope` for `clientWebSocket`) |
| `clientInProcess` / `layerClientInProcess` | over `Domain.protocolInProcess(api)` | `Model.Internals`, server and client middleware Layers (`Scope` for `clientInProcess`) |

- `Domain.protocolHttp(url)`: Effect RPC over HTTP with NDJSON serialization. Live reads are streamed responses the
  platform feeds by polling the key.
- `Domain.protocolWebSocket(url)`: commands and one-off reads over HTTP; each `watch` or `events` opens its own
  WebSocket to the object that owns the key, which pushes each commit. A socket closed without an `Exit` reconnects and
  resumes from the last cursor it delivered, up to 8 failed attempts in a row (`RECONNECTS`), waiting
  `min(5000, 100 * 2^failures)` milliseconds between attempts.
- `Domain.protocolInProcess(api)`: serves the Api in the caller's process; messages are encoded as on the wire and
  never leave memory. In a Worker, build it per request.

The shape of each entry on the client:

- A command is a method. At beta.87: `client.ConfirmImport(target, input?, { headers?, commandId? })`. The input may be
  left out when it has no required field. It answers with the receipt `{ reply, stream, version }`: the RPC's success
  schema has exactly those three fields (`Command.ts` lines 249-259), and the server's handler copies them from the
  aggregate's receipt (`Api.ts` lines 591-600). The aggregate's own receipt also holds `events` (`Aggregate.ts` line
  75), which the Api drops: a client never receives the events of its command.
- A query is a method `(input, { headers?, atLeast?, after?, take? })`. A paged query also has `.pages(input)` and
  `.entries(input)`, Streams that follow each cursor to the last page.
- A view is a namespace: `get`, `watch`, `events`, `list`, `snapshot`. A stream is a namespace: `peek`, `watch`,
  `events`, `list`. `get`, `list` (view), `snapshot` and `peek` take `atLeast: { stream, version }` from a receipt and
  fail with `ConsistencyTimeout` if the read has not caught up. A stream's `list` takes no `atLeast` at beta.87. See
  [reads and consistency](./reads-and-consistency.md).
- Each call's error type is the entry's declared rejections, its middleware's errors, and `RpcClientError` for
  transport. Only declared errors leave the server: anything else becomes a defect before it is sent.

How middleware and headers travel:

- Every call takes `headers` in its options; they reach the server half of the entry's middleware (for example a
  session middleware reading a cookie or a bearer token). See [sessions](./sessions.md).
- A middleware whose client half is required (`requiredForClient`) shows up in the client's requirements, so the code
  that builds the client must provide it (for example a Layer that adds a token to every call).
- Over WebSockets, headers set by client middleware apply to calls only. A live read authenticates with what its
  upgrade request carries: in a browser, the cookies of the Api's origin. The server runs the read's middleware in the
  Worker against the upgrade request's headers, then hands the context it provided to the object that owns the key.
- In process, the middleware services in scope when the protocol is built run for every request. Code that has already
  authenticated its caller provides a middleware Layer that trusts that caller, to that client only.
- `toHttpApi` and `toToolkit` call the Api in process without any middleware's client half (`outsideClient`,
  `ReadRpcs.ts` lines 330-349), so a credential the server holds for its own calls never replaces the caller's headers.
  `toCli` uses the plain `client`, so a client half does run there.

The wire shape of a command at beta.87 (from the command's RPC definition):

```json
{ "target": "imp_7f3", "commandId": "confirm-imp_7f3-1", "input": { "decisions": [] } }
{ "reply": { "created": 141 }, "stream": "ImportDraft/imp_7f3", "version": 9 }
```

Types and helpers (all in `packages/domain/src/Api.ts`; at beta.87 most are also re-exported under the `Domain.Api`
namespace, `index.ts` lines 220-265):

| Name | What it is | Where (beta.87) |
| --- | --- | --- |
| `Servable` | what an Api may serve: `Command.Any \| View.Any \| Stream.Any \| Query.Any` | line 52 |
| `CommandName<M>`, `ViewName<M>`, `StreamName<M>`, `QueryName<M>` | the names of a model's commands (their tags), views, streams and queries, the type of the arrays in `Options` | lines 55-61 |
| `Options` | what `Domain.Api` takes | lines 68-85 |
| `ServedBy<M, C, V, S, Q>` | the entries an Api over `M` serves, from the names it lists | lines 88-98 |
| `ReadError<D>` | everything a read can fail with: declared rejections, middleware errors, `RpcClientError` | lines 112-115 |
| `ViewClient`, `StreamClient` | the namespaces of a view and a stream on the client | lines 122-238 |
| `Recorded<E, Id>` | a committed event with its envelope, as a client receives it | lines 241-244 |
| `CommandOptions`, `CommandClient` | a command's options and its method | lines 247-283 |
| `QueryError<Q>` | everything a query can fail with (with `ConsistencyTimeout` when it has `waitsFor`) | lines 289-292 |
| `QueryOptions` | `headers`, `atLeast`, `after`, `take` | lines 295-305 |
| `EntryOf<Q>` | one entry of a paged query's pages | lines 308-309 |
| `QueryClient<Q>` | a query's method, with `pages` and `entries` when the query is paged | lines 316-320 |
| `PagedQueryClient<Q>` | the `pages` and `entries` Streams of a paged query | lines 323-334 |
| `ApiClient<E>`, `ClientKey`, `ApiServer`, `ApiClass` | the client, its service key, what `yield*` gives, the class `make` returns | lines 341-446 |
| `make`, `protocolHttp`, `protocolInProcess`, `protocolWebSocket` | `Domain.Api` and the three protocols | lines 1222, 1272, 1284, 1331 |
| `Any` | any Api class | lines 1451-1465 |
| `CommandsOf<A>`, `QueriesOf<A>`, `RejectionsOf<A>`, `ClientOf<A>` | an Api's command classes, query classes, rejection classes, client type | lines 1468-1477 |
| `ServableBy` (in `Model.ts`) | what a model's members serve: `aggregates`, `commands`, `views`, `streams`, `queries` (and on main `decisions`); the type `ServedBy` and the name types read from | `Model.ts` lines 173-184; main lines 327-343 |

Checked in: `packages/domain/src/Api.ts` lines 52 (`Servable`), 68-85 (`Options`), 117-119 (`CallOptions`), 121-238
(view and stream clients), 246-283 (`CommandOptions`, `CommandClient`), 294-334 (query client), 356-446 (`ApiServer`,
`ApiClass`), 448-470 (middleware requirements), 482-501 (only declared errors are public), 503-508 (`CommandPayload`),
570-600 (the command handler builds the receipt), 777-905 (live reads), 912-978 (`nest`, the client's shape), 984-1051
(in-process protocol), 1057-1122 (`build`, the client members), 1222-1264 (`make`), 1272-1292 (`protocolHttp`,
`protocolInProcess`), 1305-1428 (`protocolWebSocket`), 1451-1477 (`Domain.Api.Any` and its helper types);
`packages/domain/src/Command.ts` lines 54-59 and 249-259 (the receipt's fields); `packages/domain/src/Aggregate.ts`
lines 69-78; `packages/domain/src/Model.ts` lines 173-184; `packages/domain/src/index.ts` lines 220-273, all at
`v2.0.0-beta.87`.

### What main changes

- Commands have no `target`. The method is `client.ConfirmImport(input?, { headers?, commandId?, consistency? })`; the
  key travels inside the input (`Api.ts` lines 284-312 on main; `Command.ts` lines 316-320). The wire payload is
  `{ commandId?, input, consistency? }` (`Api.ts` lines 580-584). Commit not known.
- The receipt gains `commits`, every stream the command committed to (more than one for a [decision](./decision.md)):
  `{ reply, stream, version, commits }` (`Api.ts` lines 739-744; `Command.ts` lines 81-93 and 321-326). Still no
  `events`. A command's error union always holds `View.ConsistencyTimeout` (`Command.ts` line 328). Commit `dbda8cc16`
  (#3420, Decision).
- `consistency: "strong"` on a call answers only after every view the events reach has applied them (the handler waits
  on `internals.applied(receipt)`, `Api.ts` lines 733-738); a view slower than 10 seconds fails the call with
  `ConsistencyTimeout` though the command is committed. `Domain.DefaultConsistency` (a `Context.Reference`, default
  `"eventual"`) sets it for every command a client sends, read once when the client is built (`Api.ts` lines 270-282,
  1242-1246; `Command.ts` lines 45-69; `index.ts` line 64). Commit `bc0024faf` (#3469).
- `atLeast` on `get`, `list`, `snapshot`, `peek` and now also a stream's `list` takes one receipt or several
  (`Query.AtLeastInput`, `Api.ts` lines 123-261), and a stream's `list` can now fail with `ConsistencyTimeout`. The
  docstrings say a read that leaves `atLeast` out "waits for the commands this client sent". The code does not: the
  client passes the options through as given (`nest`, `Api.ts` lines 1084-1150), and the server waits only for the
  receipts it is sent (`waitFor`, `Api.ts` lines 680-692, through `Query.receiptsOf`, `Query.ts` lines 38-39, which
  gives none for a missing `atLeast`). So leaving `atLeast` out waits for nothing; pass the receipt.
- A read is judged by `validate` on the key's current state before it waits for `atLeast`, so how long a wait takes
  tells a refused caller nothing (`judgedRead`, `Api.ts` lines 650-670, issue #2906; commit `794557619`, #3414).
  `events` judges its `CaughtUp` frame against the state the history ends at (issue #3060, `Api.ts` lines 603-620).
- An undeclared error or a defect, including one raised by middleware, is logged with its full cause and reaches the
  client as one generic defect (`declaredOnly` and `redactMiddleware`, `Api.ts` lines 510-578). Commit not known.
- `Model.ServableBy` gains `decisions`, and its `commands` include the command of each decision (`Model.ts` lines
  327-343).
- The `Domain.Api` constructor and protocols move to `index.ts` lines 295-301.

## Rules, and the mistakes to avoid

- Leaving a kind out serves all of it. An Api written as `{ model: Catalog, commands: [...] }` with no `queries` key
  serves every query of the model. Write `queries: []` when you mean none.
- An Api is not a permission system. Being listed only makes an entry reachable; each entry's middleware, its
  aggregate's `decide` and its view's `validate` still decide who may do what, on every call.
- The docs pages for the HTTP API, the CLI and MCP list "an aggregate's `get`" among the calls (`http-api.mdx` line 75,
  `cli.mdx` line 95, `mcp.mdx` line 18, at both refs). `Servable` does not include an aggregate, and `make` only picks
  from `model.commands`, `views`, `streams` and `queries` (`Api.ts` lines 1250-1255), so no Api serves one. Put a view
  over the aggregate instead.
- Build `clientInProcess` per request in a Worker, inside `Effect.scoped`. Use `layerClientInProcess` only in a
  long-lived process or a script.
- Never send a request to the Worker's own URL to reach the model; use `clientInProcess`. Never forward a verified
  secret through a header to be checked a second time in process.
- A browser cannot set headers on a WebSocket, and the read's request is in the URL (which reaches logs): serve the
  screens and the Api from one origin and keep the session in an `HttpOnly`, `SameSite` cookie.
- `protocolWebSocket` against a host whose store has no `connect` gets a 501 for every live read; use `protocolHttp`
  there.
- Write examples for the version you run: a beta.87 command call takes `target` first, a main call does not.
- On main, pass the receipt as `atLeast` when you need to read your own write; leaving it out does not wait.

## In this app

The screens would reach the catalog through one Api, and a hand-written handler would run the confirm through it in
process, as the person who pressed the button.

```ts
// SKETCH: not compiled. beta.87 call shape (target first).
import * as Effect from "effect/Effect"
import type * as Headers from "effect/http/Headers"
import { MemberApi } from "./MemberApi.ts"
import type { ImportId } from "@inventory/catalog-contract/Ids"

export const confirmFromScreen = Effect.fn("confirmFromScreen")(
  function* (importId: ImportId, headers: Headers.Input) {
    const catalog = yield* MemberApi.clientInProcess
    const receipt = yield* catalog.ConfirmImport(importId, { decisions: [] }, { headers })
    // Read the import's summary once it includes this confirm.
    return yield* catalog.ImportSummary.get(importId, {
      headers,
      atLeast: { stream: receipt.stream, version: receipt.version }
    })
  },
  Effect.scoped
)
```

A second Api, `AdminApi`, would list `ChangeRole`, `AddPerson` and `RemoveMember` from an access model, so the member
screens never carry them.

- **Used today:** no. The screens call a hand-written Effect `HttpApi` (`apps/inventory/src/api/v1/Api.ts`, groups in
  `packages/catalog/contract/src/Catalog.contract.ts` and `packages/access/contract/src/Access.contract.ts`), whose
  handlers call ports such as `ImportStore` (declared in `packages/catalog/model/src/Import/ImportStore.store.ts`; the
  catalog's ports are listed in `packages/catalog/model/src/Catalog.ports.ts`).
- **Where it goes:** a new `MemberApi` beside the catalog model in `packages/catalog/model/src/`, an `AdminApi` in
  `packages/access/model/src/`; the handlers in `packages/catalog/model/src/Import/Imports.handler.ts` and
  `packages/access/model/src/People/People.handler.ts` would call `clientInProcess` instead of the stores. Which
  endpoints move and which stay is listed in [Plain HTTP and OpenAPI](./http-api.md), "In this app".
- **What the person gets:** nothing they can see at first; later, live import progress through `watch` instead of
  polling.

## How to check it

- A test that builds `MemberApi.clientInProcess` over the [in-memory host](./host-in-memory.md), signs in as a viewer
  through the session middleware Layer, and expects `Forbidden` from `ConfirmImport`; then as an editor, expects a
  receipt whose `version` is one more than before. See [test tooling](./test-tooling.md).
- A type-level check: `Domain.Api("X", { model: Catalog, commands: ["NoSuchCommand"] })` must not compile.
- A [story](./story.md) for each rule the command enforces; the Api adds the middleware on top, which the in-process
  test above covers.
- Serving the Api with a name the model lacks dies with `DefinitionError` (`NotInModel`); a test that runs
  `yield* MemberApi` once catches it at start-up instead of on the first request.
- On main, [`Verify.model`](./verify.md) takes the model's Apis: a trial on 2026-11-19 ran
  `Verify.model(Inventory, { apis: [InventoryApi], story })` over a model of this app and proved its rules. Its report
  lists as assumed that "middleware lets every caller in", so Verify does not check who may send a command through an
  Api; the in-process test above does. No Api was served or called over a protocol in either trial (beta.87 or main).

## What it needs

- A host providing `Model.Internals`: [in memory](./host-in-memory.md), [Cloudflare Durable
  Objects](./host-cloudflare.md), [Rivet](./host-rivet.md) or [Effect Cluster](./host-effect-cluster.md).
- The server Layer of every middleware the served entries declare (a session middleware, see
  [sessions](./sessions.md) and [Better Auth](./better-auth.md)).
- Clients: an `HttpClient` (`FetchHttpClient.layer`), and for WebSockets `Socket.layerWebSocketConstructorGlobal`.
- beta.87 for what is published; main for target-less commands, `commits` and `consistency`.

## Verdict

**Use:** declare one Api per kind of client over the catalog and access models, and call it from the existing
hand-written `HttpApi` handlers with `clientInProcess`, so the screens' contract stays the app's own.

The brief recommends otherwise in its decision 22: the screens call the model's Api, because the Review step needs
the pushed stream of acts either way; `/api/v1` keeps the uploads, the staged table, sign-in and the status.

## Where this was read

- https://alchemy.run/domain/api (the live site documents beta.87)
- `website/src/content/docs/domain/api.mdx` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: same path, changed
- `website/src/content/docs/domain/{http-api,cli,mcp}.mdx` at `v2.0.0-beta.87` (the aggregate rows); on
  `main@dbfd0ddb`: same paths, changed
- `packages/domain/src/Api.ts` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: same path, changed
- `packages/domain/src/Command.ts` at `v2.0.0-beta.87` (lines 36-100, 240-265); on `main@dbfd0ddb`: same path, changed
- `packages/domain/src/Aggregate.ts` at `v2.0.0-beta.87` (lines 69-78); on `main@dbfd0ddb`: same path, changed
- `packages/domain/src/Model.ts` at `v2.0.0-beta.87` (`ServableBy`); on `main@dbfd0ddb`: same path, changed
- `packages/domain/src/Query.ts` on `main@dbfd0ddb` (lines 30-40, `receiptsOf`)
- `packages/domain/src/ReadRpcs.ts` at `v2.0.0-beta.87` (lines 220-349); on `main@dbfd0ddb`: same path, changed
- `packages/domain/skills/alchemy-domain/references/hosting.md` at `v2.0.0-beta.87`, "Calling the Api in process"; on
  `main@dbfd0ddb`: same path, changed
