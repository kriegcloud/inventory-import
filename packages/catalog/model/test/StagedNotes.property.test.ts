// A workbook can make the reader write thousands of notes (one for each number format it could not show), and a
// staged file holds at most `maxNotes`: so staging keeps the first notes and says in one more how many it did not
// keep, and a file is never refused for its notes. The table and its note are generated from the schemas.
import { describe, expect, it } from "@effect/vitest"
import { maxNotes } from "@inventory/catalog-contract/Staged"
import { Note, SpreadsheetTable } from "@inventory/catalog-model/Spreadsheet"
import { stageTable } from "@inventory/catalog-model/Staging"
import * as A from "effect/Array"
import * as Arbitrary from "effect/Arbitrary"
import * as S from "effect/Schema"
import * as Str from "effect/String"

describe("a staged file's notes", () => {
  it.prop(
    "are all kept when they fit, else the first ones and one more saying how many were not kept",
    [
      Arbitrary.schema(SpreadsheetTable),
      Arbitrary.schema(Note),
      Arbitrary.schema(S.Int.check(S.isBetween({ minimum: 0, maximum: 3 * maxNotes })))
    ],
    ([table, note, count]) => {
      // `A.makeBy` makes one at least, so none is written as none.
      const notes = count === 0 ? [] : A.makeBy(count, () => note)
      const staged = stageTable({ table: { ...table, notes } }).notes
      expect(staged.length).toBe(Math.min(count, maxNotes))
      if (count <= maxNotes) {
        expect(A.map(staged, (kept) => kept.message)).toEqual(A.map(notes, (read) => read.message))
      } else {
        const last = staged[maxNotes - 1]
        expect(last?.kind).toBe("notesNotKept")
        // The notes not kept are the ones past the first maxNotes - 1, counted here from the two lengths.
        expect(Str.startsWith(`${count - (maxNotes - 1)} more notes`)(last?.message ?? "")).toBe(true)
      }
    },
    { arbitrary: { runs: 40 } }
  )
})
