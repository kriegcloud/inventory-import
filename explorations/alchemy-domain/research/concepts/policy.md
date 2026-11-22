---
type: Reference
title: Policy
description: A standing rule that reacts to an event after it commits, by sending commands and calling external systems; this app would use one to ask for suggestions once a file is staged and to send mail after a confirm or a new member.
tags: [alchemy-domain, reaction]
---

# Policy

A policy is a "whenever this happens, do that" rule of the business, written as code. It names the aggregates or
views it listens to (`from`) and the events it reacts to (`on`); its handler runs after the event has committed,
decides whether to act, and acts by sending commands to aggregates or calling [external systems](./external-system.md).
Delivery is at least once and in order per key, so a policy must do no harm when it runs twice: the commands it sends
get ids derived from the event, and the calls it makes carry an idempotency key. The docs put it as: "Every policy
must have one property: running it twice does no harm" [https://alchemy.run/domain/policy]. A policy never replays
history, which is the opposite of a [projection](./projection.md).

## When to reach for it

- A sentence of the business starts with "whenever" or "when ... then": whenever a file is staged, suggest; whenever an
  import is confirmed, tell the person by mail; whenever a member is added, send the invitation.
- The rule can tolerate a moment between the event and the action. A rule that must hold at the instant of the commit
  is an invariant and belongs in the [aggregate's](./aggregate.md) `decide`.
- The reaction is one step: hear one event, decide one thing, send one command or make one call. A reaction that waits
  for a second event, tracks progress or undoes earlier steps is a [saga](./saga.md), which a policy starts.

## How it is declared

```typescript
// SKETCH: not compiled
import * as Domain from "@alchemy.run/domain"
import * as Effect from "effect/Effect"
import * as Schedule from "effect/Schedule"

export class SuggestOnStaging extends Domain.Policy(
  "SuggestOnStaging",
  {
    from: Import,               // one source, or a list of aggregates and views
    on: [ImportStaged]          // the events it reacts to
    // key: OrganizationId,     // optional: partition by something other than the source instance
    // keyOf: { ImportStaged: ({ event }) => event.organizationId }
  },
  { description: "Asks for suggestions for a file as soon as it is staged." }
) {}

export const SuggestOnStagingLive = SuggestOnStaging.toLayer(
  Effect.gen(function* () {
    const imports = yield* Import             // clients, ports and external systems: resolved once
    return Effect.fn(function* ({ key, source, event, envelope }) {
      // every rejection handled; nothing left in the error channel
    })
  }),
  { retry: Schedule.exponential("1 second").pipe(Schedule.upTo({ duration: "1 minute" })) }
)
```

- `from` (one source or several) and `on` are required; `key` and `keyOf` are optional (`Policy.Definition`). Without
  `key`, each source instance is its own partition: everything one import records is handled in order, one at a time.
- The trigger has `key`, `route`, `source`, `event`, `envelope` and, for a view source, `state` (`Policy.Trigger`).
- The handler's type is `(trigger) => Effect<void>`: no error channel and no requirements. Every rejection and every
  external error must be handled inside it, and every service is resolved in the build Effect.
- `toLayer(build, { retry })`: `retry` is any `Schedule`. It has no default: without it the handler is used as it is,
  and a defect goes straight to the platform's redelivery. With it, the handler is wrapped so that a defect is turned
  into a failure, retried on that schedule, and turned back into a defect when the schedule ends; then the platform's
  own redelivery takes over (`Policy.ts` 222-236).
- **What a handler has in its context.** The platform provides exactly two services around each run: `PolicyRun`
  (the counter that gives sends their ids) and `Telemetry.Correlation` (the triggering envelope's `correlationId`, so
  every command the policy sends keeps the flow) (`Kernel.ts` 1448-1453). Nothing else: no session, no actor, no
  request context. A command's `decide` that reads a `Domain.RequestContext` gets it from the sender: "Senders without
  that middleware (policies, stories) provide them" (`Command.ts` 35-36). The client captures every registered
  `Domain.RequestContext` in the sender's context and sends it with the command (`RequestContext.ts` 93-100,
  `Model.ts` 746-747), so a policy provides it with `Effect.provideService` around the send.
- List it in the model's `policies`; its Layer goes with the other handlers.

Checked in: `packages/domain/src/Policy.ts` at `v2.0.0-beta.87`: `From` 12, `SourcesOf` 14, `Trigger` 19-32, `Options`
38-41, `Handler` 49, `TriggerOf` 79-83, `Definition` 90-113, `PolicyKey` 121-123, `make` and `toLayer` 201-245 (the
retry wrapper 222-236), `PolicyClass` 250-279; `packages/domain/src/Kernel.ts` 612-627 (registration and the default
partition), 1424-1479 (`policyKit`: history skipped, command ids, context, telemetry);
`packages/domain/src/Aggregate.ts` 663-693 (`PolicyRun`, `commandIdFor`); `packages/domain/src/Model.ts` 669-678;
`packages/domain/src/Command.ts` 34-38; `packages/domain/src/RequestContext.ts` 93-116.

### Types and helpers

| Name | What it is | Where (beta.87; main, same lines) |
| --- | --- | --- |
| `Domain.Policy` (`make`) | Declares a policy class | `Policy.ts` 201 |
| `PolicyClass` | The class type `make` returns: `kind`, `policyName`, `definition`, `toLayer` | 250-279 |
| `Definition` | `from`, `key?`, `keyOf?`, `on` | 90-113 |
| `From`, `SourcesOf` | One source or a list of them; the sources of a `from` as a union | 12, 14 |
| `Trigger`, `TriggerOf` | What a handler receives; the trigger type of a policy class (with its declared `key`) | 19-32, 79-83 |
| `Handler`, `Options` | The handler's type; the `retry` option | 49, 38-41 |
| `PolicyKey`, `Identifier` | Type-level identity of a policy in requirements; its requirement identifier | 121-123, 116 |
| `Any` | What every policy class satisfies | 54-64 |
| `PolicyRun`, `commandIdFor` | The per-run id counter, and how a send picks its id (internal, `Aggregate.ts`) | 669-693; main 743-770 |

`Domain.Policy.Any` and `Domain.Policy.Trigger` are re-exported as types from the package root (`index.ts` 151-158).

### What main changes

- Commands carry their target in their input on main, so a policy sends `imports.send(new RecordSuggestions({
  importId, ... }))` in place of `imports.send(importId, new RecordSuggestions({ ... }))`. That is a change to
  [commands](./command.md) (`website/src/content/docs/domain/policy.mdx` 78 and 251 on main;
  `packages/domain/src/Policy.ts` 151 on main, doc comment only).
- The policy runtime is textually the same on main: `policyKit` (`packages/domain/src/Kernel.ts` 1794-1850 on main),
  `PolicyRun` and `commandIdFor` (`packages/domain/src/Aggregate.ts` 743-770 on main), the Durable Object
  `policyObject` (`packages/domain/src/DurableObjects.ts` 1665-1687 on main). The in-memory host adds run tracking for
  manual stories (`packages/domain/src/InMemory.ts` 1446-1471 on main).
- The redelivery budget after a policy's `retry` ends is shorter on main: Cloudflare's alarm callbacks retry from 2
  seconds doubling for twelve attempts, then hourly (`packages/alchemy/src/Workers/Workerd/AlarmCallback.ts` 38-49 on
  main), and `alarmCallbacks` for Rivet and Effect Cluster from 2 seconds doubling up to an hour
  (`packages/domain/src/DurableObjects.ts` 2807-2810 on main). Commit not known.
- Main's skill reference drops the `UsernameReservation` policy, because registration became a
  [decision](./decision.md) (`packages/domain/skills/alchemy-domain/references/building-blocks.md` on main).

## Rules, and the mistakes to avoid

- **Runs after the commit, never in the same step.** There is always a moment when the event exists and the policy has
  not acted.
- **At least once, in order per key.** On Durable Objects each policy key is one object; a delivery is accepted once
  (it stores `seen:<source>:<seq>` in the same transaction as it queues the delivery), then a durable queue runs
  deliveries in order and deletes each only after its handler succeeds (`DurableObjects.ts` 1204-1226, 330-386).
  A delivery whose handler keeps failing stays at the head of its key's queue, and later events for that key wait.
- **Command ids are derived for you.** Inside a handler, a send without `commandId` gets
  `<source>:<seq>:<policy>[:<route>]:<n>`, where `<source>` is the source stream (`Import/imp-1`), `<seq>` the event's
  place in it, and `n` counts the sends of that run from 0 (`Kernel.ts` 1446-1450; `Aggregate.ts` 680-693; the
  `Delivery` fields in `Platform.ts` 77-84). A send inside a saga step takes the step's id first; a `commandId` you
  pass always wins. The aggregate returns its stored receipt for a command id it has already seen (run in a trial on
  2026-11-19, on beta.87 in memory: the same `commandId` sent again answered the same receipt). The id depends on the
  order of sends: a handler whose branches send a different number of commands on a second run (because an outside
  answer changed) can give a later command a different id. Keep sends in a fixed order, or pass `commandId` yourself.
- **`retry` does not restart the count.** The counter is made once per delivery, outside the handler, and the `retry`
  wrapper runs the handler again inside it (`Kernel.ts` 1446-1453, `Policy.ts` 229-233). So on a retry under the
  schedule, the first send gets the next number, not 0: a command the failed attempt already sent is sent again under
  a new id, and the aggregate applies it twice. A redelivery by the platform does restart at 0. With `retry`, put
  every send after the step that can fail, or pass `commandId` derived from the event (`${envelope.stream}:${envelope.seq}:...`).
- **Handle the rejection a repeat brings.** A second run may find the work already done and be refused (an import no
  longer open). Catch that tag and treat it as done.
- **Outside calls need their own key.** Nothing dedupes a call to an external system. Pass the vendor an id derived
  from the event (`${envelope.stream}:${envelope.seq}`) and have the adapter use it as the idempotency key.
  Not `envelope.id`: that is the id of the aggregate instance that committed the event, the same for every event
  of that import (`Aggregate.ts` 45-63).
- **`retry` covers defects only.** The handler cannot fail with a typed error, so the schedule retries what died. When
  it ends, the defect goes to the platform. On Durable Objects the failing delivery stays first in its key's queue;
  the queue's backstop callback, scheduled 10 seconds after the delivery was staged, runs it again, and after that
  the host's callback budget paces it (`DurableObjects.ts` 362-381):
  - Cloudflare at beta.87: 30 seconds doubling for eight attempts, then every hour, never dropped (`alchemy/Callback`
    docs and `packages/alchemy/src/Workers/Workerd/AlarmCallback.ts` 38-46, as published with beta.87). On main: 2
    seconds doubling for twelve attempts, then every hour (`AlarmCallback.ts` 38-49 on main).
  - Rivet and Effect Cluster (`alarmCallbacks`): at beta.87 30 seconds doubling, eight attempts, then hourly
    (`DurableObjects.ts` 2202-2343); on main 2 seconds doubling up to an hour (`DurableObjects.ts` 2807-2810 on main).
  - A new delivery to the same key reports progress, which resets the budget and brings a retry 10 seconds later.
  - In memory a failed run is recorded as a failure of the story and is not run again (`InMemory.ts` 1280-1302).
  None of this was run in either trial.
- **No history.** A delivery marked as history is skipped (`Kernel.ts` 1429-1430): a policy added later acts only on
  new events, and a policy has no `version`.
- **No caller, so say who acts.** Commands sent by people pass through middleware that provides the actor. A policy
  provides it itself, with `Effect.provideService(CurrentActor, ...)` around the send. That reaches `decide` only if
  `CurrentActor` is declared as a `Domain.RequestContext`: the client sends only registered request contexts with the
  command (`RequestContext.ts` 93-116). The app's `CurrentActor` (`@inventory/kernel/Actor`) is a plain
  `Context.Service` today, so it would have to become one.
- **Keep it small.** One event, one decision, one action. A policy should not wait on anything long: a slow handler
  holds every later event for its key.

## In this app

Today these reactions are inline in requests or do not exist. Suggestions are asked for when the person presses
Suggest (`packages/catalog/model/src/Suggestion/Suggestions.handler.ts` 75-176), which takes one call from the
allowance, asks the model through `Answerer`, guards the answer and stores it with an activity line in one batch. The
confirm writes its activity line inside its own D1 batch. The app sends no mail at all: an admin adds a person by the
email of an account that already exists (`PeopleStore`), and I found no mail sender in `packages/` or `apps/`.

The worked example is the first of the three: once a file is staged, ask for suggestions on the person's behalf.

```typescript
// SKETCH: not compiled
import * as Domain from "@alchemy.run/domain"
import * as Effect from "effect/Effect"
import { CurrentActor } from "@inventory/kernel/Actor"

export class SuggestOnStaging extends Domain.Policy(
  "SuggestOnStaging",
  { from: Import, on: [ImportStaged] },
  { description: "Once a file is staged, asks for suggestions for what the rules cannot fix. Never writes an item." }
) {}

export const SuggestOnStagingLive = SuggestOnStaging.toLayer(
  Effect.gen(function* () {
    const imports = yield* Import
    const allowance = yield* ModelCalls      // external system: the access context's allowance
    const suggester = yield* Suggester       // external system: one operation per question
    return Effect.fn(function* ({ source, event, envelope }) {
      const callId = `${envelope.stream}:${envelope.seq}:suggest`
      const taken = yield* allowance.take({ id: callId, organizationId: event.organizationId, purpose: "suggest" })
      const answer = taken.kind === "taken"
        ? yield* suggester.suggest({ fileName: event.fileName, open: event.openDigest, requestId: callId }).pipe(
            Effect.catchTag("AiUnavailable", () => Effect.succeed(rulesAnswer(event.openDigest)))
          )
        : rulesAnswer(event.openDigest)
      yield* imports.send(source, new RecordSuggestions({ suggestions: answer.suggestions, by: answer.by })).pipe(
        Effect.provideService(CurrentActor, event.stagedBy),
        Effect.catchTag("ImportNotOpen", () => Effect.void)
      )
    })
  })
)
```

The block uses beta.87's send, `send(target, command)`; on main the import id goes inside `RecordSuggestions` and the
call is `imports.send(new RecordSuggestions({ importId: source.id, ... }))`. The command is built with `new` for
uniformity with domain blocks, where `decide` must use `new`; the app's Effect diagnostic `newSchemaClass` reports
every `new`, so files of domain blocks need an exception to it.

Why each part is there:

- **The allowance is taken before the call, once.** `callId` is the same on every run of this event. Today
  `AllowanceStore.take` inserts into `modelCall` with primary key `(organizationId, id)` and no `ON CONFLICT` clause,
  under `Effect.orDie` (`packages/access/host/src/AllowanceStore.adapter.ts` 33-48), so a second run with the same id
  would die on the key, not count twice. For a policy, the adapter should answer "taken" when the row for that id
  already exists. That keeps rule 9 (at most 40 calls a day, counted before the call) under redelivery.
- **The model call carries `requestId`.** The model provider is not idempotent; the id at least lets the adapter skip
  the call when proposals for it are already stored. A second answer that differs is harmless only because of the
  next point.
- **Proposals land through a command on the import.** `RecordSuggestions` gets its id from the event, so the import
  records them once; an import no longer open refuses with `ImportNotOpen`, which the policy treats as done. The policy
  never writes an item (rule 8): it can only propose, and the person accepts or rejects.
- **It acts for the person who staged the file.** `ImportStaged` carries the member who staged it, and the policy
  provides that member as `CurrentActor`, so the import's `decide` sees the same role it would on a request. Marking
  the work as the suggester agent's (the app's `asAgent`) still applies inside the adapter.

The other two, in outline:

- **After `ImportConfirmed`, mail the result.** A policy `MailImportResult` from `Import` on `[ImportConfirmed]` waits
  for the counts (they are written by the [projection](./projection.md), so it reads them through its port after
  `ItemsFromImports.caughtUp`, or listens to a later event that carries them), then calls `Mailer.send` with
  an idempotency key made from `envelope.stream` and `envelope.seq`. The activity line is better not a policy: it writes only to the app's own table, so it
  is a projection (`ActivityFromEvents`, keyed by organization, row id `${envelope.stream}:${envelope.seq}`), which a
  version bump can rebuild.
- **After `MemberAdded`, send the invitation.** A policy `InviteMember` from the people aggregate on `[MemberAdded]`
  calls `Mailer.send` with `template: "invitation"` and the same kind of key. A `Mailer` that refuses an address
  declares `error: [AddressRejected]`; the policy catches it and sends `MarkInvitationBounced` so the People page can
  say so. See [resend](./resend.md) for one provider.

- **Used today:** no. Suggestions run inside the Suggest request (`Suggestions.handler.ts` 139-176); the confirm's
  activity line is a statement in its batch (`ImportStore.adapter.ts` 1283-1295); there is no mail.
- **Where it goes:** policies beside the `Import` and people aggregates in `packages/catalog/model/src/Import/` and
  `packages/access/model/src/People/`; the allowance's `take` adapter in `packages/access/host/src/` learns to answer
  "taken" for an id it already holds.
- **What the person gets:** suggestions waiting on the Review step without pressing Suggest; a mail when an import is
  confirmed; an invitation mail when they are added.

## How to check it

- A [story](./story.md): `given` a staged import, `when` the command that stages it, `then` `ImportStaged`; then
  `Story.call(Suggester.suggest, { fileName: "items_messy.csv" })`, `Story.succeed(Suggester.suggest, {...})` and
  `then(imp, new SuggestionsRecorded({...}))`. A story fails if any external call is left unanswered, so every call the
  policy makes is accounted for (`Story.call`, `succeed`, `fail` in `packages/domain/src/Story.ts` 1925-1955).
- The same story with `Story.fail(Suggester.suggest, new AiUnavailable(...))` checks that the rules answer.
- A unit test of the allowance adapter: `take` twice with the same id answers "taken" both times and stores one row.
- The model build reports `NoEmitter` for an `on` tag no source emits and `DuplicateDefinition` for two policies with
  one name (`Kernel.ts` 581-627).
- A test that the handler sends the same command id on a second delivery of the same event, and that a run made to
  die once under `retry` does not send a command twice (see "`retry` does not restart the count").
- No policy was run in either trial on 2026-11-19. What was run is the aggregate's side: on beta.87 in memory, a
  repeated `commandId` answered the same receipt, which is what makes a policy's derived ids safe.

## What it needs

Any host: in memory for stories, Durable Objects on Cloudflare, Rivet or Effect Cluster. beta.87 has everything used
here. The app would need the `Import` and people aggregates, and `Suggester`, `ModelCalls` and `Mailer` declared as
external systems with adapters in the host packages.

## Verdict

**Use:** one policy per reaction (suggest on staging, mail on confirm, invite on member added), each taking its
allowance and making its outside call with an id derived from the event, and each sending at most one command. Write
the activity line with a projection, not a policy.

## Where this was read

- https://alchemy.run/domain/policy (the live site documents beta.87)
- `website/src/content/docs/domain/policy.mdx` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: same path, changed (command
  shape in examples)
- `packages/domain/src/Policy.ts` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: same path, changed (doc comment only)
- `packages/domain/src/Kernel.ts`, `Aggregate.ts`, `Model.ts`, `Platform.ts`, `DurableObjects.ts` at
  `v2.0.0-beta.87`; on `main@dbfd0ddb`: same paths, policy parts same
- `packages/domain/src/InMemory.ts` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: same path, changed (run tracking)
- `packages/alchemy/src/Callback.ts` and `packages/alchemy/src/Workers/Workerd/AlarmCallback.ts` as published with
  `alchemy@2.0.0-beta.87`; on `main@dbfd0ddb`: same paths, changed (retry budget)
- `packages/domain/src/Command.ts`, `RequestContext.ts` at `v2.0.0-beta.87` (who provides a command's context)
- `examples/cloudflare-domain/packages/domain/src/Fraud/*`, `Settlement/*`, `Transfer/TransferExecution.policy.ts`,
  `Transfer/TransferApprovalDeadline.policy.ts` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: same paths, changed
  (command shape)
- `packages/domain/skills/alchemy-domain/references/building-blocks.md` ("Policy") at `v2.0.0-beta.87`; on
  `main@dbfd0ddb`: same section, changed
- App: `packages/catalog/model/src/Suggestion/Suggestions.handler.ts`,
  `packages/access/host/src/AllowanceStore.adapter.ts`, `apps/inventory/migrations/0001_init.sql` (`modelCall`)
