/**
 * The three generated files (report 14 section 8): what each holds, where it is committed, and its exact text. The
 * write script puts these texts on disk, gate 1 compares them with what is committed, gate 2 reads them back, and
 * gate 3 says what they may hold.
 *
 * Do not break: the texts come from the kernel's vocabulary and the thread's graph and from nothing else. Every path
 * is relative to the repository or to this package; no date, host, home path or commit enters a file.
 *
 * @packageDocumentation
 */
import * as Effect from "effect/Effect"
import type { Triple } from "./Graph.schema.ts"
import { graphProjection, owlProjection, skosProjection, triplesOf, type Projection } from "./Project.ts"
import type { FileKind } from "./Constructs.rules.ts"
import { threadContext, threadGraph } from "./Thread.ts"
import { writeTurtle } from "./Write.ts"

/** The module every term comes from, as the files' first line names it. */
const vocabularySource = "packages/kernel/src/Terms.vocab.ts"

/** The graph file's two sources, as its first line names them. */
const graphSources =
  "packages/ontology/fixtures/cq/CQ-P06.fixture.ttl and packages/ontology/fixtures/cq/CQ-P06.members.json"

/** One generated file: which of the three it is, its path in this package, its triples and its text. */
export type GeneratedFile = {
  readonly kind: FileKind
  readonly path: string
  readonly triples: ReadonlyArray<Triple>
  readonly text: string
}

const fileOf = Effect.fnUntraced(function* (kind: FileKind, path: string, projection: Projection) {
  const text = yield* writeTurtle(projection)
  const file: GeneratedFile = { kind, path, triples: triplesOf(projection), text }
  return file
})

/**
 * The three files as the projector and the writer make them now: the OWL file, the SKOS file and the thread's graph.
 *
 * @example generatedFiles() // [inventory.owl.ttl, inventory.skos.ttl, fixtures/CQ-P06.graph.ttl]
 */
export const generatedFiles = Effect.fnUntraced(function* () {
  const context = yield* threadContext
  const graph = yield* threadGraph()
  const owl = yield* fileOf("owl", "generated/inventory.owl.ttl", owlProjection(context, vocabularySource))
  const skos = yield* fileOf("skos", "generated/inventory.skos.ttl", skosProjection(context, vocabularySource))
  const fixture = yield* fileOf(
    "graph",
    "generated/fixtures/CQ-P06.graph.ttl",
    graphProjection(context, graphSources, graph)
  )
  return [owl, skos, fixture] as const
})
