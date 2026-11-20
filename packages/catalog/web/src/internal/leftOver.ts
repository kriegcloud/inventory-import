// What the person had decided about a row, in words: for the rows a confirm did not include, named on its result.
import * as A from "effect/Array"
import * as O from "effect/Option"
import * as Order from "effect/Order"
import * as R from "effect/Record"
import * as Str from "effect/String"
import { hasKeep, isLeftOut, type TakenBackKind } from "@inventory/catalog-contract/Decision"
import type { MatchTakeBack } from "@inventory/catalog-contract/Import"
import { fieldLabels } from "@inventory/catalog-contract/Staged"
import { type HeldRow, Hold, type RowChanges, type RowDecision } from "../Draft.machine.ts"

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

/**
 * The person's own decision of a row in words, where an empty one is a decision taken back: "left out", "took your
 * decision back". For a line that begins "you" or "yours".
 *
 * @example mineWords(O.none()) // "took your decision back"
 */
export const mineWords = (change: O.Option<RowDecision>): string =>
  O.match(change, { onNone: () => "took your decision back", onSome: decided })

/** A row as the person knows it: "Row 12". */
export const rowLabel = (id: string): string => `Row ${Str.replace(/^row-/, "")(id)}`

/**
 * One row on hold as the line above the review says it, with the presses it offers: a refused row is dismissed; a row
 * decided otherwise since, or by a tab of the person's that is gone, is settled by picking. Letting the person's own go
 * sends nothing, so it is offered to anyone (a member made view-only too); sending theirs needs an editor.
 *
 * @example holdLine({ rowId: "row-12", held, canDecide: false }).actions // [{ keep: "theirs", label: "Keep theirs" }]
 */
export const holdLine = (input: {
  readonly rowId: string
  readonly held: HeldRow
  readonly canDecide: boolean
}): {
  readonly text: string
  readonly actions: ReadonlyArray<{ readonly keep: "mine" | "theirs"; readonly label: string }>
} => {
  const { canDecide, held, rowId } = input
  const row = rowLabel(rowId)
  const pick = (mine: string, theirs: string) => [
    ...(canDecide ? [{ keep: "mine" as const, label: mine }] : []),
    { keep: "theirs" as const, label: theirs }
  ]
  return Hold.$match(held.why, {
    Refused: ({ reason }) => ({
      text: `${row}: you ${mineWords(held.mine)}. Not saved: ${reason}`,
      actions: [{ keep: "theirs" as const, label: "Dismiss" }]
    }),
    Elsewhere: ({ theirs }) => ({
      text: `${row}: decided since by someone else or another tab: ${decisionWords(theirs)}. Yours: ${mineWords(held.mine)}.`,
      actions: pick("Use mine", "Keep theirs")
    }),
    OtherTab: ({ thisTab }) => ({
      text: `${row}: from your other tab: ${mineWords(held.mine)}. This tab: ${mineWords(thisTab)}.`,
      actions: pick("Use the other tab's", "Keep this tab's")
    })
  })
}

/** How many rows of one take-back are named by number before the rest are counted. */
const rowsNamedInLine = 10

/**
 * What one match took back, in a sentence: who matched which field again, how many decisions of which kind, and on
 * which rows (the first ten by number, the rest counted).
 *
 * @example takeBackWords({ by: "Marcus", field: "sku", kind: "stored", count: 2, rows: ["row-4", "row-9"] })
 * // "Marcus matched SKU again: 2 keep-or-replace answers were taken back, on rows 4 and 9."
 */
export const takeBackWords = (taken: MatchTakeBack): string => {
  const one = taken.count === 1
  const kinds: Record<TakenBackKind, string> = {
    accept: one ? "accepted proposal was" : "accepted proposals were",
    stored: one ? "keep-or-replace answer was" : "keep-or-replace answers were",
    twin: one ? "row kept over its twin was" : "rows kept over their twins were",
    undo: one ? "undone fix was" : "undone fixes were"
  }
  const numbers = A.map(A.take(taken.rows, rowsNamedInLine), (id) => Str.replace(/^row-/, "")(id))
  const more = taken.count - numbers.length
  const listed =
    more > 0
      ? `${A.join(numbers, ", ")} and ${more} more`
      : numbers.length <= 1
        ? A.join(numbers, "")
        : `${A.join(A.take(numbers, numbers.length - 1), ", ")} and ${numbers[numbers.length - 1] ?? ""}`
  const where = numbers.length === 0 ? "" : `, on ${one ? "row" : "rows"} ${listed}`
  return `${taken.by} matched ${label(taken.field)} again: ${taken.count} ${kinds[taken.kind]} taken back${where}.`
}

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
