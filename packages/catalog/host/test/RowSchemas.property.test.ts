// Every row schema of the import's store generates only rows it accepts (docs/standards/schema-first.md, SF-7): what a
// property draws from one of them is a row the store could be handed. The staged file's head is kept as the
// contract's `StagedHeadJson` writes it.
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
