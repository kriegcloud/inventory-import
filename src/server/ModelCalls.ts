// THE DAY'S MODEL CALLS. Every feature that asks a model takes one call from its organization's allowance first, here,
// in one statement: the table assistant reading a request and the check that the key works alike, so one key has one
// budget. The one thing not to break: the count and the taking are one INSERT ... WHERE (SELECT COUNT(*) ...) < limit,
// written BEFORE the call, so two requests cannot both take the last call, and a call that fails or times out has
// still been counted. With no key nothing is taken: the rules answer and cost nothing.
import { Array as Arr, Context, DateTime, Effect, Layer, Schema } from "effect"
import { SecureRandom } from "effect/crypto"
import { SqlClient } from "effect/sql"
import { type Member, MemberId, OrganizationId } from "../domain/Identity.ts"
import { run, statement } from "./Sql.ts"

/** How many model calls one organization may make in any 24 hours. Past it the rules answer until calls come back. */
export const dailyModelCalls = 40

/**
 * What a model call is for: the table assistant reading a request (`view`), the check that the key works, or
 * suggestions for an import's rows the rules cannot fix (`suggest`).
 */
export const ModelCallKind = Schema.Literals(["view", "check", "suggest"]).annotate({
  description:
    "What a model call is for: the table assistant reading a request, the check that the key works, or suggestions for an import"
})
/** The decoded value of `ModelCallKind`. */
export type ModelCallKind = typeof ModelCallKind.Type

/** The words for an allowance that is used up, the start of every sentence that says so. */
export const usedUpWords = `The day's ${dailyModelCalls} AI calls are used`

/** The organization's daily allowance of model calls, shared by every feature that asks a model. */
export class ModelCalls extends Context.Service<
  ModelCalls,
  {
    /**
     * Takes one call from the actor's organization's allowance, before the call is made: true when one was left.
     * The calls of the last 24 hours count, so the allowance comes back by itself a day later.
     */
    take(actor: Member, kind: ModelCallKind): Effect.Effect<boolean>
  }
>()("takehome/server/ModelCalls") {
  static readonly layer = Layer.effect(
    ModelCalls,
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient
      const random = yield* SecureRandom.SecureRandom

      const reserve = statement({
        Request: Schema.Struct({
          id: Schema.String,
          org: OrganizationId,
          actor: MemberId,
          kind: ModelCallKind,
          since: Schema.String,
          limit: Schema.Int,
          at: Schema.String
        }),
        Result: Schema.Array(Schema.Struct({ id: Schema.String })),
        execute: (r) => sql`INSERT INTO modelCall (id, organizationId, actorId, kind, createdAt)
          SELECT ${r.id}, ${r.org}, ${r.actor}, ${r.kind}, ${r.at}
          WHERE (SELECT COUNT(*) FROM modelCall WHERE organizationId = ${r.org} AND createdAt >= ${r.since}) < ${r.limit}
          RETURNING id`
      })

      const take = Effect.fn("ModelCalls.take")(function* (actor: Member, kind: ModelCallKind) {
        const id = yield* random.uuidV4()
        const now = yield* DateTime.now
        const rows = yield* run(
          reserve({
            id,
            org: actor.organizationId,
            actor: actor.id,
            kind,
            since: DateTime.formatIso(DateTime.subtract(now, { hours: 24 })),
            limit: dailyModelCalls,
            at: DateTime.formatIso(now)
          })
        )
        return Arr.isReadonlyArrayNonEmpty(rows)
      }, Effect.orDie)

      return ModelCalls.of({ take })
    })
  ).pipe(Layer.provide(SecureRandom.layerWebCrypto))
}
