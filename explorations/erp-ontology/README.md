---
type: Exploration
title: ERP ontology
description: A taxonomy and ontology for an operations ERP and WMS such as Sutton, built from published ontologies and what is public about Sutton, and tied to this repository's domain model.
status: active
stage: research
next: design the first vocabulary module (the party model's terms), settling the questions the skills' profile lists as open
goals: []
---

# ERP ontology

The question: what are the things an operations ERP and WMS like Sutton deals in, how do they relate, and how does
this repository's domain model point at them?

| Report | Headline |
| --- | --- |
| [01 A starting model](research/01-starting-model.md) | A small gist core, a party model neither seed has, the seeds' stock and commitment distinctions kept whole, and every domain class carrying the IRI of its term. |
| [02 Schema as the source](research/02-schema-as-source.md) | TypeScript is the only hand-written source and Turtle is generated, but the terms live in one vocabulary module that records point at, not in the record schemas. |
| [03 The ontology skills reviewed](research/03-skills-review.md) | 121 checked findings in beep-effect's ontology skills: commands that fail or run backwards, a shared folder never copied here, and a BFO and hand-edited-Turtle design that this packet's decisions replace. |

Inputs kept outside the repository: the two seed reports of 2026-11-22, and Benjamin's earlier private notes (a
first class list, a decision log and a product model read from public sources).

## Trail

- 2026-11-22: packet opened from Benjamin's request ([CAPTURE.md](CAPTURE.md)); first model written; four opening
  questions put to Benjamin ([DECISIONS.md](DECISIONS.md)).
- 2026-11-22: answers 1, 3 and 4 recorded (3 against the recommendation: Account is an Organization with role
  flags); beep-effect read and question 2 argued both ways ([02](research/02-schema-as-source.md)).
- 2026-11-22: questions 2 and 5 to 7 answered: a TypeScript vocabulary module is the source, a local projector
  writes the Turtle, a reasoner runs from the start, the namespace stays `example.org` for now.
- 2026-11-22: beep-effect's ontology skills reviewed before use ([03](research/03-skills-review.md)); nothing
  edited yet.
- 2026-11-22: the skills' defects fixed upstream in a beep-effect worktree (branch `fix/ontology-skills-review`,
  uncommitted); the adaptation for this repository not started.
- 2026-11-22: upstream fixes opened as beep-effect pull request 3480; the fixed skills and `_shared` copied here
  and adapted (`.agents/skills/_shared/project-profile.md` holds this packet's decisions for them).
