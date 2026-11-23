// A workbook can make the reader write thousands of notes (one for each number format it could not show), and an
// upload sends at most `maxNotes`: so staging keeps every warning it can before any information note, and says in one
// more how many it did not keep, as a warning when a warning was among them, so the Review step shows it. What it
// stages is a table the staged schemas accept and an upload may send.
//
// The table is generated from `StagedTable` and given to staging as the reader writes it; the notes are generated from
// the reader's `Note` and `StagedNote`, as many warnings and information notes as drawn, the information notes first
// so a rule that kept the first notes would keep them. The counts are drawn anywhere, at the file's bound, or at the
// warnings' bound. The oracle is the two counts.
import { describe, expect, it } from "@effect/vitest"
import { maxNotes, StagedNote, StagedTable, UploadHead } from "@inventory/catalog-contract/Staged"
import { Note, SpreadsheetTable } from "@inventory/catalog-model/Spreadsheet"
import { stageTable } from "@inventory/catalog-model/Staging"
import * as A from "effect/Array"
import * as Arbitrary from "effect/Arbitrary"
import * as S from "effect/Schema"
import * as Str from "effect/String"

/** This many copies of a note: none for 0 (`A.makeBy` makes one at least). */
const copies = (count: number, note: Note): ReadonlyArray<Note> => (count === 0 ? [] : A.makeBy(count, () => note))

/** The reader's note of this level, saying what a staged note says. */
const readerNote = (note: Note, said: StagedNote, level: Note["level"]): Note => ({
  ...note,
  level,
  message: said.message,
  rows: said.rows
})

/** The reader's table with the staged table's columns and rows, as the reader writes them. */
const readerTable = (table: SpreadsheetTable, staged: StagedTable, notes: ReadonlyArray<Note>): SpreadsheetTable => ({
  ...table,
  fileName: staged.fileName,
  headerRowNumber: staged.headerRowNumber,
  columns: A.map(staged.columns, (column) => ({ ...column, header: column.label })),
  rows: A.map(staged.rows, (row) => ({
    rowNumber: row.rowNumber,
    cells: A.map(row.cells, (cell) => ({ ...cell, type: "text" as const }))
  })),
  notes
})

const Aim = S.Literals(["anywhere", "atTheFilesBound", "atTheWarningsBound"])
const Count = S.Int.check(S.isBetween({ minimum: 0, maximum: 2 * maxNotes }))
const Shift = S.Int.check(S.isBetween({ minimum: -2, maximum: 2 }))

/** How many warnings and information notes the file has, from the draw. */
const countsOf = (
  aim: typeof Aim.Type,
  drawn: { readonly warnings: number; readonly infos: number; readonly shift: number }
): { readonly warnings: number; readonly infos: number } => {
  if (aim === "atTheFilesBound") {
    const total = maxNotes + drawn.shift
    const warnings = Math.min(drawn.warnings, total)
    return { warnings, infos: total - warnings }
  }
  if (aim === "atTheWarningsBound") return { warnings: maxNotes - 1 + drawn.shift, infos: drawn.infos }
  return { warnings: drawn.warnings, infos: drawn.infos }
}

describe("a staged file's notes", () => {
  it.prop(
    "keep the warnings before the information notes, and say how many were not kept",
    [
      Arbitrary.schema(SpreadsheetTable),
      Arbitrary.schema(StagedTable),
      Arbitrary.schema(Note),
      Arbitrary.schema(StagedNote),
      Arbitrary.schema(Aim),
      Arbitrary.schema(Count),
      Arbitrary.schema(Count),
      Arbitrary.schema(Shift)
    ],
    ([table, staged, note, said, aim, drawnWarnings, drawnInfos, shift]) => {
      const { warnings, infos } = countsOf(aim, { warnings: drawnWarnings, infos: drawnInfos, shift })
      const read = [
        ...copies(infos, readerNote(note, said, "info")),
        ...copies(warnings, readerNote(note, said, "warning"))
      ]
      const total = warnings + infos
      const out = stageTable({ table: readerTable(table, staged, read) })

      expect(S.is(StagedTable)(out)).toBe(true)
      const { rows: _rows, ...head } = out
      expect(S.is(UploadHead)(head)).toBe(true)

      expect(out.notes.length).toBe(Math.min(total, maxNotes))
      const levels = A.map(out.notes, (kept) => kept.level)
      if (total <= maxNotes) {
        expect(levels).toEqual(A.map(read, (each) => each.level))
        return
      }
      const room = maxNotes - 1
      const keptWarnings = Math.min(warnings, room)
      const kept = A.take(out.notes, room)
      expect(A.filter(kept, (each) => each.level === "warning").length).toBe(keptWarnings)
      expect(A.filter(kept, (each) => each.level === "info").length).toBe(room - keptWarnings)
      const last = A.lastNonEmpty(A.prepend(out.notes, said))
      expect(last.kind).toBe("notesNotKept")
      expect(last.level).toBe(warnings > room ? "warning" : "info")
      expect(Str.startsWith(`${total - room} more notes`)(last.message)).toBe(true)
    },
    { arbitrary: { runs: 60 } }
  )
})
