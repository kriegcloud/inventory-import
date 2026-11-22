---
type: Reference
title: Command
description: A typed request to change one aggregate instance, with its input, the events it may record, the rejections it may return, its middleware and its reply; the app's confirm, take-back and item edit would each be one.
tags: [alchemy-domain, declaration]
---

# Command

A command is a request someone makes of the model, named as an instruction (`ConfirmImport`, `EditItem`). It is also a
contract: its declaration lists the data it carries, every event it may record, every refusal it may return, the
middleware that guards it, and the reply its caller gets. The aggregate that handles it may only answer with what the
command declares; anything else is a definition error at run time. On beta.87 the command also names the id schema of
the instance it is for (`target`); on main that id moves into the input and the aggregate says which field it is. The
docs put it plainly: "A command asks one aggregate instance for a change."
[https://alchemy.run/domain/command]

## When to reach for it

- Every write a person or a policy asks for: stage an import, settle a row, confirm, take back, reopen, remove, edit
  an item at a revision.
- When the refusal matters to the caller as a typed value (`StaleReview`, `NotOpen`), not a 500.
- When a retry must not apply twice: an accepted command sent again with the same `commandId` returns its first
  receipt.
- Not for reads. Reads are a [view](./view.md), [stream](./stream.md) or [query](./query.md).
- Not for a change that spans two instances in one step: on beta.87 that is a [saga](./saga.md) or a
  [policy](./policy.md); on main it can be a [decision](./decision.md).

## How it is declared

`Domain.Command(tag, options, annotations?)` returns a class to extend. The instance is the input fields plus `_tag`.

```ts
// SKETCH: not compiled (beta.87 shape)
class ConfirmImport extends Domain.Command(
  "ConfirmImport",
  {
    target: ImportId, // the id schema of the aggregate that lists it (beta.87 only)
    middleware: [Session], // RpcMiddleware services, guarding it when an Api exposes it
    input: { reviewedAt: S.Int }, // the fields the caller provides
    events: [ImportConfirmed], // every event it may record
    rejects: [NotOpen, StaleReview], // every refusal: any tagged error class
    reply: { ready: S.Int } // optional; computed after the commit
  },
  { description: "Write the ready rows as items, if the review the person saw is still the latest." }
) {}
```

Every option field, and what the class carries back:

| Option | Required | What it is | Class static |
| --- | --- | --- | --- |
| `target` | yes (beta.87) | A string schema (`Schema.Top` with string `Type` and `Encoded`), the aggregate's id | `target` |
| `input` | no, default `{}` | `Schema.Struct` fields. With no fields the wire schema is an empty record, not `Struct({})` | `fields` (from `Schema.Class`) |
| `middleware` | no, default `[]` | A list of `RpcMiddleware` services; what they provide is what `decide` may read | `middleware` |
| `events` | no, default `[]` | Event classes it may record | `events` |
| `rejects` | no, default `[]` | Any tagged error schema classes | `rejects` |
| `reply` | no | Fields of the reply; stored as `Schema.Struct(reply)` | `reply` (`undefined` without one) |
| third argument | no, default `{}` | `Domain.Annotations` (`description`, `httpApiCacheControl`, your own keys) | `annotations` |

The class also has `kind: "Command"`, `tag` (the name) and `rpc`, the command as an Effect RPC with its middleware
applied. The RPC's payload is `{ target, commandId?: string, input }`; its success is `{ reply, stream, version }`
(`reply` is `Schema.Void` when none is declared); its error is the union of `rejects`, or `Schema.Never` when there are
none.

Command annotations are only `Domain.Annotations`, not Schema annotations: unlike an event or a rejection, the third
argument does not reach the command's own schema (`build` passes only the tag and fields to `Schema.TaggedClass`).

**Middleware order, as a fact.** For `middleware: [A, B]`, on beta.87 `B` runs first; on main `A` runs first.
Effect 4.1.4's `Rpc.middleware(m)` appends `m` to the RPC's set of middleware (`rpc/Rpc.ts` lines 893-901), and the
RPC server wraps the handler once per entry in that order, `handler = middleware(handler)` (`rpc/RpcServer.ts`
lines 610-626, the loop at 621-624), so the entry added last is the outermost and runs first. beta.87 adds the list
with `reduce`, in list order (`Middleware.ts` lines 34-38), so the last entry runs first, contrary to its own doc
comment (lines 4-8). Main adds it with `reduceRight` (`Middleware.ts` lines 39-43, commit 6c184fcb4), so the first
entry runs first. The consequence: a middleware that needs what another provides (a second-factor check that reads
the `CurrentActor` the session middleware provides) must come after it in the list on main; on beta.87, with the
same list, it runs before the session has provided anything and cannot read it.

What a sender gets back:

- Through an aggregate's client (`yield* Import`, then `send(target, command, { commandId? })`), a `Receipt`:
  `stream` (for example `Import/imp_42`), `version` (the stream's last sequence number after the command), `events`
  (the events committed, empty for an accepted no-op) and `reply`. See [aggregate](./aggregate.md).
- Through an [Api](./api.md) client, a method per command: `api.ConfirmImport(target, input?, options?)` where options
  are `{ commandId?, ...call options }`. It answers the RPC success: `{ reply, stream, version }`, without `events`.

A `commandId` is the idempotency key. Without one, the id is chosen in this order: the caller's; inside a saga step,
the step's next id; inside a policy run, the run's next deterministic id; otherwise a fresh UUID. The instance stores
the receipt of an accepted command under its id, and a send with that id returns the stored receipt without deciding
again. **A rejected command stores no receipt**: the host checks for a stored receipt, decides, and returns a
`Rejected` result before the line that writes the receipt. So a rejected command sent again with the same `commandId`
is decided again, against the state as it is then. This holds at both refs, in memory and on Durable Objects.

Types and helpers:

| Name | What it is | Where |
| --- | --- | --- |
| `Instance<Tag, F>` | The instance type: `{ _tag } & fields` | `Command.ts` line 13 |
| `TargetSchema` | The constraint on `target`: a schema with string `Type` and `Encoded` (beta.87 only) | line 16 |
| `Any` | What every command class satisfies | lines 21-32 |
| `ContextOf<C>` | The services `decide` may read: what the command's middleware provides | line 38 |
| `ReplySchema<Reply>` | The declared reply fields as a `Schema.Struct`, or `undefined` | lines 43-45 |
| `PayloadFields<Target, F>` | The RPC payload's fields: `target`, optional `commandId`, `input` (main: `PayloadFields<F>`, no `target`, plus optional `consistency`) | lines 48-52 |
| `SuccessFields<Reply>` | The RPC success's fields: `reply` (or `Schema.Void`), `stream`, `version` (main adds `commits`) | lines 55-59 |
| `CommandRpc<Tag, Target, F, Rejects, Reply>` | The command's Effect `Rpc.Rpc` type before middleware (main drops `Target` and always adds `ConsistencyTimeout` to the error) | lines 62-73 |
| `CommandClass<...>` | The class type `make` returns | lines 78-99 |
| `make` | `Domain.Command` | lines 210-277 |
| `Middleware.List`, `Provides`, `Errors`, `Apply` | A list of middleware services; the union of what they provide; the union of their errors; the RPC type with the list applied | `Middleware.ts` lines 9, 12-16, 19-23, 26-31 |
| `Middleware.apply` | internal: adds the list to the RPC (`reduce` on beta.87, `reduceRight` on main) | `Middleware.ts` lines 34-38 |

Checked in:

- `packages/domain/src/Command.ts` lines 13 (`Instance`), 16 (`TargetSchema`), 21-32 (`Any`), 38 (`ContextOf`),
  43-73 (the reply, payload, success and RPC types), 78-99 (`CommandClass`), 110-127 (statics), 210-277 (`make`, the
  RPC at 249-261).
- `packages/domain/src/internal.ts` lines 19-22 (`inputSchema`: an empty input is `Schema.Record(String, Never)`).
- `packages/domain/src/Middleware.ts` lines 4-9 (`List` and its doc comment), 12-16 (`Provides`), 34-38 (`apply`).
- `packages/domain/src/Aggregate.ts` lines 69-78 (`Receipt`), 187-190 (`SendOptions`), 680-693 (`commandIdFor`).
- `packages/domain/src/Api.ts` lines 247-280 (`CommandOptions`, `CommandClient`: `(target, input?, options?)`).
- `packages/domain/src/InMemory.ts` lines 649 (the stored receipt is looked up), 663 (`Rejected` returns), 688 (the
  receipt is stored); `packages/domain/src/DurableObjects.ts` lines 804, 819, 838, the same three steps.
- `packages/domain/src/Annotations.ts` lines 28-54.
- Effect 4.1.4 (tag `effect@4.1.4`): `packages/effect/src/rpc/Rpc.ts` lines 893-901, `rpc/RpcServer.ts` lines 610-626,
  `rpc/RpcMiddleware.ts` lines 51-62 (a middleware is a function of the inner effect).

### What main changes

- **No `target`.** The option, `TargetSchema`, the class's `target` static and the RPC payload's `target` are gone.
  The input carries the id of every instance the command involves (`{ importId: ImportId, reviewedAt: S.Int }`), and
  the aggregate's `keyOf` says which field routes it (commit dbda8cc16; `packages/domain/src/Command.ts` lines 275-344
  on main; `Aggregate.ts` line 182). The docs add that `keyOf` receives any of the aggregate's commands, so they share
  the field's name (`website/src/content/docs/domain/command.mdx` lines 104-122 on main). An Api method becomes
  `api.ConfirmImport(input?, options?)` (`Api.ts` lines 284-312 on main). The aggregate client's `send(command,
  options?)` and `schedule(command, options)` lose their first argument; `get(target)` and `unschedule(target,
  commandId)` keep theirs (`Aggregate.ts` lines 360-397 on main).
- **`consistency`.** `Command.Consistency` is `Schema.Literals(["strong", "eventual"])` (line 51). The RPC payload
  gains `consistency?` (line 319); an Api call takes it in its options (`Api.ts` lines 270-282 on main). `"eventual"`,
  the default, answers at the commit; `"strong"` answers once every view the events reach has applied them, and fails
  with `ConsistencyTimeout` after 10 seconds although the command is committed. `Domain.DefaultConsistency` is a
  `Context.Reference` read once when a client is built (`Command.ts` lines 66-69; exported in `index.ts` line 64).
  Commands sent from inside the model (a policy or saga through an aggregate's client) answer at the commit (commit
  bc0024faf; `website/src/content/docs/domain/command.mdx` lines 246-289 on main).
- **The error union always holds `View.ConsistencyTimeout`**, even with no `rejects` (line 328).
- **The success gains `commits`**, an array of `Command.Commit` `{ stream, version }` (lines 79-80, 88-93, 325): one
  per stream committed to, several for a command a decision implements. The aggregate `Receipt` gains the same field
  (`Aggregate.ts` line 83).
- **Middleware runs in list order** (commit 6c184fcb4), as stated above.
- **A rejected command still stores no receipt**: `InMemory.ts` lines 733, 747, 772 (and 923, 939, 951 for a
  command a decision implements); `DurableObjects.ts` lines 930, 946, 958.
- A command no longer has to belong to one aggregate: a [decision](./decision.md) can implement it across several.

## Rules, and the mistakes to avoid

- Name it as the business asks for it. `ConfirmImport` and `TakeBackImport`, not `UpdateImport` with a status field.
- Carry the intent, not the outcome. `ConfirmImport` carries the revision the person reviewed; the counts of what was
  created are decided by the aggregate and land in the event.
- The tag is the wire name and the handler's key: unique in the model.
- On beta.87 the `target` must be exactly the aggregate's `id` schema, both ways. Anything else is a type error on the
  command's entry in the aggregate's `commands` (`Aggregate.ts` lines 763-782).
- List every event and every rejection. `decide` returning one that is not listed type-fails; one smuggled through a
  cast dies at run time with `DefinitionError` / `UndeclaredDecision` (`internal.ts` lines 77-119).
- Only a command whose `rejects` is empty can be scheduled (`Aggregate.ts` lines 346-350). Facts the model cannot
  refuse ("the upload expired") declare no `rejects`.
- Pass your own `commandId` wherever a person can press twice or a network can retry. The app's `newRequestId()` per
  press maps onto it directly.
- Do not count on a `commandId` to stop a rejected command being decided again: only accepted receipts are stored.
- A `decide` that reads a service the middleware does not provide does not type-check (`Command.ContextOf`). Senders
  without the middleware (a policy, a story) provide the service themselves.
- On beta.87, a middleware list of two where one needs the other runs in the wrong order. Either keep one entry that
  does both, or write the list in reverse (`[MfaChallenge, Session]` runs `Session` first) and turn it round when
  moving to main.
- Input is decoded by its schemas before `decide` sees it, so bound strings in the schema as the app already does.
- Build a command to send with `new ConfirmImport({ ... })`. `.make` also type-checks for commands at both refs, but
  events and rejections inside `decide` must be built with `new` (see [event](./event.md) and
  [rejection](./rejection.md)), so `new` everywhere keeps one rule. The app's Effect diagnostic `newSchemaClass` is an
  error (`tsconfig.base.json` line 190) and reports every `new`; domain files need an exception to it.
- On main, the prover follows relative imports only: a command reused from another package by name (as the app's
  model would import from its contract package) is not read. Keep a command, its events and its rejections reachable
  from the aggregate's file by relative imports.

## In this app

`ConfirmImport` checks that the review the person saw is still the latest. In the shape the brief recommends the import
numbers every change, and the confirm names the last one its screen has received with none before it missing (`seen`),
the one its plan was built at (`planAt`), and what its button said (`shown`); the import takes it only when both numbers
are its last and the plan does what was shown, and refuses it otherwise with `ReviewMovedOn`, `PlanBehind` or
`NotWhatWasShown` (the fourth round of [the trial](../07-review-decisions-trial.md)). Each act of the review is a
decision across the import's lifecycle and the row it names. The first form, kept below as the record of what ran, sent
the import's `version` from the last receipt as `reviewedAt` and compared it with the decide context's `version`. A
trial on 2026-11-19 ran a model like this on beta.87 with Effect 4.1.4, in memory: a `ConfirmImport` whose `reviewedAt`
was not the context's `version` was rejected with `StaleReview { current: 1 }`, the right one answered version 2 with
its reply, the same `commandId` sent again answered the same receipt, and a second confirm was rejected with `NotOpen`.
The block below is in the trial's names; it was not itself compiled.

```ts
// SKETCH: not compiled (beta.87)
import * as S from "effect/Schema"
import * as Domain from "@alchemy.run/domain"
import { Session } from "./Session.middleware.ts"

export const ImportId = S.String.pipe(S.brand("ImportId"))

export class ImportConfirmed extends Domain.Event("ImportConfirmed", { reviewedAt: S.Int, ready: S.Int }) {}

export class NotOpen extends Domain.Rejection("NotOpen", {}, { httpApiStatus: 409 }) {}

export class StaleReview extends Domain.Rejection("StaleReview", { current: S.Int }, { httpApiStatus: 409 }) {}

export class ConfirmImport extends Domain.Command("ConfirmImport", {
  target: ImportId,
  middleware: [Session],
  input: {
    reviewedAt: S.Int, // the version the screen showed
    ready: S.Int // counted by the server's own review of the stored rows, never taken from the screen
  },
  events: [ImportConfirmed],
  rejects: [NotOpen, StaleReview],
  reply: { ready: S.Int }
}) {}

// From the server's own code (a handler or a policy):
// const imports = yield* Import
// // @effect-diagnostics-next-line newSchemaClass:off
// const receipt = yield* imports.send(importId, new ConfirmImport({ reviewedAt: 7, ready }), { commandId })
```

On main the same command drops `target` and adds `importId: ImportId` to `input`; the aggregate (the trial on main
called it `ImportDraft`) adds `keyOf: (cmd) => cmd.importId`, and every command of that aggregate carries the same
`importId` field. In the trial on main each `ImportDraft` command declared `middleware: [Session]`.

The item edit is the same shape: `EditItem` with `input: { revision: S.Int, ...fields }`, rejecting when the revision
is not the current one (the trial on main called that rejection `EditedSince`). The app's existing `ItemChanged`
(`packages/catalog/contract/src/Catalog.contract.ts` line 286) is already an `S.TaggedError` with `httpApiStatus: 409`,
so on beta.87 it can go in `rejects` as it is; on main, the prover reads it only when it is imported by a relative path,
so a proved `Item` aggregate declares its own rejection beside it.

- **Used today:** no. Each write is an HttpApi endpoint in `packages/catalog/contract/src/Catalog.contract.ts`
  (`decide`, `commit`, `takeBack`, `reopen`, `remove`, `edit`) handled through the `ImportStore` and `ItemStore`
  ports.
- **Where it goes:** one `*.command.ts` file per command beside its events and rejections (see
  [project layout](./project-layout.md)), in a new domain package next to `packages/catalog/model`; the endpoints in
  `Catalog.contract.ts` would come from an [Api](./api.md) built on the model.
- **What the person gets:** a confirm on a stale review says so and writes nothing, and a double press confirms once.

## How to check it

A [story](./story.md) per outcome, with the steps typed against the command: `Story.rejected` takes only a rejection
the last `when` command declares, and `Story.replied` only its reply type (`packages/domain/src/Story.ts` lines
210-227 for the checks, 419 and 425 for the steps, at beta.87; main's type test `packages/domain/test/types/Story.ts`
lines 35-36). The trial ran stories of this kind on beta.87 under Vitest 5.1 with `@effect/vitest` 4.1.4 (`given`,
`when(ref, command)`, `then`, `replied`, `rejected`), and on main in main's shape (`Story.when(command)`,
`Story.provide(CurrentActor, value)`): a confirm by its own organization was recorded and replied, and another
organization's admin was rejected with `NotPermitted`.

Each `new` below needs the `newSchemaClass` exception; the trial used the per-line form
`// @effect-diagnostics-next-line newSchemaClass:off`, left out here for length.

```ts
// SKETCH: not compiled (beta.87)
story(
  Story.given(imp, new ImportStaged({ rows: 150 })), // version 1
  Story.provide(CurrentActor, dana),
  Story.when(imp, new ConfirmImport({ reviewedAt: 0, ready: 149 })),
  Story.rejected(new StaleReview({ current: 1 })),
  Story.when(imp, new ConfirmImport({ reviewedAt: 1, ready: 149 }), { commandId: "press-1" }),
  Story.then(imp, new ImportConfirmed({ reviewedAt: 1, ready: 149 })),
  Story.replied({ ready: 149 })
)
```

`Domain.verify(model)` (`Model.ts` line 386) reports declaration problems such as `DuplicateEventTag` and, for an
Api, `UnroutedCommand` (a served command no hosted aggregate handles) and `DuplicateCommand` (two calls of an Api
would be the same CLI command) (`DefinitionError.ts` lines 7, 157-164, 305-315). In the trial on beta.87
`Domain.verify(Inventory)` answered `[]`. A `decide` that returns an undeclared event or rejection is not caught by
`verify`; it dies at run time with `UndeclaredDecision`. On main, [Verify](./verify.md) also proves the aggregate's
[invariants and transitions](./invariants-and-transitions.md) for every command.

## What it needs

A model hosted somewhere: [in memory](./host-in-memory.md) for tests, [Durable Objects](./host-cloudflare.md) for this
app's Worker, or [Rivet](./host-rivet.md) or [Effect Cluster](./host-effect-cluster.md). beta.87 for `target`; main for
`consistency`, list-order middleware and commands without `target`. Middleware is an Effect `RpcMiddleware.Service`;
see [sessions](./sessions.md).

## Verdict

**Use:** declare each import and item write as a command on beta.87 with `target`, built with `new`, pass the app's
per-press request id as `commandId`, and keep middleware to one entry (or reverse the list) until the app takes main's
list-order fix.

## Where this was read

- https://alchemy.run/domain/command (the live site documents beta.87)
- `website/src/content/docs/domain/command.mdx` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: same path, changed
- `packages/domain/src/Command.ts` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: same path, changed
- `packages/domain/src/Middleware.ts` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: same path, changed
- `packages/domain/src/Aggregate.ts`, `internal.ts`, `Api.ts`, `InMemory.ts`, `DurableObjects.ts`, `Annotations.ts`,
  `Story.ts`, `DefinitionError.ts`, `Model.ts` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: same paths, changed
- `packages/domain/skills/alchemy-domain/references/building-blocks.md` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: changed
- `packages/domain/test/types/Story.ts`, `Model.ts`, `Decision.ts` on `main@dbfd0ddb`: new (no type tests at beta.87)
- Effect 4.1.4 (tag `effect@4.1.4`): `packages/effect/src/rpc/Rpc.ts` lines 893-901, `rpc/RpcServer.ts` lines 610-626,
  `rpc/RpcMiddleware.ts` lines 51-62
- The app: `tsconfig.base.json` line 190, `packages/catalog/contract/src/Catalog.contract.ts` line 286
