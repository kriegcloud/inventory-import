import { useAtomSet, useAtomValue } from "@effect/atom-react"
import * as Cause from "effect/Cause"
import * as Exit from "effect/Exit"
import * as O from "effect/Option"
import * as A from "effect/Array"
import { PageHeader } from "@inventory/ui/PageHeader"
import { NotSet } from "@inventory/ui/NotSet"
import { type RecordColumn, RecordsTable } from "@inventory/ui/components/data-table/data-table-records"
import { StatusPill } from "@inventory/ui/StatusPill"
import { Button } from "@inventory/ui/components/button"
import { NativeSelect, NativeSelectOption } from "@inventory/ui/components/native-select"
import { matchColumn } from "./Imports.atoms.ts"
import { navigate } from "@inventory/ui/Route"
import { importAddress } from "./internal/route.ts"
import type { ImportView } from "@inventory/catalog-contract/Import"
import { type ColumnMatch, matchedColumn } from "@inventory/catalog-contract/Mapping"
import { type Field, fieldLabels, requiredFields, type StagedTable } from "@inventory/catalog-contract/Staged"
import { toastError } from "@inventory/client/SayError"
import { notImportedColumn } from "./internal/format.tsx"

const howWords = {
  heading: "By its heading",
  person: "By a person",
  none: "Not matched"
}

type Row = { readonly match: ColumnMatch }

/**
 * Which file column fills which field, with three examples of each. The person changes a match with the select. The
 * review waits until every required field has a column: the button is off and the line under the title names the
 * fields left. A file none of whose columns matches a field is said to be likely the wrong file, with the way back.
 */
export function MatchStep(props: {
  readonly view: ImportView
  readonly table: StagedTable
  readonly canImport: boolean
}) {
  const { view, table } = props
  const matching = useAtomValue(matchColumn).waiting
  const matchOne = useAtomSet(matchColumn, { mode: "promiseExit" })
  const match = (input: { readonly field: Field; readonly column: O.Option<number> }) =>
    void matchOne({ id: view.id, field: input.field, column: input.column }).then((exit) => {
      if (Exit.isFailure(exit)) toastError(exit.cause.pipe(Cause.squash), { lead: O.none() })
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
          value={O.match(matchedColumn(entry), { onNone: () => "", onSome: (column) => `${column.index}` })}
          disabled={!props.canImport || matching}
          onChange={(event) =>
            match({
              field: entry.field,
              column: event.target.value === "" ? O.none() : O.some(Number(event.target.value))
            })
          }
        >
          <NativeSelectOption value="">None</NativeSelectOption>
          {A.map(table.columns, (column) => (
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
      cell: ({ match: entry }) => {
        const examples = O.match(matchedColumn(entry), { onNone: () => [], onSome: (column) => column.examples })
        return examples.length === 0 ? <NotSet /> : examples.join(" · ")
      }
    }
  ]

  const matched = view.mapping.filter((entry) => O.isSome(matchedColumn(entry))).length
  const missing = view.mapping
    .filter((entry) => O.isNone(matchedColumn(entry)) && requiredFields.includes(entry.field))
    .map((entry) => fieldLabels[entry.field])
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
              <Button variant="outline" onClick={() => navigate(importAddress(view.id, "upload"), { replace: false })}>
                Choose another file
              </Button>
            ) : null}
            <Button
              variant={wrongFile ? "outline" : "default"}
              disabled={missing.length > 0}
              onClick={() => navigate(importAddress(view.id, "review"), { replace: false })}
            >
              Review {view.progress.rows} rows
            </Button>
          </>
        }
      />
      {A.match(missing, {
        onEmpty: () => null,
        onNonEmpty: (missing) => {
          const names =
            missing.length === 1
              ? A.headNonEmpty(missing)
              : `${A.join(A.take(missing, missing.length - 1), ", ")} and ${A.lastNonEmpty(missing)}`
          return (
            <p role="status" className="px-4 pb-2 text-sm text-destructive sm:px-9">
              {wrongFile
                ? `None of the columns of ${view.fileName} matches a field of an item: is this the right file? Match ${names} to review it.`
                : `Match ${names} to a column to review: ${missing.length === 1 ? "it is" : "they are"} required.`}
            </p>
          )
        }
      })}
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
