// A moment D1 stores is compared as text: `createdAt < before`, `createdAt >= since`. SQLite compares TEXT byte by
// byte, so the text a moment is bound as must sort exactly as the moments do, for any two the schema accepts.
import { describe, expect, it } from "@effect/vitest"
import * as Arbitrary from "effect/Arbitrary"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as S from "effect/Schema"
import * as Str from "effect/String"
import { D1Instant } from "@beep/d1/D1Instant"

const runs = { arbitrary: { runs: 500 } }
const bound = S.encodeEffect(D1Instant)

describe("a moment as D1 stores it", () => {
  it.effect.prop(
    "two moments compare as text the way they compare in time",
    [Arbitrary.schema(D1Instant), Arbitrary.schema(D1Instant)],
    ([a, b]) =>
      Effect.gen(function* () {
        const [textA, textB] = [yield* bound(a), yield* bound(b)]
        // SQLite's BINARY collation on ASCII text is the order of code units, shorter first on a common prefix.
        expect(Str.Order(textA, textB)).toBe(DateTime.Order(a, b))
      }),
    runs
  )

  it.effect.prop(
    "reads back as the moment it was bound as",
    [Arbitrary.schema(D1Instant)],
    ([moment]) =>
      Effect.gen(function* () {
        const text = yield* bound(moment)
        const read = yield* S.decodeEffect(D1Instant)(text)
        expect(DateTime.toEpochMillis(read)).toBe(DateTime.toEpochMillis(moment))
      }),
    runs
  )
})
