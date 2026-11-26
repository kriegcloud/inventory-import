// Every exported schema of the metamodel generates only values it accepts (schema-first rule SF-7).
import { describe, expect, it } from "@effect/vitest"
import {
  BaseIri,
  ClassKey,
  ClassTerm,
  Concept,
  ConceptScheme,
  DatatypePropertyTerm,
  Definition,
  Deprecation,
  Evidence,
  GistClass,
  GistDatatypeProperty,
  GistName,
  GistObjectProperty,
  GistProjection,
  GistProperty,
  GistPropertyName,
  GistPropertyParent,
  IdentityCriterion,
  KindTag,
  Label,
  Namespace,
  Notation,
  ObjectPropertyTerm,
  ParentLink,
  PropertyKey,
  RangeTarget,
  Ratification,
  ReplacedTerm,
  SchemeKey,
  TermKey,
  Vocabulary,
  WithdrawnTerm,
  XsdDatatype
} from "@beep/vocabulary/Model"
import * as Arbitrary from "effect/Arbitrary"
import * as R from "effect/Record"
import * as S from "effect/Schema"

const runs = { arbitrary: { runs: 30 } }
const schemas = {
  ClassKey,
  GistName,
  GistPropertyName,
  SchemeKey,
  PropertyKey,
  Notation,
  TermKey,
  Label,
  Definition,
  KindTag,
  XsdDatatype,
  Ratification,
  ParentLink,
  IdentityCriterion,
  RangeTarget,
  Evidence,
  ReplacedTerm,
  WithdrawnTerm,
  Deprecation,
  GistPropertyParent,
  ClassTerm,
  ObjectPropertyTerm,
  DatatypePropertyTerm,
  Concept,
  ConceptScheme,
  Namespace,
  BaseIri,
  GistClass,
  GistObjectProperty,
  GistDatatypeProperty,
  GistProperty,
  GistProjection,
  Vocabulary
}

describe("every metamodel schema generates only valid values", () => {
  for (const [name, schema] of R.toEntries(schemas)) {
    it.prop(
      name,
      [Arbitrary.schema(schema)],
      ([value]) => {
        expect(S.is(schema)(value)).toBe(true)
      },
      runs
    )
  }
})
