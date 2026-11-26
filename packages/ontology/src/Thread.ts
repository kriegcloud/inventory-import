/**
 * The thread's graph (report 14 section 4.4): `graphOf` puts the lifted triples of a record's rows beside a
 * hand-written text, and `threadGraph` is `graphOf` given the kernel's `Member`, the two committed member rows and the
 * committed hand-written fixture, seventeen triples.
 *
 * Do not break: nothing is added to a graph between the lift and the question. Every triple `graphOf` returns is one
 * `lift` returned for a decoded row or one the hand-written text states; a guard of gate 8 holds it to that, so a
 * `threadGraph` that wrote a grant itself fails there. This file is the one place that says which class is the tenant
 * and which prefix the marks carry.
 *
 * @packageDocumentation
 */
import { Vocabulary } from "@beep/vocabulary/Model"
import { Member } from "@inventory/kernel/Member"
import { vocabulary } from "@inventory/kernel/Terms"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as S from "effect/Schema"
import members from "../fixtures/cq/CQ-P06.members.json" with { type: "json" }
import handWritten from "../fixtures/cq/CQ-P06.fixture.ttl?raw"
import { lift, type LiftContext } from "./Lift.ts"
import { readTurtle } from "./Turtle.ts"

const strict = { onExcessProperty: "error", errors: "all" } as const

/**
 * What the thread's lifts are given: the kernel's vocabulary, decoded strictly, the prefix `inv` its marks carry,
 * `Tenant`, the class a record's organization is an instance of, and no organization beside the rows: each `Member`
 * names its own.
 */
export const threadContext = Effect.map(S.decodeEffect(Vocabulary, strict)(vocabulary), (decoded): LiftContext => ({
  vocabulary: decoded,
  prefix: "inv",
  tenant: "Tenant",
  organization: O.none()
}))

/**
 * A graph from rows and a hand-written text: each row is decoded through `record` and lifted, and the text's triples
 * follow the lifted ones. It fails when a row does not decode, a mark cannot be followed, or the text is no graph.
 *
 * @example graphOf(context, Member, rows, fixtureText) // the lifted triples, then the hand-written ones
 */
export const graphOf = Effect.fnUntraced(function* <Record extends S.Top & { readonly EncodingServices: never }>(
  context: LiftContext,
  record: Record,
  rows: ReadonlyArray<unknown>,
  text: string
) {
  const decode = S.decodeUnknownEffect(record, strict)
  const lifted = yield* Effect.forEach(
    rows,
    (row) => Effect.flatMap(decode(row), (value) => lift(context, record, value)),
    { concurrency: 1 }
  )
  const written = yield* readTurtle(context.vocabulary.base, text)
  return [...A.flatten(lifted), ...written]
})

/** The hand-written part of the thread's graph, as committed: what no record holds. */
export const threadHandWritten: string = handWritten

/** The thread's member rows, as committed and not yet decoded. */
export const threadRows: ReadonlyArray<unknown> = members

/**
 * The graph the thread's questions are asked of: the two committed member rows lifted, with the hand-written fixture.
 *
 * @example threadGraph() // seventeen triples: twelve lifted, five hand-written
 */
export const threadGraph = Effect.fnUntraced(function* () {
  const context = yield* threadContext
  return yield* graphOf(context, Member, threadRows, threadHandWritten)
})
