// @effect-diagnostics nodeBuiltinImport:off
// The sample files, read through the reader the browser uses and trimmed the way the browser stages them.
import { readFileSync } from "node:fs"
import { Effect } from "effect"
import { stageTable } from "@inventory/catalog-model/Review"
import { type StagedTable } from "@inventory/catalog-contract/Staged"
import { readSpreadsheet } from "../../../src/web/lib/spreadsheet/index.ts"

/** A file from `public/samples/`, as the browser would hold it after the person chose it. */
export const sample = (name: string): File =>
  new File([readFileSync(new URL(`../../../public/samples/${name}`, import.meta.url))], name)

/** A CSV made in the test, named items.csv. */
export const textFile = (text: string): File => new File([text], "items.csv")

/** Reads and stages a file exactly as the upload screen does. */
export const stage = (file: File): Effect.Effect<StagedTable> =>
  Effect.orDie(Effect.map(readSpreadsheet({ file }), (table) => stageTable({ table })))
