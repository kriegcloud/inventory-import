---
type: Reference
title: GraphQL (effect/graphql)
description: Effect 4.1.4's experimental GraphQL module, which is a typed client for someone else's GraphQL API and cannot serve one; this app could use it to read Cloudflare's analytics, not to replace its own HTTP API.
tags: [alchemy-domain, extra]
---

# GraphQL (effect/graphql)

`effect/graphql` is a typed GraphQL **client**. You declare each operation (a query, a mutation or a
subscription) with a printed document, a Schema for its variables and a Schema for its result. You put the
operations in a group, and `GraphQLClient.make` turns the group into an object with one method per operation. The
module sends requests over `HttpClient` (or a WebSocket), decodes what comes back, and gives you middleware,
cursor paging and request batching. Nothing in it parses a schema, runs resolvers or answers a request, so it
cannot give this app a GraphQL endpoint of its own. Effect's own guide says to use the modules "to call GraphQL
APIs with typed operations" [effect `LLMS.md`, section "Typed GraphQL clients with `effect/graphql`"].

This is not part of `@alchemy.run/domain`. Neither the Alchemy repository at `v2.0.0-beta.87` nor at `main@dbfd0ddb`
uses `effect/graphql`; it is on this list because the owner asked for it.

## When to reach for it

- The app has to read from or write to an outside system that only speaks GraphQL. For this app the real
  candidate is Cloudflare's GraphQL Analytics API (`https://api.cloudflare.com/client/v4/graphql`), which
  reports the app's own D1 database load (`d1AnalyticsAdaptiveGroups`: `readQueries`, `writeQueries`,
  `rowsRead`, `rowsWritten`, `queryBatchTimeMs`). Other candidates (a store's inventory API, GitHub) are not named
  by the app today.
- Many concurrent lookups by id against such an API should go out as one request (`GraphQLResolver`).
- Tests need a stand-in for that outside API (`GraphQLClient.makeTest`, `layerTest`).

Do not reach for it to expose the app's own items, imports or people. The app's surface is Effect `HttpApi` at
`/api/v1` ([HTTP API](./http-api.md)); Effect 4.1.4 has nothing that serves GraphQL.

## How it is declared

Every export in the seven modules is marked `@stability experimental` (each file's header and each export's
JSDoc, for example `packages/effect/src/graphql/index.ts`, lines 1–48). Imported through the module's own paths:

```ts
// SKETCH: not compiled
import * as S from "effect/Schema"
import * as GraphQL from "effect/graphql/GraphQL"
import * as GraphQLGroup from "effect/graphql/GraphQLGroup"

// An operation: a name, the printed document (sent as written, never parsed at run time),
// a Schema for the variables (struct fields or a Schema) and a Schema for `data`.
const D1Load = GraphQL.query("D1Load", {
  document: "query D1Load($accountTag:string!,$databaseId:string,$start:Date,$end:Date){viewer{accounts(filter:{accountTag:$accountTag}){d1AnalyticsAdaptiveGroups(limit:31,filter:{date_geq:$start,date_leq:$end,databaseId:$databaseId},orderBy:[date_DESC]){sum{readQueries writeQueries rowsRead rowsWritten}dimensions{date}}}}}",
  variables: { accountTag: S.String, databaseId: S.String, start: S.String, end: S.String },
  result: S.Struct({
    viewer: S.Struct({
      accounts: S.Array(S.Struct({
        d1AnalyticsAdaptiveGroups: S.Array(S.Struct({
          sum: S.Struct({ readQueries: S.Int, writeQueries: S.Int, rowsRead: S.Int, rowsWritten: S.Int }),
          dimensions: S.Struct({ date: S.String })
        }))
      }))
    })
  })
})

// A group: the operations a client exposes. Operation names must be unique; they become method names.
export const CloudflareAnalytics = GraphQLGroup.make(D1Load)
```

The shapes, from source:

- **Kinds.** `Kind = "query" | "mutation" | "subscription"` (`GraphQL.ts`, line 27). `GraphQL.query`,
  `GraphQL.mutation` and `GraphQL.subscription` all take `(name, { document, variables?, result })`
  (`GraphQL.ts`, lines 317–329, 353–369, 394–410). `document` is a string or a `DocumentTemplate`, the
  generator's split form that `GraphQLResolver.aliased` needs (`GraphQL.ts`, lines 49–58, 271–274).
- **Operation.** Carries `kind`, `name`, `document`, `template`, `variables`, `result`, `middlewares`, and a
  `.middleware(m)` that returns a copy with `m` attached (`GraphQL.ts`, lines 126–153). Variables are encoded
  before sending and results are decoded from `data` (line 120).
- **Lenient decoders for generated code.** `GraphQL.enumLiterals` types a result enum as its literals but decodes
  any string; `GraphQL.otherTypename` is the catch-all `__typename` of a union (`GraphQL.ts`, lines 445–497).
- **Group.** `GraphQLGroup.make(...operations)` throws on two different operations with the same name;
  `GraphQLGroup.merge(...groups)` keeps each group's middleware on its own operations (`GraphQLGroup.ts`,
  lines 76–89, 115–116, 153–167).
- **Client.** `GraphQLClient.make(group, { subscriptionRetry? })` needs `GraphQLProtocol` and every middleware
  service the group names (`GraphQLClient.ts`, lines 274–290). A query or mutation method is
  `(variables?, { headers?, urlParams?, context?, partial? }) => Effect`; with `partial: true` it returns
  `{ data, errors }` (lines 92–111). A subscription method returns a `Stream` and resubscribes on a retryable
  error, by default from 500 ms growing by 1.5 up to 5 s (lines 124–134, 175–184, 433–441).
  `GraphQLClient.pages` and `items` drive a nullable `$after` cursor (lines 628–739). `makeTest` and
  `layerTest` answer from handlers, with no transport, no encoding and no middleware (lines 841–898).
- **Transport.** `GraphQLProtocol` is a `Context.Service` with `execute` and `subscribe`, both outbound
  (`GraphQLProtocol.ts`, lines 145–163). `layerHttp({ url, queryMethod?, subscriptions? })` sends a `POST` with
  a JSON body through the `HttpClient` in context, or a `GET` for queries; subscriptions use graphql-sse on the
  same address, or graphql-ws when `subscriptions.webSocket` is set (lines 205–211, 354–404, 713).
  `layerWebSocket` multiplexes every operation over one `graphql-transport-ws` socket (lines 1245–1552). The `url`
  may be a function of the calling context, for one client over several servers (lines 174–181, 406–411).
- **Middleware.** `GraphQLMiddleware.Service<Self, { requires?, error? }>()(key)` declares a tag; its
  implementation wraps `next(request)` and sees the raw result, status and headers (`GraphQLMiddleware.ts`,
  lines 66–77, 187–203). `mapRequest` builds one from a request transform (lines 248–253). This is client
  middleware: `next` is the rest of the client chain and then the transport.
- **Batching.** `GraphQLResolver.ordered` (a `nodes(ids:)` style field, by position), `findById` (by key, any
  order) and `aliased` (one operation repeated under aliases) build a `RequestResolver` over a client method;
  `GraphQLResolver.request(resolver)` gives `(key) => Effect` (`GraphQLResolver.ts`, lines 1–17, 130–144,
  341–404, 474–520, 627–702). The name "resolver" means Effect's `RequestResolver`, not a GraphQL field resolver.
- **Errors.** Every method fails with `GraphQLClientError { operation, reason }`, where `reason` is one of
  `ResponseError` (the server's `errors` list, with `status`, `headers`, `isRetryable`, `retryAfter`),
  `TransportError`, `EncodeError` (nothing was sent), `DecodeError` or `PaginationError`
  (`GraphQLClientError.ts`, lines 140–182, 262–320, 329–414, 459–519). Any `errors` entry fails a call unless it
  used `partial: true`; a non-2xx answer never succeeds (`GraphQLClient.ts`, lines 64–76). Middleware errors are
  added to a method's error type (`GraphQL.ts`, line 200).

#### Types and helpers

| Name | What it is | Where |
| --- | --- | --- |
| `GraphQL.Any`, `Middleware`, `Variables`, `Result`, `Error`, `Services`, `AddMiddleware` | type helpers over an operation | `GraphQL.ts`, lines 162–223 |
| `GraphQL.isOperation` | guard for an operation | `GraphQL.ts`, line 234 |
| `GraphQLGroup.Any`, `Operations`, `isGraphQLGroup` | any group, a group's operations, a guard | `GraphQLGroup.ts`, lines 43–61 |
| `GraphQLClient.GraphQLClient`, `Method`, `OperationMethod`, `SubscriptionMethod`, `PartialResult` | the client's shape and its methods' types | `GraphQLClient.ts`, lines 53–164 |
| `GraphQLClient.defaultSubscriptionRetry` | the default subscription schedule (500 ms, factor 1.5, 5 s cap, at least the server's `retryAfter`) | `GraphQLClient.ts`, lines 167–184 |
| `GraphQLClient.PageInfo`, `Connection`, `NodesConnection`, `PagingVariables` | the shapes `pages` and `items` read | `GraphQLClient.ts`, lines 480–560 |
| `GraphQLClient.MissingAfterVariable`, `InvalidAfterVariable` | compile-time error types when an operation has no optional string `$after` | `GraphQLClient.ts`, lines 516–533 |
| `GraphQLClient.TestCallOptions`, `TestHandler`, `TestHandlers` | the handler shapes for `makeTest` | `GraphQLClient.ts`, lines 750–780 |
| `GraphQLClientError.GraphQLError` | the Schema of one entry of a response's `errors` | `GraphQLClientError.ts`, lines 47–64 |
| `GraphQLClientError.Reason`, `isGraphQLClientError`, `isFatalCloseCode` | the reason union, a guard, and which WebSocket close codes stop a retry | `GraphQLClientError.ts`, lines 218, 423, 528 |
| `GraphQLMiddleware.Implementation`, `ServiceClass`, `AnyService`, `Identifier`, `Error`, `Requires` | a middleware's `execute`/`subscribe` pair and its type helpers | `GraphQLMiddleware.ts`, lines 66–132 |
| `GraphQLProtocol.GraphQLRequest`, `ExecutionResult`, `Url` | the request the client builds, the raw result, and a fixed or per-context address | `GraphQLProtocol.ts`, lines 61–102, 174 |
| `GraphQLProtocol.makeHttp`, `makeWebSocket` | the Effect forms of `layerHttp` and `layerWebSocket` | `GraphQLProtocol.ts`, lines 429, 1245 |

**Is it a server?** No, and the source shows it from every side:

- The only service is `GraphQLProtocol`, whose `execute` takes a `GraphQLRequest` the client built and returns the
  body a server sent back (`GraphQLProtocol.ts`, lines 61–69, 145–163). The HTTP transport builds that by
  calling `HttpClient.execute` on a `HttpClientRequest.post(url)` or `.get(url)` (lines 205–237, 366–393). No
  file imports `HttpRouter`, `HttpServer` or `HttpApi`.
- `GraphQL.Operation.document` is sent as written and never parsed at run time (`GraphQL.ts`, line 136). There is
  no schema definition type, no SDL parser, no executor and no field resolver anywhere in
  `packages/effect/src/graphql` or `packages/effect/src/internal/graphql.ts`.
- The parser lives in a separate dev tool, `@effect/graphql-generator` (`packages/tools/graphql-generator`), which
  reads `.graphql` files and a schema and writes client operation modules. It writes no server code
  (`packages/tools/graphql-generator/README.md`, "Generated files").
- Effect's index of guides lists five GraphQL guides, all for clients: basics, testing, batching, aliased
  batching, errors and retries (`ai-docs/src/52_graphql/`, `LLMS.md` "Typed GraphQL clients").

So "served by the Worker beside `/api/v1`, over which HTTP module, with what middleware" has no answer inside
Effect 4.1.4. Serving would need a third-party GraphQL server library running in the Worker beside the HttpApi
(not checked here, and a second contract style the app has avoided).

Every Effect line number on this page is in the app's installed copy, `node_modules/effect/src` (version 4.1.4). It
holds the same eight files as Effect's repository at the 4.1.4 tag; six are byte-identical, and `GraphQLProtocol.ts`
(1,552 lines installed) and `GraphQLResolver.ts` (889) carry longer doc comments, so their later line numbers differ
from the repository's; the code is the same API.

### What main changes

Nothing. This is not an Alchemy concept: no file in the Alchemy repository at `v2.0.0-beta.87` or at
`main@dbfd0ddb` imports `effect/graphql`. (Alchemy's GitHub provider talks GraphQL through
`@distilled.cloud/github/GraphQL`, a separate client with its own query algebra in
`@distilled.cloud/core/graphql`; see [distilled clients](./distilled-clients.md).)

## Rules, and the mistakes to avoid

- **It cannot serve.** Do not plan a GraphQL endpoint built on `effect/graphql`. The prior research was right
  that it is a client only; its other claim, that there is no server to call, holds for the app's own data but
  not for the platform: Cloudflare's analytics API is a GraphQL server the app's account already has.
- **`errors` fail the call.** A field error makes the whole call fail with `ResponseError`, even when `data` is
  partly there. Ask for `{ partial: true }` only where a missing branch is acceptable.
- **No automatic retry for queries and mutations.** Wrap a call in `Effect.retry` with
  `while: (e) => e.isRetryable` and wait for `retryAfter` (`GraphQLClientError.ts`, lines 91–98). Retrying
  `pages` restarts from page one; retry each page's call instead.
- **`GraphQLResolver.aliased` throws when built** for an operation with no `DocumentTemplate`, operation
  directives that reference variables, or a fragment spread or inline fragment at the root (`GraphQLResolver.ts`,
  lines 631–639; the reasons are `templateUnsliceableReason` in `packages/effect/src/internal/graphql.ts`,
  lines 118–126). That is a `throw` at construction,
  so build it once in a Layer, not in a request.
- **Do not return the whole context from `batchKey`**: it holds the caller's span, so every lookup gets its own
  batch (`GraphQLResolver.ts`, lines 280–287).
- **Workers.** `layerHttp` over `FetchHttpClient.layer` needs nothing from Node. `layerWebSocket` needs a
  `Socket.WebSocketConstructor`; in a Worker that path was not verified.
- **Keys.** A token for an outside API is read through the app's `Settings.ts` as `Config.Redacted`, and added in
  a `GraphQLMiddleware.mapRequest` that sets the `authorization` header. Never log it.
- **Experimental.** The API may change in a minor release. Pin `effect` exactly, as the app already does.

## In this app

**What the owner may have pictured: the app's own GraphQL surface.** If a server existed, the app's schema would
be a re-statement of the HttpApi contract (`packages/catalog/contract/src/Catalog.contract.ts`,
`packages/access/contract/src/Access.contract.ts`):

```graphql
# SKETCH: a schema the app could serve if it had a GraphQL server; nothing in Effect 4.1.4 serves it
type Item { id: ID! sku: String! name: String! category: String! uom: String! unitCost: String!
  quantityOnHand: Int! reorderPoint: Int! revision: Int! }
type ItemPage { items: [Item!]! total: Int! }
type RowOutcome { rowNumber: Int! sku: String! outcome: String! reason: String }   # created, updated, already, notImported, takenBack
type Import { id: ID! fileName: String! status: String! revision: Int! outcomes: [RowOutcome!]! }
type Member { id: ID! name: String! email: String! role: String! }                    # admin, editor, viewer
type ActivityLine { id: ID! actorName: String! action: String! detail: String! agent: String createdAt: String! }
type Query {
  items(search: String, category: String, sort: String, after: String, first: Int): ItemPage!   # ItemStore.page
  import(id: ID!): Import                                                                       # imports.get + result
  members: [Member!]!                                                                           # people.list
  activity(first: Int): [ActivityLine!]!                                                        # activity.recent
}
type Mutation {
  commit(importId: ID!, revision: Int!): Import!          # imports.commit: one atomic D1 batch
  takeBack(importId: ID!): Import!                        # imports.takeBack
  editItem(id: ID!, revision: Int!, name: String, unitCost: String): Item!   # items.edit, refused on an old revision
}
```

Every query and mutation maps one-to-one onto an endpoint the app already has, behind the same `Identity`
middleware, `requireRole` checks and per-organization filters. A GraphQL layer would add a second contract and an
OpenAPI document that no longer covers the API, and it would gain nothing the screens need: they already ask for
exactly the fields each page shows. If one were built, the browser could call it with `effect/graphql`
(`GraphQLProtocol.layerHttp({ url: "/api/graphql" })`, `GraphQLClient.pages` for the Items page's cursor).

**The real use: reading the app's own D1 load from Cloudflare.** An admin-only panel on the People page, or a line
under the model-call allowance, could show "Today: 1,240 rows read, 310 rows written" from Cloudflare's GraphQL
Analytics API, using `D1Load` from the block above:

```ts
// SKETCH: not compiled
import * as Config from "effect/Config"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Redacted from "effect/Redacted"
import * as Headers from "effect/http/Headers"
import * as FetchHttpClient from "effect/http/FetchHttpClient"
import * as GraphQLClient from "effect/graphql/GraphQLClient"
import * as GraphQLMiddleware from "effect/graphql/GraphQLMiddleware"
import * as GraphQLProtocol from "effect/graphql/GraphQLProtocol"

class CloudflareAuth extends GraphQLMiddleware.Service<CloudflareAuth>()("@inventory/drivers/CloudflareAuth") {}

const CloudflareAuthLive = Layer.effect(
  CloudflareAuth,
  Effect.map(Config.Redacted("CLOUDFLARE_ANALYTICS_TOKEN"), (token) =>
    GraphQLMiddleware.mapRequest((request) =>
      Effect.succeed({
        ...request,
        headers: Headers.set(request.headers, "authorization", `Bearer ${Redacted.value(token)}`)
      })
    ))
)

const Analytics = CloudflareAnalytics.middleware(CloudflareAuth)

export class D1Usage extends Context.Service<D1Usage, GraphQLClient.FromGroup<typeof Analytics>>()(
  "@inventory/drivers/D1Usage"
) {
  static readonly layer = Layer.effect(D1Usage, GraphQLClient.make(Analytics)).pipe(
    Layer.provide(CloudflareAuthLive),
    Layer.provide(GraphQLProtocol.layerHttp({ url: "https://api.cloudflare.com/client/v4/graphql" })),
    Layer.provide(FetchHttpClient.layer)
  )
  static readonly layerTest = GraphQLClient.layerTest(D1Usage, Analytics)
}
```

The handler reads `const usage = yield* D1Usage`, calls `usage.D1Load({ accountTag, databaseId, start, end })`, and maps a
`GraphQLClientError` to "Database figures are not available right now" on screen. The page is complete without the
token: the panel says it is off. The setting names would be `CLOUDFLARE_ANALYTICS_TOKEN` and the account and
database ids; none exists today. The token is a Cloudflare API token with the account permission **Account
Analytics: Read**, sent as `Authorization: Bearer …` (Cloudflare's "Configure an Analytics API token" page; the same
permission `wrangler d1 insights` asks for on the D1 metrics page). The account id is already a deploy setting
(`PRODUCTION_CLOUDFLARE_ACCOUNT_ID`, `PREVIEW_CLOUDFLARE_ACCOUNT_ID` in `packages/infra/src/GitHub.stack.ts`,
lines 80–81); the database is made by `Cloudflare.D1.Database("Database", …)` in
`packages/infra/src/Inventory.stack.ts`, line 65, so its id would be passed to the Worker as one more setting.
Cloudflare's D1 page checked on 2026-11-19 confirms the endpoint (`POST https://api.cloudflare.com/client/v4/graphql`),
that D1's datasets require an `accountTag` filter, the dataset `d1AnalyticsAdaptiveGroups` filtered by
`date_geq`, `date_leq` and `databaseId`, its fields `readQueries`, `writeQueries`, `rowsRead`, `rowsWritten`,
`queryBatchTimeMs`, `queryBatchResponseBytes`, and the variable types `string!`, `string` and `Date` used above. It
also says the figures are not billing figures, and a request that fails before SQL runs is not recorded.

- **Used today:** no. The app has no GraphQL client or server; every read and write is an `HttpApi` endpoint
  (`packages/catalog/contract/src/Catalog.contract.ts`, `packages/access/contract/src/Access.contract.ts`).
- **Where it goes:** a new driver package `packages/drivers/cloudflare-analytics` holding `D1Usage`, wired in
  `apps/inventory/src/server/App.ts`, with its token read in `apps/inventory/src/server/Settings.ts` and declared
  in `apps/inventory/src/server/env.d.ts`; an admin-only read endpoint in `Access.contract.ts`; its test in the
  driver's `test/` with `D1Usage.layerTest`.
- **What the person gets:** an admin sees how hard the app is working its database today; nothing else changes.

## How to check it

- A test with `D1Usage.layerTest({ D1Load: () => Effect.succeed(...) })` proves the handler's mapping and its
  wording when the call fails (`GraphQLClient.makeTest` dies with `UnimplementedError` for a missing handler, so a
  forgotten stub cannot pass: `GraphQLClient.ts`, lines 796–797, 906–915).
- A test with a scripted `GraphQLProtocol` (`Layer.succeed(GraphQLProtocol.GraphQLProtocol, { execute, subscribe })`)
  proves decoding and the error path, including a body with `errors` and `partial` left off.
- Effect's own tests to read for behaviour: `packages/effect/test/graphql/` (`GraphQLClient.test.ts`,
  `GraphQLProtocol.test.ts`, `GraphQLResolver.test.ts` and six more).
- No `Domain.verify` rule, story or prover applies: this is not a domain declaration.

## What it needs

- `effect` 4.1.4, already installed; no new package. `@effect/graphql-generator` 4.1.4 (published on npm) only if
  operations are generated from `.graphql` files.
- Any host: it is an outbound HTTP client, so the Worker as it is. No Alchemy host.
- For the analytics use: a Cloudflare API token with **Account Analytics: Read**, the account id and the D1 database
  id, as three Worker settings.
- For an app-served GraphQL endpoint: a GraphQL server library outside Effect, which this page did not evaluate.

## Verdict

**Cannot yet:** serve the app's own data over GraphQL. Effect 4.1.4's `effect/graphql` is client-only
(`GraphQLProtocol.ts`, lines 145–163 and 366–393: it sends requests, it never answers one), and nothing else in
Effect serves GraphQL. What would unblock it: Effect shipping a GraphQL server module, or the owner choosing a
third-party server to run beside `/api/v1`.

**Use:** as a client to an outside GraphQL API. The first real one is Cloudflare's GraphQL Analytics API, read by a
`D1Usage` driver for an admin-only panel, tested with `layerTest`.

## Where this was read

- `packages/effect/src/graphql/{GraphQL,GraphQLClient,GraphQLClientError,GraphQLGroup,GraphQLMiddleware,GraphQLProtocol,GraphQLResolver,index}.ts`
  in the app's installed `effect` 4.1.4 (`node_modules/effect/src/graphql`), compared with Effect's repository at the
  4.1.4 tag
- `packages/effect/test/graphql/*.test.ts` at `effect@4.1.4`; `ai-docs/src/52_graphql/`; `LLMS.md`;
  `packages/tools/graphql-generator/README.md`
- https://developers.cloudflare.com/d1/observability/metrics-analytics/ and
  https://developers.cloudflare.com/analytics/graphql-api/
- The app: `node_modules/effect/src/graphql`, `explorations/ideal-architecture/research/03-effect-modules.md`
  (sections 2.6 and 3.8), `explorations/ideal-architecture/README.md`
- Alchemy at `v2.0.0-beta.87` and `main@dbfd0ddb`: no `effect/graphql` use (searched both trees);
  `packages/github/src/Providers.ts` (imports `GraphQLLive` from `@distilled.cloud/github/GraphQL` at beta.87,
  line 1); on main the same file also provides `@distilled.cloud/github/Retry` with `alchemy/DeployRetry`'s policy
  (lines 2, 5, 96); neither touches `effect/graphql`
- https://developers.cloudflare.com/analytics/graphql-api/getting-started/authentication/api-token-auth/
