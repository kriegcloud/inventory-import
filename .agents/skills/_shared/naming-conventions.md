> In this repository read `project-profile.md` first; where it and this file disagree, it wins.

# Naming Conventions

Standards for naming ontology entities, minting identifiers, writing
definitions, and managing labels and synonyms. All skills must follow
these conventions.

## In this repository: key, IRI and label

- The key of an entry in the vocabulary module is the IRI's local name, exactly: the class key `Organization`
  is `inv:Organization`, the property key `isCustomer` is `inv:isCustomer`. Class keys are CamelCase, property
  keys camelCase, as below. The namespace is written once, in the module (decision 7).
- The label is the entry's `prefLabel`, written by hand for people; it is never derived from the key, and it may
  differ from it. The definition is the entry's `definition`. Which properties they are projected as is not decided
  (`project-profile.md`): report 02's sketch implies `skos:prefLabel` and `skos:definition`, its table says
  `rdfs:label`. Until Benjamin answers, write and check `skos:prefLabel` and `skos:definition`.
- A record or field names its term by CURIE in its `term` annotation (`"inv:isCustomer"`), typed against the
  vocabulary, so a key that does not exist fails the type-check (research/02).
- Renaming a key changes an IRI: it goes through the curator as a deprecation and replacement, never as an edit.
- How a SKOS concept's IRI is built from its scheme and notation (`ItemRole` and `buy`) is not decided: ask.
- None of this is built yet: the module does not exist.

## Class Names

- **Format**: `CamelCase` (e.g., `MusicalInstrument`, `StringQuartet`)
- **Rule**: Singular nouns, never plural (`Instrument` not `Instruments`)
- **Compound terms**: No underscores or hyphens in class names
- **Avoid**: Abbreviations unless universally understood in the domain

### Mass Nouns

- **Rule**: Avoid bare mass nouns as class labels. Convert to count-compatible
  forms, typically with "portion of ...".
- **Examples**: `PortionOfBlood`, `PortionOfTissue`, `PortionOfWater`
- **Why**: OWL classes represent universals whose instances are countable
  particulars; mass terms are often ambiguous without individuation.

## Property Names

- **Object properties**: `camelCase` verb phrases (e.g., `hasComponent`,
  `partOf`, `participatesIn`)
- **Data properties**: `camelCase`. Use `has` prefix for domain-specific or
  ambiguous attributes (e.g., `hasWeight`, `hasStartDate`). Bare names are
  acceptable when aligned to a well-known vocabulary (e.g., schema.org) and
  unambiguous in context (e.g., `title`, `url`, `publishedDate`). Avoid bare
  names that collide with OWL/RDFS keywords — e.g., use `siteDomain` instead
  of `domain` to avoid confusion with `rdfs:domain`.
> Here: one direction only, and no `owl:inverseOf` (`project-profile.md`); walk the other way with a SPARQL `^p` path.

- **Inverse pairs**: Declare one direction of a relation unless a
  competency question or an axiom needs both. A query can walk the other
  way with a SPARQL inverse path (`^ex:partOf`), and a class expression
  can use `inverse(ex:partOf)` (Manchester `inverse partOf`), so walking
  the other way does not by itself need a second named property. When
  both are declared, name them as an inverse pair — `hasPart` / `partOf`,
  `produces` / `producedBy` — and link them with `owl:inverseOf`. An
  inverse pair is not `owl:SymmetricProperty`, which is one property that
  holds in both directions.

### Property Naming Anti-Patterns

- **Anti-pattern**: Encoding class/domain/range in the property name
  (`plantHasBloomColor`, `patientHasBodyTemperature`)
- **Why it's wrong**: Over-specialized names reduce reuse and encourage
  duplicate properties for each class.
- **Preferred**: Keep relation names generic and constrain usage with
  domain/range or class restrictions (`hasColor`, `hasTemperature`).

## Individual Names

- **Named individuals**: `CamelCase` proper nouns (e.g., `Stradivarius1721`)
- **Test individuals**: Prefix with `test_` (e.g., `test_Piano01`)

## Identifier Minting

> Here: does not apply.

### OBO-style IDs (preferred for biomedical/scientific ontologies)

- Format: `{PREFIX}_{7-digit-number}` (e.g., `MYONT_0000001`)
- Prefix registered with OBO Foundry (or local prefix for project ontologies)
- IDs are opaque — never encode semantics in the numeric part
- Never reuse IDs, even after deprecation

> Here: an IRI is the project namespace plus the vocabulary key, under the `example.org` placeholder (decision 7); never under Sutton's name, a customer's subdomain or any real domain.

### IRI-style IDs (for project-specific ontologies)

- Format: `{base-iri}/{ClassName}` or `{base-iri}#{ClassName}`
- Use `#` fragment for small ontologies (single-document retrieval)
- Use `/` path for large ontologies (per-term dereferencing)
- Base IRI must be a stable, resolvable URL when possible

## IRI Governance

> Here: no persistence, PURL or registration until something is published (decision 7).

Use a stable, documented IRI policy for long-term persistence.

- **Entity IRI pattern**: `https://<authority>/<domain>/<module>/<name>`
- **Document IRI pattern**: `https://<authority>/<domain>/<release-artifact>`
- **Versioning**: Keep entity IRIs immutable; version ontology documents using
  `owl:versionIRI` and `owl:versionInfo`
- **Do not change published entity IRIs**: deprecate terms instead
- **Persistence options**: use PURL or redirect-capable hostname management
- **Skolemization**: minimize blank nodes in released artifacts; mint stable
  IRIs when entities need external reference
- **Best-practice criteria**: availability, understandability, simplicity,
  persistence, manageability

## Labels and Annotations

> Here: until Benjamin decides the properties, the label is `skos:prefLabel` and the definition `skos:definition`, both from the vocabulary entry; read "`rdfs:label`" in the table and in every check as `skos:prefLabel`.

Every entity MUST have:

| Annotation | Property | Requirement |
|-----------|----------|-------------|
| Label | `rdfs:label` | Exactly one per language tag |
| Definition | `skos:definition`, or `obo:IAO_0000115` in an OBO-aligned ontology | Required for classes and properties |
| Definition source | `dcterms:source` or `obo:IAO_0000119` | Required when definition is sourced |

Use one definition property per project and record it in the scope
document. ROBOT's `report` reads only `obo:IAO_0000115` for definitions, so
an ontology on `skos:definition` checks definitions with a SPARQL or SHACL
check instead (`quality-checklist.md` §2). Take the source and synonym
properties from the same family: `dcterms:source` and `skos:altLabel` with
`skos:definition`, `obo:IAO_0000119` and the `oio:` synonyms with
`obo:IAO_0000115`.

### Label Rules

> Here: casing is the vocabulary module's (research/02 writes "Organization"), not lowercase by default.

- Lowercase unless proper noun (e.g., "musical instrument", not "Musical Instrument")
- No abbreviations without expansion in synonym
- English (`@en`) is the default language tag
- One preferred label per language; additional forms go in synonyms

## Synonyms

> Here: synonyms are `skos:altLabel` from the vocabulary entry; no `oio:`.

In an OBO-aligned ontology, use OBO-in-OWL synonym properties (otherwise
`skos:altLabel`, as above):

| Property | Use When |
|----------|----------|
| `oio:hasExactSynonym` | Fully interchangeable in all contexts |
| `oio:hasRelatedSynonym` | Related but not interchangeable |
| `oio:hasBroadSynonym` | Synonym is broader than the term |
| `oio:hasNarrowSynonym` | Synonym is narrower than the term |

For production ontologies with multiple user communities, add context
annotations for labels/synonyms (for example `:prefLabelContext` and
`:altLabelContext`) and define those annotation properties in the ontology.

## Definitions: Genus-Differentia Pattern

All definitions MUST follow the genus-differentia pattern:

> "A **[parent class]** that **[differentia]**."

Examples:

| Term | Definition |
|------|-----------|
| Piano | A keyboard instrument that produces sound by hammers striking strings |
| Violin | A string instrument that is played with a bow |
| Jazz Trio | A musical ensemble that consists of exactly three performers playing jazz |

### Definition Quality Criteria

- Necessary and sufficient: captures exactly the intended extension
- No circular references (don't use the term being defined)
- No negation-only definitions ("an X that is not Y")
- Specific differentia (not "a type of X" or "a kind of X")

## Full Vocabulary Entry (Extended)

Use this two-tier approach:

- **Minimum required**: `rdfs:label` and a definition in the project's
  definition property; when the definition is sourced, also
  `dcterms:source` or `obo:IAO_0000119`, as in the table above
- **Recommended for production**: extended annotation set below

| Field | Suggested Annotation Property |
|------|-------------------------------|
| abbreviation | `skos:altLabel` (mark abbreviation in note/profile) |
| explanatoryNote | `skos:note` |
| usageNote | `skos:usageNote` |
| dependsOn | `schema:isBasedOn` |
| termOrigin | `dcterms:source` |
| definitionOrigin | `prov:wasDerivedFrom` |
| adaptedFrom | `prov:wasDerivedFrom` |
| conceptStatus | `owl:deprecated` (boolean) plus status note |
| conceptStatusDate | `dcterms:modified` |
| steward | `dcterms:creator` or `dcterms:contributor` |

## Namespace Usage

> Here: `namespaces.json` lists external prefixes and the `inv:` placeholder for examples; the project namespace itself is written once, in the vocabulary module, which wins.

- Always use prefixed CURIEs in human-readable contexts (e.g., `BFO:0000001`)
- Always declare prefixes — see `namespaces.json` for canonical map
- Never use bare IRIs in documentation or KGCL patches
- Project-specific prefixes must be registered in the ontology header and
  in `namespaces.json`
