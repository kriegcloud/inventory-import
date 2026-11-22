// What the person had decided about a row, in words: for the rows a confirm did not include, named on its result.
import * as A from "effect/Array"
import * as Eq from "effect/Equal"
import * as O from "effect/Option"
import * as Order from "effect/Order"
import * as R from "effect/Record"
import * as Str from "effect/String"
import { decisionFromFlags, hasKeep, isLeftOut, type TakenBackKind } from "@inventory/catalog-contract/Decision"
import type { MatchTakeBack } from "@inventory/catalog-contract/Import"
import { fieldLabels } from "@inventory/catalog-contract/Staged"
import { type HeldRow, Hold, Keep, type Named, type RowDecision } from "../Draft.machine.ts"

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
  O.match(
    O.filter(change, (decision) => !Eq.equals(decision, decisionFromFlags({}))),
    { onNone: () => "no decision", onSome: decided }
  )

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

/** One press a row's line offers: which decision of it stands, and the words on the button. */
export interface HoldAction {
  readonly keep: Keep
  readonly label: string
}

/** A decision the server refused, with its sentence in brackets: "left out (not saved: Your role was changed)". */
const refusedWords = (change: O.Option<RowDecision>, reason: string): string =>
  `${mineWords(change)} (not saved: ${Str.replace(/\.$/, "")(reason)})`

/**
 * One row on hold as the line above the review says it, with the presses it offers: a refused row is dismissed; a row
 * decided otherwise since, or in tabs of the person's that are gone, is settled by picking, every decision of it said.
 * A pick that sends nothing is offered to anyone (a member made view-only too); one that sends the person's decision
 * needs an editor, and a decision the server refused is never offered to be sent.
 *
 * @example holdLine({ rowId: "row-12", held, canDecide: false }).actions // [{ keep: Keep.Theirs(), label: "Keep theirs" }]
 */
export const holdLine = (input: {
  readonly rowId: string
  readonly held: HeldRow
  readonly canDecide: boolean
}): { readonly text: string; readonly actions: ReadonlyArray<HoldAction> } => {
  const { canDecide, held, rowId } = input
  const row = rowLabel(rowId)
  const several = held.closed.length > 1
  const closedWords = A.join(
    A.map(held.closed, (one, at) => {
      const words = O.match(one.refused, {
        onNone: () => mineWords(one.decision),
        onSome: (reason) => refusedWords(one.decision, reason)
      })
      return ` Your closed tab${several ? ` ${at + 1}` : ""}: ${words}.`
    }),
    ""
  )
  const closedTabs = (one: number): string => (several ? `closed tab ${one + 1}'s` : "the closed tab's")
  // Beside this tab's refused decision, a closed tab's refused one is kept as that: nothing is sent by it.
  const closedPicks = A.flatMap(held.closed, (one, at): ReadonlyArray<HoldAction> => {
    const keep = Keep.Closed({ decision: one.decision })
    return O.isSome(one.refused)
      ? Hold.$is("Refused")(held.why)
        ? [{ keep, label: `Keep ${closedTabs(at)}` }]
        : []
      : canDecide
        ? [{ keep, label: `Use ${closedTabs(at)}` }]
        : []
  })
  return Hold.$match(held.why, {
    Refused: ({ reason }) =>
      A.isReadonlyArrayNonEmpty(held.closed)
        ? {
            text: `${row}: this tab: ${refusedWords(held.mine, reason)}.${closedWords}`,
            actions: [...closedPicks, { keep: Keep.Mine(), label: "Keep this tab's" }]
          }
        : {
            text: `${row}: you ${mineWords(held.mine)}. Not saved: ${reason}`,
            actions: [{ keep: Keep.Theirs(), label: "Dismiss" }]
          },
    Elsewhere: ({ theirs }) => ({
      text: `${row}: decided since by someone else or another tab: ${decisionWords(theirs)}. Yours: ${mineWords(held.mine)}.${closedWords}`,
      actions: [
        ...(canDecide ? [{ keep: Keep.Mine(), label: "Use mine" }] : []),
        ...closedPicks,
        { keep: Keep.Theirs(), label: "Keep theirs" }
      ]
    }),
    OtherTab: () => ({
      text: `${row}: this tab: ${mineWords(held.mine)}.${closedWords}`,
      actions: [...closedPicks, { keep: Keep.Mine(), label: "Keep this tab's" }]
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

/** A row's number in the file: 12 of "row-12". */
const rowNumber = (id: string): number => Number(Str.replace(/^row-(\d+).*$/, "$1")(id))

/**
 * What is kept by row, in the file's own order: row 9 before row 10.
 *
 * @example inFileOrder({ "row-10": "b", "row-9": "a" }) // [["row-9", "a"], ["row-10", "b"]]
 */
export const inFileOrder = <Kept>(byRow: Readonly<Record<string, Kept>>): ReadonlyArray<readonly [string, Kept]> =>
  A.sort(
    R.toEntries(byRow),
    Order.mapInput(Order.Number, ([id]: readonly [string, Kept]) => rowNumber(id))
  )

/** One decision named: the row as the person knows it, and what they had decided. */
export interface NamedLine {
  readonly id: string
  readonly row: string
  readonly decided: string
}

/**
 * The decisions named, one line each, in the file's order: the row as the person knows it, and what they had decided.
 * Whatever else of the same row was alive (a closed tab's decision beside this tab's) is a line of its own after it.
 *
 * @example leftOverLines({ rows: { "row-12": O.some(leftOut) }, beside: {} }) // [{ row: "Row 12", decided: "left out" }]
 */
export const leftOverLines = (named: Named): ReadonlyArray<NamedLine> =>
  A.flatMap(inFileOrder(named.rows), ([id, change]) => [
    { id, row: rowLabel(id), decided: mineWords(change) },
    ...A.map(
      O.getOrElse(R.get(named.beside, id), (): Named["beside"][string] => []),
      (other, at) => ({
        id: `${id}:${at}`,
        row: rowLabel(id),
        decided: `${mineWords(other)}, in another tab of yours`
      })
    )
  ])

/**
 * The decisions named, as one sentence's list: "Row 12: you left out; Row 31: you took your decision back".
 *
 * @example namedWords({ rows: { "row-12": O.some(leftOut) }, beside: {} }) // "Row 12: you left out"
 */
export const namedWords = (named: Named): string =>
  A.join(
    A.map(leftOverLines(named), (line) => `${line.row}: you ${line.decided}`),
    "; "
  )

/**
 * The rows named, by number alone, in the file's order: "Row 12, row 31".
 *
 * @example rowsWords(["row-31", "row-12"]) // "Row 12, row 31"
 */
export const rowsWords = (rows: ReadonlyArray<string>): string =>
  A.join(
    A.map(A.sort(rows, Order.mapInput(Order.Number, rowNumber)), (id, at) =>
      at === 0 ? rowLabel(id) : Str.replace(/^Row/, "row")(rowLabel(id))
    ),
    ", "
  )
