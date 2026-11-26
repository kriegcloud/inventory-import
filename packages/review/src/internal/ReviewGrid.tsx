import { CellMark, ColumnMatch, Entry } from "@inventory/review/ReviewTypes"
import { OtherAnswer } from "@inventory/review/ReviewDraft"
import {
  elementScroll,
  observeElementOffset,
  observeElementRect,
  type VirtualItem,
  Virtualizer
} from "@tanstack/react-virtual"
import { ChevronDownIcon, ChevronRightIcon, CircleHelpIcon, SparklesIcon } from "lucide-react"
import type { Table as TanstackTable } from "@tanstack/react-table"
import { Fragment, type ReactNode, memo } from "react"
import { useAtomSubscribe, useAtomValue } from "@effect/atom-react"
import * as ScopedAtom from "@effect/atom-react/ScopedAtom"
import * as Atom from "effect/reactivity/Atom"
import {
  type Density,
  density as keptDensity,
  type GroupActions,
  type Region,
  RegionScope,
  type RegionTable,
  type RowActionFor,
  type RowActions,
  TableScope
} from "../ReviewRegion.atoms.ts"
import { cn } from "cn"
import * as Data from "effect/Data"
import * as HashMap from "effect/HashMap"
import * as HashSet from "effect/HashSet"
import * as A from "effect/Array"
import * as Eq from "effect/Equal"
import * as O from "effect/Option"
import { stringify } from "@inventory/ui/Json"
import { sourceWordsFor } from "@inventory/ui/ProposalSource"
import { StatusPill } from "@inventory/ui/StatusPill"
import { Badge } from "@inventory/ui/components/badge"
import { Button } from "@inventory/ui/components/button"
import { Checkbox } from "@inventory/ui/components/checkbox"
import { ButtonGroup } from "@inventory/ui/components/button-group"
import { NativeSelect, NativeSelectOption } from "@inventory/ui/components/native-select"
import { ScrollArea } from "@inventory/ui/components/scroll-area"
import { Skeleton } from "@inventory/ui/components/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@inventory/ui/components/tooltip"
import { DataTableColumnHeader } from "@inventory/ui/components/data-table/data-table-column-header"
import type { DataTableFeatures } from "@inventory/ui/components/data-table/data-table-features"
import {
  StickyTable,
  StickyTableBand,
  StickyTableBody,
  StickyTableCell,
  StickyTableColumn,
  StickyTableFill,
  StickyTableFrame,
  StickyTableHeader,
  StickyTableRow,
  StickyTableRowHeader
} from "@inventory/ui/components/sticky-table"
import { textWidth } from "@inventory/ui/TextWidth"
import {
  askFor,
  choicesOf,
  columnFor,
  shownWith,
  weakGuess,
  choiceText,
  groupUse,
  inSentence,
  otherAnswers,
  reasonOf,
  rowName,
  rowsWord,
  spellingOf,
  valueWords
} from "@inventory/review/ReviewDraft"
import { planColumns, priorityOf } from "./sizing.ts"
import {
  CellValue,
  codeFace,
  CutText,
  DecisionTag,
  EditForm,
  GroupChange,
  longValue,
  Overlay,
  Reason,
  ReasonTag,
  regionLayout,
  WhyBody
} from "./parts.tsx"
import { ReviewColumn } from "@inventory/review/ReviewTypes"
import type { Fix, FixGroup, ProblemKind, ReviewRegionProps, ReviewWords, RowView } from "@inventory/review/ReviewTypes"

// Each enum's own guard, made once: these run for every row and every cell.
const isCellMarkApplied = CellMark.guards.applied
const isCellMarkProposed = CellMark.guards.proposed
const isColumnMatchUnmatched = ColumnMatch.guards.unmatched
const isEntryGroup = Entry.guards.group
const isEntryRow = Entry.guards.row

/**
 * The region's own Reason column: the sentence behind each row that needs the person or cannot be fixed here, with or
 * without a fix. A `fill` column, cut to one line with the whole sentence one hover, focus or tap away.
 */
export const reasonColumn: ReviewColumn = ReviewColumn.make({
  id: "review:reason",
  label: "Reason",
  size: "fill",
  width: 240
})

export type { Density, GroupActions, RowActions }

// The product's own tables run 36px rows. A row with a value under the name needs 44; a group heading has two lines.
const rowHeight = 36
const tallRowHeight = 44
/** A group heading: its change, and its reason under it (measured once drawn: a long reason takes more lines). */
const groupHeight = 56
/** A band of one line: a kind's heading, the line after a kind's groups, a row's detail (measured once drawn). */
const bandHeight = 36
/** The Status column's most: it is measured from the tags in view, like a `fit` column. */
const statusMost = 200
/** The actions column's least width; it grows to what the rows' answers need (`actionsFit`), up to the most. */
const actionsLeast = 240
/** With no row to answer on screen (Ready, All with nothing open): room for "Leave out" or "Put back" only. */
const actionsQuiet = 120
const actionsMost = 360

const nameOf = (view: RowView, first: ReviewColumn | undefined): string => {
  const name = first === undefined ? "" : (view.cells[first.id] ?? "")
  return name === "" ? `row ${rowName(view.row)}` : name
}

/** A column that could not be found in the file: the choice sits in its own header, where the values will appear. */
function MatchSelect(props: { column: ReviewColumn; onMatch: (columnId: string, source: string) => void }) {
  const match = props.column.match
  if (match === undefined || !isColumnMatchUnmatched(match)) return null
  return (
    <NativeSelect
      size="sm"
      id={`review-match-${props.column.id}`}
      aria-label={`File column for ${props.column.label}`}
      defaultValue=""
      className="w-full"
      onChange={(event) => {
        if (event.target.value !== "") props.onMatch(props.column.id, event.target.value)
      }}
    >
      <NativeSelectOption value="" disabled>
        Match {props.column.label}
      </NativeSelectOption>
      {match.candidates.map((candidate) => (
        <NativeSelectOption key={candidate.source} value={candidate.source}>
          {candidate.source} ({candidate.samples.join(", ")})
        </NativeSelectOption>
      ))}
    </NativeSelect>
  )
}

/** Two rows that cannot both be imported, side by side: the cells where they differ, and which one to keep. */
function Compare(props: {
  view: RowView
  other: RowView
  columns: ReadonlyArray<ReviewColumn>
  /** Left out for someone who may only look. */
  onKeep: ((rowId: string) => void) | undefined
}) {
  const { view, other } = props
  const differing = props.columns.filter(
    (column, index) => index === 0 || (view.cells[column.id] ?? "") !== (other.cells[column.id] ?? "")
  )
  return (
    <>
      <div className="grid grid-cols-3 gap-x-4 gap-y-1">
        <span />
        <span className="text-muted-foreground">Row {rowName(view.row)}</span>
        <span className="text-muted-foreground">Row {rowName(other.row)}</span>
        {differing.slice(0, 6).map((column) => (
          <Fragment key={column.id}>
            <span className="text-muted-foreground">{column.label}</span>
            <CutText text={view.cells[column.id] ?? ""} className={cn("font-medium", codeFace(column))} />
            <CutText text={other.cells[column.id] ?? ""} className={cn("font-medium", codeFace(column))} />
          </Fragment>
        ))}
      </div>
      {props.onKeep === undefined ? null : (
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => props.onKeep?.(view.row.id)}>
            Keep row {rowName(view.row)}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => props.onKeep?.(other.row.id)}>
            Keep row {rowName(other.row)}
          </Button>
        </div>
      )}
    </>
  )
}

// A cell's own padding and rule (`p-2` and one hairline), and a few pixels for a face that has not loaded yet.
const cellChrome = 16 + 1 + 6
// What stands between a struck-through value and its new one: two gaps and the arrow; then the chip's padding and
// outline, and the tick it gains once accepted (so a column does not change width when a proposal is taken).
const arrowGap = 6 + 12 + 6
const chipChrome = 12 + 2 + 4 + 12
const sparkle = 4 + 12
const whyButton = 6 + 44
/** A `fit` column never grows past this for one value: past it the value is cut, and the row's detail shows it whole. */
const fitMost = 480
/** A `fill` column's least width when the caller gives none. */
const fillLeast = 160
/** The expand button before the row number, with its gap. */
const expander = 24 + 4
// The first cell's own space: its gutter (36 px on a desk), the row number and its gap, and the cell's end padding.
const firstChrome = 36 + 28 + 10 + 8
// A header's sort mark and its gap, the header's padding, and a pixel for its rule.
const headerChrome = 16 + 6 + 16 + 2

/**
 * The Status column's width for the rows in view: its widest tag (a kind's label with its icon, or what happened to
 * the row) and, beside a tag, the link to a row it clashes with.
 */
const statusFit = (input: {
  views: ReadonlyArray<RowView>
  kinds: HashMap.HashMap<string, ProblemKind>
  words: ReviewWords
}): number => {
  // 12 px medium text in a pill: its padding and icon; "Auto-fixed" and the person's tags carry an icon too.
  const pill = (words: string, icon: boolean) =>
    (textWidth(words, { medium: true, mono: false }) * 12) / 13 + 12 + (icon ? 16 : 0)
  const { words } = input
  let widest = textWidth(words.ready, { medium: false, mono: false })
  for (const view of input.views) {
    if (view.status === "needs" || view.status === "cannot") {
      const kind = O.getOrUndefined(HashMap.get(input.kinds, view.problem?.kind ?? ""))
      const rival = view.problem?.rivals === undefined ? 0 : 6 + xsHint(`row ${rowName(view.row)}`)
      widest = Math.max(widest, pill(kind?.label ?? view.problem?.kind ?? "", true) + rival)
    } else if (view.status === "out") widest = Math.max(widest, pill(words.out, false))
    else if (view.status === "stored") widest = Math.max(widest, pill(words.stored, false))
    else if (view.decided !== undefined)
      widest = Math.max(widest, pill(view.decided === "auto" ? words.auto : words[view.decided], true))
  }
  return Math.ceil(Math.min(statusMost, widest + cellChrome))
}

/** A hint button's width (`xs`, quiet): its words at 12 px and its padding. */
const xsHint = (words: string): number => (textWidth(words, { medium: false, mono: false }) * 12) / 13 + 16

/** The longest values of a column by characters, to measure only those: 50,000 rows are not drawn on a canvas. */
const longest = (values: ReadonlyArray<string>, n: number): ReadonlyArray<string> => {
  const top: Array<string> = []
  for (const value of values) {
    if (top.length < n) top.push(value)
    else {
      let at = 0
      for (let index = 1; index < top.length; index += 1)
        if ((top[index]?.length ?? 0) < (top[at]?.length ?? 0)) at = index
      if (value.length > (top[at]?.length ?? 0)) top[at] = value
    }
  }
  return top
}

/**
 * What each column needs: a `fit` column as wide as its header and the widest value it shows in any loaded row,
 * a proposed change included ("empty", an arrow and the new value in a chip, and its "Why?"); a `fill` column its
 * least width. Measured on a canvas (`@/lib/text-width`), never on an element.
 */
const measureNeeds = (input: {
  columns: ReadonlyArray<ReviewColumn>
  views: ReadonlyArray<RowView>
  /** Group headings are drawn: a row under one is ticked into it and has no "Why?" of its own. */
  banding: boolean
  /** The rows have an expand button before their number. */
  expandable: boolean
}): ReadonlyArray<number> => {
  const { columns, views } = input
  return columns.map((column, index) => {
    const mono = column.code === true
    const header =
      Math.max(
        textWidth(column.label, { medium: true, mono: false }),
        column.unit === undefined ? 0 : textWidth(column.unit, { medium: false, mono: false }) * (12 / 13)
      ) +
      headerChrome +
      (index === 0 ? 30 : 0)
    const least = column.width ?? (column.size === "fill" ? fillLeast : 0)
    if (column.size === "fill") return Math.max(least, index === 0 ? 0 : 0)
    let widest = 0
    for (const value of longest(
      views.map((view) =>
        (view.cells[column.id] ?? "") === "" && column.byDefault !== undefined
          ? `${shownWith(column, column.byDefault, view.cells)}, default`
          : shownWith(column, view.cells[column.id] ?? "", view.cells)
      ),
      40
    ))
      widest = Math.max(widest, textWidth(value, { mono, medium: false }))
    for (const view of views) {
      const mark = view.marks[column.id]
      if (mark === undefined || mark.from === mark.to || view.status === "out") continue
      const from = textWidth(spellingOf(shownWith(column, mark.from, view.cells)), { mono, medium: false })
      const guess = isCellMarkProposed(mark) && choicesOf(mark.fix) !== undefined
      // A mark that draws an icon: a model's sparkle, or the question mark of a suggestion nobody was named for.
      const icon = mark.by === "model" || mark.by === "unknown" ? sparkle : 0
      const to = shownWith(column, mark.to, view.cells)
      const chip = textWidth(to, { mono, medium: true }) + chipChrome + icon
      const value = guess
        ? from + 6 + icon + textWidth(`${to}?`, { mono, medium: false })
        : isCellMarkProposed(mark) && mark.from.trim() === mark.to && to.length > longValue
          ? chip
          : from + arrowGap + chip
      // A proposal carries its "Why?" in the cell, except under a group heading, which says why for all its rows.
      // A question's rows (a `low` fix) keep their own "Why?" under its heading, as the row draws them.
      const banded =
        input.banding && isCellMarkProposed(mark) && mark.fix.group !== undefined && !guess && view.status === "needs"
      // A fix in force carries its "Why?" too, with the way to undo it.
      const asks = isCellMarkProposed(mark) ? !banded : mark.by !== "you" && O.isSome(mark.fix)
      widest = Math.max(widest, value + (asks ? whyButton : 0))
    }
    const cell = index === 0 ? widest + firstChrome + (input.expandable ? expander : 0) : widest + cellChrome
    return Math.ceil(Math.min(fitMost, Math.max(least, header, cell)))
  })
}

/** An `xs` button's width for its words: 12 px text in the medium weight, its padding, and an outline's border. */
const xsButton = (words: string, outline: boolean): number =>
  Math.ceil((textWidth(words, { medium: true, mono: false }) * 12) / 13) + 16 + (outline ? 2 : 0)
// The actions cell's own padding (6 px before, 32 after), its rule, and a few pixels for a face not yet loaded.
const actionsChrome = 6 + 32 + 1 + 6

/**
 * The actions column's width for the rows showing: what the widest row's answers take side by side (its own answer,
 * then "Leave out" or "Other answers"), at least 240 px and at most 360. A row whose answers still do not fit cuts
 * its own answer's words with an ellipsis; the button after it never moves under it.
 */
export const actionsFit = (input: {
  entries: ReadonlyArray<Entry>
  columns: ReadonlyArray<ReviewColumn>
  readOnly: boolean
  rowAction: RowActionFor | undefined
}): number => {
  if (input.readOnly) return actionsQuiet
  if (!input.entries.some((entry) => !isEntryRow(entry) || entry.view.status === "needs")) return actionsQuiet
  let widest = 0
  for (const entry of input.entries) {
    if (!isEntryRow(entry) || entry.view.status !== "needs") continue
    const problem = entry.view.problem
    const subject = problem?.column
    if (problem === undefined) continue
    const proposed = subject === undefined ? undefined : entry.view.marks[subject]
    const fix = proposed !== undefined && isCellMarkProposed(proposed) ? proposed.fix : undefined
    const choices = fix === undefined ? undefined : choicesOf(fix)
    const label = input.columns.find((column) => column.id === subject)?.label ?? subject ?? ""
    const only = problem.choices?.length === 1 ? problem.choices[0] : undefined
    const own =
      problem.choices !== undefined && subject !== undefined
        ? xsButton(only === undefined ? (problem.ask ?? "Choose") : choiceText(only), true)
        : choices !== undefined
          ? choices.reduce(
              (total, choice) => total + xsButton(`Use ${fix === undefined ? choice : valueWords(fix, choice)}`, false),
              0
            )
          : fix !== undefined
            ? 128
            : subject !== undefined
              ? xsButton(problem.ask ?? askFor(label), false)
              : 0
    const after = xsButton(input.rowAction?.(entry.view.row) === undefined ? "Leave out" : "Other answers", false)
    widest = Math.max(widest, Math.max(own, own === 0 ? 0 : 128) + (own === 0 ? 0 : 4) + after)
  }
  return Math.min(actionsMost, Math.max(actionsLeast, Math.ceil(widest + actionsChrome)))
}

const Row = memo(function Row(props: {
  view: RowView
  index: number
  /** Measures the drawn row: a reason in full can take more than one line. */
  measure: (element: Element | null) => void
  columns: ReadonlyArray<ReviewColumn>
  allColumns: ReadonlyArray<ReviewColumn>
  /** Columns whose value sits under the name at this width. */
  under: ReadonlyArray<ReviewColumn>
  /** The value under the name shares a 36px row with it (a desk short of room), not a 44px one (a tablet). */
  dense: boolean
  showStatus: boolean
  /** Columns with no room in the table at this width: they are in the row's detail, opened by the row's button. */
  folded: ReadonlyArray<ReviewColumn>
  expanded: boolean
  onExpand: (rowId: string) => void
  words: ReviewWords
  /** The group heading this row sits under. Its own accept is then the quieter one. */
  group: FixGroup | undefined
  /** The row sits under its group's heading: the heading is the decision, the row only opts out. */
  banded: boolean
  included: boolean
  /** The row sits under its problem kind's heading, so it does not repeat the kind as a tag. */
  sectioned: boolean
  labels: HashMap.HashMap<string, string>
  kinds: HashMap.HashMap<string, ProblemKind>
  actions: RowActions
  groupActions: GroupActions
  readOnly: boolean
  /** The caller's own answer on a row that needs the person (`rowAction` on the region). */
  rowAction: RowActionFor | undefined
  /** The caller's own form for a value the person has to give (`cellEditor` on the region). */
  cellEditor: ReviewRegionProps["cellEditor"]
}) {
  const { view, columns, actions } = props
  const first = columns[0]
  const name = nameOf(view, first)
  // The problem the person can answer here, and the one the row shows: a row nothing here can fix shows its problem
  // (its tag, its reason, the cell it is in) and offers no answer.
  const problem = view.status === "needs" ? view.problem : undefined
  const shownProblem = view.status === "cannot" ? view.problem : problem
  const kind = shownProblem === undefined ? undefined : O.getOrUndefined(HashMap.get(props.kinds, shownProblem.kind))
  const out = view.status === "out"
  const subject = shownProblem?.column
  const proposed = subject === undefined ? undefined : view.marks[subject]
  const fix = proposed !== undefined && isCellMarkProposed(proposed) ? proposed.fix : undefined
  const choices = fix === undefined ? undefined : choicesOf(fix)
  // One status mark per row: the tag. Only a required cell with nothing in it is also tinted, because an empty cell
  // has no ink to point at; a bad value is red text, a proposal is its own mark.
  const subjectEmpty = subject !== undefined && (view.cells[subject] ?? "") === ""
  const hiddenSubject =
    out ||
    subject === undefined ||
    (view.marks[subject] === undefined && subjectEmpty) ||
    columns.some((column) => column.id === subject) ||
    props.under.some((column) => column.id === subject)
      ? undefined
      : props.allColumns.find((column) => column.id === subject)
  const bad = (shownProblem?.tone ?? kind?.tone) === "blocker" && !subjectEmpty
  const rival = problem?.rivals?.[0] === undefined ? undefined : actions.peek(problem.rivals[0])
  const firstAction = { "data-first-action": "" }
  // With the caller's own answer for this row, "Leave out" becomes "Other answers": typing, leaving out, the caller's.
  const extra = props.readOnly || props.banded || problem === undefined ? undefined : props.rowAction?.(view.row)
  const others = otherAnswers({ view, extra })
  const picks = subject === undefined ? undefined : problem?.choices
  // The reason behind a proposal, one click away, in the proposed cell.
  const why: ReactNode =
    fix !== undefined && !props.readOnly && !props.banded ? (
      <Overlay
        title={
          choices === undefined
            ? `Why ${valueWords(fix, fix.to)}?`
            : `${choices.map((choice) => valueWords(fix, choice)).join(" or ")}?`
        }
        about={`Why ${valueWords(fix, fix.to)} is proposed for ${name}`}
        className="w-80"
        hover
        card
        trigger={
          <Button variant="hint" size="xs">
            Why?
            <span className="sr-only">
              {" "}
              {valueWords(fix, fix.to)} for {name}
            </span>
          </Button>
        }
      >
        {(close) => (
          <WhyBody
            fix={fix}
            size="sm"
            onAccept={() => {
              close()
              actions.accept(view.row.id)
            }}
            all={
              props.group === undefined || props.group.rowIds.length < 2
                ? undefined
                : {
                    count: props.group.rowIds.length,
                    onAccept: () => {
                      close()
                      props.groupActions.accept(props.group?.id ?? "")
                    }
                  }
            }
            onPick={(picked) => {
              close()
              if (picked === fix.to) actions.accept(view.row.id)
              else actions.edit(view.row.id, columnFor(fix, picked), picked)
            }}
            onReject={
              actions.reject === undefined
                ? undefined
                : () => {
                    close()
                    actions.reject?.(view.row.id, fix.column)
                  }
            }
          />
        )}
      </Overlay>
    ) : null

  // A fix already in force on a cell says why too, and can be taken out again from there.
  const whyApplied = (column: ReviewColumn): ReactNode => {
    const mark = view.marks[column.id]
    if (props.readOnly || out || mark === undefined || !isCellMarkApplied(mark) || mark.by === "you") return null
    if (O.isNone(mark.fix) || mark.from === mark.to) return null
    const made = mark.fix.value
    return (
      <Overlay
        title={`Why ${valueWords(made, made.to)}?`}
        about={`Why ${column.label} was fixed for ${name}`}
        className="w-80"
        hover
        card
        trigger={
          <Button variant="hint" size="xs">
            Why?
            <span className="sr-only">
              {" "}
              {column.label} was fixed for {name}
            </span>
          </Button>
        }
      >
        {(close) => (
          <WhyBody
            fix={made}
            size="sm"
            onUndoFix={() => {
              close()
              actions.undoFix(view.row.id, column.id)
            }}
          />
        )}
      </Overlay>
    )
  }

  const value = (column: ReviewColumn): ReactNode => {
    if (column.id === reasonColumn.id) {
      const reason = reasonOf({ view, kinds: props.kinds, words: props.words })
      // The whole reason, on as many lines as it takes: it is the sentence the person acts on.
      return reason === "" || view.status === "out" || view.status === "stored" ? null : (
        <span className="block py-1.5 leading-snug whitespace-normal">{reason}</span>
      )
    }
    const isSubject = subject === column.id
    return (
      <span
        className={cn(
          "inline-flex max-w-full items-center gap-1.5",
          codeFace(column),
          out && "text-muted-foreground",
          isSubject && bad && fix === undefined && "font-medium text-destructive"
        )}
      >
        {(out || view.marks[column.id] === undefined) && (view.cells[column.id] ?? "") !== "" ? (
          // A plain value that does not fit ends in an ellipsis; its whole text is one hover, focus or tap away.
          <CutText text={shownWith(column, view.cells[column.id] ?? "", view.cells)} className="min-w-0" />
        ) : (
          <span className="min-w-0 truncate">
            <CellValue
              value={view.cells[column.id] ?? ""}
              display={(text) => shownWith(column, text, view.cells)}
              mark={out ? undefined : view.marks[column.id]}
              accepted={view.decided === "accepted"}
              stated={props.banded}
              empty={
                isSubject ? (
                  <span className="text-destructive">Empty</span>
                ) : column.byDefault !== undefined ? (
                  <DefaultValue column={column} cells={view.cells} />
                ) : (
                  <span className="sr-only">Not set</span>
                )
              }
            />
          </span>
        )}
        {isSubject && !props.showStatus ? compare : null}
        {isSubject ? why : null}
        {whyApplied(column)}
      </span>
    )
  }

  // The other row with the same key, one click away: side by side, where they differ.
  const compare: ReactNode =
    rival === undefined ? null : (
      <Overlay
        title={`Rows ${rowName(view.row)} and ${rowName(rival.row)}`}
        about="The two rows side by side, where they differ"
        className="w-96"
        trigger={
          <Button variant="hint" size="xs">
            {props.showStatus ? "row" : "see row"} {rowName(rival.row)}
            <span className="sr-only">: compare with {name}</span>
          </Button>
        }
      >
        {(close) => (
          <Compare
            view={view}
            other={rival}
            columns={props.allColumns}
            // A viewer compares and cannot keep: the server would refuse, after the screen had already moved on.
            onKeep={
              props.readOnly
                ? undefined
                : (rowId) => {
                    close()
                    actions.keep(rowId)
                  }
            }
          />
        )}
      </Overlay>
    )

  // The person types the value: the panel that asks for it. A weak guess (`weakGuess`) is offered inside it, as one
  // outline button with its evidence, never as the row's own answer.
  const typeIt = (subject: string, guess: Fix | undefined): ReactNode => {
    if (problem === undefined) return null
    const label = O.getOrElse(HashMap.get(props.labels, subject), () => subject)
    const own = props.cellEditor?.({ row: view.row, column: subject, value: view.cells[subject] ?? "" })
    return (
      <Overlay
        title={own?.title ?? `${label} for ${name}`}
        about={`Type the ${label} so ${name} can be imported`}
        align="end"
        {...(own === undefined ? {} : { className: "w-96" })}
        trigger={
          <Button variant="secondary" size="xs" className="min-w-32 shrink" {...firstAction}>
            <span className="truncate">{own?.label ?? problem.ask ?? askFor(label)}</span>
            <span className="sr-only"> for {name}</span>
          </Button>
        }
      >
        {(close) =>
          own !== undefined ? (
            // A form of several fields can be taller than the room under the row: it scrolls inside its panel.
            <ScrollArea className="max-h-96">
              <div className="p-0.5 pr-3">
                {own.render((next) => {
                  close()
                  actions.edit(view.row.id, subject, next)
                })}
              </div>
            </ScrollArea>
          ) : (
            <span className="flex flex-col gap-3">
              {guess === undefined ? null : (
                <span className="flex flex-col gap-1.5">
                  <span className="text-xs text-muted-foreground">{guess.why.basis}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-auto min-h-8"
                    onClick={() => {
                      close()
                      actions.accept(view.row.id)
                    }}
                  >
                    <span className="py-1.5 whitespace-normal">Use {valueWords(guess, guess.to)} (suggested)</span>
                  </Button>
                </span>
              )}
              <EditForm
                label={label}
                size="sm"
                value={view.cells[subject] ?? ""}
                onSave={(next) => {
                  close()
                  actions.edit(view.row.id, subject, next)
                }}
              />
            </span>
          )
        }
      </Overlay>
    )
  }

  // A row's own answer takes at least 128 px and what its words need beyond that, as the actions column was sized
  // for (`actionsFit`). Short of room it cuts its words, never running under the button after it.
  let main: ReactNode = null
  if (problem !== undefined && !props.readOnly && !props.banded) {
    if (picks !== undefined && subject !== undefined) {
      // A pick with no default: every choice is the same outline button, in the caller's order; a suggestion says so
      // in words and is not chosen for the person.
      const only = picks.length === 1 ? picks[0] : undefined
      main =
        only !== undefined ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="xs"
                className="min-w-32 shrink"
                {...firstAction}
                onClick={() => actions.edit(view.row.id, subject, only.value)}
              >
                <span className="truncate">{choiceText(only)}</span>
                <span className="sr-only"> for {name}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>{choiceText(only)}</TooltipContent>
          </Tooltip>
        ) : (
          <Overlay
            title={problem.ask ?? "Choose"}
            about={`The choices for ${name}; none is chosen for you`}
            align="end"
            className="w-80"
            trigger={
              <Button variant="outline" size="xs" className="min-w-32 shrink" {...firstAction}>
                <span className="truncate">{problem.ask ?? "Choose"}</span>
                <span className="sr-only"> for {name}</span>
              </Button>
            }
          >
            {(close) => (
              // Fifteen units are taller than a laptop's screen below the row: the list scrolls inside the panel, on a
              // thin bar of its own that takes no room from the choices.
              <ScrollArea className={picks.length > 7 ? "h-80" : undefined}>
                <span className="flex flex-col gap-2 pr-3">
                  {picks.map((pick) => (
                    <Button
                      key={pick.value}
                      variant="outline"
                      size="sm"
                      className="h-auto min-h-8"
                      onClick={() => {
                        close()
                        actions.edit(view.row.id, subject, pick.value)
                      }}
                    >
                      {/* A suggestion's reason can be long: it wraps inside its button, never past the panel. */}
                      <span className="py-1.5 whitespace-normal">{choiceText(pick)}</span>
                    </Button>
                  ))}
                </span>
              </ScrollArea>
            )}
          </Overlay>
        )
    } else if (subject !== undefined && fix !== undefined && weakGuess(fix)) {
      main = typeIt(subject, fix)
    } else if (fix !== undefined && choices !== undefined) {
      main = (
        <ButtonGroup aria-label={`Choose for ${name}`} className="min-w-32 shrink">
          {choices.map((choice, at) => (
            <Tooltip key={choice}>
              <TooltipTrigger asChild>
                <Button
                  variant="secondary"
                  size="xs"
                  className="min-w-0 flex-1 shrink"
                  {...(at === 0 ? firstAction : {})}
                  onClick={() =>
                    choice === fix.to
                      ? actions.accept(view.row.id)
                      : actions.edit(view.row.id, columnFor(fix, choice), choice)
                  }
                >
                  <span className="truncate">Use {valueWords(fix, choice)}</span>
                  <span className="sr-only"> for {name}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Use {valueWords(fix, choice)}</TooltipContent>
            </Tooltip>
          ))}
        </ButtonGroup>
      )
    } else if (fix !== undefined) {
      main = (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="secondary"
              size="xs"
              className="w-32"
              {...firstAction}
              onClick={() => actions.accept(view.row.id)}
            >
              <span className="truncate">Use {valueWords(fix, fix.to)}</span>
              <span className="sr-only"> for {name}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Use {valueWords(fix, fix.to)}</TooltipContent>
        </Tooltip>
      )
    } else if (subject !== undefined) {
      main = typeIt(subject, undefined)
    }
  }

  return (
    <StickyTableRow
      ref={props.measure}
      data-index={props.index}
      data-row-id={view.row.id}
      // Under a group's heading the decision is the heading's: focus moving to this row goes to its accept.
      data-group={props.banded ? props.group?.id : undefined}
      aria-rowindex={props.index + 2}
    >
      {first === undefined ? null : (
        <StickyTableRowHeader
          grouped={props.group !== undefined}
          tone={subject === first.id && subjectEmpty ? "danger" : undefined}
        >
          <span className="flex items-center gap-2.5">
            {props.folded.length === 0 ? null : (
              <Button
                variant="ghost"
                size="icon-xs"
                className="-mr-1.5 flex-none"
                aria-expanded={props.expanded}
                aria-label={`${props.expanded ? "Hide" : "Show"} ${props.folded.map((column) => column.label).join(", ")} for row ${rowName(view.row)}`}
                onClick={() => props.onExpand(view.row.id)}
              >
                {props.expanded ? <ChevronDownIcon aria-hidden /> : <ChevronRightIcon aria-hidden />}
              </Button>
            )}
            <span className="w-7 flex-none text-right text-xs font-normal text-muted-foreground tabular-nums">
              {view.row.line}
            </span>
            <span className="min-w-0 flex-1">
              {out ? (
                <del className="block font-normal text-muted-foreground">
                  <CutText text={name} />
                </del>
              ) : (view.cells[first.id] ?? "") === "" && view.marks[first.id] === undefined ? (
                // An empty name with a suggestion for it shows the suggestion (who made it, Why?, Reject) instead.
                <span className="font-normal text-destructive">Empty</span>
              ) : (
                <span className="flex min-w-0">{value(first)}</span>
              )}
              {props.under.length === 0 && hiddenSubject === undefined ? null : (
                <span
                  className={cn(
                    "flex gap-2 truncate font-normal text-muted-foreground",
                    // In a 36px row the line is tighter than in a 44px one.
                    props.dense ? "text-xs leading-3.5" : "items-center text-xs leading-4"
                  )}
                >
                  {props.under.map((column) => (
                    <span key={column.id} className="min-w-0">
                      <span className="sr-only">{column.label} </span>
                      {value(column)}
                    </span>
                  ))}
                  {/* The row's problem is in a column this width has no room for: its change is shown here, so
                      every row under a heading still says what it was and what it becomes. */}
                  {hiddenSubject === undefined ? null : (
                    <span className="min-w-0 flex-none">
                      {hiddenSubject.label} {value(hiddenSubject)}
                    </span>
                  )}
                </span>
              )}
            </span>
          </span>
        </StickyTableRowHeader>
      )}
      {props.showStatus ? (
        <StickyTableCell>
          {shownProblem === undefined ? (
            <DecisionTag view={view} words={props.words} />
          ) : (
            <span className="inline-flex max-w-full items-center gap-1.5">
              {props.sectioned ? null : <ReasonTag kind={kind} tone={shownProblem.tone} fallback={shownProblem.kind} />}
              {compare}
            </span>
          )}
        </StickyTableCell>
      ) : null}
      {columns.slice(1).map((column) => (
        <StickyTableCell
          key={column.id}
          align={column.align}
          tone={subject === column.id && subjectEmpty ? "danger" : undefined}
          className={column.id === reasonColumn.id ? "whitespace-normal" : undefined}
        >
          {value(column)}
        </StickyTableCell>
      ))}
      <StickyTableCell pin="end">
        {props.readOnly || view.status === "stored" || view.status === "cannot" ? null : (
          <span className="flex items-center justify-end gap-1">
            {out ? (
              <Button variant="ghost" size="xs" {...firstAction} onClick={() => actions.putBack(view.row.id)}>
                Put back<span className="sr-only"> {name}</span>
              </Button>
            ) : problem !== undefined && props.banded ? (
              // The table drops a cell's end padding when it holds a checkbox, so this wrapper carries the gutter.
              <span className="flex items-center gap-2 pr-4 sm:pr-8">
                <Checkbox
                  checked={props.included}
                  aria-label={`In this fix: ${name}`}
                  {...firstAction}
                  onCheckedChange={() => props.groupActions.toggle(view.row.id)}
                />
              </span>
            ) : problem !== undefined && others !== undefined && extra !== undefined ? (
              <>
                {main}
                <Overlay
                  title={`Other answers for row ${rowName(view.row)}`}
                  about={`Type a value, leave row ${rowName(view.row)} out, or the page's own answer for ${name}`}
                  align="end"
                  className="w-80"
                  trigger={
                    <Button variant="quiet" size="xs" {...(main === null ? firstAction : {})}>
                      Other answers<span className="sr-only"> for {name}</span>
                    </Button>
                  }
                >
                  {(close) => (
                    <span className="flex flex-col gap-3">
                      {others.map((answer) =>
                        OtherAnswer.$match(answer, {
                          Type: () =>
                            subject === undefined ? null : (
                              <EditForm
                                key="type"
                                label={O.getOrElse(HashMap.get(props.labels, subject), () => subject)}
                                size="sm"
                                value=""
                                onSave={(next) => {
                                  close()
                                  actions.edit(view.row.id, subject, next)
                                }}
                              />
                            ),
                          LeaveOut: ({ label }) => (
                            <Button
                              key="leave-out"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                close()
                                actions.leaveOut(view.row.id)
                              }}
                            >
                              {label}
                            </Button>
                          ),
                          Extra: ({ label }) => (
                            <Button
                              key="extra"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                close()
                                extra.onSelect()
                              }}
                            >
                              {label}
                            </Button>
                          )
                        })
                      )}
                    </span>
                  )}
                </Overlay>
              </>
            ) : problem !== undefined ? (
              <>
                {main}
                <Button
                  variant="quiet"
                  size="xs"
                  {...(main === null ? firstAction : {})}
                  onClick={() => actions.leaveOut(view.row.id)}
                >
                  Leave out<span className="sr-only"> {name}</span>
                </Button>
              </>
            ) : (
              <span
                className={
                  view.decided === undefined || view.decided === "auto"
                    ? "opacity-0 group-hover/row:opacity-100 focus-within:opacity-100"
                    : undefined
                }
              >
                <Button variant="quiet" size="xs" {...firstAction} onClick={() => actions.leaveOut(view.row.id)}>
                  Leave out<span className="sr-only"> {name}</span>
                </Button>
              </span>
            )}
          </span>
        )}
      </StickyTableCell>
    </StickyTableRow>
  )
})

/** A line of the table: one of the region's entries, or the detail opened under a row. */
/** A row's detail, drawn under it when the row is opened. */
type Opened = Data.TaggedEnum<{ Detail: { readonly view: RowView } }>
const Opened = Data.taggedEnum<Opened>()
const isOpenedDetail = Opened.$is("Detail")

type Line = Entry | Opened

/** Every kind of line the grid draws, named: a new kind cannot be drawn without each pass saying what it does with it. */
const lineMatch = <R,>(
  line: Line,
  cases: {
    readonly Row: (line: Extract<Entry, { readonly type: "row" }>) => R
    readonly Group: (line: Extract<Entry, { readonly type: "group" }>) => R
    readonly Kind: (line: Extract<Entry, { readonly type: "kind" }>) => R
    readonly Rest: (line: Extract<Entry, { readonly type: "rest" }>) => R
    readonly Detail: (line: Extract<Opened, { readonly _tag: "Detail" }>) => R
  }
) =>
  isOpenedDetail(line)
    ? Opened.$match(line, { Detail: cases.Detail })
    : Entry.match(line, { row: cases.Row, group: cases.Group, kind: cases.Kind, rest: cases.Rest })

/** The columns with no room in the table at this width, under their row: each label and its value, change and all. */
/** An empty cell that takes a default when imported: the default, quieter, and said to be one ("0 EA, default"). */
function DefaultValue(props: { column: ReviewColumn; cells: Readonly<Record<string, string>> }) {
  return (
    <span className="text-muted-foreground">
      {shownWith(props.column, props.column.byDefault ?? "", props.cells)}
      <span className="text-xs">, default</span>
    </span>
  )
}

function Detail(props: { view: RowView; columns: ReadonlyArray<ReviewColumn> }) {
  const { view } = props
  return (
    // Lined up with the row's name: past the expand button and the row number.
    <dl className="flex flex-wrap gap-x-8 gap-y-1.5 py-2 pl-16">
      {props.columns.map((column) => (
        <div key={column.id} className="flex min-w-0 flex-col">
          <dt className="text-xs text-muted-foreground">
            {column.label}
            {column.unit === undefined ? null : ` (${column.unit})`}
          </dt>
          <dd className={cn("min-w-0 whitespace-normal", codeFace(column))}>
            <CellValue
              value={view.cells[column.id] ?? ""}
              display={(text) => shownWith(column, text, view.cells)}
              mark={view.status === "out" ? undefined : view.marks[column.id]}
              accepted={view.decided === "accepted"}
              empty={
                column.byDefault !== undefined ? (
                  <DefaultValue column={column} cells={view.cells} />
                ) : (
                  <span className="text-muted-foreground">Not set</span>
                )
              }
            />
          </dd>
        </div>
      ))}
    </dl>
  )
}

/**
 * The heading of the problem kind on screen: its name, how many rows, what they need, and its answers for all of them.
 * The work list beside the table picks the kind, so the heading no longer folds.
 */
function KindRow(props: {
  entry: Extract<Entry, { readonly type: "kind" }>
  span: number
  index: number
  actions: GroupActions
  readOnly: boolean
}) {
  const { kind, rowIds, safe } = props.entry
  return (
    <StickyTableBand span={props.span} data-kind-id={kind.id} aria-rowindex={props.index + 2}>
      <div className="flex items-center gap-3">
        <span className="flex flex-none items-center gap-1.5">
          <span className="text-sm font-semibold">{kind.label}</span>
          <span className="text-muted-foreground tabular-nums">{rowIds.length}</span>
        </span>
        <span className="min-w-0 flex-1 truncate text-muted-foreground">{kind.help}</span>
        {props.readOnly || safe.length === 0 ? null : (
          <Button variant="secondary" size="xs" onClick={() => props.actions.acceptRows(safe)}>
            Accept {safe.length} safe {safe.length === 1 ? "fix" : "fixes"}
          </Button>
        )}
        {props.readOnly ? null : (
          <Button variant="quiet" size="xs" onClick={() => props.actions.leaveOut(rowIds)}>
            Leave out {rowIds.length}
          </Button>
        )}
      </div>
    </StickyTableBand>
  )
}

/**
 * A group of identical fixes as one decision, directly above the rows it would change, and the only place it is
 * offered. Two lines lined up with the columns below: the change (the file's spellings, an arrow, the proposed value,
 * how many rows) and under it the reason in full with who proposed it. Its answers sit under the actions column: the
 * accept, then the quieter ones, behind one "More" when the column has no room for them side by side.
 */
function GroupRow(props: {
  group: FixGroup
  applied: boolean
  /** This group's accept is the screen's one filled button: the next thing to do. */
  lead: boolean
  span: number
  index: number
  excluded: HashSet.HashSet<string>
  /** Its rows are ticked into it; without ticks (rows keep their own answers) it acts on all of them. */
  ticks: boolean
  labels: HashMap.HashMap<string, string>
  actions: GroupActions
  readOnly: boolean
  /** The rows below have an expand button before their number: the heading's text starts where their names do. */
  indent: boolean
  /** The actions column's width, to tell whether the quiet answers fit beside each other. */
  actionsWidth: number
  measure: (element: Element | null) => void
  /** How the group's column shows a value (`ReviewColumn.display`). */
  display?: ((value: string) => string) | undefined
}) {
  const { group } = props
  const rowIds = group.rowIds.filter((rowId) => !HashSet.has(props.excluded, rowId))
  const n = rowIds.length
  const choices = choicesOf(group)
  const column = O.getOrElse(HashMap.get(props.labels, group.column), () => group.column)
  const other = `Other ${inSentence(column)}`
  const leaveOut = `Leave out ${n}`
  // The quiet answers side by side when the column has room for both, else behind one button.
  const sideBySide = xsButton(other, false) + 4 + xsButton(leaveOut, false) + actionsChrome <= props.actionsWidth
  const typeOther = (close: () => void) => (
    <EditForm
      label={column}
      size="sm"
      value=""
      onSave={(next) => {
        close()
        props.actions.choose(group.id, next)
      }}
    />
  )
  const answers: ReactNode = props.readOnly ? null : props.applied ? (
    <Button variant="outline" size="xs" onClick={() => props.actions.revert(group.id)}>
      Undo {n} {n === 1 ? "fix" : "fixes"}
    </Button>
  ) : (
    <span className="flex flex-col items-end gap-1">
      {choices !== undefined ? (
        // A guess: the person picks, so no choice is the filled button.
        // Three long answers side by side would run over the question beside them: they stack instead.
        <ButtonGroup
          aria-label={`Choose for the ${n} ticked rows`}
          orientation={choices.length > 2 ? "vertical" : "horizontal"}
        >
          {choices.map((choice) => (
            <Button
              key={choice}
              variant="outline"
              size="xs"
              disabled={n === 0}
              onClick={() => props.actions.choose(group.id, choice)}
            >
              Use {valueWords(group, choice)} for {n}
            </Button>
          ))}
        </ButtonGroup>
      ) : (
        <Button
          variant={props.lead ? "default" : "secondary"}
          size="xs"
          disabled={n === 0}
          data-group-accept=""
          onClick={() => props.actions.accept(group.id)}
        >
          {groupUse({ group, n, ticks: props.ticks })}
        </Button>
      )}
      {sideBySide ? (
        <span className="flex items-center gap-1">
          <Overlay
            title={`${other} for ${rowsWord(n)}`}
            about={`Type the ${column} these rows should have`}
            align="end"
            trigger={
              <Button variant="quiet" size="xs" disabled={n === 0}>
                {other}
              </Button>
            }
          >
            {typeOther}
          </Overlay>
          <Button variant="quiet" size="xs" disabled={n === 0} onClick={() => props.actions.leaveOut(rowIds)}>
            {leaveOut}
          </Button>
        </span>
      ) : (
        <Overlay
          title={`Other answers for ${rowsWord(n)}`}
          about={`Type the ${column} these rows should have, or leave them out`}
          align="end"
          className="w-72"
          trigger={
            <Button variant="quiet" size="xs" disabled={n === 0}>
              More answers
            </Button>
          }
        >
          {(close) => (
            <span className="flex flex-col gap-3">
              {typeOther(close)}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  close()
                  props.actions.leaveOut(rowIds)
                }}
              >
                {leaveOut}
              </Button>
            </span>
          )}
        </Overlay>
      )}
    </span>
  )
  return (
    <StickyTableBand
      span={props.span}
      data-group-id={group.id}
      data-index={props.index}
      ref={props.measure}
      aria-rowindex={props.index + 2}
      end={answers}
    >
      {/* Lined up with the names of the rows below: past their expand button and their row number. */}
      <div className={cn("flex min-w-0 flex-col gap-0.5", props.indent ? "pl-16" : "pl-10")}>
        <span className="flex min-w-0 items-center gap-2 text-sm font-semibold">
          {choices === undefined ? null : (
            // A question, marked as the caller says who asks it: the sparkle only for a model.
            <StatusPill
              tone="outline"
              icon={group.by === "model" ? <SparklesIcon aria-hidden /> : <CircleHelpIcon aria-hidden />}
            >
              Guess
            </StatusPill>
          )}
          <GroupChange group={group} applied={props.applied} oneLine display={props.display} />
          <Badge variant="secondary" className="flex-none">
            {rowsWord(group.rowIds.length)}
          </Badge>
        </span>
        <span className="flex min-w-0 items-start gap-2 text-sm">
          <Badge variant="outline" className="mt-0.5 flex-none">
            {sourceWordsFor(group.by === "unknown" ? undefined : group.by).tag}
          </Badge>
          <span className="min-w-0 text-muted-foreground">
            {group.why.basis}
            {group.why.detail === undefined ? null : ` ${group.why.detail}`}
            {
              <>
                {" "}
                <Overlay
                  title={
                    choices !== undefined
                      ? `Why ${choices.map((choice) => valueWords(group, choice)).join(" or ")}?`
                      : group.mixed === true
                        ? "Why this change?"
                        : `Why ${group.label ?? valueWords(group, group.to)}?`
                  }
                  card
                  about="What the proposal is based on"
                  hover
                  side="top"
                  className="w-80"
                  trigger={
                    <Button variant="hint" size="xs">
                      Why?
                    </Button>
                  }
                >
                  {/* The proposal's own evidence, whatever its kind; then what pressing nothing means. */}
                  <p>
                    <Reason fix={group} />
                  </p>
                  <p className="text-muted-foreground">
                    {props.applied
                      ? `In force on ${rowsWord(group.rowIds.length)}. Undo it here, or on one row from its own Why?`
                      : `Nothing changes on ${rowsWord(group.rowIds.length)} until you choose.`}
                  </p>
                </Overlay>
              </>
            }
          </span>
        </span>
      </div>
    </StickyTableBand>
  )
}

/** The headings a row sits under: the group whose heading is above it, and whether a kind's heading is. */
type Heading = { readonly group: FixGroup | undefined; readonly sectioned: boolean }

/** What the grid notes of the lines it was last given: when to measure again, and when to go back to the top. */
type Sign = {
  readonly hash: number
  readonly firstKey: string
  readonly length: number
  readonly measure: number
  readonly top: number
}

/**
 * The virtual list of one grid: TanStack's, which keeps the scroll position and the lines' measured sizes. The grid
 * makes it and owns it; no draw writes its options.
 */
type Lines = Virtualizer<HTMLDivElement, Element>

/** The first and last line in view. */
type Seen = { readonly startIndex: number; readonly endIndex: number }

/** The lines drawn and where (each one's place and height), and the height of all of them. */
type Drawn = { readonly items: ReadonlyArray<VirtualItem>; readonly total: number }

const nothingDrawn: Drawn = { items: [], total: 0 }

/** What one grid works out for the room it has, and the rows the person opened in it. */
export interface Grid {
  /** False while every row on screen has the same status and a group heading says it. */
  readonly showStatus: Atom.Atom<boolean>
  readonly statusWidth: Atom.Atom<number>
  /** As wide as the widest answers showing (a long pick, "Other answers"), so no button runs under the next. */
  readonly actionsWidth: Atom.Atom<number>
  /** Which columns are drawn at which width, and which move into the row's detail, for the room there is. */
  readonly plan: Atom.Atom<ReturnType<typeof planColumns>>
  /**
   * The plan's columns in three parts: drawn, under the name, and in the row's detail. The same object while the
   * parts hold the same columns, so a decision that changes no width draws no row again.
   */
  readonly parts: Atom.Atom<Parts>
  /** True where no row has an answer of the caller's own: a row under a group's heading is then ticked into it. */
  readonly banding: Atom.Atom<boolean>
  /** The rows opened to show their detail. */
  readonly expanded: Atom.Atom<HashSet.HashSet<string>>
  /** The region's lines, with each opened row's detail under it. */
  readonly entries: Atom.Atom<ReadonlyArray<Line>>
  /** For each line that is a row, the headings it sits under. */
  readonly headings: Atom.Atom<ReadonlyArray<Heading | undefined>>
  /** Every column's label by id. */
  readonly labels: Atom.Atom<HashMap.HashMap<string, string>>
  /** A row's height: 44 px with more air, or when a value sits under the name; else 36 px. */
  readonly rowSize: Atom.Atom<number>
  /** A new value when the lines' sizes may have changed (a heading came or went, a detail opened). */
  readonly measured: Atom.Atom<number>
  /** A new value when the list is another list: a new view starts at its first line. */
  readonly top: Atom.Atom<number>
  /**
   * The lines in view, of the lines as they are now: none before the list has a frame, or with nothing to show.
   * What the virtual list says of a scroll, a new size of its frame or a line measured anew reaches it as it says it.
   */
  readonly seen: Atom.Atom<O.Option<Seen>>
  /** The lines to draw and where, with the height of all of them: what the grid's draw reads of the virtual list. */
  readonly drawn: Atom.Atom<Drawn>
  /**
   * The rule group whose accept is the screen's one filled button: the first in view that the person can take in
   * one press, while they can decide here and the confirm step is not open. Scrolled away, it hands the role back.
   */
  readonly lead: Atom.Atom<string | undefined>
  /** True while a rule group's accept leads: Import then waits. */
  readonly leadInView: Atom.Atom<boolean>
  /** Opens or closes one row's detail. */
  readonly toggle: (rowId: string) => void
  /** Where a row is among the lines drawn, or -1. */
  readonly indexOf: (rowId: string) => number
  readonly toTop: () => void
  /** The virtual list itself, made with the grid and owned by it. */
  readonly list: Lines
  /**
   * The frame's ref: the element the list scrolls. The list follows it as TanStack's React adapter has it follow one
   * after a draw: a new frame is watched (its size, its scroll), a frame gone is let go of.
   */
  readonly frame: (element: HTMLDivElement | null) => void
  /** A drawn line's ref: the list measures it, and measures it again whenever its size changes. */
  readonly measureLine: (element: Element | null) => void
  /** Measures every line again, for when the lines changed shape. */
  readonly remeasure: () => void
  /** For the region's ask to have a row in view: scrolls the list to it. */
  readonly bring: (asked: O.Option<{ readonly rowId: string }>) => void
}

/** The plan's columns in three parts. */
type Parts = {
  readonly columns: ReadonlyArray<ReviewColumn>
  readonly under: ReadonlyArray<ReviewColumn>
  readonly folded: ReadonlyArray<ReviewColumn>
}

/** True when two lists hold the very same things in the same order. */
const sameList = <T,>(before: ReadonlyArray<T>, next: ReadonlyArray<T>): boolean =>
  before.length === next.length && A.every(before, (item, index) => Object.is(item, next[index]))

const sameParts = (before: Parts, next: Parts): boolean =>
  sameList(before.columns, next.columns) && sameList(before.under, next.under) && sameList(before.folded, next.folded)

const sameSeen = (before: O.Option<Seen>, next: O.Option<Seen>): boolean =>
  O.isSome(before) && O.isSome(next)
    ? before.value.startIndex === next.value.startIndex && before.value.endIndex === next.value.endIndex
    : O.isNone(before) && O.isNone(next)

/** A group heading whose accept can lead: a rule's fix waiting, taken in one press (no choice to make). */
const canLeadLine = (line: Line): line is Extract<Line, { readonly type: "group" }> =>
  isEntryGroup(line) && !line.applied && choicesOf(line.group) === undefined

/**
 * Makes one grid's atoms and its virtual list, in the atom that holds the grid (`ctx`): the list is given the number
 * of lines by a subscription that lives as long as that atom.
 */
const makeGrid = (input: { readonly region: Region; readonly table: RegionTable }, ctx: Atom.AtomContext): Grid => {
  const { region, table } = input
  const registry = ctx.registry
  const readOnly = region.input.readOnly
  const rowAction = Atom.map(region.input.rowAction, O.getOrUndefined)
  const banding = Atom.map(rowAction, (answer) => answer === undefined)
  // In the grouped views the headings say the status, so the column would be empty: its width goes to the name.
  // Nor when every row showing would say the same word ("Ready", before anything was decided).
  const showStatus = Atom.readable((get) => {
    const filter = get(region.filter)
    return (
      filter !== "auto" &&
      filter !== "needs" &&
      A.some(get(table.ordered), (view) => view.status !== "ready" || view.decided !== undefined)
    )
  })
  const statusWidth = Atom.readable((get) =>
    get(showStatus) ? statusFit({ views: get(region.list), kinds: get(region.kinds), words: get(region.words) }) : 0
  )
  const actionsWidth = Atom.readable((get) =>
    get(regionLayout) === "narrow"
      ? 0
      : actionsFit({
          entries: get(table.lines),
          columns: get(region.input.columns),
          readOnly: get(readOnly),
          rowAction: get(rowAction)
        })
  )
  // -- Widths: each `fit` column as wide as its widest value, the `fill` columns share the rest; short of room the
  // lowest priority moves into the row's detail (an `under` column under the name), never cut. -----------------
  // The table is worked out from the columns the person is showing. A column they turned on themselves (`true`: off
  // is `false`, untouched is absent) never moves into the row's detail: they asked to see it, so the table scrolls
  // sideways before it goes. Nor do the columns the problems on screen are about: the person is deciding on them.
  // Each of these is kept while it says the same: a decision makes the list anew, and the widths rarely with it.
  const keep = Atom.withEquality(
    Atom.readable((get) => {
      const visibility = get(table.visibility)
      return HashSet.union(
        HashSet.fromIterable(Object.keys(visibility).filter((id) => visibility[id] === true)),
        get(region.subjects)
      )
    }),
    Eq.equals
  )
  // Every row that needs the person or cannot be fixed here says why, in its own column after the name and status.
  const reasons = Atom.readable((get) =>
    A.some(get(region.list), (view) => view.status === "needs" || view.status === "cannot")
  )
  const shownColumns = Atom.readable((get): ReadonlyArray<ReviewColumn> => {
    const visibility = get(table.visibility)
    const columns = A.filter(get(region.input.columns), (column) => visibility[column.id] !== false)
    return get(reasons) && columns.length > 0 ? [...columns.slice(0, 1), reasonColumn, ...columns.slice(1)] : columns
  })
  // Group headings are drawn in this view: a row under one has no "Why?" of its own.
  const bands = Atom.readable((get) => get(banding) && A.some(get(table.lines), isEntryGroup))
  const needs = Atom.withEquality(
    Atom.readable((get) =>
      measureNeeds({ columns: get(shownColumns), views: get(region.list), banding: get(bands), expandable: false })
    ),
    sameList
  )
  const plan = Atom.withEquality(
    Atom.readable((get) => {
      const columns = get(shownColumns)
      const measured = get(needs)
      const kept = get(keep)
      const fixed = get(statusWidth) + get(actionsWidth)
      const room = get(region.gridRoom)
      const sized = columns.map((column, index) => ({
        id: column.id,
        size: column.size ?? ("fit" as const),
        need: measured[index] ?? column.width ?? fillLeast,
        priority: priorityOf(column),
        keep: index === 0 || column.id === reasonColumn.id || HashSet.has(kept, column.id)
      }))
      const first = planColumns({ columns: sized, fixed, room })
      const detailed = first.folded.some((id) => columns.find((column) => column.id === id)?.under !== true)
      const head = sized[0]
      // Rows with a detail carry a button before their number: a first column sized to its values makes room for it.
      return detailed && head !== undefined && head.size === "fit"
        ? planColumns({ columns: [{ ...head, need: head.need + expander }, ...sized.slice(1)], fixed, room })
        : first
    }),
    // A plan is ids and widths: two that read the same are the same plan.
    (before, next) => stringify(before) === stringify(next)
  )
  const parts = Atom.withEquality(
    Atom.readable((get): Parts => {
      const now = get(plan)
      const columns = get(shownColumns)
      return {
        columns: A.filter(columns, (column) => A.some(now.shown, (shown) => shown.id === column.id)),
        under: A.filter(columns, (column) => A.contains(now.folded, column.id) && column.under === true),
        folded: A.filter(columns, (column) => A.contains(now.folded, column.id) && column.under !== true)
      }
    }),
    sameParts
  )
  const expanded = Atom.make(HashSet.empty<string>())
  const entries = Atom.readable((get): ReadonlyArray<Line> => {
    const lines = get(table.lines)
    const open = get(expanded)
    return get(parts).folded.length === 0 || HashSet.size(open) === 0
      ? lines
      : lines.flatMap((entry): ReadonlyArray<Line> =>
          isEntryRow(entry) && HashSet.has(open, entry.view.row.id)
            ? [entry, Opened.Detail({ view: entry.view })]
            : [entry]
        )
  })
  const labels = Atom.map(region.input.columns, (columns) =>
    HashMap.fromIterable(A.map(columns, (column) => [column.id, column.label] as const))
  )
  // What each row sits under, in one pass down the lines: the nearest group heading above it with no kind's heading
  // between, and whether any kind's heading is above it. Rows under the same headings share one answer.
  const headings = Atom.map(entries, (lines): ReadonlyArray<Heading | undefined> => {
    const found: Array<Heading | undefined> = []
    let under: Heading = { group: undefined, sectioned: false }
    for (const line of lines) {
      under = lineMatch(line, {
        Kind: (): Heading => ({ group: undefined, sectioned: true }),
        Group: ({ group }): Heading => ({ group, sectioned: under.sectioned }),
        Row: () => under,
        Rest: () => under,
        Detail: () => under
      })
      found.push(isEntryRow(line) ? under : undefined)
    }
    return found
  })
  // Group headings change the sizes, and a new filter starts at its first line.
  const sign = Atom.readable((get): Sign => {
    const now = get(entries)
    let hash = 0
    for (const entry of now) {
      // A row, a row's detail, or a heading: each of another height.
      const shape = lineMatch(entry, { Row: () => 1, Detail: () => 2, Group: () => 3, Kind: () => 3, Rest: () => 3 })
      hash = (Math.imul(hash, 31) + shape) | 0
    }
    const head = now[0]
    const firstKey =
      head === undefined
        ? ""
        : lineMatch(head, {
            Row: (line) => line.view.row.id,
            Detail: () => "detail",
            Group: () => "group",
            Kind: () => "kind",
            Rest: () => "rest"
          })
    return O.match(get.self<Sign>(), {
      onNone: () => ({ hash, firstKey, length: now.length, measure: 0, top: 0 }),
      onSome: (before) =>
        before.hash === hash && before.firstKey === firstKey && before.length === now.length
          ? before
          : {
              hash,
              firstKey,
              length: now.length,
              measure: before.measure + 1,
              top:
                before.firstKey !== firstKey && Math.abs(before.length - now.length) > 1 ? before.top + 1 : before.top
            }
    })
  })
  // A value under the name takes a second line: such rows are 44 px whatever the density, so the virtual list's
  // estimate matches what is drawn.
  const rowSize = Atom.readable((get) =>
    get(keptDensity) === "comfortable" || get(parts).under.length > 0 ? tallRowHeight : rowHeight
  )

  const sizeOf = (index: number): number => {
    const line = registry.get(entries)[index]
    return line === undefined
      ? bandHeight
      : lineMatch(line, {
          Row: () => registry.get(rowSize),
          Group: () => groupHeight,
          Kind: () => bandHeight,
          Rest: () => bandHeight,
          Detail: () => bandHeight
        })
  }

  // -- The virtual list is TanStack's: where the frame is scrolled to and how tall each line was measured are its
  // own. The grid makes it and owns it, and listens to it as an atom listens to anything outside: `heard` goes up
  // whenever it says what is in view may have changed, `given` whenever it is given another number of lines, and
  // `scroller` is the frame it scrolls. Each lives as long as the grid.
  const heard = Atom.make(0)
  const given = Atom.make(0)
  const scroller = Atom.make<O.Option<HTMLDivElement>>(O.none())
  ctx.mount(heard)
  ctx.mount(given)
  ctx.mount(scroller)
  // What TanStack's React adapter does after each draw, once the screen shows what the list last said: a correction
  // the browser clamped because the space below had not grown yet is written again, a held one is written.
  const afterDraw = () => list._willUpdate()
  const told = () => {
    registry.update(heard, (n) => n + 1)
    requestAnimationFrame(afterDraw)
  }
  const list: Lines = new Virtualizer<HTMLDivElement, Element>({
    count: registry.get(entries).length,
    getScrollElement: () => O.getOrNull(registry.get(scroller)),
    estimateSize: sizeOf,
    overscan: 12,
    // A new size of the frame is told even when the range stays: the lines in view are read again all the same.
    observeElementRect: (instance, onRect) =>
      observeElementRect(instance, (rect) => {
        onRect(rect)
        told()
      }),
    observeElementOffset,
    scrollToFn: elementScroll,
    onChange: told
  })
  // The list is given the number of lines where the lines are worked out: whenever they change, in the change that
  // changed them, before anything reads what is in view. No read of an atom and no draw writes the list's options.
  ctx.subscribe(entries, (lines) => {
    if (list.options.count === lines.length) return
    list.setOptions({ ...list.options, count: lines.length })
    registry.update(given, (n) => n + 1)
    requestAnimationFrame(afterDraw)
  })
  // The lines' number and the list's agree, but for the moment between the lines being worked out and the list being
  // given their number (the same change): a read then keeps what it had, and `given` reads it again a moment later.
  const inStep = (lines: ReadonlyArray<Line>): boolean => list.options.count === lines.length
  const seen = Atom.withEquality(
    Atom.readable((get): O.Option<Seen> => {
      const lines = get(entries)
      get(given)
      get(heard)
      get(rowSize)
      if (O.isNone(get(scroller))) return O.none()
      if (!inStep(lines)) return O.flatten(get.self<O.Option<Seen>>())
      return O.map(O.fromNullOr(list.calculateRange()), ({ endIndex, startIndex }) => ({
        startIndex,
        endIndex
      }))
    }),
    sameSeen
  )
  const drawn = Atom.withEquality(
    Atom.readable((get): Drawn => {
      const lines = get(entries)
      get(given)
      get(heard)
      get(rowSize)
      get(scroller)
      if (!inStep(lines)) return O.getOrElse(get.self<Drawn>(), () => nothingDrawn)
      return { items: list.getVirtualItems(), total: list.getTotalSize() }
    }),
    (before, next) => before.items === next.items && before.total === next.total
  )
  const canLead = Atom.readable(
    (get) => !get(readOnly) && get(region.filter) === "needs" && !get(region.ui).confirmOpen
  )
  const lead = Atom.readable((get): string | undefined => {
    if (!get(canLead)) return undefined
    const range = get(seen)
    if (O.isNone(range)) return undefined
    const { endIndex, startIndex } = range.value
    const inView = A.take(A.drop(get(entries), startIndex), endIndex + 1 - startIndex)
    return O.getOrUndefined(A.findFirst(inView, canLeadLine))?.group.id
  })
  const indexOf = (rowId: string) =>
    O.getOrElse(
      A.findFirstIndex(registry.get(entries), (entry) => isEntryRow(entry) && entry.view.row.id === rowId),
      () => -1
    )

  return {
    showStatus,
    statusWidth,
    actionsWidth,
    plan,
    parts,
    banding,
    expanded,
    entries,
    headings,
    labels,
    rowSize,
    measured: Atom.map(sign, (now) => now.measure),
    top: Atom.map(sign, (now) => now.top),
    seen,
    drawn,
    lead,
    leadInView: Atom.map(lead, (id) => id !== undefined),
    toggle: (rowId) =>
      registry.update(expanded, (before) =>
        HashSet.has(before, rowId) ? HashSet.remove(before, rowId) : HashSet.add(before, rowId)
      ),
    indexOf,
    toTop: () =>
      document
        .querySelector(`[data-review-region="${region.id}"] [data-slot="sticky-table-frame"]`)
        ?.scrollTo({ top: 0 }),
    list,
    frame: (element) => {
      registry.set(scroller, O.fromNullOr(element))
      list._willUpdate()
    },
    measureLine: list.measureElement,
    remeasure: list.measure,
    bring: (asked) => {
      if (O.isNone(asked) || O.isNone(registry.get(scroller))) return
      const index = indexOf(asked.value.rowId)
      if (index !== -1) list.scrollToIndex(index, { align: "auto" })
    }
  }
}

/** One grid's atoms and its virtual list, as an atom made in the registry that first reads it. */
export const gridAtom = (input: { readonly region: Region; readonly table: RegionTable }) =>
  Atom.readable((get) => makeGrid(input, get))

/** One grid's atoms, made once from the region it is in: its parts and the region's footer read them from here. */
export const GridScope = ScopedAtom.make(gridAtom)

type GridProps = {
  /** The one table instance: its column headers carry the sort and hide menu. */
  table: TanstackTable<DataTableFeatures, RowView>
  loading: boolean
  caption: string
  /** One row across the table when the filter has nothing to show. */
  empty: ReactNode
  onMatch: ((columnId: string, source: string) => void) | undefined
  /** The caller's own form for a value the person has to give: read when a row is drawn. */
  cellEditor: ReviewRegionProps["cellEditor"]
  /** Inside a card: the card's edge is the gutter, and the frame draws no rules of its own above and below. */
  framed?: boolean
}

/**
 * The rows as a native table that scrolls inside its own frame: sticky header, the name column frozen on the left
 * and the row's actions on the right. Only the lines near the viewport are in the document. It reads the region it
 * is in (`RegionScope`, `TableScope`, `GridScope`): the lines, the rows, the actions.
 */
export function ReviewGrid(props: GridProps) {
  const region = useAtomValue(RegionScope.use())
  const regionTable = useAtomValue(TableScope.use())
  const grid = useAtomValue(GridScope.use())
  const allColumns = useAtomValue(region.input.columns)
  const excluded = useAtomValue(region.ui).excluded
  const density = useAtomValue(keptDensity)
  const readOnly = useAtomValue(region.input.readOnly)
  const ownAnswer = useAtomValue(region.input.rowAction)
  const rowAction = O.getOrUndefined(ownAnswer)
  const showStatus = useAtomValue(grid.showStatus)
  const statusWidth = useAtomValue(grid.statusWidth)
  const actionsWidth = useAtomValue(grid.actionsWidth)
  const plan = useAtomValue(grid.plan)
  const { columns, under, folded } = useAtomValue(grid.parts)
  const expanded = useAtomValue(grid.expanded)
  const entries = useAtomValue(grid.entries)
  const headings = useAtomValue(grid.headings)
  const labels = useAtomValue(grid.labels)
  const banding = useAtomValue(grid.banding)
  const height = useAtomValue(grid.rowSize)
  const lead = useAtomValue(grid.lead)
  const words = useAtomValue(region.words)
  const kinds = useAtomValue(region.kinds)
  const actions = useAtomValue(region.rejects) ? regionTable.actions : regionTable.plainActions
  const groupActions = regionTable.groupActions

  // The virtual list is the grid's, given its lines' number where the lines are worked out: the draw only reads it.
  const { items, total } = useAtomValue(grid.drawn)
  // When the lines change shape the sizes are measured again, and another list starts at its first line.
  useAtomSubscribe(grid.measured, grid.remeasure)
  useAtomSubscribe(grid.top, grid.toTop)
  // The region asks for a row to be in view before it puts the focus there.
  useAtomSubscribe(region.reveal, grid.bring)

  const padTop = items[0]?.start ?? 0
  const padBottom = total - (items[items.length - 1]?.end ?? 0)
  const span = columns.length + (showStatus ? 2 : 1)
  // The flex column is drawn without a width and takes what the others leave, so rounding never opens a gap.
  const widthOf = (id: string): number | undefined =>
    O.contains(plan.flex, id) ? undefined : plan.shown.find((shown) => shown.id === id)?.width
  const widths = [
    widthOf(columns[0]?.id ?? ""),
    ...(showStatus ? [statusWidth] : []),
    ...columns.slice(1).map((column) => widthOf(column.id)),
    actionsWidth
  ]
  return (
    <StickyTableFrame ref={grid.frame} label={props.caption} framed={props.framed === true}>
      <StickyTable
        caption={props.caption}
        widths={widths}
        minWidth={plan.minWidth}
        rowHeight={height}
        rowCount={entries.length + 1}
      >
        <StickyTableHeader>
          <StickyTableRow aria-rowindex={1}>
            {columns.map((column, index) => {
              const sortable = column.id === reasonColumn.id ? undefined : props.table.getColumn(column.id)
              return (
                <Fragment key={column.id}>
                  <StickyTableColumn
                    pin={index === 0 ? "start" : undefined}
                    align={column.align}
                    // A sortable heading is one control as large as its cell, so the cell keeps no padding of its own.
                    flush={
                      sortable !== undefined && !(isColumnMatchUnmatched(column.match) && props.onMatch !== undefined)
                    }
                  >
                    {isColumnMatchUnmatched(column.match) && props.onMatch !== undefined ? (
                      <MatchSelect column={column} onMatch={props.onMatch} />
                    ) : (
                      <span className={cn("flex min-w-0 items-center", column.align === "right" && "justify-end")}>
                        {index === 0 && folded.length > 0 ? <span aria-hidden className="w-6 flex-none" /> : null}
                        {index === 0 ? <span className="mr-0.5 w-7 flex-none text-right text-xs">Row</span> : null}
                        {sortable === undefined ? (
                          column.label
                        ) : (
                          <DataTableColumnHeader
                            column={sortable}
                            label={column.label}
                            {...(column.unit === undefined ? {} : { unit: column.unit })}
                            // The sort mark sits beside its own label, never at the cell's far edge, where it read
                            // as the next column's.
                            {...(column.align === "right"
                              ? { className: "justify-end", alignEnd: true }
                              : { className: "justify-start" })}
                          />
                        )}
                      </span>
                    )}
                  </StickyTableColumn>
                  {index === 0 && showStatus ? <StickyTableColumn>Status</StickyTableColumn> : null}
                </Fragment>
              )
            })}
            <StickyTableColumn pin="end">Resolve</StickyTableColumn>
          </StickyTableRow>
        </StickyTableHeader>
        <StickyTableBody>
          {props.loading ? (
            Array.from({ length: 14 }, (_, index) => (
              <StickyTableRow key={index}>
                {Array.from({ length: span }, (_, at) => (
                  <StickyTableCell key={at}>
                    {at === span - 1 ? null : (
                      <Skeleton
                        className={
                          (index + at) % 3 === 0
                            ? "h-3.5 w-2/3"
                            : (index + at) % 3 === 1
                              ? "h-3.5 w-1/2"
                              : "h-3.5 w-4/5"
                        }
                      />
                    )}
                  </StickyTableCell>
                ))}
              </StickyTableRow>
            ))
          ) : entries.length === 0 ? (
            <StickyTableFill span={span}>{props.empty}</StickyTableFill>
          ) : (
            <>
              {padTop > 0 ? <StickyTableFill span={span} height={padTop} /> : null}
              {items.map((item) => {
                const entry = entries[item.index]
                if (entry === undefined) return null
                return lineMatch<ReactNode>(entry, {
                  Detail: ({ view }) => (
                    <StickyTableBand
                      key={`detail:${view.row.id}`}
                      span={span}
                      quiet
                      ref={grid.measureLine}
                      data-index={item.index}
                      aria-rowindex={item.index + 2}
                    >
                      <Detail view={view} columns={folded} />
                    </StickyTableBand>
                  ),
                  Kind: (kind) => (
                    <KindRow
                      key={`kind:${kind.kind.id}`}
                      entry={kind}
                      span={span}
                      index={item.index}
                      actions={groupActions}
                      readOnly={readOnly}
                    />
                  ),
                  Rest: ({ count }) => (
                    <StickyTableBand key={`rest:${item.index}`} span={span} aria-rowindex={item.index + 2}>
                      <span className="pl-6 text-sm text-muted-foreground">
                        {rowsWord(count)} to settle one at a time
                      </span>
                    </StickyTableBand>
                  ),
                  Group: ({ applied, group: heading }) => (
                    <GroupRow
                      key={`group:${heading.id}`}
                      group={heading}
                      display={allColumns.find((column) => column.id === heading.column)?.display}
                      applied={applied}
                      span={span}
                      index={item.index}
                      lead={heading.id === lead}
                      excluded={excluded}
                      ticks={banding}
                      labels={labels}
                      actions={groupActions}
                      readOnly={readOnly}
                      indent={folded.length > 0}
                      actionsWidth={actionsWidth}
                      measure={grid.measureLine}
                    />
                  ),
                  Row: ({ view }) => {
                    // The headings a row sits under: its kind's, and the nearest group above it when it lists the row.
                    const above = headings[item.index]
                    const group = above?.group?.rowIds.includes(view.row.id) === true ? above.group : undefined
                    return (
                      <Row
                        key={view.row.id}
                        view={view}
                        index={item.index}
                        measure={grid.measureLine}
                        columns={columns}
                        allColumns={allColumns}
                        under={under}
                        dense={density === "compact"}
                        showStatus={showStatus}
                        folded={folded}
                        expanded={HashSet.has(expanded, view.row.id)}
                        onExpand={grid.toggle}
                        words={words}
                        group={group}
                        banded={
                          banding && group !== undefined && choicesOf(group) === undefined && view.status === "needs"
                        }
                        rowAction={rowAction}
                        cellEditor={props.cellEditor}
                        included={!HashSet.has(excluded, view.row.id)}
                        sectioned={above?.sectioned === true}
                        labels={labels}
                        kinds={kinds}
                        actions={actions}
                        groupActions={groupActions}
                        readOnly={readOnly}
                      />
                    )
                  }
                })
              })}
              {padBottom > 0 ? <StickyTableFill span={span} height={padBottom} /> : null}
            </>
          )}
        </StickyTableBody>
      </StickyTable>
    </StickyTableFrame>
  )
}
