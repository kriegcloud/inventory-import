---
status: open
started: 2026-11-27
template: verify
libraries: 
---

# command-file

Does the prover still prove every rule of Import when one command, its event and its decide move to a .command.ts?

Asked by [explorations/module-taxonomy](../../../explorations/module-taxonomy/README.md), experiment 1.

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

Not tried here: the stories; `laws block-files` and `laws model-inputs` on the new files. The model's mutants name a file, an
anchor and the exact text of a line with its indentation (60 of the 192 name `src/Import/Import.aggregate.ts`), so
moving a decide means writing those again; moving only a command and its event leaves every decide where its mutants
look for it.
