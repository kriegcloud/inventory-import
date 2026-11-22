---
type: Reference
title: Query
description: A typed, guarded question across keys, answered by one handler from a store you own; this app would use it to serve the Items page and its facets from D1.
tags: [alchemy-domain, read]
---

# Query

Read at the library's release `2.0.0-beta.87` and its `main@dbfd0dd`, not at the pin `734c27a` the repository
builds on. What changed between that touches what this page recommends is listed once in [the map](../00-map.md),
"From `dbfd0dd` to the pin".

A query is a message a client sends to ask something no single key can answer: "this organization's items, sorted,
filtered and searched, a page at a time". It declares its `input`, its `success` schema, whether it is `paged`, the
reads it may wait on (`waitsFor`), its `middleware` and its `rejects`. Its Layer is one handler, built once, that
checks the caller and reads a store you own, usually the one a [projection](./projection.md) writes. The docs call it
"a question a client asks across keys" [https://alchemy.run/domain/query]. An [Api](./api.md) gives clients a typed
method for it, and it runs in the Api's process, next to its store.

## When to reach for it

- A list over many keys: the Items page, past imports of an organization, rows left out across imports.
- A read whose answer comes from a database or index (D1, FTS5), not from one view key.
- A read of an aggregate's latest committed state, checked and trimmed to what the caller may see (the handler
  resolves the aggregate's client and calls `get`).
- Not for following a list live: a query has no `watch` (listed as a follow-up in
  `packages/domain/docs/query-design.md`). Use a [view](./view.md) or [stream](./stream.md) for that.

## How it is declared

```typescript
// SKETCH: not compiled
import * as Domain from "@alchemy.run/domain"
import * as S from "effect/Schema"
import { StoredItem } from "@inventory/catalog-contract/Item"
import { ItemSort, ItemFilter } from "@inventory/catalog-contract/ItemQuery"
import { ItemSearchText } from "@inventory/catalog-contract/ItemSearch"
import { Session } from "./Session.middleware.ts"
import { InvalidCursor } from "./InvalidCursor.rejection.ts"

export class ItemsPage extends Domain.Query(
  "ItemsPage",
  {
    input: {                                   // filters, sorts and search are fields, as today
      sorting: S.Array(ItemSort).check(S.isMaxLength(5)),
      filters: S.Array(ItemFilter).check(S.isMaxLength(20)),
      joinOperator: S.Literals(["and", "or"]),
      search: ItemSearchText                   // at most 200 characters, as today
    },
    success: StoredItem,                       // one entry of a page
    paged: true,                               // the answer is { entries, cursor }
    middleware: [Session],                     // provides CurrentActor
    rejects: [InvalidCursor]
  },
  { description: "One page of the organization's items, sorted, filtered and searched." }
) {}
```

- `input`: the query's fields (the same `Fields` a command takes). Without it (or with `{}`) the query takes no fields:
  its wire input is an empty record (`packages/domain/src/internal.ts` `inputSchema` 19-22).
- `success`: the result, or with `paged`, one entry. Without it the query answers `void`. A `paged` query with no
  `success` fails the model with `PagedWithoutSuccess`.
- `paged: true`: the answer is `{ entries: Success[], cursor: string | null }`; the client passes `after` (a cursor)
  and `take`. Default `false`.
- `waitsFor`: projections, views and streams to wait on when the caller passes a command's receipt as `atLeast`. The
  keys come from that command's own events, routed through each read's `key`/`keyOf`. One the model does not list
  fails it with `UnknownWait`. With any `waitsFor`, `ConsistencyTimeout` joins the query's errors.
- `middleware` and `rejects`: as for commands. The handler refuses a caller by failing with a declared rejection.
- The last argument is its [annotations](./annotations.md): the MCP tool's description, the CLI help, the OpenAPI
  operation.

The handler and its options:

```typescript
// SKETCH: not compiled
export const ItemsPageLive = ItemsPage.toLayer(
  Effect.gen(function* () {
    const items = yield* ItemStore                   // the app's port, resolved once
    return Effect.fn("ItemsPage")(function* (input, page) {   // page: { after: string | undefined, take }
      const actor = yield* CurrentActor              // what the middleware provides
      return yield* items.pageAfter(actor.organizationId, input, page)  // a new keyset method: { entries, cursor }
    })
  }),
  { take: { default: 50, max: 50 } }                 // left out: { default: 50, max: 500 }
)
```

- `toLayer(build, options)`. `build` runs once and may resolve any service and model member (a view's client, an
  aggregate's client). The handler may require only what the middleware provides and `RuntimeContext` (a D1
  binding).
- `options` has one field, `take` (`LayerOptions`, `Query.ts` 85-88); there is no `attributes`, `validate` or
  `visible`. `take` has two fields, each optional: `default` (rows per page when the client sends none, default 50)
  and `max` (the most a client may ask for, default 500) (`Take`, `Query.ts` 54-59). The host computes
  `max = max(1, floor(take.max ?? 500))`, `default = min(max, max(1, floor(take.default ?? 50)))`, and for a client's
  `take`, `min(max, max(1, floor(take)))` (`Query.ts` 444-446 and 465). A `take` of 0 or less becomes 1.
- For a paged query the handler receives `{ after, take }`, `take` already clamped as above. For an unpaged query the
  second argument is `undefined`, and its wire payload has no `after` or `take` at all (`Query.ts` 324-331), so `take`
  on the Layer does nothing for it.
- The host waits for every receipt through every read in `waitsFor` (each wait is a `Domain.caughtUp <Name>` span),
  then runs the handler inside a `Domain.query <Name>` span that records `domain.outcome` and, for a paged query,
  `domain.query.rows`. The handler adds its own attributes with `Effect.annotateCurrentSpan`.
- On the wire the payload is `{ input, atLeast?, after?, take? }`, so the query's own fields never collide with paging.
  The client's error type is the rejections, the middleware's errors, `ConsistencyTimeout` (with `waitsFor`) and
  `RpcClientError`.
- A paged query's client method also has `.entries(input, options)` and `.pages(input, options)`, Streams that follow
  each cursor to the last page and fetch a page only when needed. Only the first page waits for `atLeast`
  (`Api.ts` 934-952). The client's options are `atLeast`, `after`, `take` and `headers` (`QueryOptions`, `Api.ts`
  294-306). An unpaged query's client method is the plain call.
- The handler must return `cursor: null` on the last page only, and never a short page that is not the last
  (`Query.ts` doc 230-234): `.pages` stops at the first `null` (`Api.ts` 946).

Checked in: `packages/domain/src/Query.ts` at `v2.0.0-beta.87`: `AtLeast` lines 23-26, `PageRequest` 39-44, `Page`
47-51, `Take` 54-59, `Handler` 79-82, `LayerOptions` 85-88, `FailureOf` 136-140, `Definition` 154-196, `make` and its
RPC 297-366, `toLayer` 348-356, `host` 436-495 (the clamp 444-446 and 465, the waits 452-463);
`packages/domain/src/DefinitionError.ts` `PagedWithoutSuccess` 357, `UnknownWait` 366; `packages/domain/src/Api.ts`
query handler 615-617, `QueryOptions` and `QueryClient` 294-336, the client 925-952.

Types and helpers this page has not named yet:

| Name | What it is | Where (beta.87; main) |
| --- | --- | --- |
| `QueryClass` | The class `Domain.Query(...)` returns: `queryName`, `definition`, `middleware`, `rpc`, `toLayer` | `Query.ts` 371-400; 374-403 |
| `QueryKey<Name>` | The type-level identity of a query's implementation in an Effect's requirements; what `toLayer` provides | `Query.ts` 145-147; 148-150 |
| `ResultType<P, S>` | A query's result type: `Page<S>` when `paged`, `S` otherwise, `void` without `success` | `Query.ts` 62-66; 65-69 |
| `PageOf<P>` | The handler's second argument: `PageRequest` when `paged`, `undefined` otherwise | `Query.ts` 69; 72 |
| `Waitable` | What `waitsFor` may list: a projection, a view or a stream | `Query.ts` 416; 423 |
| `FieldFilter<V>` | One field of a `Filter`: a bare value for equality, or an object of operators chosen by the field's type | `Filter.ts` 57-59; same |
| `OrderedOps<V>` | Operators for numbers, dates and strings: `equals`, `not`, `in`, `notIn`, `lt`, `lte`, `gt`, `gte` | `Filter.ts` 7-16; same |
| `StringOps<V>` | `OrderedOps` plus `contains`, `startsWith`, `endsWith` | `Filter.ts` 21-25; same |
| `ArrayOps<E>` | Operators on an array field: `some`, `every`, `none`, `has`, `isEmpty`, `length` | `Filter.ts` 30-37; same |

`Filter<T>` (a Prisma-style filter with `AND`, `OR`, `NOT`) and `OrderBy<T>` are exported from the package index;
`Filter` crosses the wire only as the `where` of a view or stream read, decoded by `FilterJson` (`Filter.ts` 177-184)
and run in memory by `matches` (285). `Filter.ts` is the same on main.

### What main changes

- `atLeast` on the wire is the exported `Query.AtLeastJson` (one receipt or a list); same shape as beta.87
  (`packages/domain/src/Query.ts` line 32 on main).
- `waitsFor` now waits through views: a read fed by a view waits for the first view to apply the command, then for what
  it emitted (`Definition.waitsFor` doc, `Query.ts` 179-188 on main; `Model.ts` `projectionProgress` 1797-1801; commit
  `ca7535707`, #3380; `query.mdx` "Read your own write"). On beta.87 a view or projection fed by a view is not waited
  on through it.
- `CaughtUp` takes an optional `key`, to wait for one key of a view only (`Query.ts` 413-419 on main).
- `query.mdx` adds that even a strong command does not wait for a projection's store, and commands lose their target
  (`bank.WithdrawMoney({ accountId, amount })`).
- The main client's doc comments say a client remembers the commands it sent and its queries wait for them when
  `atLeast` is left out (`packages/domain/src/Api.ts` lines 326-336 and 1368-1380 on main). The code does not: the
  client passes a query's options through unchanged (`nest`, `Api.ts` 1099-1104 on main), and the host waits only for
  the receipts it is given (`Query.ts` `host`, the loop over `receiptsOf(atLeast)`). Pass the receipt.
- The query's own code (`toLayer`, `host`, the client) is otherwise the same on main.

## Rules, and the mistakes to avoid

- The handler is the security boundary: check the caller first, then scope the store read by the caller (the
  organization in the `WHERE`), so every page comes back full and only with the caller's rows.
- `packages/domain/docs/query-design.md` describes `validate`, `visible` and `attributes` options. None exist in
  `Query.ts` at beta.87 or main; the published docs and the source put authorization in the handler and span
  attributes in `Effect.annotateCurrentSpan`. `Story.query`'s doc still mentions `validate` and `visible`.
- Page by keyset on a total order: the requested sort, then `id`. Put every sort value and the order itself in the
  cursor, as a schema (base64url JSON via `Schema.StringFromBase64Url` and `Schema.fromJsonString`), never values
  joined by a separator. A cursor that does not decode under the current order fails with a declared rejection
  (`InvalidCursor`), never a wrong page.
- Return `cursor: null` only on the last page. The framework never interprets the cursor.
- A handler refuses with `return yield* new InvalidCursor()`. A rejection is built with `new`: on beta.87
  `Rejection.make()` does not type-check (a trial on 2026-11-19 got TS2322). The app's Effect diagnostic
  `newSchemaClass` reports every `new`, so domain files need an exception to it.
- A sort is one of a few declared values, each with its index; never a column name a client sends as free text.
  `Filter` and `OrderBy` from `Filter.ts` are deliberately not query inputs (`query-design.md`, "Pagination"): they
  are evaluated in memory, and an open filter over every field widens what a caller can ask. `OrderBy` has no wire
  schema; `Filter` has one only for a view's or stream's `where`.
- `atLeast` covers only reads in `waitsFor`. Without `waitsFor` it is accepted and ignored. A command a saga or policy
  sent has no receipt for the client.
- The docs' `BranchTotals` example writes a projection's `keyOf` as `(e) => e.branchId`; the source types a `keyOf`
  route as receiving the routing record (`({ event }) => event.branchId`, `packages/domain/src/Projection.ts` 164-167).
  Follow the source.

## In this app

The Items page today asks `items.page` and `items.facets` (`packages/catalog/contract/src/Catalog.contract.ts`), served
by `ItemStore.page` and `ItemStore.facets` (`packages/catalog/model/src/Item/ItemStore.store.ts`) on D1
(`packages/catalog/host/src/ItemStore.adapter.ts`). What it does there:

- Input `ItemQuery` (`packages/catalog/contract/src/Item/ItemQuery.command.ts` 134-154): `page` (from 1),
  `perPage` (1 to 50; the table offers 10 to 50), up to 5 `sorting` entries, up to 20 `filters` of a closed schema
  (column, operator, value), `joinOperator` and `search`.
- SQL: the organization AND the search AND the filters' group; the filters joined by `and` or `or`; search through the
  `itemSearch` FTS5 index, with a one-letter-different fallback by `LIKE`; with a search and no chosen order, rows
  ranked by how many words hit the name, then the SKU; then the chosen sort (text `COLLATE NOCASE`, unit cost as a
  number, empty reorder point and date last), then `id` in the last column's direction.
- Paging: `LIMIT perPage OFFSET (page - 1) * perPage`, and `COUNT(*)` in the same D1 batch, so the answer is
  `ItemPage`, `{ data, total, pageCount }` (`ItemQuery.command.ts` 155-166; `ItemStore.adapter.ts` `page`).
  `ItemsPage.screen.tsx` shows the total and the page count, and moves an address past the last page to the last.
- With no sort chosen and no search, rows come by SKU (`bySku`).
- Facets (`ItemFacets`, `ItemQuery.command.ts` 176-201): the organization's item count, counts per category, unit,
  active and lot-tracked, and the lowest and highest quantity and cost, over all the organization's items (not the
  filtered ones), in one batch (`ItemStore.adapter.ts` `facets`).

What a `Domain.Query` can express of that:

| Today | As a Domain query | Changes on the screen |
| --- | --- | --- |
| `sorting`, `filters`, `joinOperator`, `search` | `input` fields with the same schemas; `ItemFilter` is already a closed, declared filter, which is what the design asks for | none |
| organization scope from the session | the handler reads `CurrentActor` from `Session` and passes `organizationId` | none |
| `perPage` | the client's `take`, clamped by `take: { default: 50, max: 50 }` on the Layer | none |
| `page` + `OFFSET` | either keep it as an `input` field of an unpaged query, or switch to `paged: true` with a keyset cursor | see below |
| `total`, `pageCount` | not part of a paged answer (`{ entries, cursor }` only). An unpaged query whose `success` is today's `ItemPage` carries them; or a second query `ItemCount` with the same input | with keyset, "Page 3 of 25" becomes "50 of 1,240" plus Next and Previous |
| `facets` | an unpaged query `ItemFacets` with no input and `success: ItemFacets`, whose handler calls `ItemStore.facets`; Domain computes no facets of its own | none |
| search | stays the store's: the handler calls `ItemStore`, whose D1 adapter matches words in the `itemSearch` FTS5 index and reads a word not held as typed with one letter different by `LIKE`. Domain has no full-text search; its `where` is an in-memory filter on one key's rows | none |
| search ranking | handler logic; for keyset, the two hit counts must also go into the cursor and the `WHERE` | none |
| refresh after a confirm | `waitsFor: [ItemCatalog]` and the confirm's receipt as `atLeast`, if a projection writes the `item` table | none |

Two shapes follow:

1. **Same screen, query as a carrier.** `ItemsPage` unpaged, `input` = all of `ItemQuery` (including `page` and
   `perPage`), `success: ItemPage`. The answer is exactly today's `{ data, total, pageCount }`: an unpaged query
   returns its `success` as it is (`Query.ts` 332-337). The handler calls today's `ItemStore.page`. Paging stays in
   the input, bounded by `ItemQuery`'s own schema (`perPage` 1 to 50); the Layer's `take`, the client's `after` and
   `take`, and `.pages`/`.entries` do not apply. The framework adds the typed client, the session middleware, the span
   and story coverage; the offset paging and its known weakness (a row written between two pages shifts the next one)
   stay.
2. **Keyset, as the docs intend.** `ItemsPage` `paged: true`, `success: StoredItem`, plus `ItemCount` (unpaged, the
   same filter and search fields, `success: S.Int`) for the total. The answer is `{ entries, cursor }`
   (`Query.ts` `Page` 47-51): no total, no page number, no page count, and `cursor` is `null` on the last page.
   The cursor schema holds the order (the sort entries, or "ranked"), each sort value of the last row (with a null
   marker for the reorder point and date columns that sort empties last), the two hit counts when ranked, and `id`.
   The adapter turns it into a row-value comparison in the `WHERE`, column by column in each column's direction. The
   screen loses jumping to page N: the data table's page-number control and the `page` in the address become Next and
   Previous, with the cursor (and a stack of earlier cursors for Previous) in the address so a refresh lands on the same
   rows; the "page past the last" correction in `ItemsPage.screen.tsx` (lines 275-286) goes away; changing a sort or a
   filter starts from the first page, as it does now.

- **Used today:** no. The Items page uses an Effect `HttpApi` endpoint (`items.page`, `items.facets`) and the
  `ItemStore` port.
- **Where it goes:** `packages/catalog/model/src/Item/ItemsPage.query.ts` and `ItemFacets.query.ts`, their Layers
  beside them using the `ItemStore` port; the D1 adapter stays in `packages/catalog/host/src/ItemStore.adapter.ts`;
  `packages/catalog/web/src/ItemsPage.screen.tsx` calls the Api client.
- **What the person gets:** with shape 1, nothing they can see; with shape 2, pages that never repeat or skip an item
  while others import, at the cost of page numbers.

## How to check it

- `Story.query(ItemsPage, input, [{ sku: "BOLT-M8" }, ...])` runs the hosted query (the `atLeast` wait, then the
  handler) as the context `Story.provide` set, with the result through its wire schema; without `expected` the next
  step must be `Story.rejected(new InvalidCursor())` (`packages/domain/src/Story.ts` 467-486 and 1474-1500 at
  beta.87). It runs no middleware. Nothing here was run: the trials on 2026-11-19 ran no query. Give the story the in-memory `ItemStore` twin
  (`packages/catalog/model/src/Catalog.memory.ts`), which must page the same way as D1.
- A member of `org_northline` asking `ItemsPage` gets none of `org_prairie`'s items: a story per organization.
- Page through every item with `client.ItemsPage.entries(input, { take: 7 })` while a confirm writes new items between
  pages, and assert no SKU repeats or is missed (shape 2).
- The middleware and `atLeast` are checked only through the Api's `clientInProcess`.

## What it needs

An Api host. On Cloudflare it runs in the Worker, inside the Api's RPC handler; it has no key, so no Durable Object
owns it, and it reads D1 bound to the Worker. Its `atLeast` reads checkpoints from the waited reads' objects. beta.87
has everything above; waiting through views needs main.

## Verdict

**Use:** start with shape 1 (unpaged `ItemsPage` returning today's `ItemPage`, plus `ItemFacets`), which changes no
screen and keeps FTS5 search in the D1 adapter; move to shape 2 (paged, keyset, plus `ItemCount`) when page numbers
can give way to Next and Previous.

## Where this was read

- https://alchemy.run/domain/query (the live site documents beta.87)
- `website/src/content/docs/domain/query.mdx` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: changed (read your own write)
- `packages/domain/src/Query.ts` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: changed
- `packages/domain/docs/query-design.md` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: changed (read replicas section)
- `packages/domain/skills/alchemy-domain/references/building-blocks.md` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: same
  (Query section)
