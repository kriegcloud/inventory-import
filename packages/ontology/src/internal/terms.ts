// What gate 5 and the lift both read from the vocabulary and from a schema's own annotations: a CURIE's local name,
// the class, scheme or property a local name is, and the term a schema points at. One home, so the gate that checks a
// mark and the lift that follows it cannot read a mark differently.
import { type RangeTarget, type Vocabulary, type XsdDatatype } from "@beep/vocabulary/Model"
import { MarkReading, readSchemaMark } from "@beep/vocabulary/Pointer"
import { dual } from "effect/Function"
import * as O from "effect/Option"
import * as R from "effect/Record"
import type * as SchemaAST from "effect/SchemaAST"
import * as Str from "effect/String"

/**
 * A property of the vocabulary as the rules read it: its key, its domain, for a relation its range, and for an attribute
 * the datatype its literals are written as.
 */
export type Property =
  | {
      readonly kind: "object"
      readonly key: string
      readonly domain: O.Option<string>
      readonly range: RangeTarget
    }
  | {
      readonly kind: "datatype"
      readonly key: string
      readonly domain: O.Option<string>
      readonly datatype: XsdDatatype
    }

/** A CURIE's local name when it carries the vocabulary's prefix. */
export const localOf =
  (prefix: string) =>
  (curie: string): O.Option<string> =>
    Str.startsWith(`${prefix}:`)(curie) ? O.some(Str.slice(Str.length(prefix) + 1)(curie)) : O.none()

/** A local name when the vocabulary has a class of that name. */
export const classOf: {
  (local: string): (vocabulary: Vocabulary) => O.Option<string>
  (vocabulary: Vocabulary, local: string): O.Option<string>
} = dual(2, (vocabulary: Vocabulary, local: string): O.Option<string> =>
  R.has(vocabulary.classes, local) ? O.some(local) : O.none()
)

/** A local name when the vocabulary has a scheme of that name. */
export const schemeOf: {
  (local: string): (vocabulary: Vocabulary) => O.Option<string>
  (vocabulary: Vocabulary, local: string): O.Option<string>
} = dual(2, (vocabulary: Vocabulary, local: string): O.Option<string> =>
  R.has(vocabulary.schemes, local) ? O.some(local) : O.none()
)

/** The property of that local name, object or datatype, when the vocabulary has one. */
export const propertyOf: {
  (local: string): (vocabulary: Vocabulary) => O.Option<Property>
  (vocabulary: Vocabulary, local: string): O.Option<Property>
} = dual(2, (vocabulary: Vocabulary, local: string): O.Option<Property> =>
  O.orElse(
    O.map(R.get(vocabulary.objectProperties, local), (term): Property => ({
      kind: "object",
      key: local,
      domain: term.domain,
      range: term.range
    })),
    () =>
      O.map(R.get(vocabulary.datatypeProperties, local), (term): Property => ({
        kind: "datatype",
        key: local,
        domain: term.domain,
        datatype: term.datatype
      }))
  )
)

/** The term a node's own schema annotations point at, when they point at one. */
export const schemaTermOf = (ast: SchemaAST.AST): O.Option<string> => {
  const mark = readSchemaMark(ast)
  return MarkReading.guards.term(mark) ? O.some(mark.term) : O.none()
}
