---
type: Reference
title: Projection
description: A consumer that writes events into a store you own, in order per key and at least once; this app would use one to write items, outcomes and the search index from an import's confirm and take-back events.
tags: [alchemy-domain, reaction]
---

# Projection

A projection reads events from aggregates or views and writes them into a store you run yourself: a D1 table, a
search index, a warehouse, or a [stream](./stream.md) the model keeps. The platform routes each event to a key,
appends it to that key's input log once, and hands the handler the key's inputs in order, in batches if the Layer asks
for them. The handler runs at least once per input, so every write must be safe to repeat. It never sends commands,
which is what makes it safe to run again over the whole history. The docs put it as: "a projection never sends
commands. Its only effect is on its own store" [https://alchemy.run/domain/projection]. A [query](./query.md) then
serves what it wrote.

## When to reach for it

- The read needs a store a [view](./view.md) does not give: rows across many keys, sorted and filtered (the Items page),
  full-text search (`itemSearch`), or data that must leave the model.
- The work is a write to your own storage and nothing else: no command, no mail, no model call. Those belong to a
  [policy](./policy.md).
- You can make every write idempotent: keyed by the event (`stream:seq`) or by an id the event carries.

Reach for a view first when one key's state answers the screen. Reach for a policy when the reaction acts on the world.

## How it is declared

```typescript
// SKETCH: not compiled
import * as Domain from "@alchemy.run/domain"
import * as Effect from "effect/Effect"

export class ItemsFromImports extends Domain.Projection(
  "ItemsFromImports",
  {
    from: [Import],                       // aggregates or views whose events it consumes
    key: Import,                          // what partitions it: an aggregate, or a string Schema
    on: [ImportConfirmed, ImportTakenBack] // every tag must be produced by some source in `from`
    // keyOf: { ... }                     // only when a source is not keyed like `key`
    // writes: [SomeStream]               // the Domain.Streams it appends to (it is their one writer)
  },
  { description: "Writes the items an import's confirm adds, and removes them on a take-back." }
) {}

export const ItemsFromImportsLive = ItemsFromImports.toLayer(
  Effect.gen(function* () {
    const writes = yield* ItemWrites      // the port, resolved once
    return Effect.fn(function* (batch) {  // always an array of one key's inputs, in order
      for (const input of batch) yield* writes.apply(input.event, input.envelope)
    })
  }),
  { batch: { size: 10, wait: "200 millis" }, version: 0 }
)
```

- `from`, `key`, `on` are required; `keyOf` and `writes` are optional (`Projection.Definition`).
- Each input carries `key` (the ref or value it was routed to), `route` (the `keyOf` route name, or `undefined`),
  `source` (the instance the event came from), `event`, `envelope` (`id`, `stream`, `seq`, `at`, `commandId`,
  `correlationId`), `state` (the view's state after the event, for a view source) and `position` (its place in the
  key's input log, from 1).
- The handler's type is `(batch) => Effect<void, never, RuntimeContext>`. It has no error channel, so anything that
  goes wrong can only be a defect, and the platform runs the batch again. It may require only `RuntimeContext` (a
  database binding exists only inside the running Worker); everything else is resolved in `toLayer`'s build Effect.
- `toLayer(build, options)` takes `batch: { size, wait? }` (no `batch`: one input at a time, as soon as it arrives;
  `size` is clamped to at least 1) and `version` (0 when omitted).
- The class also has `caughtUp(receipt, { timeout? })`, which waits until the projection has handled every event of a
  command that it consumes; it fails with `ConsistencyTimeout` after `timeout`, 10 seconds when omitted
  (`packages/domain/src/Model.ts` 1018-1029). It needs the projection's `Progress` service, which the hosted model
  provides. A receipt with only `stream` and `version` makes it read the command's events back from the aggregate.
  It waits on the key's checkpoints, which move only after a run of the handler succeeds.
- List it in the model's `projections`; its Layer goes with the other handlers.

Checked in: `packages/domain/src/Projection.ts` at `v2.0.0-beta.87`: `Input` 17-30, `Handler` 39, `Options` 45-59,
`Progress` 107-127, `Definition` 144-171, `make` and `toLayer` 241-281, `ProjectionClass` 286-323, `batchMillis`
326-334; `packages/domain/src/Kernel.ts` 629-673 (registration, `TwoWriters`, `WriterKeyMismatch`, `UnknownStream`),
581-610 (`NoEmitter`), 714-735 (generations), 1481-1514 (`projectionInputs`); `packages/domain/src/Model.ts` 630-668
(version and the kit), 1192-1260 (`projectionProgress`, the `caughtUp` it provides); `packages/domain/src/index.ts`
171-180.

### Types and helpers

| Name | What it is | Where (beta.87; main) |
| --- | --- | --- |
| `Domain.Projection` (`make`) | Declares a projection class | `Projection.ts` 241; 243 |
| `ProjectionClass` | The class type `make` returns: `kind`, `projectionName`, `definition`, `Progress`, `caughtUp`, `toLayer` | 286-323; 288-325 |
| `Definition` | `from`, `key`, `keyOf?`, `on`, `writes?` | 144-171; 146-173 |
| `Input`, `InputOf` | One input of the handler; the input type of a projection class | 17-30, 88-92; same |
| `Handler`, `Options` | The handler's type; `batch` and `version` | 39, 45-59; same |
| `Progress` | The service behind `caughtUp`, with `history` (whether the history has reached it) | 107-127; 107-129 |
| `ProjectionKey`, `ProgressKey` | Type-level identities of the projection and of its progress service in requirements | 132-139; 134-141 |
| `Identifier`, `ProgressIdentifier` | The requirement identifiers of a projection class and of its progress service | 95, 98-102; same |
| `Any` | What every projection class satisfies | 72-85; same |
| `Implementation` | What the Layer provides: the handler and its options (internal) | 62-65; same |
| `batchMillis` | Turns `batch.wait` into milliseconds for a platform (internal) | 326-334; 328-336 |

`Domain.Projection.Any`, `Domain.Projection.Input` and `Domain.Projection.Options` are also re-exported as types from
the package root (`index.ts` 171-180).

### What main changes

- `caughtUp` behaves differently. On beta.87 it waits only for events that come straight from an aggregate the
  projection reads (`Model.ts` 1192-1260): a projection fed by a view is not waited for. On main it follows the
  command's events through every view between the aggregate and the projection, waits for each view, then for the
  projection (`packages/domain/src/Model.ts` 1531-1545 `follow`, 1797-1845 `projectionProgress` on main; commit
  `ca7535707`, #3380). The doc comment and the docs page say the same (`Projection.ts` 113-119 on main;
  `website/src/content/docs/domain/projection.mdx` 234 on main). The default timeout is still 10 seconds.
- `consistency: "strong"` on a command (commit `bc0024faf`, #3469) waits for views, not projections
  (`packages/domain/src/Command.ts` 239-245 on main). A read of a projection's store still needs `caughtUp` or a
  query's `waitsFor`.
- The Cloudflare callback budget that paces a failing projection's retries changed: from 30 seconds doubling, eight
  attempts, then hourly, to 2 seconds doubling, twelve attempts, then hourly (`packages/alchemy/src/Workers/Workerd/
  AlarmCallback.ts` 38-49 on main). On Rivet and Effect Cluster, `alarmCallbacks` now retries from 2 seconds doubling
  up to an hour (`packages/domain/src/DurableObjects.ts` 2807-2810 on main). See the next section for what this does.
- Examples and the docs send commands without a separate target (`accounts.send(new WithdrawMoney({ accountId,
  amount }))`): a change to [commands](./command.md), not to projections.
- The in-memory host (`packages/domain/src/InMemory.ts` 1188-1329 on main) wraps projection runs in its own run
  tracking (`tracked`, `pollsWait`) for stories in manual mode. What a handler receives is unchanged.
- The Durable Object projection object, its 10-second retry and its intake are textually the same on main
  (`packages/domain/src/DurableObjects.ts` 1714-1861 on main).

## Rules, and the mistakes to avoid

- **At least once, so idempotent writes.** A batch runs again if the handler fails or the host restarts. Key each row
  by the event (`${envelope.stream}:${envelope.seq}`) or by an id the event carries, and use `ON CONFLICT DO NOTHING`
  or an upsert. A write that adds (`revision = revision + 1`, `count = count + 1`) is not idempotent on its own; guard
  it with a marker written in the same atomic batch.
- **Duplicates are dropped on arrival too.** Each key keeps, per source, the last `seq` it accepted, and drops a
  delivery at or below it (`InMemory.ts` 1111; `DurableObjects.ts` 1355-1388). That protects the log, not your store:
  the handler can still see the same input twice after a failed run.
- **Order is per key, per source.** Inputs for one key are handled one batch at a time in the order accepted; keys run
  in parallel. Between two sources in `from` there is no order.
- **No error channel.** The handler cannot fail with a typed error. Anything that goes wrong is a defect and the batch
  is retried.
- **A failing batch blocks its key, without end.** On Durable Objects the drain reads the log from the first
  unhandled position, catches the failure, logs `projection <Name> failed; retrying` and schedules itself again
  `PROJECTION_RETRY_MS` (10 seconds) later (`DurableObjects.ts` 1253, 1302-1346). Nothing counts attempts, nothing
  gives up, and nothing lets a later input of that key pass the failing one: every later input of that key waits
  behind it. Other keys keep going. Same code on main. How often it retries depends on the host's callbacks:
  - Cloudflare: the drain runs inside an alarm callback, and a callback that schedules itself again without reporting
    progress inherits the callback's retry budget (the `alchemy/Callback` docs, as published with beta.87; the
    `attempts` rule in `packages/alchemy/src/Workers/Workerd/AlarmCallback.ts` 320-330 at beta.87, 353-366 on main).
    The 10 seconds is only a floor. On beta.87 a failing batch is retried about 10 seconds after the first failure,
    then 30 seconds, 1, 2, 4, 8, 16 and 32 minutes apart, then every hour, never dropped. On main it is 10 seconds
    four times, then 16 seconds doubling to about 34 minutes, then every hour. A new input for the same key is
    scheduled with progress, which resets the budget and brings a retry 10 seconds later. When a job parks, the
    callback logs `Durable Object alarm callback parked`.
  - Rivet and Effect Cluster: the drain runs over `alarmCallbacks` (`DurableObjects.ts` 2202-2343 at beta.87), where
    a callback that succeeds and schedules itself again starts with zero attempts. The drain catches its own failure,
    so it succeeds, and the batch is retried every 10 seconds without end.
  - In memory: a failed run is recorded in the story's failures and logged; the log stays where it was and runs again
    on the next input for that key (`InMemory.ts` 1058-1123).
- **`version` replays the whole history.** Bumping it gives the projection a new generation: on Durable Objects a new
  object class (`consumerClass`, `<Name>ProjectionV<n>`, `DurableObjects.ts` 286), logs from the older
  generation read as empty, and the history is delivered again (`Kernel.ts` 714-735; `DurableObjects.ts`
  1264-1281). Empty or migrate your store first if a replayed write would not overwrite the old row. Bumping
  the version of a view it reads also bumps it. A projection added to a model that already has history receives that
  history first, the same way.
- **History is the history of events, not of your table.** A replay rebuilds only what the events say. Anything else
  that writes the same table (an edit outside the model) is lost or doubled by a replay.
- **`writes` makes it the one writer of a stream.** A second writer is `TwoWriters`; a stream keyed differently is
  `WriterKeyMismatch`; a stream not in the model is `UnknownStream`. An `on` tag no source emits is `NoEmitter`. These
  are definition errors the model reports when it is built.
- **Never send a command or call an external system from a projection.** A replay would act on the world again.
  Split: the projection writes the store, a policy on the same events acts.

## In this app

Today a confirm is one atomic D1 batch in `ImportStore.commit`
(`packages/catalog/host/src/ImportStore.adapter.ts` 867-1099): the confirm's own `importBatch` row (only while the
import is open), the import closed, the new items (`ON CONFLICT (organizationId, skuKey) DO NOTHING`), a kept copy of
each replaced item, the replacements, one `importOutcome` per row, the `importChange` rows, the counts and the
activity line. Every statement after the first checks that this confirm's row exists, so a second press, which comes
with a new confirm id, writes nothing. A take-back is one batch too (1101-1254). The FTS5 index `itemSearch` follows
`item` through triggers, so it moves with whatever writes `item`. The confirm id, the id of every new item and the
activity line's id are made in the request handler with `random.uuidV4()`
(`packages/catalog/model/src/Import/Imports.handler.ts` 65-66, 420-427).

With an `Import` [aggregate](./aggregate.md), the decision "this import is confirmed" becomes the aggregate's commit
(`ImportConfirmed`, refused once the import is not open), and the writes become a projection keyed by the import
(shaped here for (a1), below; under (a2) its `on` adds `RowsConfirmed`):

```typescript
// SKETCH: not compiled
import * as Domain from "@alchemy.run/domain"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"

/** Writes what a confirm or a take-back did to items, outcomes and changes: one atomic D1 batch per event. */
export class ImportWrites extends Context.Service<
  ImportWrites,
  {
    readonly confirm: (input: { readonly importId: string; readonly confirmId: string }) => Effect.Effect<void>
    readonly takeBack: (input: { readonly importId: string; readonly takeBackId: string }) => Effect.Effect<void>
  }
>()("@inventory/catalog-model/Import/ImportWrites") {}

export class ItemsFromImports extends Domain.Projection(
  "ItemsFromImports",
  { from: [Import], key: Import, on: [ImportConfirmed, ImportTakenBack] },
  { description: "Writes the items a confirm adds and a take-back removes, one D1 batch per event." }
) {}

export const ItemsFromImportsLive = ItemsFromImports.toLayer(
  Effect.gen(function* () {
    const writes = yield* ImportWrites
    return Effect.fn(function* (batch) {
      for (const { key, event } of batch) {
        yield* event._tag === "ImportConfirmed"
          ? writes.confirm({ importId: key.id, confirmId: event.confirmId })
          : writes.takeBack({ importId: key.id, takeBackId: event.takeBackId })
      }
    })
  })
)
```

**Two writes, not one.** The confirm becomes two writes in two stores: the aggregate's commit of `ImportConfirmed` in
the import's own storage (a Durable Object on Cloudflare), and, later, the projection's D1 batch. They cannot be one
transaction. The commit can succeed while the D1 batch has not run yet, or keeps failing. What stays all-or-none:
the fact is one commit (the import is confirmed, or it is not); the items, outcomes, changes, counts and activity line
of one confirm land in one D1 batch, all of them or none of them, and that batch is idempotent per confirm id. That
holds under (a1) and under (a2) when the projection holds the chunks (below); (a1) adds a third write before the two,
the plan, and (a2) written chunk by chunk gives up the one batch. Rule 2 ("nothing is written as an item before
Confirm") still holds; rule 1 (the three numbers agree) holds only once the batch has run, and the screen must wait
for that.

What each event does, and why each is safe twice:

- **`ImportConfirmed`** runs one D1 batch named by `confirmId`. Today's `thisConfirm` guard is not enough under a
  projection, because a redelivery comes with the same confirm id: the second run finds the `importBatch` row the
  first run wrote, so `thisConfirm` is true again. `replaceItems` would raise each replaced item's `revision` a second
  time, `countBatch` would count again, and `importedLine` would insert the same activity id and fail the whole batch
  on the primary key `(organizationId, id)`, a batch that then fails on every retry and blocks the import's key (with a
  fresh activity id instead, it would write a second activity line). The guard that works with the SQL the adapter
  has: add a column `applied INTEGER NOT NULL DEFAULT 0` to `importBatch` in `apps/inventory/migrations/0001_init.sql`;
  make the first statement `INSERT INTO importBatch (id, organizationId, ..., applied) VALUES (confirmId, ..., 0) ON
  CONFLICT DO NOTHING`; replace `thisConfirm` in every later statement (including `countBatch`, which today has no
  guard but its `WHERE id = batch`) with `EXISTS (SELECT 1 FROM importBatch WHERE organizationId = org AND id =
  confirmId AND applied = 0)`; end the batch with `UPDATE importBatch SET applied = 1`. Every statement is an `INSERT
  ... SELECT ... WHERE` or an `UPDATE ... WHERE`, so the condition fits each one. D1 runs a batch atomically and in
  order, so a redelivery after a success finds `applied = 1` and writes nothing, and a redelivery after a failure
  finds nothing written and does it all.
- **`ImportTakenBack`** needs its own marker too. Today's `markConfirms` marks only confirms with `takeBackId IS NULL`,
  but every later statement selects the confirms by `takeBackId = <this take-back>`, which the first run already set
  (`ofTakeBack`, `ImportStore.adapter.ts` 1110-1111). So a second run with the same take-back id would run
  `countTakeBack` again and reset `removed` to 0 (the items are gone by then), insert the activity line again, and
  raise the import's `revision` again in `settleDraft`. A second press is safe today only because it comes with a new
  take-back id. Guard the batch the same way: a table `importTakeBack (organizationId, id, applied)` keyed by
  `(organizationId, id)`, inserted first, checked by every statement, set to applied last.
- **Ids are fixed before the command.** The item ids and the activity line's id must be the same on every run of the
  batch, so a replay rebuilds the same rows: store them with the plan (a1) or in the chunk events (a2), or derive them
  from the confirm id and the row, not from `random.uuidV4()` inside the batch.
- The two events of one import arrive in order, because the projection is keyed by the import. Two imports run in
  parallel; two confirms that both write the same SKU still meet at the `(organizationId, skuKey)` unique index, so
  the second one's row is counted as "already there", as it is today.

**Where the rows come from.** One event cannot carry a large confirm's rows. `maxStagedRows` is 50,000
(`packages/catalog/contract/src/Staging/Staged.read.ts` 149); the adapter already splits a confirm into statements of
at most 500 rows (`chunkRows`, `packages/catalog/contract/src/Staging/Upload.command.ts` 10) and about 600,000
characters each, to stay under D1's 2 MB limit on one value (`ImportStore.adapter.ts` 70-89), and counts at least 600
characters per item (`textOf`, 61-68). Each statement passes its rows as one JSON value, so it stays under D1's 100
bound parameters per statement. A single 50,000-row event would be at least 30 MB, over the 8 MB a Durable Object
stores in one value. In chunks of several commands the rows do fit, at a cost. The options, under the labels
[host-cloudflare.md](./host-cloudflare.md) also uses (that page counts the objects, requests, rows written and stored
bytes of each; which to build is the app owner's decision):

- **(a1) The event names a plan staged in D1.** The confirm handler runs `review` on the stored rows, as it does now,
  writes the planned rows, with their item ids and the audit line's id, to a new table `importPlan` keyed by
  `(organizationId, confirmId, rowNumber, part)`, then sends one `ConfirmImport { confirmId, planRows, planDigest }`.
  The aggregate records one small `ImportConfirmed` (the confirm's id, the counts, a digest); the projection reads the
  plan by `confirmId`, checks the count, and writes the items, outcomes, changes and audit line in one D1 batch,
  idempotent per confirm id. *Keeps:* one command and one small event whatever the file's size; the items of one
  confirm land all together or not at all, as today. *Gives up:* three writes in order instead of two (the plan, the
  aggregate's commit, the batch), so a plan whose command was refused (the import closed meanwhile) is orphaned, and
  `remove` or a nightly sweep deletes plans with no `ImportConfirmed`; the plan rows are data in D1 that no event
  holds, so a replay works only while the plans are kept as long as their events.
- **(a2) The events carry the rows, in chunks.** The handler runs `review` as in (a1), then sends one command per
  chunk of planned rows (each recording a `RowsConfirmed` event) and a closing command that records
  `ImportConfirmed`. Two limits set the chunk size: one stored value is at most 8 MB (the event, and the receipt,
  which repeats the command's events), and one multi-key `put` takes at most 128 pairs (a commit writes its events in
  one and its deliveries in another); both are on [host-cloudflare.md](./host-cloudflare.md), with the arithmetic.
  Each command has its own command id, so a confirm that stopped is resumed by sending the same commands again, and
  the aggregate needs a state between the first chunk and the close that refuses other changes to the import.
  *Keeps:* everything is in the event log, so a replay can rebuild the rows with no table outside it. *Gives up:*
  more commands per confirm, and stored bytes kept for ever at about three times the payload (event, receipt, the
  projection's input log). The projection then does one of two things:
  - writes each chunk as it arrives, one D1 batch per `RowsConfirmed` guarded by its own marker (the event's
    `stream:seq`). Items appear chunk by chunk, and a confirm that stops halfway leaves some written: not all-or-none;
  - holds the chunks and writes once on the closing event. A projection keeps nothing between runs but its store, so
    it writes each chunk to a holding table in D1 (idempotent by `stream:seq`) and, on `ImportConfirmed`, writes
    everything from it in one D1 batch: all-or-none at the D1 level, as today.
- **(a3) Re-run `review` inside the projection** from the staged chunks and saved decisions. Set aside: it is not
  deterministic, because `review` reads the stored items, which differ at replay time.

A fourth option, **(b) every item its own aggregate**, fed by a [policy](./policy.md) that turns a confirm into one
command per ready row, sits on top of (a1) or (a2), with a projection keyed by item writing the D1 rows the Items page
reads; its cost is on [host-cloudflare.md](./host-cloudflare.md). A projection never sends those commands.

**What the person sees between the commit and the batch.** The confirm returns as soon as the aggregate commits, with
a receipt. From then the import reads as imported, but the Items page and search do not show its items yet, and the
counts are not written. The Result step must not count until the projection has written: its query declares
`waitsFor: [ItemsFromImports]` and is read with the confirm's receipt (`atLeast`), or the handler calls
`ItemsFromImports.caughtUp(receipt)` before reading. Either waits up to 10 seconds by default, then fails with
`ConsistencyTimeout` (`packages/domain/src/Query.ts` 448-466). Until then the screen says "Writing your items" in place
of the three numbers, so the rule that the numbers agree (rows in the file, what the result says, what is stored) is
read only from what is stored. The counts the [view](./view.md) page folds from `ImportConfirmed` cannot come from the
event under this design, because "created" versus "already there" is known only after the batch meets the unique
index.

**When the batch keeps failing.** The confirm stays committed and the items never appear. The import's key retries
on the schedule above, without end; the import's take-back event waits behind the failing confirm, so a take-back the
aggregate accepted does nothing in D1 either; other imports are not held up. Nothing tells the person: the Result
step's read fails with `ConsistencyTimeout` after its wait, so it needs a third state ("Your items are still being
written; nothing is lost; we keep trying"), and the failure needs an alert on the `projection ItemsFromImports failed;
retrying` log (and, on Cloudflare, on a parked callback). A deterministic failure (a statement over a D1 limit, a bad
row) never heals by retrying, and nothing lets later events pass it: it needs a code or data fix, after which the next
retry succeeds.

**What a version bump would do here.** It replays every `ImportConfirmed` and `ImportTakenBack` of every organization
(and under (a2) every `RowsConfirmed`; under (a1) it rebuilds only what the kept plans still hold). With the guards
above, a replay over the kept tables writes nothing. A replay into an emptied `item` table does not
restore the table as it was: item edits (`ItemStore.edit`) and their revisions are not events, so they would be lost.
Until edits are events of an `Item` aggregate and part of `on`, never bump this projection's version, and treat
`item` as a table the projection writes into rather than one it owns.

- **Used today:** no. `ImportStore.commit` and `ImportStore.takeBack`
  (`packages/catalog/host/src/ImportStore.adapter.ts` 1024-1099, 1226-1254) write in the same request as the guard.
- **Where it goes:** the writes of `commit` and `takeBack` move behind a new port `ImportWrites` in
  `packages/catalog/model/src/Import/`, with its D1 adapter in `packages/catalog/host/src/`; an `applied` column on
  `importBatch`, an `importTakeBack` table and, under (a1), an `importPlan` table (under (a2) holding the chunks, a
  holding table) in `apps/inventory/migrations/0001_init.sql`; the Result step's read waits on the projection.
- **What the person gets:** nothing new on a good day; a confirm answers sooner, and the Result step says plainly when
  the items are still being written.

## How to check it

- A [story](./story.md) runs projections for real: `given` an open import, `when` `ConfirmImport`, `then`
  `ImportConfirmed`, then `Story.query(...)` on the query that reads the result, expecting the counts. The story's
  memory adapter of `ImportWrites` must have the same guard as the D1 one. (On main a story's `when` takes the command
  alone: `Story.when(command)`.)
- An idempotency test of the D1 adapter: call `confirm` twice with the same `confirmId` and assert the second leaves
  every row and every `revision` as it was; the same for `takeBack` with the same `takeBackId`, asserting that
  `removed`, `restored`, `kept`, the activity lines and the import's `revision` are unchanged. This is rule 10 of the
  app, under redelivery.
- A slow test on a real local D1 (`apps/inventory/test/*.slow.test.ts`) that confirms 50,000 staged rows through the
  projection's adapter and reads the three numbers.
- `Domain.verify` and the model build report `NoEmitter`, `TwoWriters`, `WriterKeyMismatch`, `UnknownStream` and
  `DuplicateDefinition` for a projection declared wrong (`packages/domain/src/DefinitionError.ts` 25, 101-144).
- `Verify` on main does not check a projection's writes. In a trial on 2026-11-19, `Verify.model` on main listed among
  its assumptions that what a projection writes, and what a stream or a query gives, is not checked: only what a
  projection is given. The idempotency tests above are the check. No projection was run in either trial.

## What it needs

Any host: in memory for stories, Durable Objects on Cloudflare (`DomainCloudflare.layerDurableObjects`), Rivet or
Effect Cluster. The Durable Object projection object is the one documented above, and Rivet and Effect Cluster run the
same object over `alarmCallbacks`. beta.87 has everything used on this page. The app would also need the `Import`
aggregate first ([aggregate](./aggregate.md)), the two markers, and the table its option needs (the plan under (a1),
the holding table under (a2) when it holds the chunks).

## Verdict

**Use:** declare `ItemsFromImports` keyed by the import, fed under (a1) or (a2) (the app owner's choice, laid out under
"Where the rows come from"), guard each confirm's and each take-back's batch with an `applied` marker, make the Result
step wait on it and say when the items are still being written, and alert on its retry log. Do not bump its version
until item edits are events too.

## Where this was read

- https://alchemy.run/domain/projection (the live site documents beta.87)
- `website/src/content/docs/domain/projection.mdx` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: same path, changed
  (`caughtUp` through views, command shape in examples)
- `packages/domain/src/Projection.ts` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: same path, changed (doc comment only)
- `packages/domain/src/Kernel.ts`, `Platform.ts`, `Query.ts` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: same paths,
  projection parts same
- `packages/domain/src/Model.ts` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: same path, changed (`caughtUp` follows views)
- `packages/domain/src/InMemory.ts` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: same path, changed (run tracking)
- `packages/domain/src/DurableObjects.ts` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: same path, projection object same,
  `alarmCallbacks` retry changed
- `packages/alchemy/src/Callback.ts` and `packages/alchemy/src/Workers/Workerd/AlarmCallback.ts` as published with
  `alchemy@2.0.0-beta.87`; on `main@dbfd0ddb`: same paths, changed (retry budget)
- `packages/domain/src/Command.ts` on `main@dbfd0ddb` (`consistency`)
- `examples/cloudflare-domain/packages/domain/src/Ledger/*` and
  `examples/cloudflare-domain/packages/server/src/Ledger/D1LedgerStore.ts` at `v2.0.0-beta.87`; on `main@dbfd0ddb`:
  same
- `packages/domain/skills/alchemy-domain/references/building-blocks.md` ("Projection and its port") at
  `v2.0.0-beta.87`; on `main@dbfd0ddb`: same section
- App: `packages/catalog/host/src/ImportStore.adapter.ts`, `packages/catalog/model/src/Import/Imports.handler.ts`,
  `packages/catalog/contract/src/Staging/Staged.read.ts`, `packages/catalog/contract/src/Staging/Upload.command.ts`,
  `apps/inventory/migrations/0001_init.sql`
