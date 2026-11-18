// The CSV reader reads text in pieces so the upload screen can say how far it is. The rule that would hurt if wrong:
// reading in pieces gives exactly the rows, errors and delimiter of reading at once, wherever a piece ends (inside a
// quoted line break, between \r and \n, on a doubled quote). And the progress it reports never passes its total.
import { Array as Arr, Effect } from "effect"
import Papa from "papaparse"
import { describe, expect, it } from "vitest"
import { parseCsv } from "../../src/web/lib/spreadsheet/csv.ts"
import { readSpreadsheet, type ReadProgress } from "../../src/web/lib/spreadsheet/index.ts"
import { progressOf } from "../../src/domain/Upload.ts"

const lines = Arr.makeBy(400, (i) => {
  const name = i % 7 === 0 ? `"Bracket, ${i}"` : i % 11 === 0 ? `"Plate ""${i}"" thick"` : `Bolt ${i}`
  const description = i % 13 === 0 ? `"First line\r\nsecond line ${i}"` : i % 17 === 0 ? `"a\nb"` : "Zinc"
  // A quoted field with text after its closing quote: papaparse keeps it and reports InvalidQuotes for the row.
  const note = i % 97 === 0 ? `"12" long` : ""
  return `SKU-${i},${name},${description},Each,${note}`
})
const text = `SKU,Name,Description,Unit,Note\r\n${Arr.join(lines, "\r\n")}\r\n`

const whole = (input: string) => {
  const parsed = Papa.parse<Array<string>>(input, { delimiter: "", skipEmptyLines: false, header: false })
  return {
    data: parsed.data,
    errors: Arr.map(parsed.errors, (e) => ({ code: e.code, row: e.row })),
    delimiter: parsed.meta.delimiter
  }
}
const inPieces = (input: string, chars: number) => {
  const parsed = parseCsv(input, { chars })
  return {
    data: parsed.data,
    errors: Arr.map(parsed.errors, (e) => ({ code: e.code, row: e.row })),
    delimiter: parsed.delimiter
  }
}

describe("reading CSV text in pieces", () => {
  it("gives the rows, errors and delimiter of reading it at once, wherever the pieces end", () => {
    const expected = whole(text)
    expect(expected.errors.length).toBeGreaterThan(0)
    for (const chars of [5, 37, 64, 255, 1000, 4096, text.length + 1]) expect(inPieces(text, chars)).toEqual(expected)
  })

  it("names the same row for a quote that never closes, near the end of a long file", () => {
    const broken = `${text}SKU-x,"Unclosed name,Zinc,Each,\r\nSKU-y,Bolt,Zinc,Each,\r\n`
    const expected = whole(broken)
    expect(Arr.some(expected.errors, (e) => e.code === "MissingQuotes")).toBe(true)
    for (const chars of [64, 1000, 9999]) expect(inPieces(broken, chars)).toEqual(expected)
  })

  it("detects a semicolon file's delimiter from the first piece", () => {
    const semicolons = `SKU;Name\n${Arr.join(
      Arr.makeBy(200, (i) => `S-${i};"Bolt; ${i}"`),
      "\n"
    )}\n`
    expect(inPieces(semicolons, 50)).toEqual(whole(semicolons))
    expect(inPieces(semicolons, 50).delimiter).toBe(";")
  })

  it("reports progress that rises, ends exact, and never passes its total", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const reports: Array<ReadProgress> = []
        const big = `SKU,Name\n${Arr.join(
          Arr.makeBy(40_000, (i) => `SKU-${i},Bolt ${i}`),
          "\n"
        )}\n`
        const table = yield* readSpreadsheet({
          file: new File([big], "big.csv"),
          onProgress: (progress) => reports.push(progress)
        })
        expect(table.rows.length).toBe(40_000)
        expect(reports.length).toBeGreaterThan(1)
        for (const [before, after] of Arr.zip(reports, reports.slice(1))) {
          expect(after.rowsRead).toBeGreaterThanOrEqual(before.rowsRead)
        }
        for (const report of reports) {
          const { done, total } = progressOf({ state: { _tag: "Reading", fileName: "big.csv", ...report } })
          expect(done).toBeLessThanOrEqual(total ?? Infinity)
        }
        // Rows of the file: the heading and 40,000 rows, not the empty record after the last line break.
        const last = reports[reports.length - 1]
        expect(last).toEqual({ rowsRead: 40_001, rowsAbout: 40_001, exact: true })
      })
    ))
})
