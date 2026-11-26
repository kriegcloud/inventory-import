---
type: Index
title: Explorations
description: How an exploration packet is laid out, its stages, and the rule for graduating it into a goal.
---

# Explorations

An exploration is a question being shaped before anyone builds. Each lives in `explorations/<slug>/`:

- `README.md`: frontmatter `type: Exploration`, `title`, `description`, `status` (`active`, `parked`, `graduated` or
  `dropped`), `stage` (`capture`, `research`, `shape` or `graduated`), `next` and `goals: []`. The body names the next
  open question and keeps a Trail of dated one-liners.
- `CAPTURE.md` (optional): append-only, Benjamin's words verbatim.
- `research/NN-<topic>.md`: numbered reports.
- `DECISIONS.md`: open questions first; each answered one as Question, Answer, Rationale (the options rejected and the
  recommendation given) and Reverse.
- `BRIEF.md`: Problem, Appetite, Sketch, Rabbit holes, No-gos and a Map (goal slugs, the first slice, "later, when
  <gate>", each part citing existing code or marked NET-NEW).

## Packets

- [ideal-architecture](ideal-architecture/README.md): what inventory-import becomes as a model-first Turborepo of deep
  packages, shipped with Alchemy. Its goals are being built.
- [erp-ontology](erp-ontology/README.md): a vocabulary for an operations ERP that this repository's records point
  at. Graduated to the goal `erp-vocabulary`, whose thin thread is built; slice 1 is specified as the goal
  `party-slice` and not started, and the slices after it are not specified.
- [alchemy-domain](alchemy-domain/README.md): everything `@alchemy.run/domain` and what plugs into it offers, concept
  by concept, with how this app would use each. Research, seven rounds of trials, and a brief whose decisions 1 to 40
  he has answered but for 21a (9 fell away, 24 stands on an earlier answer); it awaits his word that it matches.

## Graduation

An exploration graduates when all four hold:

1. `BRIEF.md` has all five parts, the appetite included.
2. No open question blocks the first goal, and each deferred one is logged as deferred with its reason.
3. The Map names the goal, its first vertical slice, and cites existing code or NET-NEW for every part.
4. Benjamin says the brief matches, and that sentence is logged as a decision.

Then `goals/<slug>/SPEC.md` is seeded from the brief, the exploration is set to `graduated` with `goals: [<slug>]`,
and the goal links to the research and decisions rather than copying them.

`bun run docs:check` validates every file here as an Open Knowledge Format document.
