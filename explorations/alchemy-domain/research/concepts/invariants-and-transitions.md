---
type: Reference
title: Invariants and transitions
description: Named rules written on an aggregate (what no state may be, what no command may do), on a decision (what one step across instances must keep) and on a model (what holds at rest, and in the end), which Verify proves or searches; this app's import, item, allowance and organization rules were proved this way in a trial.
tags: [alchemy-domain, declaration]
---

# Invariants and transitions

An invariant is a named predicate over one aggregate's state; a transition is a named predicate over one step (the
state before, the command, the events it recorded, the state after). A decision can carry transitions over all the
instances it read, and a model can carry invariants over every instance, plus `eventually` rules that must hold
once everything has run its course. None of them runs when a command arrives: they are claims about `decide` and
`evolve` that [Verify](./verify.md) proves with a solver or searches for a breaking sequence. The docs put it
plainly: "An invariant is a claim about `decide` and `evolve`, not a guard."
[`website/src/content/docs/domain/verifying-models.mdx` line 26 at `main@dbfd0ddb`; the page is not on the live site]

This page is the full reference for all four kinds, the model-level `invariants` and `eventually` included;
[Model](./model.md) gives their place in a model's declaration and points here. Relations have their own page,
[Relation](./relation.md).

## When to reach for it

- A sentence the business says can never be true of one record: an import's outcomes always add up to its rows, an
  allowance never passes 40 calls. That is an aggregate `invariants` entry.
- A sentence about a change: a confirm of an import that is no longer open writes nothing, an edit only lands on the
  revision the person saw, a viewer changes nothing. That is an aggregate `transitions` entry.
- A sentence about one step that changes several instances together (a [decision](./decision.md)): a claimed email
  was free before the add. That is a decision `transitions` entry.
- A sentence about many instances at rest: every confirmed file adds up. That is a model `invariants` entry, only
  searched. If the sentence is about a fixed few instances, write a [relation](./relation.md) instead, which can be
  proved.
- A sentence that is false along the way and true at the end (every open import is eventually confirmed or removed):
  a model `eventually` entry.

Do not reach for it to refuse a command. A guard belongs in `decide` (return a [rejection](./rejection.md)); the
rule then says what `decide` must keep, and Verify checks that it does.

## How it is declared

### What each kind of rule is given

| Kind | Where | Its argument | Returns | May read a request context |
| --- | --- | --- | --- | --- |
| Aggregate invariant | `invariants` on `Domain.Aggregate` | the state, nothing else | `boolean` | no |
| Aggregate transition | `transitions` on `Domain.Aggregate` | `{ before, after, command, events }`: the state the command met, the state its events left, the command, the events it recorded in order | `boolean`, or `Effect<boolean, never, R>` | yes: an `Effect.fn` may yield what the commands' middleware provides |
| Decision transition | `transitions` on `Domain.Decision` | `{ before, after, command, events }`, with `before` and `after` each instance's state under its name in `reads` (an array for a name `keyOf` gives an array) | `boolean`, or `Effect<boolean, never, R>` | yes, as above |
| Model invariant | `invariants` on `Domain.Model` | one record: every instance of every aggregate as `{ id, state, events }` under the aggregate's name; every key of every view that has a state as `{ id, state }` under the view's name; what each projection was given as `{ id, event }`, oldest first, under the projection's name | `boolean` | no |
| Model `eventually` | `eventually` on `Domain.Model` | the same record as a model invariant | `boolean` | no |

No rule is given `now`, a `commandId`, a stream or a version: those belong to `decide`'s context
(`{ id, commandId, stream, version, now }`), and a transition sees only the step. An aggregate transition is not
given the instance's id; a decision transition is given states only, not ids; a model rule is given ids.

```typescript
// SKETCH: not compiled (main only)
export class Item extends Domain.Aggregate("Item", {
  id: ItemKey,
  state: ItemState,
  initial: { _tag: "Absent" },
  invariants: {
    // given the state; true while the rule holds
    ARevisionStartsAtOne: (s) => s._tag !== "Stored" || s.revision >= 1
  },
  transitions: {
    // given { before, after, command, events }
    ARevisionOnlyGoesUp: ({ before, after }) =>
      before._tag !== "Stored" || after._tag !== "Stored" || after.revision >= before.revision,
    // an Effect.fn that reads the commands' request context, as decide does
    AViewerChangesNothing: Effect.fn(function* () {
      return (yield* CurrentActor).role !== "viewer"
    })
  },
  commands: [CreateFromImport, EditItem, RemoveIfUnchanged],
  keyOf: (cmd) => cmd.itemKey,
  decide: { /* ... */ },
  evolve: { /* ... */ }
}) {}
```

The exact shapes, all on `main@dbfd0ddb`:

- Aggregate `invariants?: { readonly [name: string]: (state: S["Type"]) => boolean }`
  (`packages/domain/src/Aggregate.ts` line 157).
- Aggregate `transitions?: { readonly [name: string]: (step: Transition<S["Type"], InstanceOf<C[number]>,
  InstanceOf<E>>) => boolean | Effect.Effect<boolean, never, Command.ContextOf<C[number]>> }` (`Aggregate.ts`
  lines 167-171), where `Transition` is `{ before, after, command, events }` (`Aggregate.ts` lines 120-129) and `E`
  is every event the aggregate's commands declare plus the `events` it folds for decisions (`EventsOf<C> | X[number]`,
  lines 132 and 143). The widened `AnyDefinition` carries both as handler records (`Aggregate.ts` lines 316-317).
- Decision `transitions?` (`packages/domain/src/Decision.ts` lines 150-154), each given
  `Transition<StatesOf<R, K>, InstanceOf<C>, InstanceOf<C["events"][number]>>` (`Decision.ts` lines 79-87; `StatesOf`
  lines 71-73) and returning `boolean | Effect.Effect<boolean, never, Command.ContextOf<C>>`. A decision has no
  `invariants` field: the invariants of each aggregate it records on already bind it.
- Model `invariants?` and `eventually?`, each `{ readonly [name: string]: (model: Instances<A> & Keys<V> & Fed<J>) =>
  boolean }` (`packages/domain/src/Model.ts` lines 141-150 and 159-169). `Instances` gives `{ id, state, events }`,
  events oldest first (`Model.ts` lines 195-202); `Keys` gives `{ id, state }` for every view key with a state
  (lines 186-192); `Fed` gives `{ id, event }` per projection, oldest first (lines 177-183). The model class exposes
  `invariants`, `eventually` and `relations` as statics (`Model.ts` lines 233-238, 509-515).

What a name is for: it is the rule's identity in the report and in `require`. On `Verify.model`, an aggregate's rule
is named `Aggregate.Rule` (`ImportDraft.OutcomesAddUpToTheRows`), a decision's own transition is named after its
command's tag (`RegisterCustomer.OnlyAFreeNameIsClaimed` in
`examples/cloudflare-domain/packages/domain/test/Bank.verify.test.ts` lines 41-42), and a model's rule after the model
(`Inventory.EveryConfirmedFileAddsUp`) (`packages/domain/src/Verify.ts` lines 232-267). On `Verify.aggregate` the
names are bare (`OutcomesAddUpToTheRows`) (`Verify.ts` line 596).

Checked in: none of this exists at `v2.0.0-beta.87` (`packages/domain/src/Aggregate.ts` there has no `invariants`
or `transitions`; `Decision.ts` and `Relation.ts` do not exist; `Model.ts` has no `invariants`, `eventually` or
`relations`). Read at `main@dbfd0ddb`: `packages/domain/src/Aggregate.ts` lines 120-171, 316-317;
`packages/domain/src/Decision.ts` lines 71-87, 143-154, 170; `packages/domain/src/Model.ts` lines 141-202, 233-238,
509-515.

### Types and helpers

| Name | What it is | Where (main) |
| --- | --- | --- |
| `Aggregate.Transition<State, Cmd, Ev>` | `{ before, after, command, events }`, an aggregate transition's argument | `Aggregate.ts` 121-129 |
| `Aggregate.EventsOf<C>` | The event classes a list of commands may record; with the `events` an aggregate folds for decisions, the `events` type a transition sees | `Aggregate.ts` 132 |
| `Decision.Transition<States, Cmd, Ev>` | The same four fields, `before` and `after` keyed by the names in `reads` | `Decision.ts` 79-87 |
| `Model.Instances<A>` | Every aggregate instance as `{ id, state, events }`, by aggregate name | `Model.ts` 195-202 |
| `Model.Keys<V>` | Every view key that has a state as `{ id, state }`, by view name | `Model.ts` 186-192 |
| `Model.Fed<J>` | What each projection was given as `{ id, event }`, oldest first, by projection name | `Model.ts` 177-183 |

### What main changes

Everything on this page is new on main. It belongs to Verify (commit `e4adb720c`, #3260) and, for decision
transitions, to Decision (commit `dbda8cc16`, #3420); which commit added each field is not verified from history.
Verify reading `effect/Match` (`d123c318d`, #3503) widened what a rule may call.

- `Aggregate.Transition`, `EventsOf` and the `invariants` and `transitions` fields (`Aggregate.ts` lines 120-171,
  316-317).
- `Decision.Transition` and the decision's `transitions` field (`Decision.ts` lines 79-87, 143-154, 170), with a
  docstring section on stating what it must keep (`Decision.ts` lines 334-358).
- The model's `invariants`, `relations` and `eventually` members, the `Fed`, `Keys` and `Instances` types, and
  the three statics (`Model.ts` lines 141-202, 233-238, 509-515).

## Rules, and the mistakes to avoid

- **Outside a test, nothing runs them.** No file of `packages/domain/src` outside `Prove`, `Explore` and `Verify`
  reads `invariants`, `transitions`, `relations` or `eventually` (searched on main; the other hits are type
  declarations and docstrings). No host, no story and no `Domain.verify` evaluates them: a commit that breaks an
  invariant is not refused, and declaring them costs nothing at run time. If a state must be refused, refuse it in
  `decide`. `Domain.verify(Model)` checks the declaration (a missing `keyOf`, two writers) and never reads these
  rules (`website/src/content/docs/domain/model.mdx` line 332).
- **Write each rule inline, in the definition, under its own name.** Rules are read from the TypeScript source. An
  `invariants` object built elsewhere and passed by name is refused, not skipped: a `ProveError` or `ExploreError`
  saying each must be written in its definition, as a property, under a name of its own
  (`packages/domain/src/Prove/internal/Paths.ts` lines 1039-1044; fixture `test/fixtures/Aside.aggregate.ts`, test
  `examples/cloudflare-domain/packages/domain/test/Guards.test.ts` lines 98-110). The same holds for a model's
  `invariants` and `eventually` (`packages/domain/src/Explore.ts` lines 236-239,
  `Explore/internal/ModelSearch.ts` lines 983-995). A relation is the one exception: it may be a constant in the
  model's file listed by name (see [Relation](./relation.md)).
- **Keep what a rule reads reachable by relative imports.** The prover follows only specifiers that start with `.`
  (`Prove/internal/Source.ts` main line 229). In a trial on 2026-11-19 on main, commands, events and rejections
  imported into the aggregate's file by package name were not read, and a helper imported by package name was
  reported as a call the prover has no model for.
- **Inside `decide`, build events and rejections with `new`.** In the same trial an event built with `.make` inside
  `decide` was not read, and nothing was proved. The app's diagnostic `newSchemaClass` reports every `new`, so
  domain blocks need an exception to it.
- **Return `true` while the rule holds.** Write it as an implication that starts with the cases it is not about
  (`s._tag !== "Stored" || ...`).
- **Rules are code the prover reads.** Only the subset in `website/src/content/docs/domain/verifiable-code.mdx` (main)
  is read: no string methods such as `startsWith` or `toLowerCase` (line 50), no regular expressions (line 38), no
  `try` (line 21), no arithmetic on numbers that may not be whole (line 46), and no call into a module outside the
  listed ones (lines 80-95: `Effect`, `Match`, `Option`, `Array`, `Record`, `Struct`, `Optic`, `DateTime`, `Function`,
  `Math`, `Object`), so not `HashMap` or `HashSet`. A rule that meets unread code is not proved and fails the check
  with file and line.
- **An invariant can be true and still unprovable.** The proof starts from any state the schema and the other
  invariants allow, including unreachable ones. Add the invariant that rules them out (the `Escrow` and `Covered`
  pair: `test/fixtures/Escrow.aggregate.ts`, `test/Verify.test.ts` lines 129-157). The trial's
  `NoCountIsNegative` is that kind of supporting rule for `OutcomesAddUpToTheRows`.
- **A transition that reads the request context is proved for every caller.** Middleware is not run, so it is proved
  for every value the context's schema allows (`verifiable-code.mdx` line 101). The trial's report listed this under
  what it assumed. Do not rely on middleware to make a transition true: `OnlyItsOwnOrganizationChangesAnImport` is
  proved because `decide` itself rejects another organization.
- **A model invariant is not true at every instant.** It is looked at only when nothing is left to react: every
  policy has handled its events and every saga has finished or waits (`Model.ts` lines 141-148). A rule a policy
  keeps in step is broken between the event and the policy's command. It is never proved, only checked in the
  sequences the search runs.
- **An `eventually` rule is looked at only at the end.** Each sequence is run to its end, nothing left to react and
  every scheduled command come due and run, and the search looks for one that ends without the rule (`Model.ts` lines
  159-165). A rule no sequence reaches the end of is reported as not looked at (`Explore.ts` line 437).
- **A decision's step must keep every rule of each aggregate it records on.** An aggregate that folds events only a
  decision records cannot be verified alone (`examples/cloudflare-domain/packages/domain/test/Decision.test.ts` lines
  204-216).

## In this app

These are the rules proved in a trial on 2026-11-19 on main, as they were declared there (in main's shapes: commands
without `target`, aggregates with `keyOf`). **Run:** `Verify.aggregate` proved each aggregate's rules, every state and
every input, after any number of commands, each in under two seconds; `Verify.model` then proved the same 19 rules
and checked the model invariant in every sequence of up to 2 commands (5,173 sequences, 2,433 states), with 200
longer sequences sampled. The blocks below are excerpts of the rules only, from files that ran.

`ImportDraft`, the import (state `Unstaged | Open | Imported | TakenBack`, each but the first carrying
`organizationId` and the counts):

```typescript
// Run in a trial on 2026-11-19 on main (excerpt: the rules of the ImportDraft aggregate)
invariants: {
  // App rule 1: an import's outcomes add up to the rows in the file.
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
          : true
},
transitions: {
  // App rule 2: nothing is written as an item before Confirm.
  NothingIsWrittenBeforeConfirm: ({ before, after, command }) =>
    after._tag !== "Imported" || before._tag === "Imported" || command._tag === "ConfirmImport",
  // App rule 10: a confirm of an import that is no longer open writes nothing.
  AConfirmOfAClosedImportWritesNothing: ({ before, after, command }) =>
    command._tag !== "ConfirmImport" || before._tag === "Open" || after._tag === before._tag,
  // App rule 4: only an imported file is taken back, and the take-back keeps what was changed.
  OnlyAnImportedFileIsTakenBack: ({ before, after }) =>
    after._tag !== "TakenBack" || before._tag === "Imported" || before._tag === "TakenBack",
  ATakeBackKeepsWhatWasChanged: ({ before, after, command }) =>
    command._tag !== "TakeBackImport" ||
    before._tag !== "Imported" ||
    after._tag !== "TakenBack" ||
    after.kept === command.kept,
  // App rule 8: a model proposes and never writes; a suggestion moves no row.
  ASuggestionWritesNothing: ({ before, after, command }) =>
    command._tag !== "RecordSuggestion" ||
    before._tag !== "Open" ||
    (after._tag === "Open" &&
      after.ready === before.ready &&
      after.waiting === before.waiting &&
      after.left === before.left),
  // App rule 6: every row belongs to one organization.
  AnImportNeverChangesOrganization: ({ before, after }) =>
    before._tag === "Unstaged" || after._tag === "Unstaged" || before.organizationId === after.organizationId,
  OnlyItsOwnOrganizationChangesAnImport: Effect.fn(function* ({ before }) {
    if (before._tag === "Unstaged") return true
    return (yield* CurrentActor).organizationId === before.organizationId
  }),
  // Roles: a viewer changes nothing.
  AViewerChangesNothing: Effect.fn(function* () {
    return (yield* CurrentActor).role !== "viewer"
  })
}
```

`Item`, keyed by organization and SKU key (state `Absent | Stored { createdBy, quantityOnHand, revision }`):

```typescript
// Run in a trial on 2026-11-19 on main (excerpt: the rules of the Item aggregate)
invariants: {
  ARevisionStartsAtOne: (s) => s._tag !== "Stored" || s.revision >= 1
},
transitions: {
  // App rule 3: a second import of the same file adds nothing.
  ASecondCreateChangesNothing: ({ before, after, command }) =>
    command._tag !== "CreateFromImport" ||
    before._tag !== "Stored" ||
    (after._tag === "Stored" &&
      after.revision === before.revision &&
      after.quantityOnHand === before.quantityOnHand &&
      after.createdBy === before.createdBy),
  // App rule 5: every edit that commits was made on the current revision.
  EveryEditWasMadeOnTheCurrentRevision: ({ before, command }) =>
    command._tag !== "EditItem" || (before._tag === "Stored" && command.revision === before.revision),
  // App rule 4: a take-back removes only an item nobody changed, and keeps a changed one.
  ATakeBackKeepsAChangedItem: ({ before, after, command }) =>
    command._tag !== "RemoveIfUnchanged" ||
    before._tag !== "Stored" ||
    before.revision === 1 ||
    after._tag === "Stored",
  ARevisionOnlyGoesUp: ({ before, after }) =>
    before._tag !== "Stored" || after._tag !== "Stored" || after.revision >= before.revision
}
```

`Allowance`, per organization (state `{ taken }`, `DAILY_CALLS = 40`), and `Organization` (state
`Unfounded | Founded { admins, others }`):

```typescript
// Run in a trial on 2026-11-19 on main (excerpt: the rules of the Allowance and Organization aggregates)
// Allowance. App rule 9: at most 40 model calls a day per organization.
invariants: {
  NeverMoreThanTheDaysAllowance: (s) => s.taken >= 0 && s.taken <= DAILY_CALLS
}

// Organization. App rule 7: an organization always keeps an admin.
invariants: {
  AlwaysKeepsAnAdmin: (s) => s._tag !== "Founded" || s.admins >= 1,
  NobodyIsCountedBelowZero: (s) => s._tag !== "Founded" || s.others >= 0
},
transitions: {
  AFoundedOrganizationStaysFounded: ({ before, after }) => before._tag !== "Founded" || after._tag === "Founded"
}
```

The model invariant, checked (not proved) by `Verify.model`:

```typescript
// Run in a trial on 2026-11-19 on main (the Inventory model's invariant; checked, not proved)
invariants: {
  EveryConfirmedFileAddsUp: (inventory) =>
    inventory.ImportDraft.every(
      (one) => one.state._tag !== "Imported" || one.state.created + one.state.notImported === one.state.rows
    )
}
```

What a failure looks like, also run: in a copy where the `evolve` of `RowLeftOut` forgot to lower `ready`,
`Verify.aggregate` failed with `NotVerified`; the report named `OutcomesAddUpToTheRows`, the command `LeaveRowOut`,
the state before (`{ _tag: "Open", rows: 1, ready: 1, waiting: 0, left: 0 }`), the event `RowLeftOut`, the state
after (`left: 1`), and the shortest sequence that reaches it (`StageImport { rows: 1, ready: 1 }`, then
`LeaveRowOut`). Not run: a decision transition, a relation, an `eventually` rule.

- **Used today:** no. The same rules are held by guarded D1 statements: the edit's revision check in `ItemStore.edit`,
  the confirm and take-back batches in `packages/catalog/host/src/ImportStore.adapter.ts`, the last-admin statement in
  `packages/access/host/src/PeopleStore.adapter.ts`, the allowance's counted insert in
  `packages/access/host/src/AllowanceStore.adapter.ts`, and the pure `review` in
  `packages/catalog/model/src/Review/Review.rules.ts`.
- **Where it goes:** on `ImportDraft` and `Item` aggregates in `packages/catalog/model/src/`, on `Allowance` and
  `Organization` aggregates in `packages/access/model/src/`, the model invariant on each context's model, and a Verify
  test in each package's `test` folder.
- **What the person gets:** nothing they can see; the guarantee that a stale edit, a second confirm or a forty-first
  model call can never be written is proved for every state and input, not only tested by example.

## How to check it

```typescript
// SKETCH: not compiled (main only; the trial ran Verify.aggregate on each aggregate without `require`)
it.effect("an import keeps its rules", () =>
  Verify.aggregate(ImportDraft, {
    require: { proved: ["OutcomesAddUpToTheRows", "AConfirmOfAClosedImportWritesNothing"] }
  })
    .pipe(Effect.provide(NodeServices.layer))
)
```

`Verify.aggregate(target, options?)` fails with `NotVerified` when a rule breaks, a required rule is only checked, or
part of the check was not done (`packages/domain/src/Verify.ts` lines 561-626; `require` at lines 474-478).
`Verify.model(Model, { apis, story })` adds the model's invariants, `eventually` rules and relations. `Prove.invariants`
gives the proof alone and fails with `InvariantsNotProved` (`packages/domain/src/Prove.ts` lines 307-317; see
[Prove](./prove.md)); `Explore.check` gives the search alone (see [Explore](./explore.md)). Each test file should
import one aggregate name only: in the trial, two aggregates of one name in one test file made the prover read one
file for both.

## What it needs

`main@dbfd0ddb`. Declaring the rules costs nothing at run time on any host. Checking them needs Node with `z3-solver`
(5.3.3 in the trial) and `oxc-parser` (dependencies of `@alchemy.run/domain` on main) and
`@effect/platform-node`'s `NodeServices.layer` for the file system; the trial ran under Node 24.22.1 and Vitest 5.0.4,
not Bun. See [Verify](./verify.md).

## Verdict

**Use, from main:** write the import, item, allowance and organization rules as aggregate invariants and transitions
(the trial's rules above, each tied to an app rule), add `EveryConfirmedFileAddsUp` as a model invariant, and pin the
rules with `require.proved` in `Verify.aggregate` and `Verify.model` tests run under Node. Taking it needs the app to
depend on `@alchemy.run/domain` at `main@dbfd0ddb` or later (no npm release has these fields; how is the brief's
decision), domain files that import their commands, events and helpers by relative paths, and an exception to
`newSchemaClass` for domain blocks.

## Where this was read

- `website/src/content/docs/domain/verifying-models.mdx`: not at `v2.0.0-beta.87`; on `main@dbfd0ddb` new
  (https://alchemy.run/domain/verifying-models answers 404 on the live site, which documents beta.87)
- `website/src/content/docs/domain/verifiable-code.mdx`, `model.mdx`: on `main@dbfd0ddb`
- `website/src/content/docs/domain/decision.mdx`: not at `v2.0.0-beta.87`; on `main@dbfd0ddb` new (469-483)
- `packages/domain/src/Aggregate.ts` at `v2.0.0-beta.87`; on `main@dbfd0ddb` changed
- `packages/domain/src/Decision.ts`: not at `v2.0.0-beta.87`; on `main@dbfd0ddb` new
- `packages/domain/src/Model.ts` at `v2.0.0-beta.87`; on `main@dbfd0ddb` changed
- `packages/domain/src/Verify.ts`, `Prove.ts`, `Explore.ts`, `Prove/internal/Paths.ts`, `Prove/internal/Source.ts`,
  `Explore/internal/ModelSearch.ts`: on `main@dbfd0ddb` new
- `examples/cloudflare-domain/packages/domain/src/Bank.model.ts`, `Customer/UsernameClaim.aggregate.ts`,
  `Customer/Registration.decision.ts`: on `main@dbfd0ddb` changed
- `examples/cloudflare-domain/packages/domain/test/{Bank.verify,Verify,Guards,Decision}.test.ts`,
  `test/fixtures/{Escrow,Aside}.aggregate.ts`: on `main@dbfd0ddb` new
