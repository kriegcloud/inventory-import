// What an upload's statements bind. A begin drops the organization's uploads begun before a cut-off, in SQL, by
// comparing the stored text with the bound one; and a stored upload is reached again only by the id and key the API
// names it with. Each property reads the text as it is bound, so it holds for what SQL really sees.
import { describe, expect, it } from "@effect/vitest"
import { ImportId, UploadKey } from "@inventory/catalog-contract/Ids"
import { AbandonedBefore, UploadInsert } from "@inventory/catalog-host/ImportRows"
import * as Arbitrary from "effect/Arbitrary"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as S from "effect/Schema"

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
        expect([O.isSome(began), O.isSome(cut)]).toEqual([true, true])
        if (O.isSome(began) && O.isSome(cut)) {
          // `importUpload.createdAt < before`, as SQLite compares two texts.
          expect(at < before).toBe(began.value < cut.value)
        }
      }),
    runs
  )

  it.effect.prop(
    "a stored upload is one the API can name again, by its id and by its key",
    [Arbitrary.schema(UploadInsert)],
    ([upload]) =>
      Effect.gen(function* () {
        const { id, key } = yield* S.encodeEffect(UploadInsert)(upload)
        expect(O.isSome(S.decodeOption(ImportId)(id))).toBe(true)
        expect(O.isSome(S.decodeOption(UploadKey)(key))).toBe(true)
      }),
    runs
  )
})
