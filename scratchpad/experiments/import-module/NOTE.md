---
status: open
started: 2026-11-27
template: probe
libraries: 
---

# import-module

What does the Import aggregate look like as one module where every file is one kind and the aggregate's file only lists?

Asked by [explorations/module-taxonomy](../../../explorations/module-taxonomy/README.md). This is the one module to
read; how it was arrived at is in [command-file](../command-file/NOTE.md).

## What was tried

`Import/` is `packages/catalog/model/src/Import/Import.aggregate.ts` at `a184783d`, one file of 725 lines, cut into
sixteen by scripts (not kept) and formatted with the repository's settings. No line of logic was written by hand.
`Actor/` and `Review/` are the three files it imports, copied unchanged.

| File | Kind | Exports |
| --- | --- | --- |
| `<Tag>.event.ts` (nine) | event | `Event`, the event's class, and `evolve`, what it makes of an import |
| `<Tag>.command.ts` (seven) | command | `Command`, the command's class; `decide`, what the import decides of it; and the rejections only it returns, by their own names |
| `Import.rejection.ts` | rejection | the five rejections several commands or decisions return |
| `Import.state.ts` | state | `State`, the state's schema; each case of it under its own name (`Open`, `Imported`, ...); `guards`, `cases` and `isAnyOf`; and the four invariants, each a named function |
| `Import.aggregate.ts` | aggregate | the two unions the transitions read, the 23 transitions, and the listing of everything else |

Every file of a kind exports the same names, and the stem is the block's tag. Each is read as a namespace, as
`effect/Option` is read: `import * as ImportStaged from "./ImportStaged.event.ts"`, then `ImportStaged.Event`,
`ImportStaged.evolve`, `StageImport.Command`, `StageImport.decide` (Benjamin, 2026-11-27: the namespace form, then
"Role names, event per file"). In the aggregate's listing every key is its namespace:
`ImportStaged: ImportStaged.evolve`, `StageImport: StageImport.decide`.

The state's file is read as `ImportState`, since four files share the stem `Import`: `ImportState.State`,
`ImportState.Open.make(...)`, `ImportState.guards.Open(s)`, `ImportState.OutcomesAddUpToTheRows` (Benjamin,
2026-11-27: each case under its own name, and `State` for the schema). Every rule reads `ImportState.guards` as it
did before, letter for letter.

An earlier form, with the event beside its command and each class under its own name (`StageImport.ImportStaged`),
is `../command-file/full-ns`.

## What was found

- **The namespace form needs no change to the prover.** It follows `import * as` already. The same logic as a
  static of the class (`StageImport.decide` with `StageImport` the class) needs about forty lines added to it
  (`../command-file/prover-static-member.patch`), and then also verifies on the whole model.
- **One event to a file is what makes the names uniform.** With an event beside its command a file has one
  `evolve`, and a command that records two events has no second name. Four of the model's eleven commands record an
  event another file declares, and `UndoGroup` records two.
- **The prover reads through the role names.** With the line that refuses a match made on an older matching deleted
  from `MatchColumn.command.ts`, and `matching: e.matching` dropped from `ColumnMatched.event.ts`, on a copy:
  `AMatchIsMadeOnTheLastOne` and `AMatchIsTheNextOne` were `Violated` for `MatchColumn`. The copy is not kept.
- **A class named `Event` hides the DOM's in its file**, and `scratch:check` passes with the whole Effect profile.

- **It proves what the one file proves** (`ImportModule.test.ts`): 210 lines of standing, the same as the package's
  own aggregate, read from the package.
- **The whole model verifies with it against the unchanged lock** (`command-file`, `model-role`): the four
  decisions take `ActCounted.Event` and `GroupCounted.Event` from the two files there.
- **The transitions stay in the aggregate's file, written in place.** Moved to a file of their own they prove the
  same, and the lock then refuses all 23: it keeps each rule's text, and "only an invariant of an aggregate is
  compared with the one it was". Moving them is a relock a person reads, not a refactor. The invariants moved and
  were accepted.
- **`invariants` cannot be one imported object.** With `invariants` and `transitions` each exported as an object and
  the aggregate holding `invariants, transitions`, the prover fails: "declares Import without its invariants". The
  aggregate's file must hold the object, so it lists them by name.
- **Without that change, an `evolve` is an exported function, not a static of its event's class.** `ColumnMatched: ColumnMatched.evolve`
  type-checks and runs, and the prover answers `NotTranslated` for every rule of the command, with a plain static
  and with the `dual` one. The repository patches the prover already (`packages/patches/alchemy-domain.patch`);
  following a static of a class is about forty more lines of it, tried on a copy of the library
  (`../command-file/prover-static-member.patch`): with them the static form proves as the baseline does.
- **Only the `decide`s cost mutants**: all 60 that name `Import.aggregate.ts` change a line of a `decide`.

- **The state's cases under their own names and `State` read as `ImportState` change nothing the prover or the lock
  reads.** Proved as the package's file, and the whole model verified against the unchanged lock (`command-file`,
  `model-role`). The discriminator stays `status`: `_tag` would change every rule that reads it and what is stored.
- **Defaults on the state's fields are not read.** Tried on a copy, not kept: with
  `S.withConstructorDefault(Effect.succeed(0))` on each count and `ImportStaged`'s `evolve` naming only what the event
  gives, the code type-checks and every rule is `Misread` for `StageImport`. The prover reads a `make` as the object
  written, without the defaults; it would need to be taught them. So `ImportStaged.event.ts` still writes every zero.

Not done: `laws block-files` has no `.state.ts` and no `.event.ts`, and was not run on these files; the stories were
not run; what the library or a tool prints from a class's own name, now `Event` nine times, was not looked for; the
events of `Row` and `Group` and the four decisions' own commands were left as they are.
