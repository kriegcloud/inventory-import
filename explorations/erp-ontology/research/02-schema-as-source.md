---
type: Research
title: Effect Schema as the source, and what beep-effect teaches
description: How beep-effect handles ontology and taxonomy, what a record schema can and cannot express, and a verdict on which hand-written file owns which kind of fact, with Turtle generated.
---

# Effect Schema as the source, and what beep-effect teaches

Benjamin asked: "If Effect Schema becomes the source of truth wouldn't that be easier and we could treat OWL, SKOS and
SHACL as a projection?" Short answer: yes for "TypeScript is the only source and Turtle is generated"; no for "the
record schemas are the ontology". The terms need a TypeScript home of their own, and the records point at it.

## What beep-effect does

It has two mechanisms that run in opposite directions, plus a workbench that edits Turtle documents.

| Mechanism | What it is | Path | Here |
| --- | --- | --- | --- |
| Vocabulary seeds | SKOS terms as Schema values (`VocabularySeed.make`); TTL and JSON-LD compared to them | beep-effect:packages/foundation/modeling/ontology/src/Vocabulary.models.ts:64-102 | take |
| Parity test | renders the TS seeds and requires the committed .ttl and .jsonld to be equal | beep-effect:packages/foundation/modeling/ontology/test/Vocabulary.test.ts:84-96 | adapt: a generator |
| Kind and role schemes | party kinds and legal roles in separate schemes, no shared edge | beep-effect:packages/foundation/modeling/ontology/src/seed/party-roles.ttl:1-152 | take the split |
| ConceptAlignment | an external match as its own row, admitted by a loader | beep-effect:packages/foundation/modeling/ontology/src/SemanticFoundation.models.ts:191-201 | take |
| Fold | each annotated schema becomes a class; its fields become properties | beep-effect:packages/foundation/modeling/ontology/src/Fold.assembly.ts:130-152 | leave the class rule |
| Projections | rdfs:Class plus owl:Object/DatatypeProperty; no owl:Class, restriction or xsd range | beep-effect:packages/foundation/modeling/ontology/src/Fold.projections.ts:140-149, 512-535 | adapt |
| libraryShapes | SHACL from the fold, in the CLI; every number becomes xsd:integer | beep-effect:packages/tooling/tool/cli/src/commands/Research/Library/Library.ontology.ts:228-243 | adapt, fix decimals |
| Workbench | Turtle on disk is the truth, edited as quad changes | beep-effect git b628348e:goals/ontology-workbench/SPEC.md:69-70 | leave |
| Curie<V> vocab | closed term lists per prefix; a bad CURIE fails tsc | packages/foundation/modeling/identity/src/Vocab.ts:446-482 (vendored) | take |

Benjamin already ruled on this in beep-effect: "Effect `S.Class` ... are the source; Turtle T-Box and SHACL shapes are
generated" (beep-effect:explorations/research-library-ontology/DECISIONS.md:72-88). That library describes its own
records only. It has no upper ontology, no external mapping and no class without a record. This ERP has all three.

The drift evidence cuts both ways. beep-effect:packages/foundation/modeling/ontology/src/seed/legal-intake.ttl:23 has a
`skos:closeMatch` that its TS seed lacks (`alignments: []`, beep-effect:.../src/SemanticFoundation.seed.ts:56-82), and
no test compares them. The seeds that have a byte-equality test stayed equal. Drift follows from a missing check, not
from which side is the source.

## What a record schema can express

| Construct | From a Schema alone | With an annotation | Not from a record schema |
| --- | --- | --- | --- |
| Field required, scalar or array (sh:minCount, sh:maxCount) | yes | | |
| sh:in, sh:pattern, sh:minLength | yes, from Literals and checks | | |
| Datatype range (xsd) | yes, from the AST leaf | | |
| rdfs:label, skos:definition | yes, from title and description | | |
| Class IRI | identifier only (one per record) | `term` | |
| Object property range on an id field | no (brands vanish at runtime) | `references` | |
| rdfs:subClassOf, owl:disjointWith | inside one TaggedUnion only | yes | |
| SKOS broader, altLabel, inScheme | no (Literals is flat) | yes, verbose | |
| Alignment to gist, IOF, ISA-95, Sutton | | yes | better outside any record |
| A term with no record (gist Commitment) | | | yes |
| One term with many records (Item) | | | yes: who owns it? |
| Lot genealogy, property chains | | | yes: a View or a query |
| Open world against closed world | | | yes |
| Rigidity as meaning (kind against role) | | tag only | yes |

The top four rows are the record's own facts, and generating them is right. Every row from "rdfs:subClassOf" down is a
fact about a term. Putting those in annotations on records turns OWL into object literals scattered across files.

## The two positions

Schema as source: records carry `$I.class` and `$I.key`, a ported fold generates OWL, SKOS and SHACL, and terms with
no record go in a side module.

```ts
export class Organization extends S.Opaque<Organization>()(S.Struct({
  isCustomer: S.Boolean.pipe(S.annotateKey({ description: "This organization buys from us." })),
})).annotate({ ...$I.class("Organization"), description: "A company we trade with." }) {}
export const axioms: ReadonlyArray<Triple> = [[Organization, "rdfs:subClassOf", "gist:Organization"]]
```

Turtle as source: hand-written Turtle holds the terms, a generator writes a TS module of term constants, and records
point at it.

```turtle
inv:Organization a owl:Class ; rdfs:subClassOf gist:Organization ; skos:closeMatch sutton:Account .
inv:isCustomer a owl:DatatypeProperty ; rdfs:domain inv:Organization ; rdfs:range xsd:boolean .
```

The first has the class-per-record problem: StoredItem, ItemFields and the import row each become a class. The second
puts term facts in a language with no type help, and the record's datatype is written twice (`xsd:boolean` and
`S.Boolean`).

## Verdict

One language, two kinds of hand-written file, and no fact with two homes. TypeScript is the only source; every Turtle
file is generated, committed with a GENERATED header and byte-compared in `bun run check`.

| Kind of fact | Home (hand-written) | Projected to |
| --- | --- | --- |
| A term exists: IRI, label, definition | vocabulary module (`Terms.vocab.ts`) | OWL, SKOS |
| subClassOf to gist, disjointWith, kind or role tag | vocabulary module | OWL |
| SKOS scheme: notations, broader, altLabel | vocabulary module | SKOS; the records' Literals |
| Alignments (gist, IOF, ISA-95, Sutton) | vocabulary module, as rows | SKOS mapping triples |
| Object property domain and range (classes) | vocabulary module | OWL |
| Which term a record or a field stands for | `term` annotation on the record, typed by Curie<V> | the check only |
| Required, cardinality, datatype, pattern, sh:in | the record schema | SHACL; OWL datatype ranges |
| Cross-record rules, reachability | Alchemy Decision or View, plus SPARQL CQ tests | none |
| Instance data | stored rows and events | A-Box, in tests |

```ts
// packages/kernel/src/ontology/Terms.vocab.ts: the only home of term facts
export const InventoryTerms = {
  classes: {
    Organization: { prefLabel: "Organization", definition: "A company or body we trade with.",
      subClassOf: ["gist:Organization"], closeMatch: ["sutton:Account"], kind: "kind" },
    Commitment: { prefLabel: "Commitment", definition: "A promise between parties.", subClassOf: ["gist:Commitment"] },
  },
  properties: { isCustomer: { domain: "inv:Organization", definition: "The organization buys from us." } },
  schemes: { ItemRole: { buy: { prefLabel: "Buy" }, make: { prefLabel: "Make" }, sell: { prefLabel: "Sell" } } },
} as const // decoded by a TermSeed Schema in a test; `as const` keeps notations as literal types

// a record points at terms and owns its own shape
export const ItemRole = S.Literals(notationsOf(InventoryTerms.schemes.ItemRole)).annotate({ term: "inv:ItemRole" })
isCustomer: S.Boolean.pipe(S.annotateKey({ term: "inv:isCustomer", description: "Buys from us." }))
```

The generator joins the two sides. A term with no record still gets emitted. Several records pointing at one term give
one class. A datatype property's range is read from the field that fills it, and the generator fails if two fields
fill it with different leaves. Checks:
- byte-compare and an N3 re-parse in `check`;
- a `laws ontology-terms` rule: every exported contract schema has a `term`, which is the eventual target (report 12 states the active kernel and contract coverage and the reasoned `noTerm` exception), and no owl:inverseOf or owl:sameAs;
- a slow test that runs the SHACL over the 155 stored rows of the messy sample plus must-fail fixtures.

Cost to reverse: low. The IRIs live in the vocabulary, so moving to Turtle as source later means turning the generated
Turtle into the hand-written file and generating the TS module from it instead.

## What was not checked

- Verified by opening the files: `Library.ontology.ts` maps every number to xsd:integer. `Fold.projections.ts` has no
  owl:Class, restriction or xsd constant. The research-library ruling. The legal-intake drift. The parity test. No fold
  is vendored here (only doc comments in packages/foundation/modeling/identity/src/Id.ts:1227, 1369). The text of 01 §1
  and §6.
- Method: six readers, two advocates (Schema as source, Turtle as source) and a judge, all read-only, 2026-11-22;
  beep-effect at commit 47f7696c.
- The Effect 4 AST claims (isOptional, check ids, brands lost at runtime) and the Alchemy annotation claims were taken
  from the readers, not opened.
- No generator was written or run. Whether `S.Literals` takes notations from an `as const` vocabulary without widening
  was not tried.
- Whether N3 and shacl-engine run in this repo's Vitest on Node was not tried.
