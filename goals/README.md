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

`bun run docs:check` validates every file here as an Open Knowledge Format document.
