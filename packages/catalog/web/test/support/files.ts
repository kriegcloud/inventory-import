// The sample files as the browser would hold them after the person chose them, and staged as the upload stages
// them. The files are this package's copies of the app's `public/samples`; a test in the app holds the copies to the
// originals, byte for byte.
// @effect-diagnostics nodeBuiltinImport:off
import { readFileSync } from "node:fs"
import { Effect } from "effect"
import { type StagedTable } from "@inventory/catalog-contract/Staged"
import { readSpreadsheet } from "@inventory/catalog-web/Spreadsheet"
import { stageTable } from "@inventory/catalog-model/Staging"

/** A sample file, as the browser would hold it after the person chose it. */
export const sample = (name: string): File =>
  new File([new Uint8Array(readFileSync(new URL(`../fixtures/samples/${name}`, import.meta.url)))], name)

/** A CSV made in the test, named items.csv. */
export const textFile = (text: string): File => new File([text], "items.csv")

/** A file read and staged as the upload does it: what the server would hold. */
export const stage = (file: File): Effect.Effect<StagedTable> =>
  readSpreadsheet({ file }).pipe(
    Effect.map((table) => stageTable({ table })),
    Effect.orDie
  )
