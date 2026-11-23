---
name: sparql-expert
description: >
  Writes and syntax-checks SPARQL 1.1 queries over RDF files: here, external
  ontology files (gist, IOF) read with rdflib, and competency-question queries
  drafted in an ERP-ontology research report. Use when someone asks for SPARQL
  or wants to query a .ttl, .owl or other RDF file. Not for the app's SQL or D1
  queries, the Items search, the table assistant, API queries or tests.
---

# SPARQL Expert

## Role Statement

You are responsible for generating, validating, and executing SPARQL
queries across different backends. You write correct PREFIX declarations,
check syntax before execution, note where RDF-star support differs between
stores, and optimize query performance. You serve all other skills
that need SPARQL queries — CQ test generation, anti-pattern detection,
coverage metrics, and ad hoc data exploration.

## In this repository

Read `../_shared/project-profile.md` first; it wins over this file. The ontology work lives in
`explorations/erp-ontology/`. The thin thread is built (`goals/erp-vocabulary`). Query the generated Turtle:
`packages/ontology/generated/inventory.owl.ttl`, `inventory.skos.ttl` and `generated/fixtures/CQ-P06.graph.ttl`.
CQ-P06 and CQ-P11 run in `packages/ontology/test/Questions.test.ts` (Oxigraph), over a hand-written two-organization
fixture and the lift of two member rows, not over the stored rows of the messy sample. SHACL, alignments and any term
beyond the thread's 22 are not built. For those, say "not built"; never report a query as run against them.

| Upstream step or output | Here |
| --- | --- |
| Step 1 target: endpoint or local file | An external ontology file (gist, IOF, a published vocabulary), or the generated Turtle above. No endpoint, no triple store |
| Step 2 schema lookup | Take `gist:`, `inv:` (example only), `iof-core:` and the alignment prefixes from `namespaces.json`. Our terms are `packages/kernel/src/Terms.vocab.ts` (7 classes, 9 properties, 2 schemes, 4 concepts). gist labels are `skos:prefLabel` (no `rdfs:label`): a query over gist reads that |
| Step 4 syntax check | Runs as written, with `uv run --no-project --with rdflib` (checked 2026-11-22) |
| Step 5 ROBOT query | Does not apply to a skill: ROBOT is not on the PATH, and a skill does not download it. The reasoner script fetches its own jar. Use the rdflib form |
| Step 5 over our ontology | Query the generated Turtle above with rdflib. SHACL is not built |
| A CQ query for `ontology-requirements` | CQ-P06 and CQ-P11 are the files in `packages/ontology/fixtures/cq/`, run by Oxigraph in `Questions.test.ts`. A new question is text in a research report until it is a test. N3.js re-parses Turtle (decision 26). shacl-engine is not built |
| `sparql/{name}.sparql`, results | A fenced block in `explorations/erp-ontology/research/NN-title.md`, or a file under `explorations/erp-ontology/assets/` |
| RDF-star, federated queries | Do not apply |

A rdflib result is over asserted triples. The reasoner step checks the OWL 2 DL profile and consistency; it does not add inferred triples to these queries. CQ-P06 needs only asserted types. Say which.

## When to Activate

- User mentions "SPARQL", "RDF", "triple store", or an RDF knowledge graph
- User wants to extract data from an ontology or triple store
- User wants to debug or optimize a SPARQL query
- Another skill needs a SPARQL query generated or executed

> Here: never for a database query, a search box or a "query" in the app's API; those are SQL and Effect, not SPARQL.

## Shared Reference Materials

Read these files from `../_shared/` (relative to this skill's directory)
before beginning work:

- `../_shared/project-profile.md`: this repository's decisions; read first
- `../_shared/gist-categories.md`: the gist classes a query may name
- `../_shared/namespaces.json` — canonical prefix-to-IRI map (always include
  correct PREFIX declarations)
- `../_shared/methodology-backbone.md` — lifecycle context (cross-cutting)

## Core Workflow

### Step 1: Analyze Intent

> Here: the target is always a local file; there is no endpoint. This repository's Turtle is `packages/ontology/generated/inventory.owl.ttl`, `inventory.skos.ttl` and `generated/fixtures/CQ-P06.graph.ttl`.

Determine:
- **Query type**: SELECT, CONSTRUCT, ASK, DESCRIBE
- **Target**: Local file (ROBOT/rdflib) or SPARQL endpoint
- **Purpose**: Exploration, testing, reporting, or data extraction
- **Constraints**: Result size limits, performance requirements

### Step 2: Schema Lookup

> Here: take `gist:`, `inv:` (an `example.org` placeholder) and `iof-core:` from `namespaces.json`; never add a prefix by hand, never a real domain.

Before writing the query:
1. Read `../_shared/namespaces.json` for correct prefixes
2. If targeting an endpoint, check available named graphs
3. If querying a specific ontology, check its class/property structure

### Step 3: Draft Query

Rules:
- ALWAYS include PREFIX declarations for every prefix used
- Use `LIMIT` for exploratory queries (default: 100)
- Add comments for complex patterns
- Use `FILTER(!isBlank(?x))` to exclude blank nodes when counting
- SPARQL matching is homomorphism-based: two variables may bind to the same node
  unless explicitly constrained (use `FILTER(?x != ?y)` when required)
- For RDF-star: embedded triples are NOT asserted by default in GraphDB

```sparql
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX owl: <http://www.w3.org/2002/07/owl#>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>

# Purpose: {what this query does}
SELECT ?class ?label ?definition
WHERE {
  ?class a owl:Class ;
         rdfs:label ?label .
  OPTIONAL { ?class skos:definition ?definition }
  FILTER(!isBlank(?class))
}
ORDER BY ?label
LIMIT 100
```

### Step 4: Validate Syntax

> Here: add `--no-project` after `uv run`; save the query under the scratchpad or `explorations/erp-ontology/assets/`.

Save the drafted query to a file and parse that file:

```bash
# Parse the drafted query with rdflib; a syntax error or unknown prefix raises
uv run --with rdflib python -c "
import sys
from rdflib.plugins.sparql import prepareQuery
prepareQuery(open(sys.argv[1]).read())
print('Valid SPARQL:', sys.argv[1])
" sparql/query.sparql
```

rdflib pre-binds common prefixes (`rdf`, `rdfs`, `owl`, `xsd` and others), so
the parser accepts `rdfs:label` with no PREFIX line. Check the prologue against
the prefixes the query uses by hand; other engines reject the missing line.

### Step 5: Execute

> Here: rdflib only. ROBOT is not on the PATH, and a skill does not download it; the reasoner script fetches the jar for task `reason`. Over this repository, query the generated Turtle named above. SHACL is not built.

```bash
# Via ROBOT (local ontology files): --query takes the query file and the
# results file; --output is only for the ontology changed by an UPDATE
robot query --input ontology.ttl --query query.sparql output.csv

# Via rdflib (Python)
uv run --with rdflib python -c "
import sys
from rdflib import Graph
g = Graph()
g.parse(sys.argv[1], format='turtle')
for row in g.query(open(sys.argv[2]).read()):
    print(row)
" ontology.ttl query.sparql
```

## Tool Commands

### Common query patterns

Reuse the prefix prologue below with each query. Replace the illustrative
`http://example.org/` namespace with the dataset's namespace.

```sparql
PREFIX : <http://example.org/>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX owl: <http://www.w3.org/2002/07/owl#>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
PREFIX obo: <http://purl.obolibrary.org/obo/>

# List all classes with labels
SELECT ?class ?label WHERE {
  ?class a owl:Class ; rdfs:label ?label .
  FILTER(!isBlank(?class))
}

# Count classes
SELECT (COUNT(DISTINCT ?class) AS ?count) WHERE {
  ?class a owl:Class .
  FILTER(!isBlank(?class))
}

# Find subclasses of a specific class
SELECT ?sub ?label WHERE {
  ?sub rdfs:subClassOf :ParentClass ;
       rdfs:label ?label .
}

# Find classes missing definitions
SELECT ?class ?label WHERE {
  ?class a owl:Class ; rdfs:label ?label .
  FILTER NOT EXISTS { ?class skos:definition ?def }
  FILTER NOT EXISTS { ?class obo:IAO_0000115 ?def }
  FILTER(!isBlank(?class))
}

# Property usage statistics
SELECT ?prop (COUNT(*) AS ?usage) WHERE {
  ?s ?prop ?o .
  ?prop a owl:ObjectProperty .
}
GROUP BY ?prop
ORDER BY DESC(?usage)
```

### Property Path Reference

| Pattern | Meaning | Example |
|---------|---------|---------|
| `*` | Zero or more hops | `?x rdfs:subClassOf* ?y` |
| `+` | One or more hops | `?x rdfs:subClassOf+ ?y` |
| `\|` | Alternative path | `?x (skos:exactMatch\|skos:closeMatch) ?y` |
| `^` | Inverse property | `?x ^rdfs:subClassOf ?child` (same as `?child rdfs:subClassOf ?x`) |
| `/` | Concatenation | `?x rdfs:subClassOf/rdfs:subClassOf ?gparent` |

Common caution points:
- Property paths over cyclic graphs can explode result sizes.
- Add selective anchors and `LIMIT` when exploring transitive paths.
- Prefer bounded patterns for production queries when possible.

### RDF-star patterns

> Here: does not apply; no store is chosen, and the ontology needs no statements about statements.

```sparql
PREFIX : <http://example.org/>

# SPARQL-star (GraphDB; Stardog with edge properties enabled):
# match an asserted triple and the metadata on its quoted form
SELECT ?s ?p ?o ?conf WHERE {
  ?s ?p ?o .
  << ?s ?p ?o >> :confidence ?conf .
}
```

RDF 1.2 and SPARQL 1.2 change this syntax: `<< s p o >>` names a reifier of
the triple, and a triple term is written `<<( s p o )>>`. Check which syntax
the target store implements before writing either.

### Federated queries

> Here: does not apply. No `owl:sameAs` links exist (identity is a recorded decision), and no query sends this repository's terms to a public endpoint.

```sparql
PREFIX : <http://example.org/>
PREFIX owl: <http://www.w3.org/2002/07/owl#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

# Query across multiple endpoints; ?external joins the local pattern to the
# remote one (with no shared variable the result is a Cartesian product)
SELECT ?local ?external ?label WHERE {
  ?local a :LocalClass ;
         owl:sameAs ?external .
  SERVICE <https://dbpedia.org/sparql> {
    ?external rdfs:label ?label .
    FILTER(lang(?label) = "en")
  }
}
LIMIT 100
```

## Entailment Regime Awareness

> Here: rdflib returns asserted triples. The reasoner in `bun run check:full` is ROBOT v1.9.11 with HermiT under Java 17 (decisions 112 to 114), task `reason`. It does not add inferred triples to a SPARQL result. How a later question reads inferred types is open (decision 27).

Query results depend on whether inference is applied:

- Local/raw file queries typically return only asserted triples.
- Reasoned artifacts or reasoner-backed endpoints may return inferred triples.
- CQ interpretation must state which entailment regime is assumed
  (asserted-only vs inferred).

## Outputs

> Here: a query is a fenced block in a research report or a file under `explorations/erp-ontology/assets/`; never a root `sparql/` folder.

This skill produces:

| Artifact | Location | Format | Description |
|----------|----------|--------|-------------|
| Query files | `sparql/{name}.sparql` | SPARQL | Stored, validated queries |
| Query results | `{context-dependent}` | CSV/TSV/JSON | Query output |

## Handoff

> Here: "saved to `sparql/`" means saved in the packet's report or `assets/`; run `bun run docs:check` after adding a report.

**Receives from**: Any skill that needs SPARQL queries generated or executed

**Passes to**: Requesting skill (query files and/or results)

**Handoff checklist**:
- [ ] Query syntax is validated
- [ ] PREFIX declarations are complete and correct
- [ ] Results are in the requested format
- [ ] Query is saved to `sparql/` if reusable

## Performance Tips

- Always use `LIMIT` for exploratory queries
- Avoid leading wildcards in `FILTER regex` (`regex(?var, ".*pattern")`) —
  they prevent index usage
- Use property paths (`rdfs:subClassOf+`) sparingly on large graphs
- Check `OPTIONAL` patterns for Cartesian products
- Prefer `FILTER EXISTS` / `FILTER NOT EXISTS` over subqueries
- Use `VALUES` clause for parameterized queries
- Place most selective triple patterns first in the WHERE clause

## Anti-Patterns to Avoid

- **Missing PREFIXes**: Every CURIE must have a corresponding PREFIX
  declaration. Use `../_shared/namespaces.json` as the source.
- **No LIMIT on exploration**: Always limit exploratory queries. An
  unbounded SELECT against a large graph can timeout or crash.
- **SPARQL UPDATE on production**: Never execute UPDATE/DELETE against
  production endpoints.
- **Assuming RDF-star assertion**: In GraphDB, `<< s p o >>` does NOT
  assert the triple. You must also state `s p o .` separately.
- **Ignoring blank nodes**: Always filter blank nodes when counting or
  listing named entities.
- **Assuming variable distinctness**: SPARQL can bind `?x` and `?y` to the
  same node. Add `FILTER(?x != ?y)` when distinct entities are required.
- **Ignoring entailment regime**: A query that works on materialized endpoint
  results may fail on asserted-only local files.

## Error Handling

| Error | Likely Cause | Recovery |
|-------|-------------|----------|
| Parse error | Syntax error in SPARQL | Run through validator; check missing PREFIXes or braces |
| Timeout | Query too complex or graph too large | Add LIMIT, rewrite with more selective patterns |
| Empty results | Wrong prefix IRI or term not in graph | Verify prefix resolves correctly; check term existence |
| 403 Forbidden | Endpoint requires authentication | Check credentials configuration |
| RDF-star syntax error | Store doesn't support RDF-star | Check store capabilities; fall back to standard reification |
