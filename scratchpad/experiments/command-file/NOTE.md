---
status: open
started: 2026-11-27
template: verify
libraries: 
---

# command-file

Does the prover still prove every rule of Import when one command, its event and its decide move to a .command.ts?

Asked by [explorations/module-taxonomy](../../../explorations/module-taxonomy/README.md), experiment 1.

## What is here now

Removed on 2026-11-27, at his word that the copies had become hard to tell apart: `baseline`, `split`,
`split-decide`, `split-evolve`, `split-evolve-const`, `full`, `full-shorthand`, `model-split`,
`model-split-command`, `model-full`, `model-ns`, and the four tests that proved them (`CommandFile`, `EventStatics`,
`FullShape`, `Namespace`). They are in the repository's history at `52b53e36`. What follows still tells what each
found. Left:

| Path | What it is |
| --- | --- |
| `model-baseline/` | the package's twelve files, copied unchanged: the control |
| `model-role/` | the chosen shape under the whole model: an event and a command each in a file, read as a namespace |
| `WholeModel.test.ts` | Verify on those two, each against a copy of the package's lock |
| `full-ns/` | the earlier namespace form (`StageImport.ImportStaged`); kept because it holds an edit of his not yet committed; no test runs it |
| `prover-static-member.patch`, `lock-rule-by-name.patch` | two changes to the library, each tried on a copy and not applied |

The one module to read is [import-module](../import-module/NOTE.md).

## What was tried

Three copies of the `Import` aggregate with the three files it imports, each proved with `Prove.report` on its own
`Import.aggregate.ts` (`CommandFile.test.ts`):

- `baseline/`: `packages/catalog/model/src` at `a184783d`, copied unchanged.
- `split/`: `MatchColumn` and the event it records, `ColumnMatched`, moved to `Import/MatchColumn.command.ts`; the four
  rejections it returns (`NotPermitted`, `NotOpen`, `ConfirmedSince`, `MatchedSince`) moved to
  `Import/Import.rejection.ts`. The aggregate imports them. Its `decide` is where it was.
- `split-decide/`: the same, and `MatchColumn`'s decide moved beside its command as `decideMatchColumn`, with the
  state (`ImportState` and the fields every staged import keeps) moved to `Import/Import.state.ts`. The aggregate's
  `decide` holds `MatchColumn: decideMatchColumn`.

Then the whole model, as `packages/catalog/model/test/Catalog.verify.test.ts` runs it (`WholeModel.test.ts`, run
with `CI=true` so no lock is written): `model-baseline/`, the twelve files `Catalog.model.ts` reaches, unchanged, and
`model-split/`, the same with the `split-decide` change and every decision and the model importing the moved names
from their new files. A third copy, `model-split-command/`, has the `split` change only: the command, its event and
the four rejections moved, every `decide` and the state left in the aggregate, which is the shape decision 1 of the
exploration chose. Each has a copy of the package's lock.

The copies were made by a script from the package's source, not typed by hand; the script is not kept. The test
compares everything each report says (each rule for each command, each command's schema and whether some state
accepts it, the starting state, `outside`, `unread`, `unkept`, and where the code differs from what was read) as
sorted lines.

## What was found

- **All three stand the same**: 210 lines each, every rule `Proved` for every command, in about nine seconds for the
  three. `bun run scratch:check` passes on them with the whole Effect profile.
- **The prover reads the moved decide.** With the line that refuses a match made on an older matching
  (`MatchedSince`) deleted from `split-decide/Import/MatchColumn.command.ts`, the test failed:
  `AMatchIsMadeOnTheLastOne` was no longer proved for `MatchColumn`. The line was put back.
- **The whole model is verified either way, against the same lock.** Both runs: nothing left undone, verified, nothing
  relocked, the 134 rules the lock requires proved, the search three commands deep; 266 seconds for the two. The
  lock's copy was byte for byte the package's after the run. The four decisions take `NotOpen`, `NotPermitted`,
  `ConfirmedSince`, `MatchedSince` and `ImportState` from the new files there.
- **The chosen shape is verified on the whole model too.** `model-split-command`, run alone: the same five checks
  pass in 157 seconds, and the lock's copy is the package's byte for byte afterwards.
- **A command cannot move alone.** The rejections it shares must leave the aggregate's file with it, or the command's
  file and the aggregate's import each other.
- **A decide cannot move without the state.** It reads `ImportState`, so the state needs a file that both the
  command's file and the aggregate's import. `laws block-files` has no ending for that file.
- **A decide written apart names its parameter types** (`s: ImportState, cmd: MatchColumn`); inline in the aggregate
  they are inferred.

- **An event's `evolve` can sit beside the event as an exported function, not as a static of its class**
  (`EventStatics.test.ts`, on `Import`). With `ColumnMatched: evolveColumnMatched` the import stands as the baseline
  does. With `static readonly evolve` on the class and `ColumnMatched: ColumnMatched.evolve` in the aggregate, the
  code type-checks and runs, and the prover answers `NotTranslated` for all 27 rules of `MatchColumn`: it follows a
  name to its declaration and does not follow a member of a class. Either form needs the state in its own file. The
  repository's diagnostics refuse a bare exported `(s, e) =>` (`missingPipeableSignature`), so the function is written
  with `dual`, and the prover reads through it: with `matching: e.matching` dropped from it, `AMatchIsTheNextOne` was
  `Violated` for `MatchColumn`. The line was put back.

- **The aggregate's file can be a listing and nothing else** (`FullShape.test.ts`, `full/`). Every event's `evolve`
  is beside its event and every command's `decide` beside its command, in seven `.command.ts` files and two
  `.event.ts` files (for `ActCounted` and `GroupCounted`, which only a decision records); the four invariants are in
  `Import.state.ts` with the state; the 23 transitions and the two unions they read are in `Import.rules.ts`; five
  shared rejections are in `Import.rejection.ts`. `Import.aggregate.ts` goes from 725 lines to 99: its comment, its imports and
  the listing. The import stands as the baseline does, line for line, with the listing written out (`Name: Name`) and
  in shorthand (`full-shorthand/`). With one moved transition and one moved invariant changed, three proofs were
  `Violated`; the files were made again.
- **Transitions cannot sit beside the state or an event.** A transition reads the command and the events, so its
  file imports every command's file, and every command's file imports the state's. They need a file above the
  commands; the invariants read the state alone and sit with it.
- **Only a `decide` costs mutants.** All 60 of the mutants that name `Import.aggregate.ts` change a line of a
  `decide`; none changes an `evolve`, a transition or an invariant. Each of the 60 names the file and the line's text
  with its indentation, and both change.

- **Under the whole model, the transitions must stay where they are.** With them in `Import.rules.ts` the model's
  verify fails on the lock for all 23: "changed from the rule locked in Catalog.lock.json: only an invariant of an
  aggregate is compared with the one it was". The lock keeps each rule's text. `model-full` therefore keeps the two
  unions and the transitions in the aggregate's file, in place, and moves everything else: verified against the
  package's lock, the lock unchanged. The same shape, alone and formatted, is
  [import-module](../import-module/NOTE.md).

- **The prover can be taught to read a static of an event's class in about forty lines**
  (`prover-static-member.patch`, against the library's built `lib/Prove/internal/Interpreter.js` at `e1c3e6d` with
  the repository's patch applied). Where code says `Name.key` and `Name` is a class a file of the model declares,
  through the imports that give it, the change reads the static's value from the source, as it reads an exported
  function. Tried on a copy of the library, not on `node_modules`, and the copy is not kept: with it
  `split-evolve` (`static readonly evolve` written with `dual`, `ColumnMatched: ColumnMatched.evolve`) stands as the
  baseline does, and with `matching: e.matching` dropped from the static, `AMatchIsTheNextOne` is `Violated`. Not
  tried: the whole model's verify, a decision, a static `decide`, and the same change to `src/` (which bun reads; the
  repository's patch carries both).

- **With that change the whole module can be written with statics.** Every event with `static readonly evolve` and
  every command with `static readonly decide`: the import proves as the baseline does, and the whole model verifies
  against the unchanged lock, both run with a copy of the library carrying the patch. The copies of the model and of
  the library are not kept, since no test here can run them without the patch.
- **Read as a namespace, the same module needs no change to the prover** (`Namespace.test.ts`, `full-ns/`;
  `WholeModel.test.ts`, `model-ns/`). Each command's file exports `evolve` and `decide` under those names and the
  aggregate holds `import * as StageImport` and `StageImport.decide`, `StageImport.evolve`,
  `StageImport.StageImport`. Proved as the baseline; the whole model verified against the unchanged lock.

- **With role names and one event to a file, the same** (`WholeModel.test.ts`, `model-role/`). Each of the import's
  nine events is `<Tag>.event.ts` exporting `Event` and `evolve`, each command's file exports `Command` and
  `decide`, and the four decisions record `ActCounted.Event` and `GroupCounted.Event`. The whole model verified
  against the unchanged lock. The `Import` folder there is the one in [import-module](../import-module/NOTE.md).

- **The lock can follow a rule's name to where it is declared, in about 25 lines** (`lock-rule-by-name.patch`,
  against the library's built `lib/Prove/internal/Lock.js`). The lock keeps the text written at the rule's place in
  the aggregate. For a rule listed by name that text is the name: a moved transition is refused, and a listed
  invariant, once relocked, is held by its name and no longer by its body (read in `Verify.ts` and `Lock.ts`, not
  run). With the change, the text of a rule written as a name is the text of what the name is declared as, through
  the imports that give it. Tried on a copy of the library and of `model-role` with all 23 transitions in
  `Import/Import.transition.ts`, each `export const Name: Rule = <the rule as it was>`, the two unions in
  `Import/Import.union.ts`, and the aggregate listing them by name (138 lines): the whole model verified against
  the unchanged lock. With `after.matching === before.matching + 1` made `>=` in the moved file, the run failed on
  that one rule: "Import.AMatchIsTheNextOne changed from the rule locked". The copies are not kept. A rule's
  declaration must carry its type on the name and not on its parameters, or its text is not the locked text. Not
  tried: the same change to `src/`, a rule read through a namespace (`Transition.Name`), a decision's transitions
  moved.
- **A transition written with `effect/Predicate` is not read.** `P.or(P.Struct({ before: P.not(guard) }),
  P.Struct({ after: guard }))` in place of one rule does not type-check (`P.Struct`'s input is exactly its keys, so
  the two sides of `P.or` differ), and with it the prover translates no rule of the import for any command (203
  lines `NotTranslated`). `P.Struct` is every field at once; a transition is one thing or another, and most compare
  `after` with `before`.

Not tried here: the stories; `laws block-files` and `laws model-inputs` on the new files. The model's mutants name a file, an
anchor and the exact text of a line with its indentation (60 of the 192 name `src/Import/Import.aggregate.ts`), so
moving a decide means writing those again; moving only a command and its event leaves every decide where its mutants
look for it.
