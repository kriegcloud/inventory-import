/**
 * The day's model calls on D1. The one thing not to break: the count and the taking are one
 * `INSERT ... WHERE (SELECT COUNT(*) ...) < limit`, so two requests cannot both take the last call.
 *
 * @packageDocumentation
 */
import { D1 } from "@beep/d1/D1"
import { AllowanceStore, Reservation } from "@inventory/access-model/AllowanceStore"
import { Array as Arr, Effect, Layer } from "effect"
import * as S from "effect/Schema"
import { SqlClient } from "effect/sql"

/** A reservation as the statement binds it: its two moments as the ISO text the `modelCall` table holds. */
const ReservationRow = S.Struct({
  ...Reservation.fields,
  at: S.DateTimeUtcFromString,
  since: S.DateTimeUtcFromString
}).annotate({ description: "A reservation as the modelCall statement binds it" })

/**
 * `AllowanceStore` over the `modelCall` table.
 *
 * @category layers
 */
export const AllowanceStoreD1: Layer.Layer<AllowanceStore, never, SqlClient.SqlClient | D1> = Layer.effect(
  AllowanceStore,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    const { run } = yield* D1

    const reserve = D1.statement({
      Request: ReservationRow,
      Result: S.Array(S.Struct({ id: S.String })),
      execute: (r) => sql`INSERT INTO modelCall (id, organizationId, actorId, kind, createdAt)
        SELECT ${r.id}, ${r.organization}, ${r.actor}, ${r.purpose}, ${r.at}
        WHERE (SELECT COUNT(*) FROM modelCall WHERE organizationId = ${r.organization} AND createdAt >= ${r.since})
          < ${r.limit}
        RETURNING id`
    })

    return AllowanceStore.of({
      take: Effect.fn("ModelCalls.take")(function* (reservation: Reservation) {
        const rows = yield* run(reserve(reservation))
        return Arr.isReadonlyArrayNonEmpty(rows)
      }, Effect.orDie)
    })
  })
)
