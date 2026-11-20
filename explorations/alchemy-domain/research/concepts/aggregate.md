---
type: Reference
title: Aggregate
description: A consistency boundary keyed by id that decides commands against its state, one at a time, and records events; the app's import (stage to take-back) and item (edit at a revision) would each be one.
tags: [alchemy-domain, declaration]
---

# Aggregate

An aggregate is a rule together with exactly the state that rule needs. Each instance (one import, one item) takes
one [command](./command.md) at a time, checks it against its current state in `decide`, and answers with
[events](./event.md) or a [rejection](./rejection.md). Its state is the fold of its events through `evolve`; a command's
events, the new state, the reply and the deliveries to views and policies commit together or not at all. Every id
exists from the start in the `initial` state, so "creating" an instance is just its first accepted command. The docs:
"Each instance, one bank account for example, holds the state its rules need, takes one command at a time"
[https://alchemy.run/domain/aggregate]

## When to reach for it

- Where a rule must never be broken even for a moment: a confirm on a stale review, a take-back after an item changed,
  an edit on an old revision, a second confirm of the same import, a 41st model call in a day, an organization left
  without an admin.
- Where concurrent requests for the same thing must be serialized: two reviewers pressing Confirm at once.
- For a process that waits and whose steps must not cross: an import that is open, imported, taken back.
- Not for a list or a page of data people read: that is a [view](./view.md), [projection](./projection.md) or
  [query](./query.md). Clients never read an aggregate's state directly.
- Not for a rule across many instances (one SKU per organization): give the rule its own aggregate keyed by the value
  ([unique values](./unique-values.md)), or on main use a [decision](./decision.md).

## How it is declared

`Domain.Aggregate(name, definition, annotations?)` returns a class to extend. The class is also an Effect service
tag: `yield* Import` gives its client, provided by the model's Layer.

```ts
// SKETCH: not compiled (beta.87 shape)
class Import extends Domain.Aggregate(
  "Import",
  {
    id: ImportId, // a string or branded string schema
    state: ImportState, // a Schema; used to persist snapshots
    initial: { _tag: "Unstaged" }, // the state before the first event
    commands: [StageImport, ConfirmImport], // its events come from these
    decide: { StageImport: (s, cmd, ctx) => ..., ConfirmImport: ... }, // one handler per command
    evolve: { ImportStaged: (s, e, envelope) => ..., ImportConfirmed: ... }, // one handler per event
    reply: { ConfirmImport: (s, events) => ({ ... }) } // one per command that declares a reply
  },
  { description: "One file being brought in, from staging to confirm." }
) {}
```

The definition, field by field (beta.87):

| Field | Required | What it is |
| --- | --- | --- |
| `id` | yes | Schema with string `Type` and `Encoded` (`IdSchema`); every command's `target` must be this schema exactly |
| `state` | yes | Any `Schema.Top`; used to encode snapshots |
| `initial` | yes | `state["Type"]`; must encode with `state` (`InvalidInitial` otherwise) |
| `commands` | yes | The command classes it handles. Its events are collected from their `events` lists, deduplicated |
| `decide` | yes | `{ [commandTag]: (state, command, ctx) => Decision }` |
| `evolve` | yes | `{ [eventTag]: (state, event, envelope) => state }`, one per collected event |
| `reply` | no | `{ [tag of a command with a reply]: (state, events) => reply }`, run on the state after `evolve` |
| third argument | no | `Domain.Annotations`, read back as `Import.annotations` |

`decide` returns one of three things: an array of the command's declared events (empty means accepted, nothing to
record, and the caller still gets a receipt), one of its declared rejections, or an `Effect` of either. An effectful
handler (`Effect.fn`) may read only what the command's middleware provides (`Command.ContextOf`) and fails with a
rejection (`return yield* rejection`); the kernel runs it, takes a failure that is a declared rejection as the
decision, and treats any other failure as a failure.

The decide context, `ctx`, the third argument. Its fields are the same at beta.87 and main (`DecideContext`,
`Aggregate.ts` lines 28-39 at both refs):

| Field | Meaning |
| --- | --- |
| `id` | The instance's id: on beta.87 the `target` the command was sent to, decoded with the `id` schema; on main what `keyOf` returned for the command |
| `commandId` | The id the command was sent with; its events' envelopes carry it |
| `stream` | `<name>/<id>`, for example `Import/imp_42` |
| `version` | The stream's version before this decision: `0` for a new instance |
| `now` | `DateTime.Utc`, the time the command is handled; its events' envelopes carry the same time as `at`; a story moves it with `Story.clock` |

`evolve` and `reply` cover every state and never fail: `decide` has already refused a command its event cannot
follow, so a handler returns the state unchanged when the event does not apply.

The class:

| Member | What it does |
| --- | --- |
| `kind`, `aggregateName`, `annotations` | `"Aggregate"`, the name, the annotations |
| `definition` | The definition plus `events`, the collected event classes |
| `ref(id)` | A static of the class: a typed address `{ aggregate, id }` for stories, views and policies. It takes the id's encoded form and decodes it with the id schema synchronously, so an invalid id throws |
| `predict(state, command, options)` | A static of the class: runs this aggregate's own `decide` and `evolve` locally, without a host |
| `yield* Import` | The client below |

The client (`Aggregate.Client`), whose methods require nothing but the command's middleware context:

| Method | Signature (beta.87) | Result |
| --- | --- | --- |
| `send` | `(target, command, { commandId? }?)` | `Receipt` `{ stream, version, events, reply }`, or fails with the command's rejections |
| `schedule` | `(target, command, { at } \| { after }, plus commandId?)` | `ScheduleReceipt` `{ commandId, at }`; only commands with empty `rejects`; the same `commandId` replaces the earlier one, pending or already run |
| `unschedule` | `(target, commandId)` | `void`, or fails with `AlreadyExecuted`, `AlreadyCancelled` or `NotScheduled` |
| `get` | `(target)` | The state as of the latest commit; `initial` for an instance that never committed |

A `target` is an id or anything with an `id` (a ref). `ref` is on the class, not the client.

`predict` takes `{ id, now, version?, commandId?, correlationId?, context? }` at beta.87 (`version` defaults to `0`,
`commandId` to `""`, `correlationId` to the command id; `context` is required when the command has middleware: a
`Context` of what it provides) and returns one of three results:

- `{ _tag: "Accepted", events, envelopes, state }`: the events, one envelope per event with `seq` from `version`, and
  the state after `evolve`.
- `{ _tag: "Rejected", rejection }`.
- `{ _tag: "Unpredictable", cause }`: `decide` suspended on something asynchronous (predict runs it with
  `runSyncExit`), died, has no handler for the command, or returned an undeclared event or rejection.

`predict` never throws. It is what the screens would use to show a confirm's outcome before the server answers
([local first](./local-first.md)).

Keys. `Aggregate.Key<Name>` is the type-level identity of the aggregate's service in an Effect's requirements
(`{ "~alchemy/Domain/Aggregate": Name }`). Separately, `Domain.Key` is a type namespace for what keys a view, policy,
projection or stream (`Key.ts`, the same at both refs): `Key.Schema` is a string schema, `Key.Any` an aggregate or such
a schema, `Key.RefOf<K>` a ref for an aggregate key and the value for a schema key, `Key.IdOf<K>` the id
([view](./view.md)). `Key.ts` also has the internal helpers `isAggregate`, `refOf`, `idSchemaOf` and `describe`
(lines 31-45).

Optics, as the docs show them: when many `evolve` handlers repeat `s._tag === "Open" ? { ...s, ... } : s`, an optic
from `effect/Optic` says it once. `Optic.id<State>().tag("Open")` focuses on one case of a tagged union and
`.key("rows")` on one of its fields; `Optic.replace(s, optic, value)` sets one field and
`optic.modify((o) => ({ ...o, ... }))(s)` several, leaving other states unchanged. They are optional.

Types and helpers (all in `Aggregate.ts`; beta.87 lines):

| Name | What it is | Where |
| --- | --- | --- |
| `EventsOf<C>` | The event classes a list of commands may record: `C[number]["events"][number]` | line 115 (main: 132) |
| `InstanceOf<C>` | The instance type of a class, distributed over a union | line 23 |
| `Envelope`, `Receipt`, `ScheduleReceipt` | The envelope schema and the two receipts | lines 45-89 |
| `Decision<C>` | What `decide` may return for a command | lines 105-112 |
| `Definition`, `AnyDefinition` | The definition, typed and widened | lines 121-175, 259-268 |
| `Key<Name>` | The service's type-level identity | lines 180-182 |
| `SendOptions`, `ScheduleOptions`, `Due` | Options of `send` and `schedule`; when a scheduled command is due | lines 187-190, 220-237 |
| `AlreadyExecuted`, `AlreadyCancelled`, `NotScheduled` | The errors of `unschedule` (also at the top level) | lines 196-214 |
| `SendMeta` | What a platform receives with every command (command id, request context, correlation, trace) | lines 242-252 |
| `Target`, `Client`, `Schedulable` | The address a client takes, the client, the commands that may be scheduled | lines 271-350 |
| `ClientImpl` | internal: the untyped client a host implements | lines 357-373 |
| `Any`, `IdOf`, `StateOf`, `EventOf`, `CommandOf`, `Identifier` | The constraint on every aggregate class and its derived types | lines 378-394 |
| `PredictOptions`, `Prediction`, `predict` | The local decision | lines 401-534 |
| `decisionOf` | internal: one `decide` call, shared by the kernel and `predict` | lines 455-468 |
| `Ref`, `refClass`, `makeRef`, `streamOf` | A typed address; internal: its class; build one; its stream name | lines 542-549, 650-658 |
| `targetId`, `PolicyRun`, `commandIdFor` | internal: the id a target addresses; a policy run's deterministic ids; how a send's command id is chosen | lines 661-693 |
| `make` | `Domain.Aggregate` | lines 722-761 |
| `TargetsMatch`, `Resolved`, `AggregateClass` | beta.87's target check; the definition with its events collected; the class type | lines 763-832 |

Checked in:

- `packages/domain/src/Aggregate.ts` lines 28-39 (`DecideContext`), 45-64 (`Envelope`), 69-78 (`Receipt`), 84-89
  (`ScheduleReceipt`), 105-112 (`Decision`), 115 (`EventsOf`), 121-175 (`Definition`), 180-182 (`Key`), 187-190
  (`SendOptions`), 196-214 (the three errors), 220-232 (`ScheduleOptions`), 271-273 (`Target`), 297-344 (`Client`),
  346-350 (`Schedulable`), 401-436 (`PredictOptions`, `Prediction`), 470-534 (`predict`), 542-546 (`Ref`), 650-658
  (`makeRef`, `streamOf`), 680-693 (`commandIdFor`), 722-761 (`make`, `ref` at 748-750, `predict` at 752-759),
  768-782 (`CheckTarget`, `TargetsMatch`), 796-832 (`AggregateClass`).
- `packages/domain/src/Key.ts` lines 5-45; `packages/domain/src/index.ts` lines 73-125.
- `packages/domain/src/internal.ts` lines 56-119 (`settle`, `judge`).
- `packages/domain/src/Kernel.ts` lines 1080-1180 (the kernel builds `ctx` with `version: input.version`, runs an
  effectful decision with the restored request context, judges, commits, runs `reply`), 351-362 (`InvalidInitial`).
- `packages/domain/src/InMemory.ts` lines 569-694 (in memory, one command at a time per aggregate type under one
  semaphore; the receipt stored under `commandId` only when accepted).
- Effect 4.1.4 (tag `effect@4.1.4`) `packages/effect/src/Optic.ts` lines 511, 533-541, 674-681, 1384, 1599.

### What main changes

All in `packages/domain/src/Aggregate.ts` on main unless noted.

- **`keyOf`** (commit dbda8cc16): commands lose `target`; an aggregate with commands declares
  `keyOf: (command) => Id["Type"]`, reading the instance id from the command's input (line 182). The `Decides<C>`
  type makes `commands`, `keyOf` and `decide` required together when there are commands (lines 850-852); `keyOf`
  must return the aggregate's own id type (`packages/domain/test/types/Decision.ts` lines 79-100). `targetOf` routes
  by it (lines 860-863, internal). `TargetsMatch` and `CheckTarget` are gone.
- **`send(command, options?)` and `schedule(command, options)`** lose the target (lines 360-381); `get(target)` and
  `unschedule(target, commandId)` keep it (lines 389-397).
- **`events`**: events it folds but none of its own commands records, what a [decision](./decision.md) records on
  it; `evolve` has a handler for each (line 187). `commands` and `decide` become optional (lines 177, 197): an
  aggregate may only fold. `definition.events` is its commands' events then these (lines 822-832).
- **`invariants`** (line 157): named rules over a state, `(state) => boolean`. **`transitions`** (lines 167-176):
  named rules over a step `{ before, after, command, events }` (`Transition`, lines 121-129), returning a boolean or an
  Effect of one that may read the commands' middleware context. See
  [invariants and transitions](./invariants-and-transitions.md); [Verify](./verify.md) proves them.
- **`Receipt.commits`**: every stream the command committed to (line 83).
- **`predict`** no longer takes `id`: it routes the command through `keyOf` (`PredictBase` lines 458-467; `predict`
  lines 520-534, the id at 531); `Domain.Aggregate.PredictOptions<R>` drops its `Id` parameter (`index.ts` line 96 on
  main).
- **`DecideContext`** is unchanged; its `id` is now what `keyOf` returned.
- **What the prover reads.** On main an aggregate's commands, events, rejections and every helper its `decide`,
  `evolve`, invariants or transitions call must be reachable from the aggregate's file by relative imports
  (`Prove/internal/Source.ts` line 229), and events and rejections must be built with `new` inside them. The trial
  showed both: imports by package name and `Event.make` in `decide` were not read, and nothing was proved.
- Docs (`website/src/content/docs/domain/aggregate.mdx` on main): a rule across two instances is now "decided by a
  decision"; `UsernameClaim` has no commands and lists `events: [UsernameClaimed]`. The class's own doc comment on
  main (lines 769-796) has the two-argument `decide` and `keyOf`, but still names a client method `state`; the client
  has `get`.

## Rules, and the mistakes to avoid

- Find the rule first; the state is only what that rule needs. Keep lists, totals and counts for screens in views.
- Model the lifecycle as a tagged union state (`Unstaged | Open | Imported | TakenBack`), so a handler must narrow
  before it reads a field of one case.
- Write shared checks once as pure guards that return the narrowed state or the rejection (`openFor`); in an
  `Effect.fn` handler fail with `return yield* guard`.
- `decide` is pure, or an `Effect.fn` that reads only middleware context. Read time from `ctx.now`, never
  `Date.now()`, `Clock` or randomness; ids for new things come in the command (the app's `newRequestId()`).
- `ctx.version` is the optimistic-concurrency check: compare it with the version the person saw.
- `evolve` copies outcomes from events and never recomputes; it never fails.
- Build events and rejections with `new` inside `decide`, with an exception to the app's `newSchemaClass` diagnostic
  (an error in `tsconfig.base.json` line 190): `.make` does not type-check for a rejection on beta.87, and the prover
  on main does not read it ([event](./event.md), [rejection](./rejection.md)).
- Each instance decides alone. On beta.87 nothing spans two instances: an import's confirm cannot create items in
  the same step. A [policy](./policy.md) reacting to `ImportConfirmed` sends one command per item, or a
  [saga](./saga.md) carries it out step by step. On main a [decision](./decision.md) can record on several at once.
- Instances are global to the model, not per organization. Put the organization in the id (`org_prairie/BOLT-M8`) or
  in the state, and check the actor's organization in `decide`.
- A compensation never refuses: a take-back the system sends after a failure records a fact for every state.
- On beta.87, every command's `target` must be the `id` schema exactly; a mismatch is a type error on that entry of
  `commands`.
- `ref(id)` decodes synchronously and throws on an invalid id: build refs from decoded ids.
- The class's own doc comment at beta.87 (lines 694-721) shows `decide` handlers with three leading arguments and a
  client method `state`; the source signatures above (`(state, command, ctx)` and `get`) are what holds.
- On main, keep one aggregate name per test file: the trial imported two aggregates of the same name into one file,
  and the prover read one file for both and reported that the real code disagreed with what it read.

## In this app

Two trials on 2026-11-19 ran aggregates in this app's terms.

On beta.87, in memory: an `Import` with `StageImport` and `ConfirmImport`, events `ImportStaged` and
`ImportConfirmed`, rejections `NotOpen` and `StaleReview`, hosted with
`Inventory.layer(Layer.empty).pipe(Layer.provide(Domain.InMemory))`. `send(id, StageImport)` answered a receipt at
version 1; a `ConfirmImport` whose `reviewedAt` was not `ctx.version` was rejected with `StaleReview { current: 1 }`;
the right one answered version 2 with its reply; the same `commandId` again answered the same receipt; a second
confirm was rejected with `NotOpen`; `get(Import.ref(id))` answered the `Imported` state. The block below is in that
shape and those names; it was not itself compiled.

```ts
// SKETCH: not compiled (beta.87)
import * as S from "effect/Schema"
import * as Domain from "@alchemy.run/domain"
import { ConfirmImport, ImportConfirmed, ImportId, ImportStaged } from "./Import.command.ts"
import { NotOpen, StageImport, StaleReview } from "./Import.command.ts"

const ImportState = S.Union([
  S.TaggedStruct("Unstaged", {}),
  S.TaggedStruct("Open", { rows: S.Int, ready: S.Int }),
  S.TaggedStruct("Imported", { rows: S.Int, ready: S.Int })
])
type ImportState = typeof ImportState.Type

export class Import extends Domain.Aggregate("Import", {
  id: ImportId,
  state: ImportState,
  initial: { _tag: "Unstaged" },
  commands: [StageImport, ConfirmImport],
  decide: {
    // each `new` below carries `// @effect-diagnostics-next-line newSchemaClass:off` in the app
    StageImport: (s, cmd) =>
      s._tag === "Unstaged" ? [new ImportStaged({ rows: cmd.rows, ready: cmd.ready })] : new NotOpen(),
    ConfirmImport: (s, cmd, { version }) =>
      s._tag !== "Open"
        ? new NotOpen()
        : cmd.reviewedAt !== version
          ? new StaleReview({ current: version })
          : [new ImportConfirmed({ reviewedAt: cmd.reviewedAt, ready: s.ready })]
  },
  evolve: {
    ImportStaged: (s, e) => (s._tag === "Unstaged" ? { _tag: "Open" as const, rows: e.rows, ready: e.ready } : s),
    ImportConfirmed: (s) => (s._tag === "Open" ? { ...s, _tag: "Imported" as const } : s)
  },
  reply: { ConfirmImport: (s) => ({ ready: s._tag === "Imported" ? s.ready : 0 }) }
}) {}
```

On main, with [Verify](./verify.md): an `ImportDraft` (state `Unstaged | Open | Imported | TakenBack`, counts of rows
and the organization in the state; commands `StageImport`, `SettleRow`, `LeaveRowOut`, `RecordSuggestion`,
`ConfirmImport`, `TakeBackImport`, each with `middleware: [Session]` and an `Effect.fn` decide that reads
`CurrentActor`, a `Domain.RequestContext` of `{ organizationId, memberId, role }`); an `Item` keyed by organization and
SKU key (`CreateFromImport` answers `[]` when the item is there; `EditItem` rejects `EditedSince` when the revision is
not the current one; `RemoveIfUnchanged` removes only at revision 1); an `Allowance` (`TakeModelCall` rejects
`AllowanceUsedUp` at 40); and an `Organization` (`ChangeRole` and `RemoveMember` reject `LastAdmin`).
`Verify.aggregate` proved every invariant and transition of the four, in under two seconds each, among them
`OutcomesAddUpToTheRows`, `NothingIsWrittenBeforeConfirm`, `OnlyItsOwnOrganizationChangesAnImport`,
`EveryEditWasMadeOnTheCurrentRevision`, `NeverMoreThanTheDaysAllowance` and `AlwaysKeepsAnAdmin`. The block below is
in that shape and those names, cut to two commands; it was not itself compiled.

```ts
// SKETCH: not compiled (main@dbfd0ddb)
import * as Effect from "effect/Effect"
import * as S from "effect/Schema"
import * as Domain from "@alchemy.run/domain"
import { CurrentActor } from "./CurrentActor.ts" // relative: the prover follows these only
import { ImportId, LeaveRowOut, RowLeftOut, ImportStaged, StageImport } from "./ImportDraft.command.ts"
import { NotOpen, NotPermitted } from "./ImportDraft.rejection.ts"

const ImportDraftState = S.Union([
  S.TaggedStruct("Unstaged", {}),
  S.TaggedStruct("Open", { organizationId: S.String, rows: S.Int, ready: S.Int, waiting: S.Int, left: S.Int }),
  S.TaggedStruct("Imported", { organizationId: S.String, rows: S.Int, ready: S.Int, waiting: S.Int, left: S.Int }),
  S.TaggedStruct("TakenBack", { organizationId: S.String })
])

export class ImportDraft extends Domain.Aggregate("ImportDraft", {
  id: ImportId,
  state: ImportDraftState,
  initial: { _tag: "Unstaged" },
  commands: [StageImport, LeaveRowOut],
  keyOf: (cmd) => cmd.importId, // every command carries importId
  decide: {
    StageImport: Effect.fn(function* (s, cmd) {
      const actor = yield* CurrentActor
      if (s._tag !== "Unstaged") return yield* new NotOpen()
      return [new ImportStaged({ organizationId: actor.organizationId, rows: cmd.rows, ready: cmd.ready })]
    }),
    LeaveRowOut: Effect.fn(function* (s) {
      const actor = yield* CurrentActor
      if (s._tag !== "Open") return yield* new NotOpen()
      if (s.organizationId !== actor.organizationId) return yield* new NotPermitted()
      return [new RowLeftOut()]
    })
  },
  evolve: {
    ImportStaged: (s, e) =>
      s._tag === "Unstaged"
        ? {
            _tag: "Open" as const,
            organizationId: e.organizationId,
            rows: e.rows,
            ready: e.ready,
            waiting: 0,
            left: 0
          }
        : s,
    // forgetting `ready: s.ready - 1` here is the break the trial made: Verify named OutcomesAddUpToTheRows
    RowLeftOut: (s) => (s._tag === "Open" ? { ...s, ready: s.ready - 1, left: s.left + 1 } : s)
  },
  invariants: {
    OutcomesAddUpToTheRows: (s) => s._tag !== "Open" || s.ready + s.waiting + s.left === s.rows,
    NoCountIsNegative: (s) => s._tag !== "Open" || (s.ready >= 0 && s.waiting >= 0 && s.left >= 0)
  }
}) {}
```

The review itself runs where the rows are: the server's handler runs the app's pure `review` over the stored rows and
puts its counts in the command; `decide` cannot read a store, since an effectful handler may only read what its
middleware provides. The take-back's rule "removes only items nobody changed" becomes a check each `Item` makes on
its own revision when the take-back's command reaches it (`RemoveIfUnchanged` in the trial).

- **Used today:** no. The import's rules live in `packages/catalog/model/src/Import/Imports.handler.ts` and in the
  guarded D1 batches of `packages/catalog/host/src/ImportStore.adapter.ts`; the item edit's in
  `packages/catalog/model/src/Item/ItemEdit.rules.ts` and `ItemStore.edit`.
- **Where it goes:** `ImportDraft.aggregate.ts`, `Item.aggregate.ts`, `Allowance.aggregate.ts` and
  `Organization.aggregate.ts` in a new domain package beside `packages/catalog/model`, each with its commands, events,
  rejections and helpers reachable by relative imports, listed in a [model](./model.md) hosted by the Worker
  (`apps/inventory/src/server/App.ts`); the `ImportStore`, `ItemStore` and `AllowanceStore` write paths are replaced.
- **What the person gets:** two reviewers confirming at once cannot both write, and a confirm on a review someone
  has since changed says so instead of writing.

## How to check it

- [Stories](./story.md) per rule. On beta.87: `Story.given(ref, ...events)`, `Story.provide(CurrentActor, dana)`,
  `Story.when(ref, command, { commandId })`, then `Story.then(ref, ...events)`, `Story.rejected(...)`,
  `Story.replied(...)` or `Story.state(ref, expected)`; `Story.clock(at)` for `now` (`packages/domain/src/Story.ts`
  lines 261-297, 419-431, 583 at beta.87). On main `Story.when(command, options?)` takes no ref (line 282 on main).
  The trial ran both.
- A pure unit test with `Import.predict(state, command, { id, now, version, context })` (main: no `id`): the stale
  review gives `Rejected`, the current one `Accepted` with envelopes `seq` from `version + 1`.
- `Domain.verify(model)` reports `InvalidInitial`, `DuplicateDefinition`, `DuplicateEventTag` among others
  (`packages/domain/src/Model.ts` line 386, `Kernel.ts` lines 330-362). In the trial on beta.87 it answered `[]`. A
  missing handler or an undeclared answer dies at run time with `UnhandledCommand` or `UndeclaredDecision`.
- On main, `Verify.aggregate(X)` proves the aggregate's invariants and transitions "for every state and every input,
  after any number of commands"; when one breaks it fails with `NotVerified` and names the rule, the command, the state
  before, the events, the state after and the shortest sequence that reaches it (the trial's broken `RowLeftOut`).
  `Verify.model` adds explored sequences and random walks run as stories. See [Verify](./verify.md) and
  [Prove](./prove.md).

## What it needs

A [model](./model.md) on a host: [in memory](./host-in-memory.md) (tests and stories),
[Durable Objects](./host-cloudflare.md) (this app's Worker), [Rivet](./host-rivet.md) or
[Effect Cluster](./host-effect-cluster.md). beta.87 with `target` (run in memory in the trial; no other host was run);
main for `keyOf`, fold-only aggregates, `invariants`, `transitions` and their proofs (run with Node 24 and
`z3-solver` 5.3.3 in the trial). Middleware for the actor ([sessions](./sessions.md)).

## Verdict

**Use:** model the import and the item as aggregates on beta.87, with `ctx.version` as the revision check, the
organization in the state, events and rejections built with `new`, and a policy to carry a confirm's rows to the
items; the same model in main's shape (`keyOf`, invariants) proves the app's rules.

## Where this was read

- https://alchemy.run/domain/aggregate (the live site documents beta.87)
- `website/src/content/docs/domain/aggregate.mdx` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: same path, changed
- `packages/domain/src/Aggregate.ts` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: changed
- `packages/domain/src/Key.ts` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: same
- `packages/domain/src/Command.ts`, `Middleware.ts`, `internal.ts`, `Kernel.ts`, `InMemory.ts`, `index.ts`,
  `Story.ts`, `DefinitionError.ts`, `Model.ts` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: same paths, changed
- `packages/domain/src/Prove/internal/Source.ts`, `packages/domain/src/RequestContext.ts` on `main@dbfd0ddb`
- `packages/domain/skills/alchemy-domain/references/building-blocks.md` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: changed
- `packages/domain/test/types/Model.ts`, `Decision.ts`, `Story.ts` on `main@dbfd0ddb`: new
- Effect 4.1.4 (tag `effect@4.1.4`): `packages/effect/src/Optic.ts`
- The app: `tsconfig.base.json` line 190
