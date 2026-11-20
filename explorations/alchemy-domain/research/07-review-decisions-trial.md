---
type: Research
title: "Trial: saving review decisions, under Verify"
description: Two rounds of models of how a review's decisions are saved, run through Verify on the library's main on 2026-11-19 and 2026-11-20. The first shows that a set-and-clear difference cannot hold the rule "no command clears a decision its sender did not make". The second, run after a review of the brief, finds the shape under which the review's rules are proved (27 of them), measures the largest value an object stores, and runs a decision, a relation, a model invariant and an eventually rule. Every source and every report of Verify, with what is proved, what is only checked, and what was not run.
---

# Trial: saving review decisions, under Verify

Everything on this page was run in folders outside this repository, on `@alchemy.run/domain` at `main@dbfd0ddb`.
Nothing in the repository was changed. This is the case [the brief](../BRIEF.md) models first.

There are two rounds. The first, of 2026-11-19, is below as it was written, with three sentences corrected. A review
of the brief then found that it claimed more than it had shown; [the second round](#the-second-round), of
2026-11-20, lists those corrections and runs what the first did not. **Read the second round's table first**: the
design in the brief rests on it.

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
overwrites decisions nobody touched. Two reviews of the atoms goal found ten orderings that do it:

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

Run on 2026-11-20, after a review of the brief found that the first round claimed more than it had shown. Everything
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

Verify's report, 412 s (its first 34 lines, then its last lines):

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
// The orderings the review of the brief asked about, as stories on the real model: a person's own second act on a
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
// One import's review as ONE instance again, now with everything the review of the brief asked for: an act names the
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

Each source above is complete. Put the files of one trial in one folder beside `Actor.context.ts`, a manifest like
the first round's with `@alchemy.run/cloudflare` added for trial 1, and one test per aggregate or model that calls
`Verify.aggregate` or `Verify.model` and writes the report to a file. A model's test is shown in trial 5.
