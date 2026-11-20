// What the person had decided about a row, in words: for the rows a confirm did not include, named on its result.
import * as A from "effect/Array"
import * as O from "effect/Option"
import * as Order from "effect/Order"
import * as R from "effect/Record"
import * as Str from "effect/String"
import { hasKeep, isLeftOut } from "@inventory/catalog-contract/Decision"
import { fieldLabels } from "@inventory/catalog-contract/Staged"
import type { RowChanges, RowDecision } from "../Draft.machine.ts"

const label = (field: string): string => O.getOrElse(R.get<string, string>(fieldLabels, field), () => field)

/**
 * One decision as the person made it: "left out", "accepted the proposal for Unit cost", "typed Name: Steel Tube".
 * Several parts are joined in the order the review offers them.
 */
const decided = (decision: RowDecision): string => {
  const parts = [
    ...(isLeftOut(decision) ? ["left out"] : hasKeep(decision) ? ["kept over the other row with its SKU"] : []),
    ...(decision.stored.kind === "keep"
      ? ["kept the stored item"]
      : decision.stored.kind === "replace"
        ? ["replaced the stored item"]
        : []),
    ...(A.isReadonlyArrayNonEmpty(decision.accepted)
      ? [`accepted the proposal for ${A.join(A.map(decision.accepted, label), ", ")}`]
      : []),
    ...(A.isReadonlyArrayNonEmpty(decision.reverted)
      ? [`undid the fix for ${A.join(A.map(decision.reverted, label), ", ")}`]
      : []),
    ...A.map(R.toEntries(decision.edits), ([field, value]) => `typed ${label(field)}: ${value}`)
  ]
  return A.isReadonlyArrayNonEmpty(parts) ? A.join(parts, "; ") : "took your decision back"
}

/**
 * One row's decision in words, or what an empty one means: "left out", "kept the stored item", "no decision".
 *
 * @example decisionWords(O.some(leftOut)) // "left out"
 */
export const decisionWords = (change: O.Option<RowDecision>): string =>
  O.match(change, { onNone: () => "no decision", onSome: decided })

/** A row as the person knows it: "Row 12". */
export const rowLabel = (id: string): string => `Row ${Str.replace(/^row-/, "")(id)}`

/**
 * The rows left over, one line each, in the file's order: the row as the person knows it, and what they had decided.
 *
 * @example leftOverLines({ "row-12": O.some(leftOut) }) // [{ row: "Row 12", decided: "left out" }]
 */
export const leftOverLines = (
  rows: RowChanges
): ReadonlyArray<{ readonly id: string; readonly row: string; readonly decided: string }> =>
  A.map(
    A.sort(
      R.toEntries(rows),
      Order.mapInput(Order.Number, ([id]: readonly [string, unknown]) => Number(Str.replace(/^row-(\d+).*$/, "$1")(id)))
    ),
    ([id, change]) => ({
      id,
      row: rowLabel(id),
      decided: O.match(change, { onNone: () => "took your decision back", onSome: decided })
    })
  )
