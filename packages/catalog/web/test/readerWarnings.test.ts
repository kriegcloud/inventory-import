import * as O from "effect/Option"
// Which of the reader's Notes the Review step shows above the table before the person imports: the warnings, from a
// workbook and from a CSV alike, and never a Note that only says how the file was read.
import { describe, expect, it } from "@effect/vitest"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import { readerWarnings, stageTable } from "@inventory/catalog-model/Staging"
import { readSpreadsheet } from "@inventory/catalog-web/Spreadsheet"
import { built } from "./xlsxCorpus.ts"

const text = (ref: string) => (value: string) => `<c r="${ref}" t="inlineStr"><is><t>${value}</t></is></c>`
const row = (r: number, cells: string) =>
  `<row r="${r}">${text(`A${r}`)(r === 1 ? "SKU" : `ABC-100${r}`)}${text(`B${r}`)(r === 1 ? "Name" : "Bolt")}${cells}</row>`
const sheetOf = (rows: string) =>
  `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows}</sheetData></worksheet>`
const heading = row(1, `${text("C1")("Quantity")}${text("D1")("Bay")}`)
const staged = (file: File) =>
  Effect.map(readSpreadsheet({ onProgress: () => {}, sheet: O.none(), file }), (table) => stageTable({ table }))
const kinds = (notes: ReadonlyArray<{ readonly kind: string }>) => A.map(notes, (note) => note.kind)

describe("the reader's warnings shown on the Review step", () => {
  it.effect("a cell a workbook gets wrong is a warning that names the cell; a format that is not shown is not", () =>
    Effect.gen(function* () {
      const rows =
        row(2, `<c r="C2" s="1"><v>4</v></c><c r="D2" t="s"><v>900</v></c>`) + row(3, `<c r="C3" s="1"><v>5</v></c>`)
      const bytes = yield* built({ sheet: sheetOf(heading + rows), codes: ["# ?/?"] })
      const table = yield* staged(new File([bytes as Uint8Array<ArrayBuffer>], "stock.xlsx"))
      expect(kinds(table.notes)).toEqual(["unreadableCells", "formatNotShown"])
      const warnings = readerWarnings(table)
      expect(kinds(warnings)).toEqual(["unreadableCells"])
      expect(warnings[0]?.message).toContain("1 cell could not be read and was left empty: D2.")
      expect(warnings[0]?.rows).toEqual([2])
    })
  )

  it.effect("a CSV that is not UTF-8 is a warning that names the row; its delimiter is not", () =>
    Effect.gen(function* () {
      // "Café" as Excel's "CSV (Comma delimited)" writes it: one byte, 0xE9, which is not UTF-8.
      const head = new TextEncoder().encode("SKU;Name;Quantity\nABC-1001;Caf")
      const tail = new TextEncoder().encode(" bolt;4\nABC-1002;Nut;5\n")
      const table = yield* staged(new File([head, new Uint8Array([0xe9]), tail], "stock.csv"))
      expect(kinds(table.notes)).toEqual(["delimiter", "notUtf8"])
      const warnings = readerWarnings(table)
      expect(kinds(warnings)).toEqual(["notUtf8"])
      expect(warnings[0]?.rows).toEqual([2])
    })
  )

  it.effect("a file read at its word has none", () =>
    Effect.gen(function* () {
      const table = yield* staged(new File(["SKU,Name,Quantity\nABC-1001,Bolt,4\n"], "stock.csv"))
      expect(readerWarnings(table)).toEqual([])
    })
  )
})
