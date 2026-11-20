---
type: Reference
title: Stream
description: A keyed, append-only log that one projection writes and clients read like a view; this app would use one for an import's history and one for each organization's activity trail.
tags: [alchemy-domain, read]
---

# Stream

A stream is one ordered list of entries per key, kept for good and readable from any point. Exactly one
[projection](./projection.md) writes it, by listing it in `writes` and calling `append` with the input it is handling;
clients read it through an [Api](./api.md), guarded like a [view](./view.md). Its latest entry is its current value, so
one stream answers both "what is it now?" (`peek`) and "every change since" (`events`, `watch`, `list`). The docs call
it "a keyed, append-only log" [https://alchemy.run/domain/stream]. Use a view when a fold describes the read model; use
a stream when code should choose each entry a client sees.

## When to reach for it

- A history a person reads line by line, where each line is shaped for the screen and not a raw domain event: an
  import's confirms and take-backs, an organization's activity trail.
- A value with a history (each entry a full snapshot), so `peek` is "now" and `watch` follows it.
- An entry that combines several sources, or skips changes no screen cares about: a projection can read a view's
  state after each event and append only when something visible changed.

## How it is declared

```typescript
// SKETCH: not compiled
import * as Domain from "@alchemy.run/domain"
import * as S from "effect/Schema"
import { Import } from "./Import.aggregate.ts"
import { Session } from "./Session.middleware.ts"
import { NotInOrganization } from "./NotInOrganization.rejection.ts"

export class Confirmed extends Domain.Event("Confirmed", {
  organizationId: S.String, by: S.String, created: S.Int, updated: S.Int, notImported: S.Int
}) {}
export class TakenBack extends Domain.Event("TakenBack", {
  organizationId: S.String, by: S.String, removed: S.Int, restored: S.Int, kept: S.Int
}) {}

export class ImportHistory extends Domain.Stream(
  "ImportHistory",
  {
    key: Import,                     // an aggregate, or a string Schema such as OrganizationId
    entries: [Confirmed, TakenBack], // the events an entry may be
    middleware: [Session],
    rejects: [NotInOrganization]
  },
  { description: "Each confirm and take-back of one import." }
) {}
```

The writer is a projection keyed the same way, listing the stream in `writes`:

```typescript
// SKETCH: not compiled
export class ImportHistoryWriter extends Domain.Projection("ImportHistoryWriter", {
  from: [Import],
  key: Import,
  on: [ImportConfirmed, ImportTakenBack],
  writes: [ImportHistory]
}) {}

export const ImportHistoryWriterLive = ImportHistoryWriter.toLayer(
  Effect.gen(function* () {
    const history = yield* ImportHistory
    return Effect.fn("ImportHistoryWriter")(function* (batch) {
      yield* Effect.forEach(batch, (input) =>
        input.event._tag === "ImportConfirmed"
          ? history.append(input, Confirmed.make({ organizationId: input.event.organizationId, /* ... */ }))
          : history.append(input, TakenBack.make({ organizationId: input.event.organizationId, /* ... */ })),
        { discard: true }   // a projection handler answers void
      )
    })
  })
)
```

What the source fixes:

- `Definition` has `key`, `entries`, and the read contract (`middleware`, `rejects`). Nothing else: no fold, no
  `version`.
- `append(origin, ...events)` takes the projection input (`{ key }` at least) and appends to that input's key. Each
  append is identified by the input's place in the projection's log, so a redelivered or replayed input appends
  nothing twice. Only the projection that lists the stream in `writes` may append; anything else is `ForeignAppend`.
- The model refuses a stream written by two projections (`TwoWriters`), a writer keyed differently
  (`WriterKeyMismatch`), and a `writes` entry the model does not list (`UnknownStream`).
- Its Layer, `ImportHistory.toLayer(Effect.succeed(validate))`, is required when it declares `middleware` or
  `rejects`; `validate` sees the key's latest entry (`Entry | null`), not a folded state.

Reads, on the server (`yield* ImportHistory`) and through an Api (the client takes the key's id):

| Read | Options | Answer |
| --- | --- | --- |
| `peek(key, opts)` | `atLeast`, `timeout` (server) | latest `{ event, envelope }` or none (`null` on the client) |
| `watch(key)` | none | the latest entry, then each new one; on the client each as `{ state, cursor }` |
| `events(key, opts)` | `after` (an entry `seq`), `where` | every entry from `after`, then live; the client also gets a `CaughtUp` frame |
| `list(key, opts)` | `where`, `order`, `take`, `after` | `{ entries, cursor }`, cursor a `seq` number or `null` |

`envelope.seq` counts the key's entries; `envelope.stream` is `ImportHistory/<key>`. On the server, `peek` with
`atLeast` retries every 25 ms until the stream's checkpoint for the receipt's stream reaches its version, up to
`timeout` (default 10 seconds), then fails with `ConsistencyTimeout` (`Model.ts` 1018-1029 and 1051-1075). Every
client call also takes `headers`. Through an Api the stream's `get` RPC is named `peek` (`ReadRpcs.ts` 95).

Checked in: `packages/domain/src/Stream.ts` at `v2.0.0-beta.87`: `Entry` lines 20-24, `Definition` 51-64, `Origin`
70-72, `Host` 77-112, `make` 216-256, `toLayer` 279-290; `packages/domain/src/Api.ts` `StreamClient` 187-238 and the
stream read handlers 633-691; `packages/domain/src/ReadRpcs.ts` stream RPCs 88-143; `packages/domain/src/Projection.ts`
`writes` 169-170; `packages/domain/src/DefinitionError.ts` `UnknownStream` 112, `TwoWriters` 122, `WriterKeyMismatch` 133,
`ForeignAppend` 244.

Types and helpers this page has not named yet. `ReadRpcs.ts` is the plumbing that turns a view or a stream into the
Api's read RPCs; it is not exported from the package index (internal).

| Name | What it is | Where (beta.87; main) |
| --- | --- | --- |
| `StreamClass` | The class `Domain.Stream(...)` returns: `streamName`, `definition`, `Validator`, `toLayer` | `Stream.ts` 261-292; same |
| `StreamKey<Name>` | The type-level identity of a stream in an Effect's requirements (`yield* ImportHistory` needs it) | `Stream.ts` 117-119; same |
| `Readable` | A view or a stream: what an Api can expose for reading (internal) | `ReadRpcs.ts` 31; 32 |
| `nameOf` | The name of a view, a stream, or an aggregate (internal) | `ReadRpcs.ts` 34-39; 35-40 |
| `outputEvents` | The events a view emits: its `events`, or every event it applies from its sources (internal) | `ReadRpcs.ts` 45-60; 46-61 |
| `contractOf` | A view's or stream's read contract (`middleware`, `rejects`) (internal) | `ReadRpcs.ts` 73; 74 |
| `readRpcs` | Builds, once per entry, the RPCs of a view (`get`, `watch`, `events`, `list`, `snapshot`) or a stream (`peek`, `watch`, `events`, `list`), guarded by its middleware; a read that takes `atLeast` may also fail with `ConsistencyTimeout` (internal) | `ReadRpcs.ts` 78-222; 79-216 |
| `CallName<Client>` | The type of one call's name on an Api client: a command's tag, a query's name, or `<Name>.<operation>` such as `ImportHistory.peek` | `ReadRpcs.ts` 285-290; 279-284 |
| `isMethod` | Whether an Api operation is a command's `send` or a query's `ask`, called as a method of its own (internal) | `ReadRpcs.ts` 312-313; 306-307 |
| `callName` | The `CallName` of an operation, the string the HTTP, CLI and AI surfaces expose it by (internal) | `ReadRpcs.ts` 316-317; 310-311 |

### What main changes

- `Stream.ts` itself is unchanged.
- `list` takes `atLeast` and can fail with `ConsistencyTimeout` (`packages/domain/src/ReadRpcs.ts` 129 and 139, and
  `packages/domain/src/Api.ts` `StreamClient.list` 243-259 on main). On beta.87 only `peek` waits.
- `atLeast` on `peek` and `list` accepts a list of receipts (`Query.AtLeastJson`), and the wait goes through the
  writer projection's own progress, so a writer that reads a view can be waited on with the aggregate's receipt
  (`Model.ts` `caughtUpOf` 927-939 and `projectionProgress` 1797-1801 on main; commit `ca7535707`, #3380). The client doc says a read left without
  `atLeast` waits for the commands that client sent; the code does not (see
  [Reads and consistency](./reads-and-consistency.md)).
- `peek` and `list` are judged before they wait (`judgedRead`, `Api.ts` 785-844), `events` judges its `CaughtUp`
  frame, and `watch` is judged before its resume cursor is consulted (`packages/domain/src/Watch.ts` `streamPush`
  231-285): commit `794557619` (#3414). See [Views as security boundaries](./view-security.md).

## Rules, and the mistakes to avoid

- One writer per stream. If two sources must feed one log, make one projection read both.
- The writer's `key` must be the stream's `key`. To keep a log per organization, key both by a branded
  `OrganizationId` Schema and route with the projection's `keyOf`, whose function receives the routing record
  (`({ event }) => event.organizationId`), as a view's does.
- Pass the projection's own input to `append`. That is what makes it exactly once; appending from anywhere else fails.
- `peek`'s `atLeast` covers only sources the writer consumes directly. A writer that reads `ImportResult` (a view)
  cannot be waited on with an `Import` receipt on beta.87: the wait compares the stream key's checkpoint for the
  receipt's stream (`Model.ts` 1059), which a view-fed writer never records, so it waits out the timeout.
- `validate` judges the latest entry, so put the owner (`organizationId`) in every entry type.
- `where` filters entries in memory, after they are read; it is not an index.
- There is no `version` on a stream. The writer projection's Layer has one (`Projection.ts` 52-58: bump it to run the
  projection again over the whole history); whether a stream's appends from that second run are dropped as repeats
  or added again is not verified. A changed entry shape is safest as a new stream.

## In this app

Two logs:

- **An import's history.** `ImportHistory`, keyed by `Import`: one `Confirmed` per confirm and one `TakenBack` per
  take-back, each with who and the counts. The Result step's "taken back" banner reads `peek`; a past import's page
  lists the lines.
- **The organization's activity trail.** `OrgActivity`, keyed by a branded `OrganizationId` Schema, entries
  `ActivityLine` (who, what, when, the agent if one acted). One projection, `OrgActivityWriter`, reads `Import`, `Item`
  and the membership aggregate, keyed by `OrganizationId` with `keyOf` returning `event.organizationId`, and appends one
  line per change. `validate` compares `request.key` with the actor's organization.

```typescript
// SKETCH: not compiled
const lines = yield* client.OrgActivity.list(actor.organizationId, { order: "desc", take: 50 })
```

Nothing here was run: the trials on 2026-11-19 ran no stream and no projection.

- **Used today:** no. The `activity` table is appended inside each write's own D1 batch (the audit line in
  `packages/catalog/host/src/ImportStore.adapter.ts` `commit` and `takeBack`), and read by
  `packages/access/contract/src/Access.contract.ts` `activity.recent`.
- **Where it goes:** `packages/catalog/model/src/Import/ImportHistory.stream.ts` and
  `packages/access/model/src/Activity/OrgActivity.stream.ts`, with their writers; read by
  `apps/inventory/src/web/pages/ActivityPage.tsx` and `packages/catalog/web/src/ResultStep.screen.tsx`.
- **What the person gets:** the Activity page can follow new lines live instead of loading once.

## How to check it

- `Story.streamed(ImportHistory, imp1, Confirmed.make({ ... }))` after the `when` that confirms: the entries appended
  since the last check; with no events, nothing new was appended (`packages/domain/src/Story.ts` lines 452-465 at
  beta.87). A story reads the stream's store and never runs `validate`; test a refused read through the Api's
  `clientInProcess`.
- A second delivery of the same input appends nothing: replay a story's events and assert `streamed` with no events.
- The model fails to build with `TwoWriters`, `WriterKeyMismatch` or `UnknownStream` for a wrong writer.

## What it needs

Any host. On Durable Objects, `watch` and `events` over `Domain.protocolWebSocket` are WebSockets to the object that
owns the key, which pushes each entry as it is appended. beta.87 for everything above; `list` with `atLeast`, a
view-fed writer waited on with a receipt, and the closed read-security gaps need main.

## Verdict

**Use:** declare `ImportHistory` and `OrgActivity`, each with one writer projection, and read them through the Api; keep
the D1 `activity` table until the trail is backfilled from the events. Take main (commit `794557619`) before an
organization's trail is served to members of other organizations: on beta.87 a refused `events` read can learn whether
a key has entries.

## Where this was read

- https://alchemy.run/domain/stream (the live site documents beta.87)
- `website/src/content/docs/domain/stream.mdx` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: same
- `packages/domain/src/Stream.ts` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: same
- `packages/domain/src/ReadRpcs.ts` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: changed
- `packages/domain/src/Api.ts`, `Model.ts`, `Watch.ts` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: changed
- `packages/domain/skills/alchemy-domain/references/building-blocks.md` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: same
  (Stream section)
