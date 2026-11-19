// The imports that were confirmed, as the columns of a list: the way back to a past import's result, from the first
// screen and from Activity. Every confirmed import is listed, whatever it changed: a clean file's has a line too.
// The one thing not to break: the count of items is the server's, read from the stored items, never the confirm's.
import { DateTime } from "effect"
import { StatusPill, type Tone } from "@inventory/ui/StatusPill"
import type { ListColumn } from "@inventory/ui/ListTable"
import { whenShort } from "@inventory/ui/Dates"
import { importAddress } from "@/lib/route"
import type { PastImport } from "../../../api/v1/Api.ts"
import { when } from "./format.tsx"

const statusWords: Readonly<Record<PastImport["status"], { readonly words: string; readonly tone: Tone }>> = {
  imported: { words: "Imported", tone: "success" },
  takenBack: { words: "Taken back", tone: "neutral" },
  // Confirmed once, then opened again to finish the rows it left out.
  open: { words: "Opened again", tone: "warning" }
}

const whole = new Intl.NumberFormat("en-US")

/** The file's name, linking to the import's result: what it imported, the rows it left out, the take-back. */
const fileColumn: ListColumn<PastImport> = {
  id: "file",
  label: "File",
  value: (past) => past.fileName,
  cell: (past) => (
    <a className="underline underline-offset-4" href={importAddress(past.id, "result")}>
      {past.fileName}
    </a>
  ),
  title: (past) => `Open the result of ${past.fileName}`
}

const statusColumn: ListColumn<PastImport> = {
  id: "status",
  label: "Status",
  width: 128,
  value: (past) => statusWords[past.status].words,
  cell: (past) => <StatusPill tone={statusWords[past.status].tone}>{statusWords[past.status].words}</StatusPill>,
  facet: true
}

const itemsColumn: ListColumn<PastImport> = {
  id: "items",
  label: "Items",
  width: 88,
  align: "right",
  value: (past) => past.items,
  cell: (past) => whole.format(past.items),
  title: (past) => `${whole.format(past.items)} items in the system came from this file`,
  searchable: false
}

const notImportedColumn: ListColumn<PastImport> = {
  id: "notImported",
  label: "Not imported",
  width: 116,
  align: "right",
  value: (past) => past.notImported,
  cell: (past) => whole.format(past.notImported),
  searchable: false
}

const rowsColumn: ListColumn<PastImport> = {
  id: "rows",
  label: "Rows",
  width: 80,
  align: "right",
  value: (past) => past.rowCount,
  cell: (past) => whole.format(past.rowCount),
  searchable: false
}

const byColumn: ListColumn<PastImport> = {
  id: "by",
  label: "Confirmed by",
  width: 160,
  value: (past) => past.confirmedByName,
  facet: true
}

const whenColumn: ListColumn<PastImport> = {
  id: "when",
  label: "When",
  width: 132,
  value: (past) => DateTime.formatIso(past.confirmedAt),
  cell: (past) => whenShort(past.confirmedAt),
  title: (past) => when(past.confirmedAt),
  searchable: false
}

/** Every column, for Activity's full width. */
export const pastImportColumns: ReadonlyArray<ListColumn<PastImport>> = [
  fileColumn,
  statusColumn,
  itemsColumn,
  notImportedColumn,
  rowsColumn,
  byColumn,
  whenColumn
]

/** The few that fit the first screen's narrow column. */
export const pastImportColumnsShort: ReadonlyArray<ListColumn<PastImport>> = [
  fileColumn,
  statusColumn,
  itemsColumn,
  whenColumn
]
