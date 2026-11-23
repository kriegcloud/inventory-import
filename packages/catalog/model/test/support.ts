// A small file of items and three members, for the tests over the in-memory twins: no sample file, no database.
import { UploadKey } from "@inventory/catalog-contract/Ids"
import type { StagedTable } from "@inventory/catalog-contract/Staged"
import { importsEndpoints } from "@inventory/catalog-model/ImportsHandler"
import { CurrentActor } from "@inventory/kernel/Actor"
import { MemberId, OrganizationId } from "@inventory/kernel/Ids"
import { Member } from "@inventory/kernel/Member"
import type { Role } from "@inventory/kernel/Role"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as Str from "effect/String"

const member = (id: string, name: string, role: Role, organization: string): Member =>
  Member.make({
    id: MemberId.make(id),
    name,
    role,
    organizationId: OrganizationId.make(organization),
    organizationName: organization === "org_prairie" ? "Example Works (test)" : "Sample Supply Co. (test)"
  })

export const dana = member("mem_dana", "Dana Whitfield", "admin", "org_prairie")
export const marcus = member("mem_marcus", "Marcus Oyelaran", "editor", "org_prairie")
export const priya = member("mem_priya", "Priya Raman", "viewer", "org_prairie")
export const elena = member("mem_elena", "Elena Sokolova", "admin", "org_northline")

/** Runs an effect as `who`. */
export const as =
  (who: Member) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, Exclude<R, CurrentActor>> =>
    Effect.provideService(effect, CurrentActor, who)

const letters = ["A", "B", "C", "D", "E", "F", "G"]
const headings = ["sku", "name", "description", "category", "uom", "unit_cost", "quantity_on_hand"] as const

/** One row of the test file: its cells by heading; a heading left out is an empty cell. */
export type Line = Partial<Record<(typeof headings)[number], string>>

/** A staged file with the given rows under the seven headings, the first data row being row 2. */
export const tableOf = (input: { readonly fileName: string; readonly lines: ReadonlyArray<Line> }): StagedTable => ({
  fileName: input.fileName,
  kind: "csv",
  sheet: O.none(),
  headerRowNumber: 1,
  columns: A.map(headings, (label, index) => ({
    index,
    letter: O.getOrElse(A.get(letters, index), () => "A"),
    label
  })),
  notes: [],
  rows: A.map(input.lines, (line, index) => ({
    rowNumber: index + 2,
    cells: A.map(headings, (heading) => ({ text: line[heading] ?? "" }))
  }))
})

/** Five rows: three that are ready, one with no name (cannot import), one whose category is not a category. */
export const fiveLines: ReadonlyArray<Line> = [
  {
    sku: "AAA-0001",
    name: "Oak Crate",
    description: "Oak crate for general use.",
    category: "packaging",
    uom: "EA",
    unit_cost: "12.50",
    quantity_on_hand: "10"
  },
  { sku: "AAA-0002", name: "Steel Bolt", category: "components", uom: "BX", unit_cost: "3", quantity_on_hand: "200" },
  {
    sku: "AAA-0003",
    name: "Nylon Rope",
    category: "raw-materials",
    uom: "M",
    unit_cost: "0.75",
    quantity_on_hand: "40"
  },
  {
    sku: "AAA-0004",
    name: "",
    description: "Copper plate for general use.",
    category: "raw-materials",
    uom: "KG",
    unit_cost: "8",
    quantity_on_hand: "5"
  },
  { sku: "AAA-0005", name: "Brass Hook", category: "Misc", uom: "EA", unit_cost: "1.20", quantity_on_hand: "7" }
]

let uploads = 0

/** Stages `table` through the upload endpoints, as the screen does, and answers the import it became. */
export const stage = Effect.fnUntraced(function* (table: StagedTable) {
  const imports = yield* importsEndpoints
  const { rows, ...head } = table
  uploads += 1
  const begun = yield* imports.beginUpload({
    // A version 4 UUID as the screen makes one, its last group the count of uploads so far.
    payload: {
      key: UploadKey.make(`7a1d3f52-9c4e-4b60-8d21-${Str.padStart(12, "0")(uploads.toString(16))}`),
      head,
      rowCount: rows.length,
      chunkCount: 1
    }
  })
  const { id } = yield* Effect.fromResult(begun)
  const put = yield* imports.putChunk({ params: { id }, payload: { seq: 0, rows } })
  yield* Effect.fromResult(put)
  const finished = yield* imports.finishUpload({ params: { id } })
  return yield* Effect.fromResult(finished)
})
