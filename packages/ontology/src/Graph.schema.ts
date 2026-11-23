/**
 * A graph in memory: triples whose subject and predicate are IRIs and whose object is an IRI, a literal with a
 * datatype, or a text in one language. It is what the lift and the projector return, what a Turtle file is read
 * into, and what the questions are asked of (report 14 sections 4 and 6).
 *
 * Do not break: a graph is a set. Two graphs are compared by `linesOf`, never by position, and a triple has no blank
 * node: nothing here writes one, and a file that holds one is refused when it is read as a graph. Order is by code
 * point, never by locale, so the same graph sorts the same on every machine.
 *
 * @packageDocumentation
 */
import { LiteralKit } from "@beep/schema/LiteralKit"
import * as A from "effect/Array"
import { dual, pipe } from "effect/Function"
import * as O from "effect/Option"
import * as Order from "effect/Order"
import * as S from "effect/Schema"
import * as Str from "effect/String"
import * as Tuple from "effect/Tuple"
import { $OntologyId } from "./internal/identity.ts"

const $I = $OntologyId.create("Graph")

/**
 * An absolute IRI, with none of the characters Turtle refuses between `<` and `>`: no control character or space,
 * and none of `<>"{}|^` or the backtick and backslash.
 */
export const Iri = S.String.check(S.isPattern(/^https?:\/\/[^\u0000- <>"{}|\\^`]+$/), S.isMaxLength(600)).pipe(
  $I.annoteSchema("Iri", { description: "An absolute IRI" })
)
/** Runtime type of {@link Iri}. */
export type Iri = typeof Iri.Type

const NodeKind = LiteralKit(["iri", "literal", "text"])

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

/** An object that is words for a person: a label or a definition, and the language it is written in. */
export class TextNode extends S.Opaque<TextNode, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("text"),
    value: S.String.check(S.isMaxLength(4000)).pipe(S.annotateKey({ description: "The words as written" })),
    language: S.String.check(S.isPattern(/^[a-z]{2,3}(?:-[a-z0-9]{1,8})*$/)).pipe(
      S.annotateKey({ description: "The language tag in lower case, such as en: a reader lowers it" })
    )
  }).pipe($I.annoteSchema("TextNode", { description: "An object that is words in one language" }))
) {}

/** What a triple says of its subject: a thing, a value, or words. */
export const ObjectNode = NodeKind.mapMembers(() => Tuple.make(IriNode, LiteralNode, TextNode)).pipe(
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

/**
 * A triple whose object is a value of one datatype.
 *
 * @example literal(ontology, versionInfo, "0.1.0", xsdString)
 */
// @effect-diagnostics-next-line missingPipeableSignature:off
export const literal = (subject: Iri, predicate: Iri, value: string, datatype: Iri): Triple =>
  Triple.make({ subject, predicate, object: LiteralNode.make({ kind: "literal", value, datatype }) })

/**
 * A triple whose object is words in one language.
 *
 * @example text(member, prefLabel, "Member", "en") // <member> skos:prefLabel "Member"@en
 */
// @effect-diagnostics-next-line missingPipeableSignature:off
export const text = (subject: Iri, predicate: Iri, value: string, language: string): Triple =>
  Triple.make({ subject, predicate, object: TextNode.make({ kind: "text", value, language }) })

/**
 * Text between two quotes as Turtle and N-Triples both write it: `\\`, `"`, newline, carriage return and tab escaped.
 *
 * @example quoted('a "b"') // 'a \\"b\\"'
 */
export const quoted = (value: string): string =>
  pipe(
    value,
    Str.replaceAll("\\", "\\\\"),
    Str.replaceAll('"', '\\"'),
    Str.replaceAll("\n", "\\n"),
    Str.replaceAll("\r", "\\r"),
    Str.replaceAll("\t", "\\t")
  )

/**
 * An object as N-Triples writes it: the form objects are sorted and compared by.
 *
 * @example objectLine(IriNode.make({ kind: "iri", iri })) // "<https://…>"
 */
export const objectLine = (object: ObjectNode): string =>
  ObjectNode.match(object, {
    iri: (node) => `<${node.iri}>`,
    literal: (node) => `"${quoted(node.value)}"^^<${node.datatype}>`,
    text: (node) => `"${quoted(node.value)}"@${node.language}`
  })

/**
 * One line that tells a triple from every other: the triple as N-Triples writes it, less the final dot.
 *
 * @example lineOf(link(member, type, Member)) // "<…/Member/test_RaviWorks> <…#type> <…/ontology/Member>"
 */
export const lineOf = (triple: Triple): string =>
  `<${triple.subject}> <${triple.predicate}> ${objectLine(triple.object)}`

/**
 * Text ordered by code point: the order of the characters' numbers, the same on every machine and in every locale.
 * A plain `<` compares UTF-16 units, which puts a character outside the basic plane before some inside it.
 */
// An order is called by a sort, with both texts.
// @effect-diagnostics-next-line missingPipeableSignature:off
export const byCodePoint: Order.Order<string> = Order.make((self, that) => {
  const left = A.fromIterable(self)
  const right = A.fromIterable(that)
  const differing = A.findFirst(A.zip(left, right), ([a, b]) => a !== b)
  if (O.isSome(differing)) {
    const [a, b] = differing.value
    const point = (character: string): number => O.getOrElse(Str.codePointAt(0)(character), () => 0)
    return point(a) < point(b) ? -1 : 1
  }
  return Order.Number(left.length, right.length)
})

/**
 * A graph as the sorted lines of its distinct triples. Two graphs hold the same statements exactly when their lines
 * are equal, whatever order and however often each was written.
 *
 * @example linesOf([link(member, type, Member)]) // ["<…/Member/test_RaviWorks> <…#type> <…/ontology/Member>"]
 */
export const linesOf = (graph: ReadonlyArray<Triple>): ReadonlyArray<string> =>
  A.sort(A.dedupe(A.map(graph, lineOf)), byCodePoint)

/**
 * The triples of `graph` that `other` does not hold.
 *
 * @example without(threadGraph, handWritten) // the lifted triples
 */
export const without: {
  (other: ReadonlyArray<Triple>): (graph: ReadonlyArray<Triple>) => ReadonlyArray<Triple>
  (graph: ReadonlyArray<Triple>, other: ReadonlyArray<Triple>): ReadonlyArray<Triple>
} = dual(2, (graph: ReadonlyArray<Triple>, other: ReadonlyArray<Triple>): ReadonlyArray<Triple> => {
  const held = A.map(other, lineOf)
  return A.filter(graph, (triple) => !A.contains(held, lineOf(triple)))
})
