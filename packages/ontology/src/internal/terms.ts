// What gate 5 and the lift both read from the vocabulary and from a schema's own annotations: a CURIE's local name,
// the class, scheme or property a local name is, and the term a schema points at. One home, so the gate that checks a
// mark and the lift that follows it cannot read a mark differently.
import { type RangeTarget, type Vocabulary } from "@beep/vocabulary/Model"
import { MarkReading, readSchemaMark } from "@beep/vocabulary/Pointer"
import * as O from "effect/Option"
import * as R from "effect/Record"
import type * as SchemaAST from "effect/SchemaAST"
import * as Str from "effect/String"

/** A property of the vocabulary as the rules read it: its key, its domain, and for a relation its range. */
export type Property =
  | {
      readonly kind: "object"
      readonly key: string
      readonly domain: O.Option<string>
      readonly range: RangeTarget
    }
  | { readonly kind: "datatype"; readonly key: string; readonly domain: O.Option<string> }

/** A CURIE's local name when it carries the vocabulary's prefix. */
export const localOf =
  (prefix: string) =>
  (curie: string): O.Option<string> =>
    Str.startsWith(`${prefix}:`)(curie) ? O.some(Str.slice(Str.length(prefix) + 1)(curie)) : O.none()

// A lookup in the vocabulary, called in full wherever it is used.
// @effect-diagnostics-next-line missingPipeableSignature:off
export const classOf = (vocabulary: Vocabulary, local: string): O.Option<string> =>
  R.has(vocabulary.classes, local) ? O.some(local) : O.none()

// A lookup in the vocabulary, called in full wherever it is used.
// @effect-diagnostics-next-line missingPipeableSignature:off
export const schemeOf = (vocabulary: Vocabulary, local: string): O.Option<string> =>
  R.has(vocabulary.schemes, local) ? O.some(local) : O.none()

// A lookup in the vocabulary, called in full wherever it is used.
// @effect-diagnostics-next-line missingPipeableSignature:off
export const propertyOf = (vocabulary: Vocabulary, local: string): O.Option<Property> =>
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
        domain: term.domain
      }))
  )

/** The term a node's own schema annotations point at, when they point at one. */
export const schemaTermOf = (ast: SchemaAST.AST): O.Option<string> => {
  const mark = readSchemaMark(ast)
  return MarkReading.guards.term(mark) ? O.some(mark.term) : O.none()
}
