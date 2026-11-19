// The pieces a file travels in: each row in exactly one piece, in order, and a set of pieces that cannot carry the
// rows refused before anything is stored.
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr } from "effect"
import * as S from "effect/Schema"
import { chunkProblem, fitsChunks, uploadChunks } from "../src/Staging/Upload.rules.ts"
import { chunkRows } from "@inventory/catalog-contract/Upload"
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
