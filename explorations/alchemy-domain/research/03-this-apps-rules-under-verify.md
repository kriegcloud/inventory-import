---
type: Research
title: This app's rules under Verify
description: The rules inventory-import already states in its instructions and tests, each as the invariant, transition or model rule it becomes, as declared and proved in a trial on the library's main; and the rules a prover cannot hold, with what holds them.
---

# This app's rules under Verify

The app states its rules in [CLAUDE.md](../../../CLAUDE.md) ("Rules for an import", "Identity and permissions") and
holds them with tests on a real local database. This page takes each rule and writes it the way
[`Verify`](concepts/verify.md) wants it: as an [invariant or a transition](concepts/invariants-and-transitions.md) of
an aggregate, as a rule of the model, or as a [relation](concepts/relation.md) between two aggregates.

Every declaration below was run on 2026-11-19 on the library's `main` at `dbfd0ddb`, which npm does not have yet.
[The trial](04-trial.md) has the setup, the full report and the complete source. "Proved" means what the report
means by it: for every state and every input, after any number of commands.

## The rules, and how each stands

| # | The app's rule | Declared as | Name | In the trial |
| --- | --- | --- | --- | --- |
| 1 | An import's outcomes add up to the rows in the file | invariant of `ImportDraft` | `OutcomesAddUpToTheRows` | proved |
| 1 | The same, for every import at once | invariant of the model | `EveryConfirmedFileAddsUp` | checked: 5,173 sequences of up to 2 commands |
| 2 | Nothing is written before Confirm | transition of `ImportDraft` | `NothingIsWrittenBeforeConfirm` | proved |
| 3 | A second import of the same file adds nothing | transition of `Item` | `ASecondCreateChangesNothing` | proved |
| 4 | A take-back removes only unchanged items and keeps a changed one | transitions of `Item` and `ImportDraft` | `ATakeBackKeepsAChangedItem`, `ATakeBackKeepsWhatWasChanged`, `OnlyAnImportedFileIsTakenBack` | proved |
| 5 | An edit made on an old revision is refused | transitions of `Item` | `EveryEditWasMadeOnTheCurrentRevision`, `ARevisionOnlyGoesUp` | proved |
| 6 | Every row belongs to one organization | transitions of `ImportDraft` | `AnImportNeverChangesOrganization`, `OnlyItsOwnOrganizationChangesAnImport`, `AViewerChangesNothing` | proved, given the request context |
| 7 | An organization always keeps an admin | invariant of `Organization` | `AlwaysKeepsAnAdmin` | proved |
| 8 | A model proposes and never writes | transition of `ImportDraft` | `ASuggestionWritesNothing` | proved |
| 9 | At most 40 model calls a day, counted before the call | invariant of `Allowance` | `NeverMoreThanTheDaysAllowance` | proved |
| 10 | A confirm of an import that is no longer open writes nothing | transition of `ImportDraft` | `AConfirmOfAClosedImportWritesNothing` | proved |

Nineteen rules were proved in all (the table's fifteen, with `NoCountIsNegative`, `ARevisionStartsAtOne`,
`NobodyIsCountedBelowZero` and `AFoundedOrganizationStaysFounded`), and one was checked.

## 1. An import's outcomes add up to the rows in the file

The import's state counts its rows in one place at every moment, so the rule is a line of arithmetic per state:

```ts
// An import's outcomes add up to the rows in the file.
OutcomesAddUpToTheRows: (s) =>
  s._tag === "Open"
    ? s.ready + s.waiting + s.left === s.rows
    : s._tag === "Imported"
      ? s.created + s.notImported === s.rows
      : s._tag === "TakenBack"
        ? s.removed + s.kept + s.notImported === s.rows
        : true,
```

What keeps it is in `decide` and `evolve`: staging computes `waiting` as `rows - ready` and refuses more ready rows
than rows; settling a row moves one from `waiting` to `ready`; leaving one out moves one from `ready` to `left`; the
confirm records `created: s.ready` and `notImported: s.waiting + s.left`. When the trial removed one half of one of
those moves, the prover named the command, the state and the sequence that breaks the sum
([the trial](04-trial.md), "A rule that breaks").

The model can say the same of every import at once. A model's invariant is given every instance, so it is searched
over sequences of commands, not proved:

```ts
  invariants: {
    EveryConfirmedFileAddsUp: (inventory) =>
      inventory.ImportDraft.every(
        (one) => one.state._tag !== "Imported" || one.state.created + one.state.notImported === one.state.rows,
      ),
  },
```

## 2. Nothing is written before Confirm, and 10. a confirm of a closed import writes nothing

A transition is given the state before, the state after and the command. Both rules are about which command may
cause which change:

```ts
// Nothing is written as an item before Confirm.
NothingIsWrittenBeforeConfirm: ({ before, after, command }) =>
  after._tag !== "Imported" || before._tag === "Imported" || command._tag === "ConfirmImport",
```

```ts
// A confirm of an import that is no longer open writes nothing.
AConfirmOfAClosedImportWritesNothing: ({ before, after, command }) =>
  command._tag !== "ConfirmImport" || before._tag === "Open" || after._tag === before._tag,
```

A transition is asked only of a command that commits. A refused command records nothing, so rule 10 is kept by
`decide` refusing with `NotOpen`, and the transition says what would be wrong if it ever did not.

## 3. A second import of the same file adds nothing

Today a unique index on `(organizationId, skuKey)` and `ON CONFLICT DO NOTHING` make this true
(`packages/catalog/host/src/ImportStore.adapter.ts`). As an aggregate, the item's id is the organization and the SKU
key, so the id itself is the unique value, and a create that finds the item there records nothing:

```ts
CreateFromImport: (s, cmd) =>
  s._tag === "Stored" ? [] : [new ItemCreated({ confirmId: cmd.confirmId, quantityOnHand: cmd.quantityOnHand })],
```

```ts
// A second import of the same file adds nothing.
ASecondCreateChangesNothing: ({ before, after, command }) =>
  command._tag !== "CreateFromImport" ||
  before._tag !== "Stored" ||
  (after._tag === "Stored" &&
    after.revision === before.revision &&
    after.quantityOnHand === before.quantityOnHand &&
    after.createdBy === before.createdBy),
```

"Already there" is then counted from what the receipt holds: no event means the item was there.

## 4. A take-back removes only unchanged items and keeps a changed one

An item is unchanged while it is at revision 1 and was created by the confirm being taken back:

```ts
RemoveIfUnchanged: (s, cmd) =>
  s._tag === "Stored" && s.revision === 1 && s.createdBy === cmd.confirmId ? [new ItemRemoved({})] : [],
```

```ts
// A take-back removes only an item nobody changed, and keeps a changed one.
ATakeBackKeepsAChangedItem: ({ before, after, command }) =>
  command._tag !== "RemoveIfUnchanged" ||
  before._tag !== "Stored" ||
  before.revision === 1 ||
  after._tag === "Stored",
```

On the import's side, a take-back records how many it kept, and only an imported file can be taken back:

```ts
// A take-back keeps what someone changed, and only an imported file is taken back.
OnlyAnImportedFileIsTakenBack: ({ before, after }) =>
  after._tag !== "TakenBack" || before._tag === "Imported" || before._tag === "TakenBack",
```

```ts
ATakeBackKeepsWhatWasChanged: ({ before, after, command }) =>
  command._tag !== "TakeBackImport" ||
  before._tag !== "Imported" ||
  after._tag !== "TakenBack" ||
  after.kept === command.kept,
```

Whether the import's `kept` equals the number of items that really stayed is a rule across two aggregates. It is not
declared in the trial; it is a [relation](concepts/relation.md), proved only if one step writes both sides (a
[decision](concepts/decision.md)), and otherwise checked.

## 5. An edit made on an old revision is refused

```ts
EditItem: (s, cmd) =>
  s._tag !== "Stored"
    ? new NoSuchItem({})
    : cmd.revision !== s.revision
      ? new EditedSince({ current: s.revision })
      : [new ItemEdited({ quantityOnHand: cmd.quantityOnHand })],
```

```ts
// An edit made on an old revision is refused: every edit that commits was made on the current one.
EveryEditWasMadeOnTheCurrentRevision: ({ before, command }) =>
  command._tag !== "EditItem" || (before._tag === "Stored" && command.revision === before.revision),
```

```ts
ARevisionOnlyGoesUp: ({ before, after }) =>
  before._tag !== "Stored" || after._tag !== "Stored" || after.revision >= before.revision,
```

The trial keeps the revision in the state. The decide context also gives the stream's `version`, and the import's
confirm uses that to refuse a stale review: `cmd.reviewedAt !== version`. The prover read that comparison too.

## 6. Every row belongs to one organization

The library has no tenant of its own. The trial puts the organization in three places: in the request context every
command carries, in the import's state when it is staged, and in every `decide`, which refuses a caller from another
organization or a viewer. The rules are then:

```ts
// Every row belongs to one organization.
AnImportNeverChangesOrganization: ({ before, after }) =>
  before._tag === "Unstaged" || after._tag === "Unstaged" || before.organizationId === after.organizationId,
```

```ts
OnlyItsOwnOrganizationChangesAnImport: Effect.fn(function* ({ before }) {
  if (before._tag === "Unstaged") return true
  return (yield* CurrentActor).organizationId === before.organizationId
}),
```

```ts
AViewerChangesNothing: Effect.fn(function* () {
  return (yield* CurrentActor).role !== "viewer"
}),
```

The last two are `Effect.fn` rules that read `CurrentActor`, and both were proved. What they prove is exact: no
command commits on a staged import unless its request context names that import's organization and a role above
viewer. What they do not prove is that the request context is true. The report says so under "Assumed": "middleware
lets every caller in: who sends a command is anyone its request context allows". The session middleware (is this
session real, is this member still in this organization) needs its own test, as it has today.

Today SQL holds a stronger form of this rule: every table's key starts with `organizationId` and a child names its
parent by `(organizationId, id)`, so a row cannot point across organizations at all. Rows a
[projection](concepts/projection.md) writes into D1 keep that, and `Verify` does not look at them.

## 7. An organization always keeps an admin

The first reading of this rule is a relation across every member. It cannot be a [decision](concepts/decision.md),
because a decision's instances are named by a pure function of the command, and no command can name "every admin".
So the rule lives in one instance that knows the organization's roles:

```ts
// Rule 7 of the app: an organization always keeps an admin.
AlwaysKeepsAnAdmin: (s) => s._tag !== "Founded" || s.admins >= 1,
```

kept by `ChangeRole` and `RemoveMember` refusing with `LastAdmin` when the admin in question is the only one. The
trial counts admins and others; the real aggregate would hold the members by id, and a rule that walks a list is
proved only for short lists ([prove](concepts/prove.md)).

## 8. A model proposes and never writes

A suggestion is a command of its own, and the rule says it moves no row:

```ts
// A model proposes and never writes: a suggestion moves no row.
ASuggestionWritesNothing: ({ before, after, command }) =>
  command._tag !== "RecordSuggestion" ||
  before._tag !== "Open" ||
  (after._tag === "Open" &&
    after.ready === before.ready &&
    after.waiting === before.waiting &&
    after.left === before.left),
```

## 9. At most 40 model calls a day, counted before the call

```ts
  invariants: {
    NeverMoreThanTheDaysAllowance: (s) => s.taken >= 0 && s.taken <= DAILY_CALLS,
  },
```

```ts
TakeModelCall: (s) => (s.taken >= DAILY_CALLS ? new AllowanceUsedUp({}) : [new ModelCallTaken({})]),
```

The call is taken by a command before the model is asked, so a call that fails still counts, as today. The trial
resets the count with a `StartNewDay` command. The app's allowance today is a rolling window of 24 hours counted in
SQL; whether the day becomes a calendar day is a product decision, not a modelling one.

## What a prover cannot hold, and what holds it

| Rule or behaviour | Why Verify does not hold it | What does |
| --- | --- | --- |
| The rows a confirm writes into D1 are all there or none are | The report: "what a projection writes, and what a stream or a query gives, is not checked: only what a projection is given" | A slow test of the D1 adapter on a real local database, as `apps/inventory/test` has today |
| The unique index and `ON CONFLICT DO NOTHING` | SQL, outside the model | The same slow tests |
| The search index finds an item by any word | SQL (FTS5) | The same slow tests |
| The three numbers agree (rows in the file, what the result says, what is stored) | The first two are the import's invariant; the third is what a projection wrote | The invariant, and a slow test that counts stored rows |
| The session is real and the member is in the organization | Middleware is assumed to let every caller in | A test of the session middleware |
| The pure `review` puts every row in exactly one place | It runs before the command, outside `decide`, and uses string and collection helpers the prover has no model for ([prove](concepts/prove.md)) | Its own unit and property tests, as today; the confirm then carries its counts, and the invariant holds them to the rows |

## What this asks of how the rules are written

Found by running, not by reading ([the trial](04-trial.md), "What the prover reads of this repository's style"):

- Inside a block, an event or a rejection is built with `new`. The prover does not read `Event.make(...)`. The house
  rule is `.make`, held by the diagnostic `newSchemaClass`; a file of domain blocks needs that rule switched off.
- An aggregate's commands, events and rejections, and any helper its rules call, must be reachable from its file by
  relative imports. Imported by package name they are not read, which decides where they may live among the app's
  packages ([project layout](concepts/project-layout.md)).
- Rules are plain comparisons and arithmetic over the state's tagged cases. That is what was proved here; what else
  the prover reads is on [prove](concepts/prove.md).
- One aggregate name per test file.
