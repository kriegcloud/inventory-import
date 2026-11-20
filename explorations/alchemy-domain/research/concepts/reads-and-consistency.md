---
type: Reference
title: Reads and consistency
description: How a read waits for a command it follows (atLeast and the receipt, timeouts, strong commands), how filters and live reads work, and how reads travel; this app would use it so the Result step shows a confirm's counts.
tags: [alchemy-domain, read, consistency]
---

# Reads and consistency

Views, streams and projections are updated after a command commits, so a read can be a moment behind. A command's
receipt, `{ stream, version }`, names the write; a read passed that receipt as `atLeast` waits until the read model has
applied it, polling every 25 ms, and fails with `ConsistencyTimeout` after 10 seconds. On main a command can do the
waiting itself with `consistency: "strong"`. The docs say a view "is always correct, but it can be a moment behind"
[https://alchemy.run/domain/view]. Around that sit the read options every [view](./view.md) and [stream](./stream.md)
share: `where` filters, live reads that push over WebSockets, and the RPCs an [Api](./api.md) serves.

## When to reach for it

- A screen that shows the effect of the command it just sent: the Result step after Confirm, the Items page after a
  take-back.
- A screen that follows a key live and must know when it is current (`CaughtUp`) or resume after a dropped connection.
- A narrow read of one key (only taken-back lines, only states over a threshold) without a new view.

## How it is declared

```typescript
// SKETCH: not compiled (beta.87 call shapes)
const receipt = yield* client.ConfirmImport(importId, { revision })        // { reply, stream, version }
const result = yield* client.ImportResult.get(importId, { atLeast: receipt })
const page = yield* client.PastImports({}, { atLeast: receipt })            // a query: one receipt or a list
const { state, cursor } = yield* client.ImportResult.snapshot(importId, { atLeast: receipt })
yield* client.ImportHistory.events(importId, { after: cursor, where: { _tag: "TakenBack" } }).pipe(
  Stream.runForEach((frame) => (Domain.Read.isCaughtUp(frame) ? markLive(frame.cursor) : addLine(frame)))
)
```

**`atLeast` and the receipt.** A command answers `{ reply, stream, version }` (`packages/domain/src/Api.ts` 591-600).
`atLeast` takes that `{ stream, version }`. Where it is accepted at beta.87:

| Read | `atLeast` | What it waits for |
| --- | --- | --- |
| view `get`, `snapshot`, `list` | one receipt | the key's checkpoint for `stream` reaches `version` |
| stream `peek` | one receipt | the stream's writer has handled the commit (sources it reads directly only) |
| stream `list`, `watch`, `events`; view `watch`, `events` | no | |
| query | one receipt or a list | every receipt, through every read in `waitsFor`, before the handler |

On beta.87 the view wait compares the key's stored `checkpoints[stream]` with `version`
(`packages/domain/src/Model.ts` 889-921). A key that never receives events from that stream, or a view fed by a view,
has no checkpoint for it, so the read waits out the timeout. A query finds its keys by routing the command's own
events through each waited read (`packages/domain/docs/query-design.md`, "Read-your-writes"): a receipt from an
aggregate no waited read consumes waits for nothing, and a version past the instance's is clamped (`Model.ts`
1137-1138).

**Timeouts and errors.**

- `ConsistencyTimeout` is a `Schema.TaggedError` with `view` (the view, stream or projection), `key`, `stream` and
  `version`. It travels typed: every read RPC that takes `atLeast` lists it in its errors, and a query lists it when it
  has `waitsFor`.
- The server-side `Host.get`, `snapshot` and `peek` take a `timeout`; the Api client has no timeout option, so a read
  through an Api always waits the default (`query-design.md` lists a client `timeout` as a follow-up).
- Every timing constant of reads, from source:

| What | Value | beta.87 | main@dbfd0ddb |
| --- | --- | --- | --- |
| View `get`/`snapshot` with `atLeast` on the server `Host`: pause between tries | 25 ms (`Schedule.spaced`) | `Model.ts` 907 | `Model.ts` 1212 |
| The same: default timeout | 10 seconds, as `ceil(timeout / 25)` tries | `Model.ts` 909 | `Model.ts` 1214 |
| `waitUntil` (stream `peek`, projection and query waits; on main also strong commands): pause | 25 ms | `Model.ts` 1025 | `WAIT_PAUSE`, `Model.ts` 1328, on the real clock unless the platform paces it (`RunWait`, 1344-1348) |
| `waitUntil`: default timeout | 10 seconds | `Model.ts` 1026 | `Model.ts` 1350 |
| Main's `follow` (every wait through views for one receipt): one deadline shared by all its waits | 10 seconds | none | `Model.ts` 1537-1539 |
| A strong command's wait for its views | the 10-second default (no timeout is passed) | none | `Api.ts` 737, `Model.ts` 1767-1770 |
| Live read over `protocolWebSocket`: reconnects in a row before it fails with `RpcClientError` | 8 (`RECONNECTS`) | `Api.ts` 1305, 1389 | `Api.ts` 1498, 1582 |
| The pause before reconnect number `n` | `min(5000, 100 * 2^n)` ms | `Api.ts` 1397 | `Api.ts` 1590 |
| The reconnect count resets | on every frame received | `Api.ts` 1374 | `Api.ts` 1567 |
- `WaitTimeout` (`view`, `key`) is a plain `Data.TaggedError`, raised only by the server-side
  `Host.waitFor(key, where, { timeout })`, which waits until a key's state matches a filter. It is not on the wire.

**"Caught up" means three things.**

- `Read.CaughtUp` is the frame an `events` read sends after the key's history (`{ _tag: "CaughtUp", cursor }`), and
  again after a reconnect. `Domain.Read.isCaughtUp` and `Domain.Read.isEvent` tell frames apart.
- A projection's or view's progress "caught up" to a receipt is what `atLeast` waits for (`Query.CaughtUp`,
  `Projection.Progress.caughtUp` in the design doc).
- `CatchUp.ts` is internal routing: each source instance keeps a cursor per consumer (`view:Name`,
  `projection:Name`, with `#<generation>` after a rebuild, `@<generation>` after a rebuild in place). A consumer
  behind the instance's version is lagging: live deliveries skip it and a backfill replays the history to it. Policies
  are never caught up; they act on new events only. A view shows this to a screen as `Host.history`, `{ complete }`.
  Its exports, all internal (`CatchUp.ts` is the same on main): `targetId` (the consumer's id, 22-28), `routeLive`
  (routes a commit's deliveries: drops those to lagging consumers and advances the live ones' cursors from `before`
  to `after`; an instance with no cursors yet takes every consumer as caught up, 36-53), `Routed` (the cursors,
  14), `ReplayInput` (what a replay needs: the instance id, its cursors and its stored rows in order, 56-61) and
  `ReplayResult` (the deliveries to lagging consumers, marked `history`, and the new cursors, 64-68).

**`where` filters** (`packages/domain/src/Filter.ts`). A `Filter<T>` is Prisma-style data: per field a bare value
(equality) or operators chosen by the field's type: `equals`, `not` (with `null` for "present"), `in`, `notIn`, `lt`,
`lte`, `gt`, `gte`; for strings also `contains`, `startsWith`, `endsWith` (case-sensitive, plain JavaScript string
tests); for arrays `some`, `every`, `none`, `has`, `isEmpty`, `length`; nested objects take a nested filter. Sibling
keys are AND; `AND`, `OR`, `NOT` combine. A `DateTime` compares as epoch milliseconds and an ISO string operand is
parsed. On the wire `where` is decoded with `FilterJson`, so a malformed filter is refused before it runs; then
`matches` evaluates it in memory on rows the platform holds. A view `get`, `snapshot` or `watch` filters the state (a
miss answers `null`); `events` and `list` filter events. `OrderBy` and `sort` are exported but no read takes them.

**Live reads** (`packages/domain/src/Watch.ts`). Over `Domain.protocolWebSocket`, `watch` and `events` are a WebSocket
to the object that owns the key (a Durable Object on Cloudflare). After each commit the platform asks `viewPush` or
`streamPush` what to send: it decodes the change, runs `validate`, applies the filter, and encodes Effect RPC `Chunk`
and `Exit` messages, so a client reads a pushed stream like a streamed response. Each message carries the
subscription's `cursor`; a client that reconnects sends it and receives only what it missed, then `CaughtUp` again. A
refusal is an `Exit` carrying the rejection, after which the read is done. On a platform whose keys live in the
serving process, `serveSocket` does the same in process, closing the socket with 1000 when the read ends and 1011 when
a push fails (`Watch.ts` 254-301); the close codes of the Durable Object path were not checked. The live request travels in
the `read` query parameter, never with headers: it authenticates with what the upgrade request carries (cookies).

**How reads travel** (`packages/domain/src/ReadRpcs.ts`). Each exposed view becomes RPCs `<View>.get`, `.watch`,
`.events`, `.list`, `.snapshot`; each stream `<Stream>.peek`, `.watch`, `.events`, `.list`; a query one RPC named
after it. Keys travel as the key's id string. The declaration's `middleware` wraps each RPC, its `rejects` are the
error union, and reads that take `atLeast` add `ConsistencyTimeout`. `operationsOf` lists every call an Api serves
(`send` for a command, `ask` for a query, the read's own name otherwise); `exposedOf` keeps only the calls named in
`expose`, so nothing reaches HTTP, the CLI or an AI toolkit unless listed. `outsideClient` drops the client half of
every middleware, so a credential the server holds is never sent on a caller's behalf.

Checked in, at `v2.0.0-beta.87`: `packages/domain/src/View.ts` `WaitTimeout` 23-26, `ConsistencyTimeout` 33-41;
`packages/domain/src/Read.ts` `Snapshot` 15-19, `CaughtUp` 26-41; `packages/domain/src/Query.ts` `AtLeast` 23-36;
`packages/domain/src/Model.ts` 889-946 and 1017-1029; `packages/domain/src/Api.ts` read handlers 639-769,
`withCaughtUp` 532-553, `LiveRequest` 786-795, `protocolWebSocket` 1303-1404; `packages/domain/src/ReadRpcs.ts` 27-349;
`packages/domain/src/Watch.ts` 41-301; `packages/domain/src/Filter.ts` 1-315; `packages/domain/src/CatchUp.ts` 1-68.

### What main changes

- **`consistency: "strong"`** (commit `bc0024faf`, #3469). A command option, `"strong" | "eventual"`
  (`Command.Consistency`, `packages/domain/src/Command.ts` line 51 on main), sent on the wire with the command
  (`Command.ts` 75 and 319). Strong answers once every view the command's events reach has applied them, through
  views between, skipping a view whose backfill has not finished (`Model.Internals.applied`,
  `packages/domain/src/Model.ts` 98-110 and `viewsApplied` 1741-1770; the Api's command handler,
  `packages/domain/src/Api.ts` 730-746). It does not wait for projections, so a query still needs `atLeast` and
  `waitsFor`. After the 10-second default it fails with `ConsistencyTimeout`, but the command is committed; resending
  it under the same `commandId` answers with its receipt (`View.ts` 28-37 on main). Every command's errors include
  `ConsistencyTimeout` on main (`Command.ts` 327-328).
- **`Domain.DefaultConsistency`.** A `Context.Reference<"strong" | "eventual">` whose default value is `"eventual"`
  (`Command.ts` 66-69 on main, doc 54-65; exported as `Domain.DefaultConsistency`, `index.ts` 64). The client reads it
  once, when it is built (`Api.ts` 1242-1246), and a call's own `consistency` option wins over it (`Api.ts` 1093-1096).
  Provide `"strong"` to the client's Effect or its Layer to change every command it sends.
- **Receipts gain `commits`**, and commands lose the target argument (`client.ConfirmImport({ importId, ... })`).
- **`atLeast`** takes one receipt or a list on every read that takes it, stream `list` included; a view waits only for
  the commands whose events reach the key read, through any views between (`Api.ts` `waitFor` 680-692, `Model.ts`
  `caughtUp` 92-97; commit `ca7535707`, #3380).
- **Judged before the wait.** A read with `atLeast` runs `validate` first (#2906); `events` judges its `CaughtUp`
  frame (#3060); a reconnecting `watch` is judged before its cursor is used (#2907); all in commit `794557619`
  (#3414). See [Views as security boundaries](./view-security.md).
- **The wait** keeps 25 ms pauses on the real clock, so a test clock nobody advances cannot hold a read forever
  (`Model.ts` `WAIT_PAUSE` 1328 and `waitUntil` 1330-1362 on main).
- **The client does not remember its commands.** Main's doc comments say a read or query with `atLeast` left out
  waits for the commands that client sent, and that `[]` waits for none (`Api.ts` 128-133, 326-336, 1368-1380 on
  main). The code does not do it. The client keeps no receipts: a command call sends `{ commandId, input,
  consistency }` and returns the server's answer (`nest`, `Api.ts` 1091-1097); a read or a query passes its options
  through unchanged (1099-1104, 1134-1150). On the server a read with no receipts gets no wait (`waitFor` 686-687),
  and the `Model.ts` read model keeps nothing per client. So on main, as on beta.87, a read waits only for the
  receipts it is passed. Pass the receipt, or send the command with `consistency: "strong"`.
- **Read replicas** are planned, not built: a key would report an event only once every replica serving reads has it
  (`packages/domain/docs/query-design.md` "Read replicas" on main).

**Measured latency** (`packages/domain/docs/consistency-latency.md` on main, measured 2026-11-17, before any
optimisation). Cloudflare live, the front in Seattle and the objects created near it; times from inside the front, so
the caller's own network is not included; p50 / p90 / p99 / max in ms. **Warm**: the instance has just taken a
command. **Idle**: it and its views were left alone 45 seconds, long enough for Cloudflare to unload them. **New**: the
command is the first the instance has ever taken, so its object and its views' objects do not exist yet.

| Shape | Instance | Eventual | Strong |
| --- | --- | --- | --- |
| No view | warm | 27 / 35 / 47 / 50 | 30 / 38 / 48 / 63 |
| No view | idle | 114 / 396 / 871 / 1012 | 115 / 388 / 870 / 1012 |
| No view | new | 485 / 696 / 2185 / 7009 | 468 / 704 / 988 / 1369 |
| One view | warm | 55 / 78 / 106 / 204 | 89 / 140 / 986 / 1207 |
| One view | idle | 147 / 256 / 743 / 813 | 204 / 407 / 786 / 935 |
| One view | new | 554 / 845 / 1085 / 1806 | 1000 / 1559 / 1929 / 2094 |
| Four views | warm | 63 / 85 / 137 / 168 | 370 / 419 / 576 / 2178 |
| Four views | idle | 190 / 731 / 6388 / 7415 | 818 / 1317 / 1764 / 1926 |
| Four views | new | 492 / 808 / 1477 / 7096 | 1733 / 2287 / 5005 / 9959 |

After an eventual command to a warm instance with one view, a client polling the view saw it after 74 / 121 / 301 /
410 ms; one read of that view from the front took 63 / 83 / 106 / 114 ms. Each further view adds about one delivery
(70 to 90 ms) to a strong command, because the outbox calls views one after another. With the objects a continent away
an eventual command took about 170 ms and a strong one 340 to 780 ms at the median. Rivet and Effect Cluster were
measured only in local Docker (2 to 7 ms eventual, 5 to 40 ms strong). The run did not count failed requests, so a
`ConsistencyTimeout` is missing from these tables. Because of these numbers, a command is eventual unless it asks.

## Rules, and the mistakes to avoid

- Pass `atLeast` only right after your own command. A screen loading, or the next page, leaves it out.
- On beta.87, pass a receipt only to a read that consumes that aggregate directly. A receipt to a key that never
  receives its events, or to a view fed by a view, waits 10 seconds and fails.
- A command a policy or saga sent has no receipt for the client: watch a view instead of waiting.
- After two commands to the same instance, the later receipt is enough; after commands to two instances, a query takes
  both (a view read on beta.87 takes one).
- Treat `ConsistencyTimeout` as "behind", not "failed": the write is committed. Show that, and retry the read; never
  send the command again without its `commandId`.
- `where` is no index and no permission: it narrows rows already read, and `validate` never sees it.
- Strong commands cost a second call per view key, and the cost grows with the number of views reached. Use them where
  a read follows at once and a receipt cannot be passed (a page that reloads), not by default.

## In this app

Today the confirm is one D1 batch that writes the items, the outcomes and the counts, and answers with the import as
stored; the Result step renders that answer at once (`packages/catalog/web/src/ReviewStep.screen.tsx` 248-263), and
while the request runs the Confirm button is disabled with a spinner (`importing={commit.isPending}`, line 391;
`packages/review/src/ReviewRegion.component.tsx` 1099-1128).

With Domain on beta.87, `ConfirmImport` answers as soon as its events commit. The Result step then reads
`ImportResult.get(importId, { atLeast: receipt })` (or `snapshot` with `atLeast`, then follows `ImportHistory.events`
from the cursor). What the person sees:

1. While both run, the Confirm button keeps its spinner ("Importing"); the screen does not move to Result on the
   command's answer alone.
2. When the read answers, the Result step opens with counts the view has applied, so the three numbers (rows in the
   file, what the result says, what is stored) agree.
3. If the read fails with `ConsistencyTimeout`, the import is saved: the Result step opens with its skeleton and the
   sentence "Your import is saved. The counts are still being added up.", and reads again without `atLeast` (or
   watches the view) until the status is `imported`. Confirm is never offered again for that import.

By the measurements, a confirm comes after minutes of review, so the `Import` instance is usually idle, not warm. With
one view on Cloudflare, the eventual command alone took 147 ms at the median and 743 ms at p99 on an idle instance;
the read with `atLeast` comes after it (on a warm instance a client polling the view saw the change 74 ms after the answer, and
one read took 63 ms). The whole confirm-then-read on an idle instance was not measured. A strong command to an idle
instance with one view took 204 ms at the median and 786 ms at p99, and needs no receipt afterwards. The Items
page after a confirm would pass the same receipt to `ItemsPage` only if a projection writes the `item` table and is in
its `waitsFor` (see [Query](./query.md)).

- **Used today:** no. Strong consistency comes from writing and reading back in one D1 batch
  (`packages/catalog/host/src/ImportStore.adapter.ts`, `commit`).
- **Where it goes:** the confirm mutation in `packages/catalog/web/src/ReviewStep.screen.tsx` and the read in
  `packages/catalog/web/src/ResultStep.screen.tsx`.
- **What the person gets:** the same Result step as today, a moment later; a plain sentence instead of an error when the
  counts lag.

## How to check it

- Through the Api's `clientInProcess`: send `ConfirmImport`, then `ImportResult.get` with `atLeast`, and assert the
  counts; then ask with a receipt of an aggregate the view does not read and assert `ConsistencyTimeout` (beta.87) or
  an immediate answer (main).
- A story needs no `atLeast`: every `when` runs projections and views until the model settles.
- For live reads: `events` on a key, assert one `CaughtUp` after the history; drop and resume with the cursor, assert
  nothing repeats.
- Not verified on any host: the latency of a real confirm with this app's views. The trials on 2026-11-19 ran no view,
  no read with `atLeast` and no strong command.

## What it needs

Any host for `atLeast`, filters and live reads (in memory, Durable Objects, Rivet, Effect Cluster); WebSocket pushes
need `Domain.protocolWebSocket`. `consistency: "strong"`, `DefaultConsistency`, lists of receipts on view reads and the
security fixes need main, which is not published.

## Verdict

**Use:** on beta.87, read the Result step with the confirm's receipt as `atLeast` and handle `ConsistencyTimeout` as
"saved, still counting". When the app takes `main@dbfd0ddb` (commit `bc0024faf`, not on npm, with commands that have
no `target`), send the confirm with `consistency: "strong"` (or provide `Domain.DefaultConsistency` as `"strong"` to
the Result step's client) if a reload should see the result without a receipt. On either ref, pass the receipt
explicitly: main's client does not remember it, whatever its doc says.

## Where this was read

- https://alchemy.run/domain/view and https://alchemy.run/domain/query (the live site documents beta.87)
- `packages/domain/src/Read.ts`, `Filter.ts`, `CatchUp.ts` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: same
- `packages/domain/src/ReadRpcs.ts`, `Watch.ts`, `Query.ts`, `View.ts`, `Api.ts`, `Model.ts` at `v2.0.0-beta.87`; on
  `main@dbfd0ddb`: changed
- `packages/domain/src/Command.ts` on `main@dbfd0ddb`: changed (`Consistency`, `DefaultConsistency`)
- `packages/domain/docs/query-design.md` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: changed
- `packages/domain/docs/consistency-latency.md` on `main@dbfd0ddb`: new
- `packages/domain/src/index.ts` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: changed (`DefaultConsistency`)
