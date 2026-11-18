---
name: next
description: When the current plan is finished, check the clock and propose what to do with the time left. Use whenever you are about to say the work is done and the hour is not over.
---

# Next: finishing early is not finishing

1. Run `bun run clock`. Say the minute and how many are left before the build stops.
2. Reread the brief in `brief/` and the "What I cut, and why" table in `DECISIONS.md`.
3. Propose at most four next steps, ranked by what they give the person importing the file. For each: what the
   person gets, what it gives up, the checkpoint it must be in by, and the risk to what already works; no minute
   counts. Include at least one that is about trust rather than features (a value changed without asking, a row with
   no reason, a total that is not shown, a path nobody has looked at in a browser).
4. Before you ask, start in the background what no choice here blocks: a `qa` pass on a path nobody has looked at,
   or the trust item when it changes no rule. Then ask through `AskUserQuestion` (`CLAUDE.md` "Decisions by
   dialog"; started by a lead, as one message to it): the steps as options of one `multiSelect` "which go in", yours
   first with the reason.

Do not start the write-up, and do not summarise the work as complete, until Benjamin says the building is over.
