// What the upload screen says about how far it is. The rule that would hurt most if wrong: the screen never says more
// rows are done than there are ("Saving 51,000 of 50,000 rows"), whatever the estimate did and however often a piece
// was sent again.
import { describe, expect, it } from "@effect/vitest"
import { ImportId } from "@inventory/catalog-contract/Ids"
import { rowsAbout, savedRows } from "@inventory/catalog-model/Upload"
import { progressOf, rowsOf, UploadState } from "@inventory/catalog-web/UploadMachine"
import * as A from "effect/Array"
import * as O from "effect/Option"
import * as S from "effect/Schema"
import { chunkRows } from "@inventory/catalog-contract/Upload"

const reading = (rowsRead: number, about: number | null): UploadState =>
  UploadState.cases.Reading.make({
    fileName: "items.csv",
    rowsRead,
    rows: rowsOf({ rowsAbout: about, exact: false })
  })

describe("progress", () => {
  const Count = S.Int.check(S.isBetween({ minimum: 0, maximum: 120_000 }))

  it.prop(
    "never reports more rows done than the total while reading, whatever the estimate",
    { read: Count, about: S.NullOr(Count) },
    ({ read, about }) => {
      const { done, total } = progressOf({ state: reading(read, about) })
      expect(done).toBe(read)
      O.match(O.fromNullOr(total), {
        onNone: () => {},
        onSome: (total) => expect(done).toBeLessThanOrEqual(total)
      })
    }
  )

  it.prop(
    "never reports less than none or more than the file while saving",
    {
      // A count from a piece sent twice or an answer out of order can be anything, below zero included.
      saved: S.Int.check(S.isBetween({ minimum: -1_000, maximum: 120_000 })),
      rows: S.Int.check(S.isBetween({ minimum: 1, maximum: 50_000 }))
    },
    ({ saved, rows }) => {
      const { done, total } = progressOf({
        state: UploadState.cases.Saving.make({
          fileName: "items.csv",
          uploadId: ImportId.make("00000000-0000-4000-8000-000000000001"),
          rowsSaved: saved,
          rows
        })
      })
      expect(total).toBe(rows)
      expect(done).toBeGreaterThanOrEqual(0)
      expect(done).toBeLessThanOrEqual(rows)
    }
  )

  it("follows a CSV whose first pieces are shorter than its last, without passing the total", () => {
    // Short rows first make the estimate too low; it rises with the rows read and ends at the count.
    const total = 4_000_000
    let rows = 0
    for (let chars = 250_000; chars <= total; chars += 250_000) {
      rows += chars <= 1_000_000 ? 6_000 : 2_500
      const about = rowsAbout({ rowsRead: rows, charsRead: chars, charsTotal: total })
      const { done, total: shown } = progressOf({ state: reading(rows, about) })
      expect(shown).not.toBeNull()
      O.match(O.fromNullOr(shown), {
        onNone: () => expect.fail("Expected the CSV row total"),
        onSome: (total) => expect(done).toBeLessThanOrEqual(total)
      })
    }
    expect(rowsAbout({ rowsRead: rows, charsRead: total, charsTotal: total })).toBe(rows)
  })

  it.prop(
    "counts a piece sent again once, so saved rows never pass the file's rows",
    {
      sizes: S.Array(S.Int.check(S.isBetween({ minimum: 1, maximum: chunkRows }))).check(
        S.isMinLength(1),
        S.isMaxLength(12)
      ),
      acknowledged: S.Array(S.Int.check(S.isBetween({ minimum: 0, maximum: 11 }))).check(S.isMaxLength(40))
    },
    ({ sizes, acknowledged }) => {
      const rows = A.reduce(sizes, 0, (a, b) => a + b)
      const seen = A.filter(acknowledged, (seq) => seq < sizes.length)
      expect(savedRows({ chunkSizes: sizes, acknowledged: seen })).toBeLessThanOrEqual(rows)
      // Every piece acknowledged, in any order and any number of times: exactly the file's rows.
      const all = [...seen, ...A.makeBy(sizes.length, (seq) => seq)]
      expect(savedRows({ chunkSizes: sizes, acknowledged: all })).toBe(rows)
    }
  )

  it("shows a workbook that is still opening as having no total yet", () => {
    expect(progressOf({ state: reading(0, null) })).toEqual({ done: 0, total: null })
  })
})
