// Every statement the app sends to D1 passes through a Schema both ways. The values it binds are encoded by a
// request Schema, so a row written to SQL is one the Schema accepts and the JSON handed to `json_each` is that
// Schema's JSON; the rows it answers are decoded by a result Schema, and a write without RETURNING must answer none.
// `SqlSchema` from effect/sql does this for a statement run on its own. D1 has no interactive transactions, so
// writes that must land together are one atomic `D1Client.batch`, and this file gives each statement of a batch the
// same treatment. The rule not to break: a service never runs a `sql` statement on its own. A read goes through
// `SqlSchema` (`findAll`, `findOneOption`); a write, or any statement of a batch, through `statement` here, run with
// `run` or `batchOn(d1)`.
import type { D1Client } from "@effect/sql-d1"
import { Array as Arr, Effect, Schema } from "effect"
import type { SqlError, Statement } from "effect/sql"

/**
 * What a write without RETURNING answers: no rows. Decoding a write's answer through it turns "this statement was
 * expected to return nothing" from a comment into a check.
 */
export const NoRows = Schema.Tuple([]).annotate({ description: "No rows: what a write without RETURNING answers" })

/**
 * One statement, its bound values already encoded by its request Schema, and how its answer is decoded. Built by a
 * function `statement` returns, run by `run` or as one entry of `batch`.
 */
export interface Query<A> {
  readonly statement: Statement.Statement<unknown>
  readonly decode: (rows: ReadonlyArray<unknown>) => Effect.Effect<A, Schema.SchemaError>
}

/**
 * A statement with a request Schema and a result Schema. `Request` encodes what the caller passes before `execute`
 * builds the SQL from the encoded value, so a branded id is bound as text and a list of rows as the JSON of its
 * Schema. `Result` decodes the whole list of rows the statement answers (`Schema.Array(Row)`, or `NoRows`).
 *
 * @example
 * const remove = statement({
 *   Request: Schema.Struct({ org: OrganizationId, id: Schema.String }),
 *   Result: Schema.Array(Schema.Struct({ id: Schema.String })),
 *   execute: ({ org, id }) => sql`DELETE FROM importDraft WHERE organizationId = ${org} AND id = ${id} RETURNING id`
 * })
 * const [gone] = yield* batch([remove({ org, id })]) // batch = batchOn(d1), made once in the Layer
 */
export const statement =
  <Req extends Schema.Constraint, Res extends Schema.Constraint>(options: {
    readonly Request: Req
    readonly Result: Res
    readonly execute: (request: Req["Encoded"]) => Statement.Statement<unknown>
  }) =>
  (
    request: Req["Type"]
  ): Effect.Effect<Query<Res["Type"]>, Schema.SchemaError, Req["EncodingServices"] | Res["DecodingServices"]> =>
    Effect.gen(function* () {
      const encoded = yield* Schema.encodeEffect(options.Request)(request)
      const services = yield* Effect.context<Res["DecodingServices"]>()
      const decode = Schema.decodeUnknownEffect(options.Result)
      return {
        statement: options.execute(encoded),
        decode: (rows) => decode(rows).pipe(Effect.provideContext(services))
      }
    })

/** A statement still to be built: its request is encoded when the Effect runs. What `statement` returns. */
export type Pending<A, E = Schema.SchemaError, R = never> = Effect.Effect<Query<A>, E, R>

/** Runs one statement on its own and decodes its answer. */
export const run = <A, E, R>(
  query: Pending<A, E, R>
): Effect.Effect<A, E | SqlError.SqlError | Schema.SchemaError, R> =>
  Effect.flatMap(query, (built) => Effect.flatMap(built.statement, built.decode))

/** The decoded answers of a batch, one per statement, in order. */
export type Answers<Queries extends ReadonlyArray<Pending<unknown, unknown, unknown>>> = {
  readonly [K in keyof Queries]: Queries[K] extends Pending<infer A, unknown, unknown> ? A : never
}

type ErrorOf<Q> = Q extends Pending<unknown, infer E, unknown> ? E : never
type ServicesOf<Q> = Q extends Pending<unknown, unknown, infer R> ? R : never

/**
 * Runs statements as one atomic D1 batch: all of them land or none does, and each answer is decoded by its own
 * result Schema. A statement that checks a condition (`WHERE EXISTS (...)`) sees the writes of the statements
 * before it in the same batch, which is how a guarded write and its audit line agree. Made once per Layer from the
 * D1 client: `const batch = batchOn(d1)`, then `yield* batch([...])`.
 */
export const batchOn =
  (d1: D1Client.D1Client) =>
  <const Queries extends ReadonlyArray<Pending<unknown, unknown, unknown>>>(
    queries: Queries
  ): Effect.Effect<
    Answers<Queries>,
    ErrorOf<Queries[number]> | SqlError.SqlError | Schema.SchemaError,
    ServicesOf<Queries[number]>
  > =>
    Effect.flatMap(
      Effect.all(queries as ReadonlyArray<Pending<unknown, ErrorOf<Queries[number]>, ServicesOf<Queries[number]>>>),
      (built) =>
        Effect.flatMap(d1.batch(Arr.map(built, (query) => query.statement)), (results) =>
          Effect.forEach(Arr.zip(built, results as ReadonlyArray<ReadonlyArray<unknown>>), ([query, rows]) =>
            query.decode(rows)
          )
        )
    ) as unknown as Effect.Effect<
      Answers<Queries>,
      ErrorOf<Queries[number]> | SqlError.SqlError | Schema.SchemaError,
      ServicesOf<Queries[number]>
    >
