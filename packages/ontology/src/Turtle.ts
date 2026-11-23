/**
 * Reads a Turtle text into the graph's triples, with `n3`'s parser (decision 26). It is how the hand-written part of
 * a fixture enters a graph (report 14 section 4.4).
 *
 * Do not break: what is read is held to the graph's own shape. A blank node, a language tag, a named graph or a text
 * that does not parse is a `TurtleRefused`, never a triple left out.
 *
 * @packageDocumentation
 */
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as S from "effect/Schema"
import * as N3 from "n3"
import { IriNode, LiteralNode, Triple, type ObjectNode } from "./Graph.schema.ts"
import { $OntologyId } from "./internal/identity.ts"

const $I = $OntologyId.create("Turtle")

/**
 * A Turtle text the graph cannot hold: it does not parse, or it states something a graph here never has.
 *
 * @category errors
 */
export class TurtleRefused extends S.TaggedError<TurtleRefused, { readonly brand: unique symbol }>($I`TurtleRefused`)(
  "TurtleRefused",
  { reason: S.String.pipe(S.annotateKey({ description: "What the text holds that a graph cannot, in one sentence" })) },
  $I.annoteError<TurtleRefused>("TurtleRefused", { description: "A Turtle text that is no graph of IRIs and values." })
) {}

const refused = (reason: string) => Effect.fail(TurtleRefused.make({ reason }))

const objectOf = (term: N3.Quad["object"]): O.Option<ObjectNode> => {
  if (term.termType === "NamedNode") {
    return O.some(IriNode.make({ kind: "iri", iri: term.value }))
  }
  if (term.termType === "Literal" && term.language === "") {
    return O.some(LiteralNode.make({ kind: "literal", value: term.value, datatype: term.datatype.value }))
  }
  return O.none()
}

/**
 * The triples a Turtle text states, its relative IRIs resolved against `base` with a trailing slash, in the order
 * they are written.
 *
 * @example readTurtle(vocabulary.base, fixtureText) // the five hand-written triples of CQ-P06
 */
export const readTurtle = Effect.fnUntraced(function* (base: string, text: string) {
  const quads = yield* Effect.try({
    try: () => new N3.Parser({ baseIRI: `${base}/`, format: "text/turtle" }).parse(text),
    catch: (cause) => TurtleRefused.make({ reason: `the text does not parse: ${String(cause)}` })
  })
  const triples: Array<Triple> = []
  for (const quad of quads) {
    const object = objectOf(quad.object)
    if (
      quad.subject.termType !== "NamedNode" ||
      quad.predicate.termType !== "NamedNode" ||
      quad.graph.termType !== "DefaultGraph" ||
      O.isNone(object)
    ) {
      return yield* refused("the text holds a blank node, a language tag or a named graph")
    }
    triples.push(Triple.make({ subject: quad.subject.value, predicate: quad.predicate.value, object: object.value }))
  }
  return A.fromIterable(triples)
})
