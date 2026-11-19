// What is stored keeps its bytes. Each value below is a column as the local database held it after the messy sample
// was imported (captured, not written by hand): decoded through today's schema and encoded again, it is the same
// text, so no stored row needs rewriting.
import { describe, expect, it } from "@effect/vitest"
import { RowDecision } from "@inventory/catalog-contract/Decision"
import { discontinuedOn, isActive, Stocking, stockingOf } from "@inventory/catalog-contract/Item"
import { MappingChoice } from "@inventory/catalog-contract/Mapping"
import { StagedHead, StagedRow } from "@inventory/catalog-contract/Staged"
import { Effect } from "effect"
import * as O from "effect/Option"
import * as S from "effect/Schema"

const sameBytes = <A, I extends string>(codec: S.Codec<A, I>, stored: I) =>
  Effect.map(Effect.flatMap(S.decodeEffect(codec)(stored), S.encodeEffect(codec)), (again) => {
    expect(again).toBe(stored)
  })

const headJson =
  '{"fileName":"items_messy_min_level.csv","kind":"csv","sheet":null,"headerRowNumber":1,"columns":[{"index":0,"letter":"A","label":"Item Name"},{"index":1,"letter":"B","label":"Reorder Pt"},{"index":2,"letter":"C","label":"SKU"}],"notes":[{"kind":"headerSpaces","level":"info","message":"1 column name has spaces at the start or end (\\"SKU \\"); kept as found.","rows":[1]},{"kind":"blankRows","level":"info","message":"Skipped 1 blank row: row 123.","rows":[123]}]}'
const rowJson =
  '{"rowNumber":2,"cells":[{"text":"Fiberglass Crate"},{"text":""},{"text":"XRR-0266"},{"text":"false"},{"text":"2025-02-26"},{"text":"2024-01-03"},{"text":"3911"},{"text":"fragile"},{"text":"BX"},{"text":"packaging"},{"text":"Fiberglass crate, general purpose"},{"text":"4.58"}]}'

describe("stored JSON", () => {
  it.effect("a decision, the column choices, a file's head and a staged row decode and encode to the same bytes", () =>
    Effect.gen(function* () {
      yield* sameBytes(S.fromJsonString(RowDecision), '{"accepted":["quantityOnHand"]}')
      yield* sameBytes(S.fromJsonString(RowDecision), '{"out":true}')
      yield* sameBytes(
        MappingChoice.pipe(S.Array, S.fromJsonString),
        '[{"field":"reorderPoint","column":1,"by":"person"}]'
      )
      yield* sameBytes(S.fromJsonString(StagedHead), headJson)
      yield* sameBytes(S.fromJsonString(StagedRow), rowJson)
    })
  )
})

describe("stocking", () => {
  it.effect("is what the two stored columns say, and says them back; active with a day has no way to be written", () =>
    Effect.gen(function* () {
      const pairs = [
        { isActive: true, discontinuedOn: O.none<string>(), kind: "active" },
        { isActive: false, discontinuedOn: O.none<string>(), kind: "inactive" },
        { isActive: false, discontinuedOn: O.some("2025-02-26"), kind: "discontinued" }
      ]
      for (const pair of pairs) {
        const stocking = stockingOf(pair)
        expect([stocking.kind, isActive(stocking), discontinuedOn(stocking)]).toEqual([
          pair.kind,
          pair.isActive,
          pair.discontinuedOn
        ])
      }
      // The pair the table's CHECK refuses: on the wire the day is dropped with the case that cannot hold it, and a
      // discontinued item with no day is refused.
      const activeWithDay = yield* S.decodeUnknownEffect(Stocking)({ kind: "active", on: "2025-02-26" })
      const written = yield* S.encodeEffect(Stocking)(activeWithDay)
      expect(written).toEqual({ kind: "active" })
      const noDay = yield* Effect.isFailure(S.decodeUnknownEffect(Stocking)({ kind: "discontinued" }))
      expect(noDay).toBe(true)
    })
  )
})
