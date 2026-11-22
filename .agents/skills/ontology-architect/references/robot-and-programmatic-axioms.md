# Architect: ROBOT template pitfalls and programmatic axiom examples

Moved verbatim from `SKILL.md` to keep it under 500 lines. In this repository neither applies to our terms (read
`../../_shared/project-profile.md`): Step 3 and Step 5 do not apply, and these notes stay for upstream comparison.

## ROBOT Template Pitfalls

These issues are learned through experience and not well-documented:

- **Column header syntax is fragile**: The second row defines semantics (e.g., `SC %`, `A rdfs:label`). A typo or
  extra space causes silent failures, not errors. Double-check headers before running.
- **The `%` placeholder in expressions**: `SC 'has part' some %` must have exact quoting and spacing. This is where
  most template errors occur.
- **Merge vs replace**: `--merge-before` and `--merge-after` control whether template output merges with the input or
  replaces it. The default is no merge: only the template's terms are output, so writing that over the input deletes
  the rest of the ontology. Pass `--merge-before` and write to a new file.
- **IRI resolution**: Template values must be full IRIs or CURIEs that resolve via the ontology's prefix declarations.
  Undeclared prefixes produce blank or invalid output with no error.
- **Multi-value columns**: To put multiple superclasses or annotations on one term, use `SPLIT=|` in the column
  header. Not obvious from docs.
- **Empty cells skip silently**: Empty cells in required columns skip the row rather than raising an error. Terms can
  be partially created (label but no definition).
- **Language tags**: Use `AL rdfs:label@en` to add a language tag. Without it, labels are untagged string literals,
  causing issues with tools that filter by language.
- **Labels in expressions**: A quoted label such as `'has part'` in an `SC` expression must resolve to an `rdfs:label`
  in the `--input` ontology.

**Pre-flight check**: Before running `robot template`, verify that all column headers parse correctly and all CURIEs
resolve against declared prefixes.


## Step 5 examples

OWLAPY example (owlapy 1.6, RDF/XML input):

```bash
uv run --with owlapy --with owlready2 python -c '
from owlapy.class_expression import OWLClass, OWLObjectSomeValuesFrom, OWLObjectIntersectionOf
from owlapy.owl_property import OWLObjectProperty
from owlapy.owl_axiom import OWLEquivalentClassesAxiom
from owlapy.owl_ontology import Ontology

onto = Ontology("file:///path/to/ontology.owl")

# StringInstrument EquivalentTo Instrument and hasComponent some String
instrument = OWLClass("http://example.org/Instrument")
string_cls = OWLClass("http://example.org/String")
string_instrument = OWLClass("http://example.org/StringInstrument")
has_comp = OWLObjectProperty("http://example.org/hasComponent")

definition = OWLObjectIntersectionOf([instrument, OWLObjectSomeValuesFrom(has_comp, string_cls)])
onto.add_axiom(OWLEquivalentClassesAxiom([string_instrument, definition]))

onto.save(path="ontology.new.owl")
'
```

rdflib alternative:

```bash
uv run --with rdflib python -c '
from rdflib import Graph, Namespace, OWL, RDF, RDFS, BNode

g = Graph()
g.parse("ontology.ttl", format="turtle")

EX = Namespace("http://example.org/")

# Add existential restriction: StringInstrument SubClassOf hasComponent some String
restriction = BNode()
g.add((restriction, RDF.type, OWL.Restriction))
g.add((restriction, OWL.onProperty, EX.hasComponent))
g.add((restriction, OWL.someValuesFrom, EX.String))
g.add((EX.StringInstrument, RDFS.subClassOf, restriction))

g.serialize("ontology.new.ttl", format="turtle")
'
```

