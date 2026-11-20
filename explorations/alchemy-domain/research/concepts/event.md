---
type: Reference
title: Event
description: A fact the model recorded, named in the past tense and stored in an envelope; the app's import history (staged, rows settled, confirmed, taken back) and item edits would be events.
tags: [alchemy-domain, declaration]
---

# Event

An event is a fact a command produced: `ImportConfirmed`, `ItemEdited`. It is a Schema class with a tag and fields,
so it encodes the same way wherever it is stored or sent. An aggregate's history is its events and nothing else: its
state comes from folding them with `evolve`, and every [view](./view.md), [policy](./policy.md) and
[projection](./projection.md) is fed from them. When an event commits it is wrapped in an envelope that says which
instance, which position, when and which command. The docs: "An event records something that happened."
[https://alchemy.run/domain/event]

## When to reach for it

- For each thing the business would say happened to an import or an item, in the past tense.
- When a screen later needs the outcome without asking the aggregate: put the counts a confirm decided in
  `ImportConfirmed`, so the Result screen's view reads them straight from the event.
- When an audit line is wanted: the event, its envelope and `correlationId` are the audit trail.
- Not for a refusal. A refused command records nothing; that is a [rejection](./rejection.md).

## How it is declared

`Domain.Event(tag, fields?, annotations?)` returns a class to extend. The instance is `{ _tag } & fields`.

```ts
// SKETCH: not compiled
class RowSettled extends Domain.Event(
  "RowSettled",
  { line: S.Int, outcome: RowOutcome, by: MemberId },
  { description: "A reviewer settled one row of an import." }
) {}

class ImportRemoved extends Domain.Event("ImportRemoved") {} // an event with no data
```

| Argument | Default | What it is |
| --- | --- | --- |
| `tag` | required | The event's name and `_tag`; unique across the model (`DuplicateEventTag` otherwise) |
| `fields` | `{}` | `Schema.Struct` fields |
| `annotations` | `{}` | `Domain.Annotations` and every annotation `Schema.TaggedClass` takes: they are the event schema's annotations too |

The class is a `Schema.Class` built on `Schema.TaggedClass`, plus `kind: "Event"`, `tag` and `annotations`.

**How `make` is typed, and which to use.** On beta.87 `EventClass` extends `Schema.Class<Instance<Tag, F>, ...>`
(`Event.ts` lines 96-104), and Effect's `make` returns `this["Type"]` (Effect `Schema.ts` line 240), which for a class
is its first type argument, `Self` (line 17425): the bare `{ _tag } & fields`. That is the same type as an event's class
instance, so `Event.make(...)` type-checks where `decide` wants an event. On main (commit 663f78894) `EventClass` declares
its own `make<C>(this: C, input, options?): InstanceType<C>` (`Event.ts` lines 101-109), so a subclass's own members
are in the result. The trial on 2026-11-19 settled which to use:

- beta.87, with the app's compiler flags and Effect diagnostics as errors: events written with `.make(...)`
  type-check; events written with `new` type-check too, and the diagnostic `newSchemaClass` reports every `new`.
- main, with [Verify](./verify.md): an event built with `Event.make({...})` in `decide` is not read by the prover. The
  report said "decide for StageImport returns something that is not an event", and nothing was proved. The prover's
  interpreter builds a domain class only from a `new` expression (`Prove/internal/Interpreter.ts` lines 1106-1111 and
  864-870 on main); it reads `X.make(...)` only for a schema it can model, such as an id (lines 606-616).

So the rule at both refs: inside `decide` (and anything `decide`, `evolve`, an invariant or a transition calls),
build an event with `new`. That conflicts with the app's house rule held by `newSchemaClass` (an error in
`tsconfig.base.json` line 190): domain blocks need an exception, which the trial wrote per line as
`// @effect-diagnostics-next-line newSchemaClass:off`.

The envelope every committed event carries (`Aggregate.Envelope`, a `Schema.Struct`, so Api clients decode it too):

| Field | Type | Meaning |
| --- | --- | --- |
| `id` | string (the aggregate's id type in `Envelope<Id>`) | The instance that committed it |
| `stream` | string | Its stream, `<Aggregate>/<id>`, for example `Import/imp_42` |
| `seq` | number | Position in the stream, from 1 |
| `at` | `DateTimeUtc` | The commit time: the same `now` the decide context had |
| `commandId` | string | The command that produced it |
| `correlationId` | string | The first command of the chain that led here: the same for a command, its events, and every reaction and command they cause |

`evolve` gets the envelope as its third argument. A command's events in one commit get consecutive `seq` values from
the stream's version before it, all with the same `at` and `commandId`.

Types and helpers:

| Name | What it is | Where |
| --- | --- | --- |
| `Fields` | `Schema.Struct.Fields`, the shape of an event's fields | `Event.ts` line 7 |
| `Data<F>` | The decoded type of those fields | line 12 |
| `Instance<Tag, F>` | `{ _tag } & Data<F>` | line 17 |
| `Any` | What every event class satisfies (`kind: "Event"`, `annotations`, `tag`) | lines 22-27 |
| `Annotations<Tag, F>` | `Domain.Annotations` plus the declaration annotations of a `Schema.TaggedClass` | lines 33-34 |
| `make` | `Domain.Event` | lines 74-91 |
| `EventClass<Tag, F>` | The class type `make` returns | lines 96-104 (main: 96-113, with its own `make`) |

Checked in:

- `packages/domain/src/Event.ts` lines 7, 12, 17, 22-27, 33-34, 74-91, 96-104.
- `packages/domain/src/Aggregate.ts` lines 45-64 (`Envelope`), 157-163 (`evolve` receives it).
- `packages/domain/src/Kernel.ts` lines 954-995 (`commit` stamps `seq: version + index + 1`, `at: now`, `commandId`),
  296-299 (`DuplicateEventTag`).
- Effect 4.1.4 (tag `effect@4.1.4`) `packages/effect/src/Schema.ts` lines 240 (`make` returns `this["Type"]`) and
  17408-17436 (`Class`: `Type` is `Self`, the first type argument, at 17425; `new` returns `S["Type"] & Inherited` at
  17436).

### What main changes

- `EventClass` gains its own `make`, typed to return `InstanceType<C>` of the class it is called on, so a subclass's
  own members are in the result type (commit 663f78894; `packages/domain/src/Event.ts` lines 101-109 on main). This
  changes only the type: the prover still reads `new` only.
- A [decision](./decision.md) can create events too, with `instance.record(event)` on each aggregate it reads; an
  aggregate lists such events in its own `events` field ([aggregate](./aggregate.md)). So on main "only `decide`
  creates events" means an aggregate's `decide` or a decision's `decide`.
- The prover reads an event class only when it is reachable from the aggregate's file by a relative import. Events
  imported by package name are not read; the report says the code "constructs a class, which is not an event, a
  rejection or a command" (the trial; `Prove/internal/Interpreter.ts` line 869; `Prove/internal/Source.ts` line 229
  resolves a specifier only when it starts with ".").
- The docs page `website/src/content/docs/domain/event.mdx` is the same at both refs.

## Rules, and the mistakes to avoid

- Name what happened in the business: `ImportTakenBack`, not `ImportUpdated` or `StatusChanged`.
- Events are created only as a command's answer: an aggregate's `decide` returns them (and, on main, a decision
  records them). Views can also emit derived events of their own as they fold (the docs' `StatementLine`), and
  projections append to [streams](./stream.md); neither changes an aggregate's history.
- A command may record only the events it lists. Returning another type-fails; through a cast it dies at run time
  with `UndeclaredDecision` (`internal.ts` lines 103-117).
- Build events with `new` inside a domain block, with the `newSchemaClass` exception; `.make` type-checks but the
  prover on main does not read it.
- Record the outcome, not the request: `ImportConfirmed` carries `ready`, `created`, `updated`; `evolve` and every view
  copy those numbers and never recompute the review.
- Record who: put the `MemberId` in the event when a person decided something (`RowSettled.by`). The envelope has
  no actor field.
- Committed events are never changed or removed. A correction is a new event (`ImportTakenBack` reverses
  `ImportConfirmed`), so the history shows both.
- Old events are read again on every rebuild. Add a new field as an optional key so events stored before it still
  decode (`S.OptionFromOptionalKey(...)`, which keeps absence as an `Option`). When the meaning changes, add a new event
  type instead of changing what an old one means.
- One command may record several events when several things happened.
- For time in state, read `at` from the envelope in `evolve`; never `Date.now()`.

## In this app

The import's history, as events. The trial on beta.87 ran an `Import` aggregate recording `ImportStaged` and
`ImportConfirmed`; the trial on main ran an `ImportDraft` with `StageImport`, `SettleRow`, `LeaveRowOut`,
`RecordSuggestion`, `ConfirmImport` and `TakeBackImport`, and its broken copy named the event `RowLeftOut`. The block
below uses those names; it was not itself compiled, and the fields are this page's.

```ts
// SKETCH: not compiled
import * as S from "effect/Schema"
import * as Domain from "@alchemy.run/domain"
import { MemberId, OrganizationId, RowOutcome } from "./Import.schema.ts" // relative, so the prover reads it

export class ImportStaged extends Domain.Event("ImportStaged", {
  organizationId: OrganizationId,
  fileName: S.String,
  rows: S.Int,
  ready: S.Int
}) {}

export class RowSettled extends Domain.Event("RowSettled", {
  line: S.Int,
  outcome: RowOutcome,
  by: MemberId,
  note: S.OptionFromOptionalKey(S.String) // added later: events stored before it still decode
}) {}

export class RowLeftOut extends Domain.Event("RowLeftOut", { line: S.Int, by: MemberId }) {}

export class ImportConfirmed extends Domain.Event("ImportConfirmed", {
  reviewedAt: S.Int,
  created: S.Int,
  updated: S.Int,
  already: S.Int,
  notImported: S.Int
}) {}

export class ImportTakenBack extends Domain.Event("ImportTakenBack", { removed: S.Int, kept: S.Int }) {}

// evolve reads the commit time from the envelope:
// ImportConfirmed: (s, e, { at }) => (s._tag === "Open" ? { ...s, _tag: "Imported" as const, confirmedAt: at } : s)
// decide builds them with new:
// // @effect-diagnostics-next-line newSchemaClass:off
// return [new RowLeftOut({ line: cmd.line, by: actor.memberId })]
```

The item's: `ItemCreated` (by a confirm), `ItemEdited` (with the fields changed and `by`), `ItemRestored` (by a
take-back). The import's `revision` today is the stream's `version`: every settled row adds one.

- **Used today:** no. The app writes rows (`importDecision`, `importBatch`, `importOutcome`, `importChange`) and an
  `activity` line per change, in D1 batches (`packages/catalog/host/src/ImportStore.adapter.ts`).
- **Where it goes:** one `*.command.ts` file per command holding its events
  ([project layout](./project-layout.md)), reachable from the aggregate's file by relative imports; the `activity`
  table and the Activity screen would read a [view](./view.md) or [projection](./projection.md) of these events.
- **What the person gets:** the Activity screen can say, for every import and item, what happened, who did it and
  when, from one record.

## How to check it

- A [story](./story.md): `Story.then(ref, ...events)` asserts the exact events a command committed, in order
  (`packages/domain/src/Story.ts` lines 287-297 at beta.87). In the trial on beta.87 a story that left a recorded
  event unasserted failed with "committed events no step asserts", so every event a story causes must be named.
- `Import.predict(state, command, { id, now, version })` returns the events and one envelope per event with `seq`
  continuing from `version` (`Aggregate.ts` lines 470-534), a pure unit test for `seq` and `at`. On main `predict`
  takes no `id`: it reads it through `keyOf`.
- `Domain.verify(model)` reports `DuplicateEventTag` when two event classes share a tag (`DefinitionError.ts` line 7).
- On main, `Verify.aggregate(X)` reports "decide for <command> returns something that is not an event" when an
  event is built with `.make` (`Prove/internal/Paths.ts` lines 238-242), and "constructs a class, which is not an
  event, a rejection or a command" when it is imported by package name; nothing is proved then. A report that proves
  every rule is the check that the rule above was kept.
- For a change of an event's shape: decode a stored old payload with the new schema in a test.

## What it needs

Nothing beyond `effect/Schema`: declaring an event needs no host. Storing it needs a model on a host
([in memory](./host-in-memory.md), [Durable Objects](./host-cloudflare.md), [Rivet](./host-rivet.md),
[Effect Cluster](./host-effect-cluster.md)). beta.87 is enough.

## Verdict

**Use:** declare the import's and the item's history as events on beta.87, built with `new` inside domain blocks
(with an exception to `newSchemaClass`), putting the counts and the actor in the event and reading time from the
envelope.

## Where this was read

- https://alchemy.run/domain/event (the live site documents beta.87)
- `website/src/content/docs/domain/event.mdx` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: same
- `packages/domain/src/Event.ts` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: changed
- `packages/domain/src/Aggregate.ts`, `Kernel.ts`, `internal.ts`, `DefinitionError.ts`, `Story.ts` at
  `v2.0.0-beta.87`; on `main@dbfd0ddb`: same paths, changed
- `packages/domain/src/Prove/internal/Interpreter.ts` on `main@dbfd0ddb`: new
- `packages/domain/skills/alchemy-domain/references/building-blocks.md` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: changed
- Effect 4.1.4 (tag `effect@4.1.4`): `packages/effect/src/Schema.ts` lines 240, 17408-17436
- The app: `tsconfig.base.json` line 190
