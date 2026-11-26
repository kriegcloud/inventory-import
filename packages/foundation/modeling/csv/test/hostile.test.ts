// Hostile input fails typed, with its finding and position, never as a defect or a stack overflow.
import { describe, expect, it } from "@effect/vitest"
import { assertTrue } from "@effect/vitest/utils"
import * as Result from "effect/Result"
import * as Str from "effect/String"
import { Csv } from "@beep/csv/Csv"
import { CsvLimits, CsvReadOptions } from "@beep/csv/CsvOptions"

const firstFinding = (text: string, options: CsvReadOptions) => {
  const read = Csv.parseResult(text, options)
  const readExpected = Result.isFailure(read)
  assertTrue(readExpected)
  return read.failure.diagnostics[0].finding
}

describe("hostile input", () => {
  it("a 20 MiB cell passes the field-length cap", () => {
    const finding = firstFinding(`a,${Str.repeat(20 * 1024 * 1024)("x")}\n`, CsvReadOptions.default)
    expect(finding).toMatchObject({ kind: "LimitExceeded", limit: "fieldLength" })
  })
  it("100,001 records under a cap of 100,000", () => {
    const options = CsvReadOptions.make({ limits: CsvLimits.make({ maxRecords: 100_000 }) })
    const finding = firstFinding(Str.repeat(100_001)("a,b\n"), options)
    expect(finding).toMatchObject({ kind: "LimitExceeded", limit: "records", maximum: 100_000 })
  })
  it("an unclosed quote at the start of a large file names where it opened", () => {
    const finding = firstFinding(`"${Str.repeat(200_000)("a,b\n")}`, CsvReadOptions.default)
    expect(finding).toMatchObject({ kind: "UnterminatedQuote", record: 0, field: 0, at: { offset: 0, line: 0 } })
  })
  it("a record of 100,001 cells", () => {
    const finding = firstFinding(`${Str.repeat(100_000)(",")}\n`, CsvReadOptions.default)
    expect(finding).toMatchObject({ kind: "LimitExceeded", limit: "fieldsPerRecord" })
  })
})
