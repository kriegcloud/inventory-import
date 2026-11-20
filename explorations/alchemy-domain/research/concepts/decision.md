---
type: Reference
title: Decision
description: One command decided against several aggregate instances at once, committed on all of them or on none; on main only, a candidate for adding a person by email, the take-back and a small confirm.
tags: [alchemy-domain, declaration]
---

# Decision

A decision implements one [command](./command.md) whose rule needs more than one [aggregate](./aggregate.md)
instance. It reads every instance the command names, runs one `decide` against all of their states together, and
records each resulting event on one of those instances. Either every event commits or none does, and the caller gets
the answer at once instead of an event later. A decision keeps no state: each instance folds what is recorded on it
with its own `evolve`, so [views](./view.md), [projections](./projection.md) and [policies](./policy.md) see those
events like any other. The docs put it as: "A decision decides one that involves several aggregate instances"
[`website/src/content/docs/domain/decision.mdx` line 8, `main@dbfd0ddb`].

**What it is for, in the design note's own terms.** Without it, a rule over two instances is written as messages
between them (a claim aggregate, a policy, extra commands, a `Pending` state), and the caller never learns at once
that the rule refused it. The note says many such processes are really one rule that should be decided once,
answered at once, and committed entirely or not at all (`packages/domain/docs/decision-design.md` lines 9-18 at
`main@dbfd0ddb`). Its mechanism is an atomic append to several streams, each on the condition that it still has the
version it was read at (lines 28-30).

**It exists on `main@dbfd0ddb` only**, added by commit `dbda8cc16` (#3420). `packages/domain/src/index.ts` at
`v2.0.0-beta.87` exports nothing named `Decision`, and the live site (which documents beta.87) has no Decision page.

## When to reach for it

- A rule spans two or more instances and must be answered at once, never half done: a person added by email whose
  address must be free in the organization, a take-back that removes items and closes the import, a small confirm.
- The instances are all in the same model, and every one of them can be named from the command alone. `keyOf` is a
  pure function of the command (`Decision.ts` main line 129; the design note, line 57): it cannot look anything up.
- `decide` needs nothing but the states and what the command's middleware provides. A rule that waits, or calls an
  [external system](./external-system.md), is a [saga](./saga.md). Something that should happen after a fact is a
  [policy](./policy.md).

Not for: a rule over "every member of the organization" or "every item with this SKU", because no command can name
that set. Such a rule needs one instance that holds the set (see "In this app").

## How it is declared

```typescript
// SKETCH: not compiled (main only)
import * as Domain from "@alchemy.run/domain"
import * as S from "effect/Schema"
import { ImportConfirmed, ImportNotOpen, ItemCreated } from "./ConfirmImport.command.ts"

export class ConfirmImport extends Domain.Command("ConfirmImport", {
  input: { importId: ImportId, items: S.Array(ItemDraft) },
  events: [ImportConfirmed, ItemCreated],
  rejects: [ImportNotOpen]
}) {}

export class Confirm extends Domain.Decision(ConfirmImport, {
  reads: { draft: ImportDraft, items: Item },
  keyOf: (cmd) => ({ draft: cmd.importId, items: A.map(cmd.items, (row) => row.key) }),
  // a rejection, or [draft.record(new ...), ...items.map((i) => i.record(new ...))]
  decide: ({ draft, items }, cmd) => /* ... */
}) {}
```

`Domain.Decision(command, definition, annotations?)` (`annotations` defaults to `{}`) returns a class that is also a
service tag (`Context.Service`, key `alchemy/Domain/Decision/<command tag>`). The definition, field by field:

- **`reads`**: an object of names to aggregate classes, e.g. `{ draft: ImportDraft, items: Item }`. It is a plain
  value, not a function, so the model can check it hosts every aggregate before any command arrives. The same
  aggregate may appear under two names.
- **`keyOf(command)`**: for each name in `reads`, the id of one instance, or an array of ids for a name that stands
  for several. Every name must get an id (a missing one is a type error), and each id has that aggregate's id type.
  An instance named twice (under two names, or twice in one array) is read once (`Kernel.ts` main 1336-1360).
- **`decide(reads, command, context)`**: receives, under each name, a `Read` (or an array of them): `id`, `stream`
  (e.g. `Item/org_prairie:BOLT-M8`), `state` (`initial` when the instance never committed), `version` (`0` when it
  never committed) and `record(event)`. `context` has `commandId` and `now` (a `DateTime.Utc`, controlled by stories
  through the clock). It returns an array of recorded events, an empty array (accepted, nothing recorded), one of
  the command's rejections, or an Effect of either; the Effect may read only what the command's middleware provides.
- **`record(event)`** on a `Read` accepts only events that aggregate lists in its `events` (folds); recording an event
  another aggregate folds is a type error. On an array name you call `record` on each element, not on the array.
- **`reply(states, events)`**: required exactly when the command declares a `reply`, forbidden otherwise. `states`
  holds each instance's state after the events, under the same names as `reads`.
- **`transitions`** (optional): named rules given `{ before, after, command, events }` (`before` and `after` are each
  instance's state under its name in `reads`; `events` in the order `decide` recorded them) that return `true` while
  the rule holds, or an Effect of a boolean that may read what the command's middleware provides. Nothing runs them
  when a command arrives; verification proves `decide` cannot break them (see
  [Invariants and transitions](./invariants-and-transitions.md), [Verify](./verify.md) and [Prove](./prove.md)).

The aggregates it records on list those events in `events` with an `evolve` handler for each. An aggregate that only
takes part in decisions leaves out `commands`, `keyOf` and `decide`. The model lists decisions next to aggregates:
`Domain.Model("Inventory", { aggregates: [ImportDraft, Item], decisions: [Confirm] })`.

**Sending.** `yield* Confirm` gives a client with one method, `send(command, options?)` (`options.commandId` is the
idempotency key). It succeeds with a receipt `{ commits, events, reply }` once everything is committed, or fails with
one of the command's rejections, and then nothing was recorded anywhere. `commits` lists every stream the decision
read with its version after the commit, in stream order (streams sort by `<aggregate>/<id>`); each entry is what a
[view](./view.md) read takes as `atLeast`. Over an [Api](./api.md) the command is listed by name like any other, and
every command there answers `{ reply, stream, version, commits }` (`stream` and `version` are the first commit;
design note line 90).

Checked in: nothing at beta.87 (`packages/domain/src/index.ts` at `v2.0.0-beta.87` has no `Decision`). On
`main@dbfd0ddb`: `packages/domain/src/Decision.ts` lines 38-49 (`Read`), 58-73 (`KeysOf`, `ReadsOf`, `StatesOf`),
79-87 (`Transition`), 90-95 (`DecideContext`), 102-109 (`Outcome`), 117-163 (`Definition`), 175-190 (`Commit`,
`Receipt`), 201-215 (`Client`, `send` only), 393-407 (`make`); `packages/domain/src/index.ts` lines 117-130;
`packages/domain/src/Model.ts` lines 128-133 and 298-318 (the `decisions` field and its type-level checks);
`packages/domain/test/types/Decision.ts` lines 56-205.

### Types and helpers

`Domain.Decision` is `make`; `index.ts` re-exports the types `Decision.Any`, `Decision.Read`, `Decision.Recorded`,
`Decision.Receipt` and `Decision.Commit`. Everything below is also reachable by the subpath
`@alchemy.run/domain/Decision` or `@alchemy.run/domain/TwoPhase` (`packages/domain/package.json` main line 34,
`"./*": "./src/*.ts"`).

| Name | What it is | Where (main) |
| --- | --- | --- |
| `Recorded<E>` | An event plus the stream it is recorded on, as `record` returns it | `Decision.ts` 16-20 |
| `recorded`, `recordedOn` | Build a `Recorded`; read its stream back (internal) | `Decision.ts` 23-32 |
| `Read<A>` | One instance a decision read: `id`, `stream`, `state`, `version`, `record` | `Decision.ts` 38-49 |
| `Reads` | The `reads` object: names to aggregate classes | `Decision.ts` 52 |
| `KeysOf`, `ReadsOf`, `StatesOf` | What `keyOf` returns; what `decide` and `reply` receive | `Decision.ts` 58-73 |
| `Transition` | `{ before, after, command, events }`, a decision transition's argument | `Decision.ts` 79-87 |
| `DecideContext` | `{ commandId, now }` | `Decision.ts` 90-95 |
| `Outcome<C>` | What `decide` returns | `Decision.ts` 102-109 |
| `Definition`, `AnyDefinition` | The typed definition, and its widened shape | `Decision.ts` 117-172 |
| `Commit`, `Receipt` | `{ stream, version }`; `{ commits, events, reply }` | `Decision.ts` 175-190 |
| `Client`, `ClientImpl` | `send` only; the untyped form the framework implements (internal) | `Decision.ts` 201-223 |
| `Key`, `Any` | A decision's identity in requirements; the constraint every decision class meets | `Decision.ts` 226-240 |
| `DecisionClass<C, R>` | The class type `make` returns: a `Context.ServiceClass` with `kind: "Decision"`, `annotations`, `decisionName`, `command`, `reads`, `definition` | `Decision.ts` 243-253 |
| `TwoPhase.Address` | `{ aggregate, id }`: one instance | `TwoPhase.ts` 70-73 |
| `TwoPhase.Prepare`, `Part`, `Plan` | What a participant holds; another instance's share; the primary's whole plan | `TwoPhase.ts` 76-108 |
| `TwoPhase.Outcome` | `"Committed" \| "Aborted"` | `TwoPhase.ts` 111 |
| `TwoPhase.Unreachable` | Tagged error: another instance could not be reached (aborts before the commit point) | `TwoPhase.ts` 114 |
| `TwoPhase.ReadResult` | `Busy`, or `Read { state, version }` | `TwoPhase.ts` 117-120 |
| `TwoPhase.PrepareResult` | `Prepared`, `Conflict` or `Busy` | `TwoPhase.ts` 123-128 |
| `TwoPhase.Participant` | Another instance as the primary calls it: `read`, `prepare`, `commit(txId)`, `abort(txId)`, each repeatable | `TwoPhase.ts` 134-143 |
| `TwoPhase.Primary` | The primary's storage: `read`, `hold`, `commit`, `abort`, `delivered` | `TwoPhase.ts` 149-184 |
| `TwoPhase.Drive` | `{ primary, participant(address) }` | `TwoPhase.ts` 187-190 |
| `TwoPhase.deliver`, `finish` | Tell others an outcome; carry a held plan to its end (internal steps) | `TwoPhase.ts` 196-237 |
| `TwoPhase.DecideInput`, `decide` | The primary's input; decide and commit as the primary, retrying a lost race | `TwoPhase.ts` 259-360 |
| `TwoPhase.CommitInput` | `{ kit, command, meta, primary(read) }`, given to a strategy for one send | `TwoPhase.ts` 363-369 |
| `TwoPhase.CommitStrategy` | `(input: CommitInput) => Effect<DecisionResult>` | `TwoPhase.ts` 372 |
| `TwoPhase.twoPhase` | The default strategy: hand the command to the first instance it reads | `TwoPhase.ts` 378-394 |
| `TwoPhase.DecisionCommit` | `Context.Reference` holding the strategy, default `twoPhase` | `TwoPhase.ts` 401-403 |

### What main changes

Everything on this page is new on main, added by commit `dbda8cc16` (#3420). The parts it added around
`Decision.ts`, read as `diff -u` between beta.87 and main:

- `packages/domain/src/TwoPhase.ts` (new, 403 lines): the commit across Durable Object instances.
- `packages/domain/src/Platform.ts`: `AggregateKit.record` (fold a decision's events into an instance without
  `decide`, lines 203-207), `RecordInput`, `DecisionRead`, `DecisionState`, `DecisionWrite`, `DecisionReceiptJson`,
  `DecideInput`, `DecideResult`, `DecisionResult`, `DecisionKit`, `DecisionStore` (lines 240-339), and an optional
  `Platform.decision` factory (line 766). A platform without `decision` cannot host a model that has decisions.
- `packages/domain/src/Kernel.ts`: `decisionCodecs` and the one-implementation check (lines 402-450), and
  `decisionKit` (lines 1322-1500), which orders the instances by stream, runs `decide`, checks every recorded event,
  and produces one write per instance.
- `packages/domain/src/Model.ts`: hosts decisions after every aggregate (lines 669-689) and builds their clients.
- `packages/domain/src/DefinitionError.ts`: `ImplementedTwice` (166), `UnknownRead` (177), `UnreadRecord` (187),
  `DecisionsUnsupported` (197), `UndeclaredDecision` (206).
- `packages/domain/src/InMemory.ts` lines 909-960 and `packages/domain/src/DurableObjects.ts` lines 800-860,
  1065-1110, 1330-1390 and 2376-2409 (the hosts, below).
- Around it, main also drops `target` from commands: a command's `input` names its instance, and an aggregate that
  decides commands says which field with `keyOf` (`test/types/Decision.ts` lines 79-111; the commit is not among the known ones). So a
  command can move from an aggregate to a decision without its callers changing.

## How it commits

**In memory** (`InMemory.ts` main lines 909-960): one process. The decision takes the lock of every aggregate *type*
it reads, in name order, then checks the receipt cache for the command id, reads the states, decides, records on each
instance, keeps the receipt, and lets go. The lock is per type, not per instance (one semaphore per aggregate,
`InMemory.ts` main 652-666, also taken by each aggregate command, line 778): while a decision over `Item` runs, every
other `Item` command waits.

**On Durable Objects** (Cloudflare, Rivet, Effect Cluster all build on `DurableObjects.makePlatform`; `TwoPhase.ts`,
`DurableObjects.ts`): each instance has its own storage, so the platform runs a two-phase commit that one instance
drives.

- **The primary** is the first instance in stream order (lexicographic on `<aggregate>/<id>`, `Kernel.ts` main
  1354-1358). The sender makes one call to it, `txDecide`; the primary does the rest (`TwoPhase.ts` 273-360).
- **1. Read.** The primary reads its own state and, concurrently, every other instance's (`txRead`), then runs
  `decide`. A rejection stores nothing; but before answering it reads every version again, and if any moved it starts
  over, so a rejection always comes from states that existed together.
- **2. Hold.** It writes the whole plan to its own storage in one transaction, as one value under the key `intent`
  (`DurableObjects.ts` main 1093-1101): its own events, each other instance's events and read version, the receipt;
  then a durable wake-up. From here the decision needs only that storage.
- **3. Prepare.** It asks each other instance, one after another (a sequential loop, `TwoPhase.ts` 226-232), to check
  that it still has the version it was read at and to store its events as an *intent*. An instance holding an intent
  takes no other command.
- **4. Commit.** One local transaction on the primary: its own events, the receipt under the command id, and
  `Committed` with the list of instances still to be told. This write is the moment the decision happens.
- **5. Deliver.** It tells the others, concurrently; each turns its intent into events, state and deliveries in one
  local transaction. The primary forgets the outcome once every instance has acknowledged it.

**What aborts it**: an instance answers `Conflict` (it changed since it was read), `Busy` (another decision's intent
holds it), or cannot be reached after a few tries (`PEER_RETRY`: exponential from 50 ms, 4 retries, about a
second; `DurableObjects.ts` main 855). The primary records `Aborted` first, then tells the instances it prepared to
drop their intents, and decides the command again from the start against the new states.

**When something stops midway**: the outcome changes in one place only (the primary's storage) and in one atomic step
(commit or abort); every other step can be repeated. The primary's wake-up, or the next command or read that finds it
holding a plan for 2 seconds (`RESUME_AFTER_MS`, `DurableObjects.ts` main 828), runs the same steps again from
storage. A sender that hangs up does not cancel a held decision; resending with the same command id returns its
receipt. **A held instance** that hears nothing asks the primary (`txOutcome`) on its next command and on its own
wake-up; the primary answers `Pending`, the recorded outcome, or `Aborted` for an attempt it no longer knows.

**The blocking case**: if the primary's object cannot be reached at all, the instances it prepared stay held. A
command to one of them waits about 13 seconds (`HELD`: 60 retries, 10 ms rising to 250 ms; `DurableObjects.ts` main
837-841), then fails with `InstanceHeld`, and succeeds once the primary is back. This affects availability, not
correctness.

The strategy is replaceable: `TwoPhase.DecisionCommit` is a `Context.Reference` (default `twoPhase`, `TwoPhase.ts`
401-403) that the platform reads (`DurableObjects.ts` main 2094); provide another to the platform's Layer. The design
note names a single Postgres transaction on Effect Cluster as the one worth building next; it is not built.

## What it costs (from `packages/domain/docs/decision-design.md` lines 144-151)

- **Calls**: one from the sender, then about three per other instance (read, prepare, commit).
- **Writes**: the primary stores the plan and a wake-up, then the outcome. Each other instance stores its intent and a
  wake-up, and cancels the wake-up when it settles.
- **A held instance waits**: milliseconds normally, about 2 seconds when the driver stopped.
- **An unreachable primary blocks** its prepared instances; their commands fail after about 13 seconds.
- **Contention retries**: an attempt that meets a busy or changed instance starts over with backoff (10 ms rising to
  250 ms, jittered, 90 retries, about 20 seconds by its own comment, `TwoPhase.ts` 250-256) inside the primary's
  call, then dies with a
  defect that says the instances stayed held, kept changing, or could not be reached. A hot instance serializes every
  decision that reads it.
- **Rollout**: `decide` runs in the primary's object, so the code hosting an aggregate must also host every decision
  that reads it first; an object on older code answers with a defect and the sender retries through the rollout.
- **A decision that reads one instance** still goes through the same steps (`decision.mdx` main line 421).

**Not done** (design note lines 175-179): a decision's command cannot be scheduled (`Decision.Client` has `send` and
nothing else; see [Deadlines](./deadlines.md)); there is no `predict` for optimistic updates (it would need each
instance's state on the client); keyed logs (one log per tenant deciding DCB-style inside itself and taking part in a
decision as one participant) are an idea, not code.

## Rules, and the mistakes to avoid

- **Every command has one implementation.** A decision for a command an aggregate (or another decision) already
  implements is a type error on its entry in `decisions` and `ImplementedTwice` from `Domain.verify`
  (`Kernel.ts` main 409-433).
- **Read only hosted aggregates.** A decision reading an aggregate the model leaves out is a type error and
  `UnknownRead` from `Domain.verify` (`Kernel.ts` main 434-440).
- **Record only with a read instance's `record`.** Returning a bare event, or one recorded on an instance not read,
  dies with `UnreadRecord`; an event the command does not declare dies with `UndeclaredDecision`; an event the
  receiving aggregate does not fold dies with `UndeclaredEvent` (`Kernel.ts` main 1435-1480).
- **The host must support decisions.** This is not a `Domain.verify` finding: building the model's Layer on a platform
  without a `decision` factory dies with `DecisionsUnsupported` (`Model.ts` main 672-682), and on a Durable Object host
  a send whose primary's aggregate has no object binding dies with it too (`DurableObjects.ts` main 2388-2398).
- **`keyOf` cannot look anything up.** Put every instance id in the command's input; the server fills it before
  sending.
- **Inside `decide`, build events and rejections with `new`**, as the docs and source do. In a trial on 2026-11-19 on
  main, an event built with `.make` inside an aggregate's `decide` was not read by the prover (its report said `decide`
  returned something that is not an event) and nothing was proved. The app's diagnostic `newSchemaClass` reports
  every `new`, so domain
  blocks need an exception to it.
- **Keep commands, events, rejections and helpers reachable by relative imports** from the file the prover reads. The
  prover follows only specifiers that start with `.` (`Prove/internal/Source.ts` main line 229); in the same trial,
  classes imported by package name were reported as a class that is not an event, a rejection or a command.
- **Do not make one instance hot by accident.** An import draft read by every confirm of that import is fine; an
  organization instance read by every confirm in the organization would serialize them all. One read by every
  change of membership is fine: those are rare.
- **Do not size a decision to a whole file.** Prepares run one at a time and any busy or changed participant restarts
  the whole attempt (see the arithmetic below).
- Docs and source disagree twice: the design note writes `Story.when(Transfer, command)` (line 163), but main's
  `Story.when(command, options?)` takes the command alone (`Story.ts` main 282-289); and the unique-values docs page's
  test writes `customerId` twice and a `Registration.id` that does not exist. Follow the source.

## In this app

`keyOf` is a pure function of the command, so a decision can only read instances the command names. That decides
which of the app's rules are honest candidates:

| Rule | Instances | A decision? |
| --- | --- | --- |
| An organization always keeps an admin (rule 7) | every member of the organization | **No.** No command can name "every admin of the organization", and `keyOf` cannot look them up. The rule belongs in one `Organization` instance that holds the roles (an aggregate's own invariant). In the trial on 2026-11-19 on main, an `Organization` aggregate holding counts of admins and others, whose `ChangeRole` and `RemoveMember` reject `LastAdmin`, had `AlwaysKeepsAnAdmin` proved. Today: one guarded statement (`packages/access/host/src/PeopleStore.adapter.ts` lines 66-117). |
| A person added by email is not already a member (People) | the organization, and one claim keyed by organization and email | **Yes: the app's nearest match to the upstream registration example** (`examples/cloudflare-domain/packages/domain/src/Customer/Registration.decision.ts` at `main@dbfd0ddb`, which reads `Customer` and a `UsernameClaim` keyed by the name). Here `AddPerson` reads `Organization` (keyed by `organizationId`) and a `MemberEmail` claim (keyed by `${organizationId}:${lower-cased email}`); it rejects when the claim is held, else records the new member's role on the organization and the claim on the email. Today: `addPerson` reads, then writes (`packages/access/model/src/People/People.handler.ts` lines 61-72). |
| A SKU is unique in an organization across imports (rule 3) | the import, plus one item per row | **Yes, if** the item's id is `${organizationId}:${skuKey}` (see [Unique values](./unique-values.md)): the confirm reads the import and each named item, and an item at version > 0 is "already there". Only for small files; see the arithmetic. |
| A take-back keeps a changed item (rule 4) | the import, and each item it created | The edit stays one item's command (refused on an old revision). The **take-back** is the decision: it reads the import and each item it created, removes those still at revision 1, keeps the changed ones. |

Adding a person, in the app's words:

```typescript
// SKETCH: not compiled (main only)
import * as Domain from "@alchemy.run/domain"
import * as Effect from "effect/Effect"
import { CurrentActor } from "../CurrentActor.context.ts"
import { AddPerson, AlreadyMember, EmailClaimed, MemberAdded, NotPermitted } from "./AddPerson.command.ts"
import { MemberEmail } from "./MemberEmail.aggregate.ts"
import { Organization } from "./Organization.aggregate.ts"

export class Membership extends Domain.Decision(AddPerson, {
  reads: { organization: Organization, claim: MemberEmail },
  // emailKey: `${organizationId}:${lower-cased email}`, filled by the server before sending
  keyOf: (cmd) => ({ organization: cmd.organizationId, claim: cmd.emailKey }),
  decide: Effect.fn(function* ({ organization, claim }, cmd) {
    const actor = yield* CurrentActor
    if (actor.organizationId !== organization.id || actor.role !== "admin") return yield* new NotPermitted()
    if (claim.state._tag === "Claimed") return yield* new AlreadyMember({ role: claim.state.role })
    return [
      organization.record(new MemberAdded({ memberId: cmd.memberId, role: cmd.role })),
      claim.record(new EmailClaimed({ memberId: cmd.memberId, role: cmd.role }))
    ]
  }),
  transitions: {
    OnlyAFreeEmailIsClaimed: ({ before }) => before.claim._tag === "Free"
  }
}) {}
```

A confirm as a decision:

```typescript
// SKETCH: not compiled (main only)
export class Confirm extends Domain.Decision(ConfirmImport, {
  reads: { draft: ImportDraft, items: Item },
  keyOf: (cmd) => ({ draft: cmd.importId, items: A.map(cmd.items, (row) => row.key) }),
  decide: ({ draft, items }, cmd) => {
    if (draft.state._tag !== "Open") return new ImportNotOpen({ status: draft.state._tag })
    const fresh = A.filter(items, (item) => item.version === 0)
    return [
      ...A.map(fresh, (item) => item.record(new ItemCreated({ key: item.id, line: lineOf(cmd, item.id) }))),
      draft.record(new ImportConfirmed({ created: fresh.length, already: items.length - fresh.length }))
    ]
  }
}) {}
```

What a confirm as one decision across N item instances would cost. **This is arithmetic from the design note's own
numbers (lines 144-151) and the source's constants, not a measurement.** Instances = N items + 1 import. The stream
`ImportDraft/...` sorts before `Item/...`, so the import is the primary (if the aggregate were named `Import`, the
same holds: "Import" sorts before "Item").

| | 155 rows | 50,000 rows |
| --- | --- | --- |
| Instances read | 156 | 50,001 |
| Calls (1 + about 3 per other instance) | about 1 + 3 x 155 = 466 | about 1 + 3 x 50,000 = 150,001 |
| Prepares, one after another | 155 round trips | 50,000 round trips |
| Intents written, then applied | 155 + 155, plus 155 wake-ups set and cancelled | 50,000 + 50,000, plus 50,000 wake-ups |
| Any one participant busy or changed | restarts the attempt, up to 90 retries (about 20 s of backoff) | the same, with 50,000 chances per attempt to meet one |
| Primary's plan | one stored value (key `intent`) holding 155 items' events | one stored value holding 50,000 items' events (its size limit per host: not verified) |

Today the same confirm is one atomic D1 batch (`packages/catalog/host/src/ImportStore.adapter.ts`, `commit`). A
decision is a plausible shape for 155 rows; for 50,000 rows it is not, and the design note's own "keyed logs" (one
log per organization deciding inside itself) is the shape that would fit, and it is not built. In memory, any size
locks the `Item` and `ImportDraft` types for the whole decision.

- **Used today:** no. People are added by a read and a write in `addPerson`
  (`packages/access/model/src/People/People.handler.ts`); the confirm and take-back are single atomic D1 batches
  behind `ImportStore` (`packages/catalog/host/src/ImportStore.adapter.ts`, `commit` and `takeBack`); the last-admin
  rule is one guarded statement in `PeopleStore.adapter.ts`.
- **Where it goes:** a `Membership` decision beside `Organization` and `MemberEmail` aggregates in
  `packages/access/model/src/`, replacing `PeopleStore.add`; a `TakeBack` (and, for small files, `Confirm`) decision
  beside `ImportDraft` and `Item` in `packages/catalog/model/src/`, replacing `ImportStore.takeBack` (and `commit`);
  stories in the matching `test` folders.
- **What the person gets:** an admin who adds an email already in the organization is told so at once, and two admins
  adding the same email at the same moment cannot both succeed; the confirm and take-back stay all-or-nothing as
  today.

## How to check it

- A [story](./story.md): `Story.given` history on the organization and the claim, `Story.when` the add, then
  `Story.then` on each instance; a second story where the claim is held ends in `Story.rejected(new AlreadyMember(...))`
  and `Story.then` with no events on both (nothing recorded). The same shape for a take-back over the import and its
  items.
- `Domain.verify` reports `ImplementedTwice` and `UnknownRead`; `UnreadRecord`, `UndeclaredDecision` and
  `UndeclaredEvent` die when the faulty `decide` runs; `DecisionsUnsupported` dies when the Layer is built on a host
  without decisions.
- A `transitions` rule such as `OnlyAFreeEmailIsClaimed`, proved by `Verify.model` or `Prove.decision`
  (`Prove.ts` main 556), together with each aggregate's own rules ([Verify](./verify.md), [Prove](./prove.md)).
- **Not run:** the trial on 2026-11-19 ran stories and `Verify` on main for four aggregates, but no
  `Domain.Decision`. Everything on this page about a decision running is read from source and docs.
- The upstream tests: `packages/domain/test/Domain/Decision.test.ts` (in memory),
  `DecisionDurableObjects.test.ts` (interruptions), `DecisionApi.test.ts`, and `test/types/Decision.ts` (only the
  last read here).

## What it needs

`main@dbfd0ddb` (unpublished). A host with a `decision` factory: in memory, or any Durable Object host (Cloudflare,
Rivet, Effect Cluster); a host of our own must implement `Platform.decision`. Aggregates with `events` they fold
without deciding (also main only), and commands without `target` (main only).

## Verdict

**Use, from main:** model adding a person by email as a `Membership` decision over `Organization` and a `MemberEmail`
claim, and the take-back as a decision over the import and the items it created; keep the last-admin rule inside
`Organization`, and keep large confirms out of any per-item decision. Taking it needs the app to depend on
`@alchemy.run/domain` at `main@dbfd0ddb` or later (no npm release has `Domain.Decision`; how is the brief's
decision), a host with decisions, and an exception to `newSchemaClass` for domain blocks.

## Where this was read

- `website/src/content/docs/domain/decision.mdx`: not at `v2.0.0-beta.87`; on `main@dbfd0ddb` new (the live site
  documents beta.87 and has no Decision page)
- `packages/domain/docs/decision-design.md`: not at `v2.0.0-beta.87`; on `main@dbfd0ddb` new
- `packages/domain/src/Decision.ts`, `TwoPhase.ts`: not at `v2.0.0-beta.87`; on `main@dbfd0ddb` new
- `packages/domain/src/Kernel.ts`, `Platform.ts`, `InMemory.ts`, `DurableObjects.ts`, `Model.ts`,
  `DefinitionError.ts`, `index.ts`, `Story.ts`, `Prove/internal/Source.ts` at `v2.0.0-beta.87`; on `main@dbfd0ddb`
  changed (or new)
- `packages/domain/package.json`: on `main@dbfd0ddb`, the `"./*"` subpath export
- `packages/domain/test/types/Decision.ts`: on `main@dbfd0ddb` new
- `examples/cloudflare-domain/packages/domain/src/Customer/Registration.decision.ts`, `Customer.aggregate.ts`,
  `UsernameClaim.aggregate.ts`, `RegisterCustomer.command.ts`: on `main@dbfd0ddb` new or changed
