/**
 * Every statement the app sends to D1 passes through a Schema both ways. The values it binds are encoded by a
 * request Schema, so a row written to SQL is one the Schema accepts and the JSON handed to `json_each` is that
 * Schema's JSON; the rows it answers are decoded by a result Schema, and a write without RETURNING must answer none
 * (`NoRows`). D1 has no interactive transactions, so writes that must land together are one atomic batch.
 *
 * The rule not to break: a service never runs a `sql` statement on its own. A read goes through `SqlSchema`
 * (`findAll`, `findOneOption`) on the `SqlClient` this layer provides; a write, or any statement of a batch, through
 * `D1.statement`, run with `run` or `batch`.
 *
 * @packageDocumentation
 */
import type { D1Database } from "@cloudflare/workers-types"
import { D1Client } from "@effect/sql-d1"
import * as A from "effect/Array"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as S from "effect/Schema"
import type { SqlClient, Statement } from "effect/sql"
import { D1Error } from "./D1.errors.ts"
import { $D1Id } from "./internal/identity.ts"

const $I = $D1Id.create("D1")

/**
 * What a write without RETURNING answers: no rows. Decoding a write's answer through it turns "this statement was
 * expected to return nothing" from a comment into a check.
 *
 * @category schemas
 */
export const NoRows = S.Tuple([]).pipe(
  $I.annoteSchema("NoRows", { description: "No rows: what a write without RETURNING answers" })
)

/**
 * One statement, its bound values already encoded by its request Schema, and how its answer is decoded.
 *
 * @category models
 */
export interface D1Query<A> {
  readonly statement: Statement.Statement<unknown>
  readonly decode: (rows: ReadonlyArray<unknown>) => Effect.Effect<A, S.SchemaError>
}

/**
 * A statement still to be built: its request is encoded when the Effect runs. What `D1.statement` returns.
 *
 * @category models
 */
export type Pending<A, E = D1Error, R = never> = Effect.Effect<D1Query<A>, E, R>

/**
 * The decoded answers of a batch, one per statement, in order.
 *
 * @category models
 */
export type Answers<Queries extends ReadonlyArray<Pending<unknown, unknown, unknown>>> = {
  readonly [K in keyof Queries]: Queries[K] extends Pending<infer A, unknown, unknown> ? A : never
}

type ErrorOf<Q> = Q extends Pending<unknown, infer E, unknown> ? E : never
type ServicesOf<Q> = Q extends Pending<unknown, unknown, infer R> ? R : never

/**
 * The Worker's D1 binding itself, for the one library that takes it directly (Better Auth builds its own dialect on
 * it). Everything else goes through `D1`.
 *
 * @category services
 */
export class D1Binding extends Context.Service<D1Binding, D1Database>()($I`D1Binding`) {}

const failed = (stage: D1Error["stage"], statement: number) => (cause: unknown) =>
  D1Error.make({ stage, statement, cause })

const decodeEach = Effect.fnUntraced(function* (
  built: ReadonlyArray<D1Query<unknown>>,
  results: ReadonlyArray<ReadonlyArray<unknown>>
) {
  return yield* Effect.forEach(
    A.zip(built, results),
    ([query, rows], index) => query.decode(rows).pipe(Effect.mapError(failed("decode", index))),
    { concurrency: 1 }
  )
})

/**
 * D1 through Effect SQL: one statement on its own (`run`), or several as one atomic batch (`batch`), each encoded and
 * decoded by its own Schemas.
 *
 * **Example** (A guarded write and its audit line, together)
 *
 * ```ts
 * import { D1 } from "@beep/d1/D1"
 *
 * const d1 = yield* D1
 * const [removed] = yield* d1.batch([remove({ org, id }), auditLine({ org, id })])
 * ```
 *
 * @category services
 */
export class D1 extends Context.Service<
  D1,
  {
    /** Runs one statement on its own and decodes its answer. */
    readonly run: <A, E, R>(query: Pending<A, E, R>) => Effect.Effect<A, E | D1Error, R>
    /**
     * Runs statements as one atomic D1 batch: all of them land or none does. A statement that checks a condition
     * (`WHERE EXISTS (...)`) sees the writes of the statements before it in the same batch.
     */
    readonly batch: <const Queries extends ReadonlyArray<Pending<unknown, unknown, unknown>>>(
      queries: Queries
    ) => Effect.Effect<Answers<Queries>, ErrorOf<Queries[number]> | D1Error, ServicesOf<Queries[number]>>
  }
>()($I`D1`) {
  /**
   * A statement with a request Schema and a result Schema. `Request` encodes what the caller passes before `execute`
   * builds the SQL from the encoded value, so a branded id is bound as text and a list of rows as the JSON of its
   * Schema. `Result` decodes the whole list of rows the statement answers (`S.Array(Row)`, or `NoRows`).
   */
  static readonly statement =
    <Req extends S.Constraint, Res extends S.Constraint>(options: {
      readonly Request: Req
      readonly Result: Res
      readonly execute: (request: Req["Encoded"]) => Statement.Statement<unknown>
    }) =>
    (request: Req["Type"]): Pending<Res["Type"], D1Error, Req["EncodingServices"] | Res["DecodingServices"]> =>
      Effect.gen(function* () {
        const encoded = yield* S.encodeEffect(options.Request)(request).pipe(Effect.mapError(failed("encode", 0)))
        const services = yield* Effect.context<Res["DecodingServices"]>()
        const decode = S.decodeUnknownEffect(options.Result)
        return {
          statement: options.execute(encoded),
          decode: (rows: ReadonlyArray<unknown>) => decode(rows).pipe(Effect.provideContext(services))
        }
      })

  /** `D1` over an already provided `D1Client`. */
  static readonly layerFromClient: Layer.Layer<D1, never, D1Client.D1Client> = Layer.effect(
    D1,
    Effect.gen(function* () {
      const client = yield* D1Client.D1Client
      const run = <A, E, R>(query: Pending<A, E, R>): Effect.Effect<A, E | D1Error, R> =>
        Effect.flatMap(query, (built) =>
          built.statement.pipe(
            Effect.mapError(failed("execute", 0)),
            Effect.flatMap((rows) => built.decode(rows).pipe(Effect.mapError(failed("decode", 0))))
          )
        ).pipe(Effect.withSpan("D1.run"))
      const batch = <const Queries extends ReadonlyArray<Pending<unknown, unknown, unknown>>>(
        queries: Queries
      ): Effect.Effect<Answers<Queries>, ErrorOf<Queries[number]> | D1Error, ServicesOf<Queries[number]>> =>
        Effect.gen(function* () {
          const built = yield* Effect.forEach(
            queries as ReadonlyArray<Pending<unknown, ErrorOf<Queries[number]>, ServicesOf<Queries[number]>>>,
            (query, index) =>
              query.pipe(
                Effect.mapError((error) =>
                  S.is(D1Error)(error)
                    ? D1Error.make({ stage: error.stage, statement: index, cause: error.cause })
                    : error
                )
              ),
            { concurrency: 1 }
          )
          const results = yield* client
            .batch(A.map(built, (query) => query.statement))
            .pipe(Effect.mapError(failed("execute", 0)))
          const answers = yield* decodeEach(built, results as ReadonlyArray<ReadonlyArray<unknown>>)
          // The tuple's element types are the statements' Result types, decoded in order above; the type system
          // cannot follow a mapped tuple through `forEach`, so the answers are named once here.
          return answers as unknown as Answers<Queries>
        }).pipe(Effect.withSpan("D1.batch", { attributes: { "db.batch.size": queries.length } }))
      return D1.of({ run, batch })
    })
  )

  /** `D1`, `D1Client`, `SqlClient` and `D1Binding` on a Worker's D1 binding. */
  static readonly layer = (options: {
    readonly db: D1Database
  }): Layer.Layer<D1 | D1Client.D1Client | SqlClient.SqlClient | D1Binding> =>
    Layer.mergeAll(D1.layerFromClient, Layer.succeed(D1Binding, options.db)).pipe(
      Layer.provideMerge(D1Client.layer({ db: options.db })),
      Layer.orDie
    )
}
