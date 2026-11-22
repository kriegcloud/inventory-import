---
type: Reference
title: View
description: A per-key read model folded from events; this app would use one to show an import's result and history, read with a confirm's receipt.
tags: [alchemy-domain, read]
---

# View

A view is the read side of one key. It names the aggregates (or other views) it reads with `from`, says what one
instance is about with `key`, and folds each event into a `state` with `evolve`, or turns events into events of its own
with `emit`. The platform delivers each event to the view after the aggregate commits, at least once, in order per
source, and drops repeats, so a view is correct but can be a moment behind its aggregate. The docs put it as: "A view
answers a question" [https://alchemy.run/domain/view]. Clients read one key at a time through an
[Api](./api.md): `get`, `snapshot`, `list`, `watch` and `events`.

## When to reach for it

- A screen shows one thing, by one id, and that thing changes as commands land: an import's counts on the Result
  step, an item's history, a member's own allowance for the day.
- A screen wants to follow that thing live (`watch`, `events`) or page through its changes (`list`).
- You want to show the effect of a command right after sending it, by passing its receipt as `atLeast`.

Reach for a [query](./query.md) instead when the question crosses keys (the Items page: every item of an organization,
sorted, filtered and searched). Reach for a [stream](./stream.md) when code, not a fold, should decide each entry.

## How it is declared

```typescript
// SKETCH: not compiled
import * as Domain from "@alchemy.run/domain"
import * as S from "effect/Schema"
import { Import } from "./Import.aggregate.ts"

export class ImportResult extends Domain.View(
  "ImportResult",
  {
    from: [Import],                       // aggregates or views it reads
    key: Import,                          // one instance per import (or a string Schema, see below)
    state: S.Struct({
      status: S.Literals(["open", "imported", "takenBack"]),
      created: S.Int,
      updated: S.Int,
      already: S.Int,
      notImported: S.Int
    }),
    initial: { status: "open", created: 0, updated: 0, already: 0, notImported: 0 },
    evolve: {
      ImportConfirmed: (v, e) => ({ ...v, status: "imported", ...e.counts }),
      ImportTakenBack: (v) => ({ ...v, status: "takenBack" }),
      ImportReopened: (v) => ({ ...v, status: "open" })
    }
  },
  { description: "What one import's confirm did, counted from its events." }
) {}
```

The options, as `View.Definition` declares them:

- `from`: the aggregates and views it consumes. A view may read a view; its inputs then carry that view's state after
  each event (`Input.state`).
- `key`: an aggregate (its refs key the instances) or a string Schema such as a branded `OrganizationId` (its values
  key them, with no aggregate behind them). Reads then take the value: `client.OrgActivity.get(orgId)`.
- `keyOf`: which instance each input updates, keyed by event tag or by source name. It may be left out for a source
  keyed by the same aggregate or Schema. A route function receives the routing record `{ event, source, state,
  envelope }` and returns a ref (aggregate key), a value (Schema key), or `undefined` for "no instance". Instead of one
  function it may hold named routes (`{ previous: fn, current: fn }`); each route then gets its own `evolve` and
  `emit` handler under the same name.
- `state`: the state Schema. Leave it out for a view that only emits.
- `initial`: the state every instance starts from.
- `evolve`: `(state, event, context) => nextState | null`, keyed by event tag or source name. Returning `null`
  deletes the instance. `context` holds `key`, `source`, `state` (a view source's state after the event), `envelope`
  and `at` (the commit time).
- `events` and `emit`: the events this view emits. `emit` handlers get `(event, context)` with `before` and `after`
  states added, and return one event, an array, or `undefined`. A declared event with no `emit` handler passes through.
  A view with no `events` emits every event it applies, unchanged, each paired with its state after it.
- `computed`: values derived from state when read.
- `version`: bump it whenever what the view computes changes; never lower it. A view keyed by the one aggregate it
  reads is rebuilt in place, each key re-reading its own instance's events when first touched; any other view is
  rebuilt from the history before the deploy finishes.
- `middleware` and `rejects`: the read contract (see [Views as security boundaries](./view-security.md)).
- The last argument is its [annotations](./annotations.md); `description` reaches the Api's tools, CLI help and
  OpenAPI document.

`validate` is not on the declaration. It is the view's Layer: `ImportResult.toLayer(Effect.succeed(validate))`, where
`validate(request, state)` succeeds to allow a read or fails with a declared rejection. A view that declares
`middleware` or `rejects` cannot be hosted without it.

`lazy` is not on the declaration either. It is an option of the model's Layer:
`Inventory.layer(handlers, { lazy: ["ImportResult"] })`. A deploy that adds a lazy view runs no backfill; each key
reads its own instance's history the first time it is read or its source next changes. Only a view that reads one
aggregate and is keyed by it may be lazy; any other fails the model with `LazyViewNeedsOneSource`.

Reads. On the server, `yield* ImportResult` gives the `Host`; through an Api the typed `ViewClient` takes the key's id:

| Read | Host (server) | Client (through an Api) |
| --- | --- | --- |
| `get(key, { atLeast?, timeout? })` | `Option<State>` | `State \| null`; client options `atLeast`, `where` |
| `snapshot(key, { atLeast?, timeout? })` | `{ state, cursor }` | same, plus `where` |
| `list(key, { where?, order?, take?, after? })` | `{ entries, cursor }`, cursor a `seq` number | same, plus `atLeast` |
| `watch(key, { where? })` | `Stream<Option<State>>` | `Stream<{ state, cursor }>` |
| `events(key, { after?, where? })` | `Stream<Entry>` | `Stream<Entry \| CaughtUp>` |
| `waitFor(key, where, { timeout })` | server only; fails `WaitTimeout` | none |
| `watchEach(parent, keysOf, options?)` | server only | none |
| `history` | server only: `{ complete }` while a backfill runs | none |

An `Entry` is `{ event, state, envelope }`, where `envelope.seq` counts that key's emitted events. `list` is oldest
first unless `order: "desc"`; without `take` it reads every entry of the key, and with a `where` it reads the store in
batches of at least 128 (`LIST_BATCH`, `Model.ts` 967) until the page is full. `get` and `snapshot` with `where`
answer `null` when the state does not match. On the server, `atLeast` retries every 25 ms until the key's checkpoint
for the receipt's stream reaches its version, up to `timeout` (default 10 seconds), then fails with
`ConsistencyTimeout` (`Model.ts` 889-921). Every client call also takes `headers`.

Checked in: `packages/domain/src/View.ts` at `v2.0.0-beta.87`: `Definition` lines 200-269, `HandlerContext` and
`EmitContext` 162-180, `KeyFn` 183, `Entry` 279-285, `Page` 290-294, `Host` 317-385, `make` and `toLayer` 512-570,
`ViewClass.evolve` 649; `packages/domain/src/Api.ts` `ViewClient` lines 121-185; `packages/domain/src/Model.ts`
`LayerOptions.lazy` 214-221 and its check 483-488; `packages/domain/src/DefinitionError.ts` `LazyViewNeedsOneSource`
348-355.

Types and helpers of `View.ts` this page has not named yet:

| Name | What it is | Where (beta.87) |
| --- | --- | --- |
| `ViewKey<Name>` | The type-level identity of a view in an Effect's requirements (`yield* ImportResult` needs it) | `View.ts` 390-392 |
| `StateType<S>` | The state a state Schema decodes to, `null` for a view without one | `View.ts` 140 |
| `ComputedFns<State, Computed>` | The type of `computed`: one function per derived value | `View.ts` 272-274 |
| `NameOf<S>` | A source's name: an aggregate's `aggregateName` or a view's `viewName` | `View.ts` 89-93 |
| `SourceEvent<S>` | The events a source produces | `View.ts` 95-99 |
| `SourceKey<S>` | What keys a source's instances: the aggregate, or a view's key | `View.ts` 101 |
| `SourceState<S>` | What a source attaches to each input: a view's state after the event, nothing for an aggregate | `View.ts` 103 |
| `HandlerKey<From>` | What `keyOf`, `evolve` and `emit` may be keyed by: an event tag or a source name | `View.ts` 133 |
| `InputFor<From, K>` | The inputs a handler keyed by `K` receives | `View.ts` 135-137 |
| `Routing<I>` | The record a `keyOf` route receives: `{ event, source, state, envelope }` | `View.ts` 150-157 |

On main each of these lines is 5 lower (the `ConsistencyTimeout` doc grew); nothing else in `View.ts` moved.

### What main changes

- `ConsistencyTimeout` keeps its fields but its doc now says a command can raise it too (`consistency: "strong"`), and
  that the command is committed all the same (`packages/domain/src/View.ts` lines 28-37 on main).
- `atLeast` on a client read accepts one receipt or a list of them (`Query.AtLeastJson`, `packages/domain/src/Query.ts`
  line 32; `ReadRpcs.ts` 157, 188, 205; `Api.ts` `ViewClient` 122-198 on main). The server-side `Host` still takes one
  `{ stream, version }` (`View.ts` 330-350 on main).
- `atLeast` waits only for the commands whose events reach the key read; a receipt whose events never reach it is
  not waited for (`Model.ts` `caughtUp` doc lines 92-97 on main; `Api.ts` `waitFor` 680-692). On beta.87 the wait
  compares the key's checkpoint for the receipt's stream (`Model.ts` 889-921), so a receipt the key never consumes
  waits out the timeout.
- A read with `atLeast` is judged by `validate` before it waits, then again after if the version moved (`judgedRead`,
  `Api.ts` 651-671 on main, commit `794557619`, #3414). On beta.87 the wait comes first (`Api.ts` 700-707).
- The client's doc on main says a read with `atLeast` left out waits for the commands that client sent (`Api.ts`
  129-131, 1368-1380). The code does not do it: the client passes the options through unchanged (`nest`, `Api.ts`
  1134-1150), and a read with no receipts waits for nothing (`waitFor`, 686-687). Pass the receipt.
- Commands no longer take a target: `client.ConfirmImport({ importId, ... })`, and they take
  `consistency: "strong"`, which answers once the views have applied the command (commit `bc0024faf`, #3469; see
  [Reads and consistency](./reads-and-consistency.md)).

## Rules, and the mistakes to avoid

- Start from the screen's question, then the key, then the events. If the screen needs a fact no event carries, the
  event is missing it.
- A view is never updated in the command's step. A read right after a command needs `atLeast` (or, on main, a strong
  command).
- `keyOf` returning `undefined` drops the input for that view. A route name used in `keyOf` must have a handler under
  the same name in `evolve` or `emit`.
- `keyOf` may be left out only for a source keyed by the same aggregate or the same Schema (`View.ts` 218-223): a view
  keyed by `OrganizationId` that reads another view keyed by `OrganizationId` needs none. Brand the Schema
  (`OrganizationId`, `MemberId`) so two kinds of id never share a key by accident.
- Bump `version` when `evolve`, `emit`, `keyOf`, `state`, `events` or `from` change. Forgetting it leaves old keys on
  the old fold.
- `where` narrows a read in memory on the key's rows (`Filter.ts`); it is no index, and it never grants access.
- Through an Api the client passes the key's id string, not a ref; on the server the `Host` takes a ref.
- `validate` runs only for reads served through an Api. A handler, policy, query or story that does
  `yield* ImportResult` reads without it (`Api.ts` 621 is the only lookup of a validator outside the WebSocket pushes).

## In this app

The Result step today gets its counts back from the confirm itself (`commit` answers with the import's view,
`packages/catalog/web/src/ReviewDraft.atoms.ts` lines 336-366). With Domain, `ConfirmImport` would be a command on an
`Import` aggregate, and the Result step would read the `ImportResult` view above with the confirm's receipt:

The sketch is in beta.87's shape (a command takes its target first) and was not run: the trials on 2026-11-19 ran no
view.

```typescript
// SKETCH: not compiled
import * as Effect from "effect/Effect"

export const showResult = Effect.fn("showResult")(function* (client: CatalogClient, importId: string) {
  const receipt = yield* client.ConfirmImport(importId, { revision: 7 })  // beta.87: target first
  const result = yield* client.ImportResult.get(importId, { atLeast: receipt })
  return result  // { status: "imported", created, updated, already, notImported }, or null
})
```

An organization's own trail would be a view keyed by a branded `OrganizationId` Schema, with
`keyOf: { Import: ({ event }) => event.organizationId }`, so one import's events land on its organization's key.

- **Used today:** no. The counts come from `importOutcome` and `importBatch` rows read back in the confirm's own D1
  batch (`packages/catalog/host/src/ImportStore.adapter.ts`, `commit`).
- **Where it goes:** `packages/catalog/model/src/Import/` as `ImportResult.view.ts`; read by
  `packages/catalog/web/src/ResultStep.screen.tsx` instead of the confirm's answer.
- **What the person gets:** the Result step can follow the import live, so a take-back made in another tab shows
  without a refresh.

## How to check it

- A story: `Story.view(ImportResult, imp1, { status: "imported", created: 12 })` after a `when` that confirms, and
  `Story.emitted(...)` for a view that emits (`packages/domain/src/Story.ts` lines 433-450 at beta.87). A story reads
  the view's host and never runs `validate`.
- `ImportResult.evolve(state, input)` applies one input locally, the same fold the server runs: a pure unit test of
  `evolve`, or a prediction of the next state (`View.ts` line 649).
- The model fails to build on a route without a handler (`UnmatchedRoute`), an event no source emits (`NoEmitter`), a
  bad `initial` (`InvalidInitial`), or a lazy view that is not keyed by its one source
  (`packages/domain/src/DefinitionError.ts`).

## What it needs

Any host: in memory (stories, `clientInProcess`), Durable Objects (each view key is an object), Rivet, Effect Cluster.
Everything above is on beta.87; the items under "What main changes" need main.

## Verdict

**Use:** declare `ImportResult` keyed by `Import`, list it in the model's `views`, and read it on the Result step with
the confirm's receipt as `atLeast`. Its read access is the subject of [view security](./view-security.md), where
beta.87 has gaps that main closes.

## Where this was read

- https://alchemy.run/domain/view (the live site documents beta.87)
- `website/src/content/docs/domain/view.mdx` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: changed (strong commands, new
  command call shape)
- `packages/domain/src/View.ts` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: changed (doc of `ConsistencyTimeout`)
- `packages/domain/src/Api.ts`, `packages/domain/src/Model.ts` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: changed
- `packages/domain/skills/alchemy-domain/references/building-blocks.md` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: same
  (View section)
