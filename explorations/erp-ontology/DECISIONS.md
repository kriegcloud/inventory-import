---
type: Decisions
title: ERP ontology decisions
description: Open questions on the ERP ontology in the order they block work, and the answered ones with how to reverse them.
---

# Decisions

## Open

None. Next to shape: the first vocabulary module, starting with the party model.

## Answered

### 2. Which artifact is the source of truth (2026-11-22)

I chose one TypeScript vocabulary module that owns every term fact, with record schemas carrying a typed pointer to a
term plus their own rules, and all Turtle generated; the agent recommended the same. It began as my question back:
"If Effect Schema becomes the source of truth wouldn't that be easier and we could treat OWL, SKOS and SHACL as a
projection?" The agent's first recommendation (hand-written Turtle) was withdrawn after report 02.

- Rationale: one language, and no fact with two hand-written homes. The record schemas are not the terms because one
  term has several records (Item) and some terms have none (gist Commitment).
- Reverse: the generated Turtle becomes the hand-written file and the TypeScript term module is generated from it.
  The IRIs do not change.

### 5. How the Turtle is produced (2026-11-22)

I chose a small local projector over the vocabulary and the Schema AST; the agent recommended the same.

- Rationale: beep-effect's fold makes a class of each schema and maps every number to xsd:integer.
- Reverse: vendor `@beep/ontology` and delete the projector; the generated files are compared byte for byte, so any
  difference shows at once.

### 6. Which checks run (2026-11-22)

I chose against the recommendation: an OWL reasoner runs in `check:full` from the start, beside the byte-compare and
re-parse in `check` and SHACL over the stored messy sample as a slow test. The agent recommended adding the reasoner
later.

- Rationale: an inconsistent hierarchy is caught on the day it is written.
- Reverse: remove the reasoner step from `check:full`; nothing else depends on it.
- Owed: which reasoner runs here is not chosen or tried.

### 7. Which namespace (2026-11-22)

I chose against the recommendation: the `example.org` placeholder stays until something is published. The agent
recommended a project-owned permanent path now.

- Rationale: nothing to register before the vocabulary has settled.
- Reverse: the namespace is written once, in the vocabulary module; changing it regenerates every Turtle file.
  Anything outside the repository that has stored an IRI by then must be rewritten.

### 1. What the ontology is for first (2026-11-22)

I chose the model of record for this repository's contexts, with Sutton as a mapping; the agent recommended the same.
I added a condition: look at how beep-effect handles ontology and taxonomy and see if it is the right shape.

- Rationale: the repository is moving to a domain-aligned architecture, and its classes need terms to point at. A
  description of Sutton alone would have nothing here to check it.
- Reverse: the terms carry no dependency on this repository's tables, so the same vocabulary can be republished as a
  Sutton description by writing the mapping first. Nothing is lost.
- Still owed: the look at beep-effect (report 02).

### 3. What a Sutton Account is (2026-11-22)

I chose against the recommendation: an Account is an Organization with role flags (customer, vendor). The agent
recommended a trading relationship between two parties that holds the roles.

- Rationale: it is how Sutton presents it ("Accounts represent customers and vendors"), and it is one record to
  import, match and review.
- What it gives up: a role has no start and end date of its own; terms, price lists and portal access sit on the
  organization, not on the relationship; a person cannot be an Account.
- Reverse: a flag set to true becomes one role record with an unknown start date. The move is one way without loss;
  going back from roles to flags drops the dates.

### 4. Which upper ontology (2026-11-22)

I chose a small gist projection, with IOF and ISA-95 as alignments only; the agent recommended the same.

- Rationale: everyday enterprise words in OWL 2 DL, small enough to read whole.
- Reverse: the projection is a list of imported terms. Swapping the upper ontology means re-parenting our top classes
  (about a dozen), not renaming anything below them.
