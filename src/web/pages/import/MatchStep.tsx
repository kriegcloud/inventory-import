import { useMutation } from "@tanstack/react-query"
import { PageHeader } from "@/components/app/PageHeader"
import { NotSet } from "@/components/app/NotSet"
import { type RecordColumn, RecordsTable } from "@/components/ui/data-table/data-table-records"
import { StatusPill } from "@/components/app/StatusPill"
import { Button } from "@/components/ui/button"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { call } from "@/lib/api"
import { useImportCache } from "@/lib/imports"
import { importAddress, navigate } from "@/lib/route"
import type { ImportView } from "../../../api/v1/Api.ts"
import {
  type ColumnMatch,
  type Field,
  fieldLabels,
  requiredFields,
  type StagedTable
} from "../../../domain/ItemImport.ts"
import { toastError } from "@/lib/errors"
import { notImportedColumn } from "./format.tsx"

const howWords = {
  heading: "By its heading",
  person: "By a person",
  none: "Not matched"
}

type Row = { match: ColumnMatch }

/**
 * Which file column fills which field, with three examples of each. The person changes a match with the select. The
 * review waits until every required field has a column: the button is off and the line under the title names the
 * fields left. A file none of whose columns matches a field is said to be likely the wrong file, with the way back.
 */
export function MatchStep(props: { view: ImportView; table: StagedTable; canImport: boolean }) {
  const { view, table } = props
  const cache = useImportCache()
  const match = useMutation({
    mutationFn: (input: { field: Field; column: number | null }) =>
      call((api) => api.imports.match({ params: { id: view.id }, payload: input })),
    onSuccess: cache.setView,
    onError: (error) => toastError(error)
  })

  const rows: ReadonlyArray<Row> = view.mapping.map((entry) => ({ match: entry }))
  const columns: ReadonlyArray<RecordColumn<Row>> = [
    {
      id: "field",
      label: "Field",
      width: 220,
      cell: ({ match: entry }) => (
        <span className="inline-flex items-center gap-2">
          {fieldLabels[entry.field]}
          {requiredFields.includes(entry.field) ? <StatusPill tone="outline">Required</StatusPill> : null}
        </span>
      )
    },
    {
      id: "column",
      label: "File column",
      width: 270,
      cell: ({ match: entry }) => (
        <NativeSelect
          size="sm"
          aria-label={`File column for ${fieldLabels[entry.field]}`}
          value={entry.column === null ? "" : `${entry.column}`}
          disabled={!props.canImport || match.isPending}
          onChange={(event) =>
            match.mutate({ field: entry.field, column: event.target.value === "" ? null : Number(event.target.value) })
          }
        >
          <NativeSelectOption value="">None</NativeSelectOption>
          {table.columns.map((column) => (
            <NativeSelectOption key={column.index} value={`${column.index}`}>
              {column.letter}: {column.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      )
    },
    { id: "how", label: "Matched", width: 190, cell: ({ match: entry }) => howWords[entry.how] },
    {
      id: "examples",
      label: "Examples",
      cell: ({ match: entry }) => (entry.examples.length === 0 ? <NotSet /> : entry.examples.join(" · "))
    }
  ]

  const matched = view.mapping.filter((entry) => entry.column !== null).length
  const missing = view.mapping
    .filter((entry) => entry.column === null && requiredFields.includes(entry.field))
    .map((entry) => fieldLabels[entry.field])
  const names =
    missing.length < 2 ? (missing[0] ?? "") : `${missing.slice(0, -1).join(", ")} and ${missing[missing.length - 1]}`
  // Not one column found by its heading or chosen: most likely another kind of file than the one this screen takes.
  const wrongFile = matched === 0 && view.mapping.length > 0
  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Match columns"
        line={`${view.fileName} · ${matched} of ${view.mapping.length} fields matched`}
        actions={
          <>
            {wrongFile ? (
              <Button variant="outline" onClick={() => navigate(importAddress(view.id, "upload"))}>
                Choose another file
              </Button>
            ) : null}
            <Button
              variant={wrongFile ? "outline" : "default"}
              disabled={missing.length > 0}
              onClick={() => navigate(importAddress(view.id, "review"))}
            >
              Review {view.progress.rows} rows
            </Button>
          </>
        }
      />
      {missing.length === 0 ? null : (
        <p role="status" className="px-4 pb-2 text-sm text-destructive sm:px-9">
          {wrongFile
            ? `None of the columns of ${view.fileName} matches a field of an item: is this the right file? Match ${names} to review it.`
            : `Match ${names} to a column to review: ${missing.length === 1 ? "it is" : "they are"} required.`}
        </p>
      )}
      {view.unusedColumns.length === 0 ? null : (
        <p className="px-4 pb-2 text-sm text-muted-foreground sm:px-9">
          {view.unusedColumns.map(notImportedColumn).join(" · ")}
        </p>
      )}
      <RecordsTable
        caption={`Fields of an item and the columns of ${view.fileName}`}
        columns={columns}
        rows={rows}
        rowKey={(row) => row.match.field}
        empty="This file has no columns."
      />
    </div>
  )
}
