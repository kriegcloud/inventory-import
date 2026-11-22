// The CSV reader reads text in pieces so the upload screen can say how far it is. The rule that would hurt if wrong:
// reading in pieces gives exactly the rows, Notes and delimiter of reading at once, wherever a piece ends (inside a
// quoted line break, between \r and \n, on a doubled quote; csvDifferential.test.ts proves that over the corpus). And
// the progress it reports never passes its total.
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import { describe, expect, it } from "vitest"
import { readSpreadsheet, type ReadProgress } from "@inventory/catalog-web/Spreadsheet"
import { progressOf, rowsOf, UploadState } from "@inventory/catalog-web/UploadMachine"

describe("reading CSV text in pieces", () => {
  it("reports progress that rises, ends exact, and never passes its total", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const reports: Array<ReadProgress> = []
        const big = `SKU,Name\n${A.join(
          A.makeBy(40_000, (i) => `SKU-${i},Bolt ${i}`),
          "\n"
        )}\n`
        const table = yield* readSpreadsheet({
          file: new File([big], "big.csv"),
          onProgress: (progress) => reports.push(progress)
        })
        expect(table.rows.length).toBe(40_000)
        expect(reports.length).toBeGreaterThan(1)
        for (const [before, after] of A.zip(reports, reports.slice(1))) {
          expect(after.rowsRead).toBeGreaterThanOrEqual(before.rowsRead)
        }
        for (const report of reports) {
          const { done, total } = progressOf({
            state: UploadState.cases.Reading.make({
              fileName: "big.csv",
              rowsRead: report.rowsRead,
              rows: rowsOf(report)
            })
          })
          expect(done).toBeLessThanOrEqual(total ?? Infinity)
        }
        // Rows of the file: the heading and 40,000 rows, not the empty record after the last line break.
        const last = reports[reports.length - 1]
        expect(last).toEqual({ rowsRead: 40_001, rowsAbout: 40_001, exact: true })
      })
    ))
})
