// A question asked of a graph in memory: the graph is loaded into a fresh Oxigraph store as N-Triples, the query
// runs, and each solution comes back as the values of the variables asked for, in the order the query gives them.
// Oxigraph does no reasoning, so a question answers only from the triples it is given.
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as P from "effect/Predicate"
import * as S from "effect/Schema"
import * as oxigraph from "oxigraph"
import { lineOf, type Triple } from "../../src/Graph.schema.ts"

/** A query Oxigraph does not run, or a result that is no table of solutions. */
export class NotAsked extends S.TaggedError<NotAsked, { readonly brand: unique symbol }>(
  "@inventory/ontology/test/support/ask/NotAsked"
)("NotAsked", { reason: S.String }) {}

const isSolution = (value: unknown): value is ReadonlyMap<string, { readonly value: string }> =>
  P.isObject(value) && "get" in value && P.isFunction(value.get)

/** The rows a SELECT returns over `graph`: for each solution, the value of each of `variables`, unbound as "". */
export const ask = Effect.fn("ask")(function* (
  graph: ReadonlyArray<Triple>,
  query: string,
  variables: ReadonlyArray<string>
) {
  const text = A.join(
    A.map(graph, (triple) => `${lineOf(triple)} .\n`),
    ""
  )
  const result: unknown = yield* Effect.try({
    try: () => {
      const store = new oxigraph.Store()
      store.load(text, { format: "application/n-triples" })
      return store.query(query)
    },
    catch: (cause) => NotAsked.make({ reason: String(cause) })
  })
  if (!A.isArray(result) || !A.every(result, isSolution)) {
    return yield* NotAsked.make({ reason: "the query returned no table of solutions" })
  }
  return A.map(result, (solution) =>
    A.map(variables, (variable) =>
      O.match(O.fromUndefinedOr(solution.get(variable)), { onNone: () => "", onSome: (term) => term.value })
    )
  )
})
