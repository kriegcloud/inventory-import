---
type: Decisions
title: Decisions
description: Module taxonomy decisions. The open questions, one decision each, with the option recommended and what it was tried on, and the answered ones with the options he rejected and how to reverse them.
---

# Decisions

Open questions are listed first. Each is put to Benjamin with its options, the recommended one first; nothing below
is decided until he answers, and no recommendation here is his. Answered decisions move under "Answered" with the
date, the answer and how to reverse it.

## Open

| # | Question | Recommended | Changes | Where it is argued |
| --- | --- | --- | --- | --- |
| 2 | Is a block's exported name its tag, and its file's stem that name, as a law? | Yes; a decision's file takes its command's stem and the class keeps its own name | | [README](README.md), "Uniform names would cost the model its words" |
| 6 | What ending do the four files with none take? (`Host.ts` in both hosts, `Adapters.ts` and `Config.ts` in access's) | Asked when its part of the brief opens | | [BRIEF](BRIEF.md), Map |
| 7 | Is each of the three endings used once a kind, or is its file renamed? (`.reference`, `.state`, `.route`) | Asked when its part of the brief opens | | [BRIEF](BRIEF.md), Map |

Decisions 1, 3, 4 and 5 were answered on 2026-11-27 and are under "Answered". 2, 6 and 7 were not put to him; none
blocks the brief's first slice.

### 2. Name, tag and stem

- **A law (recommended).** `laws block-files` reads each block's tag already; it would also compare it with the
  exported name and the file's stem.
- **A convention.** Written in `docs/building.md`, held by review.

## Answered

### 2026-11-27: decisions 1, 3, 4 and 5

Asked by dialog, each with its options, the recommended one first. He picked the recommended option of each.

**1. Where a command of the model lives.**

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
