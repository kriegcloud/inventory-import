/**
 * A moment as D1 stores it: ISO 8601 text in UTC. SQLite compares TEXT byte by byte, so a statement that asks
 * `createdAt < before` is right only while the text sorts as the moment does. The rule not to break: only years 0000
 * to 9999 are written; past them `toISOString` writes a sign and six digits (`+010000-…`), which sorts before 1970.
 *
 * @packageDocumentation
 */
import * as DateTime from "effect/DateTime"
import * as S from "effect/Schema"
import { $D1Id } from "./internal/identity.ts"

const $I = $D1Id.create("D1Instant")

/** The first and last moments whose ISO text has a four-digit year. */
const earliest = DateTime.makeUnsafe("0000-01-01T00:00:00.000Z")
const latest = DateTime.makeUnsafe("9999-12-31T23:59:59.999Z")

const isBetweenMoments = S.makeIsBetween({ order: DateTime.Order })

/**
 * A moment a statement binds or a row holds, as ISO 8601 text in UTC with a four-digit year: the text sorts as the
 * moments do, so a comparison in SQL is a comparison in time. A `DateTime.Utc` in code.
 *
 * **Example** (A cut-off bound as text)
 *
 * ```ts
 * import { D1Instant } from "@beep/d1/D1Instant"
 *
 * const Request = S.Struct({ before: D1Instant }) // encodes `before` as "2026-11-22T10:00:00.000Z"
 * ```
 *
 * @category schemas
 */
export const D1Instant = S.DateTimeUtcFromString.check(
  isBetweenMoments(
    { minimum: earliest, maximum: latest },
    {
      identifier: "D1InstantYear",
      title: "A four-digit year",
      description: "Between 0000-01-01 and 9999-12-31 in UTC, where ISO text sorts as time"
    }
  )
).pipe(
  $I.annoteSchema("D1Instant", {
    description: "A moment as D1 stores it: ISO 8601 text in UTC with a four-digit year, which sorts as time"
  })
)

/**
 * The decoded value of `D1Instant`.
 *
 * @category models
 */
export type D1Instant = typeof D1Instant.Type
