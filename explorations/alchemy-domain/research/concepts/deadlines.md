---
type: Reference
title: Deadlines
description: A command scheduled to run later on one aggregate instance, durably, which the instance accepts or ignores; for this app, discarding an upload left unfinished for an hour and expiring an open import nobody touched.
tags: [alchemy-domain, pattern]
---

# Deadlines

A deadline is a [command](./command.md) scheduled to reach one [aggregate](./aggregate.md) instance later. Because
nobody is waiting for its answer when it fires, only a command that never rejects can be scheduled: it reports a fact
("the hour is up") and records nothing when the fact no longer applies. The race between the deadline and the thing
it guards (finishing the upload, saving a decision) is settled by the instance itself, which handles one command at a
time. The docs say: "A scheduled command fires when nobody is waiting for its answer, so it never rejects"
[https://alchemy.run/domain/deadlines, from `website/src/content/docs/domain/deadlines.mdx` line 12 at
`v2.0.0-beta.87`].

## When to reach for it

- Something should end by itself if nothing else happens in time: an unfinished upload, an import left open, an
  approval window.
- The ending is one instance's own business, so it can be a command to that instance.
- Not for a rolling count of recent events (the model-call allowance): a `decide` that reads `now` from its context
  and counts only the calls within the last 24 hours needs no timer at all.
- Not for a command a [decision](./decision.md) implements: those cannot be scheduled (main, `Decision.Client` has
  only `send`, `packages/domain/src/Decision.ts` main lines 201-215; `packages/domain/docs/decision-design.md` line
  177).

## How it is declared

A command with no `rejects` (an omitted `rejects` is `[]`, `packages/domain/src/Command.ts` beta.87 line 122), an
aggregate whose `decide` for it records something only while it applies, and a `schedule` call, usually from a
[policy](./policy.md) on the event that starts the waiting. Inside `decide`, the event is built with `new`, as the
docs do: in a trial on 2026-11-19 on main the prover did not read an event built with `.make` there, so domain blocks
need an exception to the app's `newSchemaClass` diagnostic. The command a policy schedules is built with `new` too, for
uniformity.

```typescript
// SKETCH: not compiled (beta.87)
export class ExpireUpload extends Domain.Command("ExpireUpload", {
  target: UploadId,
  events: [UploadDiscarded]
}) {}

// In the Upload aggregate's decide: discard only while still uploading.
// ExpireUpload: (upload) => upload._tag === "Uploading" ? [new UploadDiscarded({ reason: "unfinished" })] : []

export const UploadDeadlineLive = UploadDeadline.toLayer(
  Effect.gen(function* () {
    const uploads = yield* Upload
    return Effect.fn(function* ({ source }) {
      yield* uploads.schedule(source, new ExpireUpload(), { after: "1 hour", commandId: `expire:${source.id}` })
    })
  })
)
```

The API, at beta.87:

- **`client.schedule(target, command, options)`** returns `ScheduleReceipt { commandId, at }` (`at` is a
  `DateTime.Utc` on the platform's clock). The command type is limited to `Schedulable<Def>`: the aggregate's
  commands whose `rejects` is empty. Its error channel is `never`.
- **`ScheduleOptions`**: exactly one of `at: DateTime.Utc` or `after: Duration.Input`, plus an optional `commandId`
  that *names* the scheduled command on its instance.
- **Replacing**: scheduling again under the same name replaces the earlier one, pending or already run, so a deadline
  can be armed again. The name is `options.commandId`, or the arming's own id when you give none. Each arming also
  gets its own commit id, derived like a send's: inside a policy run or a saga step it is deterministic, so a policy
  that runs again for the same event arms nothing new; outside them it is a fresh random id
  (`Aggregate.commandIdFor`), so a second call from a handler replaces the first.
- **`client.unschedule(target, commandId)`** cancels by name. Once it succeeds the command never runs. It fails with
  `AlreadyExecuted` (the command ran first), `AlreadyCancelled` (cancelled before) or `NotScheduled` (nothing was
  ever scheduled under that name); each carries `{ aggregate, id, commandId }`.
- **`Due`** (internal to hosts): what a platform is handed, `{ at }` in epoch milliseconds or `{ afterMillis }`
  measured on the platform's own clock.
- **Stories**: `Story.clock(at)` moves a story's clock to a time; `Story.advance(by)` moves it forward by a duration
  (`"1 hour"`); every scheduled command now due fires.

Checked in: `packages/domain/src/Aggregate.ts` at `v2.0.0-beta.87` lines 84-89 (`ScheduleReceipt`), 196-214
(`AlreadyExecuted`, `AlreadyCancelled`, `NotScheduled`), 220-232 (`ScheduleOptions`), 238 (`Due`), 313-338 (`schedule`,
`unschedule`), 347-350 (`Schedulable`), 680-693 (`commandIdFor`); `packages/domain/src/Model.ts` at beta.87 lines
797-827 (the client: name, arming id, `Due`); `packages/domain/src/Story.ts` at beta.87 lines 582-586 (`clock`,
`advance`); `packages/domain/src/Command.ts` at beta.87 line 122 (`rejects` defaults to `[]`).

**How each host fires it, and how durable it is:**

- **In memory** (`packages/domain/src/InMemory.ts` beta.87 lines 192-197, 296-318, 697-729): timers live in a map in
  the process, keyed `model/aggregate/id/name`, so a new arming replaces the old one. In real time a forked sleep
  fires them; with `manual` (stories) they fire when `drain` or `Story.clock` reaches their time. A timer fires only if
  it is still the one under its key, inside the instance type's lock. Not durable: a restart loses every timer.
- **Durable Objects** (`packages/domain/src/DurableObjects.ts` beta.87 lines 866-937): one durable callback job per
  name (`domain:schedule`). `armed:<name>` keeps the latest arming's commit id and due time; `scheduled:<name>` keeps
  the token of the one job allowed to run, or `cancelled`. When the job fires it commits the command only if its token
  is still current, then clears the key; the commit's receipt then answers `AlreadyExecuted`. Durable across restarts.
  On Cloudflare the job uses the runtime's own `makeCallback`; on Rivet and Effect Cluster, callbacks are rows in the
  instance's storage over its one alarm, retried from 30 seconds doubling, then every hour after 8 failed attempts,
  delivered at least once (`DurableObjects.ts` beta.87 lines 2161-2200, the comment at 2195-2197; `Rivet/index.ts`
  line 290, `EffectCluster/index.ts` line 662).

### What main changes

- `schedule` loses its `target`: `schedule(command, options)`; the instance comes from the aggregate's `keyOf` over
  the command's `input` (`packages/domain/src/Aggregate.ts` main lines 378-381; `Model.ts` main lines 1058-1082).
  `unschedule(target, commandId)` keeps its target (`Aggregate.ts` main lines 389-392). `ScheduleOptions`,
  `ScheduleReceipt`, `Schedulable` and the three errors are unchanged (main lines 90, 249-270, 273-288, 401).
  Commands declare `input: { uploadId: UploadId }` instead of `target`, and the docs page changes accordingly
  (`website/src/content/docs/domain/deadlines.mdx` main lines 26, 61, 118, 144, 165).
- On Durable Objects a fired job now waits until no decision holds the instance (`whenFree`, `DurableObjects.ts` main
  lines 1204 and 1273-1284), and a failure there is a defect so the job is redelivered (main line 1286).
- In memory, a timer whose sleep ends early (Node rounds and coalesces timers) sleeps again for what is left, so it
  never fires before the platform's clock reaches its time (`InMemory.ts` main lines 379-388; commit `538fd9a46`,
  #3376).
- `Story.clock` and `Story.advance` are unchanged (`Story.ts` main lines 592-595).
- A decision's command cannot be scheduled (`Decision.ts` main lines 201-215; design note lines 175-177).

## Rules, and the mistakes to avoid

- **The scheduled command never rejects.** A guard that would reject (wrong state) becomes "record nothing".
- **Keep the guard in `decide` even when you unschedule.** A policy cancels after the guarding event is recorded, so
  the deadline can fire in between.
- **Name it to cancel it.** Give `commandId` a name you can rebuild (`expire:<uploadId>`); otherwise keep
  `receipt.commandId`.
- **Tolerate the "nothing to cancel" answers** in a policy that may run twice: catch `AlreadyExecuted` and
  `AlreadyCancelled`.
- **Re-arming from a handler replaces; re-arming from the same policy run does not.** This follows from how the
  arming id is derived (see above).
- **Do not trust the in-memory host to keep a deadline across a restart.** Only the Durable Object hosts are durable.
- The beta.87 docs say a policy that runs again arms nothing new, even after the command ran (`deadlines.mdx` beta.87
  line 69), while `schedule`'s own doc says a new arming under the same name replaces one pending or already run
  (`Aggregate.ts` beta.87 lines 318-320). Both hold: a re-run of the same policy reuses
  the same arming id (no change); a later, different trigger has a new arming id (arms again).

## In this app

Three timed rules, and what fits each:

1. **An upload left unfinished for an hour is discarded.** Today nothing fires at the hour: the *next* upload of the
   organization deletes every upload and its chunks older than 60 minutes, in the same batch that inserts itself
   (`beginUpload`, `packages/catalog/host/src/ImportStore.adapter.ts` lines 375-400; `abandonedAfterMinutes = 60` in
   `packages/catalog/model/src/Staging/Upload.rules.ts` line 20). An organization that never uploads again keeps the
   rows. As a deadline: `BeginUpload` records `UploadBegun`, a policy schedules `ExpireUpload` after 1 hour under
   `expire:<uploadId>`, `FinishUpload` and `DiscardUpload` move the upload out of `Uploading`, and the expiry records
   `UploadDiscarded` only while it is still uploading (the sketch above). The chunks' storage is freed by a
   [projection](./projection.md) or the host on `UploadDiscarded`.
2. **An open import nobody touched expires.** The app has no such rule today; an open import stays open until
   confirmed or removed. How long "untouched" is, and whether expiring removes it or only hides it, is Benjamin's
   decision (not decided). The shape: every saved row decision re-arms `ExpireImport` under `expire:<importId>`; the
   import ignores it unless it is still `open` with the same revision it was armed at.
3. **The day's allowance window.** Not a deadline. The allowance is a rolling 24 hours (`windowStart` subtracts 24
   hours from now, `packages/access/model/src/Allowance/Allowance.rules.ts` line 16), counted and taken in one
   `INSERT ... WHERE (SELECT COUNT(*) ...) < limit` (`packages/access/host/src/AllowanceStore.adapter.ts` lines
   33-41). As an aggregate per organization, `decide` reads `now` from its context (`DecideContext.now`,
   `Aggregate.ts` beta.87 line 38) and counts the recorded calls after `now - 24 hours`; no timer is needed. In a
   trial on 2026-11-19 on main, an `Allowance` aggregate whose `TakeModelCall` rejects `AllowanceUsedUp` at 40, with a
   separate `StartNewDay` command, had `NeverMoreThanTheDaysAllowance` proved by `Verify.aggregate`; how the new day
   arrives (a scheduled `StartNewDay`, or a `now`-based count) was not part of the trial, and nothing was scheduled.

- **Used today:** no. The next upload sweeps abandoned uploads (`ImportStore.adapter.ts`, `beginUpload`); open imports
  never expire; the allowance is a windowed count in `AllowanceStore.adapter.ts`.
- **Where it goes:** an `Upload` aggregate and an `UploadDeadline` policy in the catalog model
  (`packages/catalog/model/src/Staging/`), replacing the sweep in `beginUpload`; an `ExpireImport` command on the
  import aggregate once its duration is decided.
- **What the person gets:** an abandoned upload stops showing among the open ones an hour after it stalled, whether or
  not anyone uploads again.

## How to check it

A [story](./story.md) with the clock (`packages/domain/src/Story.ts` beta.87 lines 582-586). Not run: neither trial
on 2026-11-19 scheduled a command.

```typescript
// SKETCH: not compiled (beta.87)
Story.when(upload, new BeginUpload({ fileName: "items_messy.csv", rowCount: 155, chunkCount: 1 })),
Story.then(upload, new UploadBegun({ fileName: "items_messy.csv" })),
Story.advance("59 minutes"),
Story.then(upload),
Story.advance("1 minute"),
Story.then(upload, new UploadDiscarded({ reason: "unfinished" })),
```

And the race: finish the upload at minute 59, move the clock past the hour, `Story.then(upload)` with no events (the
expiry recorded nothing). For cancelling, `unschedule` twice: the second fails with `AlreadyCancelled`.

## What it needs

Beta.87 (published). A durable host for real deadlines: Cloudflare, Rivet or Effect Cluster through the Durable
Objects platform; the in-memory host for stories only. On main the call shape changes (no `target` on `schedule`).

## Verdict

**Use:** model the upload as an aggregate with a never-rejecting `ExpireUpload` scheduled for one hour under
`expire:<uploadId>`, guarded in `decide`, on a Durable Object host; keep the allowance as a `now`-based count with no
timer; add import expiry once its duration is decided.

## Where this was read

- https://alchemy.run/domain/deadlines (the live site documents beta.87)
- `website/src/content/docs/domain/deadlines.mdx` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: changed
- `packages/domain/src/Aggregate.ts` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: changed
- `packages/domain/src/Model.ts` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: changed
- `packages/domain/src/InMemory.ts` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: changed
- `packages/domain/src/DurableObjects.ts` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: changed
- `packages/domain/src/Story.ts` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: changed
- `packages/domain/src/Decision.ts`: on `main@dbfd0ddb` new
