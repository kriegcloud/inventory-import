---
type: Reference
title: Rejection
description: A typed reason a command or read was refused, which records nothing and reaches the caller as declared; the app's stale review, closed import and changed item would be rejections.
tags: [alchemy-domain, declaration]
---

# Rejection

A rejection is the typed answer "no" to a [command](./command.md) (or a read). It is `Schema.TaggedError` with its
own type filled in, so it is a tagged class, an Effect error you can `yield*`, and a schema that crosses the wire. When
`decide` returns one, nothing is recorded and the state stays as it was, so the caller can change its input and try
again. It carries the data the caller needs to act ("the import is at version 9, you reviewed 7"). The docs: "A
refusal is a `Domain.Rejection`, a typed error that can carry data about why."
[https://alchemy.run/domain/command#declare-every-outcome]

## When to reach for it

- Every way a command can be refused by a business rule: the import is not open, the review is stale, the item
  changed since the person saw it, the actor may not do this.
- When the screen must say why in words and offer the next step, with the evidence in the value.
- Not for a fact the model cannot refuse (an upload expired, a deadline passed): such a command declares no
  `rejects`, and only such commands can be scheduled ([deadlines](./deadlines.md)).
- Not for defects (a bug, a lost connection): those are not declared and stay failures.

## How it is declared

`Domain.Rejection(tag, fields?, annotations?)` returns a class to extend.

```ts
// SKETCH: not compiled
class NotOpen extends Domain.Rejection("NotOpen") {}

class StaleReview extends Domain.Rejection(
  "StaleReview",
  { current: S.Int },
  { httpApiStatus: 409, description: "Someone changed the import after this review." }
) {}
```

| Argument | Default | What it is |
| --- | --- | --- |
| `tag` | required | The rejection's `_tag` |
| `fields` | `{}` | `Schema.Struct` fields: the evidence |
| `annotations` | `{}` | `Domain.Annotations` and every annotation `Schema.TaggedError` takes, for example `httpApiStatus` and `description`; they are the error schema's annotations too |

The class is built on `Schema.TaggedError`, so its instances are `Cause.YieldableError`s; it also has
`kind: "Rejection"`, `tag` and `annotations` (read back as `StaleReview.annotations.description`).

`rejects` takes any tagged error schema class, not only `Domain.Rejection`: `Rejection.Any` is only `Schema.Top` with
a constructor whose instances have `_tag` (`Rejection.ts` lines 16-18). A `Schema.TaggedError` of your own and
Effect's `HttpApiError` classes work. The kernel reads a rejection's tag from its schema's encoded `_tag` literal
(`internal.ts` lines 32-42).

How a caller handles one:

- From the server's own code, `imports.send(...)` fails with exactly the union of the command's `rejects`, so
  `Effect.catchTag("StaleReview", ...)` handles one by name and the type shows when all are handled.
- A [policy](./policy.md) or [saga](./saga.md) step must handle every rejection of what it sends.
- Through an [Api](./api.md), the RPC's error schema is the union of `rejects`, so the client decodes the same class;
  an HTTP API reads `httpApiStatus` from its annotations as for any Effect error ([http-api](./http-api.md)).
- In `decide`, a pure handler returns the rejection; an `Effect.fn` handler fails with it: `return yield* rejection`.
  The kernel takes any typed failure as the decision (`settle`, `internal.ts` lines 56-62), then judges it: a declared
  rejection is the answer, an undeclared one dies with `UndeclaredDecision` (`judge`, lines 77-101).

A rejected command records nothing **and stores no receipt**. The host looks up a stored receipt for the
`commandId`, decides, and returns the `Rejected` result before the line that writes the receipt: at beta.87
`InMemory.ts` lines 649, 663, 688 and `DurableObjects.ts` lines 804, 819, 838; on main `InMemory.ts` lines 733, 747,
772 and `DurableObjects.ts` lines 930, 946, 958. So a rejected command sent again with the same `commandId` is decided
again, against the state as it is then.

**How `make` is typed, and which to use.**

- beta.87: `RejectionClass` extends `Schema.Class<Instance<Tag, F>, Schema.TaggedStruct<Tag, F>,
  Cause.YieldableError>` (`Rejection.ts` lines 86-94). Effect's `make` returns `this["Type"]` (Effect `Schema.ts` line
  240), which for a class is `Self`, the first type argument (line 17425): the bare `{ _tag } & fields`, without
  `YieldableError`. The class instance from `new` is `S["Type"] & Inherited` (line 17436), which includes it. So
  `StaleReview.make(...)` is not the class instance: `decide` cannot return it and `yield*` cannot fail with it. The
  trial on 2026-11-19 confirmed it: with the app's compiler flags, `Rejection.make()` failed with TS2322 on beta.87,
  while `new` type-checked.
- main (commit 663f78894): the first type argument becomes `Instance<Tag, F> & Cause.YieldableError`, and `make` is
  declared with `this: C` returning `InstanceType<C>` (`Rejection.ts` lines 86-103 on main, `make` at 95-99), so it
  type-checks. Main's own type tests use it: `Stuck.make()` returned from a `Domain.Decision`'s `decide`
  (`packages/domain/test/types/Decision.ts` line 61) and `Story.rejected(Nope.make())` (`test/types/Story.ts` line 36).
  But the prover on main builds a domain class only from a `new` expression (`Prove/internal/Interpreter.ts` lines
  1106-1111, 864-870); `X.make(...)` it reads only for a schema it can model, such as an id (lines 606-616). The trial
  showed this for an event built with `.make` in `decide` (not read, nothing proved); a rejection built with `.make`
  was not run, and the source gives it the same path.

The rule at both refs: inside `decide` and everything it calls, build a rejection with `new StaleReview({ ... })`. The
app's Effect diagnostic `newSchemaClass` is an error (`tsconfig.base.json` line 190) and reports every `new`, so
domain blocks need an exception; the trial wrote it per line as `// @effect-diagnostics-next-line newSchemaClass:off`.

Types and helpers:

| Name | What it is | Where |
| --- | --- | --- |
| `Instance<Tag, F>` | `{ _tag } & fields` | `Rejection.ts` line 9 |
| `Any` | What `rejects` accepts: any schema class whose instances have `_tag` | lines 16-18 |
| `Annotations<Tag, F>` | `Domain.Annotations` plus the declaration annotations of a `Schema.TaggedError` | lines 24-25 |
| `make` | `Domain.Rejection` | lines 64-81 |
| `RejectionClass<Tag, F>` | The class type `make` returns | lines 86-94 (main: 86-103, with its own `make`) |

Checked in:

- `packages/domain/src/Rejection.ts` lines 9, 16-18, 24-25, 64-81, 86-94.
- `packages/domain/src/internal.ts` lines 32-42 (`rejectionTag`), 56-62 (`settle`), 77-101 (`judge`: an undeclared
  rejection is `UndeclaredDecision`).
- `packages/domain/src/Command.ts` line 260 (the RPC's error is `Schema.Union(rejects)` or `Schema.Never`).
- `packages/domain/src/Aggregate.ts` lines 304-312 (`send` fails with the command's rejections).
- `packages/domain/src/InMemory.ts` lines 649, 663, 688 and `DurableObjects.ts` lines 804, 819, 838.
- `packages/domain/src/Kernel.ts` lines 345-349 (rejection codecs keyed by tag, the first kept).
- Effect 4.1.4 (tag `effect@4.1.4`) `packages/effect/src/Schema.ts` lines 240, 17408-17436.

### What main changes

- `make` is typed as the class it is called on (commit 663f78894; `packages/domain/src/Rejection.ts` lines 86-103),
  so `StaleReview.make({ ... })` type-checks in `decide` and with `yield*`. For the prover, use `new` still.
- A command's RPC error union always includes `ConsistencyTimeout` beside its rejections, even with no `rejects`
  (`packages/domain/src/Command.ts` line 328 on main; see [command](./command.md)). A caller through an Api handles it
  separately: it means the command committed but a view was slow.
- A [decision](./decision.md) returns rejections under the same rules as an aggregate's `decide`.
- The prover reads a rejection class only when it is reachable from the aggregate's file by a relative import
  (`Prove/internal/Source.ts` line 229); one imported by package name is reported as "constructs a class, which is not
  an event, a rejection or a command" (the trial).

## Rules, and the mistakes to avoid

- A rejection means nothing happened. Never record an event and also reject.
- Name it after the business reason, the way the screen would say it: `StaleReview`, `NotOpen`, `ItemChanged`, not
  `Conflict` or `BadRequest`.
- Give it the data to act on: the current version, the item as it is now. The app's `ItemChanged` already carries
  the stored item for the screen.
- List it in the command's `rejects`. `decide` returning an unlisted one type-fails, and through a cast dies with
  `UndeclaredDecision`.
- Build it with `new` at both refs, with the `newSchemaClass` exception.
- A rejection's `commandId` is not remembered: resending the same id decides again, which is right for a stale
  review that the person fixes and resends.
- A command that undoes another process's step (a take-back the system sends after a failure) should not reject:
  record a fact for every state instead ([aggregate](./aggregate.md), "never refuse a compensation").
- Tags of rejections in one aggregate should be distinct: the kernel keys rejection codecs by tag per aggregate
  (`Kernel.ts` lines 345-349) and keeps the first.
- On main, reusing a rejection from another package by name hides it from the prover; declare it beside the command,
  or import it by a relative path.

## In this app

The confirm and the item edit. The trial on beta.87 ran an `Import` aggregate whose `ConfirmImport` rejected with
`StaleReview { current: 1 }` on a stale review and with `NotOpen` on a second confirm; the trial on main ran an
`ImportDraft` whose confirm by another organization's admin was rejected with `NotPermitted`, and an `Item` whose
`EditItem` rejected with `EditedSince` when the revision was not the current one. The block below uses those names;
it was not itself compiled.

```ts
// SKETCH: not compiled (beta.87)
import * as Effect from "effect/Effect"
import * as S from "effect/Schema"
import * as Domain from "@alchemy.run/domain"

export class StaleReview extends Domain.Rejection(
  "StaleReview",
  { current: S.Int },
  { httpApiStatus: 409, description: "Someone changed the import after this review: nothing was written." }
) {}

export class EditedSince extends Domain.Rejection(
  "EditedSince",
  { current: S.Int },
  { httpApiStatus: 409, description: "The item was changed after the person opened it." }
) {}

// inside the aggregate's decide (an Effect.fn handler):
//   // @effect-diagnostics-next-line newSchemaClass:off
//   if (cmd.reviewedAt !== version) return yield* new StaleReview({ current: version })

// In a handler of the app's own:
const confirm = Effect.fn("confirm")(function* (
  importId: ImportId,
  reviewedAt: number,
  ready: number,
  requestId: string
) {
  const imports = yield* Import
  // @effect-diagnostics-next-line newSchemaClass:off
  const command = new ConfirmImport({ reviewedAt, ready })
  return yield* imports
    .send(importId, command, { commandId: requestId })
    .pipe(Effect.catchTag("StaleReview", (r) => Effect.succeed({ outdated: r.current })))
})
```

- **Used today:** yes, in its own form: `S.TaggedError` classes with `httpApiStatus`, for example `AlreadyImported`,
  `ImportKept`, `ImportNotFound` (`packages/catalog/contract/src/Import/Import.rejection.ts`) and `ItemChanged`
  (`packages/catalog/contract/src/Catalog.contract.ts` line 307). On beta.87 they can be listed in `rejects` as they
  are; on main a proved aggregate needs them by relative import, so they move beside the commands or are declared
  again there.
- **Where it goes:** beside each command in its `*.command.ts` file; shared ones in `*.rejection.ts`
  ([project layout](./project-layout.md)), reachable from the aggregate's file by relative imports.
- **What the person gets:** a refused confirm or edit says why in words, with the numbers, and changes nothing.

## How to check it

- A [story](./story.md) step `Story.rejected(new StaleReview({ current: 1 }))` after the `when`; it type-checks only
  for a rejection the last command declares (`packages/domain/src/Story.ts` lines 215-220 and 419-422 at beta.87;
  `packages/domain/test/types/Story.ts` lines 35-36 on main), and the story then checks no event was committed with
  `Story.then(ref)` (no events). The trial ran `rejected` steps on beta.87 and on main.
- `Import.predict(state, command, options)` returns `{ _tag: "Rejected", rejection }` for a pure check without a host.
- Through the Api: send a stale confirm and read 409 with the rejection's body (not run).

## What it needs

Only `effect/Schema` to declare. A hosted model for a command to be rejected by. beta.87 is enough; build with `new`
at both refs.

## Verdict

**Use:** declare each refusal as a `Domain.Rejection` (or reuse the app's existing `S.TaggedError`s on beta.87) with
`httpApiStatus`, build them with `new` inside domain blocks (with an exception to `newSchemaClass`), and handle them by
tag at every sender.

## Where this was read

- https://alchemy.run/domain/command (the live site documents beta.87; rejections are documented on that page)
- `website/src/content/docs/domain/command.mdx` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: same path, changed
- `packages/domain/src/Rejection.ts` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: changed
- `packages/domain/src/Event.ts`, `Command.ts`, `internal.ts`, `Aggregate.ts`, `Kernel.ts`, `InMemory.ts`,
  `DurableObjects.ts`, `Story.ts` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: same paths, changed
- `packages/domain/src/Prove/internal/Interpreter.ts`, `Source.ts` on `main@dbfd0ddb`: new
- `packages/domain/skills/alchemy-domain/references/building-blocks.md` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: changed
- `packages/domain/test/types/Decision.ts`, `Story.ts` on `main@dbfd0ddb`: new
- Effect 4.1.4 (tag `effect@4.1.4`): `packages/effect/src/Schema.ts` lines 240, 17408-17436
- The app: `tsconfig.base.json` line 190, `packages/catalog/contract/src/Import/Import.rejection.ts`,
  `packages/catalog/contract/src/Catalog.contract.ts` line 307
