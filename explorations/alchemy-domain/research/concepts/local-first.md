---
type: Reference
title: Optimistic updates, offline intents and predict
description: How a client shows a write before the server answers and keeps working offline (intents with stable command ids, replayed in order); this app's review decisions are those intents, and `predict` would tell the screen a confirm will be refused before it is sent.
tags: [alchemy-domain, people-and-clients]
---

# Optimistic updates, offline intents and predict

The server decides every command; the client only shows what it asked for before the answer arrives. Two of the
four ways the docs describe work with a domain model: optimistic updates (show a pending line, confirm it when the
event carrying the same `commandId` arrives on a live read) and offline intents (record what the person asked for,
never a fact only the server can establish, keep the queue across reloads, and send it in order when the connection
returns). A conflict is then just a typed rejection. On top of that, `MyAggregate.predict` runs the aggregate's own
`decide` and `evolve` in the browser, so a refusal can be shown before the request. The docs: "Intents wait in a
queue, survive a reload, and go to the server in order once it can be reached." [https://alchemy.run/domain/local-first]

## When to reach for it

- A write the person makes many times in a row and should not wait for: here, each row decision in the review.
- A screen that must keep working on a bad connection: the review of a long file.
- A refusal that the client can already know from state it holds (the import is no longer open, the person is a
  viewer): `predict` shows it at once.
- Not for a write whose outcome only the server knows (the confirm's per-row results, a take-back, a model's
  answer): show its progress instead.

## How it is declared

There is no "local-first" declaration. The pieces are a stable command id per intent, the Api client's
`commandId` option, a live read whose entries carry `envelope.commandId`, and `predict`.

```typescript
// SKETCH: not compiled
// A resend with the same commandId returns the first receipt instead of deciding again.
const sent = client.DecideRow(importKey, { row, step, saw, flags }, { commandId: `${session}:${n}` })

// Decide locally, as the server would. `context` is required when the command's middleware provides something.
// (This block is the first form, which named a version; the brief's confirm names `seen`, `screen` and `planAt`.)
const outcome = Import.predict(state, new ConfirmImport({ reviewedAt: version }), {
  id: importKey,                      // beta.87 only; main reads the id from the command through `keyOf`
  now: DateTime.nowUnsafe(),
  version,                            // optional, default 0: predicted envelopes continue from it
  commandId: `${session}:${n}`,       // optional, default ""
  context: Context.make(CurrentActor, member)
})
// outcome._tag: "Accepted" { events, envelopes, state } | "Rejected" { rejection } | "Unpredictable" { cause }
```

What the source does:

- `predict(aggregate, state, command, options)` finds the command's handler, calls it with a `DecideContext`
  (`id`, `now`, `commandId`, `stream` = `"<Aggregate>/<id>"`, `version`), and if the decision is an Effect, runs it
  with `options.context` through `Effect.runSyncExit`. A decision that suspends (anything asynchronous) or dies gives
  `Unpredictable`; a handler missing for the command gives `Unpredictable` with a `DefinitionError`
  (`UnhandledCommand`); a returned value that the command did not declare gives `Unpredictable` too. Otherwise a
  rejection comes back as `Rejected`, and accepted events are folded with the aggregate's `evolve`, one envelope each
  with `seq = version + index + 1`, `at = now`, `correlationId` defaulting to `commandId`. It never throws. An
  effectful `decide` that fails with a declared rejection gives `Rejected`, as the kernel does (`settle` and `judge`
  in `packages/domain/src/internal.ts`).
- The aggregate class has a static `predict` typed per command: the state type, the command's events and
  rejections, and `context` required exactly when `Command.ContextOf` of that command is not `never`.
- `MyView.evolve(state, { name, event, source, envelope })` folds one predicted event the way the server's view will,
  so a screen can show a view's next state from `predict`'s events.
- The Api client's `CommandOptions.commandId`: "A resend with the same id returns the first receipt instead of
  deciding again." This is what makes replay safe.
- A live read's `events(key, { after })` gives history after a cursor, a `CaughtUp` frame, then live entries; each
  entry's `envelope.commandId` names the command that caused it (`Read.isEvent` filters entries).

Checked in: `packages/domain/src/Aggregate.ts:396-417` (`PredictOptions`, `PredictBase`), `:419-436` (`Prediction`), `:470-534`
(`predict`), `:751-759` (static), `:811-831` (typed signature); `packages/domain/src/index.ts:91-99` (the exported
types); `packages/domain/src/View.ts:628-650` (`evolve`); `packages/domain/src/Api.ts:122-184` (`ViewClient`),
`:247-250` (`CommandOptions`); all at `v2.0.0-beta.87`. The pattern itself: `website/src/content/docs/domain/local-first.mdx`
and `optimistic-updates.mdx`, and `examples/cloudflare-domain/packages/web/src/Bank.ts` (read in full).

### What main changes

- `predict` loses `id`: `PredictOptions<R>` has `now`, `version?`, `commandId?`, `correlationId?`, `context`, and
  the instance id comes from the aggregate's `keyOf(command)` (`targetOf`, or `""` when the aggregate does not handle
  the command) (`packages/domain/src/Aggregate.ts:452-468` `PredictOptions`, `:520-586` `predict`, `:837-845` static,
  `:906-918` typed signature, `:860-863` `targetOf` on main; `index.ts:96` exports `PredictOptions<R>` with one
  parameter). Follows from commands without `target`, which are unpublished.
- The example and docs send commands as `{ input: { accountId, amount }, commandId }` instead of
  `{ target, input, commandId }` (`Bank.ts`, `local-first.mdx`, `optimistic-updates.mdx`, the skill's `frontend.md`).
- A command's success can carry `commits` (one receipt per stream) on main's Foldkit adapter; see [foldkit](./foldkit.md).
- The pattern (intents, queue, replay, rejection as conflict) and every "not included" statement are the same.

## Rules, and the mistakes to avoid

- Record intents, not facts: "leave row 12 out", never "row 12 is not imported". The server's answer is the fact.
- One command id per intent, made once and kept with it (in the queue, across reloads). The example uses
  `"<page session>:<counter>"` with a fresh session per page load (`DomainFoldkit.next`); never reuse a session from
  cached HTML.
- Send in order and stop at the first intent that cannot reach the server; the rest stay queued, so a later intent
  never overtakes an earlier one.
- Retry only an unknown outcome (transport, a defect), always with the same id. A rejection ends the intent; a
  middleware refusal (`Denied`) waits for the person (sign in again) and does not block the others.
- A success reply means the write committed; the line is confirmed by the live read, and the read can arrive before
  the reply, so a late reply must not set a confirmed line back to pending.
- Confirming by `commandId` on one view proves only that this view saw it. For "every effect has landed", wait with
  the receipt (`atLeast`) on the read you need; do not count events.
- Build the command for `predict` with `new` (`new ConfirmImport({ ... })`), as inside `decide`: on beta.87
  `Rejection.make()` does not type-check, and on main the prover does not read `.make` inside `decide`, so the app's
  lint rule `newSchemaClass` needs an exception for domain blocks; `new` everywhere keeps one spelling.
- `predict` is a preview, never a substitute: still send the command and still confirm from the read. An
  `Unpredictable` result means "ask the server", not "refused".
- `predict` sees only what `decide` sees: the instance's state and what middleware provides. A rule that needs
  other instances, stored rows or a count shared with other people cannot be predicted.
- The library does not include: a generic pending-state helper (the example keeps its own line model), a sync
  engine for a local copy of the server's aggregates, conflict merging for device-authoritative data (CRDTs), or a
  reducer of event entries into state (use `watch` for state).
- The `local-first.mdx` code at beta.87 is an older copy of the example's `Bank.ts` (lowercase acks, the raw client
  with a retry on `RpcClientError`, a literal MFA header); the example file at the same ref uses the Foldkit adapter
  and `CommandHeaders`. Follow the example file.

## In this app

The review already is an intent queue in all but name. Each change to the decisions becomes a delta (`deltaOf`:
rows set and rows cleared), sent one request at a time by `useDecisionSaver`, which keeps `onServer` and `wanted`
and sends the difference; the confirm carries whatever is still `pending()`; a transient failure keeps the decision
on screen with "Save again"; a refusal (the import was confirmed or removed meanwhile, the role was taken away) puts
the screen back to what the server holds. Undo and redo are local: `ReviewState` holds `undo` and `redo` steps beside
the decisions, `toDraft` and `fromDraft` keep them through a refresh, and `useSavedProgress` writes the draft to
`localStorage` and the chosen file to IndexedDB per member and organization. An undo is therefore just another
delta, never a server-side undo.

With a domain model, each act of the review is the intent, decided across the import's lifecycle instance and the
row it names. An intent is what the
person did ("decide these rows as …", "undo my step"), never the difference between two pictures of the draft: the
[trial on saving review decisions](../07-review-decisions-trial.md) shows that a command of rows to set and rows to
clear cannot hold the rule "no command clears a decision its sender did not make", and [the brief](../../BRIEF.md)
models the acts as `DecideRow` and `UndoRowStep`, each naming the decision its sender saw.

```typescript
// SKETCH: not compiled
import * as Context from "effect/Context"
import * as DateTime from "effect/DateTime"
import * as S from "effect/Schema"

// The queue the review keeps across reloads, beside its draft: each act with the id it is (re)sent with.
export const DecisionIntent = S.Struct({
  commandId: S.String,
  step: S.String,
  row: S.String,
  saw: Saw, // the step of the decision its sender saw on the row, or none
  flags: S.String // the row's decision as the text the database holds
})

// Before Confirm is sent: what the Import aggregate would say, from the state the screen holds (the first form).
const preview = (state: ImportState, version: number, member: Member) =>
  Import.predict(state, new ConfirmImport({ reviewedAt: version }), {
    id: importKey,
    now: DateTime.nowUnsafe(),
    version,
    context: Context.make(CurrentActor, member)
  })
// "Rejected" with AlreadyImported: the button says "Already confirmed on another screen" and nothing is sent.
// "Rejected" with Forbidden: "You are a viewer in Prairie…" before the request.
// "Accepted": the confirm is sent; the result screen still waits for the server's counts.
```

What `predict` on the Import aggregate gives the screen: a refused confirm known before the request (the import is
`imported` or `takenBack` already, another screen confirmed it, the person is a viewer or the agent's `maxRole` is
too low, the import belongs to another organization), and the new revision a saved decision will produce. What
stays server-only, because `decide` may require nothing but the middleware's context (`Aggregate.ts:136-142`): the
review run over the stored rows, the SKU key uniqueness per organization, the take-back's "nobody changed this item
since" check, the 40-calls-a-day allowance, and every count on the result screen. The screen's own preview of the
counts already runs the same pure `review` locally; that stays as it is.

- **Used today:** no. In its place: `useDecisionSaver` (`packages/catalog/web/src/Draft.controller.ts`),
  `ReviewState` with undo and redo (`packages/review/src/ReviewDraft.rules.ts`), `useSavedProgress`
  (`packages/review/src/SavedProgress.hook.ts`), and the optimistic write atoms (`packages/client/src/Optimistic.atoms.ts`).
- **Where it goes:** each act of the review becomes a `DecideRow` or `UndoRowStep` command with a stable `commandId` kept in
  the saved progress (`packages/review/src/SavedProgress.schema.ts`); `predict` is called by the confirm button in
  `packages/catalog/web/src/ReviewStep.screen.tsx`.
- **What the person gets:** a review that keeps every decision offline and sends them when back online, and a
  confirm button that says "already confirmed" or "needs the editor role" before anything is sent.

## How to check it

- A browser-free test of the queue, like the example's `Bank.test.ts` stories: offline, three decisions queue in
  order; back online they are sent oldest first; the second fails with `AlreadyImported` and only it is marked
  refused; a reload restores the queue and a decision the server already applied is not applied twice (same id).
- A [story](./story.md) that sends `DecideRow` twice with one `commandId` and checks one event and one receipt.
  The underlying rule was run in a trial on 2026-11-19 on beta.87 with the in-memory host: a `ConfirmImport` sent a
  second time with the same `commandId` answered the same receipt (version 2), and a `ConfirmImport` whose
  `reviewedAt` was not the decide context's `version` was rejected with `StaleReview { current: 1 }`, the refusal
  `predict` would show from the same state and `version`. `predict` itself was not run.
- A property test: for any state and command, `Import.predict(...)` agrees with what the in-memory host decides for
  the same state, id, time and actor (`Rejected` matches the rejection, `Accepted` matches events and state).

## What it needs

No host of its own: `predict` runs in the browser on beta.87 (`Domain.Aggregate` is a root export). Its cost in the
bundle, measured in a trial on 2026-11-19 (beta.87, minified): one aggregate's declarations add about 133 kB (43 kB
gzip) over a file that uses only Effect and its Schema; of the `alchemy` package only `Workflows` and
`WorkflowEncoding` are pulled in. Confirming by
event needs a live read of the Import, which needs a host that serves live reads (in memory for tests, Durable
Objects on Cloudflare) and the Api client over `protocolWebSocket` or `protocolHttp`. A `predict` on main drops `id`.

## Verdict

**Use:** model each act of the review as an intent (`DecideRow`, `UndoRowStep`) with a stable command id kept in the saved progress,
replay the queue in order on reconnect, treat a rejection as the conflict, and call `Import.predict` before Confirm
to refuse early; keep the review's counts and the confirm's writes on the server.

## Where this was read

- https://alchemy.run/domain/local-first and https://alchemy.run/domain/optimistic-updates (the live site documents beta.87)
- `website/src/content/docs/domain/local-first.mdx` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: changed (client call shape)
- `website/src/content/docs/domain/optimistic-updates.mdx` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: changed (no `target`)
- `packages/domain/src/Aggregate.ts` (`predict`) at `v2.0.0-beta.87`; on `main@dbfd0ddb`: changed (no `id`)
- `packages/domain/src/View.ts` (`evolve`) at `v2.0.0-beta.87`
- `examples/cloudflare-domain/packages/web/src/Bank.ts`, `entry.ts` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: changed (no `target`)
- `packages/domain/skills/alchemy-domain/references/frontend.md` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: changed (`predict` without `id`)
