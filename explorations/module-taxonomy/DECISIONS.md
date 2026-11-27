---
type: Decisions
title: Decisions
description: Module taxonomy decisions. The open questions, one decision each, with the option recommended and what it was tried on, and the answered ones with the options he rejected and how to reverse them. Decision 1 was answered twice; the later answer stands.
---

# Decisions

Open questions are listed first. Each is put to Benjamin with its options, the recommended one first; nothing below
is decided until he answers, and no recommendation here is his. Answered decisions move under "Answered" with the
date, the answer and how to reverse it.

## Open

| # | Question | Recommended | Changes | Where it is argued |
| --- | --- | --- | --- | --- |
| 6 | What ending do the four files with none take? (`Host.ts` in both hosts, `Adapters.ts` and `Config.ts` in access's) | Asked when its part of the brief opens | | [BRIEF](BRIEF.md), Map |
| 7 | Is each of the three endings used once a kind, or is its file renamed? (`.reference`, `.state`, `.route`) | Asked when its part of the brief opens | Decision 1 as replaced gives a model `.state.ts`; `.state` is asked first | [BRIEF](BRIEF.md), Map |

Decisions 1, 3, 4 and 5 were answered on 2026-11-27 and are under "Answered"; he replaced his answer to 1 the same
day and then answered 2. 6 and 7 were not put to him; neither blocks the brief's first slice.

## Answered

### 2026-11-27: decision 2

Asked by dialog after decision 1 was replaced. He picked the recommended option.

**2. Who holds the stem, the exports and the namespace import.**

- Question: is "an event's or a command's file has its tag for a stem, exports its kind's names and is imported as a
  namespace" a law or a convention?
- Answer: "A law". `laws block-files` compares each block's tag with its file's stem, holds a `.event.ts` to `Event`
  and `evolve` and a `.command.ts` to `Command`, `decide` and its own rejections, and refuses a named import of
  `Event` or `Command`.
- Rationale: nine classes of `Import` are named `Event`, and an editor offers `import { Event }` for each. Rejected:
  "A law, without the import rule"; "A convention", held by review. Nothing of the law is written or tried.
- Not decided by it: what a decision's, an aggregate's or a rejection's file exports. They keep their own names.
- Reverse: take the three checks out of `block-files`; no file changes.

### 2026-11-27: decision 1, replaced

Asked by dialog twice after the first answer below: whether the namespace shape replaces it ("Yes, adopt it"), then
which names the files export ("Role names, event per file"). Both were the recommended option.

**1. Where an event, a command and their logic live.**

- Question: does an event's `evolve` sit beside the event and a command's `decide` beside the command, and what does
  each file export?
- Answer: "Role names, event per file". One event to `<Tag>.event.ts`, exporting `Event` and `evolve`. One command to
  `<Tag>.command.ts`, exporting `Command`, `decide` and the rejections only it returns. Each is imported as a
  namespace named for its stem: `ImportStaged.Event`, `ImportStaged.evolve`, `StageImport.Command`,
  `StageImport.decide`. The state and the invariants are in `<Aggregate>.state.ts`; the aggregate's file keeps the two
  unions, the transitions and the listing.
- Rationale: his, that Effect's and the library's own modules are read this way (`Option.map`) and that a file read
  as a namespace gives every block of a kind the same names. An event has its own file because four of the model's
  eleven commands record an event another file declares, and `UndoGroup` records two. Tried on `Import` as sixteen
  files (`scratchpad/experiments/import-module`): it proves what the package's one file proves, a broken moved
  `decide` and a broken moved `evolve` are each caught, and the whole model verifies against the package's lock, the
  lock unchanged (`scratchpad/experiments/command-file`, `model-role`).
- Rejected: "Role names, events stay with commands" (`StageImport.Event`), which loses the event's word and has no
  place for a second event; "Named exports, as built" (`StageImport.ImportStaged`, `ActCounted.ActCounted`), also
  verified; `evolve` and `decide` as statics of the class, which the prover reads only with about forty lines added
  to it (`prover-static-member.patch`); and the first answer below.
- Costs he took: the 60 mutants that name `Import.aggregate.ts` each change a line of a `decide` and are written
  again; `.state.ts` and `.event.ts` become kinds; every event's class is named `Event` where a hover or a stack
  trace shows a class's name; the transitions do not move, because the lock keeps each rule's text.
- Reverse: move each `evolve` and `decide` back into the aggregate's or the decision's file and each event back
  beside the command that records it, and rename the classes to their tags. No rule and no tag changes either way,
  so the lock holds in both directions.

### 2026-11-27: decisions 1, 3, 4 and 5

Asked by dialog, each with its options, the recommended one first. He picked the recommended option of each.

**1. Where a command of the model lives.** Replaced the same day; see above.

- Question: does a command stay in the file of the aggregate or decision that decides it, or take a file of its own,
  and does its `decide` go with it?
- Answer: "Own file, decide stays". One command to a `.command.ts`, with its events and the rejections only it
  returns; its `decide` stays in the aggregate or the decision.
- Rationale: the library's own layout, and verified on a copy of the whole model against the package's lock
  (`scratchpad/experiments/command-file`, `model-split-command`, run after his answer). Rejected: "Own file with its decide", also verified, which needs the state
  in a file of its own (an ending `block-files` does not have) and 60 of the model's 192 mutants written again; and
  "As today". It replaces "Hold all kinds" (2026-11-26) for commands. A rejection several commands return moves to a
  `.rejection.ts` with the first of them that moves.
- Reverse: move each command, its events and its rejections back into its decider's file; `block-files` allows both
  places today.

**3. A registry of kinds.**

- Question: is there one registry of kinds (the ending, what the file declares, which layer holds it, who may import
  it) that the laws read, and how far does it reach?
- Answer: "Every context layer". `contract`, `model`, `host` and `web`.
- Rationale: sixteen of the 173 files of the catalog and access contexts are refused by a first cut of it
  (`scratchpad/experiments/kind-registry`), and no import crosses a door it closes. Rejected: "Every package" (not
  counted yet), "Model and contract only" (the reach of `block-files` today) and "No registry".
- Reverse: `block-files` and `boundaries` go back to their own tables; no file is renamed back by that alone.

**4. A port's ending.**

- Question: eight `.store.ts` files and one `.gateway.ts` declare a `Context.Service` port, as the two `.port.ts`
  files do. Do the three endings become one?
- Answer: "One ending, .port.ts".
- Rationale: `block-files` reads the three as one kind already. Rejected: "Keep three kinds", each with what it must
  declare.
- Reverse: rename the nine files back and give the registry the two endings as kinds.

**5. Export keys.**

- Question: do a package's export keys take the file's path and kind?
- Answer: "Leave them".
- Rationale: the doors are checked by resolving an import through the package's `exports`, as the kind-registry
  experiment does. Rejected: "Path and kind in the key", which rewrites 150 keys and the 312 imports of them in the
  two contexts.
- Reverse: nothing to undo.
