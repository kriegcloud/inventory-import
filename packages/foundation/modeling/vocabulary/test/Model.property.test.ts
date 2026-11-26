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
  Evidence,
  GistClass,
  GistName,
  GistProjection,
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
  SchemeKey,
  Vocabulary,
  XsdDatatype
} from "@beep/vocabulary/Model"
import * as Arbitrary from "effect/Arbitrary"
import * as R from "effect/Record"
import * as S from "effect/Schema"

const runs = { arbitrary: { runs: 30 } }
const schemas = {
  ClassKey,
  GistName,
  SchemeKey,
  PropertyKey,
  Notation,
  Label,
  Definition,
  KindTag,
  XsdDatatype,
  Ratification,
  ParentLink,
  IdentityCriterion,
  RangeTarget,
  Evidence,
  ClassTerm,
  ObjectPropertyTerm,
  DatatypePropertyTerm,
  Concept,
  ConceptScheme,
  Namespace,
  BaseIri,
  GistClass,
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
