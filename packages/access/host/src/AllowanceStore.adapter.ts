/**
 * The day's model calls on D1. The one thing not to break: the count and the taking are one
 * `INSERT ... WHERE (SELECT COUNT(*) ...) < limit`, so two requests cannot both take the last call.
 *
 * @packageDocumentation
 */
import { D1 } from "@beep/d1/D1"
import { D1Instant } from "@beep/d1/D1Instant"
import { windowStart } from "@inventory/access-model/AllowanceRules"
import { AllowanceStore, Reservation } from "@inventory/access-model/AllowanceStore"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as S from "effect/Schema"
import * as SchemaTransformation from "effect/SchemaTransformation"
import * as SqlClient from "effect/sql/SqlClient"
import * as Struct from "effect/Struct"

const reservationFields = { ...Reservation.fields, at: D1Instant }

/**
 * A reservation as the statement binds it: its moment, and the start of the window it is counted in, as the ISO text
 * the `modelCall` table holds. The window is never given: it is worked out from the moment as the row is bound
 * (`windowStart`), so the statement counts exactly the 24 hours before the call.
 */
export const ReservationRow = S.Struct({ ...reservationFields, since: D1Instant })
  .pipe(
    S.decodeTo(
      S.toType(S.Struct(reservationFields)),
      SchemaTransformation.transform({
        decode: Struct.omit(["since"]),
        encode: (reservation) => ({ ...reservation, since: windowStart(reservation.at) })
      })
    )
  )
  .annotate({ description: "A reservation as the modelCall statement binds it, with the window it is counted in" })

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
        return A.isReadonlyArrayNonEmpty(rows)
      }, Effect.orDie)
    })
  })
)
