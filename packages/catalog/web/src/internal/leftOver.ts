// The person's decisions in words: the lines above the review that ask about a row and what each offers, what a match
// took back, and the decisions named because they were not part of an import.
import * as A from "effect/Array"
import * as Eq from "effect/Equal"
import * as O from "effect/Option"
import * as Order from "effect/Order"
import * as R from "effect/Record"
import * as Str from "effect/String"
import {
  decisionFromFlags,
  hasKeep,
  isLeftOut,
  type SavedDecisions,
  StoredChoice,
  type TakenBackKind
} from "@inventory/catalog-contract/Decision"
import type { MatchTakeBack } from "@inventory/catalog-contract/Import"
import { fieldLabels } from "@inventory/catalog-contract/Staged"
import {
  Keep,
  type LinePick,
  type LineShown,
  type Named,
  type RowDecision,
  sameDecision,
  type Side
} from "../Draft.machine.ts"

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
const mineWords = (change: O.Option<RowDecision>): string =>
  O.match(change, { onNone: () => "took your decision back", onSome: decided })

/** A row as the person knows it: "Row 12". */
export const rowLabel = (id: string): string => `Row ${Str.replace(/^row-/, "")(id)}`

/** One press a row's line offers: which answer of it stands, and the words on the button. */
export interface LineAction {
  readonly keep: Keep
  readonly label: string
}

/** A decision in words, with the server's sentence in brackets where it refused it. */
const sideWords = (side: Side): string =>
  O.match(side.refused, {
    onNone: () => mineWords(side.decision),
    onSome: (reason) => `${mineWords(side.decision)} (not saved: ${Str.replace(/\.$/, "")(reason)})`
  })

/** A decision the server did not refuse: it can be sent. */
const isGood = (side: Side): boolean => O.isNone(side.refused)

/** The words of a line with nothing but refused decisions: there is nothing to pick between. */
const refusedWords = (sides: ReadonlyArray<Side>): string =>
  A.match(sides, {
    onEmpty: () => "",
    onNonEmpty: ([one, ...others]) =>
      A.isReadonlyArrayNonEmpty(others)
        ? A.join(
            A.map(sides, (side) => ` ${side.here ? "This tab" : "Your closed tab"}: ${sideWords(side)}.`),
            ""
          )
        : ` ${one.here ? "you" : "in a closed tab you"} ${mineWords(one.decision)}. Not saved: ${O.getOrElse(one.refused, () => "")}`
  })

/**
 * One row's line above the review as it is said, with the presses it offers: every answer of the row that is alive, and
 * what the server holds where that is none of them: said as decided since by someone else or another tab only where
 * this tab cannot take it for an earlier decision of the person's (`LineShown.since`), and otherwise as what is saved
 * now. A pick that sends nothing is offered to anyone (a member made view-only too); one that sends the person's
 * decision needs an editor, and a decision the server refused is never offered to be sent. While this tab's decision of
 * the row is on its way, nothing is offered: its answer may change what the server holds, and the line says so.
 *
 * @example lineWords({ rowId: "row-12", line, canDecide: false }).actions // [{ keep: Keep.Theirs(), label: "Keep theirs" }]
 */
export const lineWords = (input: {
  readonly rowId: string
  readonly line: LineShown
  readonly canDecide: boolean
}): { readonly text: string; readonly actions: ReadonlyArray<LineAction> } => {
  const { canDecide, line, rowId } = input
  const row = rowLabel(rowId)
  const { going, since, sides, theirs } = line
  const waits = O.isSome(going) ? " What to keep can be picked once this tab's decision of it is saved." : ""
  if (!A.some(sides, isGood)) {
    return {
      text: `${row}:${refusedWords(sides)}${waits}`,
      actions: O.isSome(going) ? [] : [{ keep: Keep.Theirs(), label: "Dismiss" }]
    }
  }
  const here = A.findFirst(sides, (side) => side.here)
  // A closed tab's decision that is this tab's too (on the line, or on its way) is read once, as this tab's.
  const mine = O.orElse(
    O.map(
      O.filter(here, (own) => isGood(own)),
      (own) => own.decision
    ),
    () => going
  )
  const closed = A.filter(
    sides,
    (side) => !side.here && !O.exists(mine, (decision) => sameDecision(decision, side.decision))
  )
  const several = closed.length > 1
  const own = O.match(here, {
    onSome: (side) => ` ${A.isReadonlyArrayNonEmpty(closed) ? "This tab" : "Yours"}: ${sideWords(side)}.`,
    onNone: () =>
      O.match(going, { onNone: () => "", onSome: (decision) => ` This tab: ${mineWords(decision)} (being saved).` })
  })
  const others = A.map(closed, (side, at) => ` Your closed tab${several ? ` ${at + 1}` : ""}: ${sideWords(side)}.`)
  const saved = O.match(theirs, {
    onNone: () => "",
    onSome: (decision) =>
      since
        ? ` decided since by someone else or another tab: ${decisionWords(decision)}.`
        : ` saved now: ${decisionWords(decision)}.`
  })
  const pick = (side: Side, label: string): LineAction => ({ keep: Keep.Side({ decision: side.decision }), label })
  const picks: ReadonlyArray<LineAction> = [
    ...A.flatMap(A.fromOption(here), (side) =>
      isGood(side) && !canDecide ? [] : [pick(side, isGood(side) && O.isSome(theirs) ? "Use mine" : "Keep this tab's")]
    ),
    ...A.flatMap(closed, (side, at) =>
      isGood(side) && canDecide ? [pick(side, several ? `Use closed tab ${at + 1}'s` : "Use the closed tab's")] : []
    ),
    ...(O.isSome(theirs) ? [{ keep: Keep.Theirs(), label: since ? "Keep theirs" : "Keep what is saved" }] : [])
  ]
  return {
    text: `${row}:${saved}${own}${A.join(others, "")}${waits}`,
    // What is saved stays: a view-only member, who can send nothing, is never left without a way on.
    actions: O.isSome(going)
      ? []
      : A.isReadonlyArrayNonEmpty(picks)
        ? picks
        : [{ keep: Keep.Theirs(), label: "Keep what is saved" }]
  }
}

/**
 * What a line asks: whose decision stands where somebody decided the row since, or where what is saved is none of the
 * person's decisions alive and this tab cannot tell who saved it; which tab's; or only to let a refused one go.
 */
type Asked = "since" | "saved" | "tabs" | "refused"

const askedBy = (line: LineShown): Asked =>
  !A.some(line.sides, isGood) ? "refused" : O.isSome(line.theirs) ? (line.since ? "since" : "saved") : "tabs"

/** One press that settles several lines: the words on the button, and a pick on each. */
export interface LinesAction {
  readonly label: string
  readonly picks: ReadonlyArray<LinePick>
}

/** The lines that ask the same: what they ask, each as it is said, and the presses that settle many. */
export interface LineGroup {
  readonly asked: Asked
  readonly lines: ReadonlyArray<{
    readonly rowId: string
    readonly text: string
    readonly actions: ReadonlyArray<LineAction>
  }>
  readonly all: ReadonlyArray<LinesAction>
}

/** A press on every line that offers it, where more than one does. */
const onAll = (words: string, picks: ReadonlyArray<LinePick>): ReadonlyArray<LinesAction> =>
  picks.length > 1 ? [{ label: `${words} for all ${picks.length}`, picks }] : []

/**
 * The lines above the review by what they ask, each group in the file's order (row 9 before row 10). One press settles
 * many: theirs, or this tab's, for every line of the group that offers it (a refused decision is never sent by one, nor
 * a line settled whose row this tab is still saving, and the button says how many it covers); refused ones are
 * dismissed together.
 *
 * @example lineGroups({ lines, canDecide: true })[0].all // [{ label: "Use mine for all 400", picks }, …]
 */
export const lineGroups = (input: {
  readonly lines: Readonly<Record<string, LineShown>>
  readonly canDecide: boolean
}): ReadonlyArray<LineGroup> => {
  const { canDecide } = input
  const ordered = inFileOrder(input.lines)
  return A.flatMap(["since", "saved", "tabs", "refused"] as const, (asked): ReadonlyArray<LineGroup> => {
    const of = A.filter(ordered, ([, line]) => askedBy(line) === asked)
    if (!A.isReadonlyArrayNonEmpty(of)) return []
    // A line whose row this tab is still saving offers nothing yet, alone or in one press for many.
    const ready = A.filter(of, ([, line]) => O.isNone(line.going))
    const theirs = A.map(ready, ([rowId]): LinePick => ({ rowId, keep: Keep.Theirs() }))
    const own = A.flatMap(ready, ([rowId, line]) =>
      A.map(
        A.filter(line.sides, (side) => canDecide && side.here && isGood(side)),
        (side): LinePick => ({ rowId, keep: Keep.Side({ decision: side.decision }) })
      )
    )
    const alls: Record<Asked, ReadonlyArray<LinesAction>> = {
      since: [...onAll("Use mine", own), ...onAll("Keep theirs", theirs)],
      saved: [...onAll("Use mine", own), ...onAll("Keep what is saved", theirs)],
      tabs: canDecide ? onAll("Keep this tab's", own) : onAll("Keep what is saved", theirs),
      refused: onAll("Dismiss", theirs)
    }
    const lines = A.map(of, ([rowId, line]) => ({ rowId, ...lineWords({ rowId, line, canDecide }) }))
    return [{ asked, lines, all: alls[asked] }]
  })
}

const rowsCounted = (count: number): string => (count === 1 ? "1 row" : `${count} rows`)

/** How many lines of one kind are drawn at first, and how many more each press of the button below them draws. */
export const linesAtOnce = 10

/**
 * The lines of one kind as they are drawn: the first `drawn` of them, and the press that draws more, with its words,
 * while some are left (none once all are drawn).
 *
 * @example linesDrawn({ lines, drawn: 10 }).more // O.some({ label: "Show more of the 390 rows left", drawn: 20 })
 */
export const linesDrawn = <Line>({
  drawn,
  lines
}: {
  readonly lines: ReadonlyArray<Line>
  readonly drawn: number
}): {
  readonly shown: ReadonlyArray<Line>
  readonly more: O.Option<{ readonly label: string; readonly drawn: number }>
} => {
  const rest = lines.length - drawn
  return {
    shown: A.take(lines, drawn),
    more:
      rest <= 0
        ? O.none()
        : O.some({
            label: rest === 1 ? "Show 1 more row" : `Show more of the ${rest} rows left`,
            drawn: drawn + linesAtOnce
          })
  }
}

/**
 * What the lines above the review ask, in a sentence, by the kinds there are.
 *
 * @example linesAsk(groups) // "1 row was decided since by someone else or another tab: pick whose decision stands."
 */
export const linesAsk = (groups: ReadonlyArray<LineGroup>): string =>
  A.join(
    A.map(groups, ({ asked, lines }) => {
      const one = lines.length === 1
      const said: Record<Asked, string> = {
        since: `${one ? "was" : "were"} decided since by someone else or another tab: pick whose decision stands.`,
        saved: `${one ? "is" : "are"} saved otherwise than you decided: pick which decision stands.`,
        tabs: `${one ? "was" : "were"} decided otherwise in a tab of yours that is closed: pick which decision stands.`,
        refused: `could not be saved: decide ${one ? "it" : "each"} again in the review, or dismiss the line.`
      }
      return `${rowsCounted(lines.length)} ${said[asked]}`
    }),
    " "
  )

/**
 * How many rows wait for the person, as the lines' title says it.
 *
 * @example linesTitle(groups) // "3 rows wait for you"
 */
export const linesTitle = (groups: ReadonlyArray<LineGroup>): string => {
  const count = A.reduce(groups, 0, (all, group) => all + group.lines.length)
  return `${rowsCounted(count)} ${count === 1 ? "waits" : "wait"} for you`
}

/** How many rows of one take-back are named by number before the rest are counted. */
const rowsNamedInLine = 10

/** What a match did to the field whose decisions it took back: matched again, cleared, or moved off its column. */
const matchWords = ({ by, field, matched, reads }: MatchTakeBack): string =>
  matched === undefined || matched === field
    ? reads === false
      ? `${by} cleared the column of ${label(field)}`
      : `${by} matched ${label(field)} again`
    : reads === false
      ? `${by} gave the column of ${label(field)} to ${label(matched)}`
      : `${by} gave the column of ${label(field)} to ${label(matched)}, and ${label(field)} now reads another`

/**
 * What one match took back, in a sentence: who did what to which field's column, how many decisions of which kind, and
 * on which rows (the first ten by number, the rest counted).
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
    numbers.length === 0
      ? ""
      : more > 0
        ? `${A.join(numbers, ", ")} and ${more} more`
        : numbers.length === 1
          ? A.join(numbers, "")
          : `${A.join(A.take(numbers, numbers.length - 1), ", ")} and ${numbers[numbers.length - 1] ?? ""}`
  const where = numbers.length === 0 ? "" : `, on ${one ? "row" : "rows"} ${listed}`
  return `${matchWords(taken)}: ${taken.count} ${kinds[taken.kind]} taken back${where}.`
}

/** True when a row's stored decision has that part again: it was decided again since the match took it back. */
const decidedAgain = (taken: MatchTakeBack, decision: RowDecision): boolean => {
  const again: Record<TakenBackKind, boolean> = {
    accept: A.contains(decision.accepted, taken.field),
    undo: A.contains(decision.reverted, taken.field),
    stored: !StoredChoice.guards.undecided(decision.stored),
    twin: hasKeep(decision)
  }
  return again[taken.kind]
}

/**
 * One match's take-back as the line above the review says it, for the rows not decided again since: none once there is
 * no such row left. Only somebody who can decide is told to.
 *
 * @example O.isNone(takeBackLine({ taken, decisions, canDecide: true })) // true: every row was decided again
 */
export const takeBackLine = (input: {
  readonly taken: MatchTakeBack
  readonly decisions: SavedDecisions
  readonly canDecide: boolean
}): O.Option<string> => {
  const { canDecide, decisions, taken } = input
  const rows = A.filter(
    taken.rows,
    (rowId) => !O.exists(R.get(decisions, rowId), (decision) => decidedAgain(taken, decision))
  )
  // Rows past the first ones are only counted: whether they were decided again is not known here.
  const count = taken.count - (taken.rows.length - rows.length)
  if (count <= 0) return O.none()
  const after = canDecide ? "Each row shows what it reads now, to decide again." : "Each row shows what it reads now."
  return O.some(`${takeBackWords({ ...taken, rows, count })} ${after}`)
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
 * Whatever else of the same row was alive (a closed tab's decision beside this tab's) is a line of its own after it. A
 * row decided since by someone else or another tab says what is saved instead.
 *
 * @example leftOverLines({ rows: { "row-12": O.some(leftOut) }, beside: {}, theirs: {} }) // [{ row: "Row 12", decided: "left out" }]
 */
export const leftOverLines = (named: Named): ReadonlyArray<NamedLine> =>
  A.flatMap(inFileOrder(named.rows), ([id, change]) => {
    const instead = O.match(R.get(named.theirs, id), {
      onNone: () => "",
      onSome: (theirs) => ` (saved instead: ${decisionWords(theirs)})`
    })
    const beside = O.getOrElse(R.get(named.beside, id), (): Named["beside"][string] => [])
    return [
      { id, row: rowLabel(id), decided: `${mineWords(change)}${instead}` },
      ...A.map(beside, (other, at) => ({
        id: `${id}:${at}`,
        row: rowLabel(id),
        decided: `${mineWords(other)}, in another tab of yours`
      }))
    ]
  })

/**
 * The decisions named, as one sentence's list: "Row 12: you left out; Row 31: you took your decision back".
 *
 * @example namedWords({ rows: { "row-12": O.some(leftOut) }, beside: {}, theirs: {} }) // "Row 12: you left out"
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
