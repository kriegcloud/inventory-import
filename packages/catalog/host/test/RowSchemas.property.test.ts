// Every row schema of the import's store generates only rows it accepts (docs/standards/schema-first.md, SF-7): what a
// property draws from one of them is a row the store could be handed. The staged file's head is kept as the
// contract's `StagedHeadJson` writes it, and the text it writes reads back as the same head.
import { describe, expect, it } from "@effect/vitest"
import {
  AbandonedBefore,
  ItemInsert,
  ItemsPiece,
  OutcomeInsert,
  OutcomeReason,
  OutcomeRow,
  Part,
  RowNumber,
  UploadInsert
} from "@inventory/catalog-host/ImportRows"
import { StagedHeadJson } from "@inventory/catalog-contract/Staged"
import * as Arbitrary from "effect/Arbitrary"
import * as Effect from "effect/Effect"
import * as S from "effect/Schema"

const runs = { arbitrary: { runs: 50 } }

/** `schema` generates only values it accepts. */
const generatesOnlyValid = <Schema extends S.Top>(name: string, schema: Schema) =>
  it.prop(
    name,
    [Arbitrary.schema(schema)],
    ([value]) => {
      expect(S.is(schema)(value)).toBe(true)
    },
    runs
  )

describe("every row schema generates only valid values", () => {
  generatesOnlyValid("UploadInsert", UploadInsert)
  generatesOnlyValid("AbandonedBefore", AbandonedBefore)
  generatesOnlyValid("RowNumber", RowNumber)
  generatesOnlyValid("Part", Part)
  generatesOnlyValid("OutcomeReason", OutcomeReason)
  generatesOnlyValid("OutcomeInsert", OutcomeInsert)
  generatesOnlyValid("OutcomeRow", OutcomeRow)
  generatesOnlyValid("ItemInsert", ItemInsert)
  generatesOnlyValid("ItemsPiece", ItemsPiece)
  generatesOnlyValid("StagedHeadJson", StagedHeadJson)
})

describe("the staged head as the store keeps it", () => {
  it.effect.prop(
    "a head written as JSON text reads back as the same head",
    [Arbitrary.schema(StagedHeadJson)],
    ([head]) =>
      Effect.gen(function* () {
        const text = yield* S.encodeEffect(StagedHeadJson)(head)
        const read = yield* S.decodeEffect(StagedHeadJson)(text)
        expect(read).toEqual(head)
      }),
    runs
  )
})
