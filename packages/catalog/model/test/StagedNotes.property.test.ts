// A workbook can make the reader write thousands of notes (one for each number format Excel shows another way), and an
// upload sends at most `maxNotes`: so staging keeps every note when they fit, and past it the warnings first, then
// every other information note (called layout notes here: rows above the heading, blank rows), then the number-format
// notes, and says in one more how many it did not keep, as
// a warning when a warning was among them, so the Review step shows it. What it stages is a table the staged schemas
// accept and an upload may send.
//
// The table is generated from `StagedTable` and given to staging as the reader writes it. Its notes are drawn from the
// reader's `NoteKind` and a message, each note told apart from every other by its message and its row, in three tiers
// written in the reverse of the order they are kept: number-format notes, then layout notes, then warnings, the first
// of which is a total row naming generated rows. The counts are drawn anywhere, at the file's bound with every tier
// there or with only one, or at the warnings' bound. The oracle is the three lists, compared whole.
import { describe, expect, it } from "@effect/vitest"
import { maxNotes, maxRowNumber, StagedNote, StagedTable, UploadHead } from "@inventory/catalog-contract/Staged"
import { Note, NoteKind, SpreadsheetTable } from "@inventory/catalog-model/Spreadsheet"
import { stageTable } from "@inventory/catalog-model/Staging"
import * as A from "effect/Array"
import * as Arbitrary from "effect/Arbitrary"
import * as O from "effect/Option"
import * as S from "effect/Schema"

const LayoutKind = NoteKind.check(
  S.makeFilter((kind: string) => kind !== "formatNotShown", { expected: "a kind of note other than a number format's" })
)
const LayoutKinds = S.NonEmptyArray(LayoutKind)
const Message = S.String.check(S.isMinLength(1), S.isMaxLength(200))
const Tier = S.Literals(["warning", "layout", "format"])
const Aim = S.Literals(["anywhere", "atTheFilesBound", "oneTierAtTheFilesBound", "atTheWarningsBound"])
const Count = S.Int.check(S.isBetween({ minimum: 0, maximum: 2 * maxNotes }))
const Shift = S.Int.check(S.isBetween({ minimum: -1, maximum: 1 }))

// How many notes of each tier a file has.
const Counts = S.Struct({ warning: Count, layout: Count, format: Count })
type Counts = typeof Counts.Type

/** How many notes of each tier the file has, from the draw. */
const countsOf = (aim: typeof Aim.Type, drawn: Counts, shift: number, only: typeof Tier.Type): Counts => {
  const bound = maxNotes + shift
  if (aim === "atTheFilesBound") {
    const warning = Math.min(drawn.warning, bound)
    const layout = Math.min(drawn.layout, bound - warning)
    return { warning, layout, format: bound - warning - layout }
  }
  if (aim === "oneTierAtTheFilesBound") {
    return {
      warning: only === "warning" ? bound : 0,
      layout: only === "layout" ? bound : 0,
      format: only === "format" ? bound : 0
    }
  }
  if (aim === "atTheWarningsBound") return { ...drawn, warning: maxNotes - 1 + shift }
  return drawn
}

/** `count` notes of one tier, each with a message and a row of its own. */
const tier = (
  count: number,
  make: (n: number) => Omit<Note, "message" | "rows">,
  message: string
): ReadonlyArray<Note> =>
  count === 0
    ? []
    : A.makeBy(count, (n) => ({
        ...make(n),
        message: `${message} ${make(n).kind} ${n}`,
        rows: [(n % maxRowNumber) + 1]
      }))

describe("a staged file's notes", () => {
  it.prop(
    "are all kept when they fit, else the warnings, the layout notes and the number-format notes in that order",
    [
      Arbitrary.schema(SpreadsheetTable),
      Arbitrary.schema(StagedTable),
      Arbitrary.schema(LayoutKinds),
      Arbitrary.schema(Message),
      Arbitrary.schema(StagedNote.fields.rows),
      Arbitrary.schema(Aim),
      Arbitrary.schema(Counts),
      Arbitrary.schema(Shift),
      Arbitrary.schema(Tier)
    ],
    ([table, staged, kinds, message, totalRows, aim, drawn, shift, only]) => {
      const counts = countsOf(aim, drawn, shift, only)
      const kindAt = (n: number): typeof LayoutKind.Type =>
        O.getOrElse(A.get(kinds, n % kinds.length), () => A.headNonEmpty(kinds))
      const warnings: ReadonlyArray<Note> = A.map(
        tier(counts.warning, (n) => ({ kind: kindAt(n), level: "warning" }), message),
        // The first warning is a total row, naming its rows: the review reads them.
        (note, n) => (n === 0 ? { ...note, kind: "totalRow", rows: totalRows } : note)
      )
      const layouts = tier(counts.layout, (n) => ({ kind: kindAt(n), level: "info" }), message)
      const formats = tier(counts.format, () => ({ kind: "formatNotShown", level: "info" }), message)
      const read = [...formats, ...layouts, ...warnings]
      const out = stageTable({
        table: {
          ...table,
          fileName: staged.fileName,
          headerRowNumber: staged.headerRowNumber,
          columns: A.map(staged.columns, (column) => ({ ...column, header: column.label })),
          rows: A.map(staged.rows, (row) => ({
            rowNumber: row.rowNumber,
            cells: A.map(row.cells, (cell) => ({ ...cell, type: "text" as const }))
          })),
          notes: read
        }
      })

      expect(S.is(StagedTable)(out)).toBe(true)
      const { rows: _rows, ...head } = out
      expect(S.is(UploadHead)(head)).toBe(true)

      if (read.length <= maxNotes) {
        expect(out.notes).toEqual(read)
        return
      }
      const room = maxNotes - 1
      const kept = A.take([...warnings, ...layouts, ...formats], room)
      expect(A.take(out.notes, room)).toEqual(kept)
      // A total row's warning is kept with every row it names.
      if (counts.warning > 0) {
        expect(A.map(A.take(out.notes, 1), (note) => [note.kind, note.rows])).toEqual([["totalRow", totalRows]])
      }
      expect(out.notes.length).toBe(maxNotes)
      const warningsLeft = Math.max(counts.warning - room, 0)
      const summary = A.takeRight(out.notes, 1)
      expect(A.map(summary, (note) => [note.kind, note.level])).toEqual([
        ["notesNotKept", warningsLeft > 0 ? "warning" : "info"]
      ])
      for (const note of summary) {
        // The two numbers it says, read out of its sentence: the notes not kept, and the warnings among them.
        const said = (pattern: RegExp) =>
          O.map(O.fromNullishOr(pattern.exec(note.message)), (found) => Number(found[1]))
        expect(said(/^(\d+) more notes/)).toEqual(O.some(read.length - room))
        expect(said(/, (\d+) of them warnings:/)).toEqual(warningsLeft > 0 ? O.some(warningsLeft) : O.none())
      }
    },
    { arbitrary: { runs: 80 } }
  )
})
