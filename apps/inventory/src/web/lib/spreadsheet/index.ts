// The one door to the spreadsheet reader. Importing this costs the first page load nothing: the reader, papaparse
// and SheetJS are separate chunks fetched when a file is chosen. Import types from the domain, values from here.
// The upload screen calls it inside a worker (src/web/lib/upload), so the read never holds up the page.
import { Effect } from "effect"
import type { FileProblem } from "../../../domain/FileProblem.ts"
import type { SpreadsheetTable } from "../../../domain/Spreadsheet.ts"
import type { ReadSpreadsheetInput } from "./read.ts"

export type { ReadProgress, ReadSpreadsheetInput } from "./read.ts"

/**
 * Reads a chosen .csv or .xlsx into one table, or fails with a `FileProblem`: what is wrong with the file and what
 * to do, for the person. Pass `sheet` when the person picks another sheet of the same workbook.
 */
export const readSpreadsheet = (input: ReadSpreadsheetInput): Effect.Effect<SpreadsheetTable, FileProblem> =>
  Effect.flatMap(
    Effect.promise(() => import("./read.ts")),
    (reader) => reader.readSpreadsheet(input)
  )
