// The catalog contract's schemas generate only values they accept (schema-first rule SF-7), and the shapes whose
// wire side must keep its bytes do: a cost is written back as its shortest digits, a row's decision travels as its
// flags, and a stored suggestion's columns read back as the suggestion that was stored.
import { describe, expect, it } from "@effect/vitest"
import { AnsweredBy } from "@inventory/catalog-contract/Answer"
import { Change, changeFromStored, changeToStored } from "@inventory/catalog-contract/Change"
import { decisionFromFlags, RowDecision, RowDecisionFlags, SavedDecisions } from "@inventory/catalog-contract/Decision"
import { ConfirmId, ImportId, ItemId, RowId, SuggestionId, UploadKey } from "@inventory/catalog-contract/Ids"
import { DecidedBy, RowOutcome, TakeBackState } from "@inventory/catalog-contract/Import"
import { Category, Dimensions, Stocking, UnitCost, Uom } from "@inventory/catalog-contract/Item"
import { ColumnMatch, MappingChoice, UnusedColumn } from "@inventory/catalog-contract/Mapping"
import { Field, StagedCell, StagedColumn } from "@inventory/catalog-contract/Staged"
import {
  Suggestion,
  suggestedByModel,
  suggestionFromStored,
  suggestionToStored,
  storedSuggestion
} from "@inventory/catalog-contract/Suggestion"
import { ViewChange } from "@inventory/catalog-contract/TableView"
import { UploadDiscard } from "@inventory/catalog-contract/Upload"
import * as Effect from "effect/Effect"
import * as Arbitrary from "effect/Arbitrary"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as S from "effect/Schema"

const runs = { arbitrary: { runs: 50 } }
const schemas: Readonly<Record<string, S.Top>> = {
  ImportId,
  ItemId,
  ConfirmId,
  SuggestionId,
  UploadKey,
  RowId,
  Category,
  Uom,
  UnitCost,
  Dimensions,
  Stocking,
  Field,
  StagedCell,
  StagedColumn,
  MappingChoice,
  ColumnMatch,
  UnusedColumn,
  RowDecisionFlags,
  RowDecision,
  SavedDecisions,
  Change,
  Suggestion,
  DecidedBy,
  RowOutcome,
  TakeBackState,
  UploadDiscard,
  ViewChange,
  AnsweredBy
}

describe("every schema generates only valid values", () => {
  for (const [name, schema] of R.toEntries(schemas)) {
    it.prop(
      name,
      [Arbitrary.schema(schema)],
      ([value]) => {
        expect(S.is(schema)(value)).toBe(true)
      },
      runs
    )
  }
})

describe("the wire", () => {
  it.effect("a cost is a decimal in code and its shortest digits on the wire", () =>
    Effect.gen(function* () {
      const cost = yield* S.decodeEffect(UnitCost)("012.50")
      const wire = yield* S.encodeEffect(UnitCost)(cost)
      expect(wire).toBe("12.5")
    })
  )

  it.effect("a row's decision travels as its flags and reads back the same", () =>
    Effect.gen(function* () {
      const decided = decisionFromFlags({ accepted: ["unitCost"], out: true })
      const wire = yield* S.encodeEffect(RowDecision)(decided)
      expect(wire).toEqual({ accepted: ["unitCost"], out: true })
      const back = yield* S.decodeEffect(RowDecision)(wire)
      expect(back).toEqual(decided)
    })
  )

  it.effect("a stored suggestion's columns read back as the suggestion, and a change's as the change", () =>
    Effect.gen(function* () {
      const id = yield* S.decodeEffect(SuggestionId)("00000000-0000-4000-8000-000000000001")
      const rowId = yield* S.decodeEffect(RowId)("row-7")
      const suggestion = storedSuggestion({
        id,
        made: {
          kind: "name",
          rowId,
          rowNumber: 7,
          from: "",
          to: "Nylon Coil",
          by: suggestedByModel("test/model"),
          confidence: "medium",
          basis: "Name is empty on row 7."
        }
      })
      const stored = suggestionToStored(suggestion)
      expect([stored.rowId, stored.to, stored.by, stored.model, stored.column]).toEqual([
        "row-7",
        "Nylon Coil",
        "model",
        "test/model",
        null
      ])
      expect(suggestionFromStored(stored)).toEqual(O.some(suggestion))
      const change = yield* S.decodeEffect(Change)({ how: "typed", field: "name", from: "", to: "Nylon Coil" })
      expect(changeFromStored(changeToStored(change))).toEqual(change)
    })
  )
})
