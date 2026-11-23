/**
 * Reads a Turtle text with `n3`'s parser (decision 26): as what it states, blank nodes kept, for the gate that says
 * which constructs a generated file may hold; and as a graph, for the hand-written part of a fixture and for the
 * re-parse of what the writer wrote (report 14 sections 4.4, 6.2 and 6.3).
 *
 * Do not break: the parser is used only to read. No file is written through it, so that reading a file back runs
 * other code than writing it did. A text that does not parse is a `TurtleRefused` that carries the parser's own
 * words, the line among them; a blank node read as a graph is refused, never left out.
 *
 * @packageDocumentation
 */
import { LiteralKit } from "@beep/schema/LiteralKit"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as S from "effect/Schema"
import * as Tuple from "effect/Tuple"
import * as N3 from "n3"
import { Iri, IriNode, LiteralNode, TextNode, Triple } from "./Graph.schema.ts"
import { $OntologyId } from "./internal/identity.ts"

const $I = $OntologyId.create("Turtle")

/**
 * A Turtle text that cannot be read: it does not parse, or it is asked for as a graph and states something a graph
 * here never has.
 *
 * @category errors
 */
export class TurtleRefused extends S.TaggedError<TurtleRefused, { readonly brand: unique symbol }>($I`TurtleRefused`)(
  "TurtleRefused",
  { reason: S.String.pipe(S.annotateKey({ description: "What the text holds that cannot be read, in one sentence" })) },
  $I.annoteError<TurtleRefused>("TurtleRefused", { description: "A Turtle text that cannot be read." })
) {}

const ParsedKind = LiteralKit(["iri", "literal", "text", "blank"])

/** A node with no name of its own: Turtle's `[]`, `_:b` and the cells of a `( … )` list. */
export class BlankNode extends S.Opaque<BlankNode, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("blank"),
    id: S.String.pipe(S.annotateKey({ description: "The parser's label for it, meaningful within one text only" }))
  }).pipe($I.annoteSchema("BlankNode", { description: "A node with no name of its own" }))
) {}

/** A subject or an object as a Turtle text states it: one of a graph's three, or a blank node. */
export const ParsedNode = ParsedKind.mapMembers(() => Tuple.make(IriNode, LiteralNode, TextNode, BlankNode)).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("ParsedNode", { description: "A subject or an object as a Turtle text states it" })
)
/** Runtime type of {@link ParsedNode}. */
export type ParsedNode = typeof ParsedNode.Type

/** One statement of a Turtle text, before anything is refused. */
export class ParsedTriple extends S.Opaque<ParsedTriple, { readonly brand: unique symbol }>()(
  S.Struct({
    subject: ParsedNode.pipe(S.annotateKey({ description: "What the statement is about: an IRI or a blank node" })),
    predicate: Iri.pipe(S.annotateKey({ description: "The property it states" })),
    object: ParsedNode.pipe(S.annotateKey({ description: "The thing, value, words or blank node it states" }))
  }).pipe($I.annoteSchema("ParsedTriple", { description: "One statement of a Turtle text" }))
) {}

const nodeOf = (term: N3.Quad["subject"] | N3.Quad["object"]): O.Option<ParsedNode> => {
  if (term.termType === "NamedNode") {
    return O.some(IriNode.make({ kind: "iri", iri: term.value }))
  }
  if (term.termType === "BlankNode") {
    return O.some(BlankNode.make({ kind: "blank", id: term.value }))
  }
  if (term.termType === "Literal") {
    return O.some(
      term.language === ""
        ? LiteralNode.make({ kind: "literal", value: term.value, datatype: term.datatype.value })
        : TextNode.make({ kind: "text", value: term.value, language: term.language })
    )
  }
  return O.none()
}

/**
 * Every statement a Turtle text makes, in the order written, its relative IRIs resolved against `base` with a
 * trailing slash. It fails when the text does not parse, with the parser's message.
 *
 * @example parseTurtle(vocabulary.base, text) // the statements, blank nodes among them
 */
export const parseTurtle = Effect.fnUntraced(function* (base: string, text: string) {
  const quads = yield* Effect.try({
    try: () => new N3.Parser({ baseIRI: `${base}/`, format: "text/turtle" }).parse(text),
    catch: (cause) => TurtleRefused.make({ reason: `the text does not parse: ${String(cause)}` })
  })
  const parsed: Array<ParsedTriple> = []
  for (const quad of quads) {
    const subject = nodeOf(quad.subject)
    const object = nodeOf(quad.object)
    if (O.isNone(subject) || O.isNone(object) || quad.predicate.termType !== "NamedNode") {
      return yield* TurtleRefused.make({ reason: "the text states a quoted triple or a variable" })
    }
    parsed.push(ParsedTriple.make({ subject: subject.value, predicate: quad.predicate.value, object: object.value }))
  }
  return A.fromIterable(parsed)
})

/**
 * The statements as a graph, when none of them holds a blank node.
 *
 * @example asGraph(parsed) // Some(triples), or None when the text holds a blank node
 */
export const asGraph = (parsed: ReadonlyArray<ParsedTriple>): O.Option<ReadonlyArray<Triple>> =>
  O.all(
    A.map(parsed, (triple) =>
      ParsedNode.guards.iri(triple.subject) && !ParsedNode.guards.blank(triple.object)
        ? O.some(Triple.make({ subject: triple.subject.iri, predicate: triple.predicate, object: triple.object }))
        : O.none()
    )
  )

/**
 * The triples a Turtle text states, as a graph. It fails when the text does not parse or holds a blank node.
 *
 * @example readTurtle(vocabulary.base, fixtureText) // the five hand-written triples of CQ-P06
 */
export const readTurtle = Effect.fnUntraced(function* (base: string, text: string) {
  const parsed = yield* parseTurtle(base, text)
  const graph = asGraph(parsed)
  if (O.isNone(graph)) {
    return yield* TurtleRefused.make({ reason: "the text holds a blank node, which a graph here never has" })
  }
  return graph.value
})
