import { expect, it } from "@effect/vitest"
import sheets from "./fixtures/spreadsheet/sheets.xlsx?url&inline"
import { readBytes } from "./support/fixture.ts"

it("loads the same 8220 bytes Node read before the loader changed", () => {
  const bytes = readBytes(new URL("./fixtures/spreadsheet/sheets.xlsx", import.meta.url))
  expect(sheets).toContain(";base64,")
  expect(bytes.byteLength).toBe(8220)
})
