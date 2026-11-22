---
type: Reference
title: Saga
description: A process of several steps that takes time, run as a durable Effect workflow with compensations and signals; this app would use one for a model pass over a large import that outlives one request.
tags: [alchemy-domain, reaction]
---

# Saga

A saga is a process that takes several steps and may take hours or days. It is an Effect
[workflow](./cluster-workflows.md): each step is an
`Activity` whose result is stored, so a run that is cut short replays from the top and skips the steps already done; it
can wait on a `DurableDeferred` (a signal from outside) or a `DurableClock` (a timer); and a step can carry a
compensation that runs if the run fails later. A saga has a `key` that names one run, so starting it twice gives one
run. A [policy](./policy.md) usually starts it, on the event that records the request. The docs put it as: "Each
step's result is stored, so a run that's interrupted resumes after its last finished step"
[https://alchemy.run/domain/saga].

## When to reach for it

- The process has more than one step, each committed on its own, across aggregates or outside systems.
- It waits: for a person (an admin's approval), for a timer, or for work that outlives one request.
- It must undo earlier steps when a later one fails (compensations).

Reach for a policy when one event leads to one action. Reach for a [deadline](./deadlines.md) (a scheduled command)
when the only "waiting" is "do this later unless something happens first". On main, reach for a
[decision](./decision.md) when several instances must change together at once.

## How it is declared

```typescript
// SKETCH: not compiled
import * as Domain from "@alchemy.run/domain"
import * as Effect from "effect/Effect"
import * as S from "effect/Schema"
import * as Activity from "effect/workflow/Activity"
import * as DurableClock from "effect/workflow/DurableClock"
import * as DurableDeferred from "effect/workflow/DurableDeferred"
import * as Workflow from "effect/workflow/Workflow"

export class SuggestionPass extends Domain.Saga(
  "SuggestionPass",
  {
    key: SuggestionPassId,                 // a string schema; one run per value
    input: { importId: ImportId, pieces: S.Int, askedBy: MemberId },
    result: { asked: S.Int, byRules: S.Int }, // what a completed run returns (void when omitted)
    rejects: [ImportNotOpen]               // every way a run can be refused
  },
  { description: "Asks the model about a large import in pieces, and stores what it proposes. Never writes an item." }
) {}

export const SuggestionPassLive = SuggestionPass.toLayer(
  Effect.gen(function* () {
    const imports = yield* Import           // resolved once
    return Effect.fn(function* ({ key, importId, pieces }) {
      // Activity.make, SuggestionPass.withCompensation, DurableDeferred.await, DurableClock.sleep,
      // Workflow.addFinalizer
      return { asked: 0, byRules: 0 }
    })
  })
)

// from a policy or a script
const passes = yield* SuggestionPass
const run = yield* passes.start(passId, { importId, pieces: 40, askedBy })
```

- `key` is required; `input`, `result` and `rejects` are optional (`Saga.Definition`). The workflow's payload is the
  key plus the input; its success is `Schema.Struct(result)` or `Void`; its error is `Schema.Union(rejects)` or
  `Never`.
- The handler gets the payload (`key` and the input fields) and returns the result or fails with a rejection. It may
  use the workflow's own services (`WorkflowEngine`, `WorkflowInstance`, `Workflow.Execution`, `Scope`) freely.
- `toLayer(build)` returns the saga's implementation; the model that lists the saga in `sagas` requires it.
- `withCompensation` is a static of the class (the workflow's own).
- `yield* SuggestionPass` gives its client: `start(key, input)` starts a run or returns the one already started with
  that key, at once; `get(key)` returns the run with that key. `key` may be the id or an object with `id`.
- A run (`Saga.Run`) has `executionId` (the key), `status`, `result` (waits for the end), `signal(deferred, value)`
  (completes a `DurableDeferred` the run waits on) and `interrupt` (the run fails where it waits and its compensations
  run).
- `status` is one of: `NotStarted`; `Running` (also while suspended, waiting on a signal or a clock); `Completed` with
  `result`; `Rejected` with `rejection` (the workflow's `Failed`, renamed); `Interrupted`; `Died` with `defect`. A
  failure is read before a defect, and a run that ended with neither is `Interrupted`.

Checked in: `packages/domain/src/Saga.ts` at `v2.0.0-beta.87`: `Definition` 85-102, `Status` 105-111, `Run` 114-131,
`Client` 137-142, `make` 269-324 (the workflow 281-291, `idempotencyKey` 288, `withCompensation` 305, `toLayer`
306-322), `toLayer`'s type 385-400, `engineFor` 411-452, `client` 455-489; `alchemy/src/Workflows.ts` as published
with `alchemy@2.0.0-beta.87` (`makeRun`: the status mapping and `result` polling); `packages/domain/src/Model.ts`
575-595 (`MissingWorkflowEngine`, saga clients); `effect` 4.1.4 `src/workflow/Activity.ts` 135-191,
`src/workflow/DurableDeferred.ts` 89-117 and 156-196, `src/workflow/DurableClock.ts` 45-138, `src/workflow/Workflow.ts`
931-986; the Durable Object engine,
`packages/alchemy/src/Workers/DurableObjectEngine.ts` as published with `alchemy@2.0.0-beta.87` and on main (the
same file but for its retry options); `packages/domain/src/InMemoryWorkflows.ts` 57-252.

### Types and helpers

| Name | What it is | Where (`Saga.ts`, beta.87; main, same lines) |
| --- | --- | --- |
| `Domain.Saga` (`make`) | Declares a saga class | 269 |
| `SagaClass` | The class type `make` returns: `sagaName`, `definition`, `workflow`, `Implementation`, `withCompensation`, `toLayer` | 339-401 |
| `Definition`, `KeySchema` | `key`, `input?`, `result?`, `rejects?`; the key's schema, a schema whose type is a string | 85-102, 68 |
| `Status`, `Run`, `Client` | A run's status; one run; the client `yield* Saga` gives | 105-111, 114-131, 137-142 |
| `Handler` | What the implementation runs per run: payload in, result or rejection out | 327 |
| `SagaKey`, `ImplementationKey` | Type-level identities of the saga's client and of its implementation in requirements | 166-168, 171-173 |
| `Identifier`, `ImplementationIdentifier` | Their requirement identifiers | 156, 159-163 |
| `Any` | What every saga class satisfies | 147-153 |
| `engineFor`, `client` | Renames a model's workflows to `<model>/<saga>`; builds a saga's client (internal) | 411-452, 455-489 |
| `InMemoryWorkflows.make`, `InMemoryWorkflows.Host` | The in-memory `WorkflowEngine` and what the in-memory platform gives it (internal) | `InMemoryWorkflows.ts` 57, 16-33 |

`Domain.Saga.Any`, `Domain.Saga.Status` and `Domain.Saga.Client` are re-exported as types from the package root
(`index.ts` 160-169).

### What main changes

- `alchemy/src/Workflows.ts` on main (`packages/alchemy/src/Workflows.ts` 171-341): `makeRun` is generic in its
  result and error types (an `ErasedWorkflow` cast replaces casts at each use). Behaviour is the same: same status
  mapping, same polling. `packages/alchemy/src/WorkflowEncoding.ts` is the same.
- The Durable Object engine (`packages/alchemy/src/Workers/DurableObjectEngine.ts`) is the same on main except its
  retries: at beta.87 the run and clock callbacks take `retry: { delay: "5 seconds" }` (379, 401-407), on main the
  host's default, 2 seconds doubling for twelve attempts, then hourly (`AlarmCallback.ts` 38-49 on main). Main also
  adds `provideCallbacks` (591-603), so a host hands the engine its `Callbacks` (commit `97ff09fca`, #3215).
- `packages/domain/src/Saga.ts` on main: doc-comment examples only (commands carry their target in their input,
  213-232).
- The docs (`website/src/content/docs/domain/saga.mdx` on main) reframe the page around [decisions](./decision.md):
  "A process is steps, not one decision" (33-37) and "Saga, policy or decision?" (60-66). The example's deferred is
  renamed from `Decision` (`"decision"`) to `Approval` (`"approval"`), so `Story.signal` and `run.signal` name
  `Approval`. Commands are sent without a separate target.
- The examples follow: `examples/cloudflare-domain/packages/domain/src/Transfer/ExecuteTransfer.saga.ts` 30 and
  `TransferExecution.policy.ts` 4, 33, 37 on main.
- The in-memory workflow engine (`packages/domain/src/InMemoryWorkflows.ts`) is the same.

## Rules, and the mistakes to avoid

- **Key it by what it is about.** A policy runs at least once, so a second `start` with the same key must give the same
  run. Both engines ignore the second `start`, input included: in memory (`InMemoryWorkflows.ts` 135-154), and on
  the Durable Object engine, where `start` writes the execution row only if there is none, keeps the first payload,
  and otherwise only schedules a first run that was never scheduled (`DurableObjectEngine.ts` 475-503 on main,
  478-506 at beta.87). A run cannot be restarted with new input under the same key. To run the process again, use a
  new key (here, the import and its revision).
- **A run replays from the top on every wake.** On the Durable Object engine each execution is one object with its
  journal in its own SQLite. A start, a completed deferred, a fired clock, an interrupt or a resume all schedule the
  same single callback job, so runs of one execution never overlap; the run replays the workflow from the top,
  returns stored step results, runs the first unfinished step and stores it, and stops where it waits
  (`DurableObjectEngine.ts` 376-383, 427-469 on main). A run whose own effect dies is retried by the callback (at
  beta.87 from 5 seconds doubling, eight attempts, then hourly; on main from 2 seconds, twelve attempts, then
  hourly). That backoff is for a run that keeps dying only: each new journal entry that wakes the run (a completed
  deferred, a scheduled clock) advances a progress counter (`workflow_progress`) in the same transaction, so the next
  step after a success runs at once instead of inheriting an earlier failure's delay (362-372 and 385-425 on main;
  the same mechanism at beta.87).
  A clock keeps the due time it was first given across replays (222-241).
- **Starting, signalling or polling a run can hold the caller for about a minute.** Each is a call to the execution's
  object, retried 35 times from 100 ms doubling, at most 2 seconds apart, while the object is unreachable (a deploy, a
  reset); a failure the object reports dies on the caller (`DurableObjectEngine.ts` 561-579 on main, 564-582 at
  beta.87). A failed start leaves neither the execution row nor its first run, and its retry writes both (475-505).
  `start` returns once the row is written, before the run (the client starts with `discard: true`,
  `alchemy/src/Workflows.ts` 281-289 on main). This is one more reason to start sagas from a policy, not a request.
- **A finished child wakes its parent.** When a run that was started by another run finishes, the engine resumes the
  parent, which replays and reads the child's result (`DurableObjectEngine.ts` 468 and 540-544 on main). A deferred
  completed from inside its own run is written locally, with no call (203-218).
- **Each step a named `Activity`, names unique within a run.** A step's stored result is found by its name (in memory,
  `<workflow>/<executionId>/<name>/<attempt>`, `InMemoryWorkflows.ts` 182-210). Two steps with one name share a stored
  result. In a loop, put the index in the name.
- **Declare `success` on a step that returns something.** `Activity.make` defaults `success` to `Schema.Void`
  (`Activity.ts` 147-148), so an undeclared value is not kept across a replay. Declare `error` for every failure the
  step can return; the failure is encoded through it before it is stored.
- **One command per step.** Commands sent inside a step get ids from the step (`<workflow>/<executionId>/<step>/<n>`,
  `n` from 1, restarting on each attempt, `packages/alchemy/src/WorkflowEncoding.ts` 95-119; `packages/domain/src/Aggregate.ts` 677-693), so
  a step that runs again sends the same ids and the aggregate applies each once. A step can run twice: retried, or cut
  short after its command committed and before its result was stored. Its result is stored only when it completes
  (`workflow_activity`, key `<name>/<attempt>`, `DurableObjectEngine.ts` 149-190): a step that suspends, waiting on a
  clock or a child run, stores nothing and runs from its start on the next replay (`effect` 4.1.4
  `src/workflow/Activity.ts` 124-129).
- **Outside calls in a step need their own key.** Nothing dedupes them. `Activity.idempotencyKey(name)` gives a stable
  hash of the execution id and the name (`Activity.ts` 276-292).
- **Compensations register only on top-level steps** and run in reverse order when the run fails or is interrupted
  (`Workflow.ts` 968-986). A compensation must not be refused: send a command that records a fact in every state.
- **Record the outcome on an aggregate.** Register `Workflow.addFinalizer` first, so it runs after every
  compensation, and have it send the failure to the aggregate that screens read. Anything that needs to react to how a
  saga ends reacts to those events, not to `result`.
- **Never wait on `result` in a policy or a request.** It polls (100 ms doubling, at most every 5 seconds) with no time
  limit (`alchemy/src/Workflows.ts`, `POLL` and `makeRun`). Use it in tests and scripts.
- **A signal's first value wins, and it is kept.** In memory, `signal` on a deferred that is already done does
  nothing (`InMemoryWorkflows.ts` 220-227). On the Durable Object engine a signal is stored with `INSERT OR IGNORE`
  into the execution's `workflow_deferred` table, so a second value is dropped; only the first wakes the run
  (`DurableObjectEngine.ts` 385-399, both refs). A signal sent before the run reaches its `await` is stored and read
  on the next replay (192-201). Let an aggregate decide a race (approved or expired) and pass on its verdict, so
  there is one source of truth.
- **Short sleeps are not durable by default.** `DurableClock.sleep` runs a sleep at or under `InMemoryThreshold` (60
  seconds unless the engine sets it) as an ordinary in-memory activity; longer ones schedule a durable clock
  (`DurableClock.ts` 80-138), as a step named `DurableClock/<name>`. Effect's own doc says the Cloudflare Durable
  Object engine sets the threshold to zero, but that is Effect's engine: no Alchemy engine sets `InMemoryThreshold`
  (searched in `packages/alchemy/src` and `packages/domain/src` at both refs). So on Alchemy's Durable Object engine a
  sleep of 60 seconds or less runs as an ordinary sleep inside a step, and is not durable while it waits. Pass
  `inMemoryThreshold: 0` to make a short sleep durable.
- **A model with a saga needs a workflow engine.** Building it without one dies with `MissingWorkflowEngine`
  (`Model.ts` 581-590). Runs are stored under `<model>/<saga>`, so two models never share runs (`Saga.ts` 405-452).

## In this app

The best fit is a model pass over an import that outlives one request. Today Suggest is one request: it takes one call
from the allowance, asks once with a digest of what is open, and stores what passes the guard
(`packages/catalog/model/src/Suggestion/Suggestions.handler.ts` 75-176). For a file of tens of thousands of rows, one
question is too large and one request too short. A saga asks in pieces, waits between them, stores proposals as it
goes, and never writes an item.

```typescript
// SKETCH: not compiled
import * as Domain from "@alchemy.run/domain"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as S from "effect/Schema"
import * as Activity from "effect/workflow/Activity"
import * as DurableClock from "effect/workflow/DurableClock"

export class SuggestionPass extends Domain.Saga(
  "SuggestionPass",
  {
    key: SuggestionPassId,                         // `${importId}/${revision}`: a new pass after new decisions
    input: { importId: ImportId, pieces: S.Int, askedBy: MemberId },
    result: { asked: S.Int, byRules: S.Int },
    rejects: [ImportNotOpen]                       // the import was confirmed or removed meanwhile
  },
  { description: "Asks about an import in pieces and stores the proposals. Never writes an item." }
) {}

export const SuggestionPassLive = SuggestionPass.toLayer(
  Effect.gen(function* () {
    const imports = yield* Import
    const openRows = yield* OpenRows               // port: one piece of what is still open, read from D1
    const allowance = yield* ModelCalls            // external system
    const suggester = yield* Suggester             // external system
    return Effect.fn(function* ({ key, importId, pieces, askedBy }) {
      const ask = Effect.fn(function* (piece: number) {
        const id = `${key}/ask/${piece}`
        const open = yield* openRows.piece(importId, piece)
        const taken = yield* allowance.take({ id, purpose: "suggest", by: askedBy })
        const byRules = Answered.make({ suggestions: rulesFor(open), by: "rules" })
        if (taken.kind === "usedUp") return byRules
        return yield* suggester.suggest({ open, requestId: id }).pipe(
          Effect.catchTag("AiUnavailable", () => Effect.succeed(byRules))
        )
      })
      const answers = yield* Effect.forEach(A.range(1, pieces), (piece) =>
        Effect.gen(function* () {
          const answer = yield* Activity.make({ name: `ask/${piece}`, success: Answered, execute: ask(piece) })
          yield* Activity.make({
            name: `store/${piece}`,
            error: ImportNotOpen,
            execute: imports.send(importId, new RecordSuggestions({ suggestions: answer.suggestions, by: answer.by }))
          })
          yield* DurableClock.sleep({ name: `pause/${piece}`, duration: "2 seconds" })
          return answer
        })
      )
      return { asked: answers.length, byRules: A.filter(answers, (a) => a.by === "rules").length }
    })
  })
)
```

The block uses beta.87's send, `send(target, command)`; on main the import id goes inside the command. The command is
built with `new` for uniformity with domain blocks, where `decide` must use `new`; the app's Effect diagnostic
`newSchemaClass` reports every `new`, so files of domain blocks need an exception to it.

(`Answered` is a schema class of the suggestions and who answered; `rulesFor` is the rules'
answer the app already has in `Suggest.rules.ts`.) Read it against the rules above: every step has a unique name;
`ask/<n>` declares `success`, so a replay returns the stored answer and never asks or takes a call again; the
allowance and the model each get an id derived from the run and the piece; `store/<n>` is one command, and its id comes
from the step; the import refuses proposals once it is no longer open, and that `ImportNotOpen` ends the run as
`Rejected`, which is right: a confirmed import needs no more suggestions. There is no compensation: proposals already
stored are harmless, and the person may still use them. The pause keeps the pass from spending the day's 40 calls in a
burst; the allowance still decides when it stops (rule 9). The screen follows the pass through a
[view](./view.md) of the import's `SuggestionsRecorded` events, not through `run.result`. A "Stop" button calls
`run.interrupt`. It starts from `SuggestOnStaging` (see [policy](./policy.md)) for files over a size.

The other two the brief names, honestly weighed:

- **An upload of many chunks that becomes an import.** A saga keyed by the upload would wait on a `Finished` deferred
  (`"finished"` or `"expired"`), which a policy signals from an `Upload` aggregate that decides the race between
  `FinishUpload` and a scheduled `ExpireUpload`; then one step sends `OpenImport`, and a finalizer discards the chunks
  of an expired upload. Today's protocol (`beginUpload`, `putChunk`, `finishUpload`, `discardUpload`) is already
  idempotent per chunk and driven by the browser. What a saga adds is only the clean-up of an abandoned upload, which
  a deadline on the `Upload` aggregate plus one policy also gives. Prefer the deadline.
- **A take-back that waits for an admin's approval.** A `TakeBackRequest` aggregate records the request, an approval
  by an admin whose member id differs from the requester's (people are told apart by id), a refusal, or an expiry
  scheduled for 48 hours. A saga keyed by the take-back id registers a finalizer that records a failure, awaits an
  `Approval` deferred (`"approved"`, `"refused"`, `"expired"`) signalled by a policy, and on approval runs one step
  that sends `TakeBackImport` to the import, refused with `NothingInForce` when there is nothing left to take back
  (rule 10). It needs no compensation: the take-back is the last step. A plain policy on `TakeBackApproved` that sends
  `TakeBackImport` does the same with less; the saga earns its place only if more steps join (a mail to the
  requester, a second approval for a large take-back).

- **Used today:** no. The Suggest request asks once and returns (`Suggestions.handler.ts` 139-176); uploads and
  take-backs are single requests (`ImportStore.adapter.ts`, `beginUpload` to `discardUpload`, and `takeBack`).
- **Where it goes:** `packages/catalog/model/src/Suggestion/SuggestionPass.saga.ts`, listed in the catalog model's
  `sagas`, started by `SuggestOnStaging`; the Review step's suggestions panel reads the import's view.
- **What the person gets:** suggestions for a large file arrive piece by piece while they review, and the pass keeps
  going if they close the tab.

## How to check it

- A [story](./story.md) runs the saga in memory: `when` the staging command, then for each piece `Story.call(Suggester
  .suggest, ...)` and `Story.succeed(...)`, `then(imp, new SuggestionsRecorded(...))`, and at the end
  `Story.saga(SuggestionPass, passId, { _tag: "Completed", result: { asked: 3, byRules: 0 } })`.
- The same story with the import confirmed half way ends with `Story.saga(SuggestionPass, passId, { _tag: "Rejected",
  rejection: new ImportNotOpen() })`; with a defect, `{ _tag: "Died" }`.
- `Story.clock` or `Story.advance("2 seconds")` moves the durable clocks; `Story.signal(Saga, key, deferred, value)`
  completes a deferred (`packages/domain/src/Story.ts` 583-618). A run that dies fails the story unless a step expects
  it.
- No saga was run in either trial on 2026-11-19; the stories above are not yet run.
- A replay test: interrupt the host after `store/2`, start again, and assert `ask/1` and `ask/2` were not asked again
  (no new `Story.call`) and no extra `modelCall` row was written.

## What it needs

A host that provides Effect's `WorkflowEngine`; the saga's author does not pick it. In memory, `InMemoryWorkflows`.
On Cloudflare, `DomainCloudflare.layerDurableObjects` provides it on the model's Effect-native Worker
(`packages/domain/src/Cloudflare/index.ts` 495-560 at beta.87), built from Alchemy's `makeDurableObjectEngine`, so
adopting a saga on this host brings Alchemy's Durable Object workflow engine with it. On Rivet, the same core
(`packages/domain/src/Rivet/index.ts` 225 at beta.87, 226 on main). On the Effect Cluster host, the pool's engine:
Effect's cluster workflow engine on a Node pool, Alchemy's Durable Object engine on the Durable Object pool
(`packages/domain/src/EffectCluster/index.ts` 760-768 on main). The engines, and what each needs, are on
[workflows](./cluster-workflows.md). beta.87 has everything used on this page. The app would need the
`Import` aggregate with `RecordSuggestions`, and `Suggester` and `ModelCalls` as [external systems](./external-system.md).

## Verdict

**Use:** a `SuggestionPass` saga keyed by import and revision, one named step per piece for the ask (with `success`
declared) and one for the store, started from a policy. For uploads use a deadline; for an approved take-back a policy
is enough until the process grows more steps.

## Where this was read

- https://alchemy.run/domain/saga (the live site documents beta.87)
- `website/src/content/docs/domain/saga.mdx` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: same path, changed
- `packages/domain/src/Saga.ts` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: same path, changed (doc comments only)
- `packages/domain/src/InMemoryWorkflows.ts` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: same
- `packages/domain/src/Model.ts`, `Aggregate.ts`, `Story.ts`, `Cloudflare/index.ts` at `v2.0.0-beta.87` (saga parts)
- `packages/alchemy/src/Workers/DurableObjectEngine.ts` and `Workers/Workerd/AlarmCallback.ts` as published with
  `alchemy@2.0.0-beta.87`; on `main@dbfd0ddb`: same paths, changed (retry options, `provideCallbacks`)
- `packages/domain/src/Rivet/index.ts`, `EffectCluster/index.ts` at `v2.0.0-beta.87` and `main@dbfd0ddb` (which engine
  each host gives a saga)
- `packages/effect-cluster/src/internal/Bootstrap.ts`, `Cloudflare/PoolWorker.ts`, `Cloudflare/internal/Objects.ts` on
  `main@dbfd0ddb` (the pool's engine)
- `alchemy/src/Workflows.ts` and `alchemy/src/WorkflowEncoding.ts` as published with `alchemy@2.0.0-beta.87`; on
  `main@dbfd0ddb`: `packages/alchemy/src/Workflows.ts` changed (types only), `packages/alchemy/src/WorkflowEncoding.ts`
  same
- `effect` 4.1.4 (the app's installed copy): `src/workflow/Workflow.ts`, `Activity.ts`, `DurableDeferred.ts`,
  `DurableClock.ts`
- `examples/cloudflare-domain/packages/domain/src/Transfer/*` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: same paths,
  changed (`Approval`, command shape)
- `packages/domain/skills/alchemy-domain/references/building-blocks.md` ("Saga") at `v2.0.0-beta.87`; on
  `main@dbfd0ddb`: same section, changed
- App: `packages/catalog/model/src/Suggestion/Suggestions.handler.ts`, `packages/catalog/host/src/ImportStore.adapter.ts`
