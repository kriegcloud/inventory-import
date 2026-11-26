// The parity comparison and intentional snapshot recorder share every workbook and sheet case.
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import { identity } from "effect/Function"
import * as O from "effect/Option"
import * as R from "effect/Record"
import { builtCases, fixtureNames, type XlsxCase } from "./xlsxCorpus.ts"

/** The sheets of each fixture, as the fixtures hold them: every one is a case of its own. */
const sheetsOf: { readonly [name: string]: ReadonlyArray<string> } = {
  "date-1904.xlsx": ["Sheet1"],
  "empty.xlsx": ["Sheet1"],
  "libreoffice.xlsx": ["items"],
  "messy.xlsx": ["Stock"],
  "no-header.xlsx": ["Sheet1"],
  "sheets.xlsx": ["Read me", "Empty", "Items", "Lookup", "Old prices", "Bay 2"]
}

export const xlsxParityCases = (bytesOf: (name: string) => Uint8Array): ReadonlyArray<XlsxCase> => [
  ...A.flatMap(fixtureNames, (name) => [
    { name, bytes: Effect.sync(() => bytesOf(name)), sheet: O.none<string>() },
    ...A.map(O.match(R.get(sheetsOf, name), { onNone: A.empty, onSome: identity }), (sheet) => ({
      name: `${name} sheet ${sheet}`,
      bytes: Effect.sync(() => bytesOf(name)),
      sheet: O.some(sheet)
    }))
  ]),
  ...builtCases(bytesOf)
]
