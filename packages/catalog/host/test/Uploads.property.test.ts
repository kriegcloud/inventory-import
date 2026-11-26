// What an upload's statements bind. A begin drops the organization's uploads begun before a cut-off, in SQL, by
// comparing the stored text with the bound one. The property reads the text as it is bound, so it holds for what SQL
// really sees.
import { describe, expect, it } from "@effect/vitest"
import { assertTrue } from "@effect/vitest/utils"
import { AbandonedBefore, UploadInsert } from "@inventory/catalog-host/ImportRows"
import * as Arbitrary from "effect/Arbitrary"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as S from "effect/Schema"
import * as Str from "effect/String"

const runs = { arbitrary: { runs: 300 } }

/** A bound text read as a moment, the way a person reading the table would. */
const momentOf = (text: string): O.Option<number> => O.map(DateTime.make(text), DateTime.toEpochMillis)

describe("an upload's statements", () => {
  it.effect.prop(
    "a cut-off drops an upload exactly when the upload began before it",
    [Arbitrary.schema(UploadInsert), Arbitrary.schema(AbandonedBefore)],
    ([upload, cutOff]) =>
      Effect.gen(function* () {
        const { at } = yield* S.encodeEffect(UploadInsert)(upload)
        const { before } = yield* S.encodeEffect(AbandonedBefore)(cutOff)
        const began = momentOf(at)
        const cut = momentOf(before)
        assertTrue(O.isSome(began), "expected the tested value to be present")
        assertTrue(O.isSome(cut), "expected the tested value to be present")
        {
          // `importUpload.createdAt < before`, as SQLite compares two texts.
          expect(Str.Order(at, before) === -1).toBe(began.value < cut.value)
        }
      }),
    runs
  )
})
