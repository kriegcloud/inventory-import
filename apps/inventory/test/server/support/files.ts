// Files made in a test, read through the reader the browser uses and trimmed the way the browser stages them.
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import { type StagedTable } from "@inventory/catalog-contract/Staged"
import { readSpreadsheet } from "@inventory/catalog-web/Spreadsheet"
import { stageTable } from "@inventory/catalog-model/Staging"

/** A CSV made in the test, named items.csv. */
export const textFile = (text: string): File => new File([text], "items.csv")

/** Reads and stages a file exactly as the upload screen does. */
export const stage = (file: File): Effect.Effect<StagedTable> =>
  Effect.orDie(
    Effect.map(readSpreadsheet({ file, sheet: O.none(), onProgress: () => {} }), (table) => stageTable({ table }))
  )
