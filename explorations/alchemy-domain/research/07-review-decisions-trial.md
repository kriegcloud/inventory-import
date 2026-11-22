---
type: Research
title: "Trial: saving review decisions, under Verify"
description: Three rounds of models of how a review's decisions are saved, run through Verify on the library's main on 2026-11-19 and 2026-11-20. The first shows that a set-and-clear difference cannot hold the rule "no command clears a decision its sender did not make". The second finds the shape under which the review's rules are proved, measures the largest value an object stores, and runs a decision, a relation, a model invariant and an eventually rule. The third runs that shape as it would be hosted, with the app's fifteen fields (32 rules proved), the item with replace and restore, the allowance by day, members as instances, each proof alone, and one decision across two objects in local workerd. The sources and Verify's reports, with what is proved, what is only checked, and what was not run; a report cut short says which lines it shows.
---

# Trial: saving review decisions, under Verify

Everything on this page was run in folders outside this repository, on `@alchemy.run/domain` at `main@dbfd0ddb`.
Nothing in the repository was changed. This is the case [the brief](../BRIEF.md) models first.

There are three rounds. The first, of 2026-11-19, is below as it was written, with three sentences corrected; it
claimed more than it had shown, and [the second round](#the-second-round), of 2026-11-20, lists the corrections and
runs what the first did not. [The third round](#the-third-round), the same day, runs the shape the brief recommends as
it would be hosted. **Read the third round's table first**: the design in the brief rests on it.

# The first round

| Model | What it is | Result | Time |
| --- | --- | --- | --- |
| `DeltaDraft` | Today's shape put into one aggregate unchanged: a command carries rows to set and rows to clear | **Not verified.** Verify gives the state, the command and the shortest sequence that clears another person's decision | 5 to 7 s |
| `ReviewDraft` | One instance per import; a command says what the person did to one row | Its six rules hold in every sequence of up to 3 commands. **None is proved**: "DecideDraftRow has more than 4096 paths" | 65 s |
| `ReviewDraftMapped` | The same, its fold written with `some` and `map` | The same result | 72 s |
| `RowDecision` | One instance per row | **All eight rules proved**, for every state and every input, after any number of commands | under 2 s |
| `RowCell` | One instance per row, written on shared pure functions (`Cell.rules.ts`) | **All eight rules proved**, the same eight | 1.6 s |
| `DraftOfCells` | One instance per import that applies those same functions to the rows an act names; one act may name many rows; a confirm names the version its sender had been told | Its six rules hold in every sequence of up to 3 commands, and on the 95,035 steps of a deeper search that was cut short. **None is proved**: "DecideRows has more than 4096 paths" | 79 s; 450 s deeper |
| `DraftOfCellsHouse` | The same, its rules and fold written with `effect/Array` (`A.every`, `A.some`, `A.map`, `A.filter`, `A.appendAll`), as this repository's type-check asks of a model package | The same result as `DraftOfCells` at 3 commands | 72 s |

## What is saved today, and why it goes wrong

The browser sends `DecisionDelta`, `{ set, clear }`, to `PUT /api/v1/imports/:id/decisions`
(`packages/catalog/contract/src/Import/Decision.command.ts`, `Catalog.contract.ts`). The server applies it to an open
draft and answers the draft's new revision (`decide` in `packages/catalog/model/src/Import/Imports.handler.ts`); the
revision goes up only when the delta changes something (`bumpRevision` in
`packages/catalog/host/src/ImportStore.adapter.ts`). A confirm carries a delta too and saves it first.

On `main` the browser works that delta out as the difference between two whole pictures of the import's decisions:
what it believes the server holds, and what the screen shows. When either picture is stale, the difference clears or
overwrites decisions nobody touched. Ten orderings are known that do it:

- a view captured at a press and put back later, over newer suggestions or a newer saved decision;
- a Review drawn while a newer view was on its way, which never starts again from it;
- a saver reset while a save was still out;
- the revision recorded as "known" for a draft the screen does not show;
- a quick return to Review that starts from the decisions of an earlier restart;
- a write that cancels a read still in flight, for a typed SKU's check;
- the same for a late answer to a match;
- Continue giving an older copy of the list over a newer view;
- a save that jumps several revisions and then ignores the other person's decisions;
- two matches in quick succession whose earlier answer lands last.

The request says nothing about which picture its sender worked the difference out from. So the server cannot tell a
decision taken back by the person who made it from one cleared by a stale screen, and no check on the server can hold
the rule. On the atoms branch (`packages/catalog/web/src/Draft.machine.ts`, commit `dd3e3e9`) a save carries only the
rows the person changed on that screen, which closes these orderings in the browser; the contract and the server are
as above.

## The rules

| Rule, in words | `DeltaDraft` | `ReviewDraft` | `RowDecision`, `RowCell` | `DraftOfCells` |
| --- | --- | --- | --- | --- |
| No command clears a decision its sender did not make | **breaks** | checked, 3 commands | **proved** | checked, 3 commands |
| An act touches the rows it names and no other, so two people's acts on different rows both survive either order | not stated: a stale `clear` names rows its sender never touched | checked, 3 commands | holds by construction: a command reaches only the instance its key names | checked, 3 commands |
| A decision is made on what its sender saw: the command says how many changes of the row it had seen, and a row changed since refuses it | not stated | not stated | **proved** | not stated |
| An undo takes back only its sender's own step | not stated | checked, 3 commands | **proved**: any other step is refused with a rejection | checked, 3 commands |
| An undo puts back what the step replaced, another person's decision included | not stated | not stated: its list keeps one decision a row | **proved** | not stated on the draft; it is the shared function `undone`, proved on `RowCell` |
| Nothing changes after the confirm | not modelled | checked, 3 commands (the count of decisions) | not modelled | checked, 3 commands (the count of rows held) |
| Only its own organization changes it; a viewer changes nothing | not stated | checked, 3 commands | **proved** | checked, 3 commands |

"What a screen shows is never ahead of what it has been told" is not in the table. It is a rule about what the browser
folds, and Verify reads aggregates. The brief says where it is checked.

## What is proved, what is only checked, and what was not run

**Proved.** The eight rules of `RowDecision`, and the same eight of `RowCell`: Verify's prover shows each holds for
every state the schema allows and every input, after any number of commands.

**Only checked, to three commands.** The six rules of `ReviewDraft`, `ReviewDraftMapped`, `DraftOfCells` and
`DraftOfCellsHouse`. The
prover gives up on the command that decides rows, because the fold over a list of rows has more than its limit of
4,096 paths, and that stops the proof of every rule, since each must hold for every command. What stands is the
search: every sequence of up to 3 commands on a new instance, with values a solver picks. Three commands on a new
instance are the opening and two more. That covers one act by one person followed by any act, undo or confirm by
another, on the same row or a different one. Each act in the search names at most 2 rows: a list a command carries is
given at most 2 items more than its schema asks for. It covers no longer history: not an undo of a step whose row
was decided twice since, and not three people. For `DraftOfCells` a search one command deeper was also run: it stopped at its
budget of 100,000 sequences, part of the way through the sequences of 4, with no rule broken. The same run shows that
for its undo and its confirm each rule is proved for lists of up to 2 rows; only the command that decides rows is not
decided at all.

**Broken.** `DeltaDraft`'s one rule.

**Not run.**

- `Verify.model`, the search across instances and through an Api with redelivery, reordering and random longer
  walks. No model was assembled from these aggregates.
- A story, a view, a projection, a decision across instances, or any host. Only `Verify.aggregate` ran.
- A search of 4 commands to its end, or any deeper: the one run at 4 stopped at its budget.
- Anything in a browser.
- The row's real decision. The trial's `value` is one string; the app's decision has a place (open, kept, left out),
  a choice for a stored item, fields accepted and reverted, and values typed by field.
- Why the path count passes 4,096, beyond the two ways of writing the fold that were tried.
- A draft's state in a Durable Object. Its size was measured as JSON only (below).
- `ReviewDraft` and `ReviewDraftMapped` from the installed build; they ran inside a clone of the library.

## How it was run

Two set-ups, both on Node 24.22.1 (the prover's solver does not run under Bun):

1. Inside a clone of the library at `main@dbfd0ddb`, beside its bank example, with the workspace's own Vitest.
   `DeltaDraft`, `ReviewDraft`, `ReviewDraftMapped` and `RowDecision` ran here.
2. As a consumer: an empty folder, the build of that commit installed with bun 1.4.5 from the library's own preview
   registry, beside the app's `effect` 4.1.4, `@effect/vitest` 4.1.4 and Vitest 5.1.1. `DeltaDraft`, `RowDecision`,
   `RowCell`, `DraftOfCells` and `DraftOfCellsHouse` ran here. For the two that ran in both, the reports are the same but for the times.

The consumer's manifest:

```json
{
  "name": "domain-consumer-trial",
  "private": true,
  "type": "module",
  "dependencies": {
    "@alchemy.run/domain": "https://pkg.alchemy.run/@alchemy.run/domain/dbfd0dd",
    "alchemy": "https://pkg.alchemy.run/alchemy/dbfd0dd",
    "effect": "4.1.4"
  },
  "devDependencies": {
    "@effect/platform-node": "4.1.4",
    "@effect/vitest": "4.1.4",
    "vitest": "^5.1.0"
  }
}
```

What the install showed:

- The library publishes a build of every push to its `main` to `https://pkg.alchemy.run` (its workflow
  `.github/workflows/pkg.yml`, its package `packages/pkg`). An address is
  `https://pkg.alchemy.run/<package>/<tag>`, where the tag is a commit (in full, or its first seven characters; eight
  answered 404), `branch:main`, or `pr:<number>`. The address answers with a redirect to a tarball named by the
  SHA-256 of its bytes.
- `bun install` resolved 61 packages and installed 68 in under 2 seconds.
- The installed `@alchemy.run/domain` still says version `2.0.0-beta.87`: a preview build keeps the version of the
  last release. Its dependency on `alchemy` and its peer `@alchemy.run/cloudflare` are rewritten to that commit's own
  tarballs, each by hash; `effect` is `^4.1.4`; `oxc-parser` 0.141.0 and `z3-solver` 5.3.3 come with it.
- Not checked: a type-check of these files with this repository's flags against the build from `main` (the first
  trial type-checked on the published release); how long the registry keeps a commit's tarballs.

Each test is one call, `Verify.aggregate(TheAggregate)`, provided with `@effect/platform-node`'s `NodeServices`; it
writes `Verify.render(report)` to a file, or the failure's `_tag` and `message`, because `it.effect` does not pass
console output through. One aggregate name per test file. Every aggregate takes the person asking from this file:

```typescript
// Who is asking, carried with every command to wherever its aggregate runs.
import * as Domain from "@alchemy.run/domain"
import * as RpcMiddleware from "effect/rpc/RpcMiddleware"
import * as S from "effect/Schema"

export const Actor = S.Struct({
  organizationId: S.String,
  memberId: S.String,
  role: S.Literals(["admin", "editor", "viewer"]),
})
export type Actor = typeof Actor.Type

export class CurrentActor extends Domain.RequestContext<CurrentActor>()("Inventory/CurrentActor", Actor) {}
export class NotSignedIn extends S.TaggedError<NotSignedIn>()("NotSignedIn", {}) {}
export class Session extends RpcMiddleware.Service<Session, { provides: CurrentActor }>()("Inventory/Session", {
  error: NotSignedIn,
}) {}
```

## 1. Today's shape: `DeltaDraft`

The command carries the two lists, as `DecisionDelta` does, and the fold applies them. One rule is stated: every
decision that was there, and was not the sender's, is still there afterwards.

```typescript
// The review as the app saves it today, put into an aggregate unchanged: the sender works out the difference between
// two whole pictures of the decisions and sends it as rows to set and rows to clear. The same rule as ReviewDraft's
// is stated here to see whether Verify finds the orderings that clear a decision nobody touched.
import * as Domain from "@alchemy.run/domain"
import * as Effect from "effect/Effect"
import * as S from "effect/Schema"
import { CurrentActor, Session } from "./Actor.context.ts"

export const DeltaDraftId = S.String.pipe(S.brand("DeltaDraftId"))

const DeltaEntry = S.Struct({ row: S.String, by: S.String, value: S.String })

export class DeltaOpened extends Domain.Event("DeltaOpened", { organizationId: S.String }) {}
export class DeltaSaved extends Domain.Event("DeltaSaved", {
  by: S.String,
  set: S.Array(S.Struct({ row: S.String, value: S.String })),
  clear: S.Array(S.String),
}) {}

export class DeltaNotPermitted extends Domain.Rejection("DeltaNotPermitted", {}) {}
export class DeltaNotOpen extends Domain.Rejection("DeltaNotOpen", {}) {}
export class DeltaAlreadyOpen extends Domain.Rejection("DeltaAlreadyOpen", {}) {}

export class OpenDeltaDraft extends Domain.Command("OpenDeltaDraft", {
  middleware: [Session],
  input: { draftId: DeltaDraftId },
  events: [DeltaOpened],
  rejects: [DeltaNotPermitted, DeltaAlreadyOpen],
}) {}
export class SaveDelta extends Domain.Command("SaveDelta", {
  middleware: [Session],
  input: {
    draftId: DeltaDraftId,
    set: S.Array(S.Struct({ row: S.String, value: S.String })),
    clear: S.Array(S.String),
  },
  events: [DeltaSaved],
  rejects: [DeltaNotPermitted, DeltaNotOpen],
}) {}

export const DeltaState = S.Union([
  S.TaggedStruct("Unopened", {}),
  S.TaggedStruct("Open", { organizationId: S.String, revision: S.Int, decisions: S.Array(DeltaEntry) }),
])

export class DeltaDraft extends Domain.Aggregate("DeltaDraft", {
  id: DeltaDraftId,
  state: DeltaState,
  initial: { _tag: "Unopened" },
  transitions: {
    // The rule the reviews' ten orderings break: no command clears a decision its sender did not make.
    NobodyClearsAnotherPersonsDecision: Effect.fn(function* ({ before, after }) {
      if (before._tag === "Unopened" || after._tag === "Unopened") return true
      const actor = yield* CurrentActor
      return before.decisions.every(
        (was) => was.by === actor.memberId || after.decisions.some((now) => now.row === was.row),
      )
    }),
  },
  commands: [OpenDeltaDraft, SaveDelta],
  keyOf: (cmd) => cmd.draftId,
  decide: {
    OpenDeltaDraft: Effect.fn(function* (s) {
      const actor = yield* CurrentActor
      if (actor.role === "viewer") return yield* new DeltaNotPermitted({})
      if (s._tag !== "Unopened") return yield* new DeltaAlreadyOpen({})
      return [new DeltaOpened({ organizationId: actor.organizationId })]
    }),
    SaveDelta: Effect.fn(function* (s, cmd) {
      const actor = yield* CurrentActor
      if (s._tag !== "Open") return yield* new DeltaNotOpen({})
      if (actor.organizationId !== s.organizationId || actor.role === "viewer") return yield* new DeltaNotPermitted({})
      return [new DeltaSaved({ by: actor.memberId, set: cmd.set, clear: cmd.clear })]
    }),
  },
  evolve: {
    DeltaOpened: (_, e) => ({ _tag: "Open" as const, organizationId: e.organizationId, revision: 0, decisions: [] }),
    DeltaSaved: (s, e) =>
      s._tag !== "Open"
        ? s
        : {
            ...s,
            revision: s.revision + 1,
            decisions: [
              ...s.decisions.filter(
                (one) => !e.clear.includes(one.row) && !e.set.some((entry) => entry.row === one.row),
              ),
              ...e.set.map((entry) => ({ row: entry.row, by: e.by, value: entry.value })),
            ],
          },
  },
}) {}
```

Verify's report:

```text
NotVerified

DeltaDraft: 1 rules, 2 commands

✗ NobodyClearsAnotherPersonsDecision breaks

DeltaDraft: 0 invariants, 1 transitions, 2 commands

✗ The state stays in its schema
    ✓ holds on the initial state
    ✓ proved for OpenDeltaDraft
    ✗ SaveDelta: proved for short lists only
        state.decisions was tried with up to 2 items, command.set was tried with up to 2 items

✗ NobodyClearsAnotherPersonsDecision
    ✓ proved for OpenDeltaDraft
    ✗ SaveDelta: violated
        state         { _tag: "Open", organizationId: "", revision: 0, decisions: [{ row: "", by: "A", value: "" }] }
        command       SaveDelta { draftId: "", set: [], clear: [""] }
        CurrentActor  { organizationId: "", memberId: "", role: "admin" }
        now           1970-01-01T00:00:00.000Z
        events        DeltaSaved { by: "", set: [], clear: [""] }
        after         { _tag: "Open", organizationId: "", revision: 1, decisions: [] }

Assuming:
  - whole numbers are exact: a number stays within ±2^53, and a bigint has no limit
  - an event or rejection whose fields fail its schema crashes the command, and nothing is committed

DeltaDraft: every sequence of up to 3 commands on a new instance
1,310 sequences, 1,222 states

✗ NobodyClearsAnotherPersonsDecision breaks
    1. OpenDeltaDraft { draftId: "" } as { organizationId: "", memberId: "", role: "admin" }                                       → DeltaOpened
    2. SaveDelta { draftId: "", set: [{ row: "", value: "" }], clear: [] } as { organizationId: "", memberId: "", role: "admin" }  → DeltaSaved
    3. SaveDelta { draftId: "", set: [], clear: [""] } as { organizationId: "", memberId: "A", role: "admin" }                     → DeltaSaved
    state  { _tag: "Open", organizationId: "", revision: 2, decisions: [] }

Reached 6 of 6 outcomes

  OpenDeltaDraft → DeltaOpened
      1. OpenDeltaDraft { draftId: "" } as { organizationId: "", memberId: "", role: "admin" }  → DeltaOpened

  OpenDeltaDraft ✗ DeltaNotPermitted
      1. OpenDeltaDraft { draftId: "" } as { organizationId: "", memberId: "", role: "viewer" }  → ✗ DeltaNotPermitted

  OpenDeltaDraft ✗ DeltaAlreadyOpen
      1. OpenDeltaDraft { draftId: "" } as { organizationId: "", memberId: "", role: "admin" }  → DeltaOpened
      2. OpenDeltaDraft { draftId: "" } as { organizationId: "", memberId: "", role: "admin" }  → ✗ DeltaAlreadyOpen

  SaveDelta → DeltaSaved
      1. OpenDeltaDraft { draftId: "" } as { organizationId: "", memberId: "", role: "admin" }                 → DeltaOpened
      2. SaveDelta { draftId: "", set: [], clear: [] } as { organizationId: "", memberId: "", role: "admin" }  → DeltaSaved

  SaveDelta ✗ DeltaNotPermitted
      1. OpenDeltaDraft { draftId: "" } as { organizationId: "", memberId: "", role: "admin" }                  → DeltaOpened
      2. SaveDelta { draftId: "", set: [], clear: [] } as { organizationId: "A", memberId: "", role: "admin" }  → ✗ DeltaNotPermitted

  SaveDelta ✗ DeltaNotOpen
      1. SaveDelta { draftId: "", set: [], clear: [] } as { organizationId: "", memberId: "", role: "admin" }  → ✗ DeltaNotOpen

States reached: Open; not reached: Unopened
```

The breaking sequence is three lines: one person sets a row, another person's delta names it in `clear`, and it is
gone. Nothing in it is stale: today's contract lets any editor clear any row on purpose. What it shows is that the
command cannot say whether its sender saw what it clears, so nothing in the command or the state lets `decide`
refuse a stale clear and still accept a meant one.

## 2. One instance per import: `ReviewDraft`

A command says what the person did: decide one row as a value, undo my step, confirm. The instance orders everything
said about the import.

```typescript
// One import's review as ONE instance that orders everything said about it. A command says what the person did
// ("decide row r as v", "undo my step s"), never what the whole picture should become.
import * as Domain from "@alchemy.run/domain"
import * as Effect from "effect/Effect"
import * as S from "effect/Schema"
import { CurrentActor, Session } from "./Actor.context.ts"

export const DraftId = S.String.pipe(S.brand("DraftId"))

const RowDecisionEntry = S.Struct({ row: S.String, by: S.String, value: S.String, step: S.String })

export class DraftOpened extends Domain.Event("DraftOpened", { organizationId: S.String }) {}
export class DraftRowDecided extends Domain.Event("DraftRowDecided", {
  row: S.String,
  by: S.String,
  value: S.String,
  step: S.String,
}) {}
export class DraftStepUndone extends Domain.Event("DraftStepUndone", { by: S.String, step: S.String }) {}
export class DraftConfirmed extends Domain.Event("DraftConfirmed", {}) {}

export class DraftNotPermitted extends Domain.Rejection("DraftNotPermitted", {}) {}
export class DraftNotOpen extends Domain.Rejection("DraftNotOpen", {}) {}
export class DraftAlreadyOpen extends Domain.Rejection("DraftAlreadyOpen", {}) {}

export class OpenDraft extends Domain.Command("OpenDraft", {
  middleware: [Session],
  input: { draftId: DraftId },
  events: [DraftOpened],
  rejects: [DraftNotPermitted, DraftAlreadyOpen],
}) {}
export class DecideDraftRow extends Domain.Command("DecideDraftRow", {
  middleware: [Session],
  input: { draftId: DraftId, row: S.String, value: S.String, step: S.String },
  events: [DraftRowDecided],
  rejects: [DraftNotPermitted, DraftNotOpen],
}) {}
export class UndoDraftStep extends Domain.Command("UndoDraftStep", {
  middleware: [Session],
  input: { draftId: DraftId, step: S.String },
  events: [DraftStepUndone],
  rejects: [DraftNotPermitted, DraftNotOpen],
}) {}
export class ConfirmDraft extends Domain.Command("ConfirmDraft", {
  middleware: [Session],
  input: { draftId: DraftId },
  events: [DraftConfirmed],
  rejects: [DraftNotPermitted, DraftNotOpen],
}) {}

export const DraftState = S.Union([
  S.TaggedStruct("Unopened", {}),
  S.TaggedStruct("Open", { organizationId: S.String, decisions: S.Array(RowDecisionEntry) }),
  S.TaggedStruct("Confirmed", { organizationId: S.String, decisions: S.Array(RowDecisionEntry) }),
])

export class ReviewDraft extends Domain.Aggregate("ReviewDraft", {
  id: DraftId,
  state: DraftState,
  initial: { _tag: "Unopened" },
  transitions: {
    // No command clears or changes a decision its sender did not make, unless it names that row.
    NobodyClearsAnotherPersonsDecision: Effect.fn(function* ({ before, after, command }) {
      if (before._tag === "Unopened" || after._tag === "Unopened") return true
      const actor = yield* CurrentActor
      return before.decisions.every(
        (was) =>
          was.by === actor.memberId ||
          (command._tag === "DecideDraftRow" && command.row === was.row) ||
          after.decisions.some((now) => now.row === was.row && now.by === was.by && now.value === was.value),
      )
    }),
    // A decision touches the row it names and no other: two people's decisions on different rows both survive.
    ADecisionTouchesOnlyTheRowItNames: ({ before, after, command }) =>
      command._tag !== "DecideDraftRow" ||
      before._tag !== "Open" ||
      after._tag !== "Open" ||
      before.decisions.every(
        (was) =>
          was.row === command.row ||
          after.decisions.some(
            (now) => now.row === was.row && now.by === was.by && now.value === was.value && now.step === was.step,
          ),
      ),
    // An undo takes back only its sender's own step.
    AnUndoTakesBackOnlyItsOwnStep: Effect.fn(function* ({ before, after, command }) {
      if (command._tag !== "UndoDraftStep" || before._tag !== "Open" || after._tag !== "Open") return true
      const actor = yield* CurrentActor
      return before.decisions.every(
        (was) =>
          (was.by === actor.memberId && was.step === command.step) ||
          after.decisions.some(
            (now) => now.row === was.row && now.by === was.by && now.value === was.value && now.step === was.step,
          ),
      )
    }),
    // Nothing changes after Confirm.
    AConfirmedDraftKeepsItsDecisions: ({ before, after }) =>
      before._tag !== "Confirmed" || (after._tag === "Confirmed" && after.decisions.length === before.decisions.length),
    OnlyItsOwnOrganizationChangesADraft: Effect.fn(function* ({ before }) {
      if (before._tag === "Unopened") return true
      return (yield* CurrentActor).organizationId === before.organizationId
    }),
    AViewerChangesNothing: Effect.fn(function* () {
      return (yield* CurrentActor).role !== "viewer"
    }),
  },
  commands: [OpenDraft, DecideDraftRow, UndoDraftStep, ConfirmDraft],
  keyOf: (cmd) => cmd.draftId,
  decide: {
    OpenDraft: Effect.fn(function* (s) {
      const actor = yield* CurrentActor
      if (actor.role === "viewer") return yield* new DraftNotPermitted({})
      if (s._tag !== "Unopened") return yield* new DraftAlreadyOpen({})
      return [new DraftOpened({ organizationId: actor.organizationId })]
    }),
    DecideDraftRow: Effect.fn(function* (s, cmd) {
      const actor = yield* CurrentActor
      if (s._tag !== "Open") return yield* new DraftNotOpen({})
      if (actor.organizationId !== s.organizationId || actor.role === "viewer") return yield* new DraftNotPermitted({})
      return [new DraftRowDecided({ row: cmd.row, by: actor.memberId, value: cmd.value, step: cmd.step })]
    }),
    UndoDraftStep: Effect.fn(function* (s, cmd) {
      const actor = yield* CurrentActor
      if (s._tag !== "Open") return yield* new DraftNotOpen({})
      if (actor.organizationId !== s.organizationId || actor.role === "viewer") return yield* new DraftNotPermitted({})
      return [new DraftStepUndone({ by: actor.memberId, step: cmd.step })]
    }),
    ConfirmDraft: Effect.fn(function* (s) {
      const actor = yield* CurrentActor
      if (s._tag !== "Open") return yield* new DraftNotOpen({})
      if (actor.organizationId !== s.organizationId || actor.role === "viewer") return yield* new DraftNotPermitted({})
      return [new DraftConfirmed({})]
    }),
  },
  evolve: {
    DraftOpened: (_, e) => ({ _tag: "Open" as const, organizationId: e.organizationId, decisions: [] }),
    DraftRowDecided: (s, e) =>
      s._tag !== "Open"
        ? s
        : {
            ...s,
            decisions: [
              ...s.decisions.filter((one) => one.row !== e.row),
              { row: e.row, by: e.by, value: e.value, step: e.step },
            ],
          },
    DraftStepUndone: (s, e) =>
      s._tag !== "Open"
        ? s
        : { ...s, decisions: s.decisions.filter((one) => !(one.by === e.by && one.step === e.step)) },
    DraftConfirmed: (s) =>
      s._tag !== "Open"
        ? s
        : { _tag: "Confirmed" as const, organizationId: s.organizationId, decisions: s.decisions },
  },
}) {}
```

Verify's report:

```text
VERIFIED
ReviewDraft: 6 rules, 4 commands

Checked: in every sequence of up to 3 commands on a new instance
  ✓ NobodyClearsAnotherPersonsDecision
      not proved for DecideDraftRow: DecideDraftRow has more than 4096 paths
  ✓ ADecisionTouchesOnlyTheRowItNames
      not proved for DecideDraftRow: DecideDraftRow has more than 4096 paths
  ✓ AnUndoTakesBackOnlyItsOwnStep
      not proved for DecideDraftRow: DecideDraftRow has more than 4096 paths
  ✓ AConfirmedDraftKeepsItsDecisions
      not proved for DecideDraftRow: DecideDraftRow has more than 4096 paths
  ✓ OnlyItsOwnOrganizationChangesADraft
      not proved for DecideDraftRow: DecideDraftRow has more than 4096 paths
  ✓ AViewerChangesNothing
      not proved for DecideDraftRow: DecideDraftRow has more than 4096 paths
```

`ReviewDraftMapped` differs only in `DraftRowDecided`'s fold (a `some` and a `map` instead of a `filter` and a
spread) and gave the same report under its own name.

## 3. One instance per row: `RowDecision`

The row keeps who decided it, as what, in which step, how many times it has changed, and the one decision under the
current one. A decision says how many changes its sender had seen; an undo names the step it takes back.

```typescript
// One row of one import's review, as its own instance: who decided it, as what, and what that decision replaced.
// A command says what the person did to this row and reaches no other row.
import * as Domain from "@alchemy.run/domain"
import * as Effect from "effect/Effect"
import * as S from "effect/Schema"
import { CurrentActor, Session } from "./Actor.context.ts"

export const RowKey = S.String.pipe(S.brand("RowKey"))

export class RowDecided extends Domain.Event("RowDecided", {
  organizationId: S.String,
  by: S.String,
  value: S.String,
  step: S.String,
}) {}
export class DecisionUndone extends Domain.Event("DecisionUndone", {}) {}

export class RowNotPermitted extends Domain.Rejection("RowNotPermitted", {}) {}
export class DecidedSince extends Domain.Rejection("DecidedSince", { changes: S.Int }) {}
export class NotYourStep extends Domain.Rejection("NotYourStep", {}) {}

export class DecideRow extends Domain.Command("DecideRow", {
  middleware: [Session],
  input: { rowKey: RowKey, value: S.String, step: S.String, seen: S.Int },
  events: [RowDecided],
  rejects: [RowNotPermitted, DecidedSince],
}) {}
export class UndoStep extends Domain.Command("UndoStep", {
  middleware: [Session],
  input: { rowKey: RowKey, step: S.String },
  events: [DecisionUndone],
  rejects: [RowNotPermitted, NotYourStep],
}) {}

const Under = S.Union([
  S.TaggedStruct("Nothing", {}),
  S.TaggedStruct("Was", { by: S.String, value: S.String, step: S.String }),
])

export const RowState = S.Union([
  S.TaggedStruct("Untouched", {}),
  S.TaggedStruct("Undecided", { organizationId: S.String, changes: S.Int }),
  S.TaggedStruct("Decided", {
    organizationId: S.String,
    changes: S.Int,
    by: S.String,
    value: S.String,
    step: S.String,
    under: Under,
  }),
])

export class RowDecision extends Domain.Aggregate("RowDecision", {
  id: RowKey,
  state: RowState,
  initial: { _tag: "Untouched" },
  invariants: {
    EveryChangeIsCounted: (s) => s._tag === "Untouched" || s.changes >= 1,
  },
  transitions: {
    // No command clears a decision its sender did not make.
    NobodyClearsAnotherPersonsDecision: Effect.fn(function* ({ before, after }) {
      if (before._tag !== "Decided" || after._tag === "Decided") return true
      return (yield* CurrentActor).memberId === before.by
    }),
    // No command writes over a decision its sender has not seen.
    ADecisionIsMadeOnWhatItsSenderSaw: ({ before, command }) =>
      command._tag !== "DecideRow" || command.seen === (before._tag === "Untouched" ? 0 : before.changes),
    // An undo puts back what the step replaced, another person's decision included.
    AnUndoPutsBackWhatWasThere: ({ before, after, command }) =>
      command._tag !== "UndoStep" ||
      before._tag !== "Decided" ||
      (before.under._tag === "Nothing"
        ? after._tag === "Undecided"
        : after._tag === "Decided" && after.by === before.under.by && after.value === before.under.value),
    ARowNeverChangesOrganization: ({ before, after }) =>
      before._tag === "Untouched" || after._tag === "Untouched" || before.organizationId === after.organizationId,
    OnlyItsOwnOrganizationChangesARow: Effect.fn(function* ({ before }) {
      if (before._tag === "Untouched") return true
      return (yield* CurrentActor).organizationId === before.organizationId
    }),
    AViewerChangesNothing: Effect.fn(function* () {
      return (yield* CurrentActor).role !== "viewer"
    }),
    TheCountOnlyGoesUp: ({ before, after }) =>
      before._tag === "Untouched" || (after._tag !== "Untouched" && after.changes > before.changes),
  },
  commands: [DecideRow, UndoStep],
  keyOf: (cmd) => cmd.rowKey,
  decide: {
    DecideRow: Effect.fn(function* (s, cmd) {
      const actor = yield* CurrentActor
      if (actor.role === "viewer") return yield* new RowNotPermitted({})
      if (s._tag !== "Untouched" && s.organizationId !== actor.organizationId) return yield* new RowNotPermitted({})
      const changes = s._tag === "Untouched" ? 0 : s.changes
      if (cmd.seen !== changes) return yield* new DecidedSince({ changes })
      return [
        new RowDecided({
          organizationId: actor.organizationId,
          by: actor.memberId,
          value: cmd.value,
          step: cmd.step,
        }),
      ]
    }),
    UndoStep: Effect.fn(function* (s, cmd) {
      const actor = yield* CurrentActor
      if (actor.role === "viewer") return yield* new RowNotPermitted({})
      if (s._tag === "Untouched" || s.organizationId !== actor.organizationId) return yield* new RowNotPermitted({})
      if (s._tag !== "Decided" || s.by !== actor.memberId || s.step !== cmd.step) return yield* new NotYourStep({})
      return [new DecisionUndone({})]
    }),
  },
  evolve: {
    RowDecided: (s, e) => ({
      _tag: "Decided" as const,
      organizationId: e.organizationId,
      changes: (s._tag === "Untouched" ? 0 : s.changes) + 1,
      by: e.by,
      value: e.value,
      step: e.step,
      under:
        s._tag === "Decided"
          ? { _tag: "Was" as const, by: s.by, value: s.value, step: s.step }
          : { _tag: "Nothing" as const },
    }),
    DecisionUndone: (s) =>
      s._tag !== "Decided"
        ? s
        : s.under._tag === "Was"
          ? {
              _tag: "Decided" as const,
              organizationId: s.organizationId,
              changes: s.changes + 1,
              by: s.under.by,
              value: s.under.value,
              step: s.under.step,
              under: { _tag: "Nothing" as const },
            }
          : { _tag: "Undecided" as const, organizationId: s.organizationId, changes: s.changes + 1 },
  },
}) {}
```

Verify's report:

```text
VERIFIED
RowDecision: 8 rules, 2 commands

Proved: for every state and every input, after any number of commands
  ✓ EveryChangeIsCounted
  ✓ NobodyClearsAnotherPersonsDecision
  ✓ ADecisionIsMadeOnWhatItsSenderSaw
  ✓ AnUndoPutsBackWhatWasThere
  ✓ ARowNeverChangesOrganization
  ✓ OnlyItsOwnOrganizationChangesARow
  ✓ AViewerChangesNothing
  ✓ TheCountOnlyGoesUp
```

## 4. The row's fold as shared functions: `Cell.rules.ts` and `RowCell`

What an act does to one row, as pure functions in a file of their own, imported by a relative path so the prover
reads them:

```typescript
// One row's decision and what each act does to it, as pure functions: the fold both aggregates below share. The row's
// rules are proved on it once (RowCell), and the draft (DraftOfCells) applies it to the rows an act names.
import * as S from "effect/Schema"

export const Under = S.Union([
  S.TaggedStruct("Nothing", {}),
  S.TaggedStruct("Was", { by: S.String, value: S.String, step: S.String }),
])

export const Cell = S.Union([
  S.TaggedStruct("Undecided", { changes: S.Int }),
  S.TaggedStruct("Decided", { changes: S.Int, by: S.String, value: S.String, step: S.String, under: Under }),
])
export type Cell = typeof Cell.Type

/** The row after somebody decided it: the decision it had goes under the new one. */
export const decided = (cell: Cell, by: string, value: string, step: string): Cell => ({
  _tag: "Decided" as const,
  changes: cell.changes + 1,
  by,
  value,
  step,
  under:
    cell._tag === "Decided"
      ? { _tag: "Was" as const, by: cell.by, value: cell.value, step: cell.step }
      : { _tag: "Nothing" as const },
})

/** The row after its current decision was taken back: what was under it is in force again. */
export const undone = (cell: Cell): Cell =>
  cell._tag !== "Decided"
    ? cell
    : cell.under._tag === "Was"
      ? {
          _tag: "Decided" as const,
          changes: cell.changes + 1,
          by: cell.under.by,
          value: cell.under.value,
          step: cell.under.step,
          under: { _tag: "Nothing" as const },
        }
      : { _tag: "Undecided" as const, changes: cell.changes + 1 }

/** True when the row's current decision is this person's, made in this step: the only decision an undo may take back. */
export const isOwnStep = (cell: Cell, memberId: string, step: string): boolean =>
  cell._tag === "Decided" && cell.by === memberId && cell.step === step
```

`RowCell` is `RowDecision` written on those functions. It exists to carry the proof:

```typescript
// One row's decision as its own instance, written on the shared fold (Cell.rules.ts). This is the proof of the row's
// rules: what Verify proves here holds for the fold wherever it is applied.
import * as Domain from "@alchemy.run/domain"
import * as Effect from "effect/Effect"
import * as S from "effect/Schema"
import { CurrentActor, Session } from "./Actor.context.ts"
import { Cell, decided, isOwnStep, undone } from "./Cell.rules.ts"

export const CellKey = S.String.pipe(S.brand("CellKey"))

export class CellDecided extends Domain.Event("CellDecided", {
  organizationId: S.String,
  by: S.String,
  value: S.String,
  step: S.String,
}) {}
export class CellUndone extends Domain.Event("CellUndone", {}) {}

export class CellNotPermitted extends Domain.Rejection("CellNotPermitted", {}) {}
export class CellDecidedSince extends Domain.Rejection("CellDecidedSince", { changes: S.Int }) {}
export class CellNotYourStep extends Domain.Rejection("CellNotYourStep", {}) {}

export class DecideCell extends Domain.Command("DecideCell", {
  middleware: [Session],
  input: { cellKey: CellKey, value: S.String, step: S.String, seen: S.Int },
  events: [CellDecided],
  rejects: [CellNotPermitted, CellDecidedSince],
}) {}
export class UndoCellStep extends Domain.Command("UndoCellStep", {
  middleware: [Session],
  input: { cellKey: CellKey, step: S.String },
  events: [CellUndone],
  rejects: [CellNotPermitted, CellNotYourStep],
}) {}

export const RowCellState = S.Union([
  S.TaggedStruct("Untouched", {}),
  S.TaggedStruct("Held", { organizationId: S.String, cell: Cell }),
])

export class RowCell extends Domain.Aggregate("RowCell", {
  id: CellKey,
  state: RowCellState,
  initial: { _tag: "Untouched" },
  invariants: {
    EveryChangeIsCounted: (s) => s._tag === "Untouched" || s.cell.changes >= 1,
  },
  transitions: {
    NobodyClearsAnotherPersonsDecision: Effect.fn(function* ({ before, after }) {
      if (before._tag !== "Held" || before.cell._tag !== "Decided") return true
      if (after._tag === "Held" && after.cell._tag === "Decided") return true
      return (yield* CurrentActor).memberId === before.cell.by
    }),
    ADecisionIsMadeOnWhatItsSenderSaw: ({ before, command }) =>
      command._tag !== "DecideCell" || command.seen === (before._tag === "Untouched" ? 0 : before.cell.changes),
    AnUndoPutsBackWhatWasThere: ({ before, after, command }) =>
      command._tag !== "UndoCellStep" ||
      before._tag !== "Held" ||
      before.cell._tag !== "Decided" ||
      (before.cell.under._tag === "Nothing"
        ? after._tag === "Held" && after.cell._tag === "Undecided"
        : after._tag === "Held" &&
          after.cell._tag === "Decided" &&
          after.cell.by === before.cell.under.by &&
          after.cell.value === before.cell.under.value),
    ARowNeverChangesOrganization: ({ before, after }) =>
      before._tag === "Untouched" || after._tag === "Untouched" || before.organizationId === after.organizationId,
    OnlyItsOwnOrganizationChangesARow: Effect.fn(function* ({ before }) {
      if (before._tag === "Untouched") return true
      return (yield* CurrentActor).organizationId === before.organizationId
    }),
    AViewerChangesNothing: Effect.fn(function* () {
      return (yield* CurrentActor).role !== "viewer"
    }),
    TheCountOnlyGoesUp: ({ before, after }) =>
      before._tag === "Untouched" || (after._tag !== "Untouched" && after.cell.changes > before.cell.changes),
  },
  commands: [DecideCell, UndoCellStep],
  keyOf: (cmd) => cmd.cellKey,
  decide: {
    DecideCell: Effect.fn(function* (s, cmd) {
      const actor = yield* CurrentActor
      if (actor.role === "viewer") return yield* new CellNotPermitted({})
      if (s._tag !== "Untouched" && s.organizationId !== actor.organizationId) return yield* new CellNotPermitted({})
      const changes = s._tag === "Untouched" ? 0 : s.cell.changes
      if (cmd.seen !== changes) return yield* new CellDecidedSince({ changes })
      return [
        new CellDecided({ organizationId: actor.organizationId, by: actor.memberId, value: cmd.value, step: cmd.step }),
      ]
    }),
    UndoCellStep: Effect.fn(function* (s, cmd) {
      const actor = yield* CurrentActor
      if (actor.role === "viewer") return yield* new CellNotPermitted({})
      if (s._tag === "Untouched" || s.organizationId !== actor.organizationId) return yield* new CellNotPermitted({})
      if (!isOwnStep(s.cell, actor.memberId, cmd.step)) return yield* new CellNotYourStep({})
      return [new CellUndone({})]
    }),
  },
  evolve: {
    CellDecided: (s, e) => ({
      _tag: "Held" as const,
      organizationId: e.organizationId,
      cell: decided(s._tag === "Untouched" ? { _tag: "Undecided" as const, changes: 0 } : s.cell, e.by, e.value, e.step),
    }),
    CellUndone: (s) => (s._tag !== "Held" ? s : { ...s, cell: undone(s.cell) }),
  },
}) {}
```

Verify's report:

```text
VERIFIED
RowCell: 8 rules, 2 commands

Proved: for every state and every input, after any number of commands
  ✓ EveryChangeIsCounted
  ✓ NobodyClearsAnotherPersonsDecision
  ✓ ADecisionIsMadeOnWhatItsSenderSaw
  ✓ AnUndoPutsBackWhatWasThere
  ✓ ARowNeverChangesOrganization
  ✓ OnlyItsOwnOrganizationChangesARow
  ✓ AViewerChangesNothing
  ✓ TheCountOnlyGoesUp
```

## 5. One instance per import that applies the proved fold: `DraftOfCells`

One act is one command and names every row it touches, as accepting a fix for a group of rows does. A confirm names
the version its sender had been told and is refused when the draft has moved on.

```typescript
// One import's review as ONE instance that orders every act and the confirm, holding each row's decision as the
// shared fold's cell (Cell.rules.ts). An act is one command and one undo step, and may name many rows ("accept this
// fix for these rows"); a confirm names the version its sender had been told.
import * as Domain from "@alchemy.run/domain"
import * as Effect from "effect/Effect"
import * as S from "effect/Schema"
import { CurrentActor, Session } from "./Actor.context.ts"
import { Cell, decided, isOwnStep, undone } from "./Cell.rules.ts"

export const CellsDraftId = S.String.pipe(S.brand("CellsDraftId"))

const Held = S.Struct({ row: S.String, cell: Cell })

export class CellsOpened extends Domain.Event("CellsOpened", { organizationId: S.String }) {}
export class RowsDecided extends Domain.Event("RowsDecided", {
  by: S.String,
  step: S.String,
  value: S.String,
  rows: S.Array(S.String),
}) {}
export class StepUndone extends Domain.Event("StepUndone", { by: S.String, step: S.String }) {}
export class CellsConfirmed extends Domain.Event("CellsConfirmed", {}) {}

export class CellsNotPermitted extends Domain.Rejection("CellsNotPermitted", {}) {}
export class CellsNotOpen extends Domain.Rejection("CellsNotOpen", {}) {}
export class CellsAlreadyOpen extends Domain.Rejection("CellsAlreadyOpen", {}) {}
export class ReviewMovedOn extends Domain.Rejection("ReviewMovedOn", { current: S.Int }) {}

export class OpenCells extends Domain.Command("OpenCells", {
  middleware: [Session],
  input: { draftId: CellsDraftId },
  events: [CellsOpened],
  rejects: [CellsNotPermitted, CellsAlreadyOpen],
}) {}
export class DecideRows extends Domain.Command("DecideRows", {
  middleware: [Session],
  input: { draftId: CellsDraftId, step: S.String, value: S.String, rows: S.Array(S.String) },
  events: [RowsDecided],
  rejects: [CellsNotPermitted, CellsNotOpen],
}) {}
export class UndoStep extends Domain.Command("UndoStep", {
  middleware: [Session],
  input: { draftId: CellsDraftId, step: S.String },
  events: [StepUndone],
  rejects: [CellsNotPermitted, CellsNotOpen],
}) {}
export class ConfirmCells extends Domain.Command("ConfirmCells", {
  middleware: [Session],
  input: { draftId: CellsDraftId, reviewedAt: S.Int },
  events: [CellsConfirmed],
  rejects: [CellsNotPermitted, CellsNotOpen, ReviewMovedOn],
}) {}

export const CellsState = S.Union([
  S.TaggedStruct("Unopened", {}),
  S.TaggedStruct("Open", { organizationId: S.String, cells: S.Array(Held) }),
  S.TaggedStruct("Confirmed", { organizationId: S.String, cells: S.Array(Held) }),
])

export class DraftOfCells extends Domain.Aggregate("DraftOfCells", {
  id: CellsDraftId,
  state: CellsState,
  initial: { _tag: "Unopened" },
  transitions: {
    // No command clears a decision its sender did not make: a row another person decided is still decided afterwards.
    NobodyClearsAnotherPersonsDecision: Effect.fn(function* ({ before, after }) {
      if (before._tag === "Unopened" || after._tag === "Unopened") return true
      const actor = yield* CurrentActor
      return before.cells.every(
        (was) =>
          was.cell._tag !== "Decided" ||
          was.cell.by === actor.memberId ||
          after.cells.some((now) => now.row === was.row && now.cell._tag === "Decided"),
      )
    }),
    // An act touches the rows it names and no other: two people's acts on different rows both survive either order.
    AnActTouchesOnlyTheRowsItNames: ({ before, after, command }) =>
      command._tag !== "DecideRows" ||
      before._tag !== "Open" ||
      after._tag !== "Open" ||
      before.cells.every(
        (was) =>
          command.rows.includes(was.row) ||
          after.cells.some((now) => now.row === was.row && now.cell.changes === was.cell.changes),
      ),
    // An undo changes only rows whose current decision is its sender's, made in the step it names.
    AnUndoTakesBackOnlyItsOwnStep: Effect.fn(function* ({ before, after, command }) {
      if (command._tag !== "UndoStep" || before._tag !== "Open" || after._tag !== "Open") return true
      const actor = yield* CurrentActor
      return before.cells.every(
        (was) =>
          isOwnStep(was.cell, actor.memberId, command.step) ||
          after.cells.some((now) => now.row === was.row && now.cell.changes === was.cell.changes),
      )
    }),
    // Nothing changes after the confirm.
    AConfirmedDraftKeepsItsDecisions: ({ before, after }) =>
      before._tag !== "Confirmed" || (after._tag === "Confirmed" && after.cells.length === before.cells.length),
    OnlyItsOwnOrganizationChangesADraft: Effect.fn(function* ({ before }) {
      if (before._tag === "Unopened") return true
      return (yield* CurrentActor).organizationId === before.organizationId
    }),
    AViewerChangesNothing: Effect.fn(function* () {
      return (yield* CurrentActor).role !== "viewer"
    }),
  },
  commands: [OpenCells, DecideRows, UndoStep, ConfirmCells],
  keyOf: (cmd) => cmd.draftId,
  decide: {
    OpenCells: Effect.fn(function* (s) {
      const actor = yield* CurrentActor
      if (actor.role === "viewer") return yield* new CellsNotPermitted({})
      if (s._tag !== "Unopened") return yield* new CellsAlreadyOpen({})
      return [new CellsOpened({ organizationId: actor.organizationId })]
    }),
    DecideRows: Effect.fn(function* (s, cmd) {
      const actor = yield* CurrentActor
      if (s._tag !== "Open") return yield* new CellsNotOpen({})
      if (actor.organizationId !== s.organizationId || actor.role === "viewer") return yield* new CellsNotPermitted({})
      return [new RowsDecided({ by: actor.memberId, step: cmd.step, value: cmd.value, rows: cmd.rows })]
    }),
    UndoStep: Effect.fn(function* (s, cmd) {
      const actor = yield* CurrentActor
      if (s._tag !== "Open") return yield* new CellsNotOpen({})
      if (actor.organizationId !== s.organizationId || actor.role === "viewer") return yield* new CellsNotPermitted({})
      return [new StepUndone({ by: actor.memberId, step: cmd.step })]
    }),
    ConfirmCells: Effect.fn(function* (s, cmd, ctx) {
      const actor = yield* CurrentActor
      if (s._tag !== "Open") return yield* new CellsNotOpen({})
      if (actor.organizationId !== s.organizationId || actor.role === "viewer") return yield* new CellsNotPermitted({})
      if (cmd.reviewedAt !== ctx.version) return yield* new ReviewMovedOn({ current: ctx.version })
      return [new CellsConfirmed({})]
    }),
  },
  evolve: {
    CellsOpened: (_, e) => ({ _tag: "Open" as const, organizationId: e.organizationId, cells: [] }),
    RowsDecided: (s, e) =>
      s._tag !== "Open"
        ? s
        : {
            ...s,
            cells: [
              ...s.cells.map((held) =>
                e.rows.includes(held.row) ? { row: held.row, cell: decided(held.cell, e.by, e.value, e.step) } : held,
              ),
              ...e.rows
                .filter((row) => !s.cells.some((held) => held.row === row))
                .map((row) => ({
                  row,
                  cell: decided({ _tag: "Undecided" as const, changes: 0 }, e.by, e.value, e.step),
                })),
            ],
          },
    StepUndone: (s, e) =>
      s._tag !== "Open"
        ? s
        : {
            ...s,
            cells: s.cells.map((held) =>
              isOwnStep(held.cell, e.by, e.step) ? { row: held.row, cell: undone(held.cell) } : held,
            ),
          },
    CellsConfirmed: (s) =>
      s._tag !== "Open" ? s : { _tag: "Confirmed" as const, organizationId: s.organizationId, cells: s.cells },
  },
}) {}
```

Verify's report:

```text
VERIFIED
DraftOfCells: 6 rules, 4 commands

Checked: in every sequence of up to 3 commands on a new instance
  ✓ NobodyClearsAnotherPersonsDecision
      not proved for DecideRows: DecideRows has more than 4096 paths
  ✓ AnActTouchesOnlyTheRowsItNames
      not proved for DecideRows: DecideRows has more than 4096 paths
  ✓ AnUndoTakesBackOnlyItsOwnStep
      not proved for DecideRows: DecideRows has more than 4096 paths
  ✓ AConfirmedDraftKeepsItsDecisions
      not proved for DecideRows: DecideRows has more than 4096 paths
  ✓ OnlyItsOwnOrganizationChangesADraft
      not proved for DecideRows: DecideRows has more than 4096 paths
  ✓ AViewerChangesNothing
      not proved for DecideRows: DecideRows has more than 4096 paths
```

Searched one command deeper (`Verify.aggregate(DraftOfCells, { depth: 4 })`, 450 s), the search stopped at its budget of
100,000 sequences: every sequence of up to 3 commands ran, and some of 4, and no rule broke on the 95,035 steps taken.
Verify reports that run as not verified, because it was cut short. Its report also says how far the proof got for
each command; the second block repeats for every rule:

```text
Not done
  ✗ the search stopped at its budget: only every sequence of up to 3 commands was run (allow: { truncated: true } passes with this)

✗ NobodyClearsAnotherPersonsDecision
    ✓ proved for OpenCells
    ✗ DecideRows: not decided
        DecideRows has more than 4096 paths
    ✗ UndoStep: proved for short lists only
        state.cells was tried with up to 2 items
    ✗ ConfirmCells: proved for short lists only
        state.cells was tried with up to 2 items
    ✗ proved only from a state in the schema, which DecideRows may leave

DraftOfCells: every sequence of up to 4 commands on a new instance
100,000 sequences, 95,035 states (stopped at the budget: every sequence of up to 3 commands was run, and some of 4)

✓ NobodyClearsAnotherPersonsDecision holds on the 95,035 steps taken
✓ AnActTouchesOnlyTheRowsItNames holds on the 95,035 steps taken
✓ AnUndoTakesBackOnlyItsOwnStep holds on the 95,035 steps taken
✓ AConfirmedDraftKeepsItsDecisions holds on the 95,035 steps taken
✓ OnlyItsOwnOrganizationChangesADraft holds on the 95,035 steps taken
✓ AViewerChangesNothing holds on the 95,035 steps taken
```

So on this draft each rule is proved for the opening command, proved for lists of up to 2 rows for the undo and the
confirm, and not decided for the command that decides rows.

`DraftOfCellsHouse` is the same aggregate with every native array method replaced by `effect/Array`'s function, which
is what the type-check asks of code in a model package. Its report is the one above under its own name: the prover
reads these functions, and stops at the same command. The fold of `RowsDecided` in that form:

```typescript
    RowsDecided: (s, e) =>
      s._tag !== "Open"
        ? s
        : {
            ...s,
            cells: A.appendAll(
              A.map(s.cells, (held) =>
                A.some(e.rows, (row) => row === held.row)
                  ? { row: held.row, cell: decided(held.cell, e.by, e.value, e.step) }
                  : held,
              ),
              A.map(
                A.filter(e.rows, (row) => !A.some(s.cells, (held) => held.row === row)),
                (row) => ({ row, cell: decided({ _tag: "Undecided" as const, changes: 0 }, e.by, e.value, e.step) }),
              ),
            ),
          },
```

Read together with section 4: three of the row's eight rules follow from the functions `decided` and `undone`
alone. The other five are guards in `RowCell`'s own `decide`, which this draft does not have. That this draft applies
the functions to exactly the rows an act names, and to no other, is checked to three commands and not proved. No rule
here stops an act made on a stale screen.

## How large one draft's state is

A Durable Object stores an aggregate's state as one value, written again at every accepted command. The first round
took the limit on one value, 8 MB, from Cloudflare's page; the second round's trial 1 stores it. The state was built
as plain data and measured
as JSON, with every row decided, a fix accepted on most rows and a short name typed on the rest; nothing was stored
in an object.

| Rows decided | A typed name on | Who and which step written out as ids, as `DraftOfCells` holds them | Who and which step as a number into a list of steps the state holds once |
| --- | --- | --- | --- |
| 200 | every tenth row | 40 KB | 16 KB |
| 5,000 | every tenth row | 1,000 KB | 324 KB |
| 50,000 | every tenth row | 10,057 KB | 3,261 KB |
| 50,000 | every row | 11,014 KB | 4,218 KB |

One act's event that names its rows: 2 KB for 200 rows, 64 KB for 6,000, 575 KB for 50,000.

So a draft of the largest file the app takes (50,000 rows, `maxStagedRows`) fits one value only in the compact form,
and the compact form is not what any model here ran: it keeps no decision under the current one, and it reads a list
at a place given by a number from the state, which the prover does not read. The second round measures the state the
models hold.

## Running it again

- The sources above are complete. Put the six files in one folder beside a manifest like the one above, and write one
  test per aggregate that calls `Verify.aggregate` and writes `Verify.render` of the report to a file.
- Run each with `node node_modules/vitest/vitest.mjs run <file>`.
- When the library's `main` moves, change the commit in the two addresses; the reports name every rule, so a
  difference shows as a changed line.

# The second round

Run on 2026-11-20, because the first round claimed more than it had shown. Everything
here ran outside the repository, as a consumer of the library's preview build of `main@dbfd0dd`, beside `effect`
4.1.4, under Vitest 5.1.1 on Node 24.22.1, unless a line says otherwise.

| # | What | Result |
| --- | --- | --- |
| 1 | The largest value one Durable Object stores, through the domain host in local workerd | An aggregate's state grew to 8.3 MB; the command that would take it to 8.5 MB failed with `string or blob too big: SQLITE_TOOBIG`. The limit is about 8 MiB. The library's 2 MiB is a guard of its cluster package alone. A deployed object was not tried |
| 2 | The row with the app's real decision shape (`RowReal`) | **Not verified.** Both commands have more than 4,096 paths; the search stopped at its budget after sequences of 1 command |
| 2 | The row with the decision as the text the database holds today (`RowSeen`) | **Nine rules proved** |
| 3 | An act names the decision it saw, by its step (`RowSeen`, and `DecideRow` in the model) | **Proved**, on the row and as a decision's own rule; six orderings pass as stories on the real model |
| 3 | A confirm names the last change it saw (`ImportLife`) | **Proved** |
| 4 | A match and a reopen on the model (`ImportLife`) | **Proved**: a match raises its own field's matching and no other; an accept names the matching it saw; nothing is reviewed on an import that is not open |
| 5 | The lifecycle with no list, one instance per row, every act a decision across both (`Review`) | **Verified. 27 rules proved, 1 checked** (a relation across instances) |
| 5 | One instance per import with all of the above (`DraftSeen`) | **Not verified.** None of its eight rules is proved, and the search stopped at its budget with every sequence of up to 2 commands run (758 s) |
| 5 | A group act sent as one act per row by a saga | **Not run.** Counted below |
| 6 | A decision, a relation, a model invariant, an `eventually` rule, a broken rule kept as a story | Decision and relation **proved**; model invariant and `eventually` **checked**, to 2 commands; the kept story fails on the broken code and passes on the fixed |
| | Handlers written as `Effect.fn("name")(…)` (`RowNamed`) | **Proved**, the same nine rules |
| | An id and a value schema imported from another package by name (`RowPackaged`) | **Proved**, the same nine rules |
| | The request context and its middleware imported from another package by name (`RowActor`) | **Not verified**: the prover does not read `yield* CurrentActor` from a package |

"Proved" is Verify's word for: every state the schema allows and every input, after any number of commands. "Checked"
is: every sequence of commands up to a length, 3 for one aggregate and 2 for a model, where a list a command carries
has at most 2 items more than its schema asks for, and then 200 random longer walks for a model.

## Corrections to the first round

- **The first round's "proved" is of a decision that is one string.** `RowDecision` and `RowCell` hold `value:
  S.String`. Trial 2 below runs the app's real shape.
- **The row's proof is of an aggregate, not of the three shared functions.** Three of `RowCell`'s eight rules follow
  from `decided` and `undone` alone (`EveryChangeIsCounted`, `AnUndoPutsBackWhatWasThere`, `TheCountOnlyGoesUp`). The
  other five hold because of guards written in `RowCell`'s own `decide`. The comment at the top of `RowCell`, and the
  sentence that closed section 5, said more than that.
- **Neither one-instance draft of the first round had `seen`.** On `ReviewDraft` and `DraftOfCells` a stale act
  replaces another person's decision and all six rules pass, because the rule as written there asks only that a
  decided row is still decided afterwards.
- **`DeltaDraft`'s breaking sequence has nothing stale in it.** It is a second person clearing a row on purpose, which
  today's contract allows any editor to do. What it shows is that a command of rows to clear cannot say whether its
  sender saw what it clears.
- **`seen` as a count cannot work.** Every decision and every undo adds one, the sender's own included, so a person's
  second act on a row is refused against their own first, or, if the screen predicts the count, is applied over a
  decision they never saw. Trial 3 replaces it.
- **Nothing evaluates a rule when the app runs.** Invariants, transitions, relations and `eventually` rules are read
  by Verify, Prove and Explore. No host runs them. What refuses a state in the running app is `decide`.
- **The first round's 8 MB was read from a page and never stored.** Trial 1 stores it.

## Trial 1. The largest value one object stores

The domain's Durable Object host writes an aggregate's whole state as one value at every accepted command
(`packages/domain/src/DurableObjects.ts`, `state.storage.put("meta", { state, version })`).

**What the sources say.**

| Source | Says |
| --- | --- |
| Cloudflare's limits page for Durable Objects, read 2026-11-19 and again 2026-11-20 | SQLite-backed objects: "Key and value combined cannot exceed 8 MB"; "Maximum string, `BLOB` or table row size: 8 MB". Key-value backed objects: value 128 KiB |
| Cloudflare's limits page for D1 | "Maximum string, `BLOB` or table row size: 2,000,000 bytes (2 MB)" |
| The library, `packages/effect-cluster/src/Cloudflare/internal/Objects.ts` 48-49 | "The most bytes workerd's SQLite stores in one value": `MAX_ENCODED_BYTES = 2 * 1024 * 1024` |
| The library, `packages/effect-cluster/src/internal/EntityRuntime.ts` 108-113, 194-197 | `maxEncodedBytes` ("Cloudflare's SQLite: 2 MB"); a persisted call over it is rejected before it reaches storage |
| The library, `packages/git/src/DESIGN.md` 47 | "The 2 MB SQLite row cap forces the R2 split" |

**Through the domain host.** One aggregate whose command appends text to its state, hosted on
`DomainCloudflare.layerDurableObjects()` in an Effect-native Worker, started with `alchemy dev` from the preview
builds of `alchemy`, `@alchemy.run/cloudflare` and `@alchemy.run/domain` (workerd 1.20261117.1), with an empty home
folder and no Cloudflare variable in its environment. It asked for no login. Each line is one command and the
state's length after it:

```text
url: http://localhost:1337 after 7s
append 1000000 -> {"ok":true,"length":1000000}

append 1000000 -> {"ok":true,"length":2000000}

append 1000000 -> {"ok":true,"length":3000000}

append 2000000 -> {"ok":true,"length":5000000}

append 2000000 -> {"ok":true,"length":7000000}

append 900000 -> {"ok":true,"length":7900000}

append 200000 -> {"ok":true,"length":8100000}

append 200000 -> {"ok":true,"length":8300000}

append 200000 -> {"ok":false,"failure":"Error: Error: string or blob too big: SQLITE_TOOBIG\n    at file:///bundle/worker.js:49:4432\n    at MixedScheduler.<anonymous> (file:///bundle/Stream-BL5ovlUU.js:15:6714)\n    at Effect.fn (file:///bundle/worker.js:81:40763)\n    at Effect.fn (definition) (file:///bundle/worker.js:81:40253)\n    at Effect.fn (file:///bundle/Stream-BL5ovlUU.js:15:11236)\n    at Effect.fn (de

state -> {"ok":true,"length":8300000}

append 1000 after the refusal -> {"ok":true,"length":8301000}

dev log tail:
[01:40:54.006] INFO: [LimitWorker] create (local)
[01:40:54.006] INFO: [LimitWorker/Blobs.BlobAggregate] create
[01:40:54.007] INFO: [LimitWorker/Blobs.DomainBackfill] create
[01:40:54.007] INFO: [LimitWorker/Blobs.DomainDirectory] create
[01:40:54.007] INFO: 
[01:40:54.014] INFO: [LimitWorker] pre-creating (local)
[01:40:54.028] INFO: [Blobs.DomainBackfill] creating (local)
[01:40:54.036] INFO: [LimitWorker] creating (local)
[01:40:57.341] INFO: [LimitWorker] Started in 3301ms → http://localhost:1337/
[01:40:57.345] INFO: [LimitWorker] ready at http://localhost:1337
[01:40:57.348] INFO: [Blobs.DomainBackfill] created (local) (3.3s)
[01:40:57.348] INFO: [LimitWorker] created (local) (3.3s)
[01:40:57.350] INFO: { url: 'http://localhost:1337' }
[01:40:57.350] INFO: 
[01:40:57.350] INFO: Done: 2 succeeded (3.3s)
exit 0
```

The model, the Worker and the stack:

```typescript
// An aggregate whose state grows: each Append adds `size` characters to `text`.
// The event carries only the size, so only the state (the "meta" value) grows.
import * as Domain from "@alchemy.run/domain";
import * as Schema from "effect/Schema";

export const BlobId = Schema.String.pipe(Schema.brand("BlobId"));

export class Appended extends Domain.Event("Appended", { size: Schema.Int }) {}

export class Append extends Domain.Command("Append", {
  input: { blobId: BlobId, size: Schema.Int },
  events: [Appended],
}) {}

export class Blob extends Domain.Aggregate("Blob", {
  id: BlobId,
  state: Schema.Struct({ text: Schema.String }),
  initial: { text: "" },
  commands: [Append],
  keyOf: (command) => command.blobId,
  decide: {
    Append: (_, command) => [new Appended({ size: command.size })],
  },
  evolve: {
    Appended: (state, event) => ({ text: state.text + "x".repeat(event.size) }),
  },
}) {}

export class Blobs extends Domain.Model("Blobs", { aggregates: [Blob] }) {}
```

```typescript
// POST /append/<id>/<size>: send Append, answer the state's length or the failure.
// GET  /state/<id>: the state's length.
import * as Cloudflare from "@alchemy.run/cloudflare";
import * as DomainCloudflare from "@alchemy.run/domain/Cloudflare";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { HttpServerRequest } from "effect/http/HttpServerRequest";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Layer from "effect/Layer";
import { Append, Blob, BlobId, Blobs } from "./model.ts";

const BlobsLive = Blobs.layer(Layer.empty).pipe(Layer.provide(DomainCloudflare.layerDurableObjects()));

const ROUTE = /^\/(append|state)\/([^/]+)(?:\/(\d+))?$/;

export default class LimitWorker extends Cloudflare.Worker<LimitWorker>()(
  "LimitWorker",
  { main: import.meta.url },
  Effect.gen(function* () {
    const blobs = yield* Blob;
    return {
      fetch: Effect.gen(function* () {
        const request = yield* HttpServerRequest;
        const route = ROUTE.exec(new URL(request.url, "http://localhost").pathname);
        if (!route) return HttpServerResponse.text("Not Found", { status: 404 });
        const id = BlobId.make(route[2]!);
        if (route[1] === "append") {
          const sent = yield* Effect.exit(blobs.send(new Append({ blobId: id, size: Number(route[3]) })));
          if (Exit.isFailure(sent))
            return yield* HttpServerResponse.json({ ok: false, failure: Cause.pretty(sent.cause) });
        }
        const got = yield* Effect.exit(blobs.get(id));
        if (Exit.isFailure(got)) return yield* HttpServerResponse.json({ ok: false, getFailure: Cause.pretty(got.cause) });
        return yield* HttpServerResponse.json({ ok: true, length: got.value.text.length });
      }),
    };
  }).pipe(Effect.provide(BlobsLive)),
) {}
```

```typescript
// The stack for `alchemy dev`: one Worker hosting the Blobs model on Durable Objects, local state.
import * as Cloudflare from "@alchemy.run/cloudflare";
import * as DomainCloudflare from "@alchemy.run/domain/Cloudflare";
import * as Alchemy from "alchemy";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import LimitWorker from "./worker.ts";

export default Alchemy.Stack(
  "DoValueLimit",
  {
    providers: Layer.mergeAll(Cloudflare.providers(), DomainCloudflare.providers()),
    state: Alchemy.localState(),
  },
  Effect.gen(function* () {
    const worker = yield* LimitWorker;
    return { url: worker.url.as<string>() };
  }),
);
```

**The same call on a bare object.** A Worker with one SQLite-backed class making the host's own call,
`ctx.storage.put("meta", { state, version })`, under `wrangler dev --local` (wrangler 4.161.0, workerd 1.20261110.1),
a fresh object for each size, read back and compared by length:

| Form | Size | Stored |
| --- | --- | --- |
| object and string | 1.9 MiB, 2.1 MiB, 3 MB, 7.9 MB, 8.1 MB | yes, each |
| object | 8,388,600 bytes of JSON | yes |
| object | 8,388,700 bytes of JSON | no: `Error: string or blob too big: SQLITE_TOOBIG` |
| string | 8,388,625 characters | yes |
| string | 8,388,626 characters | no: the same error |

```javascript
// One Durable Object class that makes the call the domain host makes:
//   this.ctx.storage.put("meta", { state, version })
// GET /?form=object|string&bytes=N&obj=<name>
//   form=object: state = { blob: "x"... } with JSON.stringify(state).length === N
//   form=string: the value put under "meta" is one string of N one-byte chars
// Answers JSON: { stored, error, putLength, gotLength }.
import { DurableObject } from "cloudflare:workers";

export class Box extends DurableObject {
  async fetch(request) {
    const url = new URL(request.url);
    // Which backend this object runs on: only a SQLite-backed object has a working sql.
    let sqlite;
    try { this.ctx.storage.sql.exec("SELECT 1"); sqlite = true; } catch { sqlite = false; }
    const form = url.searchParams.get("form");
    const bytes = Number(url.searchParams.get("bytes"));
    let value;
    let putLength;
    if (form === "object") {
      const overhead = JSON.stringify({ blob: "" }).length;
      const state = { blob: "x".repeat(bytes - overhead) };
      putLength = JSON.stringify(state).length;
      value = { state, version: 1 };
    } else {
      value = "x".repeat(bytes);
      putLength = value.length;
    }
    try {
      await this.ctx.storage.put("meta", value);
    } catch (e) {
      return Response.json({ stored: false, error: `${e?.name}: ${e?.message}`, putLength, sqlite });
    }
    let got;
    try {
      got = await this.ctx.storage.get("meta");
    } catch (e) {
      return Response.json({ stored: "put ok, get failed", error: `${e?.name}: ${e?.message}`, putLength, sqlite });
    }
    const gotLength = form === "object" ? JSON.stringify(got?.state ?? null).length : (got?.length ?? -1);
    const sameVersion = form === "object" ? got?.version === 1 : true;
    return Response.json({ stored: gotLength === putLength && sameVersion, error: null, putLength, gotLength, sqlite });
  }
}

// The same code on the key-value (non-SQLite) backend.
export class BoxKv extends Box {}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const ns = url.searchParams.get("ns") === "kv" ? env.BOX_KV : env.BOX_SQL;
    const stub = ns.get(ns.idFromName(url.searchParams.get("obj") ?? "one"));
    return stub.fetch(request);
  },
};
```

**Which governs.** For an aggregate, a view or a projection on the domain's Durable Object host, the platform's
limit: about 8 MiB for one value, in local workerd. The 2 MiB is the cluster package's own guard. It governs a value
an entity persists on Effect Cluster's Durable Object pool, and so a domain model hosted there. The domain host has
no size check of its own.

**Not verified.** A deployed object: no deploy was made. Local workerd also stored 8 MB on a key-value backed class,
where the page says 128 KiB, so a local run is no proof of a deployed limit.

## Trial 2. The row with the app's real decision

`RowReal` is `RowSeen` (below) with its decision in the shape the contract gives it,
`packages/catalog/contract/src/Import/Decision.command.ts`: six keys that may each be left out, one of them a
record.

```typescript
const Flags = S.Struct({
  out: S.optionalKey(S.Boolean),
  kept: S.optionalKey(S.Boolean),
  accepted: S.optionalKey(S.Array(S.String)),
  reverted: S.optionalKey(S.Array(S.String)),
  edits: S.optionalKey(S.Record(S.String, S.String)),
  stored: S.optionalKey(S.Literals(["keep", "replace"])),
})
```

Verify's report, 369.72 s by its run log (its first 34 lines, then its last lines):

```text
NotVerified

RowReal: 9 rules, 2 commands

Checked: in every sequence of up to 3 commands on a new instance
  ✓ ADecisionIsReplacedOnlyByAnActThatSawIt
      not proved for DecideRow: DecideRow has more than 4096 paths
  ✓ NobodyClearsAnotherPersonsDecision
      not proved for DecideRow: DecideRow has more than 4096 paths
  ✓ AnUndoTakesBackOnlyItsSendersOwnStep
      not proved for DecideRow: DecideRow has more than 4096 paths
  ✓ AnUndoPutsBackWhatWasThere
      not proved for DecideRow: DecideRow has more than 4096 paths
  ✓ ADecisionOnARowWithNoneSawNone
      not proved for DecideRow: DecideRow has more than 4096 paths
  ✓ ADecisionIsRecordedAsSent
      not proved for DecideRow: DecideRow has more than 4096 paths
  ✓ ARowNeverChangesOrganization
      not proved for DecideRow: DecideRow has more than 4096 paths
  ✓ OnlyItsOwnOrganizationChangesARow
      not proved for DecideRow: DecideRow has more than 4096 paths
  ✓ AViewerChangesNothing
      not proved for DecideRow: DecideRow has more than 4096 paths

Not done
  ✗ the real code disagrees with what the explorer read in 2 sequences
  ✗ the search stopped at its budget: only every sequence of up to 1 commands was run (allow: { truncated: true } passes with this)

RowReal: 0 invariants, 9 transitions, 2 commands

✗ The state stays in its schema
    ✓ holds on the initial state
    ✗ DecideRow: not decided
        DecideRow has more than 4096 paths
```

```text

Assuming:
  - whole numbers are exact: a number stays within ±2^53, and a bigint has no limit
  - an event or rejection whose fields fail its schema crashes the command, and nothing is committed

RowReal: every sequence of up to 3 commands on a new instance
100,000 sequences, 14,392 states (stopped at the budget: every sequence of up to 1 commands was run, and some of 2)

✓ ADecisionIsReplacedOnlyByAnActThatSawIt holds on the 14,392 steps taken
✓ NobodyClearsAnotherPersonsDecision holds on the 14,392 steps taken
✓ AnUndoTakesBackOnlyItsSendersOwnStep holds on the 14,392 steps taken
✓ AnUndoPutsBackWhatWasThere holds on the 14,392 steps taken
✓ ADecisionOnARowWithNoneSawNone holds on the 14,392 steps taken
✓ ADecisionIsRecordedAsSent holds on the 14,392 steps taken
```

The report ends: "The real code disagrees with the explorer: the prover cannot build 1.command.flags.edits
(command)". The prover takes each key that may be left out both ways and each member of a union in turn when it
builds a state or a command, so this shape passes its limit before any branch of the code is counted, and it cannot
see into a record at all.

So the encoding is part of the design: **the aggregate holds a row's decision as text**, the text the `importDecision`
table holds today, and no rule reads inside it. The contract's `RowDecision` schema decodes it at the edges, where the
screen and the server's `review` read it. What a rule does need from a decision travels beside the text as its own
field: the field an act accepts and the matching it saw (`accept`, in trial 4).

## Trial 3. An act names the decision it saw

A step is the id the screen gives one act at the press. An act names the step of the decision its sender saw on the
row, or that it saw none. The screen shows the view with the person's own acts over it, so for a second act on the
same row the decision it saw is the person's own first act, whose step it made itself. Nothing is counted on either
side.

```typescript
// One row of one import's review as its own instance. The decision is held as the text the database holds today;
// no rule reads inside it. An act names the decision its sender saw on this row, by that decision's step, and
// replaces only that one. A step is the id the screen gives one act at the press.
import * as Domain from "@alchemy.run/domain"
import * as Effect from "effect/Effect"
import * as S from "effect/Schema"
import { CurrentActor, Session } from "./Actor.context.ts"

export const RowKey = S.String.pipe(S.brand("RowKey"))

// The decision an act's sender saw on the row: none, or the one made in a step.
const Saw = S.Union([S.TaggedStruct("Nothing", {}), S.TaggedStruct("Step", { step: S.String })])

export class RowDecided extends Domain.Event("RowDecided", {
  organizationId: S.String,
  by: S.String,
  step: S.String,
  flags: S.String,
}) {}
export class StepUndone extends Domain.Event("StepUndone", {}) {}

export class RowNotPermitted extends Domain.Rejection("RowNotPermitted", {}) {}
// The row holds a decision its sender did not see: whose it is and its step, so the screen can say so.
export class DecidedSince extends Domain.Rejection("DecidedSince", { by: S.String, step: S.String }) {}
// The decision its sender saw is no longer there, and the row has none.
export class NoLongerThere extends Domain.Rejection("NoLongerThere", {}) {}
export class StepAlreadyUsed extends Domain.Rejection("StepAlreadyUsed", {}) {}
export class NotYourStep extends Domain.Rejection("NotYourStep", {}) {}

export class DecideRow extends Domain.Command("DecideRow", {
  middleware: [Session],
  input: { rowKey: RowKey, step: S.String, saw: Saw, flags: S.String },
  events: [RowDecided],
  rejects: [RowNotPermitted, DecidedSince, NoLongerThere, StepAlreadyUsed],
}) {}
export class UndoStep extends Domain.Command("UndoStep", {
  middleware: [Session],
  input: { rowKey: RowKey, step: S.String },
  events: [StepUndone],
  rejects: [RowNotPermitted, NotYourStep],
}) {}

const Under = S.Union([
  S.TaggedStruct("Nothing", {}),
  S.TaggedStruct("Was", { by: S.String, step: S.String, flags: S.String }),
])

export const RowState = S.Union([
  S.TaggedStruct("Untouched", {}),
  S.TaggedStruct("Undecided", { organizationId: S.String }),
  S.TaggedStruct("Decided", {
    organizationId: S.String,
    by: S.String,
    step: S.String,
    flags: S.String,
    under: Under,
  }),
])

export class RowSeen extends Domain.Aggregate("RowSeen", {
  id: RowKey,
  state: RowState,
  initial: { _tag: "Untouched" },
  transitions: {
    // A decision is replaced only by an act whose sender saw it, or taken back by an undo.
    ADecisionIsReplacedOnlyByAnActThatSawIt: ({ before, after, command }) =>
      before._tag !== "Decided" ||
      (after._tag === "Decided" && after.step === before.step) ||
      command._tag === "UndoStep" ||
      (command.saw._tag === "Step" && command.saw.step === before.step),
    // No command clears a decision its sender did not make.
    NobodyClearsAnotherPersonsDecision: Effect.fn(function* ({ before, after }) {
      if (before._tag !== "Decided" || after._tag === "Decided") return true
      return (yield* CurrentActor).memberId === before.by
    }),
    // An undo is taken only for its sender's own step, while that step is still the row's decision.
    AnUndoTakesBackOnlyItsSendersOwnStep: Effect.fn(function* ({ before, command }) {
      if (command._tag !== "UndoStep") return true
      if (before._tag !== "Decided") return false
      return before.step === command.step && (yield* CurrentActor).memberId === before.by
    }),
    // An undo puts back what the step replaced, another person's decision included.
    AnUndoPutsBackWhatWasThere: ({ before, after, command }) =>
      command._tag !== "UndoStep" ||
      before._tag !== "Decided" ||
      (before.under._tag === "Nothing"
        ? after._tag === "Undecided"
        : after._tag === "Decided" &&
          after.by === before.under.by &&
          after.step === before.under.step &&
          after.flags === before.under.flags),
    // A decision made on a row that has none saw none.
    ADecisionOnARowWithNoneSawNone: ({ before, command }) =>
      command._tag !== "DecideRow" || before._tag === "Decided" || command.saw._tag === "Nothing",
    // What is recorded is what its sender said, under their own name and the act's step.
    ADecisionIsRecordedAsSent: Effect.fn(function* ({ after, command }) {
      if (command._tag !== "DecideRow") return true
      const actor = yield* CurrentActor
      return (
        after._tag === "Decided" &&
        after.by === actor.memberId &&
        after.step === command.step &&
        after.flags === command.flags
      )
    }),
    ARowNeverChangesOrganization: ({ before, after }) =>
      before._tag === "Untouched" || after._tag === "Untouched" || before.organizationId === after.organizationId,
    OnlyItsOwnOrganizationChangesARow: Effect.fn(function* ({ before }) {
      if (before._tag === "Untouched") return true
      return (yield* CurrentActor).organizationId === before.organizationId
    }),
    AViewerChangesNothing: Effect.fn(function* () {
      return (yield* CurrentActor).role !== "viewer"
    }),
  },
  commands: [DecideRow, UndoStep],
  keyOf: (cmd) => cmd.rowKey,
  decide: {
    DecideRow: Effect.fn(function* (s, cmd) {
      const actor = yield* CurrentActor
      if (actor.role === "viewer") return yield* new RowNotPermitted({})
      if (s._tag !== "Untouched" && s.organizationId !== actor.organizationId) return yield* new RowNotPermitted({})
      if (s._tag === "Decided") {
        if (cmd.saw._tag !== "Step" || cmd.saw.step !== s.step) {
          return yield* new DecidedSince({ by: s.by, step: s.step })
        }
        if (cmd.step === s.step) return yield* new StepAlreadyUsed({})
      } else if (cmd.saw._tag !== "Nothing") {
        return yield* new NoLongerThere({})
      }
      return [
        new RowDecided({ organizationId: actor.organizationId, by: actor.memberId, step: cmd.step, flags: cmd.flags }),
      ]
    }),
    UndoStep: Effect.fn(function* (s, cmd) {
      const actor = yield* CurrentActor
      if (actor.role === "viewer") return yield* new RowNotPermitted({})
      if (s._tag === "Untouched" || s.organizationId !== actor.organizationId) return yield* new RowNotPermitted({})
      if (s._tag !== "Decided" || s.by !== actor.memberId || s.step !== cmd.step) return yield* new NotYourStep({})
      return [new StepUndone({})]
    }),
  },
  evolve: {
    RowDecided: (s, e) => ({
      _tag: "Decided" as const,
      organizationId: e.organizationId,
      by: e.by,
      step: e.step,
      flags: e.flags,
      under:
        s._tag === "Decided"
          ? { _tag: "Was" as const, by: s.by, step: s.step, flags: s.flags }
          : { _tag: "Nothing" as const },
    }),
    StepUndone: (s) =>
      s._tag !== "Decided"
        ? s
        : s.under._tag === "Was"
          ? {
              _tag: "Decided" as const,
              organizationId: s.organizationId,
              by: s.under.by,
              step: s.under.step,
              flags: s.under.flags,
              under: { _tag: "Nothing" as const },
            }
          : { _tag: "Undecided" as const, organizationId: s.organizationId },
  },
}) {}
```

Verify's report, 2 s:

```text
VERIFIED
RowSeen: 9 rules, 2 commands

Proved: for every state and every input, after any number of commands
  ✓ ADecisionIsReplacedOnlyByAnActThatSawIt
  ✓ NobodyClearsAnotherPersonsDecision
  ✓ AnUndoTakesBackOnlyItsSendersOwnStep
  ✓ AnUndoPutsBackWhatWasThere
  ✓ ADecisionOnARowWithNoneSawNone
  ✓ ADecisionIsRecordedAsSent
  ✓ ARowNeverChangesOrganization
  ✓ OnlyItsOwnOrganizationChangesARow
  ✓ AViewerChangesNothing
```

What the nine say for the cases the review raised:

- **A person's own second act on a row** names their first act's step. If the first was recorded, the second
  replaces it. If the first was refused because someone else decided the row, the second names a step the row does
  not hold and is refused too, with whose decision is there. It never goes over a decision its sender did not see.
- **`DecidedSince { by, step }`** is a rejection, built in `decide` from the state. A command's reply cannot carry
  this: a reply is computed from the state after and the events recorded, and is given neither the command nor the
  state before.
- **Proved here means for a row that takes its own commands.** In the model of trial 5 the same checks are a
  decision's.

Two forms the brief had called untried, each the same aggregate with one change, each with the same nine rules
proved:

- `RowNamed`: `decide`'s handlers and a transition written `Effect.fn("RowNamed.DecideRow")(function* …)`. 3.6 s.
- `RowPackaged`: `RowKey` and `Saw` imported from another package by its name, linked as a workspace package is.
  3.9 s. A schema used as a field's type can live in another package. What must be reached by a relative path is
  what `decide`, `evolve` and the rules build with `new`, call or yield.

And one that is not read:

- `RowActor`: `CurrentActor` and `Session` imported from another package by its name. **Not verified**: "DecideRow:
  not read … yields a value the prover has no model for", at each `yield* CurrentActor`. The request context an
  aggregate reads has to be declared in the aggregate's own package and reached by a relative path.

## Trial 4. A match, a reopen, and a confirm that names what it saw

The import's lifecycle as its own aggregate, with no list in its state. It keeps how many times each field's column
has been matched and the step of the last change. The values both this and the decisions use:

```typescript
// What an act's sender had seen, said by identity and never by a count: the step of a decision, or of the last change
// to an import. A step is the id the screen gives one act at the press. The screen names the step of what it shows,
// its own acts on the way included, so no arithmetic is done on either side.
import * as S from "effect/Schema"

export const Saw = S.Union([S.TaggedStruct("Nothing", {}), S.TaggedStruct("Step", { step: S.String })])
export type Saw = typeof Saw.Type

// The fields a column can be matched to. The trial uses four of the app's.
export const Field = S.Literals(["sku", "name", "uom", "unitCost"])
export type Field = typeof Field.Type

// How many times each field's column has been matched.
export const Matching = S.Struct({ sku: S.Int, name: S.Int, uom: S.Int, unitCost: S.Int })
export type Matching = typeof Matching.Type

export const noMatching: Matching = { sku: 0, name: 0, uom: 0, unitCost: 0 }

/** A field's matching, as a number an accept can name. */
export const matchingOf = (matching: Matching, field: Field): number =>
  field === "sku" ? matching.sku : field === "name" ? matching.name : field === "uom" ? matching.uom : matching.unitCost

/** The matching after a field's column was matched again: that field's number one higher, every other as it was. */
export const matchedAgain = (matching: Matching, field: Field): Matching =>
  field === "sku"
    ? { ...matching, sku: matching.sku + 1 }
    : field === "name"
      ? { ...matching, name: matching.name + 1 }
      : field === "uom"
        ? { ...matching, uom: matching.uom + 1 }
        : { ...matching, unitCost: matching.unitCost + 1 }

// An act that accepts a proposal names its field and the matching of that field its sender saw.
export const Accept = S.Union([
  S.TaggedStruct("Nothing", {}),
  S.TaggedStruct("Fix", { field: Field, matching: S.Int }),
])
export type Accept = typeof Accept.Type
```

```typescript
// One import's lifecycle as its own instance, with no list in its state: staged, matched, confirmed, taken back,
// opened again, removed. It holds how many times each field's column was matched, and the step of the last change,
// so a confirm can name the last change its sender saw. Rows are not here.
import * as Domain from "@alchemy.run/domain"
import * as Effect from "effect/Effect"
import * as S from "effect/Schema"
import { CurrentActor, Session } from "./Actor.context.ts"
import { Field, Matching, Saw, matchedAgain, noMatching } from "./Seen.value.ts"

export const ImportId = S.String.pipe(S.brand("ImportId"))
const Count = S.Int.check(S.isGreaterThanOrEqualTo(0))

export class ImportStaged extends Domain.Event("ImportStaged", { organizationId: S.String, rows: Count }) {}
export class ColumnMatched extends Domain.Event("ColumnMatched", { field: Field, step: S.String }) {}
// One act of the review counted on its import: recorded by the decision that also records the row.
export class ActCounted extends Domain.Event("ActCounted", { step: S.String }) {}
export class SuggestionRecorded extends Domain.Event("SuggestionRecorded", {}) {}
export class ImportConfirmed extends Domain.Event("ImportConfirmed", { created: Count, notImported: Count }) {}
export class ImportTakenBack extends Domain.Event("ImportTakenBack", { removed: Count, kept: Count }) {}
export class ImportReopened extends Domain.Event("ImportReopened", {}) {}
export class ImportRemoved extends Domain.Event("ImportRemoved", {}) {}

export class NotPermitted extends Domain.Rejection("NotPermitted", {}) {}
export class AlreadyStaged extends Domain.Rejection("AlreadyStaged", {}) {}
export class NotOpen extends Domain.Rejection("NotOpen", {}) {}
// The import changed after what its sender saw: the step of the last change, for the screen to show from.
export class ReviewMovedOn extends Domain.Rejection("ReviewMovedOn", { last: Saw }) {}
export class CountsDoNotAddUp extends Domain.Rejection("CountsDoNotAddUp", {}) {}
export class NotImported extends Domain.Rejection("NotImported", {}) {}
export class MoreKeptThanCreated extends Domain.Rejection("MoreKeptThanCreated", {}) {}
export class NotClosed extends Domain.Rejection("NotClosed", {}) {}
export class HasBeenConfirmed extends Domain.Rejection("HasBeenConfirmed", {}) {}

export class StageImport extends Domain.Command("StageImport", {
  middleware: [Session],
  input: { importId: ImportId, rows: Count },
  events: [ImportStaged],
  rejects: [NotPermitted, AlreadyStaged],
}) {}
export class MatchColumn extends Domain.Command("MatchColumn", {
  middleware: [Session],
  input: { importId: ImportId, field: Field, step: S.String },
  events: [ColumnMatched],
  rejects: [NotPermitted, NotOpen],
}) {}
export class RecordSuggestion extends Domain.Command("RecordSuggestion", {
  middleware: [Session],
  input: { importId: ImportId },
  events: [SuggestionRecorded],
  rejects: [NotPermitted, NotOpen],
}) {}
export class ConfirmImport extends Domain.Command("ConfirmImport", {
  middleware: [Session],
  input: { importId: ImportId, saw: Saw, created: Count, notImported: Count },
  events: [ImportConfirmed],
  rejects: [NotPermitted, NotOpen, ReviewMovedOn, CountsDoNotAddUp],
}) {}
export class TakeBackImport extends Domain.Command("TakeBackImport", {
  middleware: [Session],
  input: { importId: ImportId, kept: Count },
  events: [ImportTakenBack],
  rejects: [NotPermitted, NotImported, MoreKeptThanCreated],
}) {}
export class ReopenImport extends Domain.Command("ReopenImport", {
  middleware: [Session],
  input: { importId: ImportId },
  events: [ImportReopened],
  rejects: [NotPermitted, NotClosed],
}) {}
export class RemoveImport extends Domain.Command("RemoveImport", {
  middleware: [Session],
  input: { importId: ImportId },
  events: [ImportRemoved],
  rejects: [NotPermitted, NotOpen, HasBeenConfirmed],
}) {}

export const ImportState = S.Union([
  S.TaggedStruct("Unstaged", {}),
  S.TaggedStruct("Open", {
    organizationId: S.String,
    rows: S.Int,
    confirms: S.Int,
    matching: Matching,
    last: Saw,
    suggestions: S.Int,
  }),
  S.TaggedStruct("Imported", {
    organizationId: S.String,
    rows: S.Int,
    confirms: S.Int,
    matching: Matching,
    last: Saw,
    created: S.Int,
    notImported: S.Int,
  }),
  S.TaggedStruct("TakenBack", {
    organizationId: S.String,
    rows: S.Int,
    confirms: S.Int,
    matching: Matching,
    last: Saw,
    removed: S.Int,
    kept: S.Int,
    notImported: S.Int,
  }),
  S.TaggedStruct("Removed", { organizationId: S.String }),
])

export class ImportLife extends Domain.Aggregate("ImportLife", {
  id: ImportId,
  state: ImportState,
  initial: { _tag: "Unstaged" },
  invariants: {
    // An import's outcomes add up to the rows in the file.
    OutcomesAddUpToTheRows: (s) =>
      s._tag === "Imported"
        ? s.created + s.notImported === s.rows
        : s._tag === "TakenBack"
          ? s.removed + s.kept + s.notImported === s.rows
          : true,
    NoCountIsNegative: (s) =>
      s._tag === "Imported"
        ? s.created >= 0 && s.notImported >= 0
        : s._tag === "TakenBack"
          ? s.removed >= 0 && s.kept >= 0 && s.notImported >= 0
          : true,
  },
  transitions: {
    // Nothing is written as an item before Confirm.
    NothingIsWrittenBeforeConfirm: ({ before, after, command }) =>
      after._tag !== "Imported" || before._tag === "Imported" || command._tag === "ConfirmImport",
    // A confirm of an import that is not open writes nothing.
    AConfirmOfAClosedImportWritesNothing: ({ before, after, command }) =>
      command._tag !== "ConfirmImport" || before._tag === "Open" || after._tag === before._tag,
    // Nothing is confirmed that its sender had not seen: the confirm names the last change to the import.
    AConfirmIsOfWhatItsSenderSaw: ({ before, command }) =>
      command._tag !== "ConfirmImport" ||
      before._tag !== "Open" ||
      (before.last._tag === "Nothing"
        ? command.saw._tag === "Nothing"
        : command.saw._tag === "Step" && command.saw.step === before.last.step),
    // Only an imported file is taken back, and a take-back keeps what someone changed.
    OnlyAnImportedFileIsTakenBack: ({ before, after }) =>
      after._tag !== "TakenBack" || before._tag === "Imported" || before._tag === "TakenBack",
    ATakeBackKeepsWhatWasChanged: ({ before, after, command }) =>
      command._tag !== "TakeBackImport" ||
      before._tag !== "Imported" ||
      after._tag !== "TakenBack" ||
      after.kept === command.kept,
    // A model proposes and never writes: a suggestion changes neither the matching nor the last change.
    ASuggestionWritesNothing: ({ before, after, command }) =>
      command._tag !== "RecordSuggestion" ||
      before._tag !== "Open" ||
      (after._tag === "Open" &&
        after.matching.sku === before.matching.sku &&
        after.matching.name === before.matching.name &&
        after.matching.uom === before.matching.uom &&
        after.matching.unitCost === before.matching.unitCost &&
        after.confirms === before.confirms),
    // A match raises its own field's matching by one and no other field's.
    AMatchRaisesOnlyItsOwnField: ({ before, after, command }) =>
      command._tag !== "MatchColumn" ||
      before._tag !== "Open" ||
      (after._tag === "Open" &&
        after.matching.sku === before.matching.sku + (command.field === "sku" ? 1 : 0) &&
        after.matching.name === before.matching.name + (command.field === "name" ? 1 : 0) &&
        after.matching.uom === before.matching.uom + (command.field === "uom" ? 1 : 0) &&
        after.matching.unitCost === before.matching.unitCost + (command.field === "unitCost" ? 1 : 0)),
    // While an import is not open, nothing about its review changes: no match, no act, no suggestion.
    OnlyAnOpenImportIsReviewed: ({ before, after }) =>
      before._tag === "Open" ||
      before._tag === "Unstaged" ||
      before._tag === "Removed" ||
      after._tag === "Removed" ||
      (after.matching.sku === before.matching.sku &&
        after.matching.name === before.matching.name &&
        after.matching.uom === before.matching.uom &&
        after.matching.unitCost === before.matching.unitCost &&
        (after.last._tag === "Nothing"
          ? before.last._tag === "Nothing"
          : before.last._tag === "Step" && before.last.step === after.last.step)),
    // An import that was confirmed or taken back is opened again only by Reopen, and keeps its count of confirms.
    AnImportIsOpenedAgainOnlyByReopen: ({ before, after, command }) =>
      after._tag !== "Open" ||
      before._tag === "Open" ||
      before._tag === "Unstaged" ||
      (command._tag === "ReopenImport" &&
        (before._tag === "Imported" || before._tag === "TakenBack") &&
        after.confirms === before.confirms),
    // A removed import stays removed, and only one that was never confirmed is removed.
    ARemovedImportStaysRemoved: ({ before, after }) => before._tag !== "Removed" || after._tag === "Removed",
    OnlyANeverConfirmedImportIsRemoved: ({ before, after }) =>
      after._tag !== "Removed" || before._tag === "Removed" || (before._tag === "Open" && before.confirms === 0),
    // Every row belongs to one organization.
    AnImportNeverChangesOrganization: ({ before, after }) =>
      before._tag === "Unstaged" || after._tag === "Unstaged" || before.organizationId === after.organizationId,
    OnlyItsOwnOrganizationChangesAnImport: Effect.fn(function* ({ before }) {
      if (before._tag === "Unstaged") return true
      return (yield* CurrentActor).organizationId === before.organizationId
    }),
    AViewerChangesNothing: Effect.fn(function* () {
      return (yield* CurrentActor).role !== "viewer"
    }),
  },
  commands: [StageImport, MatchColumn, RecordSuggestion, ConfirmImport, TakeBackImport, ReopenImport, RemoveImport],
  events: [ActCounted],
  keyOf: (cmd) => cmd.importId,
  decide: {
    StageImport: Effect.fn(function* (s, cmd) {
      const actor = yield* CurrentActor
      if (actor.role === "viewer") return yield* new NotPermitted({})
      if (s._tag !== "Unstaged") return yield* new AlreadyStaged({})
      return [new ImportStaged({ organizationId: actor.organizationId, rows: cmd.rows })]
    }),
    MatchColumn: Effect.fn(function* (s, cmd) {
      const actor = yield* CurrentActor
      if (s._tag !== "Open") return yield* new NotOpen({})
      if (actor.organizationId !== s.organizationId || actor.role === "viewer") return yield* new NotPermitted({})
      return [new ColumnMatched({ field: cmd.field, step: cmd.step })]
    }),
    RecordSuggestion: Effect.fn(function* (s) {
      const actor = yield* CurrentActor
      if (s._tag !== "Open") return yield* new NotOpen({})
      if (actor.organizationId !== s.organizationId || actor.role === "viewer") return yield* new NotPermitted({})
      return [new SuggestionRecorded({})]
    }),
    ConfirmImport: Effect.fn(function* (s, cmd) {
      const actor = yield* CurrentActor
      if (s._tag !== "Open") return yield* new NotOpen({})
      if (actor.organizationId !== s.organizationId || actor.role === "viewer") return yield* new NotPermitted({})
      if (s.last._tag === "Nothing" ? cmd.saw._tag !== "Nothing" : cmd.saw._tag !== "Step" || cmd.saw.step !== s.last.step) {
        return yield* new ReviewMovedOn({ last: s.last })
      }
      if (cmd.created + cmd.notImported !== s.rows) return yield* new CountsDoNotAddUp({})
      return [new ImportConfirmed({ created: cmd.created, notImported: cmd.notImported })]
    }),
    TakeBackImport: Effect.fn(function* (s, cmd) {
      const actor = yield* CurrentActor
      if (s._tag !== "Imported") return yield* new NotImported({})
      if (actor.organizationId !== s.organizationId || actor.role === "viewer") return yield* new NotPermitted({})
      if (cmd.kept > s.created) return yield* new MoreKeptThanCreated({})
      return [new ImportTakenBack({ removed: s.created - cmd.kept, kept: cmd.kept })]
    }),
    ReopenImport: Effect.fn(function* (s) {
      const actor = yield* CurrentActor
      if (s._tag !== "Imported" && s._tag !== "TakenBack") return yield* new NotClosed({})
      if (actor.organizationId !== s.organizationId || actor.role === "viewer") return yield* new NotPermitted({})
      return [new ImportReopened({})]
    }),
    RemoveImport: Effect.fn(function* (s) {
      const actor = yield* CurrentActor
      if (s._tag !== "Open") return yield* new NotOpen({})
      if (actor.organizationId !== s.organizationId || actor.role === "viewer") return yield* new NotPermitted({})
      if (s.confirms !== 0) return yield* new HasBeenConfirmed({})
      return [new ImportRemoved({})]
    }),
  },
  evolve: {
    ImportStaged: (_, e) => ({
      _tag: "Open" as const,
      organizationId: e.organizationId,
      rows: e.rows,
      confirms: 0,
      matching: noMatching,
      last: { _tag: "Nothing" as const },
      suggestions: 0,
    }),
    ColumnMatched: (s, e) =>
      s._tag === "Open"
        ? { ...s, matching: matchedAgain(s.matching, e.field), last: { _tag: "Step" as const, step: e.step } }
        : s,
    ActCounted: (s, e) => (s._tag === "Open" ? { ...s, last: { _tag: "Step" as const, step: e.step } } : s),
    SuggestionRecorded: (s) => (s._tag === "Open" ? { ...s, suggestions: s.suggestions + 1 } : s),
    ImportConfirmed: (s, e) =>
      s._tag === "Open"
        ? {
            _tag: "Imported" as const,
            organizationId: s.organizationId,
            rows: s.rows,
            confirms: s.confirms + 1,
            matching: s.matching,
            last: s.last,
            created: e.created,
            notImported: e.notImported,
          }
        : s,
    ImportTakenBack: (s, e) =>
      s._tag === "Imported"
        ? {
            _tag: "TakenBack" as const,
            organizationId: s.organizationId,
            rows: s.rows,
            confirms: s.confirms,
            matching: s.matching,
            last: s.last,
            removed: e.removed,
            kept: e.kept,
            notImported: s.notImported,
          }
        : s,
    ImportReopened: (s) =>
      s._tag === "Imported" || s._tag === "TakenBack"
        ? {
            _tag: "Open" as const,
            organizationId: s.organizationId,
            rows: s.rows,
            confirms: s.confirms,
            matching: s.matching,
            last: s.last,
            suggestions: 0,
          }
        : s,
    ImportRemoved: (s) =>
      s._tag === "Open" ? { _tag: "Removed" as const, organizationId: s.organizationId } : s,
  },
}) {}
```

`Verify.aggregate(ImportLife)`, 4.5 s. All sixteen rules are proved for its seven commands; the run is reported as
not verified for one reason, which the model run of trial 5 removes:

```text
NotVerified

ImportLife: 16 rules, 7 commands

Proved: for every state and every input, after any number of commands
  ✓ OutcomesAddUpToTheRows
  ✓ NoCountIsNegative
  ✓ NothingIsWrittenBeforeConfirm
  ✓ AConfirmOfAClosedImportWritesNothing
  ✓ AConfirmIsOfWhatItsSenderSaw
  ✓ OnlyAnImportedFileIsTakenBack
  ✓ ATakeBackKeepsWhatWasChanged
  ✓ ASuggestionWritesNothing
  ✓ AMatchRaisesOnlyItsOwnField
  ✓ OnlyAnOpenImportIsReviewed
  ✓ AnImportIsOpenedAgainOnlyByReopen
  ✓ ARemovedImportStaysRemoved
  ✓ OnlyANeverConfirmedImportIsRemoved
  ✓ AnImportNeverChangesOrganization
  ✓ OnlyItsOwnOrganizationChangesAnImport
  ✓ AViewerChangesNothing

Not done
  ✗ ImportLife folds ActCounted, which a decision records: no sequence here has that step, so explore the model that hosts both

ImportLife: 2 invariants, 14 transitions, 7 commands
```

How the rules are worded so that a match and a reopen are in them:

- **A match changes no row's decision.** It raises its own field's matching by one (`AMatchRaisesOnlyItsOwnField`).
  An accept records the matching it was made on, so an accept made before the match is out of force by its number,
  and nothing was cleared. The first rule, "no command clears a decision its sender did not make", holds with the
  match in the model, without an exception. Today the app takes those accepts back by rewriting other people's
  decisions; the person sees the same thing either way, an open proposal and a line saying which accepts were taken
  back.
- **An accept names the matching it saw** and is refused on an older one (`MatchedSince`, with the matching now).
  This is the decision's rule in trial 5, because the row cannot see its import.
- **"Nothing changes after the confirm" became two rules**, since an import can be opened again:
  `OnlyAnOpenImportIsReviewed` and `AnImportIsOpenedAgainOnlyByReopen`.
- **A confirm names the last change its sender saw** (`AConfirmIsOfWhatItsSenderSaw`), by its step. A match is a
  change too, so a confirm pressed on a screen that has not shown a match is refused.
- **Remove** is taken only for an import that was never confirmed. Whether an import with items in force may be
  removed is a fact only the database holds today; this aggregate carries a count of confirms and no more.

## Trial 5. The shapes

### The lifecycle, one instance per row, and every act a decision across both

The row decides nothing alone. `Deciding` and `Undoing` read the import and the row and record on both or on
neither.

```typescript
// One row of one import's review as its own instance, in the shape where every act is a decision across the import
// and the row. The row decides nothing alone: `Deciding` and `Undoing` record its events. It holds the decision as
// the text the database holds today, who made it, in which step, and the one decision under it. What a decision
// accepted, and on which matching, is in that text and in the event; no rule of the row reads it.
import * as Domain from "@alchemy.run/domain"
import * as Effect from "effect/Effect"
import * as S from "effect/Schema"
import { CurrentActor } from "./Actor.context.ts"
import { Accept } from "./Seen.value.ts"

export class RowDecided extends Domain.Event("RowDecided", {
  importId: S.String,
  organizationId: S.String,
  by: S.String,
  step: S.String,
  flags: S.String,
  accept: Accept,
}) {}
export class StepUndone extends Domain.Event("StepUndone", {}) {}

const Under = S.Union([
  S.TaggedStruct("Nothing", {}),
  S.TaggedStruct("Was", { by: S.String, step: S.String, flags: S.String }),
])

export const RowState = S.Union([
  S.TaggedStruct("Untouched", {}),
  S.TaggedStruct("Undecided", { importId: S.String, organizationId: S.String }),
  S.TaggedStruct("Decided", {
    importId: S.String,
    organizationId: S.String,
    by: S.String,
    step: S.String,
    flags: S.String,
    under: Under,
  }),
])

export class RowUnit extends Domain.Aggregate("RowUnit", {
  id: S.String,
  state: RowState,
  initial: { _tag: "Untouched" },
  transitions: {
    // No command clears a decision its sender did not make.
    NobodyClearsAnotherPersonsDecision: Effect.fn(function* ({ before, after }) {
      if (before._tag !== "Decided" || after._tag === "Decided") return true
      return (yield* CurrentActor).memberId === before.by
    }),
    // A row has no decision again only when nothing was under the one taken back.
    ARowIsUndecidedOnlyWhenNothingWasUnder: ({ before, after }) =>
      before._tag !== "Decided" || after._tag !== "Undecided" || before.under._tag === "Nothing",
    ARowNeverChangesImportOrOrganization: ({ before, after }) =>
      before._tag === "Untouched" ||
      after._tag === "Untouched" ||
      (before.organizationId === after.organizationId && before.importId === after.importId),
    OnlyItsOwnOrganizationChangesARow: Effect.fn(function* ({ before }) {
      if (before._tag === "Untouched") return true
      return (yield* CurrentActor).organizationId === before.organizationId
    }),
    AViewerChangesNothing: Effect.fn(function* () {
      return (yield* CurrentActor).role !== "viewer"
    }),
  },
  events: [RowDecided, StepUndone],
  evolve: {
    RowDecided: (s, e) => ({
      _tag: "Decided" as const,
      importId: e.importId,
      organizationId: e.organizationId,
      by: e.by,
      step: e.step,
      flags: e.flags,
      under:
        s._tag === "Decided"
          ? { _tag: "Was" as const, by: s.by, step: s.step, flags: s.flags }
          : { _tag: "Nothing" as const },
    }),
    StepUndone: (s) =>
      s._tag !== "Decided"
        ? s
        : s.under._tag === "Was"
          ? {
              _tag: "Decided" as const,
              importId: s.importId,
              organizationId: s.organizationId,
              by: s.under.by,
              step: s.under.step,
              flags: s.under.flags,
              under: { _tag: "Nothing" as const },
            }
          : { _tag: "Undecided" as const, importId: s.importId, organizationId: s.organizationId },
  },
}) {}
```

```typescript
// One act of the review, decided across the import and the row it names, and recorded on both or on neither.
// The import says whether it is open and what each field's matching is; the row says what decision it holds.
import * as Domain from "@alchemy.run/domain"
import * as Effect from "effect/Effect"
import * as S from "effect/Schema"
import { CurrentActor, Session } from "./Actor.context.ts"
import { ActCounted, ImportId, ImportLife, NotOpen, NotPermitted } from "./ImportLife.aggregate.ts"
import { RowDecided, RowUnit, StepUndone } from "./RowUnit.aggregate.ts"
import { Accept, Saw, matchingOf } from "./Seen.value.ts"

// The row holds a decision its sender did not see: whose it is and its step, so the screen can say so.
export class DecidedSince extends Domain.Rejection("DecidedSince", { by: S.String, step: S.String }) {}
// The decision its sender saw is no longer there, and the row has none.
export class NoLongerThere extends Domain.Rejection("NoLongerThere", {}) {}
export class StepAlreadyUsed extends Domain.Rejection("StepAlreadyUsed", {}) {}
// The field's column was matched again after the proposal its sender accepted: the field's matching now.
export class MatchedSince extends Domain.Rejection("MatchedSince", { matching: S.Int }) {}
export class NotYourStep extends Domain.Rejection("NotYourStep", {}) {}

export class DecideRow extends Domain.Command("DecideRow", {
  middleware: [Session],
  input: { importId: ImportId, row: S.String, step: S.String, saw: Saw, flags: S.String, accept: Accept },
  events: [RowDecided, ActCounted],
  rejects: [NotOpen, NotPermitted, DecidedSince, NoLongerThere, StepAlreadyUsed, MatchedSince],
}) {}

export class UndoRowStep extends Domain.Command("UndoRowStep", {
  middleware: [Session],
  // `undo` is the step taken back; `step` is this act's own.
  input: { importId: ImportId, row: S.String, undo: S.String, step: S.String },
  events: [StepUndone, ActCounted],
  rejects: [NotOpen, NotPermitted, NotYourStep],
}) {}

export class Deciding extends Domain.Decision(DecideRow, {
  reads: { life: ImportLife, row: RowUnit },
  keyOf: (cmd) => ({ life: cmd.importId, row: `${cmd.importId}/${cmd.row}` }),
  decide: Effect.fn(function* ({ life, row }, cmd) {
    const actor = yield* CurrentActor
    if (life.state._tag !== "Open") return yield* new NotOpen({})
    if (actor.organizationId !== life.state.organizationId || actor.role === "viewer") {
      return yield* new NotPermitted({})
    }
    // A row instance belongs to one import of one organization, for good.
    if (
      row.state._tag !== "Untouched" &&
      (row.state.importId !== cmd.importId || row.state.organizationId !== life.state.organizationId)
    ) {
      return yield* new NotPermitted({})
    }
    if (row.state._tag === "Decided") {
      if (cmd.saw._tag !== "Step" || cmd.saw.step !== row.state.step) {
        return yield* new DecidedSince({ by: row.state.by, step: row.state.step })
      }
      if (cmd.step === row.state.step) return yield* new StepAlreadyUsed({})
    } else if (cmd.saw._tag !== "Nothing") {
      return yield* new NoLongerThere({})
    }
    if (cmd.accept._tag === "Fix" && cmd.accept.matching !== matchingOf(life.state.matching, cmd.accept.field)) {
      return yield* new MatchedSince({ matching: matchingOf(life.state.matching, cmd.accept.field) })
    }
    return [
      row.record(
        new RowDecided({
          importId: cmd.importId,
          organizationId: life.state.organizationId,
          by: actor.memberId,
          step: cmd.step,
          flags: cmd.flags,
          accept: cmd.accept,
        }),
      ),
      life.record(new ActCounted({ step: cmd.step })),
    ]
  }),
  transitions: {
    // A row is decided only on an open import.
    ARowIsDecidedOnlyOnAnOpenImport: ({ before }) => before.life._tag === "Open",
    // A decision is replaced only by an act whose sender saw it.
    ADecisionIsReplacedOnlyByAnActThatSawIt: ({ before, command }) =>
      before.row._tag === "Decided"
        ? command.saw._tag === "Step" && command.saw.step === before.row.step
        : command.saw._tag === "Nothing",
    // An accept is made on the matching its sender saw, and is not applied on an older one.
    AnAcceptIsMadeOnTheMatchingItsSenderSaw: ({ before, command }) =>
      command.accept._tag !== "Fix" ||
      (before.life._tag === "Open" && command.accept.matching === matchingOf(before.life.matching, command.accept.field)),
    // What is recorded is what its sender said, and the import counts the act as its last change.
    TheActIsRecordedAndCounted: ({ after, command }) =>
      after.row._tag === "Decided" &&
      after.row.step === command.step &&
      after.row.flags === command.flags &&
      after.life._tag === "Open" &&
      after.life.last._tag === "Step" &&
      after.life.last.step === command.step,
  },
}) {}

export class Undoing extends Domain.Decision(UndoRowStep, {
  reads: { life: ImportLife, row: RowUnit },
  keyOf: (cmd) => ({ life: cmd.importId, row: `${cmd.importId}/${cmd.row}` }),
  decide: Effect.fn(function* ({ life, row }, cmd) {
    const actor = yield* CurrentActor
    if (life.state._tag !== "Open") return yield* new NotOpen({})
    if (actor.organizationId !== life.state.organizationId || actor.role === "viewer") {
      return yield* new NotPermitted({})
    }
    if (
      row.state._tag !== "Untouched" &&
      (row.state.importId !== cmd.importId || row.state.organizationId !== life.state.organizationId)
    ) {
      return yield* new NotPermitted({})
    }
    if (row.state._tag !== "Decided" || row.state.by !== actor.memberId || row.state.step !== cmd.undo) {
      return yield* new NotYourStep({})
    }
    return [row.record(new StepUndone({})), life.record(new ActCounted({ step: cmd.step }))]
  }),
  transitions: {
    // An undo is taken only on an open import, for its sender's own step, while that step is the row's decision.
    AnUndoTakesBackOnlyItsSendersOwnStep: Effect.fn(function* ({ before, command }) {
      if (before.life._tag !== "Open" || before.row._tag !== "Decided") return false
      return before.row.step === command.undo && (yield* CurrentActor).memberId === before.row.by
    }),
    // An undo puts back what the step replaced, another person's decision included.
    AnUndoPutsBackWhatWasThere: ({ before, after }) =>
      before.row._tag !== "Decided" ||
      (before.row.under._tag === "Nothing"
        ? after.row._tag === "Undecided"
        : after.row._tag === "Decided" &&
          after.row.by === before.row.under.by &&
          after.row.step === before.row.under.step &&
          after.row.flags === before.row.under.flags),
  },
}) {}
```

```typescript
// The review of one import as a model: the import's lifecycle, its rows, and the two decisions across them.
import * as Domain from "@alchemy.run/domain"
import { ImportLife } from "./ImportLife.aggregate.ts"
import { Deciding, Undoing } from "./Review.decision.ts"
import { RowUnit } from "./RowUnit.aggregate.ts"

export class Review extends Domain.Model("Review", {
  aggregates: [ImportLife, RowUnit],
  decisions: [Deciding, Undoing],
  relations: {
    // A row that was decided belongs to the organization of its import.
    ARowBelongsToItsImportsOrganization: Domain.Relation({
      over: { life: ImportLife, row: RowUnit },
      holds: ({ life, row }) =>
        row.state._tag === "Untouched" ||
        row.state.importId !== life.id ||
        (life.state._tag !== "Unstaged" && row.state.organizationId === life.state.organizationId),
    }),
  },
}) {}

export class ReviewApi extends Domain.Api("ReviewApi", { model: Review }) {}
```

The test prints each rule's standing, then Verify's report:

```typescript
import { Story } from "@alchemy.run/domain/Story"
import * as Verify from "@alchemy.run/domain/Verify"
import * as NodeServices from "@effect/platform-node/NodeServices"
import { it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { writeFileSync } from "node:fs"
import { Review, ReviewApi } from "./Review.model.ts"

it.effect(
  "verify: the review as a model",
  () =>
    Effect.gen(function* () {
      const report = yield* Verify.model(Review, { apis: [ReviewApi], story: Story.make(Review) }).pipe(
        Effect.catch((error) => Effect.succeed({ failed: error })),
      )
      yield* Effect.sync(() =>
        writeFileSync(
          "out/ReviewModel.txt",
          "failed" in report
            ? `${report.failed._tag}\n${report.failed.message}`
            : `VERIFIED\n${report.rules.map((rule) => `${rule.standing}  ${rule.name}`).join("\n")}\n\n${Verify.render(report)}`,
        ),
      )
    }).pipe(Effect.provide(NodeServices.layer)),
  1_500_000,
)
```

`Verify.model(Review)`, 109 s:

```text
VERIFIED
proved  ImportLife.OutcomesAddUpToTheRows
proved  ImportLife.NoCountIsNegative
proved  ImportLife.NothingIsWrittenBeforeConfirm
proved  ImportLife.AConfirmOfAClosedImportWritesNothing
proved  ImportLife.AConfirmIsOfWhatItsSenderSaw
proved  ImportLife.OnlyAnImportedFileIsTakenBack
proved  ImportLife.ATakeBackKeepsWhatWasChanged
proved  ImportLife.ASuggestionWritesNothing
proved  ImportLife.AMatchRaisesOnlyItsOwnField
proved  ImportLife.OnlyAnOpenImportIsReviewed
proved  ImportLife.AnImportIsOpenedAgainOnlyByReopen
proved  ImportLife.ARemovedImportStaysRemoved
proved  ImportLife.OnlyANeverConfirmedImportIsRemoved
proved  ImportLife.AnImportNeverChangesOrganization
proved  ImportLife.OnlyItsOwnOrganizationChangesAnImport
proved  ImportLife.AViewerChangesNothing
proved  RowUnit.NobodyClearsAnotherPersonsDecision
proved  RowUnit.ARowIsUndecidedOnlyWhenNothingWasUnder
proved  RowUnit.ARowNeverChangesImportOrOrganization
proved  RowUnit.OnlyItsOwnOrganizationChangesARow
proved  RowUnit.AViewerChangesNothing
proved  DecideRow.ARowIsDecidedOnlyOnAnOpenImport
proved  DecideRow.ADecisionIsReplacedOnlyByAnActThatSawIt
proved  DecideRow.AnAcceptIsMadeOnTheMatchingItsSenderSaw
proved  DecideRow.TheActIsRecordedAndCounted
proved  UndoRowStep.AnUndoTakesBackOnlyItsSendersOwnStep
proved  UndoRowStep.AnUndoPutsBackWhatWasThere
checked  Review.ARowBelongsToItsImportsOrganization

Review: 38 outcomes, 2 decisions

Proved: for every state and every input, after any number of commands
  ✓ ImportLife.OutcomesAddUpToTheRows
  ✓ ImportLife.NoCountIsNegative
  ✓ ImportLife.NothingIsWrittenBeforeConfirm
  ✓ ImportLife.AConfirmOfAClosedImportWritesNothing
  ✓ ImportLife.AConfirmIsOfWhatItsSenderSaw
  ✓ ImportLife.OnlyAnImportedFileIsTakenBack
  ✓ ImportLife.ATakeBackKeepsWhatWasChanged
  ✓ ImportLife.ASuggestionWritesNothing
  ✓ ImportLife.AMatchRaisesOnlyItsOwnField
  ✓ ImportLife.OnlyAnOpenImportIsReviewed
  ✓ ImportLife.AnImportIsOpenedAgainOnlyByReopen
  ✓ ImportLife.ARemovedImportStaysRemoved
  ✓ ImportLife.OnlyANeverConfirmedImportIsRemoved
  ✓ ImportLife.AnImportNeverChangesOrganization
  ✓ ImportLife.OnlyItsOwnOrganizationChangesAnImport
  ✓ ImportLife.AViewerChangesNothing
  ✓ RowUnit.NobodyClearsAnotherPersonsDecision
  ✓ RowUnit.ARowIsUndecidedOnlyWhenNothingWasUnder
  ✓ RowUnit.ARowNeverChangesImportOrOrganization
  ✓ RowUnit.OnlyItsOwnOrganizationChangesARow
  ✓ RowUnit.AViewerChangesNothing
  ✓ DecideRow.ARowIsDecidedOnlyOnAnOpenImport
  ✓ DecideRow.ADecisionIsReplacedOnlyByAnActThatSawIt
  ✓ DecideRow.AnAcceptIsMadeOnTheMatchingItsSenderSaw
  ✓ DecideRow.TheActIsRecordedAndCounted
  ✓ UndoRowStep.AnUndoTakesBackOnlyItsSendersOwnStep
  ✓ UndoRowStep.AnUndoPutsBackWhatWasThere

Checked: in every sequence of up to 2 commands through ReviewApi, with each event delivered twice, each reaction also run behind the others that wait
9,393 sequences, 1,000 states
  ✓ Review.ARowBelongsToItsImportsOrganization
      not proved for DecideRow: DecideRow has more than 4096 paths

Sampled: 200 longer sequences, of up to 9 commands picked at random (seed 1)
  ✓ none breaks a rule

Run on the real model: 33 sequences the explorer found and 164 walks of commands picked at random, as stories
  ✓ the model does what the explorer read in each

Assumed
  - whole numbers are exact: a number stays within ±2^53, and a bigint has no limit
  - a list an input holds has up to 2 items more than its schema asks for
  - an external system answers what its schema allows, and nothing else
  - middleware lets every caller in: who sends a command is anyone its request context allows
  - what a projection writes, and what a stream or a query gives, is not checked: only what a projection is given
  - a decision's events commit on every instance it recorded on, or on none: how a platform commits them is not checked
```

Two earlier runs of this model, kept because they shaped it:

- **With a second relation, nothing was proved.** The first run also stated, as a relation, that an accept a row
  holds never names a matching its import has not reached, and kept the accept in the row's state. Verify reported
  every rule as checked only: "not proved for ImportLife.MatchColumn: ImportLife.MatchColumn has more than 4096
  paths". A relation is read on the same path as every other rule, for every command of both aggregates, so one
  wide relation un-proved the sixteen lifecycle rules that the aggregate alone had proved. The accept left the row's
  state, the relation left the model, and the decision's own rule holds the matching.
- **Without a guard, two of the row's rules were only checked.** The second run proved 25 rules.
  `ARowNeverChangesImportOrOrganization` and `OnlyItsOwnOrganizationChangesARow` were checked, because nothing in
  `decide` tied a row that already exists to the import the command names. The guard at the top of both decisions
  proved them.

What is left checked, and not proved, is the relation `ARowBelongsToItsImportsOrganization`: "not proved for
DecideRow: DecideRow has more than 4096 paths".

### The orderings, as stories on the real model

```typescript
// The orderings that matter most, as stories on the real model: a person's own second act on a
// row, an act on a row someone else decided first, a confirm that is behind, an accept on an older matching, a match
// beside another person's accept, and an import opened again.
import { Story } from "@alchemy.run/domain/Story"
import { it } from "@effect/vitest"
import { CurrentActor } from "./Actor.context.ts"
import {
  ActCounted,
  ColumnMatched,
  ConfirmImport,
  ImportConfirmed,
  ImportId,
  ImportLife,
  ImportReopened,
  ImportStaged,
  MatchColumn,
  NotOpen,
  ReopenImport,
  ReviewMovedOn,
} from "./ImportLife.aggregate.ts"
import { DecideRow, DecidedSince, MatchedSince } from "./Review.decision.ts"
import { Review } from "./Review.model.ts"
import { RowDecided, RowUnit } from "./RowUnit.aggregate.ts"

const story = Story.make(Review)
const id = ImportId.make("imp_1")
const life = ImportLife.ref(id)
const row12 = RowUnit.ref("imp_1/row-12")
const row13 = RowUnit.ref("imp_1/row-13")
const row24 = RowUnit.ref("imp_1/row-24")

const ana = { organizationId: "org_prairie", memberId: "ana", role: "editor" as const }
const dana = { organizationId: "org_prairie", memberId: "dana", role: "editor" as const }
const staged = new ImportStaged({ organizationId: "org_prairie", rows: 200 })
const nothing = { _tag: "Nothing" as const }
const step = (name: string) => ({ _tag: "Step" as const, step: name })
const leftOut = '{"out":true}'
const kept = '{"kept":true}'

const decided = (input: { by: string; step: string; flags: string }) =>
  new RowDecided({ importId: id, organizationId: "org_prairie", accept: nothing, ...input })

it.effect("a person's second act on a row names their own first, and both are recorded", () =>
  story(
    Story.given(life, staged),
    Story.provide(CurrentActor, ana),
    Story.when(new DecideRow({ importId: id, row: "row-12", step: "a1", saw: nothing, flags: leftOut, accept: nothing })),
    Story.then(row12, decided({ by: "ana", step: "a1", flags: leftOut })),
    Story.then(life, new ActCounted({ step: "a1" })),
    Story.when(new DecideRow({ importId: id, row: "row-12", step: "a2", saw: step("a1"), flags: kept, accept: nothing })),
    Story.then(row12, decided({ by: "ana", step: "a2", flags: kept })),
    Story.then(life, new ActCounted({ step: "a2" })),
  ),
)

it.effect("when someone else decided the row first, neither of the person's two acts goes over it", () =>
  story(
    Story.given(life, staged),
    Story.given(row12, decided({ by: "dana", step: "d1", flags: kept })),
    Story.provide(CurrentActor, ana),
    // The first act was made on a row the screen showed as undecided.
    Story.when(new DecideRow({ importId: id, row: "row-12", step: "a1", saw: nothing, flags: leftOut, accept: nothing })),
    Story.rejected(new DecidedSince({ by: "dana", step: "d1" })),
    // The second was queued behind it, naming the first as what it saw.
    Story.when(new DecideRow({ importId: id, row: "row-12", step: "a2", saw: step("a1"), flags: kept, accept: nothing })),
    Story.rejected(new DecidedSince({ by: "dana", step: "d1" })),
  ),
)

it.effect("a confirm that names an older change is refused, and one that names the last is taken", () =>
  story(
    Story.given(life, staged, new ActCounted({ step: "a1" }), new ActCounted({ step: "d1" })),
    Story.provide(CurrentActor, ana),
    Story.when(new ConfirmImport({ importId: id, saw: step("a1"), created: 155, notImported: 45 })),
    Story.rejected(new ReviewMovedOn({ last: step("d1") })),
    Story.when(new ConfirmImport({ importId: id, saw: step("d1"), created: 155, notImported: 45 })),
    Story.then(life, new ImportConfirmed({ created: 155, notImported: 45 })),
  ),
)

it.effect("an accept made before its field's column was matched again is not applied", () =>
  story(
    Story.given(life, staged),
    Story.provide(CurrentActor, ana),
    Story.when(new MatchColumn({ importId: id, field: "uom", step: "m1" })),
    Story.then(life, new ColumnMatched({ field: "uom", step: "m1" })),
    Story.when(
      new DecideRow({
        importId: id,
        row: "row-24",
        step: "a1",
        saw: nothing,
        flags: '{"accepted":["uom"]}',
        accept: { _tag: "Fix", field: "uom", matching: 0 },
      }),
    ),
    Story.rejected(new MatchedSince({ matching: 1 })),
    Story.when(
      new DecideRow({
        importId: id,
        row: "row-24",
        step: "a2",
        saw: nothing,
        flags: '{"accepted":["uom"]}',
        accept: { _tag: "Fix", field: "uom", matching: 1 },
      }),
    ),
    Story.then(
      row24,
      new RowDecided({
        importId: id,
        organizationId: "org_prairie",
        by: "ana",
        step: "a2",
        flags: '{"accepted":["uom"]}',
        accept: { _tag: "Fix", field: "uom", matching: 1 },
      }),
    ),
    Story.then(life, new ActCounted({ step: "a2" })),
  ),
)

it.effect("a match records nothing on a row another person decided", () =>
  story(
    Story.given(life, staged),
    Story.given(
      row24,
      new RowDecided({
        importId: id,
        organizationId: "org_prairie",
        by: "dana",
        step: "d1",
        flags: '{"accepted":["uom"]}',
        accept: { _tag: "Fix", field: "uom", matching: 0 },
      }),
    ),
    Story.provide(CurrentActor, ana),
    Story.when(new MatchColumn({ importId: id, field: "uom", step: "m1" })),
    Story.then(life, new ColumnMatched({ field: "uom", step: "m1" })),
    Story.then(row24),
  ),
)

it.effect("nothing is decided on a confirmed import until it is opened again", () =>
  story(
    Story.given(life, staged, new ImportConfirmed({ created: 155, notImported: 45 })),
    Story.provide(CurrentActor, ana),
    Story.when(new DecideRow({ importId: id, row: "row-13", step: "a1", saw: nothing, flags: leftOut, accept: nothing })),
    Story.rejected(new NotOpen({})),
    Story.when(new ReopenImport({ importId: id })),
    Story.then(life, new ImportReopened({})),
    Story.when(new DecideRow({ importId: id, row: "row-13", step: "a2", saw: nothing, flags: leftOut, accept: nothing })),
    Story.then(row13, decided({ by: "ana", step: "a2", flags: leftOut })),
    Story.then(life, new ActCounted({ step: "a2" })),
  ),
)
```

```text
 ✓ review4/Review.story.test.ts > a person's second act on a row names their own first, and both are recorded
 ✓ review4/Review.story.test.ts > when someone else decided the row first, neither of the person's two acts goes over it
 ✓ review4/Review.story.test.ts > a confirm that names an older change is refused, and one that names the last is taken
 ✓ review4/Review.story.test.ts > an accept made before its field's column was matched again is not applied
 ✓ review4/Review.story.test.ts > a match records nothing on a row another person decided
 ✓ review4/Review.story.test.ts > nothing is decided on a confirmed import until it is opened again
 Test Files  1 passed (1)
      Tests  6 passed (6)
```

A confirm in this shape carries no acts. The screen sends the acts it holds first, each as its own decision, and then
the confirm, naming the step of its own last act. If any act was refused, or someone else's change landed between,
the import's last change is not the one named and the confirm is refused with the last change.

### One instance per import, again

`DraftSeen` puts everything above into one instance with the rows as a list: an act names what it saw on each row,
a match, an accept that names its matching, a confirm that names the last change and carries its sender's unsent
acts, and a reopen.

```typescript
// One import's review as ONE instance again, now with everything the lifecycle model holds: an act names the
// decision it saw on each row, a match raises its field's matching and changes no row, an accept names the matching
// it saw, a confirm names the last change it saw and may carry its sender's acts that are not sent yet, and a
// confirmed import can be opened again. The rows are a list in the state, written with effect/Array.
import * as Domain from "@alchemy.run/domain"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as S from "effect/Schema"
import { CurrentActor, Session } from "./Actor.context.ts"
import { Accept, Field, Matching, Saw, matchedAgain, matchingOf, noMatching } from "./Seen.value.ts"

export const DraftId = S.String.pipe(S.brand("DraftId"))

const Held = S.Struct({ row: S.String, by: S.String, step: S.String, flags: S.String, accept: Accept })
// One row of an act: the row, and the decision its sender saw on it.
const Named = S.Struct({ row: S.String, saw: Saw })
// One act its sender has not sent yet, carried by a confirm: one row, as the act would have named it.
const Unsent = S.Struct({ row: S.String, saw: Saw, step: S.String, flags: S.String })

export class DraftOpened extends Domain.Event("DraftOpened", { organizationId: S.String }) {}
export class RowsDecided extends Domain.Event("RowsDecided", {
  by: S.String,
  step: S.String,
  flags: S.String,
  accept: Accept,
  rows: S.Array(S.String),
}) {}
export class StepUndone extends Domain.Event("StepUndone", { by: S.String, undo: S.String, step: S.String }) {}
export class ColumnMatched extends Domain.Event("ColumnMatched", { field: Field, step: S.String }) {}
export class DraftConfirmed extends Domain.Event("DraftConfirmed", {}) {}
export class DraftReopened extends Domain.Event("DraftReopened", {}) {}

export class DraftNotPermitted extends Domain.Rejection("DraftNotPermitted", {}) {}
export class DraftNotOpen extends Domain.Rejection("DraftNotOpen", {}) {}
export class DraftAlreadyOpen extends Domain.Rejection("DraftAlreadyOpen", {}) {}
export class DraftNotClosed extends Domain.Rejection("DraftNotClosed", {}) {}
// Every row the act named holds a decision its sender did not see.
export class AllDecidedSince extends Domain.Rejection("AllDecidedSince", {}) {}
export class MatchedSince extends Domain.Rejection("MatchedSince", { matching: S.Int }) {}
export class ReviewMovedOn extends Domain.Rejection("ReviewMovedOn", { last: Saw }) {}

export class OpenDraft extends Domain.Command("OpenDraft", {
  middleware: [Session],
  input: { draftId: DraftId },
  events: [DraftOpened],
  rejects: [DraftNotPermitted, DraftAlreadyOpen],
}) {}
export class DecideRows extends Domain.Command("DecideRows", {
  middleware: [Session],
  input: { draftId: DraftId, step: S.String, flags: S.String, accept: Accept, rows: S.Array(Named) },
  events: [RowsDecided],
  rejects: [DraftNotPermitted, DraftNotOpen, AllDecidedSince, MatchedSince],
}) {}
export class UndoStep extends Domain.Command("UndoStep", {
  middleware: [Session],
  input: { draftId: DraftId, undo: S.String, step: S.String },
  events: [StepUndone],
  rejects: [DraftNotPermitted, DraftNotOpen],
}) {}
export class MatchColumn extends Domain.Command("MatchColumn", {
  middleware: [Session],
  input: { draftId: DraftId, field: Field, step: S.String },
  events: [ColumnMatched],
  rejects: [DraftNotPermitted, DraftNotOpen],
}) {}
export class ConfirmDraft extends Domain.Command("ConfirmDraft", {
  middleware: [Session],
  input: { draftId: DraftId, saw: Saw, unsent: S.Array(Unsent) },
  events: [RowsDecided, DraftConfirmed],
  rejects: [DraftNotPermitted, DraftNotOpen, ReviewMovedOn],
}) {}
export class ReopenDraft extends Domain.Command("ReopenDraft", {
  middleware: [Session],
  input: { draftId: DraftId },
  events: [DraftReopened],
  rejects: [DraftNotPermitted, DraftNotClosed],
}) {}

export const DraftState = S.Union([
  S.TaggedStruct("Unopened", {}),
  S.TaggedStruct("Open", { organizationId: S.String, matching: Matching, last: Saw, cells: S.Array(Held) }),
  S.TaggedStruct("Confirmed", { organizationId: S.String, matching: Matching, last: Saw, cells: S.Array(Held) }),
])

/** True when the act's sender saw the decision the row holds: the same step, or none where it holds none. */
const sawWhatIsHeld = (cells: ReadonlyArray<typeof Held.Type>, row: string, saw: Saw): boolean =>
  saw._tag === "Step"
    ? A.some(cells, (held) => held.row === row && held.step === saw.step)
    : !A.some(cells, (held) => held.row === row)

/** True when the last change named is the draft's last change. */
const sameLast = (last: Saw, saw: Saw): boolean =>
  last._tag === "Nothing" ? saw._tag === "Nothing" : saw._tag === "Step" && saw.step === last.step

export class DraftSeen extends Domain.Aggregate("DraftSeen", {
  id: DraftId,
  state: DraftState,
  initial: { _tag: "Unopened" },
  transitions: {
    // A decision is replaced only by an act whose sender saw it: a row that held one and now holds another was named
    // by the command with that decision's step.
    ADecisionIsReplacedOnlyByAnActThatSawIt: ({ before, after, command }) =>
      before._tag === "Unopened" ||
      after._tag === "Unopened" ||
      command._tag === "UndoStep" ||
      A.every(
        before.cells,
        (was) =>
          A.some(after.cells, (now) => now.row === was.row && now.step === was.step) ||
          (command._tag === "DecideRows" &&
            A.some(command.rows, (one) => one.row === was.row && one.saw._tag === "Step" && one.saw.step === was.step)) ||
          (command._tag === "ConfirmDraft" &&
            A.some(command.unsent, (one) => one.row === was.row && one.saw._tag === "Step" && one.saw.step === was.step)),
      ),
    // No command clears a decision its sender did not make.
    NobodyClearsAnotherPersonsDecision: Effect.fn(function* ({ before, after }) {
      if (before._tag === "Unopened" || after._tag === "Unopened") return true
      const actor = yield* CurrentActor
      return A.every(
        before.cells,
        (was) => was.by === actor.memberId || A.some(after.cells, (now) => now.row === was.row),
      )
    }),
    // A match changes no row's decision: it raises its field's matching, and an accept made on an older one is out
    // of force by its number.
    AMatchChangesNoDecision: ({ before, after, command }) =>
      command._tag !== "MatchColumn" ||
      before._tag !== "Open" ||
      (after._tag === "Open" &&
        after.cells.length === before.cells.length &&
        A.every(before.cells, (was) =>
          A.some(after.cells, (now) => now.row === was.row && now.step === was.step && now.flags === was.flags),
        )),
    // An accept is made on the matching its sender saw.
    AnAcceptIsMadeOnTheMatchingItsSenderSaw: ({ before, command }) =>
      command._tag !== "DecideRows" ||
      command.accept._tag !== "Fix" ||
      (before._tag === "Open" && command.accept.matching === matchingOf(before.matching, command.accept.field)),
    // Nothing is confirmed that its sender had not seen: the confirm names the draft's last change.
    AConfirmIsOfWhatItsSenderSaw: ({ before, command }) =>
      command._tag !== "ConfirmDraft" || before._tag !== "Open" || sameLast(before.last, command.saw),
    // While a draft is confirmed, no row's decision changes; it is reviewed again only after it is opened again.
    AConfirmedDraftKeepsItsDecisions: ({ before, after }) =>
      before._tag !== "Confirmed" ||
      after._tag === "Unopened" ||
      (after.cells.length === before.cells.length &&
        A.every(before.cells, (was) => A.some(after.cells, (now) => now.row === was.row && now.step === was.step))),
    OnlyItsOwnOrganizationChangesADraft: Effect.fn(function* ({ before }) {
      if (before._tag === "Unopened") return true
      return (yield* CurrentActor).organizationId === before.organizationId
    }),
    AViewerChangesNothing: Effect.fn(function* () {
      return (yield* CurrentActor).role !== "viewer"
    }),
  },
  commands: [OpenDraft, DecideRows, UndoStep, MatchColumn, ConfirmDraft, ReopenDraft],
  keyOf: (cmd) => cmd.draftId,
  decide: {
    OpenDraft: Effect.fn(function* (s) {
      const actor = yield* CurrentActor
      if (actor.role === "viewer") return yield* new DraftNotPermitted({})
      if (s._tag !== "Unopened") return yield* new DraftAlreadyOpen({})
      return [new DraftOpened({ organizationId: actor.organizationId })]
    }),
    DecideRows: Effect.fn(function* (s, cmd) {
      const actor = yield* CurrentActor
      if (s._tag !== "Open") return yield* new DraftNotOpen({})
      if (actor.organizationId !== s.organizationId || actor.role === "viewer") return yield* new DraftNotPermitted({})
      if (cmd.accept._tag === "Fix" && cmd.accept.matching !== matchingOf(s.matching, cmd.accept.field)) {
        return yield* new MatchedSince({ matching: matchingOf(s.matching, cmd.accept.field) })
      }
      const rows = A.map(
        A.filter(cmd.rows, (one) => sawWhatIsHeld(s.cells, one.row, one.saw)),
        (one) => one.row,
      )
      if (A.isArrayEmpty(rows)) return yield* new AllDecidedSince({})
      return [new RowsDecided({ by: actor.memberId, step: cmd.step, flags: cmd.flags, accept: cmd.accept, rows })]
    }),
    UndoStep: Effect.fn(function* (s, cmd) {
      const actor = yield* CurrentActor
      if (s._tag !== "Open") return yield* new DraftNotOpen({})
      if (actor.organizationId !== s.organizationId || actor.role === "viewer") return yield* new DraftNotPermitted({})
      return [new StepUndone({ by: actor.memberId, undo: cmd.undo, step: cmd.step })]
    }),
    MatchColumn: Effect.fn(function* (s, cmd) {
      const actor = yield* CurrentActor
      if (s._tag !== "Open") return yield* new DraftNotOpen({})
      if (actor.organizationId !== s.organizationId || actor.role === "viewer") return yield* new DraftNotPermitted({})
      return [new ColumnMatched({ field: cmd.field, step: cmd.step })]
    }),
    ConfirmDraft: Effect.fn(function* (s, cmd) {
      const actor = yield* CurrentActor
      if (s._tag !== "Open") return yield* new DraftNotOpen({})
      if (actor.organizationId !== s.organizationId || actor.role === "viewer") return yield* new DraftNotPermitted({})
      // The confirm names the last change its sender saw; its own acts that are not sent yet come with it, and each
      // must still be on what its sender saw, or nothing is recorded.
      if (!sameLast(s.last, cmd.saw)) return yield* new ReviewMovedOn({ last: s.last })
      if (!A.every(cmd.unsent, (one) => sawWhatIsHeld(s.cells, one.row, one.saw))) {
        return yield* new ReviewMovedOn({ last: s.last })
      }
      return A.append(
        A.map(
          cmd.unsent,
          (one) =>
            new RowsDecided({
              by: actor.memberId,
              step: one.step,
              flags: one.flags,
              accept: { _tag: "Nothing" as const },
              rows: [one.row],
            }),
        ),
        new DraftConfirmed({}),
      )
    }),
    ReopenDraft: Effect.fn(function* (s) {
      const actor = yield* CurrentActor
      if (s._tag !== "Confirmed") return yield* new DraftNotClosed({})
      if (actor.organizationId !== s.organizationId || actor.role === "viewer") return yield* new DraftNotPermitted({})
      return [new DraftReopened({})]
    }),
  },
  evolve: {
    DraftOpened: (_, e) => ({
      _tag: "Open" as const,
      organizationId: e.organizationId,
      matching: noMatching,
      last: { _tag: "Nothing" as const },
      cells: [],
    }),
    RowsDecided: (s, e) =>
      s._tag !== "Open"
        ? s
        : {
            ...s,
            last: { _tag: "Step" as const, step: e.step },
            cells: A.appendAll(
              A.filter(s.cells, (held) => !A.some(e.rows, (row) => row === held.row)),
              A.map(e.rows, (row) => ({ row, by: e.by, step: e.step, flags: e.flags, accept: e.accept })),
            ),
          },
    StepUndone: (s, e) =>
      s._tag !== "Open"
        ? s
        : {
            ...s,
            last: { _tag: "Step" as const, step: e.step },
            cells: A.filter(s.cells, (held) => !(held.by === e.by && held.step === e.undo)),
          },
    ColumnMatched: (s, e) =>
      s._tag !== "Open"
        ? s
        : { ...s, matching: matchedAgain(s.matching, e.field), last: { _tag: "Step" as const, step: e.step } },
    DraftConfirmed: (s) =>
      s._tag !== "Open"
        ? s
        : {
            _tag: "Confirmed" as const,
            organizationId: s.organizationId,
            matching: s.matching,
            last: s.last,
            cells: s.cells,
          },
    DraftReopened: (s) =>
      s._tag !== "Confirmed"
        ? s
        : { _tag: "Open" as const, organizationId: s.organizationId, matching: s.matching, last: s.last, cells: s.cells },
  },
}) {}
```

`Verify.aggregate(DraftSeen)`, 758 s. Its first 24 lines, the proof's standing for one rule (the same for all eight),
and the search:

```text
NotVerified

DraftSeen: 8 rules, 6 commands

Checked: in every sequence of up to 3 commands on a new instance
  ✓ ADecisionIsReplacedOnlyByAnActThatSawIt
      not proved for DecideRows: DecideRows has more than 4096 paths
  ✓ NobodyClearsAnotherPersonsDecision
      not proved for DecideRows: DecideRows has more than 4096 paths
  ✓ AMatchChangesNoDecision
      not proved for DecideRows: DecideRows has more than 4096 paths
  ✓ AnAcceptIsMadeOnTheMatchingItsSenderSaw
      not proved for DecideRows: DecideRows has more than 4096 paths
  ✓ AConfirmIsOfWhatItsSenderSaw
      not proved for DecideRows: DecideRows has more than 4096 paths
  ✓ AConfirmedDraftKeepsItsDecisions
      not proved for DecideRows: DecideRows has more than 4096 paths
  ✓ OnlyItsOwnOrganizationChangesADraft
      not proved for DecideRows: DecideRows has more than 4096 paths
  ✓ AViewerChangesNothing
      not proved for DecideRows: DecideRows has more than 4096 paths

Not done
  ✗ the search stopped at its budget: only every sequence of up to 2 commands was run (allow: { truncated: true } passes with this)
```

```text
DraftSeen: 0 invariants, 8 transitions, 6 commands

✗ The state stays in its schema
    ✓ holds on the initial state
    ✓ proved for OpenDraft
    ✗ DecideRows: not decided
        DecideRows has more than 4096 paths
    ✗ UndoStep: proved for short lists only
        state.cells was tried with up to 2 items
    ✗ MatchColumn: not decided
        MatchColumn has more than 4096 paths
    ✗ ConfirmDraft: not decided
        ConfirmDraft has more than 4096 paths
    ✗ ReopenDraft: not decided
        ReopenDraft has more than 4096 paths

```

```text
DraftSeen: every sequence of up to 3 commands on a new instance
100,000 sequences, 99,629 states (stopped at the budget: every sequence of up to 2 commands was run, and some of 3)

✓ ADecisionIsReplacedOnlyByAnActThatSawIt holds on the 99,629 steps taken
✓ NobodyClearsAnotherPersonsDecision holds on the 99,629 steps taken
✓ AMatchChangesNoDecision holds on the 99,629 steps taken
✓ AnAcceptIsMadeOnTheMatchingItsSenderSaw holds on the 99,629 steps taken
✓ AConfirmIsOfWhatItsSenderSaw holds on the 99,629 steps taken
✓ AConfirmedDraftKeepsItsDecisions holds on the 99,629 steps taken
✓ OnlyItsOwnOrganizationChangesADraft holds on the 99,629 steps taken
✓ AViewerChangesNothing holds on the 99,629 steps taken

```

Whatever the search finds, no rule of this aggregate can be proved by the prover as it is at this commit: a list from
the state or a command is given at most 2 items more than its schema asks for, a rule that passes that way is
checked and never proved, and a rule is proved only when every command of its aggregate is. That takes the sixteen
lifecycle rules with it, since match, confirm, take-back and reopen are commands of the same instance.

### What each shape proves, costs and shows

The three ways of holding the review, with a group act of 6,000 rows as the measure. The request counts are
arithmetic from the host's source, as on [host on Cloudflare](concepts/host-cloudflare.md): a command is one request,
a decision across two instances about four, each event one delivery to each consumer key, and each object that
queued work one alarm. Nothing was deployed and no time was measured on an object.

| | The lifecycle and one instance per row, every act a decision (`Review`) | The same, with a group decided as one unit | One instance per import (`DraftSeen`) |
| --- | --- | --- | --- |
| Proved | 27 rules: the lifecycle's 16, the row's 5, the decisions' 6 | The same 27: a unit is the row's aggregate under another key | None, by the prover's design |
| Checked | 1 relation, to 2 commands and 200 walks | The same | Its eight rules, in every sequence of up to 2 commands; the search stopped at its budget before the third |
| Not run | A saga that sends a group; a confirm with unsent acts (none is carried) | The fold that gives each row its decision from its own unit and its groups' units, against today's `act` | A deployed object at file size |
| One act on one row | About 4 requests, then 1 or 2 deliveries and alarms | The same | 1 request, then deliveries |
| A group act on 6,000 rows | 6,000 acts, one after another through the import: about 24,000 requests for the decisions and 12,000 to 18,000 more for deliveries and alarms. The time was not measured | One act: about 4 requests | One command of 257 KB, one event of 64 KB; the fold took 0.34 s in Node on a draft of 50,000 |
| What the person sees while it is under way | Their own screen shows all 6,000 at once, as its own acts. Other people see the rows change a few at a time, and a line "saving 2,340 of 6,000" | Everyone sees it at once | Everyone sees it at once |
| If it stops | The saga sends the rest when it runs again. Until it ends, some rows hold the decision and some do not, and a confirm is refused, because the import's last change keeps moving | It was recorded or it was not | It was recorded or it was not |
| Undo of that step | 6,000 more acts | One act | One command |
| State | 233 bytes for the lifecycle; 276 to 418 bytes a row; 897 KB for a row with 14 fields each typed at the contract's 32,767 characters over another such decision | The same, and one small state a group | 38 KB at 200 rows, 4.8 MB at 25,000, 9.6 MB at 50,000; it passes 8 MiB at about 42,800 decided rows, with nothing kept under a decision |
| Kept for ever | Every act's event and receipt in its row's object and in the import's; one object a decided row | The same, and one object a decided group | Every act's event and its receipt, which holds the event again, in the import's object |

The sizes and the fold's time, as measured on plain data in Node:

```text
One instance per import (the state DraftSeen holds; no decision kept under the current one):
  200 rows decided, a typed name on every 10: 38 KB
  5000 rows decided, a typed name on every 10: 951 KB
  25000 rows decided, a typed name on every 10: 4776 KB
  50000 rows decided, a typed name on every 10: 9563 KB
  50000 rows decided, a typed name on every 1: 9598 KB
  passes 8 MiB between 42781 and 42878 decided rows (a typed name on every 10)
One instance per row (the state RowUnit holds):
  an accepted fix, nothing under it: 276 bytes
  a typed name over an accepted fix: 418 bytes
  14 fields each typed at the contract's 32,767 characters, over another such decision: 897 KB
The import's lifecycle (the state ImportLife holds): 233 bytes
One act naming 200 rows: command 8 KB, event 2 KB (the receipt holds the event again)
One act naming 6000 rows: command 257 KB, event 64 KB (the receipt holds the event again)
One act naming 50000 rows: command 2187 KB, event 575 KB (the receipt holds the event again)
Time of that fold in Node on this machine (one pass; the command's own check walks the rows again):
  6,000 rows named, none held yet, on an empty draft: 0.00 s, 6000 rows after
  6,000 rows named, all held, on a draft of 50,000: 0.34 s, 50000 rows after
  50,000 rows named, none of them held, on a draft of 50,000: 5.66 s, 100000 rows after
  50,000 rows named, all held, on a draft of 50,000: 2.53 s, 50000 rows after
```

```javascript
// Sizes and times for the shapes the second round of trials ran, as plain data and plain folds. Nothing is stored.
import * as A from "effect/Array"

const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const bytes = (value) => Buffer.byteLength(JSON.stringify(value))
const kb = (value) => (bytes(value) / 1024).toFixed(0)
const LIMIT = 8 * 1024 * 1024
const nothing = { _tag: "Nothing" }
const flagsOf = (i, typedEvery) =>
  i % typedEvery === 0 ? JSON.stringify({ edits: { name: `Steel Tube ${i} inch` } }) : JSON.stringify({ accepted: ["uom"] })

// One instance per import, as DraftSeen holds it: every decided row with who, the step and the decision's text.
const held = (i, typedEvery) => ({
  row: `row-${i}`,
  by: uuid(2),
  step: uuid(1000 + (i % 40)),
  flags: flagsOf(i, typedEvery),
  accept: i % typedEvery === 0 ? nothing : { _tag: "Fix", field: "uom", matching: 1 },
})
const draft = (rows, typedEvery) => ({
  _tag: "Open",
  organizationId: uuid(1),
  matching: { sku: 0, name: 0, uom: 1, unitCost: 0 },
  last: { _tag: "Step", step: uuid(1039) },
  cells: Array.from({ length: rows }, (_, i) => held(i + 1, typedEvery)),
})
console.log("One instance per import (the state DraftSeen holds; no decision kept under the current one):")
for (const [rows, typedEvery] of [[200, 10], [5000, 10], [25000, 10], [50000, 10], [50000, 1]]) {
  console.log(`  ${rows} rows decided, a typed name on every ${typedEvery}: ${kb(draft(rows, typedEvery))} KB`)
}
// Where it passes the limit measured in local workerd.
let low = 1000
let high = 200000
while (high - low > 100) {
  const mid = Math.floor((low + high) / 2)
  if (bytes(draft(mid, 10)) > LIMIT) high = mid
  else low = mid
}
console.log(`  passes 8 MiB between ${low} and ${high} decided rows (a typed name on every 10)`)

// One instance per row, as RowUnit holds it, and the largest the contract allows it to be.
const row = (flags, underFlags) => ({
  _tag: "Decided",
  importId: uuid(7),
  organizationId: uuid(1),
  by: uuid(2),
  step: uuid(1001),
  flags,
  under: underFlags === undefined ? nothing : { _tag: "Was", by: uuid(3), step: uuid(1000), flags: underFlags },
})
const widest = JSON.stringify({ edits: Object.fromEntries(Array.from({ length: 14 }, (_, i) => [`field${i}`, "x".repeat(32767)])) })
console.log("One instance per row (the state RowUnit holds):")
console.log(`  an accepted fix, nothing under it: ${bytes(row(flagsOf(1, 10)))} bytes`)
console.log(`  a typed name over an accepted fix: ${bytes(row(flagsOf(10, 10), flagsOf(1, 10)))} bytes`)
console.log(`  14 fields each typed at the contract's 32,767 characters, over another such decision: ${kb(row(widest, widest))} KB`)
console.log(`The import's lifecycle (the state ImportLife holds): ${bytes({ _tag: "Open", organizationId: uuid(1), rows: 50000, confirms: 0, matching: { sku: 0, name: 0, uom: 1, unitCost: 0 }, last: { _tag: "Step", step: uuid(9) }, suggestions: 0 })} bytes`)

// One act's event in the one-instance shape: one decision's text and the rows it was applied to.
for (const rows of [200, 6000, 50000]) {
  const event = { _tag: "RowsDecided", by: uuid(2), step: uuid(3), flags: flagsOf(1, 10), accept: { _tag: "Fix", field: "uom", matching: 1 }, rows: Array.from({ length: rows }, (_, i) => `row-${i + 1}`) }
  const command = { draftId: uuid(7), step: uuid(3), flags: flagsOf(1, 10), accept: event.accept, rows: event.rows.map((one) => ({ row: one, saw: nothing })) }
  console.log(`One act naming ${rows} rows: command ${kb(command)} KB, event ${kb(event)} KB (the receipt holds the event again)`)
}

// The fold of one act in the one-instance shape, as DraftSeen's evolve writes it with effect/Array.
const fold = (cells, e) =>
  A.appendAll(
    A.filter(cells, (one) => !A.some(e.rows, (name) => name === one.row)),
    A.map(e.rows, (name) => ({ row: name, by: e.by, step: e.step, flags: e.flags, accept: e.accept })),
  )
const timed = (label, cells, rows) => {
  const e = { by: uuid(2), step: uuid(3), flags: flagsOf(1, 10), accept: nothing, rows }
  const started = performance.now()
  const after = fold(cells, e)
  console.log(`  ${label}: ${((performance.now() - started) / 1000).toFixed(2)} s, ${after.length} rows after`)
}
console.log("Time of that fold in Node on this machine (one pass; the command's own check walks the rows again):")
const all = draft(50000, 10).cells
const names = (from, count) => Array.from({ length: count }, (_, i) => `row-${from + i}`)
timed("6,000 rows named, none held yet, on an empty draft", [], names(1, 6000))
timed("6,000 rows named, all held, on a draft of 50,000", all, names(1, 6000))
timed("50,000 rows named, none of them held, on a draft of 50,000", all, names(50001, 50000))
timed("50,000 rows named, all held, on a draft of 50,000", all, names(1, 50000))
```

## Trial 6. The rule kinds the first round did not run

On the app's people-and-roles rules, an upload, and the first round's import. Verify's defaults throughout: 2
commands for a model, a budget of 100,000 sequences, 2 instances, both faults on, 200 walks of up to 12 commands.

| Run | Stands for | Result | Time |
| --- | --- | --- | --- |
| A decision, `Membership`, in the model `Access` | An admin adds a person by the email they signed up with; an email already held and a person who is not an admin are refused; the organization and the email change together | **Proved**: `AddMemberByEmail.OnlyAFreeEmailIsClaimed`, and every rule of the two aggregates it records on | 15.5 s |
| A relation, `AClaimedEmailBelongsToAMember` | A claimed email's organization has at least one member | **Proved** | the same run |
| `Verify.aggregate(Organization)` alone | The same aggregate | **Not verified**: its three rules are proved for its own commands, and "Organization folds MemberJoined, which a decision records" | 1.4 s |
| A model invariant, `EveryConfirmedFileAddsUp` | After Confirm, created and not imported add up to the rows in the file | **Checked**, in every sequence of up to 2 commands (8,889 sequences) and 200 walks. A model invariant is never proved | 17.8 s |
| An `eventually` rule, `EveryUploadEnds`, with nothing that makes progress | Every upload ends finished or expired | **Broken**: an upload begun and never finished | 12.7 s |
| The same with a policy that schedules the upload's expiry | The same | **Checked**: it holds at the end of the 116 sequences that ran their course. An `eventually` rule is never proved | 13.9 s |
| A rule broken on purpose: `RemoveMember` no longer refuses the last admin | An organization always keeps an admin | **Broken** in 2 commands, with the sequence printed "as a story, to keep as a test" | 19.2 s |
| That story kept as a test | | It **fails** on the broken code ("expected a rejection, the command was accepted") and **passes** on the fixed | under 1 s each |

### The decision and the relation

```typescript
// The app's rule: an organization always keeps an admin (People page: "the organization always keeps an admin").
// Who is in an organization, as counts by role. A person joins only through the Membership decision (MemberJoined
// is recorded there, with the claim on their email); a role change and a removal are this aggregate's own commands,
// and only an admin of the organization sends them.
import * as Domain from "@alchemy.run/domain"
import * as Effect from "effect/Effect"
import * as S from "effect/Schema"
import { CurrentActor, Session } from "./Actor.context.ts"

export const OrganizationId = S.String.pipe(S.brand("OrganizationId"))
export const Role = S.Literals(["admin", "editor", "viewer"])

export class OrganizationFounded extends Domain.Event("OrganizationFounded", {}) {}
export class MemberJoined extends Domain.Event("MemberJoined", { role: Role }) {}
export class RoleChanged extends Domain.Event("RoleChanged", { from: Role, to: Role }) {}
export class MemberRemoved extends Domain.Event("MemberRemoved", { role: Role }) {}

export class AlreadyFounded extends Domain.Rejection("AlreadyFounded", {}) {}
export class NotFounded extends Domain.Rejection("NotFounded", {}) {}
export class NotAnAdmin extends Domain.Rejection("NotAnAdmin", {}) {}
export class LastAdmin extends Domain.Rejection("LastAdmin", {}) {}
export class NobodyWithThatRole extends Domain.Rejection("NobodyWithThatRole", {}) {}

export class FoundOrganization extends Domain.Command("FoundOrganization", {
  input: { organizationId: OrganizationId },
  events: [OrganizationFounded],
  rejects: [AlreadyFounded],
}) {}
export class ChangeRole extends Domain.Command("ChangeRole", {
  middleware: [Session],
  input: { organizationId: OrganizationId, from: Role, to: Role },
  events: [RoleChanged],
  rejects: [NotFounded, NotAnAdmin, LastAdmin, NobodyWithThatRole],
}) {}
export class RemoveMember extends Domain.Command("RemoveMember", {
  middleware: [Session],
  input: { organizationId: OrganizationId, role: Role },
  events: [MemberRemoved],
  rejects: [NotFounded, NotAnAdmin, LastAdmin, NobodyWithThatRole],
}) {}

const OrganizationState = S.Union([
  S.TaggedStruct("Unfounded", {}),
  S.TaggedStruct("Founded", { admins: S.Int, others: S.Int }),
])

/** One organization's people, counted by whether they are an admin. */
export class Organization extends Domain.Aggregate("Organization", {
  id: OrganizationId,
  state: OrganizationState,
  initial: { _tag: "Unfounded" },
  invariants: {
    AlwaysKeepsAnAdmin: (s) => s._tag !== "Founded" || s.admins >= 1,
    NobodyIsCountedBelowZero: (s) => s._tag !== "Founded" || s.others >= 0,
  },
  transitions: {
    AFoundedOrganizationStaysFounded: ({ before, after }) => before._tag !== "Founded" || after._tag === "Founded",
  },
  commands: [FoundOrganization, ChangeRole, RemoveMember],
  keyOf: (cmd) => cmd.organizationId,
  events: [MemberJoined],
  decide: {
    FoundOrganization: (s) => (s._tag !== "Unfounded" ? new AlreadyFounded({}) : [new OrganizationFounded({})]),
    ChangeRole: Effect.fn(function* (s, cmd) {
      const actor = yield* CurrentActor
      if (s._tag !== "Founded") return yield* new NotFounded({})
      if (actor.role !== "admin" || actor.organizationId !== cmd.organizationId) return yield* new NotAnAdmin({})
      if (cmd.from === "admin" && cmd.to !== "admin" && s.admins === 1) return yield* new LastAdmin({})
      if (cmd.from !== "admin" && s.others === 0) return yield* new NobodyWithThatRole({})
      return [new RoleChanged({ from: cmd.from, to: cmd.to })]
    }),
    RemoveMember: Effect.fn(function* (s, cmd) {
      const actor = yield* CurrentActor
      if (s._tag !== "Founded") return yield* new NotFounded({})
      if (actor.role !== "admin" || actor.organizationId !== cmd.organizationId) return yield* new NotAnAdmin({})
      if (cmd.role === "admin" && s.admins === 1) return yield* new LastAdmin({})
      if (cmd.role !== "admin" && s.others === 0) return yield* new NobodyWithThatRole({})
      return [new MemberRemoved({ role: cmd.role })]
    }),
  },
  evolve: {
    OrganizationFounded: () => ({ _tag: "Founded" as const, admins: 1, others: 0 }),
    MemberJoined: (s, e) =>
      s._tag !== "Founded" ? s : e.role === "admin" ? { ...s, admins: s.admins + 1 } : { ...s, others: s.others + 1 },
    RoleChanged: (s, e) =>
      s._tag !== "Founded"
        ? s
        : e.from === "admin" && e.to !== "admin"
          ? { ...s, admins: s.admins - 1, others: s.others + 1 }
          : e.from !== "admin" && e.to === "admin"
            ? { ...s, admins: s.admins + 1, others: s.others - 1 }
            : s,
    MemberRemoved: (s, e) =>
      s._tag !== "Founded" ? s : e.role === "admin" ? { ...s, admins: s.admins - 1 } : { ...s, others: s.others - 1 },
  },
}) {}
```

```typescript
// The app's rule: an admin adds a person by the email they signed up with, and one email is one member of an
// organization. One email within one organization, keyed by `<organizationId>:<lower-cased email>`, and who holds
// it. It has no command of its own: only the Membership decision claims it, together with the organization.
// The claim keeps the organization's id, so a rule about the two (the model's relation) can match them.
// The email arrives already lower-cased and trimmed: the host does that before it sends the command. The model
// cannot say so: the prover does not read `toLowerCase` or `trim` (a first run with them in the key left the
// decision unexplored), and the solver sends inputs that break `isLowercased` (a second run with that check on the
// input had the real code refuse them in 82 sequences). So the brand below is a promise, not a check.
import * as Domain from "@alchemy.run/domain"
import * as S from "effect/Schema"
import { OrganizationId, Role } from "./Organization.aggregate.ts"

export const MemberEmailKey = S.String.pipe(S.brand("MemberEmailKey"))

/** An email as the person signed up with it, lower-cased and trimmed before it is sent. */
export const NormalizedEmail = S.String.pipe(S.brand("NormalizedEmail"))

/** The key of an email within an organization. */
export const emailKey = (organizationId: string, email: string) => MemberEmailKey.make(`${organizationId}:${email}`)

export class EmailClaimed extends Domain.Event("EmailClaimed", {
  organizationId: OrganizationId,
  memberId: S.String,
  role: Role,
}) {}

export class MemberEmail extends Domain.Aggregate("MemberEmail", {
  id: MemberEmailKey,
  state: S.Union([
    S.TaggedStruct("Free", {}),
    S.TaggedStruct("Claimed", { organizationId: OrganizationId, memberId: S.String, role: Role }),
  ]),
  initial: { _tag: "Free" },
  transitions: {
    /** Once a member holds an email, nobody else gets it. */
    AClaimedEmailStaysWithItsMember: ({ before, after }) =>
      before._tag === "Free" || (after._tag === "Claimed" && after.memberId === before.memberId),
  },
  events: [EmailClaimed],
  evolve: {
    EmailClaimed: (_, e) => ({
      _tag: "Claimed" as const,
      organizationId: e.organizationId,
      memberId: e.memberId,
      role: e.role,
    }),
  },
}) {}
```

```typescript
// The app's rule (People page): an admin adds a person to their organization by the email the person signed up
// with; an email already held in that organization is refused, and so is anyone who is not an admin of it. The new
// member is counted on the organization and the email is claimed for them, on both or on neither.
import * as Domain from "@alchemy.run/domain"
import * as Effect from "effect/Effect"
import * as S from "effect/Schema"
import { CurrentActor, Session } from "./Actor.context.ts"
import { EmailClaimed, emailKey, MemberEmail, NormalizedEmail } from "./MemberEmail.aggregate.ts"
import { MemberJoined, NotAnAdmin, NotFounded, Organization, OrganizationId, Role } from "./Organization.aggregate.ts"

/** Someone in this organization already signed in with this email. */
export class EmailTaken extends Domain.Rejection("EmailTaken", {}) {}

export class AddMemberByEmail extends Domain.Command("AddMemberByEmail", {
  middleware: [Session],
  input: { organizationId: OrganizationId, email: NormalizedEmail, memberId: S.String, role: Role },
  events: [MemberJoined, EmailClaimed],
  rejects: [NotFounded, NotAnAdmin, EmailTaken],
}) {}

export class Membership extends Domain.Decision(AddMemberByEmail, {
  reads: { organization: Organization, claim: MemberEmail },
  keyOf: (cmd) => ({ organization: cmd.organizationId, claim: emailKey(cmd.organizationId, cmd.email) }),
  decide: Effect.fn(function* ({ organization, claim }, cmd) {
    const actor = yield* CurrentActor
    if (organization.state._tag !== "Founded") return yield* new NotFounded({})
    if (actor.role !== "admin" || actor.organizationId !== organization.id) return yield* new NotAnAdmin({})
    if (claim.state._tag === "Claimed") return yield* new EmailTaken({})
    return [
      organization.record(new MemberJoined({ role: cmd.role })),
      claim.record(new EmailClaimed({ organizationId: organization.id, memberId: cmd.memberId, role: cmd.role })),
    ]
  }),
  transitions: {
    /** An email is only given to a new member while nobody in the organization holds it. */
    OnlyAFreeEmailIsClaimed: ({ before }) => before.claim._tag === "Free",
  },
}) {}
```

```typescript
// The access context's people-and-roles rules as one model: the organization keeps an admin, a person is added by
// email through one decision over the organization and the email, and a claimed email's organization has members.
import * as Domain from "@alchemy.run/domain"
import { MemberEmail } from "./MemberEmail.aggregate.ts"
import { Membership } from "./Membership.decision.ts"
import { Organization } from "./Organization.aggregate.ts"

export class Access extends Domain.Model("Access", {
  aggregates: [Organization, MemberEmail],
  decisions: [Membership],
  relations: {
    /**
     * A claimed email's organization has at least one member. Stated as: when the email is claimed for this
     * organization, the organization is founded and counts at least one person (admins + others >= 1).
     */
    AClaimedEmailBelongsToAMember: Domain.Relation({
      over: { claim: MemberEmail, organization: Organization },
      holds: ({ claim, organization }) =>
        claim.state._tag !== "Claimed" ||
        claim.state.organizationId !== organization.id ||
        (organization.state._tag === "Founded" && organization.state.admins + organization.state.others >= 1),
    }),
  },
}) {}

export class AccessApi extends Domain.Api("AccessApi", {
  model: Access,
  commands: ["FoundOrganization", "AddMemberByEmail", "ChangeRole", "RemoveMember"],
  views: [],
  streams: [],
  queries: [],
}) {}
```

```text
VERIFIED
Access: 17 outcomes, 1 decision

Proved: for every state and every input, after any number of commands
  ✓ Organization.AlwaysKeepsAnAdmin
  ✓ Organization.NobodyIsCountedBelowZero
  ✓ Organization.AFoundedOrganizationStaysFounded
  ✓ MemberEmail.AClaimedEmailStaysWithItsMember
  ✓ AddMemberByEmail.OnlyAFreeEmailIsClaimed
  ✓ Access.AClaimedEmailBelongsToAMember

Sampled: 200 longer sequences, of up to 7 commands picked at random (seed 1)
  ✓ none breaks a rule

Run on the real model: 16 sequences the explorer found and 73 walks of commands picked at random, as stories
  ✓ the model does what the explorer read in each

Assumed
  - whole numbers are exact: a number stays within ±2^53, and a bigint has no limit
  - a list an input holds has up to 2 items more than its schema asks for
  - an external system answers what its schema allows, and nothing else
  - middleware lets every caller in: who sends a command is anyone its request context allows
  - what a projection writes, and what a stream or a query gives, is not checked: only what a projection is given
  - a decision's events commit on every instance it recorded on, or on none: how a platform commits them is not checked
--- not part of Verify.render: from report.explored ---
depth 2, sequences 9315, states 650, truncated false, every sequence of up to 2 commands run
```

`Organization` holds two counts, of admins and of others, and trusts the role a command states. The app's members
are rows with ids; an aggregate that held them as a list would have its rules checked, not proved.

Two things Verify did not take, both about the email:

- A key built with `.trim().toLowerCase()`: "not proved for AddMemberByEmail: reads .trim of a string". The prover
  reads no string method.
- An email schema that checks it is lower-cased: every rule proved, and "the real code disagrees with what the
  explorer read in 82 sequences", because the solver sent an upper-case letter. The model that ran takes the email
  as already lower-cased. Lower-casing is done before the command is sent.

The claim's state had to carry its organization's id for the relation to be stated at all: the only other link is
the key, and the prover cannot take a key apart.

### The model invariant

The first round's `ImportDraft` ([04](04-trial.md)) in a model of its own:

```typescript
// The app's rule: after Confirm, what was created and what was not imported add up to the rows in the file
// ("the outcomes, and they add up"). The first trial's model invariant EveryConfirmedFileAddsUp, copied unchanged,
// in a catalog model with only the aggregate it reads.
import * as Domain from "@alchemy.run/domain"
import { ImportDraft } from "./ImportDraft.aggregate.ts"

export class Catalog extends Domain.Model("Catalog", {
  aggregates: [ImportDraft],
  invariants: {
    EveryConfirmedFileAddsUp: (catalog) =>
      catalog.ImportDraft.every(
        (one) => one.state._tag !== "Imported" || one.state.created + one.state.notImported === one.state.rows,
      ),
  },
}) {}

export class CatalogApi extends Domain.Api("CatalogApi", { model: Catalog }) {}
```

```text
VERIFIED
Catalog: 23 outcomes

Proved: for every state and every input, after any number of commands
  ✓ ImportDraft.OutcomesAddUpToTheRows
  ✓ ImportDraft.NoCountIsNegative
  ✓ ImportDraft.NothingIsWrittenBeforeConfirm
  ✓ ImportDraft.AConfirmOfAClosedImportWritesNothing
  ✓ ImportDraft.OnlyAnImportedFileIsTakenBack
  ✓ ImportDraft.ATakeBackKeepsWhatWasChanged
  ✓ ImportDraft.ASuggestionWritesNothing
  ✓ ImportDraft.AnImportNeverChangesOrganization
  ✓ ImportDraft.OnlyItsOwnOrganizationChangesAnImport
  ✓ ImportDraft.AViewerChangesNothing

Checked: in every sequence of up to 2 commands through CatalogApi, with each event delivered twice, each reaction also run behind the others that wait
8,889 sequences, 863 states
  ✓ Catalog.EveryConfirmedFileAddsUp

Sampled: 200 longer sequences, of up to 11 commands picked at random (seed 1)
  ✓ none breaks a rule

Run on the real model: 23 sequences the explorer found and 156 walks of commands picked at random, as stories
  ✓ the model does what the explorer read in each
```

### The `eventually` rule

```typescript
// The app's rule: a file sent up in pieces (POST /api/v1/imports/uploads, the chunks, then finish) never stays half
// sent: every upload ends finished or expired. One upload, and whether it is still being sent.
import * as Domain from "@alchemy.run/domain"
import * as S from "effect/Schema"

export const UploadId = S.String.pipe(S.brand("UploadId"))

export class UploadBegun extends Domain.Event("UploadBegun", {}) {}
export class UploadFinished extends Domain.Event("UploadFinished", {}) {}
export class UploadExpired extends Domain.Event("UploadExpired", {}) {}

export class AlreadyBegun extends Domain.Rejection("AlreadyBegun", {}) {}
export class NotUploading extends Domain.Rejection("NotUploading", {}) {}

export class BeginUpload extends Domain.Command("BeginUpload", {
  input: { uploadId: UploadId },
  events: [UploadBegun],
  rejects: [AlreadyBegun],
}) {}
export class FinishUpload extends Domain.Command("FinishUpload", {
  input: { uploadId: UploadId },
  events: [UploadFinished],
  rejects: [NotUploading],
}) {}
/** Sent by the deadline, not by a person. An upload that already ended records nothing. */
export class ExpireUpload extends Domain.Command("ExpireUpload", {
  input: { uploadId: UploadId },
  events: [UploadExpired],
}) {}

export class Upload extends Domain.Aggregate("Upload", {
  id: UploadId,
  state: S.Union([
    S.TaggedStruct("New", {}),
    S.TaggedStruct("Uploading", {}),
    S.TaggedStruct("Finished", {}),
    S.TaggedStruct("Expired", {}),
  ]),
  initial: { _tag: "New" },
  transitions: {
    /** A finished or expired upload stays as it ended. */
    AnEndedUploadStaysEnded: ({ before, after }) =>
      (before._tag !== "Finished" && before._tag !== "Expired") || after._tag === before._tag,
  },
  commands: [BeginUpload, FinishUpload, ExpireUpload],
  keyOf: (cmd) => cmd.uploadId,
  decide: {
    BeginUpload: (s) => (s._tag === "New" ? [new UploadBegun({})] : new AlreadyBegun({})),
    FinishUpload: (s) => (s._tag === "Uploading" ? [new UploadFinished({})] : new NotUploading({})),
    ExpireUpload: (s) => (s._tag === "Uploading" ? [new UploadExpired({})] : []),
  },
  evolve: {
    UploadBegun: () => ({ _tag: "Uploading" as const }),
    UploadFinished: () => ({ _tag: "Finished" as const }),
    UploadExpired: () => ({ _tag: "Expired" as const }),
  },
}) {}
```

```typescript
// The app's rule: every upload ends finished or expired. A person begins and finishes an upload; nobody expires
// one by hand. So the rule cannot hold on what callers send alone (UploadsWithoutDeadline: an upload begun and never
// finished stays Uploading), and holds once a deadline policy schedules ExpireUpload a day after each begins
// (Uploads). The policy is the smallest addition that makes progress: one schedule per upload.
import * as Domain from "@alchemy.run/domain"
import * as Effect from "effect/Effect"
import { ExpireUpload, Upload, UploadBegun } from "./Upload.aggregate.ts"

/** Without a deadline: what callers send is all that happens. */
export class UploadsWithoutDeadline extends Domain.Model("UploadsWithoutDeadline", {
  aggregates: [Upload],
  eventually: {
    EveryUploadEnds: (uploads) =>
      uploads.Upload.every((one) => one.state._tag === "Finished" || one.state._tag === "Expired"),
  },
}) {}

export class UploadsWithoutDeadlineApi extends Domain.Api("UploadsWithoutDeadlineApi", {
  model: UploadsWithoutDeadline,
  commands: ["BeginUpload", "FinishUpload"],
  views: [],
  streams: [],
  queries: [],
}) {}

/** Whenever an upload begins, expire it a day later: one finished by then records nothing. */
export class UploadDeadline extends Domain.Policy("UploadDeadline", {
  from: Upload,
  on: [UploadBegun],
}) {}

export const UploadDeadlineLive = UploadDeadline.toLayer(
  Effect.gen(function* () {
    const uploads = yield* Upload
    return Effect.fn(function* ({ source }) {
      yield* uploads.schedule(new ExpireUpload({ uploadId: source.id }), { after: "1 day" })
    })
  }),
)

/** With the deadline. */
export class Uploads extends Domain.Model("Uploads", {
  aggregates: [Upload],
  policies: [UploadDeadline],
  eventually: {
    EveryUploadEnds: (uploads) =>
      uploads.Upload.every((one) => one.state._tag === "Finished" || one.state._tag === "Expired"),
  },
}) {}

export class UploadsApi extends Domain.Api("UploadsApi", {
  model: Uploads,
  commands: ["BeginUpload", "FinishUpload"],
  views: [],
  streams: [],
  queries: [],
}) {}
```

Without the policy:

```text
NotVerified

UploadsWithoutDeadline: 5 outcomes

Proved: for every state and every input, after any number of commands
  ✓ Upload.AnEndedUploadStaysEnded

Sampled: 200 longer sequences, of up to 4 commands picked at random (seed 1)

✗ UploadsWithoutDeadline.EveryUploadEnds does not hold in the end
    1. Upload "A" BeginUpload { uploadId: "A" }  → UploadBegun

    As a story, to keep as a test:

    story(
      Story.when(new BeginUpload({ uploadId: "A" })),
      Story.then(Upload.ref("A"), new UploadBegun({})),
    )

```

With it:

```text
VERIFIED
Uploads: 5 outcomes, 1 policy

Proved: for every state and every input, after any number of commands
  ✓ Upload.AnEndedUploadStaysEnded

Checked: in every sequence of up to 2 commands through UploadsApi, with each event delivered twice, each reaction also run behind the others that wait
8,813 sequences, 810 states
  ✓ Uploads.EveryUploadEnds  holds at the end of the 116 sequences that ran their course

Sampled: 200 longer sequences, of up to 4 commands picked at random (seed 1)
  ✓ none breaks a rule

Run on the real model: 5 sequences the explorer found and 5 walks of commands picked at random, as stories (41 more need an event delivered twice, a step run twice or a schedule that runs late, which a story does not do)
```

### A broken rule, kept as a story

The one change: the line of `RemoveMember`'s `decide` that refuses the last admin is gone.

```text
NotVerified

AccessBroken: 17 outcomes, 1 decision

Proved: for every state and every input, after any number of commands
  ✓ Organization.NobodyIsCountedBelowZero
  ✓ Organization.AFoundedOrganizationStaysFounded
  ✓ MemberEmail.AClaimedEmailStaysWithItsMember
  ✓ AddMemberByEmail.OnlyAFreeEmailIsClaimed

Sampled: 200 longer sequences, of up to 7 commands picked at random (seed 1)

✗ Organization.AlwaysKeepsAnAdmin breaks
    1. Organization "A" FoundOrganization { organizationId: "A" }  → OrganizationFounded
    2. Organization "A" RemoveMember { organizationId: "A", role: "admin" } as { organizationId: "A", memberId: "D", role: "admin" }  → MemberRemoved

    As a story, to keep as a test:

    story(
      Story.when(new FoundOrganization({ organizationId: "A" })),
      Story.then(Organization.ref("A"), new OrganizationFounded({})),
      Story.provide(CurrentActor, { organizationId: "A", memberId: "D", role: "admin" }),
      Story.when(new RemoveMember({ organizationId: "A", role: "admin" })),
      Story.then(Organization.ref("A"), new MemberRemoved({ role: "admin" })),
```

Verify has no option that writes a test. It prints the shortest breaking sequence as a story. The printed story ends
with what the broken code did, so kept as printed it passes on the broken code; the kept test ends with what the
code must do:

```typescript
it.effect("the last admin of an organization is not removed", () =>
  story(
    Story.when(new FoundOrganization({ organizationId: "A" })),
    Story.then(Organization.ref("A"), new OrganizationFounded({})),
    Story.provide(CurrentActor, { organizationId: "A", memberId: "D", role: "admin" }),
    Story.when(new RemoveMember({ organizationId: "A", role: "admin" })),
    Story.rejected(new LastAdmin({})),
  ),
)
```

## What the second round did not run

- A saga, a policy that sends commands, a projection, a view, a stream or a query. No read of any kind.
- A group decided as one unit, and the fold that would merge it with row decisions.
- Any search of a model deeper than 2 commands, beyond the 200 walks.
- The Api over HTTP, a session middleware, or who may read a view. Verify assumes "middleware lets every caller in".
- A deployed Worker or object. Every request count on this page is arithmetic.
- The row's rules with a typed decision. They are proved with the decision as text.

## Running the second round again

Each source above is complete, except where a block says it is an excerpt; trial 1's driver and `wrangler` file and
the two small packages `RowPackaged` reads by name (an id and a value schema, each a `package.json` and an
`index.ts`, linked into `node_modules` by hand) are described, not printed. Put the files of one trial in one folder
beside `Actor.context.ts`, a manifest like the first round's with `@alchemy.run/cloudflare` added for trial 1, and one test per aggregate or model that calls
`Verify.aggregate` or `Verify.model` and writes the report to a file. A model's test is shown in trial 5.

# The third round

Run on 2026-11-20, the same day, on the same preview builds of `main@dbfd0dd`, beside `effect` 4.1.4, under Vitest
5.1.1 on Node 24.22.1. It runs the shape the brief recommends with the app's real fields, and the parts of the design
the second round left as words: the confirm and the group act, the answer "no change", accepts on an older matching,
undo below the first level, the item with its replace and restore, the allowance by day, members as their own
instances, how long each proof takes alone, and one decision across two objects on the Durable Object host. Every
source below is complete unless it is marked as an excerpt; every report is printed whole unless it says which lines.

| # | What | Result | Time |
| --- | --- | --- | --- |
| 7 | The review as it would be hosted (`review8`): the app's fifteen fields; a confirm that names the last change its screen received and the change its plan was built at; a group act being sent; "no change"; accepts named by the import's matching; undo checked by step at every depth. "None yet" is the empty text | **Verified. 32 rules proved, 1 checked** (the relation) | 82 s |
| 7 | The same design with unions for "none yet" and the fifteen accepts compared one by one (`review5`) | **Not verified.** Both decisions pass 4,096 paths; nothing proved; the search stopped at its budget after 2 commands | 716 s |
| 7 | `Prove.decision` on each decision of the hosted shape, alone | **Proved**: `Deciding` over 509 paths, `Undoing` over 181 | 12.2 s, 3.8 s |
| 7 | The same on the union shape | **Not proved**: 4,097 paths, every rule "Unknown" | 73 s, 83 s |
| 7 | Eight orderings as stories on the hosted model; the accept's read side as a test | **All pass** | under 1 s |
| 8 | An item held as text, with replace and restore in turn (`Item`) | **Verified. 10 rules proved**; five stories pass | 3.6 s |
| 8 | The same item with its tags and vendors as lists (`ItemLists`) | **Not verified.** All 11 rules checked; three commands pass 4,096 paths | 788 s |
| 9 | The allowance by the UTC day, the day held as a day number (`AllowanceDay`) | **Verified. 7 rules proved**; no reset command, no cron | 5.2 s |
| 9 | The same with the day as its date text | **Not verified**: the prover does not order text | |
| 9 | Today's rolling 24 hours, the times held as a list (`AllowanceRolling`) | All 6 rules **checked**, not proved; six stories pass | 14.7 s |
| 10 | Members as their own instances, three decisions across the organization, the member and the sender's own record (`Access`) | **Verified. 19 rules proved, 2 checked**; three stories pass | 88 s for two passes |
| 11 | `Prove.decision` and the lifecycle's report alone, on the second round's 27-rule model | **Proved**, the 27 between them | 13.4 s, 2.6 s, 1.8 s |
| 12 | One decision across two aggregates on the domain's Durable Object host, in local workerd | Recorded on both or refused with neither changed; 4 requests between objects an accepted act, 3 a refused one | about 110 ms an act |

## Trial 7. The review as it would be hosted

The second round's model kept four of the app's fields, one level of undo and no label, and its confirm compared
one step: the step the sender's screen named against the import's last. That leaves out an ordering the brief's
answer "Refuse, show, confirm again" is about: another person's act lands before the screen's own waiting act, the
import's last change becomes the screen's own act, and the confirm that names it is taken with the other act never
shown. It also left a group act's rows under one step, so a confirm naming that step was taken with the group half
sent. This trial writes the shape the brief recommends with what those need:

- **The confirm names two changes and the screen's id.** `seen` is the last change the screen received from the
  server; the import keeps the run of changes one screen made since anyone else's last change (`runScreen`,
  `runFrom`), and takes the confirm only when `seen` is the last change, or the run since `seen` is this screen's
  own. `planAt` is the change the handler built the plan at; the import refuses any other with `PlanBehind`.
- **A group act marks the import** (`BeginGroup`, `EndGroup`); no confirm is taken while it is marked.
- **An act that would leave its row as it is records nothing**: `decide` returns no events, and the receipt says so.
- **An act names the import's matching its accepts were made on** (`acceptedOn`, one number for the whole decision).
  The import counts its matches and keeps each field's last match; `acceptInForce` says, for any reader, whether a
  stored accept still holds.
- **The row keeps the decision under the current one in full, and the step that one replaced.** A deeper undo names
  the decision to keep under the one it puts back; the row refuses it with `HistoryBehind` unless its step is the one
  replaced.
- **The app's fifteen fields**, the act's label, the act's row on the import's event, and Remove as today (an open
  import with no item in force and every confirm taken back).

### What un-proves it

Written first with a union wherever a value can be "none yet" (the last change, the run, the group, the decision
under, the step it replaced, the change an act saw) and with every field's accept carried and compared one by one,
the same design did not verify. The prover tries each member of a union in a state or a command as its own path, and
takes both sides of every `&&`, `||` and `?:` whose condition it cannot settle (`Symbolic.ts`, `case "Union"`;
`Interpreter.ts`, `LogicalExpression` and `ConditionalExpression`; `Value.ts`, `branch`), so both decisions passed
4,096 paths, and an aggregate's rules are proved only when every decision that reads it fits. Written with the empty
text for "none yet" and one number for the accepts' matching, every rule but the relation is proved. The two causes
were not run apart. The union shape's values, an excerpt of its `Seen.value.ts`:

```ts
// What an act's sender had seen, said by identity and never by a count, and what a decision accepted, field by
// field, with the matching each accept was made on. The fields are the app's fifteen.
import * as S from "effect/Schema"

// The step of a change: the id the screen gives one act at the press, or Nothing before any change.
export const Saw = S.Union([S.TaggedStruct("Nothing", {}), S.TaggedStruct("Step", { step: S.String })])
export type Saw = typeof Saw.Type

/** Two names of a change are the same change. */
export const sameSaw = (a: Saw, b: Saw): boolean =>
  a._tag === "Nothing" ? b._tag === "Nothing" : b._tag === "Step" && a.step === b.step

```

```ts
// What a decision accepts: for each field, the matching the accepted proposal was made on, or -1 when the decision
// accepts nothing for that field. Every accept of a decision is here, not in its text.
export const Accepted = Matching
export type Accepted = typeof Accepted.Type

export const acceptsNothing: Accepted = {
  sku: -1,
  name: -1,
  description: -1,
  category: -1,
  uom: -1,
  unitCost: -1,
  quantityOnHand: -1,
  reorderPoint: -1,
  isActive: -1,
  lotTracked: -1,
  tags: -1,
  firstReceivedOn: -1,
  discontinuedOn: -1,
  dimensions: -1,
  vendors: -1,
}

/** Every accept of a decision is on its field's matching now. */
export const acceptsOn = (a: Accepted, m: Matching): boolean =>
  (a.sku === -1 || a.sku === m.sku) &&
  (a.name === -1 || a.name === m.name) &&
  (a.description === -1 || a.description === m.description) &&
  (a.category === -1 || a.category === m.category) &&
  (a.uom === -1 || a.uom === m.uom) &&
  (a.unitCost === -1 || a.unitCost === m.unitCost) &&
  (a.quantityOnHand === -1 || a.quantityOnHand === m.quantityOnHand) &&
  (a.reorderPoint === -1 || a.reorderPoint === m.reorderPoint) &&
  (a.isActive === -1 || a.isActive === m.isActive) &&
  (a.lotTracked === -1 || a.lotTracked === m.lotTracked) &&
  (a.tags === -1 || a.tags === m.tags) &&
  (a.firstReceivedOn === -1 || a.firstReceivedOn === m.firstReceivedOn) &&
  (a.discontinuedOn === -1 || a.discontinuedOn === m.discontinuedOn) &&
  (a.dimensions === -1 || a.dimensions === m.dimensions) &&
  (a.vendors === -1 || a.vendors === m.vendors)
```

and its lifecycle's two unions, an excerpt of its `ImportLife.aggregate.ts`:

```ts
// The changes since the last change made from another screen: whose screen made them, and the change before them.
export const Tip = S.Union([
  S.TaggedStruct("Quiet", {}),
  S.TaggedStruct("Run", { screen: S.String, from: Saw }),
])
export type Tip = typeof Tip.Type

// A group act being sent row by row: its step and the screen that sent it.
export const Group = S.Union([
  S.TaggedStruct("NoGroup", {}),
  S.TaggedStruct("Sending", { step: S.String, screen: S.String, by: S.String }),
])

```

Its report (`Verify.model`, 716 s), first 40 lines:

```text
NotVerified

Review: 48 outcomes, 2 decisions

Checked: in every sequence of up to 2 commands through ReviewApi, with each event delivered twice, each reaction also run behind the others that wait
100,000 sequences, 85,511 states
  ✓ ImportLife.OutcomesAddUpToTheRows
  ✓ ImportLife.NoCountIsNegative
  ✓ ImportLife.NothingIsWrittenBeforeConfirm
  ✓ ImportLife.AConfirmOfAClosedImportWritesNothing
  ✓ ImportLife.AConfirmIsOfWhatItsScreenHadReceived
  ✓ ImportLife.NoConfirmWhileAGroupIsSent
  ✓ ImportLife.AGroupIsEndedOnlyByItsSender
  ✓ ImportLife.OnlyAnImportedFileIsTakenBack
  ✓ ImportLife.ATakeBackKeepsWhatWasChanged
  ✓ ImportLife.ASuggestionWritesNothing
  ✓ ImportLife.AMatchRaisesOnlyItsOwnField
  ✓ ImportLife.OnlyAnOpenImportIsReviewed
  ✓ ImportLife.AnImportIsOpenedAgainOnlyByReopen
  ✓ ImportLife.ARemovedImportStaysRemoved
  ✓ ImportLife.OnlyAnImportWithNothingInForceIsRemoved
  ✓ ImportLife.AnImportNeverChangesOrganization
  ✓ ImportLife.OnlyItsOwnOrganizationChangesAnImport
  ✓ ImportLife.AViewerChangesNothing
  ✓ RowUnit.NobodyClearsAnotherPersonsDecision
  ✓ RowUnit.ARowIsUndecidedOnlyWhenNothingWasUnder
  ✓ RowUnit.ARowNeverChangesImportOrOrganization
  ✓ RowUnit.OnlyItsOwnOrganizationChangesARow
  ✓ RowUnit.AViewerChangesNothing
  ✓ DecideRow.ARowIsDecidedOnlyOnAnOpenImport
  ✓ DecideRow.ADecisionIsReplacedOnlyByAnActThatSawIt
  ✓ DecideRow.EveryAcceptIsMadeOnTheMatchingItsSenderSaw
  ✓ DecideRow.AnActThatChangesNothingRecordsNothing
  ✓ DecideRow.TheActIsRecordedAndCounted
  ✓ Review.ARowBelongsToItsImportsOrganization
      not proved for ImportLife.MatchColumn: ImportLife.MatchColumn has more than 4096 paths

Not looked at: no sequence reached it
  ? UndoRowStep.AnUndoTakesBackOnlyItsSendersOwnStep
  ? UndoRowStep.AnUndoPutsBackWhatWasThere
```

`Prove.decision` on its two decisions, the first lines of each report:

```text
NotProved
elapsed 72623 ms
schema Unknown; accepted true; paths 4097
Unknown  invariant  ImportLife.OutcomesAddUpToTheRows
```

```text
NotProved
elapsed 83253 ms
schema Unknown; accepted true; paths 4097
Unknown  invariant  ImportLife.OutcomesAddUpToTheRows
```

### The hosted shape's sources

`Seen.value.ts`:

```ts
// What an act's sender had seen, said by identity, and the matching an act's accepts were made on. A step is the id
// the screen gives one act at the press, never empty; the empty text stands for "no change yet", so that no field of a
// state or a command is a union the prover must try each way. The import counts every match of a column (its
// matching) and keeps, for each of the app's fifteen fields, the matching at which that field was last matched, as
// today's column choice keeps the revision that first has it (`MappingChoice.at`).
import * as S from "effect/Schema"

// The id of one act: never empty.
export const Step = S.String.check(S.isMinLength(1))
// A change named by its step, or "" for none.
export const Seen = S.String

// The fields a column can be matched to: the app's fifteen.
export const Field = S.Literals([
  "sku",
  "name",
  "description",
  "category",
  "uom",
  "unitCost",
  "quantityOnHand",
  "reorderPoint",
  "isActive",
  "lotTracked",
  "tags",
  "firstReceivedOn",
  "discontinuedOn",
  "dimensions",
  "vendors",
])
export type Field = typeof Field.Type

// For each field, the import's matching when that field's column was last matched (0: never matched again).
export const MatchedAt = S.Struct({
  sku: S.Int,
  name: S.Int,
  description: S.Int,
  category: S.Int,
  uom: S.Int,
  unitCost: S.Int,
  quantityOnHand: S.Int,
  reorderPoint: S.Int,
  isActive: S.Int,
  lotTracked: S.Int,
  tags: S.Int,
  firstReceivedOn: S.Int,
  discontinuedOn: S.Int,
  dimensions: S.Int,
  vendors: S.Int,
})
export type MatchedAt = typeof MatchedAt.Type

export const neverMatched: MatchedAt = {
  sku: 0,
  name: 0,
  description: 0,
  category: 0,
  uom: 0,
  unitCost: 0,
  quantityOnHand: 0,
  reorderPoint: 0,
  isActive: 0,
  lotTracked: 0,
  tags: 0,
  firstReceivedOn: 0,
  discontinuedOn: 0,
  dimensions: 0,
  vendors: 0,
}

/** Each field's last match after a field's column was matched again at matching `at`. */
export const markMatched = (m: MatchedAt, field: Field, at: number): MatchedAt =>
  field === "sku"
    ? { ...m, sku: at }
    : field === "name"
      ? { ...m, name: at }
      : field === "description"
        ? { ...m, description: at }
        : field === "category"
          ? { ...m, category: at }
          : field === "uom"
            ? { ...m, uom: at }
            : field === "unitCost"
              ? { ...m, unitCost: at }
              : field === "quantityOnHand"
                ? { ...m, quantityOnHand: at }
                : field === "reorderPoint"
                  ? { ...m, reorderPoint: at }
                  : field === "isActive"
                    ? { ...m, isActive: at }
                    : field === "lotTracked"
                      ? { ...m, lotTracked: at }
                      : field === "tags"
                        ? { ...m, tags: at }
                        : field === "firstReceivedOn"
                          ? { ...m, firstReceivedOn: at }
                          : field === "discontinuedOn"
                            ? { ...m, discontinuedOn: at }
                            : field === "dimensions"
                              ? { ...m, dimensions: at }
                              : { ...m, vendors: at }

/** Every field's last match is the same in both. */
export const sameMatchedAt = (a: MatchedAt, b: MatchedAt): boolean =>
  a.sku === b.sku &&
  a.name === b.name &&
  a.description === b.description &&
  a.category === b.category &&
  a.uom === b.uom &&
  a.unitCost === b.unitCost &&
  a.quantityOnHand === b.quantityOnHand &&
  a.reorderPoint === b.reorderPoint &&
  a.isActive === b.isActive &&
  a.lotTracked === b.lotTracked &&
  a.tags === b.tags &&
  a.firstReceivedOn === b.firstReceivedOn &&
  a.discontinuedOn === b.discontinuedOn &&
  a.dimensions === b.dimensions &&
  a.vendors === b.vendors

/** The matching at which a field was last matched. */
export const lastMatchOf = (m: MatchedAt, field: Field): number =>
  field === "sku"
    ? m.sku
    : field === "name"
      ? m.name
      : field === "description"
        ? m.description
        : field === "category"
          ? m.category
          : field === "uom"
            ? m.uom
            : field === "unitCost"
              ? m.unitCost
              : field === "quantityOnHand"
                ? m.quantityOnHand
                : field === "reorderPoint"
                  ? m.reorderPoint
                  : field === "isActive"
                    ? m.isActive
                    : field === "lotTracked"
                      ? m.lotTracked
                      : field === "tags"
                        ? m.tags
                        : field === "firstReceivedOn"
                          ? m.firstReceivedOn
                          : field === "discontinuedOn"
                            ? m.discontinuedOn
                            : field === "dimensions"
                              ? m.dimensions
                              : m.vendors

/**
 * Whether an accept of `field`, recorded with a decision made at matching `acceptedOn`, is in force: its field was
 * not matched again after it. Every reader (the screen, `review` at the confirm, the lists) asks this; no rule does.
 */
export const acceptInForce = (matchedAt: MatchedAt, field: Field, acceptedOn: number): boolean =>
  acceptedOn >= 0 && acceptedOn >= lastMatchOf(matchedAt, field)
```

`ImportLife.aggregate.ts`:

```ts
// One import's lifecycle as its own instance, with no list in its state: staged, matched, confirmed, taken back,
// opened again, removed. It holds the count of matches and each field's last match, the step of the last change, the
// run of changes one screen made since anyone else's last change, and the group act being sent, if any. A confirm
// names the last change its screen received and the change its plan was built at; it is taken only when every change
// after the first came from the same screen, the second is the last change, and no group act is being sent. Rows are
// not here.
import * as Domain from "@alchemy.run/domain"
import * as Effect from "effect/Effect"
import * as S from "effect/Schema"
import { CurrentActor, Session } from "../test/Actor.context.ts"
import { Field, MatchedAt, Seen, Step, markMatched, neverMatched, sameMatchedAt } from "./Seen.value.ts"

export const ImportId = S.String.pipe(S.brand("ImportId"))
const Count = S.Int.check(S.isGreaterThanOrEqualTo(0))

export class ImportStaged extends Domain.Event("ImportStaged", { organizationId: S.String, rows: Count }) {}
export class ColumnMatched extends Domain.Event("ColumnMatched", { field: Field, step: Step, screen: Step }) {}
// One act of the review counted on its import, recorded by the decision that also records the row. It names the row
// and the act's label, so one projection given the import's events can write every row in order.
export class ActCounted extends Domain.Event("ActCounted", { step: Step, screen: Step, row: S.String, label: S.String }) {}
export class GroupBegun extends Domain.Event("GroupBegun", { step: Step, by: S.String }) {}
export class GroupEnded extends Domain.Event("GroupEnded", {}) {}
export class SuggestionRecorded extends Domain.Event("SuggestionRecorded", {}) {}
export class ImportConfirmed extends Domain.Event("ImportConfirmed", { created: Count, notImported: Count }) {}
export class ImportTakenBack extends Domain.Event("ImportTakenBack", { removed: Count, kept: Count }) {}
export class ImportReopened extends Domain.Event("ImportReopened", {}) {}
export class ImportRemoved extends Domain.Event("ImportRemoved", {}) {}

export class NotPermitted extends Domain.Rejection("NotPermitted", {}) {}
export class AlreadyStaged extends Domain.Rejection("AlreadyStaged", {}) {}
export class NotOpen extends Domain.Rejection("NotOpen", {}) {}
// A change the confirm's screen had not received came after the one it names: the last change, for the screen.
export class ReviewMovedOn extends Domain.Rejection("ReviewMovedOn", { last: Seen }) {}
// The plan was built at a change that is no longer the last: the last change, for the handler to build it again.
export class PlanBehind extends Domain.Rejection("PlanBehind", { last: Seen }) {}
// A group act is being sent: its step.
export class GroupUnderWay extends Domain.Rejection("GroupUnderWay", { step: Step }) {}
export class NoGroupUnderWay extends Domain.Rejection("NoGroupUnderWay", {}) {}
export class CountsDoNotAddUp extends Domain.Rejection("CountsDoNotAddUp", {}) {}
export class NotImported extends Domain.Rejection("NotImported", {}) {}
export class MoreKeptThanCreated extends Domain.Rejection("MoreKeptThanCreated", {}) {}
export class NotClosed extends Domain.Rejection("NotClosed", {}) {}
// Items it created are in force, or a confirm of it was not taken back: it stays with them.
export class HasItemsInForce extends Domain.Rejection("HasItemsInForce", {}) {}

export class StageImport extends Domain.Command("StageImport", {
  middleware: [Session],
  input: { importId: ImportId, rows: Count },
  events: [ImportStaged],
  rejects: [NotPermitted, AlreadyStaged],
}) {}
export class MatchColumn extends Domain.Command("MatchColumn", {
  middleware: [Session],
  input: { importId: ImportId, field: Field, step: Step, screen: Step },
  events: [ColumnMatched],
  rejects: [NotPermitted, NotOpen],
}) {}
export class BeginGroup extends Domain.Command("BeginGroup", {
  middleware: [Session],
  input: { importId: ImportId, step: Step },
  events: [GroupBegun],
  rejects: [NotPermitted, NotOpen, GroupUnderWay],
}) {}
export class EndGroup extends Domain.Command("EndGroup", {
  middleware: [Session],
  input: { importId: ImportId, step: Step },
  events: [GroupEnded],
  rejects: [NotPermitted, NotOpen, NoGroupUnderWay],
}) {}
export class RecordSuggestion extends Domain.Command("RecordSuggestion", {
  middleware: [Session],
  input: { importId: ImportId },
  events: [SuggestionRecorded],
  rejects: [NotPermitted, NotOpen],
}) {}
export class ConfirmImport extends Domain.Command("ConfirmImport", {
  middleware: [Session],
  // `seen` is the last change the screen received from the server ("" for none); `screen` is the screen's own id;
  // `planAt` is the change the handler built the plan at, from rows the projection had written up to it.
  input: { importId: ImportId, screen: Step, seen: Seen, planAt: Seen, created: Count, notImported: Count },
  events: [ImportConfirmed],
  rejects: [NotPermitted, NotOpen, GroupUnderWay, ReviewMovedOn, PlanBehind, CountsDoNotAddUp],
}) {}
export class TakeBackImport extends Domain.Command("TakeBackImport", {
  middleware: [Session],
  input: { importId: ImportId, kept: Count },
  events: [ImportTakenBack],
  rejects: [NotPermitted, NotImported, MoreKeptThanCreated],
}) {}
export class ReopenImport extends Domain.Command("ReopenImport", {
  middleware: [Session],
  input: { importId: ImportId },
  events: [ImportReopened],
  rejects: [NotPermitted, NotClosed],
}) {}
export class RemoveImport extends Domain.Command("RemoveImport", {
  middleware: [Session],
  input: { importId: ImportId },
  events: [ImportRemoved],
  rejects: [NotPermitted, NotOpen, HasItemsInForce],
}) {}

export const ImportState = S.Union([
  S.TaggedStruct("Unstaged", {}),
  S.TaggedStruct("Open", {
    organizationId: S.String,
    rows: S.Int,
    confirms: S.Int,
    matching: S.Int,
    matchedAt: MatchedAt,
    // The last change ("" before any), and the run of changes one screen made since anyone else's last change: that
    // screen ("" before any change) and the change before the run.
    last: Seen,
    runScreen: S.String,
    runFrom: Seen,
    // The group act being sent ("" when none) and who began it.
    groupStep: Seen,
    groupBy: S.String,
    suggestions: S.Int,
    // Items its confirms created that are still in force, and its confirms not taken back.
    inForce: S.Int,
    standing: S.Int,
  }),
  S.TaggedStruct("Imported", {
    organizationId: S.String,
    rows: S.Int,
    confirms: S.Int,
    matching: S.Int,
    matchedAt: MatchedAt,
    last: Seen,
    created: S.Int,
    notImported: S.Int,
    inForce: S.Int,
    standing: S.Int,
  }),
  S.TaggedStruct("TakenBack", {
    organizationId: S.String,
    rows: S.Int,
    confirms: S.Int,
    matching: S.Int,
    matchedAt: MatchedAt,
    last: Seen,
    removed: S.Int,
    kept: S.Int,
    notImported: S.Int,
    inForce: S.Int,
    standing: S.Int,
  }),
  S.TaggedStruct("Removed", { organizationId: S.String }),
])

/** The import after a change from a screen: that change is the last, and the screen's run goes on or starts. */
const changed = <A extends { last: string; runScreen: string; runFrom: string }>(s: A, step: string, screen: string): A =>
  s.runScreen === screen ? { ...s, last: step } : { ...s, last: step, runScreen: screen, runFrom: s.last }

export class ImportLife extends Domain.Aggregate("ImportLife", {
  id: ImportId,
  state: ImportState,
  initial: { _tag: "Unstaged" },
  invariants: {
    // An import's outcomes add up to the rows in the file: of the counts its commands state.
    OutcomesAddUpToTheRows: (s) =>
      s._tag === "Imported"
        ? s.created + s.notImported === s.rows
        : s._tag === "TakenBack"
          ? s.removed + s.kept + s.notImported === s.rows
          : true,
    NoCountIsNegative: (s) =>
      s._tag === "Imported"
        ? s.created >= 0 && s.notImported >= 0
        : s._tag === "TakenBack"
          ? s.removed >= 0 && s.kept >= 0 && s.notImported >= 0
          : true,
  },
  transitions: {
    // The status becomes Imported only by a confirm.
    NothingIsWrittenBeforeConfirm: ({ before, after, command }) =>
      after._tag !== "Imported" || before._tag === "Imported" || command._tag === "ConfirmImport",
    // A confirm of an import that is not open leaves its status.
    AConfirmOfAClosedImportWritesNothing: ({ before, after, command }) =>
      command._tag !== "ConfirmImport" || before._tag === "Open" || after._tag === before._tag,
    // A confirm is taken only when every change after the one its screen names was made from that same screen.
    AConfirmIsOfWhatItsScreenHadReceived: ({ before, after, command }) =>
      command._tag !== "ConfirmImport" ||
      before._tag !== "Open" ||
      after._tag !== "Imported" ||
      command.seen === before.last ||
      (before.runScreen === command.screen && command.seen === before.runFrom),
    // What a confirm writes was worked out at the import's last change.
    APlanIsOfTheLastChange: ({ before, after, command }) =>
      command._tag !== "ConfirmImport" || before._tag !== "Open" || after._tag !== "Imported" || command.planAt === before.last,
    // No confirm is taken while a group act is being sent.
    NoConfirmWhileAGroupIsSent: ({ before, after, command }) =>
      command._tag !== "ConfirmImport" || before._tag !== "Open" || after._tag !== "Imported" || before.groupStep === "",
    // A group act is ended only by the person who began it.
    AGroupIsEndedOnlyByItsSender: Effect.fn(function* ({ before, command }) {
      if (command._tag !== "EndGroup" || before._tag !== "Open") return true
      return (yield* CurrentActor).memberId === before.groupBy
    }),
    // Only an imported file is taken back, and the kept count recorded is the one the take-back states.
    OnlyAnImportedFileIsTakenBack: ({ before, after }) =>
      after._tag !== "TakenBack" || before._tag === "Imported" || before._tag === "TakenBack",
    ATakeBackKeepsWhatWasChanged: ({ before, after, command }) =>
      command._tag !== "TakeBackImport" ||
      before._tag !== "Imported" ||
      after._tag !== "TakenBack" ||
      after.kept === command.kept,
    // A model proposes and never writes: a suggestion changes neither the matching, the last change nor the confirms.
    ASuggestionWritesNothing: ({ before, after, command }) =>
      command._tag !== "RecordSuggestion" ||
      before._tag !== "Open" ||
      (after._tag === "Open" &&
        after.matching === before.matching &&
        after.last === before.last &&
        after.confirms === before.confirms),
    // A match raises the import's matching by one and marks its own field, and no other, as matched there.
    AMatchMarksOnlyItsOwnField: ({ before, after, command }) =>
      command._tag !== "MatchColumn" ||
      before._tag !== "Open" ||
      (after._tag === "Open" &&
        after.matching === before.matching + 1 &&
        sameMatchedAt(after.matchedAt, markMatched(before.matchedAt, command.field, before.matching + 1))),
    // While an import is not open, nothing about its review changes: no match, no act, no suggestion.
    OnlyAnOpenImportIsReviewed: ({ before, after }) =>
      before._tag === "Open" ||
      before._tag === "Unstaged" ||
      before._tag === "Removed" ||
      after._tag === "Removed" ||
      after._tag === "Unstaged" ||
      (after.matching === before.matching && after.last === before.last),
    // An import that was confirmed or taken back is opened again only by Reopen, and keeps its count of confirms.
    AnImportIsOpenedAgainOnlyByReopen: ({ before, after, command }) =>
      after._tag !== "Open" ||
      before._tag === "Open" ||
      before._tag === "Unstaged" ||
      (command._tag === "ReopenImport" &&
        (before._tag === "Imported" || before._tag === "TakenBack") &&
        after.confirms === before.confirms),
    // A removed import stays removed.
    ARemovedImportStaysRemoved: ({ before, after }) => before._tag !== "Removed" || after._tag === "Removed",
    // As today: an import is removed only while it is open, no item it created is in force, and every confirm of it
    // was taken back.
    OnlyAnImportWithNothingInForceIsRemoved: ({ before, after }) =>
      after._tag !== "Removed" ||
      before._tag === "Removed" ||
      (before._tag === "Open" && before.inForce === 0 && before.standing === 0),
    // Every row belongs to one organization.
    AnImportNeverChangesOrganization: ({ before, after }) =>
      before._tag === "Unstaged" || after._tag === "Unstaged" || before.organizationId === after.organizationId,
    OnlyItsOwnOrganizationChangesAnImport: Effect.fn(function* ({ before }) {
      if (before._tag === "Unstaged") return true
      return (yield* CurrentActor).organizationId === before.organizationId
    }),
    AViewerChangesNothing: Effect.fn(function* () {
      return (yield* CurrentActor).role !== "viewer"
    }),
  },
  commands: [
    StageImport,
    MatchColumn,
    BeginGroup,
    EndGroup,
    RecordSuggestion,
    ConfirmImport,
    TakeBackImport,
    ReopenImport,
    RemoveImport,
  ],
  events: [ActCounted],
  keyOf: (cmd) => cmd.importId,
  decide: {
    StageImport: Effect.fn(function* (s, cmd) {
      const actor = yield* CurrentActor
      if (actor.role === "viewer") return yield* new NotPermitted({})
      if (s._tag !== "Unstaged") return yield* new AlreadyStaged({})
      return [new ImportStaged({ organizationId: actor.organizationId, rows: cmd.rows })]
    }),
    MatchColumn: Effect.fn(function* (s, cmd) {
      const actor = yield* CurrentActor
      if (s._tag !== "Open") return yield* new NotOpen({})
      if (actor.organizationId !== s.organizationId || actor.role === "viewer") return yield* new NotPermitted({})
      return [new ColumnMatched({ field: cmd.field, step: cmd.step, screen: cmd.screen })]
    }),
    BeginGroup: Effect.fn(function* (s, cmd) {
      const actor = yield* CurrentActor
      if (s._tag !== "Open") return yield* new NotOpen({})
      if (actor.organizationId !== s.organizationId || actor.role === "viewer") return yield* new NotPermitted({})
      if (s.groupStep !== "") return yield* new GroupUnderWay({ step: s.groupStep })
      return [new GroupBegun({ step: cmd.step, by: actor.memberId })]
    }),
    EndGroup: Effect.fn(function* (s, cmd) {
      const actor = yield* CurrentActor
      if (s._tag !== "Open") return yield* new NotOpen({})
      if (actor.organizationId !== s.organizationId || actor.role === "viewer") return yield* new NotPermitted({})
      if (s.groupStep !== cmd.step) return yield* new NoGroupUnderWay({})
      if (s.groupBy !== actor.memberId) return yield* new NotPermitted({})
      return [new GroupEnded({})]
    }),
    RecordSuggestion: Effect.fn(function* (s) {
      const actor = yield* CurrentActor
      if (s._tag !== "Open") return yield* new NotOpen({})
      if (actor.organizationId !== s.organizationId || actor.role === "viewer") return yield* new NotPermitted({})
      return [new SuggestionRecorded({})]
    }),
    ConfirmImport: Effect.fn(function* (s, cmd) {
      const actor = yield* CurrentActor
      if (s._tag !== "Open") return yield* new NotOpen({})
      if (actor.organizationId !== s.organizationId || actor.role === "viewer") return yield* new NotPermitted({})
      if (s.groupStep !== "") return yield* new GroupUnderWay({ step: s.groupStep })
      if (cmd.seen !== s.last && (s.runScreen !== cmd.screen || cmd.seen !== s.runFrom)) {
        return yield* new ReviewMovedOn({ last: s.last })
      }
      if (cmd.planAt !== s.last) return yield* new PlanBehind({ last: s.last })
      if (cmd.created + cmd.notImported !== s.rows) return yield* new CountsDoNotAddUp({})
      return [new ImportConfirmed({ created: cmd.created, notImported: cmd.notImported })]
    }),
    TakeBackImport: Effect.fn(function* (s, cmd) {
      const actor = yield* CurrentActor
      if (s._tag !== "Imported") return yield* new NotImported({})
      if (actor.organizationId !== s.organizationId || actor.role === "viewer") return yield* new NotPermitted({})
      if (cmd.kept > s.created) return yield* new MoreKeptThanCreated({})
      return [new ImportTakenBack({ removed: s.created - cmd.kept, kept: cmd.kept })]
    }),
    ReopenImport: Effect.fn(function* (s) {
      const actor = yield* CurrentActor
      if (s._tag !== "Imported" && s._tag !== "TakenBack") return yield* new NotClosed({})
      if (actor.organizationId !== s.organizationId || actor.role === "viewer") return yield* new NotPermitted({})
      return [new ImportReopened({})]
    }),
    RemoveImport: Effect.fn(function* (s) {
      const actor = yield* CurrentActor
      if (s._tag !== "Open") return yield* new NotOpen({})
      if (actor.organizationId !== s.organizationId || actor.role === "viewer") return yield* new NotPermitted({})
      if (s.inForce !== 0 || s.standing !== 0) return yield* new HasItemsInForce({})
      return [new ImportRemoved({})]
    }),
  },
  evolve: {
    ImportStaged: (_, e) => ({
      _tag: "Open" as const,
      organizationId: e.organizationId,
      rows: e.rows,
      confirms: 0,
      matching: 0,
      matchedAt: neverMatched,
      last: "",
      runScreen: "",
      runFrom: "",
      groupStep: "",
      groupBy: "",
      suggestions: 0,
      inForce: 0,
      standing: 0,
    }),
    ColumnMatched: (s, e) =>
      s._tag === "Open"
        ? {
            ...changed(s, e.step, e.screen),
            matching: s.matching + 1,
            matchedAt: markMatched(s.matchedAt, e.field, s.matching + 1),
          }
        : s,
    ActCounted: (s, e) => (s._tag === "Open" ? changed(s, e.step, e.screen) : s),
    GroupBegun: (s, e) => (s._tag === "Open" ? { ...s, groupStep: e.step, groupBy: e.by } : s),
    GroupEnded: (s) => (s._tag === "Open" ? { ...s, groupStep: "", groupBy: "" } : s),
    SuggestionRecorded: (s) => (s._tag === "Open" ? { ...s, suggestions: s.suggestions + 1 } : s),
    ImportConfirmed: (s, e) =>
      s._tag === "Open"
        ? {
            _tag: "Imported" as const,
            organizationId: s.organizationId,
            rows: s.rows,
            confirms: s.confirms + 1,
            matching: s.matching,
            matchedAt: s.matchedAt,
            last: s.last,
            created: e.created,
            notImported: e.notImported,
            inForce: s.inForce + e.created,
            standing: s.standing + 1,
          }
        : s,
    ImportTakenBack: (s, e) =>
      s._tag === "Imported"
        ? {
            _tag: "TakenBack" as const,
            organizationId: s.organizationId,
            rows: s.rows,
            confirms: s.confirms,
            matching: s.matching,
            matchedAt: s.matchedAt,
            last: s.last,
            removed: e.removed,
            kept: e.kept,
            notImported: s.notImported,
            inForce: s.inForce - e.removed,
            standing: s.standing - 1,
          }
        : s,
    ImportReopened: (s) =>
      s._tag === "Imported" || s._tag === "TakenBack"
        ? {
            _tag: "Open" as const,
            organizationId: s.organizationId,
            rows: s.rows,
            confirms: s.confirms,
            matching: s.matching,
            matchedAt: s.matchedAt,
            last: s.last,
            runScreen: "",
            runFrom: "",
            groupStep: "",
            groupBy: "",
            suggestions: 0,
            inForce: s.inForce,
            standing: s.standing,
          }
        : s,
    ImportRemoved: (s) => (s._tag === "Open" ? { _tag: "Removed" as const, organizationId: s.organizationId } : s),
  },
}) {}
```

`RowUnit.aggregate.ts`:

```ts
// One row of one import's review as its own instance. The row decides nothing alone: `Deciding` and `Undoing` record
// its events. It holds the decision (its text, the import's matching its accepts were made on, who made it, in which
// step, its label), the decision under it in full ("" as its step when there is none), and the step that one
// replaced, so an undo at any depth is checked by step: the level under is put back exactly, and the level below it
// must be the step it replaced.
import * as Domain from "@alchemy.run/domain"
import * as Effect from "effect/Effect"
import * as S from "effect/Schema"
import { CurrentActor } from "../test/Actor.context.ts"
import { Seen, Step } from "./Seen.value.ts"

// A decision as a row holds it under another: its step is "" when there is none.
export const Under = S.Struct({
  by: S.String,
  step: Seen,
  flags: S.String,
  acceptedOn: S.Int,
  label: S.String,
  replaced: Seen,
})
export type Under = typeof Under.Type
export const nothingUnder: Under = { by: "", step: "", flags: "", acceptedOn: -1, label: "", replaced: "" }

export class RowDecided extends Domain.Event("RowDecided", {
  importId: S.String,
  organizationId: S.String,
  by: S.String,
  step: Step,
  flags: S.String,
  acceptedOn: S.Int,
  label: S.String,
}) {}
// The current decision is taken back; `next` goes under the one put back, read from the row's history and checked
// by its step.
export class StepUndone extends Domain.Event("StepUndone", { next: Under }) {}

export const RowState = S.Union([
  S.TaggedStruct("Untouched", {}),
  S.TaggedStruct("Undecided", { importId: S.String, organizationId: S.String }),
  S.TaggedStruct("Decided", {
    importId: S.String,
    organizationId: S.String,
    by: S.String,
    step: Step,
    flags: S.String,
    acceptedOn: S.Int,
    label: S.String,
    under: Under,
  }),
])

export class RowUnit extends Domain.Aggregate("RowUnit", {
  id: S.String,
  state: RowState,
  initial: { _tag: "Untouched" },
  transitions: {
    // No command clears a decision its sender did not make.
    NobodyClearsAnotherPersonsDecision: Effect.fn(function* ({ before, after }) {
      if (before._tag !== "Decided" || after._tag === "Decided") return true
      return (yield* CurrentActor).memberId === before.by
    }),
    // A row has no decision again only when nothing was under the one taken back.
    ARowIsUndecidedOnlyWhenNothingWasUnder: ({ before, after }) =>
      before._tag !== "Decided" || after._tag !== "Undecided" || before.under.step === "",
    ARowNeverChangesImportOrOrganization: ({ before, after }) =>
      before._tag === "Untouched" ||
      after._tag === "Untouched" ||
      (before.organizationId === after.organizationId && before.importId === after.importId),
    OnlyItsOwnOrganizationChangesARow: Effect.fn(function* ({ before }) {
      if (before._tag === "Untouched") return true
      return (yield* CurrentActor).organizationId === before.organizationId
    }),
    AViewerChangesNothing: Effect.fn(function* () {
      return (yield* CurrentActor).role !== "viewer"
    }),
  },
  events: [RowDecided, StepUndone],
  evolve: {
    RowDecided: (s, e) => ({
      _tag: "Decided" as const,
      importId: e.importId,
      organizationId: e.organizationId,
      by: e.by,
      step: e.step,
      flags: e.flags,
      acceptedOn: e.acceptedOn,
      label: e.label,
      under:
        s._tag === "Decided"
          ? { by: s.by, step: s.step, flags: s.flags, acceptedOn: s.acceptedOn, label: s.label, replaced: s.under.step }
          : nothingUnder,
    }),
    StepUndone: (s, e) =>
      s._tag !== "Decided"
        ? s
        : s.under.step !== ""
          ? {
              _tag: "Decided" as const,
              importId: s.importId,
              organizationId: s.organizationId,
              by: s.under.by,
              step: s.under.step,
              flags: s.under.flags,
              acceptedOn: s.under.acceptedOn,
              label: s.under.label,
              under: e.next,
            }
          : { _tag: "Undecided" as const, importId: s.importId, organizationId: s.organizationId },
  },
}) {}

/** The row holds this text, with accepts made on this matching, already. */
export const holdsAlready = (
  row: { readonly flags: string; readonly acceptedOn: number },
  flags: string,
  acceptedOn: number,
): boolean => row.flags === flags && row.acceptedOn === acceptedOn
```

`Review.decision.ts`:

```ts
// One act of the review, decided across the import and the row it names, and recorded on both or on neither.
// The import says whether it is open and what its matching is; the row says what decision it holds. An act that
// would leave the row as it is records nothing, and its receipt has no events: the answer "no change".
import * as Domain from "@alchemy.run/domain"
import * as Effect from "effect/Effect"
import * as S from "effect/Schema"
import { CurrentActor, Session } from "../test/Actor.context.ts"
import { ActCounted, ImportId, ImportLife, NotOpen, NotPermitted } from "./ImportLife.aggregate.ts"
import { RowDecided, RowUnit, StepUndone, Under, holdsAlready } from "./RowUnit.aggregate.ts"
import { Seen, Step } from "./Seen.value.ts"

// The row holds a decision its sender did not see: whose it is and its step, so the screen can say so.
export class DecidedSince extends Domain.Rejection("DecidedSince", { by: S.String, step: Step }) {}
// The decision its sender saw is no longer there, and the row has none.
export class NoLongerThere extends Domain.Rejection("NoLongerThere", {}) {}
export class StepAlreadyUsed extends Domain.Rejection("StepAlreadyUsed", {}) {}
// A column was matched again after the matching the act's accepts were made on: the matching now. The screen sends
// the act again with the accepts whose field was not matched since, and says which were taken back.
export class MatchedSince extends Domain.Rejection("MatchedSince", { matching: S.Int }) {}
export class NotYourStep extends Domain.Rejection("NotYourStep", {}) {}
// The decision named to go under the one put back is not the one that decision replaced.
export class HistoryBehind extends Domain.Rejection("HistoryBehind", {}) {}

export class DecideRow extends Domain.Command("DecideRow", {
  middleware: [Session],
  input: {
    importId: ImportId,
    row: S.String,
    step: Step,
    screen: Step,
    // The step of the decision the sender saw on the row, or "" for none.
    saw: Seen,
    flags: S.String,
    // The import's matching the decision's accepts were made on, or -1 when it accepts nothing.
    acceptedOn: S.Int,
    label: S.String,
  },
  events: [RowDecided, ActCounted],
  rejects: [NotOpen, NotPermitted, DecidedSince, NoLongerThere, StepAlreadyUsed, MatchedSince],
}) {}

export class UndoRowStep extends Domain.Command("UndoRowStep", {
  middleware: [Session],
  // `undo` is the step taken back; `step` is this act's own; `next` goes under the decision put back.
  input: { importId: ImportId, row: S.String, undo: Step, step: Step, screen: Step, next: Under },
  events: [StepUndone, ActCounted],
  rejects: [NotOpen, NotPermitted, NotYourStep, HistoryBehind],
}) {}

export class Deciding extends Domain.Decision(DecideRow, {
  reads: { life: ImportLife, row: RowUnit },
  keyOf: (cmd) => ({ life: cmd.importId, row: `${cmd.importId}/${cmd.row}` }),
  decide: Effect.fn(function* ({ life, row }, cmd) {
    const actor = yield* CurrentActor
    if (life.state._tag !== "Open") return yield* new NotOpen({})
    if (actor.organizationId !== life.state.organizationId || actor.role === "viewer") {
      return yield* new NotPermitted({})
    }
    // A row instance belongs to one import of one organization, for good.
    if (
      row.state._tag !== "Untouched" &&
      (row.state.importId !== cmd.importId || row.state.organizationId !== life.state.organizationId)
    ) {
      return yield* new NotPermitted({})
    }
    if (row.state._tag === "Decided") {
      if (cmd.saw !== row.state.step) return yield* new DecidedSince({ by: row.state.by, step: row.state.step })
      if (cmd.step === row.state.step) return yield* new StepAlreadyUsed({})
    } else if (cmd.saw !== "") {
      return yield* new NoLongerThere({})
    }
    if (cmd.acceptedOn !== -1 && cmd.acceptedOn !== life.state.matching) {
      return yield* new MatchedSince({ matching: life.state.matching })
    }
    // The row holds this decision already: nothing is recorded, and the answer says no change.
    if (row.state._tag === "Decided" && holdsAlready(row.state, cmd.flags, cmd.acceptedOn)) return []
    return [
      row.record(
        new RowDecided({
          importId: cmd.importId,
          organizationId: life.state.organizationId,
          by: actor.memberId,
          step: cmd.step,
          flags: cmd.flags,
          acceptedOn: cmd.acceptedOn,
          label: cmd.label,
        }),
      ),
      life.record(new ActCounted({ step: cmd.step, screen: cmd.screen, row: cmd.row, label: cmd.label })),
    ]
  }),
  transitions: {
    // A row is decided only on an open import.
    ARowIsDecidedOnlyOnAnOpenImport: ({ before }) => before.life._tag === "Open",
    // A decision is replaced only by an act whose sender saw it.
    ADecisionIsReplacedOnlyByAnActThatSawIt: ({ before, command }) =>
      before.row._tag === "Decided" ? command.saw === before.row.step : command.saw === "",
    // An act's accepts are made on the import's matching now; one made on an older matching is not applied.
    AnActsAcceptsAreMadeOnTheMatchingNow: ({ before, command }) =>
      before.life._tag === "Open" && (command.acceptedOn === -1 || command.acceptedOn === before.life.matching),
    // An act that would leave the row's decision as it is records nothing: the row and the import are unchanged.
    AnActThatChangesNothingRecordsNothing: ({ before, after, command }) =>
      before.row._tag !== "Decided" ||
      !holdsAlready(before.row, command.flags, command.acceptedOn) ||
      (after.row._tag === "Decided" &&
        after.row.step === before.row.step &&
        before.life._tag === "Open" &&
        after.life._tag === "Open" &&
        after.life.last === before.life.last),
    // Any other act is recorded as its sender said and is the import's last change.
    TheActIsRecordedAndCounted: ({ before, after, command }) =>
      (before.row._tag === "Decided" && holdsAlready(before.row, command.flags, command.acceptedOn)) ||
      (after.row._tag === "Decided" &&
        after.row.step === command.step &&
        after.row.flags === command.flags &&
        after.row.acceptedOn === command.acceptedOn &&
        after.life._tag === "Open" &&
        after.life.last === command.step),
  },
}) {}

export class Undoing extends Domain.Decision(UndoRowStep, {
  reads: { life: ImportLife, row: RowUnit },
  keyOf: (cmd) => ({ life: cmd.importId, row: `${cmd.importId}/${cmd.row}` }),
  decide: Effect.fn(function* ({ life, row }, cmd) {
    const actor = yield* CurrentActor
    if (life.state._tag !== "Open") return yield* new NotOpen({})
    if (actor.organizationId !== life.state.organizationId || actor.role === "viewer") {
      return yield* new NotPermitted({})
    }
    if (
      row.state._tag !== "Untouched" &&
      (row.state.importId !== cmd.importId || row.state.organizationId !== life.state.organizationId)
    ) {
      return yield* new NotPermitted({})
    }
    if (row.state._tag !== "Decided" || row.state.by !== actor.memberId || row.state.step !== cmd.undo) {
      return yield* new NotYourStep({})
    }
    // What goes under the decision put back must be the decision it replaced, by its step.
    if (row.state.under.step !== "" && cmd.next.step !== row.state.under.replaced) {
      return yield* new HistoryBehind({})
    }
    return [
      row.record(new StepUndone({ next: cmd.next })),
      life.record(new ActCounted({ step: cmd.step, screen: cmd.screen, row: cmd.row, label: "undo" })),
    ]
  }),
  transitions: {
    // An undo is taken only on an open import, for its sender's own step, while that step is the row's decision.
    AnUndoTakesBackOnlyItsSendersOwnStep: Effect.fn(function* ({ before, command }) {
      if (before.life._tag !== "Open" || before.row._tag !== "Decided") return false
      return before.row.step === command.undo && (yield* CurrentActor).memberId === before.row.by
    }),
    // An undo puts back exactly the decision under the one taken back, another person's included.
    AnUndoPutsBackWhatWasThere: ({ before, after }) =>
      before.row._tag !== "Decided" ||
      (before.row.under.step === ""
        ? after.row._tag === "Undecided"
        : after.row._tag === "Decided" &&
          after.row.by === before.row.under.by &&
          after.row.step === before.row.under.step &&
          after.row.flags === before.row.under.flags &&
          after.row.acceptedOn === before.row.under.acceptedOn),
    // Under the decision put back goes the decision it replaced, named by its step: the next undo has it.
    UnderWhatIsPutBackIsWhatItReplaced: ({ before, after }) =>
      before.row._tag !== "Decided" ||
      before.row.under.step === "" ||
      (after.row._tag === "Decided" && after.row.under.step === before.row.under.replaced),
  },
}) {}
```

`Review.model.ts`:

```ts
// The review of one import as a model, in the shape it would be hosted: the lifecycle, the rows, and the two decisions.
import * as Domain from "@alchemy.run/domain"
import { ImportLife } from "./ImportLife.aggregate.ts"
import { Deciding, Undoing } from "./Review.decision.ts"
import { RowUnit } from "./RowUnit.aggregate.ts"

export class Review extends Domain.Model("Review", {
  aggregates: [ImportLife, RowUnit],
  decisions: [Deciding, Undoing],
  relations: {
    // A row that was decided belongs to the organization of its import.
    ARowBelongsToItsImportsOrganization: Domain.Relation({
      over: { life: ImportLife, row: RowUnit },
      holds: ({ life, row }) =>
        row.state._tag === "Untouched" ||
        row.state.importId !== life.id ||
        (life.state._tag !== "Unstaged" && row.state.organizationId === life.state.organizationId),
    }),
  },
}) {}

export class ReviewApi extends Domain.Api("ReviewApi", { model: Review }) {}
```

The model's test (the others write their reports the same way):

```ts
import { Story } from "@alchemy.run/domain/Story"
import * as Verify from "@alchemy.run/domain/Verify"
import * as NodeServices from "@effect/platform-node/NodeServices"
import { it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { writeFileSync } from "node:fs"
import { Review, ReviewApi } from "./Review.model.ts"

it.effect(
  "verify: the review as a model",
  () =>
    Effect.gen(function* () {
      const report = yield* Verify.model(Review, { apis: [ReviewApi], story: Story.make(Review) }).pipe(
        Effect.catch((error) => Effect.succeed({ failed: error })),
      )
      yield* Effect.sync(() =>
        writeFileSync(
          "out/ReviewHosted8.txt",
          "failed" in report
            ? `${report.failed._tag}\n${report.failed.message}`
            : `VERIFIED\n${report.rules.map((rule) => `${rule.standing}  ${rule.name}`).join("\n")}\n\n${Verify.render(report)}`,
        ),
      )
    }).pipe(Effect.provide(NodeServices.layer)),
  1_500_000,
)
```

One decision proved alone, `Deciding.prove.test.ts` (`Undoing.prove.test.ts` is the same with `Undoing`):

```ts
// Proves the decision Deciding alone (no exploration), timed, and writes each rule's verdict and the rendered report.
// decisionReport prints a rule that is not proved instead of failing, so the whole report is kept.
import * as Prove from "@alchemy.run/domain/Prove"
import * as NodeServices from "@effect/platform-node/NodeServices"
import { it } from "@effect/vitest"
import * as Clock from "effect/Clock"
import * as Effect from "effect/Effect"
import { writeFileSync } from "node:fs"
import { Deciding } from "../review8/Review.decision.ts"

const OUT =
  "out/Prove-Hosted8-Deciding.txt"

it.live(
  "prove: the decision Deciding",
  () =>
    Effect.gen(function* () {
      const start = yield* Clock.currentTimeMillis
      const report = yield* Prove.decisionReport(Deciding, {
        source: new URL("../review8/Review.decision.ts", import.meta.url),
      }).pipe(Effect.catch((error) => Effect.succeed({ failed: error })))
      const ms = (yield* Clock.currentTimeMillis) - start
      yield* Effect.sync(() =>
        writeFileSync(
          OUT,
          "failed" in report
            ? `${report.failed._tag}\n${report.failed.message}\nelapsed ${ms} ms\n`
            : [
                Prove.decisionProved(report) ? "PROVED" : "NotProved",
                `elapsed ${ms} ms`,
                `schema ${report.schema._tag}; accepted ${String(report.accepted)}; paths ${report.paths}`,
                ...report.rules.map((rule) => `${rule.verdict._tag}  ${rule.kind}  ${rule.name}`),
                "",
                Prove.renderDecision(report),
              ].join("\n"),
        ),
      )
    }).pipe(Effect.provide(NodeServices.layer)),
  1_500_000,
)
```

### Verify's report on the hosted shape

`Verify.model(Review)`, 82.29 s, whole:

```text
VERIFIED
proved  ImportLife.OutcomesAddUpToTheRows
proved  ImportLife.NoCountIsNegative
proved  ImportLife.NothingIsWrittenBeforeConfirm
proved  ImportLife.AConfirmOfAClosedImportWritesNothing
proved  ImportLife.AConfirmIsOfWhatItsScreenHadReceived
proved  ImportLife.APlanIsOfTheLastChange
proved  ImportLife.NoConfirmWhileAGroupIsSent
proved  ImportLife.AGroupIsEndedOnlyByItsSender
proved  ImportLife.OnlyAnImportedFileIsTakenBack
proved  ImportLife.ATakeBackKeepsWhatWasChanged
proved  ImportLife.ASuggestionWritesNothing
proved  ImportLife.AMatchMarksOnlyItsOwnField
proved  ImportLife.OnlyAnOpenImportIsReviewed
proved  ImportLife.AnImportIsOpenedAgainOnlyByReopen
proved  ImportLife.ARemovedImportStaysRemoved
proved  ImportLife.OnlyAnImportWithNothingInForceIsRemoved
proved  ImportLife.AnImportNeverChangesOrganization
proved  ImportLife.OnlyItsOwnOrganizationChangesAnImport
proved  ImportLife.AViewerChangesNothing
proved  RowUnit.NobodyClearsAnotherPersonsDecision
proved  RowUnit.ARowIsUndecidedOnlyWhenNothingWasUnder
proved  RowUnit.ARowNeverChangesImportOrOrganization
proved  RowUnit.OnlyItsOwnOrganizationChangesARow
proved  RowUnit.AViewerChangesNothing
proved  DecideRow.ARowIsDecidedOnlyOnAnOpenImport
proved  DecideRow.ADecisionIsReplacedOnlyByAnActThatSawIt
proved  DecideRow.AnActsAcceptsAreMadeOnTheMatchingNow
proved  DecideRow.AnActThatChangesNothingRecordsNothing
proved  DecideRow.TheActIsRecordedAndCounted
proved  UndoRowStep.AnUndoTakesBackOnlyItsSendersOwnStep
proved  UndoRowStep.AnUndoPutsBackWhatWasThere
proved  UndoRowStep.UnderWhatIsPutBackIsWhatItReplaced
checked  Review.ARowBelongsToItsImportsOrganization

Review: 49 outcomes, 2 decisions

Proved: for every state and every input, after any number of commands
  ✓ ImportLife.OutcomesAddUpToTheRows
  ✓ ImportLife.NoCountIsNegative
  ✓ ImportLife.NothingIsWrittenBeforeConfirm
  ✓ ImportLife.AConfirmOfAClosedImportWritesNothing
  ✓ ImportLife.AConfirmIsOfWhatItsScreenHadReceived
  ✓ ImportLife.APlanIsOfTheLastChange
  ✓ ImportLife.NoConfirmWhileAGroupIsSent
  ✓ ImportLife.AGroupIsEndedOnlyByItsSender
  ✓ ImportLife.OnlyAnImportedFileIsTakenBack
  ✓ ImportLife.ATakeBackKeepsWhatWasChanged
  ✓ ImportLife.ASuggestionWritesNothing
  ✓ ImportLife.AMatchMarksOnlyItsOwnField
  ✓ ImportLife.OnlyAnOpenImportIsReviewed
  ✓ ImportLife.AnImportIsOpenedAgainOnlyByReopen
  ✓ ImportLife.ARemovedImportStaysRemoved
  ✓ ImportLife.OnlyAnImportWithNothingInForceIsRemoved
  ✓ ImportLife.AnImportNeverChangesOrganization
  ✓ ImportLife.OnlyItsOwnOrganizationChangesAnImport
  ✓ ImportLife.AViewerChangesNothing
  ✓ RowUnit.NobodyClearsAnotherPersonsDecision
  ✓ RowUnit.ARowIsUndecidedOnlyWhenNothingWasUnder
  ✓ RowUnit.ARowNeverChangesImportOrOrganization
  ✓ RowUnit.OnlyItsOwnOrganizationChangesARow
  ✓ RowUnit.AViewerChangesNothing
  ✓ DecideRow.ARowIsDecidedOnlyOnAnOpenImport
  ✓ DecideRow.ADecisionIsReplacedOnlyByAnActThatSawIt
  ✓ DecideRow.AnActsAcceptsAreMadeOnTheMatchingNow
  ✓ DecideRow.AnActThatChangesNothingRecordsNothing
  ✓ DecideRow.TheActIsRecordedAndCounted
  ✓ UndoRowStep.AnUndoTakesBackOnlyItsSendersOwnStep
  ✓ UndoRowStep.AnUndoPutsBackWhatWasThere
  ✓ UndoRowStep.UnderWhatIsPutBackIsWhatItReplaced

Checked: in every sequence of up to 2 commands through ReviewApi, with each event delivered twice, each reaction also run behind the others that wait
9,679 sequences, 1,020 states
  ✓ Review.ARowBelongsToItsImportsOrganization
      not proved for DecideRow: DecideRow has more than 4096 paths

Sampled: 200 longer sequences, of up to 8 commands picked at random (seed 1)
  ✓ none breaks a rule

Run on the real model: 43 sequences the explorer found and 139 walks of commands picked at random, as stories
  ✓ the model does what the explorer read in each

Assumed
  - whole numbers are exact: a number stays within ±2^53, and a bigint has no limit
  - a list an input holds has up to 2 items more than its schema asks for
  - an external system answers what its schema allows, and nothing else
  - middleware lets every caller in: who sends a command is anyone its request context allows
  - what a projection writes, and what a stream or a query gives, is not checked: only what a projection is given
  - a decision's events commit on every instance it recorded on, or on none: how a platform commits them is not checked
```

`Prove.decision`, the first three lines of each report (every rule after them is "Proved"):

```text
PROVED
elapsed 12184 ms
schema Proved; accepted true; paths 509
```

```text
PROVED
elapsed 3811 ms
schema Proved; accepted true; paths 181
```

`Verify.aggregate(ImportLife)` alone proves its nineteen rules for its own nine commands and answers "not verified"
for one reason: it folds `ActCounted`, which only a decision records. The model run above removes that reason.

### The orderings, as stories on the hosted model

`Review.story.test.ts`:

```ts
// The orderings that decide whether the hosted review holds Benjamin's answers, as stories on the model: a confirm
// whose screen had not received another person's act, the same person in a second tab, a confirm while a group act
// is sent, a save that changes nothing, accepts on an older matching, and undo below the first level. "" names no
// change.
import { Story } from "@alchemy.run/domain/Story"
import { it } from "@effect/vitest"
import { CurrentActor } from "../test/Actor.context.ts"
import {
  ActCounted,
  BeginGroup,
  ColumnMatched,
  ConfirmImport,
  EndGroup,
  GroupBegun,
  GroupEnded,
  GroupUnderWay,
  ImportConfirmed,
  ImportId,
  ImportLife,
  ImportStaged,
  MatchColumn,
  NotPermitted,
  PlanBehind,
  ReviewMovedOn,
} from "./ImportLife.aggregate.ts"
import { DecideRow, HistoryBehind, MatchedSince, NotYourStep, UndoRowStep } from "./Review.decision.ts"
import { Review } from "./Review.model.ts"
import { RowDecided, RowUnit, StepUndone, nothingUnder } from "./RowUnit.aggregate.ts"

const story = Story.make(Review)
const id = ImportId.make("imp_1")
const life = ImportLife.ref(id)
const row3 = RowUnit.ref("imp_1/row-3")
const row7 = RowUnit.ref("imp_1/row-7")
const row12 = RowUnit.ref("imp_1/row-12")

const ana = { organizationId: "org_prairie", memberId: "ana", role: "editor" as const }
const dana = { organizationId: "org_prairie", memberId: "dana", role: "editor" as const }
const staged = new ImportStaged({ organizationId: "org_prairie", rows: 200 })
const nothing = ""
const step = (name: string) => name
const leftOut = '{"out":true}'
const kept = '{"kept":true}'
const typed = '{"set":{"name":"Hex bolt M8"}}'

const act = (input: { row: string; step: string; screen: string; saw: string; flags: string }) =>
  new DecideRow({ importId: id, acceptedOn: -1, label: "Decide", ...input })
const decided = (input: { by: string; step: string; flags: string }) =>
  new RowDecided({ importId: id, organizationId: "org_prairie", acceptedOn: -1, label: "Decide", ...input })
const counted = (input: { step: string; screen: string; row: string }) => new ActCounted({ label: "Decide", ...input })
const confirm = (input: { screen: string; seen: string; planAt: string }) =>
  new ConfirmImport({ importId: id, created: 155, notImported: 45, ...input })

it.effect("another person's act lands before the screen's own waiting act: the confirm is refused; a plan built behind the last change is refused", () =>
  story(
    Story.given(life, staged),
    // Dana decides row 7 from her screen; Ana's screen has not received it.
    Story.provide(CurrentActor, dana),
    Story.when(act({ row: "row-7", step: "d1", screen: "dana-1", saw: nothing, flags: kept })),
    Story.then(row7, decided({ by: "dana", step: "d1", flags: kept })),
    Story.then(life, counted({ step: "d1", screen: "dana-1", row: "row-7" })),
    // Ana's waiting act on row 3 goes out, then her confirm, naming the last change her screen received: none.
    Story.provide(CurrentActor, ana),
    Story.when(act({ row: "row-3", step: "a1", screen: "ana-1", saw: nothing, flags: leftOut })),
    Story.then(row3, decided({ by: "ana", step: "a1", flags: leftOut })),
    Story.then(life, counted({ step: "a1", screen: "ana-1", row: "row-3" })),
    Story.when(confirm({ screen: "ana-1", seen: nothing, planAt: "a1" })),
    Story.rejected(new ReviewMovedOn({ last: step("a1") })),
    // Once her screen has received Dana's act, the same confirm names it and is taken.
    Story.when(confirm({ screen: "ana-1", seen: step("d1"), planAt: "d1" })),
    Story.rejected(new PlanBehind({ last: step("a1") })),
    Story.when(confirm({ screen: "ana-1", seen: step("d1"), planAt: "a1" })),
    Story.then(life, new ImportConfirmed({ created: 155, notImported: 45 })),
  ),
)

it.effect("the screen's own acts after what it received do not hold its confirm back", () =>
  story(
    Story.given(life, staged),
    Story.provide(CurrentActor, ana),
    Story.when(act({ row: "row-3", step: "a1", screen: "ana-1", saw: nothing, flags: leftOut })),
    Story.then(row3, decided({ by: "ana", step: "a1", flags: leftOut })),
    Story.then(life, counted({ step: "a1", screen: "ana-1", row: "row-3" })),
    Story.when(act({ row: "row-12", step: "a2", screen: "ana-1", saw: nothing, flags: kept })),
    Story.then(row12, decided({ by: "ana", step: "a2", flags: kept })),
    Story.then(life, counted({ step: "a2", screen: "ana-1", row: "row-12" })),
    Story.when(confirm({ screen: "ana-1", seen: nothing, planAt: "a2" })),
    Story.then(life, new ImportConfirmed({ created: 155, notImported: 45 })),
  ),
)

it.effect("the same person's act from a second tab holds back the first tab's confirm", () =>
  story(
    Story.given(life, staged),
    Story.provide(CurrentActor, ana),
    Story.when(act({ row: "row-3", step: "a1", screen: "ana-1", saw: nothing, flags: leftOut })),
    Story.then(row3, decided({ by: "ana", step: "a1", flags: leftOut })),
    Story.then(life, counted({ step: "a1", screen: "ana-1", row: "row-3" })),
    Story.when(act({ row: "row-12", step: "a2", screen: "ana-2", saw: nothing, flags: kept })),
    Story.then(row12, decided({ by: "ana", step: "a2", flags: kept })),
    Story.then(life, counted({ step: "a2", screen: "ana-2", row: "row-12" })),
    Story.when(confirm({ screen: "ana-1", seen: nothing, planAt: "a2" })),
    Story.rejected(new ReviewMovedOn({ last: step("a2") })),
  ),
)

it.effect("no confirm is taken while a group act is being sent, by its sender or by anyone else", () =>
  story(
    Story.given(life, staged),
    Story.provide(CurrentActor, ana),
    Story.when(new BeginGroup({ importId: id, step: "g1" })),
    Story.then(life, new GroupBegun({ step: "g1", by: "ana" })),
    Story.when(act({ row: "row-3", step: "g1", screen: "ana-1", saw: nothing, flags: leftOut })),
    Story.then(row3, decided({ by: "ana", step: "g1", flags: leftOut })),
    Story.then(life, counted({ step: "g1", screen: "ana-1", row: "row-3" })),
    Story.when(confirm({ screen: "ana-1", seen: nothing, planAt: "g1" })),
    Story.rejected(new GroupUnderWay({ step: "g1" })),
    // Dana's screen has received the group's first row; her confirm is refused too, and she cannot end Ana's group.
    Story.provide(CurrentActor, dana),
    Story.when(confirm({ screen: "dana-1", seen: step("g1"), planAt: "g1" })),
    Story.rejected(new GroupUnderWay({ step: "g1" })),
    Story.when(new EndGroup({ importId: id, step: "g1" })),
    Story.rejected(new NotPermitted({})),
    Story.provide(CurrentActor, ana),
    Story.when(act({ row: "row-12", step: "g1", screen: "ana-1", saw: nothing, flags: leftOut })),
    Story.then(row12, decided({ by: "ana", step: "g1", flags: leftOut })),
    Story.then(life, counted({ step: "g1", screen: "ana-1", row: "row-12" })),
    Story.when(new EndGroup({ importId: id, step: "g1" })),
    Story.then(life, new GroupEnded({})),
    Story.when(confirm({ screen: "ana-1", seen: nothing, planAt: "g1" })),
    Story.then(life, new ImportConfirmed({ created: 155, notImported: 45 })),
  ),
)

it.effect("a save that leaves the row as it is records nothing: the answer says no change", () =>
  story(
    Story.given(life, staged),
    Story.given(row12, decided({ by: "ana", step: "a1", flags: kept })),
    Story.provide(CurrentActor, ana),
    Story.when(act({ row: "row-12", step: "a2", screen: "ana-1", saw: step("a1"), flags: kept })),
    Story.then(row12),
    Story.then(life),
  ),
)

it.effect("an act carrying an accept made on an older matching is refused with the matching now", () =>
  story(
    Story.given(life, staged),
    Story.provide(CurrentActor, ana),
    Story.when(new MatchColumn({ importId: id, field: "uom", step: "m1", screen: "dana-1" })),
    Story.then(life, new ColumnMatched({ field: "uom", step: "m1", screen: "dana-1" })),
    Story.when(
      new DecideRow({
        importId: id,
        row: "row-12",
        step: "a1",
        screen: "ana-1",
        saw: nothing,
        flags: typed,
        acceptedOn: 0,
        label: "Decide",
      }),
    ),
    Story.rejected(new MatchedSince({ matching: 1 })),
    Story.when(
      new DecideRow({
        importId: id,
        row: "row-12",
        step: "a2",
        screen: "ana-1",
        saw: nothing,
        flags: typed,
        acceptedOn: 1,
        label: "Decide",
      }),
    ),
    Story.then(
      row12,
      new RowDecided({
        importId: id,
        organizationId: "org_prairie",
        by: "ana",
        step: "a2",
        flags: typed,
        acceptedOn: 1,
        label: "Decide",
      }),
    ),
    Story.then(life, counted({ step: "a2", screen: "ana-1", row: "row-12" })),
  ),
)

it.effect("three undos on one row end at its first decision, each level checked by step", () =>
  story(
    Story.given(life, staged),
    Story.given(
      row12,
      decided({ by: "ana", step: "a1", flags: leftOut }),
      decided({ by: "ana", step: "a2", flags: kept }),
      decided({ by: "ana", step: "a3", flags: typed }),
    ),
    Story.provide(CurrentActor, ana),
    // A history read behind: it names nothing where a1 should be.
    Story.when(new UndoRowStep({ importId: id, row: "row-12", undo: "a3", step: "u0", screen: "ana-1", next: nothingUnder })),
    Story.rejected(new HistoryBehind({})),
    Story.when(
      new UndoRowStep({
        importId: id,
        row: "row-12",
        undo: "a3",
        step: "u1",
        screen: "ana-1",
        next: { by: "ana", step: "a1", flags: leftOut, acceptedOn: -1, label: "Decide", replaced: nothing },
      }),
    ),
    Story.then(
      row12,
      new StepUndone({
        next: { by: "ana", step: "a1", flags: leftOut, acceptedOn: -1, label: "Decide", replaced: nothing },
      }),
    ),
    Story.then(life, new ActCounted({ step: "u1", screen: "ana-1", row: "row-12", label: "undo" })),
    Story.when(new UndoRowStep({ importId: id, row: "row-12", undo: "a2", step: "u2", screen: "ana-1", next: nothingUnder })),
    Story.then(row12, new StepUndone({ next: nothingUnder })),
    Story.then(life, new ActCounted({ step: "u2", screen: "ana-1", row: "row-12", label: "undo" })),
    Story.when(new UndoRowStep({ importId: id, row: "row-12", undo: "a1", step: "u3", screen: "ana-1", next: nothingUnder })),
    Story.then(row12, new StepUndone({ next: nothingUnder })),
    Story.then(life, new ActCounted({ step: "u3", screen: "ana-1", row: "row-12", label: "undo" })),
  ),
)

it.effect("an undo that puts back another person's decision stops there", () =>
  story(
    Story.given(life, staged),
    Story.given(row12, decided({ by: "dana", step: "d1", flags: kept }), decided({ by: "ana", step: "a1", flags: leftOut })),
    Story.provide(CurrentActor, ana),
    Story.when(new UndoRowStep({ importId: id, row: "row-12", undo: "a1", step: "u1", screen: "ana-1", next: nothingUnder })),
    Story.then(row12, new StepUndone({ next: nothingUnder })),
    Story.then(life, new ActCounted({ step: "u1", screen: "ana-1", row: "row-12", label: "undo" })),
    Story.when(new UndoRowStep({ importId: id, row: "row-12", undo: "d1", step: "u2", screen: "ana-1", next: nothingUnder })),
    Story.rejected(new NotYourStep({})),
  ),
)
```

`AcceptInForce.test.ts`, the read side of "Server refuses, screen says so":

```ts
// The read side of "Server refuses, screen says so": which accepts a row holds are in force after columns are matched
// again. Every reader asks `acceptInForce`; no rule of the model does, so this is a test, not a proof.
import { describe, expect, it } from "@effect/vitest"
import { acceptInForce, markMatched, neverMatched } from "./Seen.value.ts"

describe("an accept is in force while its field was not matched after it", () => {
  it("an accept of uom made at matching 0 stays in force when SKU is matched, and goes when uom is", () => {
    const afterSku = markMatched(neverMatched, "sku", 1)
    expect(acceptInForce(afterSku, "uom", 0)).toBe(true)
    expect(acceptInForce(afterSku, "sku", 0)).toBe(false)
    const afterUom = markMatched(afterSku, "uom", 2)
    expect(acceptInForce(afterUom, "uom", 0)).toBe(false)
    expect(acceptInForce(afterUom, "uom", 2)).toBe(true)
  })
  it("a decision that accepts nothing has no accept in force", () => {
    expect(acceptInForce(neverMatched, "name", -1)).toBe(false)
  })
})
```

The run (stories, the read side, both proofs and the lifecycle alone):

```text
 ✓ review8/AcceptInForce.test.ts > an accept is in force while its field was not matched after it > an accept of uom made at matching 0 stays in force when SKU is matched, and goes when uom is 1ms
 ✓ review8/AcceptInForce.test.ts > an accept is in force while its field was not matched after it > a decision that accepts nothing has no accept in force 0ms
 ✓ review8/Review.story.test.ts > another person's act lands before the screen's own waiting act: the confirm is refused; a plan built behind the last change is refused 22ms
 ✓ review8/Review.story.test.ts > the screen's own acts after what it received do not hold its confirm back 5ms
 ✓ review8/Review.story.test.ts > the same person's act from a second tab holds back the first tab's confirm 4ms
 ✓ review8/Review.story.test.ts > no confirm is taken while a group act is being sent, by its sender or by anyone else 6ms
 ✓ review8/Review.story.test.ts > a save that leaves the row as it is records nothing: the answer says no change 3ms
 ✓ review8/Review.story.test.ts > an act carrying an accept made on an older matching is refused with the matching now 3ms
 ✓ review8/Review.story.test.ts > three undos on one row end at its first decision, each level checked by step 3ms
 ✓ review8/Review.story.test.ts > an undo that puts back another person's decision stops there 2ms
 ✓ review8/Undoing.prove.test.ts > prove: the decision Undoing 3815ms
 ✓ review8/ImportLife.verify.test.ts > verify: ImportLife 6343ms
 ✓ review8/Deciding.prove.test.ts > prove: the decision Deciding 12188ms
      Tests  13 passed (13)
```

## Trial 8. The item, with replace and restore

The first round's item held one count and had no replace. The app's item has lists (tags, up to three vendors),
nullable and decimal fields, and a decided rule: an import may replace a stored item, and taking that import back
restores the item unless it was changed since, up to ten replaces in turn. Here the item's whole record is held as
text, as the review's decision is, and its version is the id of the change that made it. Restoring puts back the
version before the replace, so taking back the latest import, then the one before, walks back in turn; the text each
replace put over is carried by the import that replaced it. A changed item is an accepted no-op with the reply
`Kept`, not a rejection, so a take-back can name it.

`Item.aggregate.ts`:

```ts
// One inventory item of one organization, keyed by the organization's SKU key, holding the item's whole record as
// text (as the review's decision is held) and the version: a unique id of the change that made this state, never a
// counter. An import may replace a stored item; a take-back restores what it replaced only while the item is
// unchanged since, so ten replaces are taken back in turn, latest first, each putting back the text and version
// before it. The item keeps no history: the import that replaced it carries what it replaced.
import * as Domain from "@alchemy.run/domain"
import * as Effect from "effect/Effect"
import * as S from "effect/Schema"
import { CurrentActor, Session } from "../test/Actor.context.ts"

// The organization's normalised SKU key, made by the host from the signed-in organization and the file's SKU.
export const ItemKey = S.String.pipe(S.brand("ItemKey"))

export class ItemCreated extends Domain.Event("ItemCreated", {
  organizationId: S.String,
  createdBy: S.String,
  importId: S.String,
  fields: S.String,
  version: S.String,
}) {}
export class ItemReplaced extends Domain.Event("ItemReplaced", { importId: S.String, fields: S.String, version: S.String }) {}
export class ItemEdited extends Domain.Event("ItemEdited", { by: S.String, fields: S.String, version: S.String }) {}
export class ItemRestored extends Domain.Event("ItemRestored", { importId: S.String, fields: S.String, version: S.String }) {}
export class ItemRemoved extends Domain.Event("ItemRemoved", { importId: S.String }) {}

export class NotPermitted extends Domain.Rejection("NotPermitted", {}) {}
// There is no stored item under the key: never created, or removed by a take-back.
export class NotStored extends Domain.Rejection("NotStored", {}) {}
// The item changed after the version its sender named: the version it has now, for the screen to show from.
export class ChangedSince extends Domain.Rejection("ChangedSince", { version: S.String }) {}

// A second create of a stored SKU is accepted and changes nothing; the reply says which, for "Already there".
export class CreateFromImport extends Domain.Command("CreateFromImport", {
  middleware: [Session],
  input: { sku: ItemKey, importId: S.String, fields: S.String, version: S.String },
  events: [ItemCreated],
  rejects: [NotPermitted],
  reply: { outcome: S.Literals(["Created", "AlreadyThere"]) },
}) {}
// `expect` is the version the import's plan saw: a replace of anything else is refused.
export class ReplaceFromImport extends Domain.Command("ReplaceFromImport", {
  middleware: [Session],
  input: { sku: ItemKey, importId: S.String, fields: S.String, version: S.String, expect: S.String },
  events: [ItemReplaced],
  rejects: [NotPermitted, NotStored, ChangedSince],
}) {}
// `saw` is the version the editor's screen showed.
export class EditItem extends Domain.Command("EditItem", {
  middleware: [Session],
  input: { sku: ItemKey, fields: S.String, version: S.String, saw: S.String },
  events: [ItemEdited],
  rejects: [NotPermitted, NotStored, ChangedSince],
}) {}
// `after` is the version the replace made; `fields` and `version` are what the replace found. A changed item is
// kept: an accepted no-op whose reply says "Kept", so the take-back names it and still restores the others.
export class RestoreIfUnchanged extends Domain.Command("RestoreIfUnchanged", {
  middleware: [Session],
  input: { sku: ItemKey, importId: S.String, after: S.String, fields: S.String, version: S.String },
  events: [ItemRestored],
  rejects: [NotPermitted, NotStored],
  reply: { outcome: S.Literals(["Restored", "Kept"]) },
}) {}
// `after` is the version the create made: a take-back removes only an item nobody changed since.
export class RemoveIfUnchanged extends Domain.Command("RemoveIfUnchanged", {
  middleware: [Session],
  input: { sku: ItemKey, importId: S.String, after: S.String },
  events: [ItemRemoved],
  rejects: [NotPermitted, NotStored],
  reply: { outcome: S.Literals(["Removed", "Kept"]) },
}) {}

export const ItemState = S.Union([
  S.TaggedStruct("Absent", {}),
  S.TaggedStruct("Stored", { organizationId: S.String, createdBy: S.String, fields: S.String, version: S.String }),
  S.TaggedStruct("Removed", { organizationId: S.String }),
])

export class Item extends Domain.Aggregate("Item", {
  id: ItemKey,
  state: ItemState,
  initial: { _tag: "Absent" },
  transitions: {
    // A second import of the same file adds nothing: a create of a stored item leaves it as it was.
    ASecondCreateChangesNothing: ({ before, after, command }) =>
      command._tag !== "CreateFromImport" ||
      before._tag !== "Stored" ||
      (after._tag === "Stored" &&
        after.organizationId === before.organizationId &&
        after.createdBy === before.createdBy &&
        after.fields === before.fields &&
        after.version === before.version),
    // A replace changes only a stored item, only on the version it names, and to exactly the file's row.
    AReplaceIsOnlyOfAStoredItemOnTheVersionItNames: ({ before, after, command }) =>
      command._tag !== "ReplaceFromImport" ||
      (before._tag === "Stored"
        ? after._tag === "Stored" &&
          ((after.fields === before.fields && after.version === before.version) ||
            (before.version === command.expect && after.fields === command.fields && after.version === command.version))
        : after._tag === before._tag),
    // An edit lands only on the version its sender saw.
    AnEditIsOnlyOnTheVersionItsSenderSaw: ({ before, after, command }) =>
      command._tag !== "EditItem" ||
      (before._tag === "Stored"
        ? after._tag === "Stored" &&
          ((after.fields === before.fields && after.version === before.version) ||
            (before.version === command.saw && after.fields === command.fields && after.version === command.version))
        : after._tag === before._tag),
    // A take-back restores only an item unchanged since its replace, and puts back exactly the text and version named.
    ARestoreIsOnlyOfAnUnchangedItemAndExact: ({ before, after, command }) =>
      command._tag !== "RestoreIfUnchanged" ||
      (before._tag === "Stored"
        ? after._tag === "Stored" &&
          ((after.fields === before.fields && after.version === before.version) ||
            (before.version === command.after && after.fields === command.fields && after.version === command.version))
        : after._tag === before._tag),
    // A take-back removes only an item unchanged since the create.
    ARemovalIsOnlyOfAnUnchangedItem: ({ before, after, command }) =>
      after._tag !== "Removed" ||
      before._tag === "Removed" ||
      (command._tag === "RemoveIfUnchanged" && before._tag === "Stored" && before.version === command.after),
    // A removed item comes back only by a new create (the same file imported again after its take-back).
    OnlyACreateBringsBackARemovedItem: ({ before, after, command }) =>
      before._tag !== "Removed" || after._tag === "Removed" || command._tag === "CreateFromImport",
    // Who created a stored item never changes while it is stored.
    AnItemKeepsWhoCreatedIt: ({ before, after }) =>
      before._tag !== "Stored" || after._tag !== "Stored" || after.createdBy === before.createdBy,
    // Every item belongs to one organization.
    AnItemNeverChangesOrganization: ({ before, after }) =>
      before._tag === "Absent" || after._tag === "Absent" || before.organizationId === after.organizationId,
    OnlyItsOwnOrganizationChangesIt: Effect.fn(function* ({ before }) {
      if (before._tag === "Absent") return true
      return (yield* CurrentActor).organizationId === before.organizationId
    }),
    AViewerChangesNothing: Effect.fn(function* () {
      return (yield* CurrentActor).role !== "viewer"
    }),
  },
  commands: [CreateFromImport, ReplaceFromImport, EditItem, RestoreIfUnchanged, RemoveIfUnchanged],
  keyOf: (cmd) => cmd.sku,
  decide: {
    CreateFromImport: Effect.fn(function* (s, cmd) {
      const actor = yield* CurrentActor
      if (actor.role === "viewer") return yield* new NotPermitted({})
      if (s._tag !== "Absent" && actor.organizationId !== s.organizationId) return yield* new NotPermitted({})
      if (s._tag === "Stored") return []
      return [
        new ItemCreated({
          organizationId: actor.organizationId,
          createdBy: actor.memberId,
          importId: cmd.importId,
          fields: cmd.fields,
          version: cmd.version,
        }),
      ]
    }),
    ReplaceFromImport: Effect.fn(function* (s, cmd) {
      const actor = yield* CurrentActor
      if (actor.role === "viewer") return yield* new NotPermitted({})
      if (s._tag !== "Stored") return yield* new NotStored({})
      if (actor.organizationId !== s.organizationId) return yield* new NotPermitted({})
      if (s.version !== cmd.expect) return yield* new ChangedSince({ version: s.version })
      return [new ItemReplaced({ importId: cmd.importId, fields: cmd.fields, version: cmd.version })]
    }),
    EditItem: Effect.fn(function* (s, cmd) {
      const actor = yield* CurrentActor
      if (actor.role === "viewer") return yield* new NotPermitted({})
      if (s._tag !== "Stored") return yield* new NotStored({})
      if (actor.organizationId !== s.organizationId) return yield* new NotPermitted({})
      if (s.version !== cmd.saw) return yield* new ChangedSince({ version: s.version })
      return [new ItemEdited({ by: actor.memberId, fields: cmd.fields, version: cmd.version })]
    }),
    RestoreIfUnchanged: Effect.fn(function* (s, cmd) {
      const actor = yield* CurrentActor
      if (actor.role === "viewer") return yield* new NotPermitted({})
      if (s._tag !== "Stored") return yield* new NotStored({})
      if (actor.organizationId !== s.organizationId) return yield* new NotPermitted({})
      if (s.version !== cmd.after) return []
      return [new ItemRestored({ importId: cmd.importId, fields: cmd.fields, version: cmd.version })]
    }),
    RemoveIfUnchanged: Effect.fn(function* (s, cmd) {
      const actor = yield* CurrentActor
      if (actor.role === "viewer") return yield* new NotPermitted({})
      if (s._tag !== "Stored") return yield* new NotStored({})
      if (actor.organizationId !== s.organizationId) return yield* new NotPermitted({})
      if (s.version !== cmd.after) return []
      return [new ItemRemoved({ importId: cmd.importId })]
    }),
  },
  evolve: {
    ItemCreated: (_, e) => ({
      _tag: "Stored" as const,
      organizationId: e.organizationId,
      createdBy: e.createdBy,
      fields: e.fields,
      version: e.version,
    }),
    ItemReplaced: (s, e) => (s._tag === "Stored" ? { ...s, fields: e.fields, version: e.version } : s),
    ItemEdited: (s, e) => (s._tag === "Stored" ? { ...s, fields: e.fields, version: e.version } : s),
    ItemRestored: (s, e) => (s._tag === "Stored" ? { ...s, fields: e.fields, version: e.version } : s),
    ItemRemoved: (s) => (s._tag === "Stored" ? { _tag: "Removed" as const, organizationId: s.organizationId } : s),
  },
  // The reply names what happened, so the import's result counts "Already there" and the take-back names "Kept".
  reply: {
    CreateFromImport: (_, events) => ({ outcome: events.length > 0 ? ("Created" as const) : ("AlreadyThere" as const) }),
    RestoreIfUnchanged: (_, events) => ({ outcome: events.length > 0 ? ("Restored" as const) : ("Kept" as const) }),
    RemoveIfUnchanged: (_, events) => ({ outcome: events.length > 0 ? ("Removed" as const) : ("Kept" as const) }),
  },
}) {}
```

`Item.story.test.ts`:

```ts
// The replace-and-restore orderings the product rule decided, told on the item: a take-back restores a replaced
// item unless it changed since, restores several replaces in turn (latest import first), keeps a changed item and
// names it, and a second create of a stored SKU changes nothing.
import { Story } from "@alchemy.run/domain/Story"
import { it } from "@effect/vitest"
import { CurrentActor } from "../test/Actor.context.ts"
import {
  CreateFromImport,
  EditItem,
  Item,
  ItemCreated,
  ItemEdited,
  ItemKey,
  ItemReplaced,
  ItemRestored,
  ReplaceFromImport,
  RestoreIfUnchanged,
} from "./Item.aggregate.ts"
import { Items } from "./Item.model.ts"

const story = Story.make(Items)
const sku = ItemKey.make("org_prairie/CHM-0007")
const item = Item.ref(sku)
const ana = { organizationId: "org_prairie", memberId: "ana", role: "editor" as const }

// The record as text at each version: the first import's row, two later files' rows, and a hand edit.
const first = '{"sku":"CHM-0007","name":"Citric acid","uom":"KG","unitCost":"4.1","tags":["food"]}'
const second = '{"sku":"CHM-0007","name":"Citric acid","uom":"KG","unitCost":"4.35","tags":["food"]}'
const third = '{"sku":"CHM-0007","name":"Citric acid, anhydrous","uom":"KG","unitCost":"4.6","tags":["food","bulk"]}'
const edited = '{"sku":"CHM-0007","name":"Citric acid","uom":"KG","unitCost":"4.4","tags":["food"]}'
const created = new ItemCreated({ organizationId: "org_prairie", createdBy: "ana", importId: "imp_1", fields: first, version: "v_c1" })

it.effect("a replace then its take-back puts back the old text and version", () =>
  story(
    Story.given(item, created),
    Story.provide(CurrentActor, ana),
    Story.when(new ReplaceFromImport({ sku, importId: "imp_2", fields: second, version: "v_r2", expect: "v_c1" })),
    Story.then(item, new ItemReplaced({ importId: "imp_2", fields: second, version: "v_r2" })),
    Story.when(new RestoreIfUnchanged({ sku, importId: "imp_2", after: "v_r2", fields: first, version: "v_c1" })),
    Story.then(item, new ItemRestored({ importId: "imp_2", fields: first, version: "v_c1" })),
    Story.replied({ outcome: "Restored" }),
    Story.state(item, { _tag: "Stored", fields: first, version: "v_c1" }),
  ),
)

it.effect("a replace, an edit, then the take-back keeps the edited item and says so", () =>
  story(
    Story.given(item, created),
    Story.provide(CurrentActor, ana),
    Story.when(new ReplaceFromImport({ sku, importId: "imp_2", fields: second, version: "v_r2", expect: "v_c1" })),
    Story.then(item, new ItemReplaced({ importId: "imp_2", fields: second, version: "v_r2" })),
    Story.when(new EditItem({ sku, fields: edited, version: "v_e3", saw: "v_r2" })),
    Story.then(item, new ItemEdited({ by: "ana", fields: edited, version: "v_e3" })),
    Story.when(new RestoreIfUnchanged({ sku, importId: "imp_2", after: "v_r2", fields: first, version: "v_c1" })),
    Story.then(item),
    Story.replied({ outcome: "Kept" }),
    Story.state(item, { _tag: "Stored", fields: edited, version: "v_e3" }),
  ),
)

it.effect("two replaces by two imports, taken back latest first, end at the first text", () =>
  story(
    Story.given(item, created),
    Story.provide(CurrentActor, ana),
    Story.when(new ReplaceFromImport({ sku, importId: "imp_2", fields: second, version: "v_r2", expect: "v_c1" })),
    Story.then(item, new ItemReplaced({ importId: "imp_2", fields: second, version: "v_r2" })),
    Story.when(new ReplaceFromImport({ sku, importId: "imp_3", fields: third, version: "v_r3", expect: "v_r2" })),
    Story.then(item, new ItemReplaced({ importId: "imp_3", fields: third, version: "v_r3" })),
    Story.when(new RestoreIfUnchanged({ sku, importId: "imp_3", after: "v_r3", fields: second, version: "v_r2" })),
    Story.then(item, new ItemRestored({ importId: "imp_3", fields: second, version: "v_r2" })),
    Story.state(item, { _tag: "Stored", fields: second, version: "v_r2" }),
    Story.when(new RestoreIfUnchanged({ sku, importId: "imp_2", after: "v_r2", fields: first, version: "v_c1" })),
    Story.then(item, new ItemRestored({ importId: "imp_2", fields: first, version: "v_c1" })),
    Story.state(item, { _tag: "Stored", fields: first, version: "v_c1" }),
  ),
)

it.effect("two replaces taken back in the wrong order: the earlier import's take-back keeps the item", () =>
  story(
    Story.given(item, created),
    Story.provide(CurrentActor, ana),
    Story.when(new ReplaceFromImport({ sku, importId: "imp_2", fields: second, version: "v_r2", expect: "v_c1" })),
    Story.then(item, new ItemReplaced({ importId: "imp_2", fields: second, version: "v_r2" })),
    Story.when(new ReplaceFromImport({ sku, importId: "imp_3", fields: third, version: "v_r3", expect: "v_r2" })),
    Story.then(item, new ItemReplaced({ importId: "imp_3", fields: third, version: "v_r3" })),
    Story.when(new RestoreIfUnchanged({ sku, importId: "imp_2", after: "v_r2", fields: first, version: "v_c1" })),
    Story.then(item),
    Story.replied({ outcome: "Kept" }),
    Story.state(item, { _tag: "Stored", fields: third, version: "v_r3" }),
  ),
)

it.effect("a second create of a stored SKU changes nothing and says it was already there", () =>
  story(
    Story.given(item, created),
    Story.provide(CurrentActor, ana),
    Story.when(new CreateFromImport({ sku, importId: "imp_2", fields: second, version: "v_c2" })),
    Story.then(item),
    Story.replied({ outcome: "AlreadyThere" }),
    Story.state(item, { _tag: "Stored", createdBy: "ana", fields: first, version: "v_c1" }),
  ),
)
```

`Verify.aggregate(Item)`, 3.58 s, whole:

```text
VERIFIED
proved  ASecondCreateChangesNothing
proved  AReplaceIsOnlyOfAStoredItemOnTheVersionItNames
proved  AnEditIsOnlyOnTheVersionItsSenderSaw
proved  ARestoreIsOnlyOfAnUnchangedItemAndExact
proved  ARemovalIsOnlyOfAnUnchangedItem
proved  OnlyACreateBringsBackARemovedItem
proved  AnItemKeepsWhoCreatedIt
proved  AnItemNeverChangesOrganization
proved  OnlyItsOwnOrganizationChangesIt
proved  AViewerChangesNothing

Item: 10 rules, 5 commands

Proved: for every state and every input, after any number of commands
  ✓ ASecondCreateChangesNothing
  ✓ AReplaceIsOnlyOfAStoredItemOnTheVersionItNames
  ✓ AnEditIsOnlyOnTheVersionItsSenderSaw
  ✓ ARestoreIsOnlyOfAnUnchangedItemAndExact
  ✓ ARemovalIsOnlyOfAnUnchangedItem
  ✓ OnlyACreateBringsBackARemovedItem
  ✓ AnItemKeepsWhoCreatedIt
  ✓ AnItemNeverChangesOrganization
  ✓ OnlyItsOwnOrganizationChangesIt
  ✓ AViewerChangesNothing

--- not part of Verify.render: from report.explored ---
depth 3, sequences 527, states 122, truncated false, every sequence of up to 3 commands run
```

The stories:

```text
 ✓ item5/Item.story.test.ts > a replace then its take-back puts back the old text and version 33ms
 ✓ item5/Item.story.test.ts > a replace, an edit, then the take-back keeps the edited item and says so 5ms
 ✓ item5/Item.story.test.ts > two replaces by two imports, taken back latest first, end at the first text 4ms
 ✓ item5/Item.story.test.ts > two replaces taken back in the wrong order: the earlier import's take-back keeps the item 5ms
 ✓ item5/Item.story.test.ts > a second create of a stored SKU changes nothing and says it was already there 4ms
      Tests  5 passed (5)
```

With the first line of `RestoreIfUnchanged`'s version check removed, the report is "not verified" with only
`ARestoreIsOnlyOfAnUnchangedItemAndExact` broken, so the rule is not empty.

`ItemLists` is the same aggregate with `tags: S.Array(S.String)` and `vendors: S.Array(Vendor).check(S.isMaxLength(3))`
in the stored state and the commands, and one rule more, `AtMostOnePreferredVendor`. Its report, 787.68 s, the first
16 lines:

```text
NotVerified
checked  AtMostOnePreferredVendor
checked  ASecondCreateChangesNothing
checked  AReplaceIsOnlyOfAStoredItemOnTheVersionItNames
checked  AnEditIsOnlyOnTheVersionItsSenderSaw
checked  ARestoreIsOnlyOfAnUnchangedItemAndExact
checked  ARemovalIsOnlyOfAnUnchangedItem
checked  OnlyACreateBringsBackARemovedItem
checked  AnItemKeepsWhoCreatedIt
checked  AnItemNeverChangesOrganization
checked  OnlyItsOwnOrganizationChangesIt
checked  AViewerChangesNothing

ItemLists: 11 rules, 5 commands

Checked: in every sequence of up to 3 commands on a new instance
```

```text
  ✗ the search stopped at its budget: only every sequence of up to 1 commands was run (allow: { truncated: true } passes with this)
    ✗ CreateFromImport: proved for short lists only
        ReplaceFromImport has more than 4096 paths
        EditItem has more than 4096 paths
        RestoreIfUnchanged has more than 4096 paths
    ✗ RemoveIfUnchanged: proved for short lists only
    ✗ CreateFromImport: proved for short lists only
        ReplaceFromImport has more than 4096 paths
        EditItem has more than 4096 paths
        RestoreIfUnchanged has more than 4096 paths
    ✗ RemoveIfUnchanged: proved for short lists only
    ✗ CreateFromImport: proved for short lists only
        ReplaceFromImport has more than 4096 paths
        EditItem has more than 4096 paths
        RestoreIfUnchanged has more than 4096 paths
    ✗ RemoveIfUnchanged: proved for short lists only
    ✗ CreateFromImport: proved for short lists only
        ReplaceFromImport has more than 4096 paths
        EditItem has more than 4096 paths
        RestoreIfUnchanged has more than 4096 paths
    ✗ RemoveIfUnchanged: proved for short lists only
    ✗ CreateFromImport: proved for short lists only
        ReplaceFromImport has more than 4096 paths
        EditItem has more than 4096 paths
        RestoreIfUnchanged has more than 4096 paths
    ✗ RemoveIfUnchanged: proved for short lists only
    ✗ CreateFromImport: proved for short lists only
        ReplaceFromImport has more than 4096 paths
        EditItem has more than 4096 paths
        RestoreIfUnchanged has more than 4096 paths
    ✗ RemoveIfUnchanged: proved for short lists only
    ✗ CreateFromImport: proved for short lists only
        ReplaceFromImport has more than 4096 paths
        EditItem has more than 4096 paths
        RestoreIfUnchanged has more than 4096 paths
    ✗ RemoveIfUnchanged: proved for short lists only
    ✗ CreateFromImport: proved for short lists only
        ReplaceFromImport has more than 4096 paths
        EditItem has more than 4096 paths
        RestoreIfUnchanged has more than 4096 paths
    ✗ RemoveIfUnchanged: proved for short lists only
    ✗ CreateFromImport: proved for short lists only
        ReplaceFromImport has more than 4096 paths
        EditItem has more than 4096 paths
        RestoreIfUnchanged has more than 4096 paths
    ✗ RemoveIfUnchanged: proved for short lists only
    ✗ CreateFromImport: proved for short lists only
        ReplaceFromImport has more than 4096 paths
        EditItem has more than 4096 paths
        RestoreIfUnchanged has more than 4096 paths
    ✗ RemoveIfUnchanged: proved for short lists only
    ✗ CreateFromImport: proved for short lists only
        ReplaceFromImport has more than 4096 paths
        EditItem has more than 4096 paths
        RestoreIfUnchanged has more than 4096 paths
    ✗ RemoveIfUnchanged: proved for short lists only
    ✗ CreateFromImport: proved for short lists only
        ReplaceFromImport has more than 4096 paths
        EditItem has more than 4096 paths
        RestoreIfUnchanged has more than 4096 paths
    ✗ RemoveIfUnchanged: proved for short lists only
100,000 sequences, 9,630 states (stopped at the budget: every sequence of up to 1 commands was run, and some of 2)
```

## Trial 9. The allowance by day

The first round's allowance held one count and a `StartNewDay` anyone could send and nothing scheduled. Here the day
comes from the time `decide` is given: the first call of a later UTC day starts the count again at 1. The prover models
the time as a number of milliseconds and can divide it, but has no order on text, so the day is held as whole days
since 1970-01-01. Viewers take calls today (the table assistant is open to every member), so the rule is that a viewer
takes only the assistant's call.

`AllowanceDay.aggregate.ts`:

```ts
// Variant 1, the shape the prover reads: an organization's model calls counted per UTC day, the day held as a whole
// number of days since 1970-01-01 UTC, computed from the command's `now`. No reset command and no cron: the first
// call of a later day starts that day's count at 1. The date text is for the screen, made from the number there.
import * as Domain from "@alchemy.run/domain"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as S from "effect/Schema"
import { CurrentActor, Session } from "../test/Actor.context.ts"

const DAILY_CALLS = 40
const DAY_MS = 86_400_000
// The app's three purposes: a viewer may make the table assistant's call ("view"); "check" and "suggest" need an editor.
export const Purpose = S.Literals(["view", "check", "suggest"])

// One call counted, for the day it counts against (a new day's first call names its own day).
export class CallTaken extends Domain.Event("CallTaken", { organizationId: S.String, day: S.Int }) {}
export class DayUsedUp extends Domain.Rejection("DayUsedUp", { day: S.Int }) {}
export class NotPermitted extends Domain.Rejection("NotPermitted", {}) {}

export class TakeCall extends Domain.Command("TakeCall", {
  middleware: [Session],
  input: { organizationId: S.String, purpose: Purpose },
  events: [CallTaken],
  rejects: [DayUsedUp, NotPermitted],
}) {}

export const AllowanceState = S.Union([
  S.TaggedStruct("Fresh", {}),
  S.TaggedStruct("Counting", { organizationId: S.String, day: S.Int, taken: S.Int }),
])

export class AllowanceDay extends Domain.Aggregate("AllowanceDay", {
  id: S.String,
  state: AllowanceState,
  initial: { _tag: "Fresh" },
  invariants: {
    // Never more than 40 calls counted for one day, and a counted day has at least its first call.
    NeverMoreThanFortyInADay: (s) => s._tag === "Fresh" || (s.taken >= 1 && s.taken <= DAILY_CALLS),
  },
  transitions: {
    // Within one day the count only rises, by one call at a time.
    WithinADayTheCountRisesByOne: ({ before, after }) =>
      before._tag !== "Counting" || after._tag !== "Counting" || after.day !== before.day || after.taken === before.taken + 1,
    // A new day's count starts at 1, and a day changes only forward.
    ANewDayStartsAtOne: ({ before, after }) =>
      after._tag !== "Counting" || (before._tag === "Counting" && before.day === after.day) || after.taken === 1,
    ADayChangesOnlyForward: ({ before, after }) =>
      before._tag !== "Counting" || after._tag !== "Counting" || after.day >= before.day,
    // An allowance never changes organization, and only its own organization takes from it.
    AnAllowanceNeverChangesOrganization: ({ before, after }) =>
      before._tag !== "Counting" || after._tag !== "Counting" || before.organizationId === after.organizationId,
    OnlyItsOwnOrganizationTakesACall: Effect.fn(function* ({ command }) {
      return (yield* CurrentActor).organizationId === command.organizationId
    }),
    // A viewer takes only the table assistant's call.
    AViewerTakesOnlyTheAssistantsCall: Effect.fn(function* ({ command }) {
      return (yield* CurrentActor).role !== "viewer" || command.purpose === "view"
    }),
  },
  commands: [TakeCall],
  keyOf: (cmd) => cmd.organizationId,
  decide: {
    TakeCall: Effect.fn(function* (s, cmd, { now }) {
      const actor = yield* CurrentActor
      if (actor.organizationId !== cmd.organizationId) return yield* new NotPermitted({})
      if (actor.role === "viewer" && cmd.purpose !== "view") return yield* new NotPermitted({})
      const today = Math.floor(DateTime.toEpochMillis(now) / DAY_MS)
      // A later day starts its own count; a clock behind the stored day counts against the stored day.
      if (s._tag === "Fresh" || today > s.day) return [new CallTaken({ organizationId: cmd.organizationId, day: today })]
      if (s.taken >= DAILY_CALLS) return yield* new DayUsedUp({ day: s.day })
      return [new CallTaken({ organizationId: cmd.organizationId, day: s.day })]
    }),
  },
  evolve: {
    // A new day keeps the organization it holds: the first run's state took the event's, and the prover found a
    // command for another organization changing it from a state no real run reaches (the key is the organization).
    CallTaken: (s, e) =>
      s._tag === "Counting" && s.day === e.day
        ? { ...s, taken: s.taken + 1 }
        : {
            _tag: "Counting" as const,
            organizationId: s._tag === "Counting" ? s.organizationId : e.organizationId,
            day: e.day,
            taken: 1,
          },
  },
}) {}
```

Its report, the day as a number, then the same aggregate with the day as its date text:

```text
=== AllowanceDay: the day as whole days since 1970-01-01 UTC
VERIFIED
AllowanceDay: 7 rules, 1 commands

Proved: for every state and every input, after any number of commands
  ✓ NeverMoreThanFortyInADay
  ✓ WithinADayTheCountRisesByOne
  ✓ ANewDayStartsAtOne
  ✓ ADayChangesOnlyForward
  ✓ AnAllowanceNeverChangesOrganization
  ✓ OnlyItsOwnOrganizationTakesACall
  ✓ AViewerTakesOnlyTheAssistantsCall

--- not part of Verify.render: from report.explored ---
depth 3, sequences 3273, states 2163, truncated false, every sequence of up to 3 commands run


=== AllowanceDayText: the day as its UTC date text
NotVerified

AllowanceDayText: 7 rules, 1 commands

Checked: in every sequence of up to 3 commands on a new instance
  ✓ NeverMoreThanFortyInADay
      not proved for TakeCall: applies > to values the prover cannot do arithmetic on
  ✓ WithinADayTheCountRisesByOne
      not proved for TakeCall: applies > to values the prover cannot do arithmetic on
  ✓ ANewDayStartsAtOne
      not proved for TakeCall: applies > to values the prover cannot do arithmetic on
  ✓ ADayChangesOnlyForward
      not proved for TakeCall: applies > to values the prover cannot do arithmetic on
  ✓ AnAllowanceNeverChangesOrganization
      not proved for TakeCall: applies > to values the prover cannot do arithmetic on
  ✓ OnlyItsOwnOrganizationTakesACall
      not proved for TakeCall: applies > to values the prover cannot do arithmetic on
  ✓ AViewerTakesOnlyTheAssistantsCall
      not proved for TakeCall: applies > to values the prover cannot do arithmetic on

Not done
  ✗ the explorer could not read allow5/AllowanceDayText.aggregate.ts:67: the sequences through it were not run

AllowanceDayText: 1 invariants, 6 transitions, 1 commands

✗ The state stays in its schema
    ✓ holds on the initial state
    ✗ TakeCall: not read
        allow5/AllowanceDayText.aggregate.ts:67
        applies > to values the prover cannot do arithmetic on

✗ NeverMoreThanFortyInADay
    ✓ holds on the initial state
    ✗ TakeCall: not read
        allow5/AllowanceDayText.aggregate.ts:67
        applies > to values the prover cannot do arithmetic on
    ✗ proved only from a state in the schema, which TakeCall may leave

✗ WithinADayTheCountRisesByOne
    ✗ TakeCall: not read
        allow5/AllowanceDayText.aggregate.ts:67
        applies > to values the prover cannot do arithmetic on
    ✗ proved only from a state in the schema, which TakeCall may leave

✗ ANewDayStartsAtOne
    ✗ TakeCall: not read
        allow5/AllowanceDayText.aggregate.ts:67
        applies > to values the prover cannot do arithmetic on
    ✗ proved only from a state in the schema, which TakeCall may leave

✗ ADayChangesOnlyForward
    ✗ TakeCall: not read
        allow5/AllowanceDayText.aggregate.ts:67
        applies > to values the prover cannot do arithmetic on
    ✗ proved only from a state in the schema, which TakeCall may leave

✗ AnAllowanceNeverChangesOrganization
    ✗ TakeCall: not read
        allow5/AllowanceDayText.aggregate.ts:67
        applies > to values the prover cannot do arithmetic on
    ✗ proved only from a state in the schema, which TakeCall may leave

✗ OnlyItsOwnOrganizationTakesACall
    ✗ TakeCall: not read
        allow5/AllowanceDayText.aggregate.ts:67
        applies > to values the prover cannot do arithmetic on
    ✗ proved only from a state in the schema, which TakeCall may leave

✗ AViewerTakesOnlyTheAssistantsCall
    ✗ TakeCall: not read
        allow5/AllowanceDayText.aggregate.ts:67
        applies > to values the prover cannot do arithmetic on
    ✗ proved only from a state in the schema, which TakeCall may leave

Assuming:
  - whole numbers are exact: a number stays within ±2^53, and a bigint has no limit
  - an event or rejection whose fields fail its schema crashes the command, and nothing is committed

AllowanceDayText: every sequence of up to 3 commands on a new instance
137 sequences, 7 states

✓ NeverMoreThanFortyInADay holds in the 7 states reached
✓ WithinADayTheCountRisesByOne holds on the 7 steps taken
✓ ANewDayStartsAtOne holds on the 7 steps taken
✓ ADayChangesOnlyForward holds on the 7 steps taken
✓ AnAllowanceNeverChangesOrganization holds on the 7 steps taken
✓ OnlyItsOwnOrganizationTakesACall holds on the 7 steps taken
✓ AViewerTakesOnlyTheAssistantsCall holds on the 7 steps taken

Reached 2 of 3 outcomes

  TakeCall → CallTaken
      1. TakeCall { organizationId: "", purpose: "view" } as { organizationId: "", memberId: "", role: "admin" }  → CallTaken

  TakeCall ✗ NotPermitted
      1. TakeCall { organizationId: "A", purpose: "view" } as { organizationId: "", memberId: "", role: "admin" }  → ✗ NotPermitted

Not reached in 3 commands
  TakeCall ✗ DayUsedUp

States reached: Counting; not reached: Fresh

Not read
  allow5/AllowanceDayText.aggregate.ts:67  applies > to values the prover cannot do arithmetic on
--- not part of Verify.render: from report.explored ---
depth 3, sequences 137, states 7, truncated false, every sequence of up to 2 commands run
```

`AllowanceRolling.aggregate.ts`, today's rule (40 in any 24 hours), the times of the day's calls held as a list:

```ts
// Variant 2, the app's rule today: 40 model calls in any rolling 24 hours per organization. The state holds the times
// (epoch milliseconds) of the calls of the last 24 hours, at most 40; a call forgets the ones older than a day.
import * as Domain from "@alchemy.run/domain"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as S from "effect/Schema"
import { CurrentActor, Session } from "../test/Actor.context.ts"

const DAILY_CALLS = 40
const DAY_MS = 86_400_000
// The app's three purposes: a viewer may make the table assistant's call ("view"); "check" and "suggest" need an editor.
export const Purpose = S.Literals(["view", "check", "suggest"])

// One call counted at the time it was taken.
export class CallTaken extends Domain.Event("CallTaken", { organizationId: S.String, at: S.Int }) {}
export class DayUsedUp extends Domain.Rejection("DayUsedUp", {}) {}
export class NotPermitted extends Domain.Rejection("NotPermitted", {}) {}

export class TakeCall extends Domain.Command("TakeCall", {
  middleware: [Session],
  input: { organizationId: S.String, purpose: Purpose },
  events: [CallTaken],
  rejects: [DayUsedUp, NotPermitted],
}) {}

export const AllowanceState = S.Union([
  S.TaggedStruct("Fresh", {}),
  S.TaggedStruct("Counting", {
    organizationId: S.String,
    calls: S.Array(S.Int).check(S.isMaxLength(DAILY_CALLS)),
  }),
])

export class AllowanceRolling extends Domain.Aggregate("AllowanceRolling", {
  id: S.String,
  state: AllowanceState,
  initial: { _tag: "Fresh" },
  invariants: {
    // Never more than 40 calls held for the last 24 hours.
    NeverMoreThanFortyHeld: (s) => s._tag === "Fresh" || s.calls.length <= DAILY_CALLS,
  },
  transitions: {
    // A call adds at most one held call.
    ACallAddsAtMostOne: ({ before, after }) =>
      after._tag !== "Counting" || after.calls.length <= (before._tag === "Counting" ? before.calls.length : 0) + 1,
    // What is held after a call is only calls of the 24 hours before it: so 40 held is 40 in that day.
    OnlyTheLastDaysCallsAreHeld: ({ after, events }) =>
      after._tag !== "Counting" || events.every((e) => after.calls.every((t) => t > e.at - DAY_MS)),
    // An allowance never changes organization, and only its own organization takes from it.
    AnAllowanceNeverChangesOrganization: ({ before, after }) =>
      before._tag !== "Counting" || after._tag !== "Counting" || before.organizationId === after.organizationId,
    OnlyItsOwnOrganizationTakesACall: Effect.fn(function* ({ command }) {
      return (yield* CurrentActor).organizationId === command.organizationId
    }),
    // A viewer takes only the table assistant's call.
    AViewerTakesOnlyTheAssistantsCall: Effect.fn(function* ({ command }) {
      return (yield* CurrentActor).role !== "viewer" || command.purpose === "view"
    }),
  },
  commands: [TakeCall],
  keyOf: (cmd) => cmd.organizationId,
  decide: {
    TakeCall: Effect.fn(function* (s, cmd, { now }) {
      const actor = yield* CurrentActor
      if (actor.organizationId !== cmd.organizationId) return yield* new NotPermitted({})
      if (actor.role === "viewer" && cmd.purpose !== "view") return yield* new NotPermitted({})
      const at = DateTime.toEpochMillis(now)
      // The calls of the 24 hours before now count; 40 of them refuse the call until the oldest is a day old.
      if (s._tag === "Counting" && s.calls.filter((t) => t > at - DAY_MS).length >= DAILY_CALLS) {
        return yield* new DayUsedUp({})
      }
      return [new CallTaken({ organizationId: cmd.organizationId, at })]
    }),
  },
  evolve: {
    // The organization is set by the first call and kept: the key is the organization.
    CallTaken: (s, e) =>
      s._tag === "Counting"
        ? { ...s, calls: [...s.calls.filter((t) => t > e.at - DAY_MS), e.at] }
        : { _tag: "Counting" as const, organizationId: e.organizationId, calls: [e.at] },
  },
}) {}
```

```text
VERIFIED
AllowanceRolling: 6 rules, 1 commands

Checked: in every sequence of up to 3 commands on a new instance
  ✓ NeverMoreThanFortyHeld
      not proved for TakeCall: state.calls was tried with up to 2 items
  ✓ ACallAddsAtMostOne
      not proved for TakeCall: state.calls was tried with up to 2 items
  ✓ OnlyTheLastDaysCallsAreHeld
      not proved for TakeCall: state.calls was tried with up to 2 items
  ✓ AnAllowanceNeverChangesOrganization
      not proved for TakeCall: state.calls was tried with up to 2 items
  ✓ OnlyItsOwnOrganizationTakesACall
      not proved for TakeCall: state.calls was tried with up to 2 items
  ✓ AViewerTakesOnlyTheAssistantsCall
      not proved for TakeCall: state.calls was tried with up to 2 items

--- not part of Verify.render: from report.explored ---
depth 3, sequences 3224, states 2163, truncated false, every sequence of up to 3 commands run
```

`Allowance.story.test.ts`:

```ts
// The allowance's days as stories on the real models, every call sent as a command with the story's clock set:
// the UTC day (AllowanceDay) and, for contrast, the rolling 24 hours the app runs today (AllowanceRolling).
import { Story } from "@alchemy.run/domain/Story"
import { it } from "@effect/vitest"
import { CurrentActor } from "../test/Actor.context.ts"
import { DayAllowance, RollingAllowance } from "./Allowance.model.ts"
import * as Day from "./AllowanceDay.aggregate.ts"
import * as Rolling from "./AllowanceRolling.aggregate.ts"

const DAY_MS = 86_400_000
const dayOf = (iso: string) => Math.floor(Date.parse(iso) / DAY_MS)
const ana = { organizationId: "org_prairie", memberId: "ana", role: "editor" as const }
const take = { organizationId: "org_prairie", purpose: "view" as const }

const dayStory = Story.make(DayAllowance)
const dayRef = Day.AllowanceDay.ref("org_prairie")
// n accepted calls, each counted against `day`.
const dayCalls = (n: number, day: number) =>
  Array.from({ length: n }, () => [
    Story.when(new Day.TakeCall(take)),
    Story.then(dayRef, new Day.CallTaken({ organizationId: "org_prairie", day })),
  ]).flat()

const rollingStory = Story.make(RollingAllowance)
const rollingRef = Rolling.AllowanceRolling.ref("org_prairie")
// n accepted calls, each taken at `iso`.
const rollingCalls = (n: number, iso: string) =>
  Array.from({ length: n }, () => [
    Story.when(new Rolling.TakeCall(take)),
    Story.then(rollingRef, new Rolling.CallTaken({ organizationId: "org_prairie", at: Date.parse(iso) })),
  ]).flat()

it.effect("UTC day: 40 calls are counted, and the 41st on the same day is refused", () =>
  dayStory(
    Story.provide(CurrentActor, ana),
    Story.clock("2026-01-01T09:00:00.000Z"),
    ...dayCalls(40, dayOf("2026-01-01T09:00:00.000Z")),
    Story.clock("2026-01-01T17:00:00.000Z"),
    Story.when(new Day.TakeCall(take)),
    Story.rejected(new Day.DayUsedUp({ day: dayOf("2026-01-01T00:00:00.000Z") })),
  ),
)

it.effect("UTC day: the next day's first call is counted as 1, so that day has its own 40 and no more", () =>
  dayStory(
    Story.provide(CurrentActor, ana),
    Story.clock("2026-01-01T09:00:00.000Z"),
    ...dayCalls(40, dayOf("2026-01-01T09:00:00.000Z")),
    // No command starts the day: the clock passing midnight UTC is enough.
    Story.clock("2026-01-02T00:00:00.000Z"),
    // Call 1 of the new day names the new day; 39 more are taken, then the 41st of that day is refused.
    ...dayCalls(40, dayOf("2026-01-02T00:00:00.000Z")),
    Story.when(new Day.TakeCall(take)),
    Story.rejected(new Day.DayUsedUp({ day: dayOf("2026-01-02T00:00:00.000Z") })),
  ),
)

it.effect("UTC day: 39 calls at 23:59 and 40 more at 00:01 are all allowed", () =>
  dayStory(
    Story.provide(CurrentActor, ana),
    Story.clock("2026-01-01T23:59:00.000Z"),
    ...dayCalls(39, dayOf("2026-01-01T23:59:00.000Z")),
    Story.clock("2026-01-02T00:01:00.000Z"),
    ...dayCalls(40, dayOf("2026-01-02T00:01:00.000Z")),
    Story.when(new Day.TakeCall(take)),
    Story.rejected(new Day.DayUsedUp({ day: dayOf("2026-01-02T00:01:00.000Z") })),
  ),
)

it.effect("UTC day: the most it allows is 80 calls in two minutes, 40 at 23:59 and 40 at 00:01", () =>
  dayStory(
    Story.provide(CurrentActor, ana),
    Story.clock("2026-01-01T23:59:00.000Z"),
    ...dayCalls(40, dayOf("2026-01-01T23:59:00.000Z")),
    Story.clock("2026-01-02T00:01:00.000Z"),
    ...dayCalls(40, dayOf("2026-01-02T00:01:00.000Z")),
    Story.when(new Day.TakeCall(take)),
    Story.rejected(new Day.DayUsedUp({ day: dayOf("2026-01-02T00:01:00.000Z") })),
  ),
)

it.effect("rolling 24 hours (today's rule): 40 calls at 23:59 refuse the call at 00:01, until 23:59 the next day", () =>
  rollingStory(
    Story.provide(CurrentActor, ana),
    Story.clock("2026-01-01T23:59:00.000Z"),
    ...rollingCalls(40, "2026-01-01T23:59:00.000Z"),
    Story.clock("2026-01-02T00:01:00.000Z"),
    Story.when(new Rolling.TakeCall(take)),
    Story.rejected(new Rolling.DayUsedUp({})),
    // Exactly 24 hours after the 40 calls they no longer count.
    Story.clock("2026-01-02T23:59:00.000Z"),
    ...rollingCalls(1, "2026-01-02T23:59:00.000Z"),
  ),
)

it.effect("a viewer is refused a suggestion call and takes the table assistant's", () =>
  dayStory(
    Story.provide(CurrentActor, { ...ana, memberId: "vic", role: "viewer" as const }),
    Story.when(new Day.TakeCall({ organizationId: "org_prairie", purpose: "suggest" })),
    Story.rejected(new Day.NotPermitted({})),
    ...dayCalls(1, dayOf("2026-01-01T00:00:00.000Z")),
  ),
)
```

```text
 ✓ allow5/Allowance.story.test.ts > UTC day: 40 calls are counted, and the 41st on the same day is refused 41ms
 ✓ allow5/Allowance.story.test.ts > UTC day: the next day's first call is counted as 1, so that day has its own 40 and no more 21ms
 ✓ allow5/Allowance.story.test.ts > UTC day: 39 calls at 23:59 and 40 more at 00:01 are all allowed 19ms
 ✓ allow5/Allowance.story.test.ts > UTC day: the most it allows is 80 calls in two minutes, 40 at 23:59 and 40 at 00:01 23ms
 ✓ allow5/Allowance.story.test.ts > rolling 24 hours (today's rule): 40 calls at 23:59 refuse the call at 00:01, until 23:59 the next day 15ms
 ✓ allow5/Allowance.story.test.ts > a viewer is refused a suggestion call and takes the table assistant's 3ms
      Tests  6 passed (6)
```

## Trial 10. Members as their own instances

The second round's organization held two counts, and its commands named no member and trusted the role they stated.
Here each member is its own instance (`Absent`, `In { role }`, `Out`), keyed `<organization>/<member>`, beside an
organization of counts; adding, changing a role and removing are decisions that read the organization, the member
and the sender's own member record, so the role moved is read from the record and an admin demoted a moment ago is
refused at once.

`Organization.aggregate.ts`:

```ts
// The app's rule: an organization always keeps an admin. The organization holds its people as counts by role; the
// counts move only by what the Membership decisions read from a Member instance, never by a role a command states.
import * as Domain from "@alchemy.run/domain"
import * as Effect from "effect/Effect"
import * as S from "effect/Schema"
import { CurrentActor } from "../test/Actor.context.ts"
import { Role } from "./Member.aggregate.ts"

export class OrganizationFounded extends Domain.Event("OrganizationFounded", { organizationId: S.String }) {}
// Each carries the role as the member's record held it (or, for a join, the role the new member is given).
export class JoinCounted extends Domain.Event("JoinCounted", { role: Role }) {}
export class RoleChangeCounted extends Domain.Event("RoleChangeCounted", { from: Role, to: Role }) {}
export class LeaveCounted extends Domain.Event("LeaveCounted", { role: Role }) {}

export const OrganizationState = S.Union([
  S.TaggedStruct("Unfounded", {}),
  S.TaggedStruct("Founded", { organizationId: S.String, admins: S.Int, others: S.Int }),
])

/** One organization's people, counted by whether they are an admin. */
export class Organization extends Domain.Aggregate("Organization", {
  id: S.String,
  state: OrganizationState,
  initial: { _tag: "Unfounded" },
  invariants: {
    AlwaysKeepsAnAdmin: (s) => s._tag !== "Founded" || s.admins >= 1,
    NobodyIsCountedBelowZero: (s) => s._tag !== "Founded" || s.others >= 0,
  },
  transitions: {
    AFoundedOrganizationStaysFounded: ({ before, after }) => before._tag !== "Founded" || after._tag === "Founded",
    AnOrganizationNeverChangesItsId: ({ before, after }) =>
      before._tag !== "Founded" || (after._tag === "Founded" && after.organizationId === before.organizationId),
    // Only someone signed in to this organization changes it.
    OnlyItsOwnOrganizationChangesIt: Effect.fn(function* ({ after }) {
      if (after._tag !== "Founded") return true
      return (yield* CurrentActor).organizationId === after.organizationId
    }),
    AViewerChangesNothing: Effect.fn(function* () {
      return (yield* CurrentActor).role !== "viewer"
    }),
  },
  events: [OrganizationFounded, JoinCounted, RoleChangeCounted, LeaveCounted],
  evolve: {
    // The founder is its first admin.
    OrganizationFounded: (_, e) => ({ _tag: "Founded" as const, organizationId: e.organizationId, admins: 1, others: 0 }),
    JoinCounted: (s, e) =>
      s._tag !== "Founded" ? s : e.role === "admin" ? { ...s, admins: s.admins + 1 } : { ...s, others: s.others + 1 },
    RoleChangeCounted: (s, e) =>
      s._tag !== "Founded"
        ? s
        : e.from === "admin" && e.to !== "admin"
          ? { ...s, admins: s.admins - 1, others: s.others + 1 }
          : e.from !== "admin" && e.to === "admin"
            ? { ...s, admins: s.admins + 1, others: s.others - 1 }
            : s,
    LeaveCounted: (s, e) =>
      s._tag !== "Founded" ? s : e.role === "admin" ? { ...s, admins: s.admins - 1 } : { ...s, others: s.others - 1 },
  },
}) {}
```

`Member.aggregate.ts`:

```ts
// One person's place in one organization, as its own instance keyed `<organizationId>/<memberId>`: never there,
// in with a role, or out. It decides nothing alone: the Membership decisions record on it, beside the organization.
import * as Domain from "@alchemy.run/domain"
import * as Effect from "effect/Effect"
import * as S from "effect/Schema"
import { CurrentActor } from "../test/Actor.context.ts"

export const Role = S.Literals(["admin", "editor", "viewer"])

/** The key of one person within one organization. */
export const memberKey = (organizationId: string, memberId: string) => `${organizationId}/${memberId}`

export class MemberJoined extends Domain.Event("MemberJoined", {
  organizationId: S.String,
  memberId: S.String,
  role: Role,
}) {}
export class MemberRoleSet extends Domain.Event("MemberRoleSet", { role: Role }) {}
export class MemberLeft extends Domain.Event("MemberLeft", {}) {}

export const MemberState = S.Union([
  S.TaggedStruct("Absent", {}),
  S.TaggedStruct("In", { organizationId: S.String, memberId: S.String, role: Role }),
  S.TaggedStruct("Out", { organizationId: S.String, memberId: S.String }),
])
export type MemberState = typeof MemberState.Type

/** 1 when this member is counted among the organization's admins, else 0. */
export const asAdmin = (s: MemberState): number => (s._tag === "In" && s.role === "admin" ? 1 : 0)
/** 1 when this member is counted among the organization's others (editors and viewers), else 0. */
export const asOther = (s: MemberState): number => (s._tag === "In" && s.role !== "admin" ? 1 : 0)

export class Member extends Domain.Aggregate("Member", {
  id: S.String,
  state: MemberState,
  initial: { _tag: "Absent" },
  transitions: {
    // Once a person has been in an organization, the record stays theirs and that organization's.
    AMemberNeverChangesOrganization: ({ before, after }) =>
      before._tag === "Absent" ||
      (after._tag !== "Absent" &&
        after.organizationId === before.organizationId &&
        after.memberId === before.memberId),
    // Only someone signed in to the member's organization changes it.
    OnlyItsOwnOrganizationChangesAMember: Effect.fn(function* ({ after }) {
      if (after._tag === "Absent") return true
      return (yield* CurrentActor).organizationId === after.organizationId
    }),
    // A session that says viewer changes nobody.
    AViewerChangesNothing: Effect.fn(function* () {
      return (yield* CurrentActor).role !== "viewer"
    }),
  },
  events: [MemberJoined, MemberRoleSet, MemberLeft],
  evolve: {
    MemberJoined: (_, e) => ({
      _tag: "In" as const,
      organizationId: e.organizationId,
      memberId: e.memberId,
      role: e.role,
    }),
    MemberRoleSet: (s, e) => (s._tag !== "In" ? s : { ...s, role: e.role }),
    MemberLeft: (s) =>
      s._tag !== "In" ? s : { _tag: "Out" as const, organizationId: s.organizationId, memberId: s.memberId },
  },
}) {}
```

`Membership.decision.ts`:

```ts
// Who is in an organization changes only through these four decisions, each across the organization and one Member
// instance, recorded on both or on neither. The member's current role is read from its record, never from the
// command. Permission is checked twice: the session (who is asking; its role can lag behind the database) and the
// asker's own Member instance, read as a third instance, so an admin demoted a moment ago is refused at once.
import * as Domain from "@alchemy.run/domain"
import * as Effect from "effect/Effect"
import * as S from "effect/Schema"
import { CurrentActor, Session } from "../test/Actor.context.ts"
import { asAdmin, asOther, Member, MemberJoined, memberKey, MemberLeft, MemberRoleSet, Role } from "./Member.aggregate.ts"
import { JoinCounted, LeaveCounted, Organization, OrganizationFounded, RoleChangeCounted } from "./Organization.aggregate.ts"

export class AlreadyFounded extends Domain.Rejection("AlreadyFounded", {}) {}
export class NotFounded extends Domain.Rejection("NotFounded", {}) {}
// The session does not belong to this organization, is not the person the command names as its sender, or says
// they are not an admin.
export class NotPermitted extends Domain.Rejection("NotPermitted", {}) {}
// The sender's own Member record does not say they are an admin of this organization now.
export class NotAnAdmin extends Domain.Rejection("NotAnAdmin", {}) {}
export class AlreadyAMember extends Domain.Rejection("AlreadyAMember", {}) {}
export class NotAMember extends Domain.Rejection("NotAMember", {}) {}
export class LastAdmin extends Domain.Rejection("LastAdmin", {}) {}
// The counts say nobody holds the member's kind of role: a state no sequence of these decisions reaches (the model's
// TheCountsAreTheMembers), refused so that no count goes below zero from a state the prover is free to assume.
export class CountsOutOfStep extends Domain.Rejection("CountsOutOfStep", {}) {}

export class FoundOrganization extends Domain.Command("FoundOrganization", {
  middleware: [Session],
  input: { organizationId: S.String, memberId: S.String },
  events: [OrganizationFounded, MemberJoined],
  rejects: [AlreadyFounded, NotPermitted, AlreadyAMember],
}) {}
// `by` names the sender's Member instance so the decision can read it; the session must agree that it is them.
export class AddMember extends Domain.Command("AddMember", {
  middleware: [Session],
  input: { organizationId: S.String, memberId: S.String, role: Role, by: S.String },
  events: [MemberJoined, JoinCounted],
  rejects: [NotFounded, NotPermitted, NotAnAdmin, AlreadyAMember],
}) {}
export class ChangeRole extends Domain.Command("ChangeRole", {
  middleware: [Session],
  input: { organizationId: S.String, memberId: S.String, to: Role, by: S.String },
  events: [MemberRoleSet, RoleChangeCounted],
  rejects: [NotFounded, NotPermitted, NotAnAdmin, NotAMember, LastAdmin, CountsOutOfStep],
}) {}
export class RemoveMember extends Domain.Command("RemoveMember", {
  middleware: [Session],
  input: { organizationId: S.String, memberId: S.String, by: S.String },
  events: [MemberLeft, LeaveCounted],
  rejects: [NotFounded, NotPermitted, NotAnAdmin, NotAMember, LastAdmin, CountsOutOfStep],
}) {}

/** The person who signs up founds the organization and is its first admin, in its record and in its counts. */
export class Founding extends Domain.Decision(FoundOrganization, {
  reads: { organization: Organization, founder: Member },
  keyOf: (cmd) => ({ organization: cmd.organizationId, founder: memberKey(cmd.organizationId, cmd.memberId) }),
  decide: Effect.fn(function* ({ organization, founder }, cmd) {
    const actor = yield* CurrentActor
    if (organization.state._tag !== "Unfounded") return yield* new AlreadyFounded({})
    if (actor.organizationId !== cmd.organizationId || actor.memberId !== cmd.memberId || actor.role !== "admin") {
      return yield* new NotPermitted({})
    }
    if (founder.state._tag !== "Absent") return yield* new AlreadyAMember({})
    return [
      organization.record(new OrganizationFounded({ organizationId: cmd.organizationId })),
      founder.record(new MemberJoined({ organizationId: cmd.organizationId, memberId: cmd.memberId, role: "admin" })),
    ]
  }),
  transitions: {
    // The new organization counts one admin, and that admin is the founder's record.
    TheFounderIsTheOneAdmin: ({ after, command }) =>
      after.organization._tag === "Founded" &&
      after.organization.admins === 1 &&
      after.organization.others === 0 &&
      after.founder._tag === "In" &&
      after.founder.role === "admin" &&
      after.founder.memberId === command.memberId,
  },
}) {}

/** An admin adds a person with a role; a person who left may be added again, to the same organization only. */
export class Adding extends Domain.Decision(AddMember, {
  reads: { organization: Organization, member: Member, acting: Member },
  keyOf: (cmd) => ({
    organization: cmd.organizationId,
    member: memberKey(cmd.organizationId, cmd.memberId),
    acting: memberKey(cmd.organizationId, cmd.by),
  }),
  decide: Effect.fn(function* ({ organization, member, acting }, cmd) {
    const actor = yield* CurrentActor
    if (organization.state._tag !== "Founded" || organization.state.organizationId !== cmd.organizationId) {
      return yield* new NotFounded({})
    }
    if (actor.organizationId !== cmd.organizationId || actor.memberId !== cmd.by || actor.role !== "admin") {
      return yield* new NotPermitted({})
    }
    if (
      acting.state._tag !== "In" ||
      acting.state.organizationId !== cmd.organizationId ||
      acting.state.memberId !== cmd.by ||
      acting.state.role !== "admin"
    ) {
      return yield* new NotAnAdmin({})
    }
    if (member.state._tag === "In") return yield* new AlreadyAMember({})
    if (
      member.state._tag === "Out" &&
      (member.state.organizationId !== cmd.organizationId || member.state.memberId !== cmd.memberId)
    ) {
      return yield* new NotPermitted({})
    }
    return [
      member.record(new MemberJoined({ organizationId: cmd.organizationId, memberId: cmd.memberId, role: cmd.role })),
      organization.record(new JoinCounted({ role: cmd.role })),
    ]
  }),
  transitions: {
    // The organization's counts move by exactly the change in this one member's record.
    TheCountsMoveOnlyWithTheMembersRole: ({ before, after }) =>
      before.organization._tag === "Founded" &&
      after.organization._tag === "Founded" &&
      after.organization.admins - before.organization.admins === asAdmin(after.member) - asAdmin(before.member) &&
      after.organization.others - before.organization.others === asOther(after.member) - asOther(before.member),
    // An admin is made only by someone whose own record says they are an admin of the organization now.
    AnAdminIsChangedOnlyByAnAdminInTheRecord: Effect.fn(function* ({ before, after }) {
      if (asAdmin(before.member) === 0 && asAdmin(after.member) === 0) return true
      const actor = yield* CurrentActor
      return (
        before.acting._tag === "In" &&
        before.acting.role === "admin" &&
        before.acting.memberId === actor.memberId &&
        before.acting.organizationId === actor.organizationId
      )
    }),
    ARecordedViewerChangesNothing: ({ before }) => before.acting._tag !== "In" || before.acting.role !== "viewer",
  },
}) {}

/** An admin changes a member's role; the role it changes from is the one the member's record holds. */
export class Changing extends Domain.Decision(ChangeRole, {
  reads: { organization: Organization, member: Member, acting: Member },
  keyOf: (cmd) => ({
    organization: cmd.organizationId,
    member: memberKey(cmd.organizationId, cmd.memberId),
    acting: memberKey(cmd.organizationId, cmd.by),
  }),
  decide: Effect.fn(function* ({ organization, member, acting }, cmd) {
    const actor = yield* CurrentActor
    if (organization.state._tag !== "Founded" || organization.state.organizationId !== cmd.organizationId) {
      return yield* new NotFounded({})
    }
    if (actor.organizationId !== cmd.organizationId || actor.memberId !== cmd.by || actor.role !== "admin") {
      return yield* new NotPermitted({})
    }
    if (
      acting.state._tag !== "In" ||
      acting.state.organizationId !== cmd.organizationId ||
      acting.state.memberId !== cmd.by ||
      acting.state.role !== "admin"
    ) {
      return yield* new NotAnAdmin({})
    }
    if (
      member.state._tag !== "In" ||
      member.state.organizationId !== cmd.organizationId ||
      member.state.memberId !== cmd.memberId
    ) {
      return yield* new NotAMember({})
    }
    const from = member.state.role
    if (from === cmd.to) return []
    if (from === "admin" && organization.state.admins <= 1) return yield* new LastAdmin({})
    if (from !== "admin" && organization.state.others <= 0) return yield* new CountsOutOfStep({})
    return [
      member.record(new MemberRoleSet({ role: cmd.to })),
      organization.record(new RoleChangeCounted({ from, to: cmd.to })),
    ]
  }),
  transitions: {
    TheCountsMoveOnlyWithTheMembersRole: ({ before, after }) =>
      before.organization._tag === "Founded" &&
      after.organization._tag === "Founded" &&
      after.organization.admins - before.organization.admins === asAdmin(after.member) - asAdmin(before.member) &&
      after.organization.others - before.organization.others === asOther(after.member) - asOther(before.member),
    // Promoting to admin or demoting an admin is done only by someone whose own record says admin now.
    AnAdminIsChangedOnlyByAnAdminInTheRecord: Effect.fn(function* ({ before, after }) {
      if (asAdmin(before.member) === 0 && asAdmin(after.member) === 0) return true
      const actor = yield* CurrentActor
      return (
        before.acting._tag === "In" &&
        before.acting.role === "admin" &&
        before.acting.memberId === actor.memberId &&
        before.acting.organizationId === actor.organizationId
      )
    }),
    ARecordedViewerChangesNothing: ({ before }) => before.acting._tag !== "In" || before.acting.role !== "viewer",
  },
}) {}

/** An admin removes a member; whether an admin left is read from the member's record. */
export class Removing extends Domain.Decision(RemoveMember, {
  reads: { organization: Organization, member: Member, acting: Member },
  keyOf: (cmd) => ({
    organization: cmd.organizationId,
    member: memberKey(cmd.organizationId, cmd.memberId),
    acting: memberKey(cmd.organizationId, cmd.by),
  }),
  decide: Effect.fn(function* ({ organization, member, acting }, cmd) {
    const actor = yield* CurrentActor
    if (organization.state._tag !== "Founded" || organization.state.organizationId !== cmd.organizationId) {
      return yield* new NotFounded({})
    }
    if (actor.organizationId !== cmd.organizationId || actor.memberId !== cmd.by || actor.role !== "admin") {
      return yield* new NotPermitted({})
    }
    if (
      acting.state._tag !== "In" ||
      acting.state.organizationId !== cmd.organizationId ||
      acting.state.memberId !== cmd.by ||
      acting.state.role !== "admin"
    ) {
      return yield* new NotAnAdmin({})
    }
    if (
      member.state._tag !== "In" ||
      member.state.organizationId !== cmd.organizationId ||
      member.state.memberId !== cmd.memberId
    ) {
      return yield* new NotAMember({})
    }
    const role = member.state.role
    if (role === "admin" && organization.state.admins <= 1) return yield* new LastAdmin({})
    if (role !== "admin" && organization.state.others <= 0) return yield* new CountsOutOfStep({})
    return [member.record(new MemberLeft({})), organization.record(new LeaveCounted({ role }))]
  }),
  transitions: {
    TheCountsMoveOnlyWithTheMembersRole: ({ before, after }) =>
      before.organization._tag === "Founded" &&
      after.organization._tag === "Founded" &&
      after.organization.admins - before.organization.admins === asAdmin(after.member) - asAdmin(before.member) &&
      after.organization.others - before.organization.others === asOther(after.member) - asOther(before.member),
    // An admin is removed only by someone whose own record says admin now.
    AnAdminIsChangedOnlyByAnAdminInTheRecord: Effect.fn(function* ({ before, after }) {
      if (asAdmin(before.member) === 0 && asAdmin(after.member) === 0) return true
      const actor = yield* CurrentActor
      return (
        before.acting._tag === "In" &&
        before.acting.role === "admin" &&
        before.acting.memberId === actor.memberId &&
        before.acting.organizationId === actor.organizationId
      )
    }),
    ARecordedViewerChangesNothing: ({ before }) => before.acting._tag !== "In" || before.acting.role !== "viewer",
  },
}) {}
```

`Access.model.ts`:

```ts
// Who is in an organization as one model: the organization's counts, each member as its own instance, and the four
// decisions that change both together. Two rules tie the counts to the members, and neither can be proved.
import * as Domain from "@alchemy.run/domain"
import { Member } from "./Member.aggregate.ts"
import { Adding, Changing, Founding, Removing } from "./Membership.decision.ts"
import { Organization } from "./Organization.aggregate.ts"

export class Access extends Domain.Model("Access", {
  aggregates: [Organization, Member],
  decisions: [Founding, Adding, Changing, Removing],
  relations: {
    // A relation sees one organization and one member at a time, so it can say only that a member who is in is
    // counted (at least one of their kind), not that the counts equal the members. A decision that moves one member
    // can't show the count stays above another member of the same kind, so expect this to be checked, not proved.
    AMemberWhoIsInIsCounted: Domain.Relation({
      over: { organization: Organization, member: Member },
      holds: ({ organization, member }) =>
        member.state._tag !== "In" ||
        member.state.organizationId !== organization.id ||
        (organization.state._tag === "Founded" &&
          (member.state.role === "admin" ? organization.state.admins >= 1 : organization.state.others >= 1)),
    }),
  },
  invariants: {
    // The equality itself: every founded organization's counts are the members its records hold in, by kind of
    // role. A model invariant is given every instance and is only searched for a breaking sequence.
    TheCountsAreTheMembers: ({ Organization: organizations, Member: members }) =>
      organizations.every(
        (o) =>
          o.state._tag !== "Founded" ||
          (o.state.admins ===
            members.filter((m) => m.state._tag === "In" && m.state.organizationId === o.id && m.state.role === "admin")
              .length &&
            o.state.others ===
              members.filter(
                (m) => m.state._tag === "In" && m.state.organizationId === o.id && m.state.role !== "admin",
              ).length),
      ),
  },
}) {}

export class AccessApi extends Domain.Api("AccessApi", { model: Access }) {}
```

`Verify.model(Access)`, two passes (the defaults, then 4 commands deep with 3 instances), 87.87 s, whole:

```text
VERIFIED
=== pass 1: Verify.model defaults (depth 2, 2 instances) ===
proved  Organization.AlwaysKeepsAnAdmin
proved  Organization.NobodyIsCountedBelowZero
proved  Organization.AFoundedOrganizationStaysFounded
proved  Organization.AnOrganizationNeverChangesItsId
proved  Organization.OnlyItsOwnOrganizationChangesIt
proved  Organization.AViewerChangesNothing
proved  Member.AMemberNeverChangesOrganization
proved  Member.OnlyItsOwnOrganizationChangesAMember
proved  Member.AViewerChangesNothing
proved  FoundOrganization.TheFounderIsTheOneAdmin
proved  AddMember.TheCountsMoveOnlyWithTheMembersRole
proved  AddMember.AnAdminIsChangedOnlyByAnAdminInTheRecord
proved  AddMember.ARecordedViewerChangesNothing
proved  ChangeRole.TheCountsMoveOnlyWithTheMembersRole
proved  ChangeRole.AnAdminIsChangedOnlyByAnAdminInTheRecord
proved  ChangeRole.ARecordedViewerChangesNothing
proved  RemoveMember.TheCountsMoveOnlyWithTheMembersRole
proved  RemoveMember.AnAdminIsChangedOnlyByAnAdminInTheRecord
proved  RemoveMember.ARecordedViewerChangesNothing
checked  Access.TheCountsAreTheMembers
checked  Access.AMemberWhoIsInIsCounted

Access: 27 outcomes, 4 decisions

Proved: for every state and every input, after any number of commands
  ✓ Organization.AlwaysKeepsAnAdmin
  ✓ Organization.NobodyIsCountedBelowZero
  ✓ Organization.AFoundedOrganizationStaysFounded
  ✓ Organization.AnOrganizationNeverChangesItsId
  ✓ Organization.OnlyItsOwnOrganizationChangesIt
  ✓ Organization.AViewerChangesNothing
  ✓ Member.AMemberNeverChangesOrganization
  ✓ Member.OnlyItsOwnOrganizationChangesAMember
  ✓ Member.AViewerChangesNothing
  ✓ FoundOrganization.TheFounderIsTheOneAdmin
  ✓ AddMember.TheCountsMoveOnlyWithTheMembersRole
  ✓ AddMember.AnAdminIsChangedOnlyByAnAdminInTheRecord
  ✓ AddMember.ARecordedViewerChangesNothing
  ✓ ChangeRole.TheCountsMoveOnlyWithTheMembersRole
  ✓ ChangeRole.AnAdminIsChangedOnlyByAnAdminInTheRecord
  ✓ ChangeRole.ARecordedViewerChangesNothing
  ✓ RemoveMember.TheCountsMoveOnlyWithTheMembersRole
  ✓ RemoveMember.AnAdminIsChangedOnlyByAnAdminInTheRecord
  ✓ RemoveMember.ARecordedViewerChangesNothing

Checked: in every sequence of up to 2 commands through AccessApi, with each event delivered twice, each reaction also run behind the others that wait
10,212 sequences, 93 states
  ✓ Access.TheCountsAreTheMembers
  ✓ Access.AMemberWhoIsInIsCounted
      not proved for ChangeRole: the solver gave two instances the one id Member/

Sampled: 200 longer sequences, of up to 1 commands picked at random (seed 1)
  ✓ none breaks a rule

Run on the real model: 19 sequences the explorer found, as stories
  ✓ the model does what the explorer read in each

Assumed
  - whole numbers are exact: a number stays within ±2^53, and a bigint has no limit
  - a list an input holds has up to 2 items more than its schema asks for
  - an external system answers what its schema allows, and nothing else
  - middleware lets every caller in: who sends a command is anyone its request context allows
  - what a projection writes, and what a stream or a query gives, is not checked: only what a projection is given
  - a decision's events commit on every instance it recorded on, or on none: how a platform commits them is not checked
--- not part of Verify.render: from report.explored ---
depth 2, sequences 10212, states 93, truncated false, every sequence of up to 2 commands run

VERIFIED
=== pass 2: depth 4, 3 instances ===
proved  Organization.AlwaysKeepsAnAdmin
proved  Organization.NobodyIsCountedBelowZero
proved  Organization.AFoundedOrganizationStaysFounded
proved  Organization.AnOrganizationNeverChangesItsId
proved  Organization.OnlyItsOwnOrganizationChangesIt
proved  Organization.AViewerChangesNothing
proved  Member.AMemberNeverChangesOrganization
proved  Member.OnlyItsOwnOrganizationChangesAMember
proved  Member.AViewerChangesNothing
proved  FoundOrganization.TheFounderIsTheOneAdmin
proved  AddMember.TheCountsMoveOnlyWithTheMembersRole
proved  AddMember.AnAdminIsChangedOnlyByAnAdminInTheRecord
proved  AddMember.ARecordedViewerChangesNothing
proved  ChangeRole.TheCountsMoveOnlyWithTheMembersRole
proved  ChangeRole.AnAdminIsChangedOnlyByAnAdminInTheRecord
proved  ChangeRole.ARecordedViewerChangesNothing
proved  RemoveMember.TheCountsMoveOnlyWithTheMembersRole
proved  RemoveMember.AnAdminIsChangedOnlyByAnAdminInTheRecord
proved  RemoveMember.ARecordedViewerChangesNothing
checked  Access.TheCountsAreTheMembers
checked  Access.AMemberWhoIsInIsCounted

Access: 27 outcomes, 4 decisions

Proved: for every state and every input, after any number of commands
  ✓ Organization.AlwaysKeepsAnAdmin
  ✓ Organization.NobodyIsCountedBelowZero
  ✓ Organization.AFoundedOrganizationStaysFounded
  ✓ Organization.AnOrganizationNeverChangesItsId
  ✓ Organization.OnlyItsOwnOrganizationChangesIt
  ✓ Organization.AViewerChangesNothing
  ✓ Member.AMemberNeverChangesOrganization
  ✓ Member.OnlyItsOwnOrganizationChangesAMember
  ✓ Member.AViewerChangesNothing
  ✓ FoundOrganization.TheFounderIsTheOneAdmin
  ✓ AddMember.TheCountsMoveOnlyWithTheMembersRole
  ✓ AddMember.AnAdminIsChangedOnlyByAnAdminInTheRecord
  ✓ AddMember.ARecordedViewerChangesNothing
  ✓ ChangeRole.TheCountsMoveOnlyWithTheMembersRole
  ✓ ChangeRole.AnAdminIsChangedOnlyByAnAdminInTheRecord
  ✓ ChangeRole.ARecordedViewerChangesNothing
  ✓ RemoveMember.TheCountsMoveOnlyWithTheMembersRole
  ✓ RemoveMember.AnAdminIsChangedOnlyByAnAdminInTheRecord
  ✓ RemoveMember.ARecordedViewerChangesNothing

Checked: in every sequence of up to 4 commands through AccessApi, with each event delivered twice, each reaction also run behind the others that wait
73,325 sequences, 2,668 states
  ✓ Access.TheCountsAreTheMembers
  ✓ Access.AMemberWhoIsInIsCounted
      not proved for ChangeRole: the solver gave two instances the one id Member/

Sampled: 200 longer sequences, of up to 1 commands picked at random (seed 1)
  ✓ none breaks a rule

Run on the real model: 21 sequences the explorer found, as stories
  ✓ the model does what the explorer read in each

Assumed
  - whole numbers are exact: a number stays within ±2^53, and a bigint has no limit
  - a list an input holds has up to 2 items more than its schema asks for
  - an external system answers what its schema allows, and nothing else
  - middleware lets every caller in: who sends a command is anyone its request context allows
  - what a projection writes, and what a stream or a query gives, is not checked: only what a projection is given
  - a decision's events commit on every instance it recorded on, or on none: how a platform commits them is not checked
--- not part of Verify.render: from report.explored ---
depth 4, sequences 73325, states 2668, truncated false, every sequence of up to 4 commands run
```

`Member.story.test.ts`:

```ts
// Three orderings as stories on the real model: the last admin, an admin demoted a moment ago whose session still
// says admin, and two admins who demote each other. A story sends its commands one after another; "the same moment"
// rests on the decision's commit rule (nothing commits unless every instance it read is unchanged), so of two such
// commands one is decided on what the other recorded.
import { Story } from "@alchemy.run/domain/Story"
import { it } from "@effect/vitest"
import { CurrentActor } from "../test/Actor.context.ts"
import { Access } from "./Access.model.ts"
import { Member, MemberJoined, MemberRoleSet } from "./Member.aggregate.ts"
import {
  ChangeRole,
  FoundOrganization,
  LastAdmin,
  NotAnAdmin,
  RemoveMember,
} from "./Membership.decision.ts"
import { JoinCounted, Organization, OrganizationFounded, RoleChangeCounted } from "./Organization.aggregate.ts"

const story = Story.make(Access)
const org = Organization.ref("org_prairie")
const member = (id: string) => Member.ref(`org_prairie/${id}`)
const joined = (memberId: string, role: "admin" | "editor" | "viewer") =>
  new MemberJoined({ organizationId: "org_prairie", memberId, role })
// Each session says admin: the role a session carries is the one it read at sign-in.
const session = (memberId: string) => ({ organizationId: "org_prairie", memberId, role: "admin" as const })

it.effect("removing or demoting the last admin is refused", () =>
  story(
    Story.provide(CurrentActor, session("dana")),
    Story.when(new FoundOrganization({ organizationId: "org_prairie", memberId: "dana" })),
    Story.then(org, new OrganizationFounded({ organizationId: "org_prairie" })),
    Story.then(member("dana"), joined("dana", "admin")),
    Story.when(new RemoveMember({ organizationId: "org_prairie", memberId: "dana", by: "dana" })),
    Story.rejected(new LastAdmin({})),
    Story.when(new ChangeRole({ organizationId: "org_prairie", memberId: "dana", to: "editor", by: "dana" })),
    Story.rejected(new LastAdmin({})),
  ),
)

it.effect("an admin demoted a moment ago cannot promote anyone, though their session still says admin", () =>
  story(
    Story.given(
      org,
      new OrganizationFounded({ organizationId: "org_prairie" }),
      new JoinCounted({ role: "admin" }),
      new JoinCounted({ role: "editor" }),
    ),
    Story.given(member("dana"), joined("dana", "admin")),
    Story.given(member("ana"), joined("ana", "admin")),
    Story.given(member("carl"), joined("carl", "editor")),
    Story.provide(CurrentActor, session("dana")),
    Story.when(new ChangeRole({ organizationId: "org_prairie", memberId: "ana", to: "editor", by: "dana" })),
    Story.then(member("ana"), new MemberRoleSet({ role: "editor" })),
    Story.then(org, new RoleChangeCounted({ from: "admin", to: "editor" })),
    Story.provide(CurrentActor, session("ana")),
    Story.when(new ChangeRole({ organizationId: "org_prairie", memberId: "carl", to: "admin", by: "ana" })),
    Story.rejected(new NotAnAdmin({})),
    Story.when(new RemoveMember({ organizationId: "org_prairie", memberId: "dana", by: "ana" })),
    Story.rejected(new NotAnAdmin({})),
  ),
)

// Three admins, so the count alone (admins 3, then 2) would let both through: the record is what refuses the second.
it.effect("two admins demote each other at the same moment: one is refused", () =>
  story(
    Story.given(
      org,
      new OrganizationFounded({ organizationId: "org_prairie" }),
      new JoinCounted({ role: "admin" }),
      new JoinCounted({ role: "admin" }),
    ),
    Story.given(member("dana"), joined("dana", "admin")),
    Story.given(member("ana"), joined("ana", "admin")),
    Story.given(member("carl"), joined("carl", "admin")),
    Story.provide(CurrentActor, session("dana")),
    Story.when(new ChangeRole({ organizationId: "org_prairie", memberId: "ana", to: "editor", by: "dana" })),
    Story.then(member("ana"), new MemberRoleSet({ role: "editor" })),
    Story.then(org, new RoleChangeCounted({ from: "admin", to: "editor" })),
    Story.provide(CurrentActor, session("ana")),
    Story.when(new ChangeRole({ organizationId: "org_prairie", memberId: "dana", to: "editor", by: "ana" })),
    Story.rejected(new NotAnAdmin({})),
  ),
)
```

```text
 ✓ member5/Member.story.test.ts > removing or demoting the last admin is refused 32ms
 ✓ member5/Member.story.test.ts > an admin demoted a moment ago cannot promote anyone, though their session still says admin 6ms
 ✓ member5/Member.story.test.ts > two admins demote each other at the same moment: one is refused 3ms
      Tests  3 passed (3)
```

## Trial 11. How long each proof takes alone

On the second round's model (`review4`), each decision proved alone with `Prove.decisionReport`, and the lifecycle's
report alone and with one decision at a time:

| Proof | Rules | Paths | Result | Time |
| --- | --- | --- | --- | --- |
| `Prove.decision(Deciding)` | 25: the lifecycle's 16, the row's 5, its own 4 | 1,984 | Proved | 13.4 s |
| `Prove.decision(Undoing)` | 23: the same 21, its own 2 | 222 | Proved | 2.6 s |
| `Prove.report(ImportLife)` alone | 16, for its 7 commands | | Not proved: it folds `ActCounted`, which only a decision records | 1.8 s |
| `Prove.report(ImportLife, { decisions: [Deciding] })`, then `[Undoing]` | 16, for 8 commands each | | Proved | 23.2 s, 4.6 s |
| `Prove.report(ImportLife, { decisions: [Deciding, Undoing] })` | | | `ProveError`: "does not declare the decision for UndoRowStep" | 15.4 s |
| `Verify.aggregate(RowUnit)` alone | 5 | | Not verified: the row has no command, so its "proved" lines check nothing | 0.2 s |

Between them the two decision proofs and the lifecycle's report cover the 27 rules `Verify.model` printed proved,
rule by rule; the relation is only in `Verify.model`. The `ProveError` comes when two decisions declared in one file
are passed to one report: the library loads the file while it handles the first and does not find the second among
its exports (a reading of `Prove.ts`, `Source.ts` and `Paths.ts`; not patched). On the hosted shape, trial 7, the two
decisions alone took 12.2 s and 3.8 s.

## Trial 12. One decision across two objects, in local workerd

The second round's `alchemy dev` run hosted one aggregate. Here the review's `ImportLife`, `RowUnit` and `Deciding`
(the second round's sources, with the request context beside them) are hosted on `DomainCloudflare.layerDurableObjects()`
inside one `Cloudflare.Worker`, under `alchemy dev` with local state only, no login and an empty `HOME`. No binding
had to be added for decisions: the first instance a decision reads drives the two-phase commit, and the plan declared
four classes (the two aggregates, the domain's directory and its backfill). A small Worker answers `POST` routes that
stage, match, confirm and decide, and a `GET` that reads both states back through each aggregate's client; each call
between objects was counted by wrapping `DurableObjectNamespace.prototype.getByName` in a proxy that logs the
instance and method, and the count matched the log for every act.

`calls.ts`:

```ts
// Counts every call made on a Durable Object stub in this isolate (the Worker's and the objects' own), by method
// and instance name, by wrapping the native namespace's getByName/get once. Instrumentation only, not the model.
// The Worker's env is handed in by the worker (the stack module is also imported in Node, where cloudflare:* fails).

/** One call on a stub: which instance (the name it was reached by) and which method. */
export interface Call {
  readonly instance: string
  readonly method: string
}

const calls: Array<Call> = []
let patched = false

const counting = (stub: any, instance: string): any =>
  new Proxy(stub, {
    get(target, prop) {
      const value = Reflect.get(target, prop)
      if (typeof prop !== "string" || typeof value !== "function") return value
      return (...args: Array<unknown>) => {
        calls.push({ instance, method: prop })
        // One line per call, so the dev server's log shows calls from any isolate too.
        console.log(`[do-call] ${instance} ${prop}`)
        // Reflect.apply: on an RPC stub, `.apply` would itself be a remote method.
        return Reflect.apply(value, target, args)
      }
    },
  })

/** Wrap the namespace prototype the first time a Durable Object binding is seen. Idempotent. */
export const ensurePatched = (env: Record<string, unknown> | undefined): boolean => {
  if (patched || env === undefined) return patched
  for (const key of Object.keys(env)) {
    const ns = (env as any)[key]
    if (ns === null || typeof ns !== "object" || typeof ns.getByName !== "function") continue
    const proto = Object.getPrototypeOf(ns)
    const getByName = proto.getByName
    const get = proto.get
    proto.getByName = function (name: string, options?: unknown) {
      return counting(getByName.call(this, name, options), name)
    }
    proto.get = function (id: any, options?: unknown) {
      return counting(get.call(this, id, options), String(id?.name ?? id))
    }
    patched = true
    return true
  }
  return false
}

/** The calls since the last reset, and a count by method. */
export const snapshot = () => {
  const byMethod: Record<string, number> = {}
  for (const call of calls) byMethod[call.method] = (byMethod[call.method] ?? 0) + 1
  return { patched, total: calls.length, byMethod, calls: [...calls] }
}

export const reset = () => {
  calls.length = 0
}
```

`worker.ts`:

```ts
// The review model (ImportLife + RowUnit + the Deciding decision) on the domain's Durable Object host, driven by HTTP.
// POST /stage/<imp>/<rows>, /match/<imp>/<field>/<step>, /confirm/<imp>/<created>/<notImported>?saw=,
//      /decide/<imp>/<row>?step=&saw=&flags=&fix=<field>:<matching>; GET /state/<imp>/<row>; GET|POST /calls[/reset].
// Who acts comes from ?member=&org=&role= (default ana, org_prairie, editor), as the session middleware would provide.
import * as Cloudflare from "@alchemy.run/cloudflare"
import { WorkerEnvironment } from "@alchemy.run/cloudflare/Workers/WorkerRuntime"
import * as DomainCloudflare from "@alchemy.run/domain/Cloudflare"
import * as Cause from "effect/Cause"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import { HttpServerRequest } from "effect/http/HttpServerRequest"
import * as HttpServerResponse from "effect/http/HttpServerResponse"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import { CurrentActor, type Actor } from "./Actor.context.ts"
import { ensurePatched, reset, snapshot } from "./calls.ts"
import { ConfirmImport, ImportId, ImportLife, MatchColumn, StageImport } from "./ImportLife.aggregate.ts"
import { DecideRow, Deciding } from "./Review.decision.ts"
import { Review } from "./Review.model.ts"
import { RowUnit } from "./RowUnit.aggregate.ts"
import type { Field } from "./Seen.value.ts"

const ReviewLive = Review.layer(Layer.empty).pipe(Layer.provide(DomainCloudflare.layerDurableObjects()))

/** "nothing" or a step name, as the screen would say what it saw. */
const sawOf = (text: string | null) =>
  text === null || text === "" || text === "nothing" ? { _tag: "Nothing" as const } : { _tag: "Step" as const, step: text }

/** A failure as data: a rejection's tag and fields, or the pretty cause of a defect. */
const failureOf = (cause: Cause.Cause<unknown>) => {
  const error = Cause.findErrorOption(cause)
  return error._tag === "Some" ? { rejected: error.value } : { defect: Cause.pretty(cause).slice(0, 1500) }
}

export default class ReviewWorker extends Cloudflare.Worker<ReviewWorker>()(
  "ReviewWorker",
  { main: import.meta.url },
  Effect.gen(function* () {
    const lives = yield* ImportLife
    const rows = yield* RowUnit
    const deciding = yield* Deciding
    return {
      fetch: Effect.gen(function* () {
        // Wrap the Durable Object namespaces before this request's first call, so every stub call is counted.
        ensurePatched(Option.getOrUndefined(yield* Effect.serviceOption(WorkerEnvironment)))
        const request = yield* HttpServerRequest
        const url = new URL(request.url, "http://localhost")
        const parts = url.pathname.split("/").filter((p) => p !== "")
        const q = (name: string) => url.searchParams.get(name)
        const actor: Actor = {
          organizationId: q("org") ?? "org_prairie",
          memberId: q("member") ?? "ana",
          role: (q("role") as Actor["role"] | null) ?? "editor",
        }
        const as = <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.provideService(effect, CurrentActor, actor)
        const answer = <A>(exit: Exit.Exit<A, unknown>) =>
          Exit.isSuccess(exit)
            ? HttpServerResponse.json({ ok: true, value: exit.value })
            : HttpServerResponse.json({ ok: false, ...failureOf(exit.cause) })
        const [verb, imp, a, b] = parts
        if (verb === "calls") {
          if (a === undefined && imp === "reset") reset()
          return yield* HttpServerResponse.json(snapshot())
        }
        if (imp === undefined) return HttpServerResponse.text("Not Found", { status: 404 })
        const importId = ImportId.make(imp)
        if (verb === "stage")
          return yield* answer(yield* Effect.exit(as(lives.send(new StageImport({ importId, rows: Number(a) })))))
        if (verb === "match")
          return yield* answer(
            yield* Effect.exit(as(lives.send(new MatchColumn({ importId, field: a as Field, step: b ?? "m" })))),
          )
        if (verb === "confirm")
          return yield* answer(
            yield* Effect.exit(
              as(
                lives.send(
                  new ConfirmImport({ importId, saw: sawOf(q("saw")), created: Number(a), notImported: Number(b) }),
                ),
              ),
            ),
          )
        if (verb === "decide" && a !== undefined) {
          const fix = q("fix")
          const [field, matching] = fix === null ? [] : fix.split(":")
          const accept =
            field === undefined
              ? { _tag: "Nothing" as const }
              : { _tag: "Fix" as const, field: field as Field, matching: Number(matching) }
          const command = new DecideRow({
            importId,
            row: a,
            step: q("step") ?? "s",
            saw: sawOf(q("saw")),
            flags: q("flags") ?? "{}",
            accept,
          })
          return yield* answer(yield* Effect.exit(as(deciding.send(command))))
        }
        if (verb === "state" && a !== undefined) {
          // Both sides read back on their own: the import's lifecycle and the row it names.
          const life = yield* lives.get(importId)
          const row = yield* rows.get(`${imp}/${a}`)
          return yield* HttpServerResponse.json({ life, row })
        }
        return HttpServerResponse.text("Not Found", { status: 404 })
      }),
    }
  }).pipe(Effect.provide(ReviewLive)),
) {}
```

`alchemy.run.ts`:

```ts
// The stack for `alchemy dev`: one Worker hosting the Review model on Durable Objects, local state only.
import * as Cloudflare from "@alchemy.run/cloudflare";
import * as DomainCloudflare from "@alchemy.run/domain/Cloudflare";
import * as Alchemy from "alchemy";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import ReviewWorker from "./worker.ts";

export default Alchemy.Stack(
  "DecisionTwoSides",
  {
    providers: Layer.mergeAll(Cloudflare.providers(), DomainCloudflare.providers()),
    state: Alchemy.localState(),
  },
  Effect.gen(function* () {
    const worker = yield* ReviewWorker;
    return { url: worker.url.as<string>() };
  }),
);
```

What it showed:

- **Recorded on both.** An accepted act committed one version on each stream (`ImportLife/imp_1` and
  `RowUnit/imp_1/row-12`), and both states read back agreed, twice in a row.
- **Refused, neither changed.** `DecidedSince` from the row, `MatchedSince`, `NotPermitted` and `NotOpen` from the
  import: no events, no prepare and no commit, both states as before.
- **Two acts on one row at once.** Three pairs sent in parallel to fresh rows: each time one was recorded on both and
  the other refused with `DecidedSince` naming the winner. Local workerd took them one after another, so the abort
  path after a prepare (`Conflict`, `Busy`, `txAbort`) did not happen.
- **Requests.** A command to one aggregate: 1. An accepted act: 4 (the Worker to the import, then the import to the row
  `txRead`, `txPrepare`, `txCommit`), and 4 calls to the domain's directory on a row's first commit. A refused act: 3.
- **Time.** An accepted act took about 110 ms (133 ms on a row's first commit), a refused one 8 to 11 ms, a command to
  one aggregate 15 to 16 ms, with every call logged.

Not run: the abort and recovery paths, `Undoing`, a decision over more than two instances, and a deployed Worker.

## What the third round did not run

- A saga (the group act's, the items'), a policy that sends commands, a projection, a view, a stream or a query.
- A group decided as one unit.
- The handler that waits for the projection before it builds a plan, and the screen's fold against the hosted model.
- The organization's counts proved equal to the members: a model invariant and a relation, both checked.
- Any model search deeper than 2 commands for the review and 4 for members, beyond the random walks.
- A deployed Worker or object. The request counts on this page are arithmetic except trial 12's, counted locally.

## Running the third round again

Each trial's files go in one folder beside `test/Actor.context.ts`, in a consumer whose manifest is the first round's
(`@alchemy.run/domain` and `alchemy` from the preview addresses of `dbfd0dd`, `effect` 4.1.4, `@effect/vitest` 4.1.4,
`@effect/platform-node` 4.1.4, `vitest` 5); trial 12 adds `@alchemy.run/cloudflare` from the same commit. Run each test
with `node node_modules/vitest/vitest.mjs run <folder>/<file>`; a Verify test writes its report under `out/`. Trial
12 runs `alchemy dev --no-input --stage <name>` with an empty `HOME` and no Cloudflare variables, then sends the
requests with `curl`. The preview addresses expire a week after `main` moves past the commit (the registry's
`policy.ttl`); a copy of the tarballs is needed to install them later.
