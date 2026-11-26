// The Activity page's "Decisions" list: every value an import wrote that differs from its file, what it was, what it
import * as Atom from "effect/reactivity/Atom"
import { answerOf } from "@inventory/client/Api"
// became, who proposed it and who accepted or typed it. The app's Activity page shows it beside the audit trail.
import * as DateTime from "effect/DateTime"
import * as O from "effect/Option"
import { Code } from "@inventory/ui/Code"
import { ProposedValue } from "@inventory/ui/ProposedValue"
import { type ListColumn, ListTable } from "@inventory/ui/ListTable"
import { whenShort } from "@inventory/ui/Dates"
import type { ChangeRecord } from "@inventory/catalog-contract/Import"
import {
  changeBasis,
  changeConfidence,
  changeDecidedBy,
  changeHowWords,
  changeSource
} from "@inventory/catalog-contract/Change"
import { fieldLabels } from "@inventory/catalog-contract/Staged"
import { catalogApi } from "./Catalog.runtime.ts"
import { catalogKeys } from "./Catalog.keys.ts"
import { importAddress } from "./internal/route.ts"
import { when } from "./internal/format.tsx"

const sourceWords = { rule: "Rule", model: "Model", person: "Person" } as const

const proposedBy = (record: ChangeRecord): string => sourceWords[changeSource(record.change)]
const decidedBy = (record: ChangeRecord): string =>
  changeDecidedBy(record.change) === "rule" ? "Rule" : O.getOrElse(record.decidedByName, () => "Person")
/** How sure the proposal's source was, when the value came from a proposal. */
const confidenceOf = (record: ChangeRecord): string | null => O.getOrNull(changeConfidence(record.change))

/** The columns of the decisions list. */
export const importDecisionColumns: ReadonlyArray<ListColumn<ChangeRecord>> = [
  {
    id: "sku",
    label: "Item",
    width: 112,
    // A value whose import was taken back is kept still; the item it went into is gone.
    cell: (change) =>
      change.takenBack ? (
        <>
          <Code>{change.sku}</Code> <span className="font-normal text-muted-foreground">taken back</span>
        </>
      ) : (
        <Code>{change.sku}</Code>
      ),
    title: (change) => (change.takenBack ? `${change.sku}, taken back with its import` : change.sku),
    value: (change) => change.sku
  },
  {
    id: "row",
    label: "Row",
    width: 64,
    align: "right",
    cell: (change) =>
      O.match(change.part, {
        onNone: () => `${change.rowNumber}`,
        onSome: (part) => `${change.rowNumber} · ${part}`
      }),
    value: (change) => change.rowNumber,
    searchable: false
  },
  {
    id: "field",
    label: "Field",
    width: 124,
    value: (record) => fieldLabels[record.change.field],
    facet: true
  },
  {
    id: "change",
    label: "Was, now",
    width: 150,
    cell: ({ change }) => <ProposedValue from={change.from === "" ? "empty" : change.from} to={change.to} />,
    // Searched by both values; a pair has no one order to sort by.
    value: ({ change }) => `${change.from} ${change.to}`,
    sortable: false
  },
  {
    id: "source",
    label: "Proposed by",
    width: 112,
    // Who proposed it and how sure they were, in one column: beside the sidebar ten columns did not fit, and the
    // table ran past its frame with the file and the time out of sight.
    cell: (change) => (
      <>
        {proposedBy(change)}
        {confidenceOf(change) === null ? null : (
          <span className="text-muted-foreground"> · {confidenceOf(change)}</span>
        )}
      </>
    ),
    title: (change) =>
      `${proposedBy(change)}${confidenceOf(change) === null ? "" : `, confidence ${confidenceOf(change)}`}`,
    value: proposedBy,
    facet: true
  },
  {
    id: "decided",
    label: "Decided by",
    width: 112,
    value: decidedBy,
    facet: true
  },
  {
    id: "basis",
    label: "Basis",
    // What the proposal rested on; for a value the person typed, the words that say so.
    value: ({ change }) => O.getOrElse(changeBasis(change), () => changeHowWords[change.how]),
    sortable: false,
    wrap: true
  },
  {
    id: "file",
    label: "File",
    width: 100,
    // The way back to a confirmed import: its result, with the rows not imported and the take-back.
    cell: (change) => (
      <a className="underline underline-offset-4" href={importAddress(change.importId, "result")}>
        {change.fileName}
      </a>
    ),
    title: (change) => change.fileName,
    value: (change) => change.fileName,
    facet: true
  },
  {
    id: "when",
    label: "When",
    width: 124,
    cell: (change) => whenShort(change.createdAt),
    title: (change) => when(change.createdAt),
    value: (change) => DateTime.formatIso(change.createdAt),
    searchable: false
  }
]

/** What the decisions list is, for its caption and its skeleton. */
export const importDecisionsCaption = "Values that imports changed, and who decided each"

/** Every changed value the organization's imports wrote, newest first: a confirm or a take-back changes it. */
export const importDecisions = catalogApi.query((api) => api.imports.changes(), {
  keep: "unwatched",
  reactivityKeys: O.some(catalogKeys.changes)
})

const noChanges: ReadonlyArray<ChangeRecord> = []
const importDecisionAnswer = answerOf(importDecisions)
/** The decisions' rows and columns as the list follows them: empty until the decisions have been read. */
const importDecisionRows = Atom.map(importDecisionAnswer, (answer) => answer ?? noChanges)
const importDecisionColumnsAtom = Atom.make(importDecisionColumns)

/** The decisions list. The person searches it, sorts it and narrows it by field, by who proposed and by file. */
export function ImportDecisions() {
  return (
    <ListTable
      key="decisions"
      caption={importDecisionsCaption}
      searchLabel="Search decisions"
      columns={importDecisionColumnsAtom}
      rows={importDecisionRows}
      rowKey={(change) =>
        `${change.importId}:${change.rowNumber}.${O.getOrElse(change.part, () => 0)}:${change.change.field}:${DateTime.formatIso(change.createdAt)}`
      }
      empty="No decisions yet. They appear here once an import with accepted or typed values is confirmed."
    />
  )
}
