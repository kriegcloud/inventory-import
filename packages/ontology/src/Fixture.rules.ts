/**
 * The guards on the split of the thread's graph into a hand-written part and a lifted part (report 14 section 4.4).
 * A question could pass on hand-written triples with the lift never run; these say when a hand-written text has
 * taken over what the lift writes, and when a property that claims the fixture as its evidence is used by none of it.
 *
 * Do not break: what the lift writes is read from the lifted triples themselves, never from a list kept here, so a
 * record whose marks change moves the guard with it.
 *
 * @packageDocumentation
 */
import type { Vocabulary } from "@beep/vocabulary/Model"
import { RdfVocab } from "@beep/vocabulary/Rdf"
import * as A from "effect/Array"
import { dual } from "effect/Function"
import * as O from "effect/Option"
import * as R from "effect/Record"
import { ObjectNode, type Iri, type Triple } from "./Graph.schema.ts"

const type: Iri = `${RdfVocab.rdf.iri}type`

const typeOf = (triple: Triple): O.Option<Iri> =>
  triple.predicate === type && ObjectNode.guards.iri(triple.object) ? O.some(triple.object.iri) : O.none()

/**
 * Guard 1: the hand-written triples that state what the lift states. A triple is one when its subject and predicate
 * are those of a lifted triple, the type included, or when it gives any subject a type the lift gives. A predicate
 * alone is not enough (decision 171): the lift writes a tenant's `name`, and the fixture writes a person's, whom no
 * record identifies. None when the hand-written part holds only what no record holds.
 *
 * @example overreach(handWritten, lifted) // [] for the committed fixture
 */
export const overreach: {
  (lifted: ReadonlyArray<Triple>): (handWritten: ReadonlyArray<Triple>) => ReadonlyArray<Triple>
  (handWritten: ReadonlyArray<Triple>, lifted: ReadonlyArray<Triple>): ReadonlyArray<Triple>
} = dual(2, (handWritten: ReadonlyArray<Triple>, lifted: ReadonlyArray<Triple>): ReadonlyArray<Triple> => {
  const stated = (triple: Triple): boolean =>
    A.some(lifted, (given) => given.subject === triple.subject && given.predicate === triple.predicate)
  const types = A.dedupe(A.getSomes(A.map(lifted, typeOf)))
  return A.filter(
    handWritten,
    (triple) => stated(triple) || O.exists(typeOf(triple), (given) => A.contains(types, given))
  )
})

/**
 * Guard 3: the keys of the properties that state `evidence: "fixture"` and are the predicate of no hand-written
 * triple. Gate 5's rule P11 lets such a property go unfilled by any record because the fixture uses it; a key here
 * is a property nothing uses.
 *
 * @example unshown(vocabulary, handWritten) // [] while the fixture states a membershipOf link
 */
export const unshown: {
  (handWritten: ReadonlyArray<Triple>): (vocabulary: Vocabulary) => ReadonlyArray<string>
  (vocabulary: Vocabulary, handWritten: ReadonlyArray<Triple>): ReadonlyArray<string>
} = dual(2, (vocabulary: Vocabulary, handWritten: ReadonlyArray<Triple>): ReadonlyArray<string> => {
  const stated = A.map(handWritten, (triple) => triple.predicate)
  const claiming = A.filter(
    [...R.toEntries(vocabulary.objectProperties), ...R.toEntries(vocabulary.datatypeProperties)],
    ([, property]) => O.contains(property.evidence, "fixture")
  )
  return A.filter(
    A.map(claiming, ([key]) => key),
    (key) => !A.contains(stated, `${vocabulary.namespace}${key}`)
  )
})
