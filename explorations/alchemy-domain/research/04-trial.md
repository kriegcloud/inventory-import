---
type: Research
title: "Trial: a model of this app on beta.87 and on main"
description: What was actually run on 2026-11-19, outside the repository. One aggregate of this app on the published release in memory, then a four-aggregate model on the library's main with stories and Verify; the output, what stopped anything, and the source to run it again.
---

# Trial: a model of this app on beta.87 and on main

Everything on this page was run on 2026-11-19 in folders outside this repository. Nothing in the repository was
changed, and `@alchemy.run/domain` is still not a dependency of the app. Where a page of this packet says "run in a
trial", this is the trial.

| What | Where | Result |
| --- | --- | --- |
| Install beside the app's Effect | `@alchemy.run/domain@2.0.0-beta.87` with `effect@4.1.4` | Installs with no peer warning; `alchemy` is a required peer and comes with it |
| One aggregate, in memory | beta.87, Bun 1.4.5 and Node 24.22.1 | Runs: a receipt, a stale review rejected, a repeated command id answered once, a second confirm rejected |
| Type-check with the app's flags and Effect diagnostics | beta.87 | Passes, with blocks built by `new` and the rule `newSchemaClass` switched off for the file |
| Stories under Vitest | beta.87 | Pass; an unasserted event fails the story |
| Stories with a request context | main at `dbfd0ddb`, Node 24.22.1 | Pass |
| `Verify.aggregate` on four aggregates | main at `dbfd0ddb` | 19 rules proved, each aggregate in under two seconds |
| `Verify.model` on the model | main at `dbfd0ddb` | 19 proved, 1 checked over 5,173 sequences, 200 sampled; about 36 seconds |
| A deliberately broken rule | main at `dbfd0ddb` | Reported with the state, the command, the actor, the events, the state after, and the shortest sequence |
| The app's house style under the prover | main at `dbfd0ddb` | The `S` alias and the formatting are read; `.make` in `decide` and imports by package name are not |

## 1. The published release: beta.87

### Setup and peers

An empty folder with this manifest, installed with bun:

```json
{
  "name": "alchemy-domain-scratch",
  "private": true,
  "type": "module",
  "dependencies": {
    "@alchemy.run/domain": "2.0.0-beta.87",
    "effect": "4.1.4"
  }
}
```

The package as published asks for these peers: `effect ^4.1.4` and `alchemy 2.0.0-beta.87`, both required, and
`@alchemy.run/cloudflare`, `@alchemy.run/effect-cluster`, `@alchemy.run/rivet`, `@distilled.cloud/cloudflare`,
`@effect/sql-pg` and `foldkit`, all optional. The app's Effect, 4.1.4, is the lowest version the range allows. The
installer added `alchemy` by itself and printed no peer warning: 18 packages in all. `alchemy` is needed at run time
even in memory, because `Aggregate.ts` and `Saga.ts` import `alchemy/WorkflowEncoding` and `alchemy/Workflows`.

### The aggregate

In beta.87's shape, a command names its `target`. The first line switches one house diagnostic off for the file;
"The type-check" below says why.

```ts
// @effect-diagnostics newSchemaClass:off
// One aggregate on the published release (beta.87: a command names its `target`). Blocks are built with `new`,
// which is what the library's types and, on main, its prover expect; the line above switches the house rule off here.
import * as Domain from "@alchemy.run/domain"
import * as S from "effect/Schema"

export const ImportId = S.String.pipe(S.brand("ImportId"))
export type ImportId = typeof ImportId.Type

export class NotOpen extends Domain.Rejection("NotOpen", {}, { httpApiStatus: 409 }) {}
export class StaleReview extends Domain.Rejection("StaleReview", { current: S.Int }, { httpApiStatus: 409 }) {}

export class ImportStaged extends Domain.Event("ImportStaged", { fileName: S.String, rowCount: S.Int }) {}
export class ImportConfirmed extends Domain.Event("ImportConfirmed", { confirmId: S.String, ready: S.Int }) {}

export class StageImport extends Domain.Command("StageImport", {
  target: ImportId,
  input: { fileName: S.String, rowCount: S.Int },
  events: [ImportStaged],
  rejects: [NotOpen]
}) {}

export class ConfirmImport extends Domain.Command("ConfirmImport", {
  target: ImportId,
  input: { confirmId: S.String, reviewedAt: S.Int, ready: S.Int },
  events: [ImportConfirmed],
  rejects: [NotOpen, StaleReview],
  reply: { confirmId: S.String }
}) {}

const ImportState = S.Union([
  S.TaggedStruct("Unstaged", {}),
  S.TaggedStruct("Open", { fileName: S.String, rowCount: S.Int }),
  S.TaggedStruct("Imported", { fileName: S.String, rowCount: S.Int, confirmId: S.String })
])

export class Import extends Domain.Aggregate("Import", {
  id: ImportId,
  state: ImportState,
  initial: { _tag: "Unstaged" },
  commands: [StageImport, ConfirmImport],
  decide: {
    StageImport: (state, cmd) =>
      state._tag !== "Unstaged" ? new NotOpen() : [new ImportStaged({ fileName: cmd.fileName, rowCount: cmd.rowCount })],
    ConfirmImport: (state, cmd, { version }) =>
      state._tag !== "Open"
        ? new NotOpen()
        : cmd.reviewedAt !== version
          ? new StaleReview({ current: version })
          : [new ImportConfirmed({ confirmId: cmd.confirmId, ready: cmd.ready })]
  },
  evolve: {
    ImportStaged: (_, e) => ({ _tag: "Open" as const, fileName: e.fileName, rowCount: e.rowCount }),
    ImportConfirmed: (s, e) => (s._tag === "Open" ? { ...s, _tag: "Imported" as const, confirmId: e.confirmId } : s)
  },
  reply: { ConfirmImport: (s) => ({ confirmId: s._tag === "Imported" ? s.confirmId : "" }) }
}) {}

export class Inventory extends Domain.Model("Inventory", { aggregates: [Import] }) {}
```

### Running it in memory

```ts
// @effect-diagnostics newSchemaClass:off
// Hosts the model in memory and sends it commands; prints what came back.
import * as Domain from "@alchemy.run/domain"
import * as Console from "effect/Console"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { ConfirmImport, Import, ImportId, Inventory, StageImport } from "./Import.aggregate.ts"

const program = Effect.gen(function* () {
  const imports = yield* Import
  const id = ImportId.make("org_prairie:imp_1")
  const staged = yield* imports.send(id, new StageImport({ fileName: "items_messy.csv", rowCount: 200 }))
  yield* Console.log("staged", staged)
  const stale = yield* Effect.result(
    imports.send(id, new ConfirmImport({ confirmId: "c1", reviewedAt: 0, ready: 155 }))
  )
  yield* Console.log("stale", stale)
  const confirmed = yield* imports.send(id, new ConfirmImport({ confirmId: "c1", reviewedAt: 1, ready: 155 }), {
    commandId: "confirm:c1"
  })
  yield* Console.log("confirmed", confirmed)
  const again = yield* imports.send(id, new ConfirmImport({ confirmId: "c1", reviewedAt: 1, ready: 155 }), {
    commandId: "confirm:c1"
  })
  yield* Console.log("same command id again", again)
  const second = yield* Effect.result(
    imports.send(id, new ConfirmImport({ confirmId: "c2", reviewedAt: 2, ready: 155 }))
  )
  yield* Console.log("second confirm", second)
  const now = yield* imports.get(Import.ref(id))
  yield* Console.log("state", now)
  yield* Console.log("verify", Domain.verify(Inventory))
})

const Hosted = Inventory.layer(Layer.empty).pipe(Layer.provide(Domain.InMemory))

void Effect.runPromise(program.pipe(Effect.provide(Hosted)))
```

Under `bun run src/run.ts` and under `node src/run.ts` it printed the same thing, shortened here to one line each:

```text
staged                 { stream: "Import/org_prairie:imp_1", version: 1, events: [ImportStaged { fileName: "items_messy.csv", rowCount: 200 }] }
stale                  Failure: StaleReview { current: 1 }
confirmed              { stream: "Import/org_prairie:imp_1", version: 2, events: [ImportConfirmed { confirmId: "c1", ready: 155 }], reply: { confirmId: "c1" } }
same command id again  the same receipt: version 2, the same event, the same reply
second confirm         Failure: NotOpen
state                  { _tag: "Imported", fileName: "items_messy.csv", rowCount: 200, confirmId: "c1" }
verify                 []
```

So on the published release, with the app's exact Effect: an aggregate decides and records; the decide context's
`version` is enough to refuse a review that has moved on; a command sent twice under one `commandId` is answered
once; and `Domain.verify` finds nothing wrong with the model's wiring.

### The type-check

The folder's `tsconfig.json` extends this repository's `tsconfig.base.json`, so it runs with the same compiler flags
and with every Effect diagnostic as an error, and it was checked with the repository's own checker (`tsrs`
7.1.0-beta with `@effect/tsgo` 0.70.0).

| How the blocks are built | Result |
| --- | --- |
| `new Event(...)`, `new Rejection()`, as the library's documentation writes them | No TypeScript error. The house diagnostic `newSchemaClass` reports every `new` (10 in these files) |
| `.make(...)` everywhere, as the house rule asks | Events and commands pass. Each rejection fails with TS2322: `Rejection.make()` is typed as a bare instance, not as its class, on beta.87. The library's `main` fixes this (commit `663f78894`) |
| `new` everywhere, with `// @effect-diagnostics newSchemaClass:off` on the file's first line | Passes: exit 0 |

The third row is the form shown above. It is also the form the prover on `main` needs (part 2).

### Stories

With Vitest 5.1 and `@effect/vitest` 4.1.4:

```ts
// @effect-diagnostics newSchemaClass:off
// A story over the real aggregate, in memory: given history, when a command, then exactly these events.
import { Story } from "@alchemy.run/domain/Story"
import { it } from "@effect/vitest"
import {
  ConfirmImport,
  Import,
  ImportConfirmed,
  ImportId,
  ImportStaged,
  Inventory,
  NotOpen,
  StaleReview
} from "../src/Import.aggregate.ts"

const story = Story.make(Inventory)
const draft = Import.ref(ImportId.make("org_prairie:imp_1"))
const staged = new ImportStaged({ fileName: "items_messy.csv", rowCount: 200 })

it.effect("a confirm of the review as read is recorded once, and a second is refused", () =>
  story(
    Story.given(draft, staged),
    Story.when(draft, new ConfirmImport({ confirmId: "c1", reviewedAt: 1, ready: 155 })),
    Story.then(draft, new ImportConfirmed({ confirmId: "c1", ready: 155 })),
    Story.replied({ confirmId: "c1" }),
    Story.when(draft, new ConfirmImport({ confirmId: "c2", reviewedAt: 2, ready: 155 })),
    Story.rejected(new NotOpen())
  )
)

it.effect("a confirm of a review that has moved on is refused with the version it is at", () =>
  story(
    Story.given(draft, staged),
    Story.when(draft, new ConfirmImport({ confirmId: "c1", reviewedAt: 0, ready: 155 })),
    Story.rejected(new StaleReview({ current: 1 }))
  )
)

it.effect("a story that leaves a recorded event unasserted fails", () =>
  story(
    Story.given(draft, staged),
    Story.when(draft, new ConfirmImport({ confirmId: "c1", reviewedAt: 1, ready: 155 }))
  )
)
```

The first two pass. The third is there to fail, and it does, with the story's own account of what it ran:

```text
StoryFailure: committed events no step asserts (assert them with then): Import/org_prairie:imp_1: ImportConfirmed { confirmId: "c1", ready: 155 } (from step 2)

  ✓ 1 Given      Import/org_prairie:imp_1: ImportStaged { fileName: "items_messy.csv", rowCount: 200 }
  ✓ 2 When       Import/org_prairie:imp_1: ConfirmImport { confirmId: "c1", reviewedAt: 1, ready: 155 }
  ✗   end        Import/org_prairie:imp_1: ImportConfirmed { confirmId: "c1", ready: 155 } (from step 2)
```

### What it adds to a bundle

Built for a browser with `bun build --minify`, against a file that uses only Effect's `Schema` and `Effect`:

| Entry | Minified | Gzip |
| --- | --- | --- |
| Effect only (one struct, one `Effect.succeed`) | 71 kB | 24 kB |
| The aggregate's declarations and the model | 204 kB | 67 kB |
| The same with the in-memory host and the runner | 276 kB | 91 kB |

The declarations pull in 23 files of the domain package, 82 of Effect (its RPC and workflow modules among them) and
two of `alchemy` (`Workflows`, `WorkflowEncoding`). The app's own bundles already hold more of Effect than the first
row, so the real difference is smaller than these rows suggest; it was not measured in the app.

## 2. The library's main, at `dbfd0ddb`

`Decision`, `Relation`, invariants and transitions, `Verify`, `Prove` and `Explore` exist only on `main`; npm's
`latest` is still beta.87. So this part ran from a clone of the public repository at commit `dbfd0ddb`
(2026-11-19), with the dependencies of its example's domain package installed (`pnpm install --filter
"@bank/domain..." --ignore-scripts --frozen-lockfile`), on Node 24.22.1 with Vitest 5.0.4, `effect` 4.1.4 (what
that lockfile resolves) and `z3-solver` 5.3.3. The model below was written beside the example and run with
`pnpm exec vitest run`.

### The model

Four aggregates in `main`'s shapes (a command has no `target`; the aggregate's `keyOf` says which field is its id),
written in this repository's formatting and import style. Their full source is in the appendix.

| Aggregate | Keyed by | What it holds |
| --- | --- | --- |
| `ImportDraft` | the import's id | `Unstaged`, `Open`, `Imported` or `TakenBack`, with the organization and the counts of rows in each place. Every command carries `middleware: [Session]`, and every `decide` is an `Effect.fn` that reads `CurrentActor` |
| `Item` | organization and SKU key | `Absent` or `Stored` with a revision; a create that finds the item there records nothing |
| `Allowance` | the organization | how many model calls were taken today |
| `Organization` | the organization | how many admins and how many others it has |

### Stories

```ts
it.effect("story: its own organization confirms an import", () =>
  story(
    Story.given(draft, staged),
    Story.provide(CurrentActor, dana),
    Story.when(new ConfirmImport({ importId: id, reviewedAt: 1 })),
    Story.then(draft, new ImportConfirmed({ created: 155, notImported: 45 })),
    Story.replied({ created: 155 }),
  ),
)

it.effect("story: another organization's admin is refused", () =>
  story(
    Story.given(draft, staged),
    Story.provide(CurrentActor, outsider),
    Story.when(new SettleRow({ importId: id })),
    Story.rejected(new NotPermitted({})),
  ),
)
```

Both pass. On `main`, `Story.when` takes the command alone, and `Story.provide` stands in for the middleware.

### Verify, one aggregate at a time

`Verify.aggregate(ImportDraft)` answered in under two seconds:

```text
VERIFIED
ImportDraft: 10 rules, 6 commands

Proved: for every state and every input, after any number of commands
  ✓ OutcomesAddUpToTheRows
  ✓ NoCountIsNegative
  ✓ NothingIsWrittenBeforeConfirm
  ✓ AConfirmOfAClosedImportWritesNothing
  ✓ OnlyAnImportedFileIsTakenBack
  ✓ ATakeBackKeepsWhatWasChanged
  ✓ ASuggestionWritesNothing
  ✓ AnImportNeverChangesOrganization
  ✓ OnlyItsOwnOrganizationChangesAnImport
  ✓ AViewerChangesNothing
```

and the other three likewise:

```text
Item: 5 rules, 3 commands

Proved: for every state and every input, after any number of commands
  ✓ ARevisionStartsAtOne
  ✓ ASecondCreateChangesNothing
  ✓ EveryEditWasMadeOnTheCurrentRevision
  ✓ ATakeBackKeepsAChangedItem
  ✓ ARevisionOnlyGoesUp

Allowance: 1 rules, 2 commands

Proved: for every state and every input, after any number of commands
  ✓ NeverMoreThanTheDaysAllowance

Organization: 3 rules, 4 commands

Proved: for every state and every input, after any number of commands
  ✓ AlwaysKeepsAnAdmin
  ✓ NobodyIsCountedBelowZero
  ✓ AFoundedOrganizationStaysFounded
```

### Verify, the whole model

`Verify.model(Inventory, { apis: [InventoryApi], story: Story.make(Inventory) })` answered in about 36 seconds:

```text
Inventory: 43 outcomes

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
  ✓ Item.ARevisionStartsAtOne
  ✓ Item.ASecondCreateChangesNothing
  ✓ Item.EveryEditWasMadeOnTheCurrentRevision
  ✓ Item.ATakeBackKeepsAChangedItem
  ✓ Item.ARevisionOnlyGoesUp
  ✓ Allowance.NeverMoreThanTheDaysAllowance
  ✓ Organization.AlwaysKeepsAnAdmin
  ✓ Organization.NobodyIsCountedBelowZero
  ✓ Organization.AFoundedOrganizationStaysFounded

Checked: in every sequence of up to 2 commands through InventoryApi, with each event delivered twice, each reaction also run behind the others that wait
5,173 sequences, 2,433 states
  ✓ Inventory.EveryConfirmedFileAddsUp

Sampled: 200 longer sequences, of up to 12 commands picked at random (seed 1)
  ✓ none breaks a rule

Run on the real model: 42 sequences the explorer found and 200 walks of commands picked at random, as stories
  ✓ the model does what the explorer read in each

Assumed
  - whole numbers are exact: a number stays within ±2^53, and a bigint has no limit
  - a list an input holds has up to 2 items more than its schema asks for
  - an external system answers what its schema allows, and nothing else
  - middleware lets every caller in: who sends a command is anyone its request context allows
  - what a projection writes, and what a stream or a query gives, is not checked: only what a projection is given
```

The three parts are the report's own: what a solver proved for every state and input; what was checked in every
sequence up to a bound, with events delivered twice and reactions reordered; and what was sampled. The "Assumed"
lines matter as much as the ticks. In particular the proof of "only its own organization changes an import" takes
the request context as given: whether the middleware that fills it lets the right caller in is not proved here and
needs its own test.

### A rule that breaks

A copy of `ImportDraft` in which the `evolve` of `RowLeftOut` forgot to lower `ready` failed with `NotVerified`.
The part of the report about the broken rule:

```text
✗ OutcomesAddUpToTheRows
    ✓ holds on the initial state
    ✓ proved for StageImport, SettleRow, RecordSuggestion, ConfirmImport, TakeBackImport
    ✗ LeaveRowOut: violated
        state         { _tag: "Open", organizationId: "", rows: 1, ready: 1, waiting: 0, left: 0, suggestions: 0 }
        command       LeaveRowOut { importId: "" }
        CurrentActor  { organizationId: "", memberId: "", role: "admin" }
        now           1970-01-01T00:00:00.000Z
        events        RowLeftOut
        after         { _tag: "Open", organizationId: "", rows: 1, ready: 1, waiting: 0, left: 1, suggestions: 0 }
```

and, further down, the shortest sequence that reaches it:

```text
✗ OutcomesAddUpToTheRows breaks
    1. StageImport { importId: "", rows: 1, ready: 1 } as { organizationId: "", memberId: "", role: "admin" }  → ImportStaged
    2. LeaveRowOut { importId: "" } as { organizationId: "", memberId: "", role: "admin" }                     → RowLeftOut
    state  { _tag: "Open", organizationId: "", rows: 1, ready: 1, waiting: 0, left: 1, suggestions: 0 }
```

### What the prover reads of this repository's style

Each row is the same aggregate with one thing changed, run alone in its own test file.

| Change | Result | The report's words |
| --- | --- | --- |
| `import * as S from "effect/Schema"` in place of `Schema`; no semicolons | Read. Every rule proved | |
| An event built with `Event.make({...})` in `decide`, in place of `new Event({...})` | Not read. Nothing proved, no sequence run | "decide for StageImport returns something that is not an event" |
| The aggregate's commands, events and rejections imported by package name, as the `model` package would import them from the `contract` package | Not read | "constructs a class, which is not an event, a rejection or a command" |
| A helper used in `decide`, imported by package name | Not read | "calls @bank/domain/inventory2pkg/ItemBlocks.isFirstRevision, which the prover has no model for" |

The last two follow from one line of the prover: it resolves an import only when its specifier starts with "."
(`packages/domain/src/Prove/internal/Source.ts` on `main@dbfd0ddb`). Blocks imported from another file by a relative
path are read, as the upstream example does.

One trap found on the way: two aggregates with the same name imported into one test file made the prover read one
source file for both, and it reported "the real code disagrees with what the explorer read". Keep one aggregate name
per test file.

## What stopped anything

- The first install in the clone failed: the workspace's install hook fetches a git submodule and timed out. Fetching
  that submodule first, then installing, worked.
- A report printed with Effect's `Console` inside `it.effect` did not appear in Vitest's output, because
  `@effect/vitest` gives each test its own console. The tests write the rendered report to a file instead.
- Nothing else. No rule had to be weakened to be proved.

## What was not run

- Any host but in memory, on either release: no Durable Object, no deploy, no Worker.
- Views, projections, policies, sagas, queries, streams, external systems, and the HTTP, CLI and MCP surfaces.
- A `Domain.Decision` or a `Domain.Relation`.
- `Verify` under Bun: the tests ran on Node.
- The app itself: nothing here imports the app's packages, and the model above is a small one written for the trial,
  not the app's real review.

## Appendix: the model on main, as run

To run it again: clone `alchemy-run/alchemy` at `dbfd0ddb`, install as above, put these files in a folder under
`examples/cloudflare-domain/packages/domain/test/`, and run `pnpm exec vitest run test/<folder>` from that package.

### `Actor.context.ts`

```ts
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

### `ImportDraft.aggregate.ts`

```ts
// One file being brought in. Its rows are counted in exactly one place at every moment, and only its own
// organization's editors and admins change it.
import * as Domain from "@alchemy.run/domain"
import * as Effect from "effect/Effect"
import * as S from "effect/Schema"
import { CurrentActor, Session } from "./Actor.context.ts"

export const ImportId = S.String.pipe(S.brand("ImportId"))
const Count = S.Int.check(S.isGreaterThanOrEqualTo(0))

export class ImportStaged extends Domain.Event("ImportStaged", {
  organizationId: S.String,
  rows: Count,
  ready: Count,
  waiting: Count,
}) {}
export class RowSettled extends Domain.Event("RowSettled", {}) {}
export class RowLeftOut extends Domain.Event("RowLeftOut", {}) {}
export class SuggestionRecorded extends Domain.Event("SuggestionRecorded", {}) {}
export class ImportConfirmed extends Domain.Event("ImportConfirmed", { created: Count, notImported: Count }) {}
export class ImportTakenBack extends Domain.Event("ImportTakenBack", { removed: Count, kept: Count }) {}

export class NotPermitted extends Domain.Rejection("NotPermitted", {}) {}
export class AlreadyStaged extends Domain.Rejection("AlreadyStaged", {}) {}
export class MoreReadyThanRows extends Domain.Rejection("MoreReadyThanRows", {}) {}
export class NotOpen extends Domain.Rejection("NotOpen", {}) {}
export class NothingWaiting extends Domain.Rejection("NothingWaiting", {}) {}
export class NothingReady extends Domain.Rejection("NothingReady", {}) {}
export class StaleReview extends Domain.Rejection("StaleReview", { current: S.Int }) {}
export class NotImported extends Domain.Rejection("NotImported", {}) {}
export class MoreKeptThanCreated extends Domain.Rejection("MoreKeptThanCreated", {}) {}

export class StageImport extends Domain.Command("StageImport", {
  middleware: [Session],
  input: { importId: ImportId, rows: Count, ready: Count },
  events: [ImportStaged],
  rejects: [NotPermitted, AlreadyStaged, MoreReadyThanRows],
}) {}
export class SettleRow extends Domain.Command("SettleRow", {
  middleware: [Session],
  input: { importId: ImportId },
  events: [RowSettled],
  rejects: [NotPermitted, NotOpen, NothingWaiting],
}) {}
export class LeaveRowOut extends Domain.Command("LeaveRowOut", {
  middleware: [Session],
  input: { importId: ImportId },
  events: [RowLeftOut],
  rejects: [NotPermitted, NotOpen, NothingReady],
}) {}
export class RecordSuggestion extends Domain.Command("RecordSuggestion", {
  middleware: [Session],
  input: { importId: ImportId },
  events: [SuggestionRecorded],
  rejects: [NotPermitted, NotOpen],
}) {}
export class ConfirmImport extends Domain.Command("ConfirmImport", {
  middleware: [Session],
  input: { importId: ImportId, reviewedAt: S.Int },
  events: [ImportConfirmed],
  rejects: [NotPermitted, NotOpen, StaleReview],
  reply: { created: Count },
}) {}
export class TakeBackImport extends Domain.Command("TakeBackImport", {
  middleware: [Session],
  input: { importId: ImportId, kept: Count },
  events: [ImportTakenBack],
  rejects: [NotPermitted, NotImported, MoreKeptThanCreated],
}) {}

export const ImportState = S.Union([
  S.TaggedStruct("Unstaged", {}),
  S.TaggedStruct("Open", {
    organizationId: S.String,
    rows: S.Int,
    ready: S.Int,
    waiting: S.Int,
    left: S.Int,
    suggestions: S.Int,
  }),
  S.TaggedStruct("Imported", { organizationId: S.String, rows: S.Int, created: S.Int, notImported: S.Int }),
  S.TaggedStruct("TakenBack", {
    organizationId: S.String,
    rows: S.Int,
    removed: S.Int,
    kept: S.Int,
    notImported: S.Int,
  }),
])

export class ImportDraft extends Domain.Aggregate("ImportDraft", {
  id: ImportId,
  state: ImportState,
  initial: { _tag: "Unstaged" },
  invariants: {
    // An import's outcomes add up to the rows in the file.
    OutcomesAddUpToTheRows: (s) =>
      s._tag === "Open"
        ? s.ready + s.waiting + s.left === s.rows
        : s._tag === "Imported"
          ? s.created + s.notImported === s.rows
          : s._tag === "TakenBack"
            ? s.removed + s.kept + s.notImported === s.rows
            : true,
    NoCountIsNegative: (s) =>
      s._tag === "Open"
        ? s.ready >= 0 && s.waiting >= 0 && s.left >= 0 && s.suggestions >= 0
        : s._tag === "Imported"
          ? s.created >= 0 && s.notImported >= 0
          : s._tag === "TakenBack"
            ? s.removed >= 0 && s.kept >= 0 && s.notImported >= 0
            : true,
  },
  transitions: {
    // Nothing is written as an item before Confirm.
    NothingIsWrittenBeforeConfirm: ({ before, after, command }) =>
      after._tag !== "Imported" || before._tag === "Imported" || command._tag === "ConfirmImport",
    // A confirm of an import that is no longer open writes nothing.
    AConfirmOfAClosedImportWritesNothing: ({ before, after, command }) =>
      command._tag !== "ConfirmImport" || before._tag === "Open" || after._tag === before._tag,
    // A take-back keeps what someone changed, and only an imported file is taken back.
    OnlyAnImportedFileIsTakenBack: ({ before, after }) =>
      after._tag !== "TakenBack" || before._tag === "Imported" || before._tag === "TakenBack",
    ATakeBackKeepsWhatWasChanged: ({ before, after, command }) =>
      command._tag !== "TakeBackImport" ||
      before._tag !== "Imported" ||
      after._tag !== "TakenBack" ||
      after.kept === command.kept,
    // A model proposes and never writes: a suggestion moves no row.
    ASuggestionWritesNothing: ({ before, after, command }) =>
      command._tag !== "RecordSuggestion" ||
      before._tag !== "Open" ||
      (after._tag === "Open" &&
        after.ready === before.ready &&
        after.waiting === before.waiting &&
        after.left === before.left),
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
  commands: [StageImport, SettleRow, LeaveRowOut, RecordSuggestion, ConfirmImport, TakeBackImport],
  keyOf: (cmd) => cmd.importId,
  decide: {
    StageImport: Effect.fn(function* (s, cmd) {
      const actor = yield* CurrentActor
      if (actor.role === "viewer") return yield* new NotPermitted({})
      if (s._tag !== "Unstaged") return yield* new AlreadyStaged({})
      if (cmd.ready > cmd.rows) return yield* new MoreReadyThanRows({})
      return [
        new ImportStaged({
          organizationId: actor.organizationId,
          rows: cmd.rows,
          ready: cmd.ready,
          waiting: cmd.rows - cmd.ready,
        }),
      ]
    }),
    SettleRow: Effect.fn(function* (s) {
      const actor = yield* CurrentActor
      if (s._tag !== "Open") return yield* new NotOpen({})
      if (actor.organizationId !== s.organizationId || actor.role === "viewer") return yield* new NotPermitted({})
      if (s.waiting === 0) return yield* new NothingWaiting({})
      return [new RowSettled({})]
    }),
    LeaveRowOut: Effect.fn(function* (s) {
      const actor = yield* CurrentActor
      if (s._tag !== "Open") return yield* new NotOpen({})
      if (actor.organizationId !== s.organizationId || actor.role === "viewer") return yield* new NotPermitted({})
      if (s.ready === 0) return yield* new NothingReady({})
      return [new RowLeftOut({})]
    }),
    RecordSuggestion: Effect.fn(function* (s) {
      const actor = yield* CurrentActor
      if (s._tag !== "Open") return yield* new NotOpen({})
      if (actor.organizationId !== s.organizationId || actor.role === "viewer") return yield* new NotPermitted({})
      return [new SuggestionRecorded({})]
    }),
    ConfirmImport: Effect.fn(function* (s, cmd, { version }) {
      const actor = yield* CurrentActor
      if (s._tag !== "Open") return yield* new NotOpen({})
      if (actor.organizationId !== s.organizationId || actor.role === "viewer") return yield* new NotPermitted({})
      if (cmd.reviewedAt !== version) return yield* new StaleReview({ current: version })
      return [new ImportConfirmed({ created: s.ready, notImported: s.waiting + s.left })]
    }),
    TakeBackImport: Effect.fn(function* (s, cmd) {
      const actor = yield* CurrentActor
      if (s._tag !== "Imported") return yield* new NotImported({})
      if (actor.organizationId !== s.organizationId || actor.role === "viewer") return yield* new NotPermitted({})
      if (cmd.kept > s.created) return yield* new MoreKeptThanCreated({})
      return [new ImportTakenBack({ removed: s.created - cmd.kept, kept: cmd.kept })]
    }),
  },
  evolve: {
    ImportStaged: (_, e) => ({
      _tag: "Open" as const,
      organizationId: e.organizationId,
      rows: e.rows,
      ready: e.ready,
      waiting: e.waiting,
      left: 0,
      suggestions: 0,
    }),
    RowSettled: (s) => (s._tag === "Open" ? { ...s, ready: s.ready + 1, waiting: s.waiting - 1 } : s),
    RowLeftOut: (s) => (s._tag === "Open" ? { ...s, ready: s.ready - 1, left: s.left + 1 } : s),
    SuggestionRecorded: (s) => (s._tag === "Open" ? { ...s, suggestions: s.suggestions + 1 } : s),
    ImportConfirmed: (s, e) =>
      s._tag === "Open"
        ? {
            _tag: "Imported" as const,
            organizationId: s.organizationId,
            rows: s.rows,
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
            removed: e.removed,
            kept: e.kept,
            notImported: s.notImported,
          }
        : s,
  },
  reply: { ConfirmImport: (s) => ({ created: s._tag === "Imported" ? s.created : 0 }) },
}) {}
```

### `Item.aggregate.ts`

```ts
// One item, keyed by its organization and SKU key, so the id is the unique value: a second create finds it there.
import * as Domain from "@alchemy.run/domain"
import * as S from "effect/Schema"

export const ItemKey = S.String.pipe(S.brand("ItemKey"))
const Count = S.Int.check(S.isGreaterThanOrEqualTo(0))

export class ItemCreated extends Domain.Event("ItemCreated", { confirmId: S.String, quantityOnHand: Count }) {}
export class ItemEdited extends Domain.Event("ItemEdited", { quantityOnHand: Count }) {}
export class ItemRemoved extends Domain.Event("ItemRemoved", {}) {}

export class NoSuchItem extends Domain.Rejection("NoSuchItem", {}) {}
export class EditedSince extends Domain.Rejection("EditedSince", { current: S.Int }) {}

export class CreateFromImport extends Domain.Command("CreateFromImport", {
  input: { itemKey: ItemKey, confirmId: S.String, quantityOnHand: Count },
  events: [ItemCreated],
}) {}
export class EditItem extends Domain.Command("EditItem", {
  input: { itemKey: ItemKey, revision: S.Int, quantityOnHand: Count },
  events: [ItemEdited],
  rejects: [NoSuchItem, EditedSince],
}) {}
export class RemoveIfUnchanged extends Domain.Command("RemoveIfUnchanged", {
  input: { itemKey: ItemKey, confirmId: S.String },
  events: [ItemRemoved],
}) {}

const ItemState = S.Union([
  S.TaggedStruct("Absent", {}),
  S.TaggedStruct("Stored", { createdBy: S.String, quantityOnHand: S.Int, revision: S.Int }),
])

export class Item extends Domain.Aggregate("Item", {
  id: ItemKey,
  state: ItemState,
  initial: { _tag: "Absent" },
  invariants: {
    ARevisionStartsAtOne: (s) => s._tag !== "Stored" || s.revision >= 1,
  },
  transitions: {
    // A second import of the same file adds nothing.
    ASecondCreateChangesNothing: ({ before, after, command }) =>
      command._tag !== "CreateFromImport" ||
      before._tag !== "Stored" ||
      (after._tag === "Stored" &&
        after.revision === before.revision &&
        after.quantityOnHand === before.quantityOnHand &&
        after.createdBy === before.createdBy),
    // An edit made on an old revision is refused: every edit that commits was made on the current one.
    EveryEditWasMadeOnTheCurrentRevision: ({ before, command }) =>
      command._tag !== "EditItem" || (before._tag === "Stored" && command.revision === before.revision),
    // A take-back removes only an item nobody changed, and keeps a changed one.
    ATakeBackKeepsAChangedItem: ({ before, after, command }) =>
      command._tag !== "RemoveIfUnchanged" ||
      before._tag !== "Stored" ||
      before.revision === 1 ||
      after._tag === "Stored",
    ARevisionOnlyGoesUp: ({ before, after }) =>
      before._tag !== "Stored" || after._tag !== "Stored" || after.revision >= before.revision,
  },
  commands: [CreateFromImport, EditItem, RemoveIfUnchanged],
  keyOf: (cmd) => cmd.itemKey,
  decide: {
    CreateFromImport: (s, cmd) =>
      s._tag === "Stored" ? [] : [new ItemCreated({ confirmId: cmd.confirmId, quantityOnHand: cmd.quantityOnHand })],
    EditItem: (s, cmd) =>
      s._tag !== "Stored"
        ? new NoSuchItem({})
        : cmd.revision !== s.revision
          ? new EditedSince({ current: s.revision })
          : [new ItemEdited({ quantityOnHand: cmd.quantityOnHand })],
    RemoveIfUnchanged: (s, cmd) =>
      s._tag === "Stored" && s.revision === 1 && s.createdBy === cmd.confirmId ? [new ItemRemoved({})] : [],
  },
  evolve: {
    ItemCreated: (_, e) => ({
      _tag: "Stored" as const,
      createdBy: e.confirmId,
      quantityOnHand: e.quantityOnHand,
      revision: 1,
    }),
    ItemEdited: (s, e) =>
      s._tag === "Stored" ? { ...s, quantityOnHand: e.quantityOnHand, revision: s.revision + 1 } : s,
    ItemRemoved: () => ({ _tag: "Absent" as const }),
  },
}) {}
```

### `Allowance.aggregate.ts`

```ts
// An organization's model calls for the day: a call is taken before it is made, and never past the allowance.
import * as Domain from "@alchemy.run/domain"
import * as S from "effect/Schema"

export const AllowanceId = S.String.pipe(S.brand("AllowanceId"))
const DAILY_CALLS = 40

export class ModelCallTaken extends Domain.Event("ModelCallTaken", {}) {}
export class DayStarted extends Domain.Event("DayStarted", {}) {}
export class AllowanceUsedUp extends Domain.Rejection("AllowanceUsedUp", {}) {}

export class TakeModelCall extends Domain.Command("TakeModelCall", {
  input: { organizationId: AllowanceId },
  events: [ModelCallTaken],
  rejects: [AllowanceUsedUp],
}) {}
export class StartNewDay extends Domain.Command("StartNewDay", {
  input: { organizationId: AllowanceId },
  events: [DayStarted],
}) {}

export class Allowance extends Domain.Aggregate("Allowance", {
  id: AllowanceId,
  state: S.Struct({ taken: S.Int }),
  initial: { taken: 0 },
  invariants: {
    NeverMoreThanTheDaysAllowance: (s) => s.taken >= 0 && s.taken <= DAILY_CALLS,
  },
  commands: [TakeModelCall, StartNewDay],
  keyOf: (cmd) => cmd.organizationId,
  decide: {
    TakeModelCall: (s) => (s.taken >= DAILY_CALLS ? new AllowanceUsedUp({}) : [new ModelCallTaken({})]),
    StartNewDay: () => [new DayStarted({})],
  },
  evolve: {
    ModelCallTaken: (s) => ({ taken: s.taken + 1 }),
    DayStarted: () => ({ taken: 0 }),
  },
}) {}
```

### `Organization.aggregate.ts`

```ts
// Who is in an organization, as counts by role: enough to hold the rule that it always keeps an admin.
import * as Domain from "@alchemy.run/domain"
import * as S from "effect/Schema"

export const OrganizationId = S.String.pipe(S.brand("OrganizationId"))
const Role = S.Literals(["admin", "editor", "viewer"])

export class OrganizationFounded extends Domain.Event("OrganizationFounded", {}) {}
export class MemberAdded extends Domain.Event("MemberAdded", { role: Role }) {}
export class RoleChanged extends Domain.Event("RoleChanged", { from: Role, to: Role }) {}
export class MemberRemoved extends Domain.Event("MemberRemoved", { role: Role }) {}

export class AlreadyFounded extends Domain.Rejection("AlreadyFounded", {}) {}
export class NotFounded extends Domain.Rejection("NotFounded", {}) {}
export class LastAdmin extends Domain.Rejection("LastAdmin", {}) {}
export class NobodyWithThatRole extends Domain.Rejection("NobodyWithThatRole", {}) {}

export class FoundOrganization extends Domain.Command("FoundOrganization", {
  input: { organizationId: OrganizationId },
  events: [OrganizationFounded],
  rejects: [AlreadyFounded],
}) {}
export class AddMember extends Domain.Command("AddMember", {
  input: { organizationId: OrganizationId, role: Role },
  events: [MemberAdded],
  rejects: [NotFounded],
}) {}
export class ChangeRole extends Domain.Command("ChangeRole", {
  input: { organizationId: OrganizationId, from: Role, to: Role },
  events: [RoleChanged],
  rejects: [NotFounded, LastAdmin, NobodyWithThatRole],
}) {}
export class RemoveMember extends Domain.Command("RemoveMember", {
  input: { organizationId: OrganizationId, role: Role },
  events: [MemberRemoved],
  rejects: [NotFounded, LastAdmin, NobodyWithThatRole],
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
    // Rule 7 of the app: an organization always keeps an admin.
    AlwaysKeepsAnAdmin: (s) => s._tag !== "Founded" || s.admins >= 1,
    NobodyIsCountedBelowZero: (s) => s._tag !== "Founded" || s.others >= 0,
  },
  transitions: {
    AFoundedOrganizationStaysFounded: ({ before, after }) => before._tag !== "Founded" || after._tag === "Founded",
  },
  commands: [FoundOrganization, AddMember, ChangeRole, RemoveMember],
  keyOf: (cmd) => cmd.organizationId,
  decide: {
    FoundOrganization: (s) => (s._tag !== "Unfounded" ? new AlreadyFounded({}) : [new OrganizationFounded({})]),
    AddMember: (s, cmd) => (s._tag !== "Founded" ? new NotFounded({}) : [new MemberAdded({ role: cmd.role })]),
    ChangeRole: (s, cmd) =>
      s._tag !== "Founded"
        ? new NotFounded({})
        : cmd.from === "admin" && cmd.to !== "admin" && s.admins === 1
          ? new LastAdmin({})
          : cmd.from !== "admin" && s.others === 0
            ? new NobodyWithThatRole({})
            : [new RoleChanged({ from: cmd.from, to: cmd.to })],
    RemoveMember: (s, cmd) =>
      s._tag !== "Founded"
        ? new NotFounded({})
        : cmd.role === "admin" && s.admins === 1
          ? new LastAdmin({})
          : cmd.role !== "admin" && s.others === 0
            ? new NobodyWithThatRole({})
            : [new MemberRemoved({ role: cmd.role })],
  },
  evolve: {
    OrganizationFounded: () => ({ _tag: "Founded" as const, admins: 1, others: 0 }),
    MemberAdded: (s, e) =>
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

### `Inventory.model.ts`

```ts
import * as Domain from "@alchemy.run/domain"
import { Allowance } from "./Allowance.aggregate.ts"
import { ImportDraft } from "./ImportDraft.aggregate.ts"
import { Item } from "./Item.aggregate.ts"
import { Organization } from "./Organization.aggregate.ts"

export class Inventory extends Domain.Model("Inventory", {
  aggregates: [ImportDraft, Item, Allowance, Organization],
  invariants: {
    EveryConfirmedFileAddsUp: (inventory) =>
      inventory.ImportDraft.every(
        (one) => one.state._tag !== "Imported" || one.state.created + one.state.notImported === one.state.rows,
      ),
  },
}) {}

export class InventoryApi extends Domain.Api("InventoryApi", { model: Inventory }) {}
```

### `Aggregates.verify.test.ts`

```ts
import { Story } from "@alchemy.run/domain/Story"
import * as Verify from "@alchemy.run/domain/Verify"
import * as NodeServices from "@effect/platform-node/NodeServices"
import { it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { writeFileSync } from "node:fs"
import { CurrentActor } from "./Actor.context.ts"
import { Allowance } from "./Allowance.aggregate.ts"
import {
  ConfirmImport,
  ImportConfirmed,
  ImportDraft,
  ImportId,
  ImportStaged,
  NotPermitted,
  SettleRow,
} from "./ImportDraft.aggregate.ts"
import { Inventory } from "./Inventory.model.ts"
import { Item } from "./Item.aggregate.ts"
import { Organization } from "./Organization.aggregate.ts"

const out = (name: string, text: string) => Effect.sync(() => writeFileSync(`out/${name}.txt`, text))
const story = Story.make(Inventory)
const id = ImportId.make("org_prairie:imp_1")
const draft = ImportDraft.ref(id)
const staged = new ImportStaged({ organizationId: "org_prairie", rows: 200, ready: 155, waiting: 45 })
const dana = { organizationId: "org_prairie", memberId: "m_dana", role: "admin" as const }
const outsider = { organizationId: "org_northline", memberId: "m_noor", role: "admin" as const }

it.effect("story: its own organization confirms an import", () =>
  story(
    Story.given(draft, staged),
    Story.provide(CurrentActor, dana),
    Story.when(new ConfirmImport({ importId: id, reviewedAt: 1 })),
    Story.then(draft, new ImportConfirmed({ created: 155, notImported: 45 })),
    Story.replied({ created: 155 }),
  ),
)

it.effect("story: another organization's admin is refused", () =>
  story(
    Story.given(draft, staged),
    Story.provide(CurrentActor, outsider),
    Story.when(new SettleRow({ importId: id })),
    Story.rejected(new NotPermitted({})),
  ),
)

const prove = (name: string, aggregate: Parameters<typeof Verify.aggregate>[0]) =>
  it.effect(
    `verify: ${name}`,
    () =>
      Effect.gen(function* () {
        const report = yield* Verify.aggregate(aggregate).pipe(Effect.catch((error) => Effect.succeed({ failed: error })))
        yield* out(name, "failed" in report ? `${report.failed._tag}\n${report.failed.message}` : `VERIFIED\n${Verify.render(report)}`)
      }).pipe(Effect.provide(NodeServices.layer)),
    300_000,
  )

prove("ImportDraft", ImportDraft)
prove("Item", Item)
prove("Allowance", Allowance)
prove("Organization", Organization)
```

### `Model.verify.test.ts`

```ts
import { Story } from "@alchemy.run/domain/Story"
import * as Verify from "@alchemy.run/domain/Verify"
import * as NodeServices from "@effect/platform-node/NodeServices"
import { it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { writeFileSync } from "node:fs"
import { Inventory, InventoryApi } from "./Inventory.model.ts"

it.effect(
  "verify: the model",
  () =>
    Effect.gen(function* () {
      const report = yield* Verify.model(Inventory, { apis: [InventoryApi], story: Story.make(Inventory) }).pipe(
        Effect.catch((error) => Effect.succeed({ failed: error })),
      )
      yield* Effect.sync(() =>
        writeFileSync(
          "out/model.txt",
          "failed" in report ? `${report.failed._tag}\n${report.failed.message}` : `VERIFIED\n${Verify.render(report)}`,
        ),
      )
    }).pipe(Effect.provide(NodeServices.layer)),
  900_000,
)
```
