---
type: Research
title: "Trial: saving review decisions, under Verify"
description: Five models of how a review's decisions are saved (two of them written two ways), run through Verify on the library's main on 2026-11-19. Today's set-and-clear difference breaks the rule "no command clears a decision its sender did not make"; commands that say what the person did hold it. The sources, Verify's reports, what is proved, what is only checked, and what was not run.
---

# Trial: saving review decisions, under Verify

Everything on this page was run on 2026-11-19 in folders outside this repository, on `@alchemy.run/domain` at
`main@dbfd0ddb`. Nothing in the repository was changed. This is the case [the brief](../BRIEF.md) models first.

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
- a write that cancels a read still in flight (a typed SKU's check; a late answer to a match);
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
another, on the same row or a different one. It covers no longer history: not an undo of a step whose row was decided
twice since, and not three people. For `DraftOfCells` a search one command deeper was also run: it stopped at its
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

The breaking sequence is the defect in three lines: one person sets a row, another person's delta names it in `clear`,
and it is gone. Nothing in the command or the state lets `decide` refuse the third line and still accept a person
taking back their own decision.

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

Read together with section 4: the functions `decided`, `undone` and `isOwnStep` are proved to keep the row's rules
wherever they are applied. That this draft applies them to exactly the rows an act names, and to no other, is checked
to three commands and not proved.

## How large one draft's state is

A Durable Object stores an aggregate's state as one value, written again at every accepted command, and one value may
be at most 8 MB ([host on Cloudflare](concepts/host-cloudflare.md)). The state was built as plain data and measured
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
at about half the limit, and the compact form measured here keeps no decision under the current one. Not measured:
what writing a value of that size at every act costs.

## Running it again

- The sources above are complete. Put the six files in one folder beside a manifest like the one above, and write one
  test per aggregate that calls `Verify.aggregate` and writes `Verify.render` of the report to a file.
- Run each with `node node_modules/vitest/vitest.mjs run <file>`.
- When the library's `main` moves, change the commit in the two addresses; the reports name every rule, so a
  difference shows as a changed line.
