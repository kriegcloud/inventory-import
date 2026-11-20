---
type: Reference
title: Foldkit adapter and other clients
description: The optional `@alchemy.run/domain/Foldkit` adapter that turns a Domain Api into Foldkit Commands and Subscriptions, and what a client that is not Foldkit (this app's React screens on Effect atoms) uses instead.
tags: [alchemy-domain, people-and-clients]
---

# Foldkit adapter and other clients

Foldkit is an Elm-style front end on Effect: a Model changed only by Messages in `update`, Commands for side
effects, Subscriptions for live data. The adapter derives, from one Domain [Api](./api.md), a Foldkit Command per
Api command and per query, and a read namespace per View and Stream whose `watch` and `events` are ready-made
Subscription entries; it classifies every failure as `Rejected`, `Denied` or `Unknown`. The docs: "The optional
`@alchemy.run/domain/Foldkit` adapter connects these parts to a Domain Api." [https://alchemy.run/domain/foldkit]
A client that is not Foldkit uses what the adapter itself sits on: the Api's typed client over a protocol Layer,
whose commands and queries are Effects and whose live reads are Streams.

## When to reach for it

- A new screen written in Foldkit against a Domain Api: the adapter removes all hand-written request code.
- Not for this app's React screens: they use the Api's typed client directly, wrapped in Effect atoms.
- A screen that is read-only and live (a status page) is the cheapest place to try Foldkit beside React.

## How it is declared

```typescript
// SKETCH: not compiled
import * as DomainFoldkit from "@alchemy.run/domain/Foldkit"

export const Inventory = DomainFoldkit.make(InventoryApi) // InventoryApi: a Domain.Api; no entry may be named Message

// A command (beta.87): { target, input, commandId }; its result is a Message tagged
// "SucceededSaveDecisions" or "FailedSaveDecisions" (the case name is `Succeeded` or `Failed` joined to the tag).
const allocation = DomainFoldkit.next(model.commandIds) // { commandId: "<session>:<sent>", commandIds: next state }
const save = Inventory.SaveDecisions({ target: model.importKey, input: { set }, commandId: allocation.commandId })

// A live read as a Subscription entry: key change restarts it, cursor change does not.
const allowance = Inventory.AllowanceToday.watch({
  key: (model: Model) => model.organizationId,
  isEnabled: (model) => model.online,
  toMessage: (snapshot) => Message.GotAllowance(snapshot), // { state: Option<State>, cursor: number }
  onFailure: (error) => Message.FailedAllowance({ reason: error._tag }),
  onDefect: () => Message.FailedAllowance({ reason: "Read defect" })
})
```

What the adapter exports and does:

- `CommandHeaders`: a service whose `get(name)` returns headers for one command or query at execution time (an MFA
  code, never stored in args or Messages). Optional; absent means no extra headers.
- `CommandIds` (`{ session, sent }`) and `next(ids)`: a command id `"<session>:<sent>"` and the next state, with no
  clock read.
- `make(api)`: one Command per Api command (args `target`, `input`, `commandId` at beta.87); one Command per Api
  query (args `input`, `requestId`, `atLeast?`, `after?`, `take?`); for each View and Stream a namespace with
  `watch` and `events`; for each View also `SnapshotFlags` and `decodeSnapshotFlags`, to seed the first paint from
  server-rendered Flags; and `Message`, the union of every `Succeeded${Name}` and `Failed${Name}` case (for example
  `SucceededConfirmImport`). The signature refuses an Api with an entry named `Message`.
- Command success carries `commandId`, `reply` and `receipt: { stream, version }`. A failure is `Rejected` when the
  error matches one of the command's `rejects`, `Denied` when it matches a middleware's error, otherwise `Unknown`;
  a defect is `Unknown` too. Queries add `TimedOut` (a `View.ConsistencyTimeout`, only for a query with `waitsFor`).
- `watch`: stops (empty stream) while `isEnabled` is false; dependencies are the key and `isEnabled` only; absent
  state becomes `Option.none()`; a typed read failure calls `onFailure`, a defect `onDefect`, interruption nothing.
- `events`: resumes after the Model's cursor (`after`), does not restart on a cursor change (`keepAliveEquivalence`
  compares key, `isEnabled`, `restartKey`), drops entries at or below the larger of the delivered and the applied
  cursor, and maps the `CaughtUp` frame to `onCaughtUp(cursor)`. It does not count gaps and does not fold entries.
- `SnapshotFlags`: `{ state: OptionFromNullOr(state), cursor: non-negative integer }`.
- Install: `foldkit` is an optional peer dependency; the subpath resolves through the package's `"./*"` export.
  The docs target Foldkit `^0.169.0`.

Checked in: `packages/domain/src/Foldkit.ts:23-28` (`CommandHeaders`), `:31-39` (`CommandIds`, `next`), `:47-69`
(`Failure`, `QueryFailure`), `:146-249` (command definitions and classification), `:252-324` (queries), `:351-374`
(`ReadClientOf`, `ClientOf`), `:377-412` (`make`), `:417-472` (`Snapshot`, `WatchOptions`, `watch`), `:475-603`
(`EventsOptions`, `events`), `:606-610` (`snapshotFlags`); `packages/domain/package.json:34,60-64,94,112-114`;
`website/src/content/docs/domain/foldkit.mdx:8`; all at `v2.0.0-beta.87`.

| Name | What it is | Where (beta.87) |
| --- | --- | --- |
| `CommandHeaders` | Service: per-call headers resolved when the Command runs | `Foldkit.ts:23-28` |
| `CommandIds`, `next` | Schema `{ session, sent }`; allocate `"<session>:<sent>"` and the next state | `Foldkit.ts:31-39` |
| `Failure<C>`, `QueryFailure<Q>` | A command's `Rejected`, `Denied` or `Unknown`; a query's, plus `TimedOut` when it waits | `Foldkit.ts:47-69` |
| `make`, `ClientOf<A>` | Build the Commands and read namespaces; their type | `Foldkit.ts:366-412` |
| `ReadClientOf<A, V>` | One read namespace: `watch` and `events` | `Foldkit.ts:351-363` |
| `Snapshot<State>`, `WatchOptions` | A watch value with `Option` state and cursor; the watch callbacks | `Foldkit.ts:417-430` |
| `EventsOptions` | The callbacks of a resumable event feed | `Foldkit.ts:475-485` |

### What main changes

- Commands lose `target`: args are `{ input, commandId }` (the id is in `input`), and the send goes through an
  internal `sendPayload` (`packages/domain/src/Foldkit.ts:14,100-103,200-226` on main).
- A command's success also carries `commits`, one receipt per stream it committed to (more than one for a command a
  [decision](./decision.md) implements); `receipt` stays the first (`Foldkit.ts:84-92,157-161` on main).
- The workspace catalog pins `foldkit: "^0.170.0"` (`pnpm-workspace.yaml:189` on main) while `foldkit.mdx` on main
  still says `^0.169.0`.
- Main adds Foldkit hosting examples (`examples/cloudflare-foldkit-{spa,ssr,ssg,hybrid}`, and Foldkit websites for
  other hosts); none of them uses the Domain adapter (not read beyond their entry files).

## Rules, and the mistakes to avoid

- Give each page load a fresh `session` in Flags; never reuse one from cached HTML, or two pages produce the same
  command ids.
- Never turn `Unknown` into a refusal: the write may have committed. Retry with the same `commandId`.
- Keep the in-flight `requestId` of a query in the Model and drop a reply with another id; ask `TimedOut` and
  `Unknown` again with a new id.
- Use `watch` for state and `events` for confirming intents; a View can change state without an output event.
- Keep a snapshot's Flags field as unknown data and decode it in `init`, so a stale state schema falls back to an
  empty state instead of stopping the boot.
- Serve the app and the Api from one origin: live reads authenticate by cookie (see [sessions](./sessions.md)).

### A client that is not Foldkit

What the adapter sits on is open to any Effect program:

- `MyApi.layerClient` needs an `RpcClient.Protocol`: `Domain.protocolHttp(url)` (NDJSON; live reads are streamed
  responses the platform feeds by polling), `Domain.protocolWebSocket(url)` (calls over HTTP; each `watch` and
  `events` on its own WebSocket, pushed, reconnecting and resuming after the last value), or `protocolInProcess` /
  `layerClientInProcess` for tests. `layerClientHttp(url)` and `layerClientWebSocket(url)` combine the two.
- `MyApi.Client` is a `Context.Service` whose value has, per command, `(target, input, { commandId, headers })`
  returning `{ reply, stream, version }`; per query, `(input, { atLeast, after, take, headers })` (a paged query also
  has `pages` and `entries` streams); per View, `get`, `watch`, `events`, `list`, `snapshot`; per Stream, `peek`,
  `watch`, `events`, `list`.
- In this app's atoms, a command is an `apiRuntime.fn`, a one-shot read an `apiRuntime.atom(effect)`, and a live
  read an `apiRuntime.atom(stream)` (latest value) or `apiRuntime.pull(stream)` (accumulating): all three exist on
  `Atom.AtomRuntime` in Effect 4.1.4. `makeApiAtoms(tag)` already takes any `Context.Key<Id, Client>`, so
  `makeApiAtoms(InventoryApi.Client)` fits its `query` and `write` (not compiled); it has no live-read helper today.
- `predict` runs in the same runtime (see [local-first](./local-first.md)).

Can the Api's RPC group feed Effect's `AtomRpc`? From source, yes, untyped. `AtomRpc.Service<Self>()(id, { group,
protocol })` takes any `RpcGroup.RpcGroup<Rpcs>` and a protocol Layer, builds `RpcClient.make(group, { flatten: true
})` in its own atom runtime, turns a stream RPC into a pull atom and a plain one into an `AsyncResult` atom, and adds
the middleware errors to the error schema (`packages/effect/src/reactivity/AtomRpc.ts:146-204`, `:229-266`,
`:305-310` at effect@4.1.4). A Domain Api exposes `group: RpcGroup.RpcGroup<Rpc.Any>` (`packages/domain/src/Api.ts:388`
at beta.87, `:421` on main), its protocols are `Layer<RpcClient.Protocol, …>` (`Api.ts:1272-1275` `protocolHttp`,
`:1331-1333` `protocolWebSocket`), and the Api's own client is the same `RpcClient.make(group)` re-nested
(`Api.ts:1065-1067`, `nest` at `:912`). The WebSocket protocol routes a request by its tag (`isLiveRead` at `:1302`,
used at `:1408`: `<Name>.watch` and `<Name>.events` go to a WebSocket), so it serves `AtomRpc`'s calls the same way.
What is lost: `Rpcs` is inferred as `Rpc.Any`, so tags, payloads and results are unchecked; payloads are the raw RPC shapes (a command is
`{ target, commandId?, input }`, `Command.ts:249-254`; reads `ReadRpcs.ts:107,115`), not the client's arguments; and a
`watch` becomes a pull atom that accumulates every snapshot, where a screen wants the latest one. Not compiled.
Wrap the typed `Client` in the app's own atoms instead.

## In this app

The front end is React 19 with Effect atoms (`effect/reactivity/Atom`, `@effect/atom-react` 4.1.4): one
`apiRuntime` for every web package, `makeApiAtoms(tag)` for per-member reads and retried writes
(`packages/client/src/Api.atoms.ts`), and optimistic writes as atoms (`packages/client/src/Optimistic.atoms.ts`).
Foldkit does not fit inside that without a second runtime model, so it would be tried only on a screen that stands
alone. The smallest one: an operator's status page, "Model calls today", read-only, showing whether a model is on
and how many of the 40 daily calls the organization has left, live.

```typescript
// SKETCH: not compiled
// packages/access/web/src/status/Status.ts: a Foldkit app on its own HTML entry, beside the React app.
export const Access = DomainFoldkit.make(AccessApi)

export const Model = S.Struct({ organizationId: OrganizationId, left: S.Option(S.Int), online: S.Boolean })

export const subscriptions = Subscription.make<Model, Message, typeof AccessApi.Client.Identifier>()(() => ({
  allowance: Access.AllowanceToday.watch({
    key: (model: Model) => model.organizationId,
    isEnabled: (model) => model.online,
    toMessage: ({ state }) => Message.GotAllowance({ left: O.map(state, (today) => 40 - today.used) }),
    onFailure: (error) => Message.Failed({ reason: error._tag }),
    onDefect: () => Message.Failed({ reason: "Read defect" })
  })
}))
```

- **Used today:** no. React screens on Effect atoms over the HttpApi client (`packages/client/src/Api.atoms.ts`).
- **Where it goes:** a separate Vite page (for example `apps/inventory/status.html` with its own entry) so React and
  Foldkit never share a DOM tree; the allowance becomes a View over the `modelCall` table's events in the access
  context (`packages/access/model`), served by an `AccessApi`.
- **What the person gets:** an admin sees the day's model calls go down live, without a refresh.

## How to check it

- Foldkit stories (`foldkit/story`) for `update`, as the example's `packages/web/test/Bank.test.ts` does: a snapshot
  message sets the count; a failure message shows the reason; going offline stops the watch.
- An in-process test: `AccessApi.layerClientInProcess` over `Domain.InMemory` with the middleware layers provided
  (as the example's `packages/web/test/Domain.ts` does), run the `watch` Subscription's stream and check that a call
  taken from the allowance moves the count.
- For the atom path: a test with a fresh `AtomRegistry` that the live-read atom over `Client.watch` updates when a
  command commits.

## What it needs

A Domain Api (none exists in this app), a host that serves live reads (Durable Objects on Cloudflare, in memory for
tests), the `foldkit` package (not a dependency of the app today) and `@foldkit/vite-plugin` for the build. Whether
`@foldkit/vite-plugin` and `@vitejs/plugin-react` work in one Vite build, and whether Foldkit can mount inside an
element React owns, are not verified (Foldkit's source was not read; the example mounts it on its own `#root`,
`examples/cloudflare-domain/packages/web/src/entry.ts:89`).

## Verdict

**Use:** keep every React screen on the app's atoms and give them a `Domain.Api`'s typed `Client` inside the existing
`apiRuntime`: commands through `apiRuntime.fn`, one-shot reads through `makeApiAtoms(InventoryApi.Client)`, live
reads as `apiRuntime.atom` over `Client.watch` (a small live-read helper beside `makeApiAtoms`). Once the app has its
first `Domain.Api` (`DomainFoldkit.make` takes one, `Foldkit.ts:377-380`), try `@alchemy.run/domain/Foldkit` itself on
one small screen: the read-only "Model calls today" status page, on its own HTML entry. The adapter is published in
beta.87; nobody has run it against this app.

## Where this was read

- https://alchemy.run/domain/foldkit (the live site documents beta.87)
- `website/src/content/docs/domain/foldkit.mdx` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: changed (no `target`)
- `packages/domain/src/Foldkit.ts` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: changed (no `target`, `commits`)
- `packages/domain/src/Api.ts` (client types, protocols, `group`) at `v2.0.0-beta.87`; on `main@dbfd0ddb`: `group` same
- `examples/cloudflare-domain/packages/web/src/{Bank.ts,entry.ts,worker.ts}` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: `Bank.ts` changed
- `packages/domain/skills/alchemy-domain/references/frontend.md` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: changed
- `packages/effect/src/reactivity/AtomRpc.ts`, `packages/effect/src/reactivity/Atom.ts` at effect@4.1.4
