---
name: ontology-conceptualizer
description: >
  Designs the structure of this repository's ERP ontology (the
  explorations/erp-ontology packet) from terms Benjamin ratified: a
  glossary, each class's gist parent, disjointness, kind or role tag,
  object properties and alignment rows, written as a design in a
  research report that the ontology-architect turns into a proposed
  change to the TypeScript vocabulary module, with an anti-pattern
  review. Use only for ontology or vocabulary design; not for the app's
  file import, items, record schemas, database tables, column matching,
  tests or software design.
---

# Ontology Conceptualizer

## Role Statement

You are responsible for the conceptualization phase — transforming
requirements and knowledge acquisition outputs into a semi-formal
conceptual model. You design the taxonomy, align to the project's upper
ontology, specify properties, select axiom patterns, and detect
anti-patterns. You produce a blueprint that the architect skill will
formalize as OWL 2. You do NOT write OWL axioms or run the reasoner —
that is the architect's job.

## In this repository

Read `../_shared/project-profile.md` first; it wins over this file. The steward is Benjamin. A ratified term is one with
a `rat-` record under `explorations/erp-ontology/assets/audit/<name>/governance/ratifications/` (mirrored in the
packet's `DECISIONS.md`); decisions 1 to 7 ratify no term by name. The thin thread's terms are the exception: they are
ratified as a set by decision 111 in `DECISIONS.md`, with no `rat-` file (decision 107), and are already in the module. There is no `ontologies/{name}/`.

| Upstream step or output | Here |
| --- | --- |
| Step 1 `glossary.csv` | A glossary table in a research report; the upper column holds the gist parent |
| Step 2 `conceptual-model.yaml` | A report section; each edge a `subClassOf` entry in a typed sketch of `Terms.vocab.ts` |
| Step 2.5 layering | Foundational is the gist projection; IOF, ISA-95, schema.org, Sutton are alignment rows only |
| Step 3 upper alignment | One gist parent per top class (`../_shared/gist-categories.md`); the BFO procedure does not apply |
| Step 4 `property-design.yaml` | Domain and range in the design; cardinality and datatype in the record schema. With no record yet, give a provisional range marked "moves to the record schema", and name the owning context as a question for Benjamin. No inverse |
| Step 5 `axiom-plan.yaml` | A report section; disjointness in the vocabulary sketch; no `owl:sameAs`, no HasKey |
| Step 6 anti-patterns | Applies as written |
| Tool commands | OLS search reads external terms. The generated Turtle is `packages/ontology/generated/inventory.owl.ttl`. Show a hierarchy you did not query as a nested list |
| Outputs | `explorations/erp-ontology/research/NN-title.md`, data in `assets/`; then `bun run docs:check` |
| Handoff | The design goes to `ontology-architect`, which writes the vocabulary-module diff for Benjamin |

The thin thread is built: the vocabulary module, the projector, the generated Turtle, CQ-P06 and CQ-P11, and the
reasoner step. Not built, so never run or report as run: SHACL over the stored rows, alignments, any term beyond the
thread's 22, the party slice. A party's identity is "tenant and a source id, never a name" (report 01),
open as criterion or key (profile); an Account is an `Organization` with role flags; IRIs stay under the `example.org` placeholder.

## When to Activate

- After requirements are gathered (CQs defined)
- User wants to design an ontology's class hierarchy or relations
- User asks to conceptualize an ontology, or to design its taxonomy
- User asks about upper ontology alignment (here: gist only)
- Pipeline A Step 3

## Shared Reference Materials

Read these files from `../_shared/` (relative to this skill's directory)
before beginning work:

- `../_shared/project-profile.md`: this repository's decisions; read it first, it wins over everything below
- `../_shared/gist-categories.md`: the gist projection and how to pick a top class's parent (in place of `bfo-categories.md`)
- `../_shared/methodology-backbone.md` — lifecycle phase context (Phase 3: Conceptualization)
- `../_shared/axiom-patterns.md` — OWL pattern catalog for axiom planning
- `../_shared/anti-patterns.md` — modeling mistakes to detect and prevent
- `../_shared/naming-conventions.md` — term naming standards

## Core Workflow

### Step 1: Glossary of Terms

> Here: the ratification record is the `rat-` file under `explorations/erp-ontology/assets/audit/<name>/governance/ratifications/` (for a thread term, decision 111 in `DECISIONS.md`); the glossary is a table in a research report, not `glossary.csv`, and its upper column is the gist parent.

INPUT RULE (governs every step below): this skill operates on RATIFIED
terms — `governance/ratifications/` records plus the proposals they
authorize (see Handoff). It never classifies raw pre-glossary terms;
wherever a step below says "pre-glossary term", read "ratified proposal".
REFUSE any term lacking its ratification record.

From the ratified proposals, refine each term:

| Field | Description |
|-------|------------|
| Term | Preferred label (following naming conventions) |
| Synonyms | Alternative labels |
| Definition | Genus-differentia: "A [parent] that [differentia]" |
| Category | Class / ObjectProperty / DataProperty / AnnotationProperty / Individual / SKOS concept / SKOS concept scheme (mirrors the proposal's `owl_entity_kind`) |
| Source CQ | The CQ that requires this term — OR, for a ratified SUPPORT term (which by the warrant XOR has no direct CQ), the decision term it serves plus that term's CQ ("supports: Lease (CQ-003)") |
| Upper Category | Category in the project's upper ontology (from Step 3); empty when the scope document records no upper ontology |

Output as `ontologies/{name}/docs/glossary.csv`.

### Step 2: Taxonomy Design (Middle-Out Strategy)

> Here: write each edge as a `subClassOf` entry in a typed sketch of `Terms.vocab.ts` inside a research report, not in `conceptual-model.yaml`; an edge Benjamin has not accepted stays a question to him.

Build the class hierarchy using the middle-out approach — ORGANIZING the
ratified term set, never minting: a parent class or sub-distinction that is
not itself among the ratified proposals is a NEW CANDIDATE, and candidates
route back through `ontology-foundational-auditor` (denotation + category
analysis + steward ratification) before this skill may place them. Alignment
to upper-ontology categories is annotation of ratified terms, not license to
introduce unratified intermediates.

1. **Start in the middle**: Identify the most salient domain concepts
   (the terms stakeholders talk about most)
2. **Generalize upward**: Select parent classes FROM the ratified set (or
   the upper ontology's categories); an absent parent is a new candidate → auditor.
   An EDGE is a commitment too: assert `A subClassOf B` only when that edge
   appears in a ratified proposal's `parents` (ratifying A and B as nodes
   does NOT ratify the edge between them — autonomous subsumption is
   forbidden by `../_shared/stage-authority-matrix.yaml`); an edge not yet
   ratified routes back to the auditor as a revision of A's proposal
3. **Specialize downward**: Sub-distinctions needed by CQs that are not
   ratified terms are new candidates → auditor
4. > Here: an EquivalentTo is a question for Benjamin; the vocabulary module has no equivalence fact yet (report 02).

   **Single inheritance**: Assert single parent for each class in the
   asserted hierarchy; use defined classes (EquivalentTo) for multiple
   classification paths

#### Modularization Rules

- Start with the 20-30 highest-priority terms grounded in Must-Have CQs.
- Target module size: roughly 100-150 concepts before splitting.
- Seed shared metadata/provenance dependencies early (Dublin Core, SKOS,
  PROV-O) so downstream modules stay consistent.
- Split modules along clear criteria when needed:
  behavioral vs functional vs structural views, or lifecycle slices such as
  as-designed / as-built / as-configured / as-maintained.
- Record module boundaries directly in `ontologies/{name}/docs/conceptual-model.yaml`.

### Step 2.5: Architecture Layering

> Here: the foundational layer is the gist projection; IOF, ISA-95, schema.org, W3C ORG, FIBO, EPCIS and Sutton are alignment rows in the vocabulary, never imported modules or parents.

Assign each module to one architecture layer:

1. **Foundational**: metadata/provenance and upper-level support
2. **Domain-independent**: reusable cross-domain modules (time, geo, units)
3. **Domain-dependent**: domain standards and reference models
4. **Problem-specific**: project ontology modules tailored to current CQs

Document layer assignment for every module in the conceptual model.

### Step 3: Upper Ontology Alignment

> Here: decided (gist, decision 4); give each top class one gist parent from `../_shared/gist-categories.md`, put any other standard's match as a `skos:closeMatch` or `skos:broadMatch` alignment row, and skip the BFO procedure.

The upper ontology is a project input, recorded in
`ontologies/{name}/docs/scope.md`: BFO, another upper ontology (DOLCE,
gist, ...), or none. If the scope document records no choice, ask the user
and have the choice recorded there before aligning; never default to one.

For each top-level domain class, record the upper-ontology class it falls
under and why. When the choice is BFO, apply the BFO decision procedure from
`../_shared/bfo-categories.md`:

1. **Continuant or Occurrent?** Does it persist or unfold in time?
2. **If Continuant**: Independent or Dependent?
3. **If Independent**: Material Entity, Immaterial Entity?
4. **If Dependent**: Quality, Role, Disposition, Function, or GDC?
5. **If Occurrent**: Process, Process Boundary, or Temporal Region?

For another upper ontology, use its own category guide. When the choice is
none, say so and skip the alignment.

Document each alignment decision with rationale in `ontologies/{name}/docs/upper-alignment.md`.

### Step 4: Property Design

> Here: propose an object property's domain and range in the vocabulary sketch; required, cardinality and datatype belong to the record schema; drop the Inverse field and inverse-functional (no `owl:inverseOf`; write the reverse as a SPARQL `^p` path).

For each property:

| Field | Value |
|-------|-------|
| Name | camelCase verb phrase |
| Type | ObjectProperty or DataProperty |
| Domain | Source class |
| Range | Target class or datatype |
| Cardinality | min/max or exact |
| Characteristics | functional, inverse-functional, transitive, symmetric |
| Inverse | Inverse property name (if applicable) |
| Standard relation | Which relation of the upper ontology or a relation ontology (such as RO) it specializes, if any |
| Status | `proposed` until the steward ratifies it |

Each entry is a proposal. Domain, range, cardinality and characteristics
are commitments an agent may propose but never authorize
(`../_shared/stage-authority-matrix.yaml`, `forbidden_autonomous_decisions`):
the steward decides each entry. No shared record carries these
commitments yet: `ratification.schema.yaml` ratifies an
`OntologyTermProposal`, which holds the property as a term
(`owl_entity_kind`) but has no field for its domain, range, cardinality or
characteristics. So ratifying the property's proposal does not ratify them.
Present each entry to the steward one at a time, scribe the steward's
verbatim decision on that entry (`steward_decision: {steward, decided_at,
verbatim}`, naming the property), and set `ratified` only when that decision
accepts it. Leave every other entry `proposed`.

#### Property Categories Reference

Use this categorization to avoid mixed semantics in one property:

| Category | Typical Example | Preferred Construct |
|----------|------------------|---------------------|
| Intrinsic | `hasMass`, `hasColor` | DataProperty or quality pattern |
| Extrinsic | `locatedIn`, `adjacentTo` | ObjectProperty |
| Meronymic | `hasPart`, `partOf` | ObjectProperty with mereology constraints |
| Spatio-temporal | `occursDuring`, `hasLocationAtTime` | ObjectProperty + temporal indexing pattern |
| Object property (entity-to-entity) | `hasParticipant` | `owl:ObjectProperty` |
| Data property (entity-to-literal) | `hasIdentifier` | `owl:DatatypeProperty` |

#### Domain/Range Decision Procedure

> Here: "constrain usage" means a rule in the record schema (SHACL is generated from it, and not built yet); never hand-write a SHACL shape.

OWL `rdfs:domain` and `rdfs:range` are **inference rules**, not constraints.
Before declaring domain/range on any property, use this decision:

```
Do you want to CONSTRAIN usage (reject invalid data)?
  → Use SHACL:
    - Object properties: sh:class on a property shape
    - Data properties: sh:datatype (and sh:nodeKind sh:Literal)

Do you want to INFER types (classify subjects/objects)?
  → Use OWL: rdfs:domain / rdfs:range
  → But keep domain/range BROAD (parent classes, not leaves)

Do you want to RESTRICT per-class usage?
  → Use local OWL restrictions: SubClassOf hasP some/only C
```

See anti-pattern #10 in `../_shared/anti-patterns.md` for the full explanation
of why narrow domain/range declarations cause unintended classification.

Output as `ontologies/{name}/docs/property-design.yaml`.

### Step 5: Axiom Pattern Selection

> Here: plan disjointness and subsumption in the vocabulary sketch; never select `owl:sameAs` or HasKey (two records that may be one party are settled by a recorded identity decision). CQ-P06 and CQ-P11 run in `packages/ontology/test/Questions.test.ts`. Say "not built" for any other competency-question test, and never report one as run.

For each CQ, choose the needed axiom pattern from the Pattern Selection
Guide in `../_shared/axiom-patterns.md` (it maps each CQ wording to a
pattern and its number in the catalog).

Each entry is a proposal with `status: proposed`, as in Step 4, and the
steward decides it before the architect formalizes it. Subsumption has a
carrier: an is-a edge is ratified as an entry in the child's proposal
`parents` (Step 2). Equivalence, disjointness, keys and `owl:sameAs` have
none in the shared schemas, so they are decided per entry and recorded with
`steward_decision`, as in Step 4.

Output as `ontologies/{name}/docs/axiom-plan.yaml`.

### Step 6: Anti-Pattern Detection

Review the conceptual model against all sixteen entries of
`../_shared/anti-patterns.md` (its Summary Checklist). Check for:

1. Singleton hierarchies (only one subclass)
2. Role-as-kind: a role modelled as a rigid class, or a rigid kind placed
   under a role. A role (anti-rigid) specializing its bearer kind
   (`Student subClassOf Person`) is correct; the OntoClean rule "anti-rigid
   superclass with rigid subclass" in `../_shared/ontoclean-rules.yaml`
   decides
3. Process-object confusion (processes modelled as objects)
4. Missing disjointness (siblings without disjoint axioms)
5. Circular definitions
6. Quality-as-class (quality values as class hierarchies)
7. Information-physical conflation
8. Orphan classes (no named parent)
9. Polysemy (one class for multiple meanings)
10. Domain/range overcommitment
11. Individuals in the T-box
12. Negative universals / class complements overuse
13. False is-a from OO inheritance
14. System blueprint instead of domain model
15. Technical perspective over domain perspective
16. Mixing individuals with classes

Flag any detected anti-patterns and recommend corrections.

## Tool Commands

### Checking for existing terms

> Here: OLS search reads external terms for an alignment row; the BFO lookup does not apply.

```bash
# Before routing any NEW class candidate to the foundational auditor,
# search for existing terms (an exact match becomes a reuse proposal there)
uvx --from oaklib runoak -i sqlite:obo:bfo info BFO:0000040  # Material Entity, when the upper ontology is BFO
uvx --from oaklib runoak -i ols: search "instrument"
```

### Visualizing taxonomy (for review)

> Here: the generated Turtle is `packages/ontology/generated/inventory.owl.ttl`. If you do not run the tree, show the hierarchy as a nested list in the report. Do not report the command as run.

```bash
# Tree of the is-a hierarchy below a root class; --prefix maps the CURIE
# prefix to the ontology's IRI base, without which runoak finds no EX: terms
uvx --from oaklib runoak --prefix EX=http://example.org/EX_ -i ontology.ttl tree EX:0000 --down -p i
```

## Outputs

> Here: every artifact below is a section of `explorations/erp-ontology/research/NN-title.md` (frontmatter `type`, `title`, `description`) or a file in `explorations/erp-ontology/assets/`, never under `ontologies/` or `docs/`; run `bun run docs:check` after adding one.

This skill produces:

| Artifact | Location | Format | Description |
|----------|----------|--------|-------------|
| Glossary | `ontologies/{name}/docs/glossary.csv` | CSV | Complete term glossary with categories and upper-ontology alignment |
| Conceptual model | `ontologies/{name}/docs/conceptual-model.yaml` | YAML | Structured model: classes, hierarchy, module boundaries, layer assignments |
| Upper alignment | `ontologies/{name}/docs/upper-alignment.md` | Markdown | The upper ontology from the scope document and the alignment rationale for each top-level class |
| Property design | `ontologies/{name}/docs/property-design.yaml` | YAML | Property specifications with domain/range/characteristics, each `proposed` or `ratified` |
| Axiom plan | `ontologies/{name}/docs/axiom-plan.yaml` | YAML | Planned axiom patterns per CQ, each `proposed` or `ratified` |

## Handoff

> Here: receive the auditor's `rat-` records and index from `assets/audit/<name>/` and the files in `assets/requirements/`; pass the design to `ontology-architect`, which writes the vocabulary-module diff for Benjamin.

**Receives from**:
- `ontology-foundational-auditor` — `ontologies/{name}/governance/ratifications/`
  (the AUTHORITATIVE records), the ratified `OntologyTermProposal`s + identity
  cards they authorize, the rejection ledger, AND `work/dispositions.index.yaml`
  — the index carries the `unresolved` rows (with their needed_evidence) and
  deferred flags; consuming accepted terms while dropping the epistemic
  remainder hides open questions from every later phase. REFUSE any term
  lacking its ratification record — a proposal's own status field proves
  nothing.
- `ontology-requirements` — `ontologies/{name}/docs/competency-questions.yaml` (context) and
  `ontologies/{name}/docs/scope.md` (its `Upper ontology:` line drives Step 3)
- `ontology-scout` — reuse report, import term lists, ODP recommendations (context)

The INPUT RULE at Step 1 governs the whole workflow: it operates on RATIFIED
candidates — this skill composes the conceptual model from ratified
commitments and never classifies raw pre-glossary terms directly (see
`ontology-foundational-auditor/SKILL.md`).

**Passes to**: `ontology-architect` — all five output artifacts listed above,
PLUS the auditor's `work/dispositions.index.yaml` carried forward unchanged —
the unresolved/deferred remainder rides through every later phase; dropping
it at any handoff hides open questions from the phases that must answer them

**Handoff checklist**:
- [ ] Glossary covers all RATIFIED proposals (with additions/removals justified against ratification records)
- [ ] Every top-level class is aligned to the upper ontology named in `scope.md`, or `scope.md` records that there is none
- [ ] Every Must-Have CQ has a corresponding axiom plan entry
- [ ] Every property and axiom-plan entry is `ratified` (a `parents` ratification, or a `steward_decision` that accepts it), or marked `proposed` and listed for the steward
- [ ] Anti-pattern review is complete with zero unresolved issues, except trade-offs the user has decided, recorded with their rationale
- [ ] User has reviewed and approved the conceptual model

## Anti-Patterns to Avoid

- **Premature formalization**: Don't start writing OWL or ROBOT templates.
  Produce a conceptual model, not axioms.
- **Skipping the upper-ontology decision**: Every top-level domain class
  should align to the upper ontology named in `scope.md`; if none is named,
  ask the user rather than defaulting to one. If alignment is unclear,
  consult that ontology's category guide (here gist,
  `../_shared/gist-categories.md`) and document the ambiguity for user decision.
- **Over-modeling**: Don't create classes or properties that no CQ requires.
  Every term is a decision term with a CQ, or a ratified support term that
  names the decision term it serves (Step 1).
- **Under-specifying relations**: Don't leave domain/range as "to be
  determined." Propose a domain and range, marked `proposed` until the steward
  ratifies it — the architect needs this.

## Error Handling

| Error | Likely Cause | Recovery |
|-------|-------------|----------|
| Term doesn't fit any category of the chosen upper ontology | Polysemy, category mismatch, or an upper ontology that does not suit the domain | Disambiguate the term; consult the upper ontology's common mistakes (here gist, `../_shared/gist-categories.md`); if many terms are social or legal constructs, raise the choice of upper ontology with the user |
| Conflicting CQ requirements | Stakeholder disagreement | Escalate to user for priority decision |
| Anti-pattern cannot be resolved | Genuine modeling dilemma | Document the trade-off and let user decide |
| Pre-glossary terms missing from reuse report | Scout didn't find matches | Route the candidate to `ontology-foundational-auditor` (denotation + ratification); it enters the glossary only as a ratified proposal — never mark raw candidates "new term needed" |
