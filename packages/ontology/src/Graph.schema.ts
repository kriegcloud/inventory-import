/**
 * A graph in memory: triples whose subject and predicate are IRIs and whose object is an IRI or a literal with a
 * datatype. It is what the lift returns, what the hand-written fixture is read into, and what the questions are asked
 * of (report 14 section 4).
 *
 * Do not break: a graph is a set. Two graphs are compared with `sameGraph`, never by position, and a triple has no
 * blank node and no language tag: the thread writes neither, and a file that holds one is refused when it is read.
 *
 * @packageDocumentation
 */
import { LiteralKit } from "@beep/schema/LiteralKit"
import * as A from "effect/Array"
import { dual, pipe } from "effect/Function"
import * as Order from "effect/Order"
import * as S from "effect/Schema"
import * as Str from "effect/String"
import * as Tuple from "effect/Tuple"
import { $OntologyId } from "./internal/identity.ts"

const $I = $OntologyId.create("Graph")

/** An absolute IRI, with none of the characters Turtle refuses between `<` and `>`. */
export const Iri = S.String.check(S.isPattern(/^https?:\/\/[^\s<>"{}|\\^`]+$/), S.isMaxLength(600)).pipe(
  $I.annoteSchema("Iri", { description: "An absolute IRI" })
)
/** Runtime type of {@link Iri}. */
export type Iri = typeof Iri.Type

const NodeKind = LiteralKit(["iri", "literal"])

/** An object that is a thing: another node of the graph, or a concept. */
export class IriNode extends S.Opaque<IriNode, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("iri"),
    iri: Iri.pipe(S.annotateKey({ description: "The thing's IRI" }))
  }).pipe($I.annoteSchema("IriNode", { description: "An object that is a thing" }))
) {}

/** An object that is a value: its text and the datatype that says how to read it. */
export class LiteralNode extends S.Opaque<LiteralNode, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("literal"),
    value: S.String.check(S.isMaxLength(4000)).pipe(S.annotateKey({ description: "The value as written" })),
    datatype: Iri.pipe(S.annotateKey({ description: "The datatype's IRI" }))
  }).pipe($I.annoteSchema("LiteralNode", { description: "An object that is a value" }))
) {}

/** What a triple says of its subject: a thing or a value. */
export const ObjectNode = NodeKind.mapMembers(() => Tuple.make(IriNode, LiteralNode)).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("ObjectNode", { description: "The object of a triple" })
)
/** Runtime type of {@link ObjectNode}. */
export type ObjectNode = typeof ObjectNode.Type

/** One statement: subject, predicate, object. */
export class Triple extends S.Opaque<Triple, { readonly brand: unique symbol }>()(
  S.Struct({
    subject: Iri.pipe(S.annotateKey({ description: "What the statement is about" })),
    predicate: Iri.pipe(S.annotateKey({ description: "The property it states" })),
    object: ObjectNode.pipe(S.annotateKey({ description: "The thing or value it states" }))
  }).pipe($I.annoteSchema("Triple", { description: "One statement of a graph" }))
) {}

/**
 * A triple whose object is a thing.
 *
 * @example link(member, membershipIn, tenant) // <member> inv:membershipIn <tenant>
 */
// A triple's maker: its three IRIs are one statement, none of them a subject to pipe.
// @effect-diagnostics-next-line missingPipeableSignature:off
export const link = (subject: Iri, predicate: Iri, object: Iri): Triple =>
  Triple.make({ subject, predicate, object: IriNode.make({ kind: "iri", iri: object }) })

/** A literal's text with `\\` and `"` escaped, so a line ends where its value does. */
const quoted = (value: string): string => pipe(value, Str.replaceAll("\\", "\\\\"), Str.replaceAll('"', '\\"'))

/** One line that tells a triple from every other, for ordering and comparing: a graph's own N-Triples-like key. */
const keyOf = (triple: Triple): string =>
  ObjectNode.match(triple.object, {
    iri: (node) => `<${triple.subject}> <${triple.predicate}> <${node.iri}>`,
    literal: (node) => `<${triple.subject}> <${triple.predicate}> "${quoted(node.value)}"^^<${node.datatype}>`
  })

/**
 * A graph as the sorted lines of its distinct triples. Two graphs hold the same statements exactly when their lines
 * are equal, whatever order and however often each was written.
 *
 * @example linesOf([link(member, type, Member)]) // ["<…/Member/test_RaviWorks> <…#type> <…/ontology/Member>"]
 */
export const linesOf = (graph: ReadonlyArray<Triple>): ReadonlyArray<string> =>
  A.sort(A.dedupe(A.map(graph, keyOf)), Order.String)

/**
 * The triples of `graph` that `other` does not hold.
 *
 * @example without(threadGraph, handWritten) // the lifted triples
 */
export const without: {
  (other: ReadonlyArray<Triple>): (graph: ReadonlyArray<Triple>) => ReadonlyArray<Triple>
  (graph: ReadonlyArray<Triple>, other: ReadonlyArray<Triple>): ReadonlyArray<Triple>
} = dual(2, (graph: ReadonlyArray<Triple>, other: ReadonlyArray<Triple>): ReadonlyArray<Triple> => {
  const held = A.map(other, keyOf)
  return A.filter(graph, (triple) => !A.contains(held, keyOf(triple)))
})
