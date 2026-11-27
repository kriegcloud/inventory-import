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
twelve by a script (not kept) and formatted with the repository's settings. No line of logic was written by hand.
`Actor/` and `Review/` are the three files it imports, copied unchanged.

| File | Kind | Holds |
| --- | --- | --- |
| `<Command>.command.ts` (seven) | command | the event it records and what that event makes of an import (`evolve<Event>`), the rejections only it returns, the command, and what the import decides of it (`decide<Command>`) |
| `<Event>.event.ts` (two) | event | an event only a decision records (`ActCounted`, `GroupCounted`), and its `evolve` |
| `Import.rejection.ts` | rejection | the five rejections several commands or decisions return |
| `Import.state.ts` | state | the state's schema and the four invariants, each a named function |
| `Import.aggregate.ts` | aggregate | the two unions the transitions read, the 23 transitions, and the listing of everything else |

## What was found

- **It proves what the one file proves** (`ImportModule.test.ts`): 210 lines of standing, the same as the package's
  own aggregate, read from the package.
- **The whole model verifies with it against the unchanged lock** (`command-file`, `model-full`).
- **The transitions stay in the aggregate's file, written in place.** Moved to a file of their own they prove the
  same, and the lock then refuses all 23: it keeps each rule's text, and "only an invariant of an aggregate is
  compared with the one it was". Moving them is a relock a person reads, not a refactor. The invariants moved and
  were accepted.
- **`invariants` cannot be one imported object.** With `invariants` and `transitions` each exported as an object and
  the aggregate holding `invariants, transitions`, the prover fails: "declares Import without its invariants". The
  aggregate's file must hold the object, so it lists them by name.
- **An `evolve` is an exported function, not a static of its event's class.** `ColumnMatched: ColumnMatched.evolve`
  type-checks and runs, and the prover answers `NotTranslated` for every rule of the command, with a plain static
  and with the `dual` one. The repository patches the prover already (`packages/patches/alchemy-domain.patch`);
  following a static of a class is about forty more lines of it, tried on a copy of the library
  (`../command-file/prover-static-member.patch`): with them the static form proves as the baseline does.
- **Only the `decide`s cost mutants**: all 60 that name `Import.aggregate.ts` change a line of a `decide`.

Not done: `laws block-files` has no `.state.ts` and no `.event.ts`, and was not run on these files; the stories were
not run.
