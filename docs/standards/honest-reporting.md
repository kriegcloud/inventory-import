---
type: Standard
title: Say only what was checked
description: Claims name their check, decisions name who made them, and trust fields are honest.
tags: [evidence]
status: stable
---

- **Say only what was checked.** Every "works" names its evidence (a test, a command and its result, a
  screenshot); the rest goes under "Not verified". Check: each line under "Works, and I checked it" in
  the write-up names its evidence.
- **A view that runs is not a view that is right**: compare counts and totals on screen with a query or a count
  from the file. Check: the report names which.
- **Nothing the person sees is faked.** A recorded model run is labelled as recorded, and test doubles live only in
  tests. Check: no stand-in data or fake response in `src/`, and every recorded run on screen carries its label.
- **A look on data changed by hand is not seen.** Stored data is never edited to make a screen show a case; a case
  that needs data is shown from a real import on a fresh copy. Check: each "seen" in the write-up rests on a real
  import, or says the row was edited or seeded by hand.
- **Credit each decision to whoever made it**, in the first person and with no minute: "I chose; the agent
  recommended the same", "I chose against the recommendation" or "Mine, in my words: "…"", never just "mine"; one I
  did not answer is "not decided", and one the agent made without asking is "agent, not asked". Check: no empty "Who
  decided" cell in the write-up, none that says only "mine", and no minute stamp.
- **Trust fields in `docs/` are honest**: `generated.by` names the writer, an unreviewed file is `status: draft`,
  and only the person who reviewed a file adds `verified`. Check: `bun run docs:check`.
