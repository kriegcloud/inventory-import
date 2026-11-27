---
type: Index
title: Goals
description: How a goal packet is laid out, its statuses, and where it comes from.
---

# Goals

A goal is work with a definition of done. Each lives in `goals/<slug>/`:

- `SPEC.md`: frontmatter `type: Goal`, `title`, `description`, `status` (`active`, `done` or `dropped`) and
  `from: explorations/<slug>`. The body is Objective, Non-goals, Constraints, Acceptance (checkboxes, each naming the
  command or screen that proves it) and Decisions (links into the exploration's `DECISIONS.md`). A goal may add
  sections of its own between them, each named for what it holds (`erp-vocabulary`'s "Forbidden conclusions",
  `party-slice`'s "Where the goal differs from the brief and the reports" and "Open, Benjamin's").
- `PLAN.md`: the steps with their status, the current blocker, the choices made along the way, and a closing note
  (what changed, what was learned) when the goal is done; a plan may add sections of its own too (both goals' "What
  the design left unchecked").

A goal is created only when its exploration graduates (see [explorations](../explorations/README.md)). It links to
the exploration's research and decisions and never copies them. `rg '^status:' goals` lists where every goal stands;
git history is the archive.

## Running a goal with `/goal`

A goal run with Claude Code's `/goal` ends its condition with a hand-off clause:

```text
/goal follow the instructions in goals/<slug>/, or stop when the only work left is a step the plan names as Benjamin's
```

The `/goal` judge checks the condition at the end of every turn and cannot tell on its own that a step is Benjamin's
(a deploy, a secret, a repository setting, a product decision). Without the clause it keeps blocking the turn until
Claude Code's cap of nine ends it ("A hook blocked the turn from ending 9 consecutive times"). The `ci-speed` run did
this on step 9 while it waited on the cache variable and the GitHub stack's deploy. So a plan names every step that is
Benjamin's as his, and when only those are left the agent says which step, what it unblocks, and stops.

`bun run docs:check` validates every file here as an Open Knowledge Format document.
