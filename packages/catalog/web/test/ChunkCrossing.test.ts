// The reader worker hands the page each chunk of rows by postMessage, a structured clone, which keeps an Option's
// fields and loses what makes it an Option. The rule that would hurt if wrong: every upload fails with "The file was
// not saved". So a chunk crosses in the wire's form and the page decodes it; this holds that the round trip gives the
// rows back, and that a decoded chunk sent as it is does not survive.
import { assertSome, deepStrictEqual } from "@effect/vitest/utils"
import { describe, expect, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as O from "effect/Option"
import * as S from "effect/Schema"
import { StagedRow } from "@inventory/catalog-contract/Staged"

const Chunk = S.Array(StagedRow)

// Row 2 of an Excel file whose date cell shows a formatted day, and row 3 of plain cells.
const rows: ReadonlyArray<StagedRow> = [
  {
    rowNumber: 2,
    cells: [
      { text: "BLT-0042", shown: O.none() },
      { text: "45306", shown: O.some("2024-01-15") }
    ]
  },
  { rowNumber: 3, cells: [{ text: "NUT-0007", shown: O.none() }] }
]

describe("a chunk of rows crossing from the reader to the page", () => {
  it.effect("decodes to the same rows after the copy, when it crosses in the wire's form", () =>
    Effect.gen(function* () {
      const encoded = S.encodeOption(Chunk)(rows)
      assertSome(
        O.map(encoded, (wire) => wire.length),
        2
      )
      const wire = O.getOrThrow(encoded)
      const crossed = yield* S.decodeEffect(Chunk)(structuredClone(wire))
      deepStrictEqual(crossed, rows)
    })
  )

  it.effect("is refused by the wire when the decoded rows cross as they are", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(S.encodeUnknownEffect(Chunk)(structuredClone(rows)))
      expect(Exit.isFailure(exit)).toBe(true)
    })
  )
})
