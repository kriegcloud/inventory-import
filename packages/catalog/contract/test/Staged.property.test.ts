// A staged file is what a browser sends before any review runs, so its schema is the one wall between a request and
// the review: every row it admits has a row id, every row a note names is a row Excel could show, and the counts an
// upload announces are ones the browser's own chunking produces. All data here is generated from the schemas.
import { describe, expect, it } from "@effect/vitest"
import { rowId } from "@inventory/catalog-contract/Decision"
import {
  lastColumnIndex,
  maxColumns,
  maxNotes,
  maxStagedRows,
  StagedHead,
  StagedNote,
  StagedRow
} from "@inventory/catalog-contract/Staged"
import { chunkRows, UploadChunk, UploadStart } from "@inventory/catalog-contract/Upload"
import { MAX_COLUMN } from "@beep/xlsx/XlsxAddress"
import * as A from "effect/Array"
import * as Arbitrary from "effect/Arbitrary"
import * as S from "effect/Schema"

const runs = { arbitrary: { runs: 200 } }

describe("a staged row", () => {
  it.prop(
    "is numbered as Excel numbers it, so its row id names it and reads back its number",
    [Arbitrary.schema(StagedRow)],
    ([row]) => {
      const id = rowId({ rowNumber: row.rowNumber })
      expect(id).toBe(`row-${row.rowNumber}`)
      expect(row.rowNumber).toBeGreaterThanOrEqual(1)
    },
    runs
  )

  it.prop(
    "has no more cells than a staged file may have columns",
    [Arbitrary.schema(StagedRow)],
    ([row]) => {
      expect(row.cells.length).toBeLessThanOrEqual(maxColumns)
    },
    runs
  )
})

describe("a staged head", () => {
  it.prop(
    "names its heading row and every row of its notes by a number a row id can carry",
    [Arbitrary.schema(StagedHead)],
    ([head]) => {
      const numbers = [head.headerRowNumber, ...A.flatMap(head.notes, (note) => note.rows)]
      for (const n of numbers) expect(rowId({ rowNumber: n })).toBe(`row-${n}`)
    },
    runs
  )

  it.prop(
    "has between one and the most columns a file may have, each where Excel can put one",
    [Arbitrary.schema(StagedHead)],
    ([head]) => {
      expect(head.columns.length).toBeGreaterThanOrEqual(1)
      expect(head.columns.length).toBeLessThanOrEqual(maxColumns)
      for (const column of head.columns) {
        // XFD, Excel's last column as the workbook reader bounds it; its letters are one to three capitals.
        expect(column.index).toBeGreaterThanOrEqual(0)
        expect(column.index).toBeLessThanOrEqual(lastColumnIndex)
        expect(lastColumnIndex).toBe(MAX_COLUMN)
        expect(column.letter).toMatch(/^[A-Z]{1,3}$/)
      }
    },
    runs
  )

  it.prop(
    "says something in every note, of a kind named as the reader names them",
    [Arbitrary.schema(StagedHead)],
    ([head]) => {
      for (const note of head.notes) {
        expect(note.message.length).toBeGreaterThan(0)
        expect(note.kind).toMatch(/^[a-z][A-Za-z0-9]*$/)
      }
    },
    runs
  )
})

describe("a staged head's notes", () => {
  it.prop(
    "are refused past the most a file may carry, and a note naming more rows than an import stages is refused",
    [Arbitrary.schema(StagedHead), Arbitrary.schema(StagedNote)],
    ([head, note]) => {
      const notes = A.makeBy(maxNotes - head.notes.length + 1, () => note)
      expect(S.is(StagedHead)({ ...head, notes: [...head.notes, ...notes] })).toBe(false)
      // The rows of the file, numbered from 1, one more than an import stages.
      const rows = A.makeBy(maxStagedRows + 1, (n) => n + 1)
      expect(S.is(StagedNote)({ ...note, rows })).toBe(false)
      expect(S.is(StagedNote)({ ...note, rows: A.take(rows, maxStagedRows) })).toBe(true)
    },
    { arbitrary: { runs: 20 } }
  )
})

describe("the start of an upload", () => {
  it.prop(
    "announces at least one row and no more than an import stages",
    [Arbitrary.schema(UploadStart)],
    ([start]) => {
      expect(start.rowCount).toBeGreaterThanOrEqual(1)
      expect(start.rowCount).toBeLessThanOrEqual(maxStagedRows)
      expect(start.chunkCount).toBeGreaterThanOrEqual(1)
    },
    runs
  )

  it.prop(
    "is refused when its pieces cannot carry its rows: one piece more than rows, or one fewer than they need",
    [Arbitrary.schema(UploadStart)],
    ([start]) => {
      expect(start.chunkCount).toBeLessThanOrEqual(start.rowCount)
      expect(start.chunkCount * chunkRows).toBeGreaterThanOrEqual(start.rowCount)
      expect(S.is(UploadStart)({ ...start, chunkCount: start.rowCount + 1 })).toBe(false)
      const fewest = Math.ceil(start.rowCount / chunkRows)
      if (fewest > 1) expect(S.is(UploadStart)({ ...start, chunkCount: fewest - 1 })).toBe(false)
    },
    runs
  )

  it.prop(
    "accepts the pieces the browser cuts its rows into, and numbers every piece the chunk accepts",
    [Arbitrary.schema(UploadStart)],
    ([start]) => {
      // The browser cuts the rows into pieces of `chunkRows`: that many pieces is always a count a start may announce.
      const pieces = Math.ceil(start.rowCount / chunkRows)
      expect(S.is(UploadStart)({ ...start, chunkCount: pieces })).toBe(true)
      const lastSeq = UploadChunk.fields.seq
      expect(S.is(lastSeq)(start.chunkCount - 1)).toBe(true)
      expect(S.is(lastSeq)(start.chunkCount)).toBe(start.chunkCount < maxStagedRows)
    },
    runs
  )
})
