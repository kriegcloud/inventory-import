// What the upload screen says about how far it is. The rule that would hurt most if wrong: the screen never says more
// rows are done than there are ("Saving 51,000 of 50,000 rows"), whatever the estimate did and however often a piece
// was sent again.
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr } from "effect"
import * as S from "effect/Schema"
import {
  chunkProblem,
  chunkRows,
  fitsChunks,
  progressOf,
  rowsAbout,
  savedRows,
  type UploadState,
  uploadChunks
} from "../../src/domain/Upload.ts"

const reading = (rowsRead: number, about: number | null): UploadState => ({
  _tag: "Reading",
  fileName: "items.csv",
  rowsRead,
  rowsAbout: about,
  exact: false
})

describe("progress", () => {
  const Count = S.Int.check(S.isBetween({ minimum: 0, maximum: 120_000 }))

  it.prop(
    "never reports more rows done than the total while reading, whatever the estimate",
    { read: Count, about: S.NullOr(Count) },
    ({ read, about }) => {
      const { done, total } = progressOf({ state: reading(read, about) })
      expect(done).toBe(read)
      if (total !== null) expect(done).toBeLessThanOrEqual(total)
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
        state: { _tag: "Saving", fileName: "items.csv", uploadId: "u", rowsSaved: saved, rows }
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
      expect(done).toBeLessThanOrEqual(shown ?? 0)
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
      const rows = Arr.reduce(sizes, 0, (a, b) => a + b)
      const seen = Arr.filter(acknowledged, (seq) => seq < sizes.length)
      expect(savedRows({ chunkSizes: sizes, acknowledged: seen })).toBeLessThanOrEqual(rows)
      // Every piece acknowledged, in any order and any number of times: exactly the file's rows.
      const all = [...seen, ...Arr.makeBy(sizes.length, (seq) => seq)]
      expect(savedRows({ chunkSizes: sizes, acknowledged: all })).toBe(rows)
    }
  )

  it("shows a workbook that is still opening as having no total yet", () => {
    expect(progressOf({ state: reading(0, null) })).toEqual({ done: 0, total: null })
  })
})

describe("pieces", () => {
  const rows = Arr.makeBy(1_201, (i) => ({ rowNumber: i + 2, cells: [{ text: `SKU-${i}` }] }))

  it.prop(
    "splits any file into pieces of at most 500, in order, losing none, that the server accepts as a whole",
    { count: S.Int.check(S.isBetween({ minimum: 1, maximum: 3_000 })) },
    ({ count }) => {
      const file = Arr.makeBy(count, (i) => ({ rowNumber: i + 2, cells: [{ text: `SKU-${i}` }] }))
      const pieces = uploadChunks({ rows: file })
      expect(Arr.every(pieces, (piece) => piece.length >= 1 && piece.length <= chunkRows)).toBe(true)
      expect(Arr.flatten(pieces)).toEqual(file)
      expect(fitsChunks({ rowCount: count, chunkCount: pieces.length })).toBe(true)
      const chunks = Arr.map(pieces, (piece, seq) => ({ seq, rows: piece }))
      const check = (sent: typeof chunks) =>
        chunkProblem({ fileName: "items.csv", rowCount: count, chunkCount: pieces.length, chunks: sent })
      expect(check(chunks)).toBeNull()
      // Any one piece missing: the server says so instead of importing part of the file.
      if (chunks.length > 1) expect(check(Arr.drop(chunks, 1))).not.toBeNull()
    }
  )

  it("splits 1,201 rows into 500, 500 and 201, and refuses a count of pieces that cannot carry them", () => {
    const pieces = uploadChunks({ rows })
    expect(Arr.map(pieces, (piece) => piece.length)).toEqual([chunkRows, chunkRows, 201])
    expect(fitsChunks({ rowCount: rows.length, chunkCount: 2 })).toBe(false)
    expect(fitsChunks({ rowCount: rows.length, chunkCount: 0 })).toBe(false)
  })

  it("accepts every piece once and in order, and refuses a missing, repeated or overlapping piece", () => {
    const pieces = Arr.map(uploadChunks({ rows }), (piece, seq) => ({ seq, rows: piece }))
    const check = (chunks: typeof pieces) =>
      chunkProblem({ fileName: "items.csv", rowCount: rows.length, chunkCount: 3, chunks })
    expect(check(pieces)).toBeNull()
    expect(check(pieces.slice(0, 2))).toMatchObject({
      kind: "incomplete",
      problem: 'Part of "items.csv" did not reach the server.',
      todo: "Choose the file again."
    })
    const [first, second, third] = pieces
    if (first === undefined || second === undefined || third === undefined) throw new Error("three pieces")
    expect(check([first, first, third])).not.toBeNull()
    // The second piece carries rows of the first again: the count adds up, the order does not.
    const overlapping = { seq: 1, rows: [...first.rows.slice(-1), ...second.rows.slice(0, -1)] }
    expect(check([first, overlapping, third])).toMatchObject({
      kind: "incomplete",
      problem: 'The rows of "items.csv" arrived out of order.'
    })
  })
})
