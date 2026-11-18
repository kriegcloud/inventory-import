import { useVirtualizer } from "@tanstack/react-virtual"
import { ChevronDownIcon, ChevronRightIcon, CircleHelpIcon, SparklesIcon } from "lucide-react"
import type { Table as TanstackTable } from "@tanstack/react-table"
import {
  Fragment,
  type ReactNode,
  type RefObject,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState
} from "react"
import { cn } from "cn"
import { HashMap, HashSet, Option } from "effect"
import { sourceWordsFor } from "@/components/app/proposalSource"
import { StatusPill } from "@/components/app/StatusPill"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { ButtonGroup } from "@/components/ui/button-group"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { DataTableColumnHeader } from "@/components/ui/data-table/data-table-column-header"
import type { DataTableFeatures } from "@/components/ui/data-table/data-table-features"
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
} from "@/components/ui/sticky-table"
import { textWidth } from "@/lib/text-width"
import {
  askFor,
  choicesOf,
  columnFor,
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
} from "./logic.ts"
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
  WhyBody
} from "./parts.tsx"
import type {
  Entry,
  Fix,
  FixGroup,
  ProblemKind,
  ReviewColumn,
  ReviewRegionProps,
  ReviewWords,
  RowView
} from "./types.ts"

/**
 * The region's own Reason column: the sentence behind each row that needs the person or cannot be fixed here, with or
 * without a fix. A `fill` column, cut to one line with the whole sentence one hover, focus or tap away.
 */
export const reasonColumn: ReviewColumn = { id: "review:reason", label: "Reason", size: "fill", width: 180 }

/** A value as its column shows it (`ReviewColumn.display`). */
const shownIn = (column: ReviewColumn | undefined, text: string): string =>
  column?.display === undefined || text === "" ? text : column.display(text)

/** What a row can ask the region to do. Stable for the life of the region, so rows do not re-render for nothing. */
export type RowActions = {
  accept: (rowId: string) => void
  keep: (rowId: string) => void
  leaveOut: (rowId: string) => void
  putBack: (rowId: string) => void
  edit: (rowId: string, column: string, value: string) => void
  /** Takes a fix that is in force on one cell out again ("Undo this fix"). */
  undoFix: (rowId: string, column: string) => void
  /** Turns a proposal down: the file's value stands and the row waits. Absent where a turned-down fix is offered again. */
  reject?: (rowId: string, column: string) => void
  /** The row as it stands now, for comparing two rows that cannot both be imported. */
  peek: (rowId: string) => RowView | undefined
}

/** What a group heading can ask for. Each is one undo step. */
export type GroupActions = {
  accept: (groupId: string) => void
  choose: (groupId: string, value: string) => void
  /** Take a row out of its group's action, or put it back. */
  toggle: (rowId: string) => void
  /** Take the rules' lossless fixes for these rows in one step. */
  acceptRows: (rowIds: ReadonlyArray<string>) => void
  /** Show or hide the rows under a problem kind's heading. */
  fold: (kindId: string) => void
  leaveOut: (rowIds: ReadonlyArray<string>) => void
  revert: (groupId: string) => void
}

export type GridHandle = {
  reveal: (rowId: string) => void
  /** Focus the table's own frame: where focus goes when no row and no import button is left to take it. */
  focus: () => void
}

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
  if (match === undefined || match.state !== "unmatched") return null
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
  const pill = (words: string, icon: boolean) => (textWidth(words, { medium: true }) * 12) / 13 + 12 + (icon ? 16 : 0)
  const { words } = input
  let widest = textWidth(words.ready)
  for (const view of input.views) {
    if (view.status === "needs" || view.status === "cannot") {
      const kind = Option.getOrUndefined(HashMap.get(input.kinds, view.problem?.kind ?? ""))
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
const xsHint = (words: string): number => (textWidth(words) * 12) / 13 + 16

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
        textWidth(column.label, { medium: true }),
        column.unit === undefined ? 0 : textWidth(column.unit) * (12 / 13)
      ) +
      headerChrome +
      (index === 0 ? 30 : 0)
    const least = column.width ?? (column.size === "fill" ? fillLeast : 0)
    if (column.size === "fill") return Math.max(least, index === 0 ? 0 : 0)
    let widest = 0
    for (const value of longest(
      views.map((view) => shownIn(column, view.cells[column.id] ?? "")),
      40
    ))
      widest = Math.max(widest, textWidth(value, { mono }))
    for (const view of views) {
      const mark = view.marks[column.id]
      if (mark === undefined || mark.from === mark.to || view.status === "out") continue
      const from = textWidth(spellingOf(shownIn(column, mark.from)), { mono })
      const guess = mark.state === "proposed" && choicesOf(mark.fix) !== undefined
      // A mark that draws an icon: a model's sparkle, or the question mark of a suggestion nobody was named for.
      const icon = mark.by === "model" || mark.by === "unknown" ? sparkle : 0
      const to = shownIn(column, mark.to)
      const chip = textWidth(to, { mono, medium: true }) + chipChrome + icon
      const value = guess
        ? from + 6 + icon + textWidth(`${to}?`, { mono })
        : mark.state === "proposed" && mark.from.trim() === mark.to && to.length > longValue
          ? chip
          : from + arrowGap + chip
      // A proposal carries its "Why?" in the cell, except under a group heading, which says why for all its rows.
      // A question's rows (a `low` fix) keep their own "Why?" under its heading, as the row draws them.
      const banded =
        input.banding && mark.state === "proposed" && mark.fix.group !== undefined && !guess && view.status === "needs"
      // A fix in force carries its "Why?" too, with the way to undo it.
      const asks = mark.state === "proposed" ? !banded : mark.by !== "you" && mark.fix !== undefined
      widest = Math.max(widest, value + (asks ? whyButton : 0))
    }
    const cell = index === 0 ? widest + firstChrome + (input.expandable ? expander : 0) : widest + cellChrome
    return Math.ceil(Math.min(fitMost, Math.max(least, header, cell)))
  })
}

/** An `xs` button's width for its words: 12 px text in the medium weight, its padding, and an outline's border. */
const xsButton = (words: string, outline: boolean): number =>
  Math.ceil((textWidth(words, { medium: true }) * 12) / 13) + 16 + (outline ? 2 : 0)
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
  rowAction: ReviewRegionProps["rowAction"]
}): number => {
  if (input.readOnly) return actionsQuiet
  if (!input.entries.some((entry) => entry.type !== "row" || entry.view.status === "needs")) return actionsQuiet
  let widest = 0
  for (const entry of input.entries) {
    if (entry.type !== "row" || entry.view.status !== "needs") continue
    const problem = entry.view.problem
    const subject = problem?.column
    if (problem === undefined) continue
    const proposed = subject === undefined ? undefined : entry.view.marks[subject]
    const fix = proposed !== undefined && proposed.state === "proposed" ? proposed.fix : undefined
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
  rowAction: ReviewRegionProps["rowAction"]
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
  const kind =
    shownProblem === undefined ? undefined : Option.getOrUndefined(HashMap.get(props.kinds, shownProblem.kind))
  const out = view.status === "out"
  const subject = shownProblem?.column
  const proposed = subject === undefined ? undefined : view.marks[subject]
  const fix = proposed !== undefined && proposed.state === "proposed" ? proposed.fix : undefined
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
        about={`Why ${fix.to} is proposed for ${name}`}
        className="w-80"
        hover
        card
        trigger={
          <Button variant="hint" size="xs">
            Why?
            <span className="sr-only">
              {" "}
              {fix.to} for {name}
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
    if (props.readOnly || out || mark === undefined || mark.state !== "applied" || mark.by === "you") return null
    const made = mark.fix
    if (made === undefined || mark.from === mark.to) return null
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
      return reason === "" || view.status === "out" || view.status === "stored" ? null : (
        <CutText text={reason} className="min-w-0" />
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
          <CutText text={shownIn(column, view.cells[column.id] ?? "")} className="min-w-0" />
        ) : (
          <span className="min-w-0 truncate">
            <CellValue
              value={view.cells[column.id] ?? ""}
              display={column.display}
              mark={out ? undefined : view.marks[column.id]}
              accepted={view.decided === "accepted"}
              stated={props.banded}
              empty={
                isSubject ? <span className="text-destructive">Empty</span> : <span className="sr-only">Not set</span>
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
  const typeIt = (subject: string, guess?: Fix): ReactNode => {
    if (problem === undefined) return null
    const label = Option.getOrElse(HashMap.get(props.labels, subject), () => subject)
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
      main = typeIt(subject)
    }
  }

  return (
    <StickyTableRow
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
                        answer.type === "type" ? (
                          subject === undefined ? null : (
                            <EditForm
                              key="type"
                              label={Option.getOrElse(HashMap.get(props.labels, subject), () => subject)}
                              size="sm"
                              value=""
                              onSave={(next) => {
                                close()
                                actions.edit(view.row.id, subject, next)
                              }}
                            />
                          )
                        ) : (
                          <Button
                            key={answer.type}
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              close()
                              if (answer.type === "leaveOut") actions.leaveOut(view.row.id)
                              else extra.onSelect()
                            }}
                          >
                            {answer.label}
                          </Button>
                        )
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
type Line = Entry | { type: "detail"; view: RowView }

/** 36 px rows, or 44 px with more air between them. */
export type Density = "compact" | "comfortable"

/** The columns with no room in the table at this width, under their row: each label and its value, change and all. */
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
              display={column.display}
              mark={view.status === "out" ? undefined : view.marks[column.id]}
              accepted={view.decided === "accepted"}
              empty={<span className="text-muted-foreground">Not set</span>}
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
  entry: Extract<Entry, { type: "kind" }>
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
}) {
  const { group } = props
  const rowIds = group.rowIds.filter((rowId) => !HashSet.has(props.excluded, rowId))
  const n = rowIds.length
  const choices = choicesOf(group)
  const column = Option.getOrElse(HashMap.get(props.labels, group.column), () => group.column)
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
          <GroupChange group={group} applied={props.applied} oneLine />
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

/**
 * The rows as a native table that scrolls inside its own frame: sticky header, the name column frozen on the left
 * and the row's actions on the right. Only the lines near the viewport are in the document.
 */
export function ReviewGrid(props: {
  entries: ReadonlyArray<Entry>
  /** The one table instance: its column headers carry the sort and hide menu. */
  table: TanstackTable<DataTableFeatures, RowView>
  /** The columns the person is showing, the record's own first. */
  columns: ReadonlyArray<ReviewColumn>
  allColumns: ReadonlyArray<ReviewColumn>
  /** The rows of the view on screen, as they stand: the `fit` columns are measured from them. */
  views: ReadonlyArray<RowView>
  /** The width the table has, in pixels: the page's room (`lib/content-width.ts`) less what stands beside it. */
  room: number
  /** False while every row on screen has the same status and a group heading says it. */
  showStatus: boolean
  /** Columns that never move into the detail: the ones the person turned on, the one the problems on screen are in. */
  keep: HashSet.HashSet<string>
  /** 36 px rows, or 44 px with more air. */
  density: Density
  /** The status and tab words (`ReviewRegionProps.words` over the defaults). */
  words: ReviewWords
  /** Rows the person took out of their group's action. */
  excluded: HashSet.HashSet<string>
  /** Whether a group's accept may be the screen's one filled button (the person can decide in this view). */
  canLead: boolean
  /** Told whether such a button is in view, so the import button can step back while it is. */
  onLead: (inView: boolean) => void
  kinds: HashMap.HashMap<string, ProblemKind>
  actions: RowActions
  groupActions: GroupActions
  readOnly: boolean
  loading: boolean
  caption: string
  /** One row across the table when the filter has nothing to show. */
  empty: ReactNode
  onMatch: ((columnId: string, source: string) => void) | undefined
  handle: RefObject<GridHandle | null>
  /** The caller's own answer per row. With it a row under a group heading keeps its own answers, with no tick. */
  rowAction: ReviewRegionProps["rowAction"]
  cellEditor: ReviewRegionProps["cellEditor"]
  /** The actions column's width for these rows (`actionsFit`). */
  actionsWidth: number
  /** Inside a card: the card's edge is the gutter, and the frame draws no rules of its own above and below. */
  framed?: boolean
}) {
  const scroller = useRef<HTMLDivElement>(null)
  const statusWidth = useMemo(
    () => (props.showStatus ? statusFit({ views: props.views, kinds: props.kinds, words: props.words }) : 0),
    [props.showStatus, props.views, props.kinds, props.words]
  )
  const fixed = statusWidth + props.actionsWidth
  const banding = props.rowAction === undefined

  // -- Widths: each `fit` column as wide as its widest value, the `fill` columns share the rest; short of room the
  // lowest priority moves into the row's detail (an `under` column under the name), never cut. -----------------
  // Group headings are drawn in this view: a row under one has no "Why?" of its own.
  const bands = banding && props.entries.some((entry) => entry.type === "group")
  // Every row that needs the person or cannot be fixed here says why, in its own column after the name and status.
  const reasons = props.views.some((view) => view.status === "needs" || view.status === "cannot")
  const shownColumns = useMemo(
    () =>
      reasons && props.columns.length > 0
        ? [...props.columns.slice(0, 1), reasonColumn, ...props.columns.slice(1)]
        : props.columns,
    [reasons, props.columns]
  )
  const needs = useMemo(
    () => measureNeeds({ columns: shownColumns, views: props.views, banding: bands, expandable: false }),
    [shownColumns, props.views, bands]
  )
  const plan = useMemo(() => {
    const sized = shownColumns.map((column, index) => ({
      id: column.id,
      size: column.size ?? ("fit" as const),
      need: needs[index] ?? column.width ?? fillLeast,
      priority: priorityOf(column),
      keep: index === 0 || column.id === reasonColumn.id || HashSet.has(props.keep, column.id)
    }))
    const first = planColumns({ columns: sized, fixed, room: props.room })
    const detailed = first.folded.some((id) => shownColumns.find((column) => column.id === id)?.under !== true)
    const head = sized[0]
    // Rows with a detail carry a button before their number: a first column sized to its values makes room for it.
    return detailed && head !== undefined && head.size === "fit"
      ? planColumns({ columns: [{ ...head, need: head.need + expander }, ...sized.slice(1)], fixed, room: props.room })
      : first
  }, [shownColumns, needs, props.keep, fixed, props.room])
  const columns = useMemo(
    () => shownColumns.filter((column) => plan.shown.some((shown) => shown.id === column.id)),
    [shownColumns, plan]
  )
  const under = useMemo(
    () => shownColumns.filter((column) => plan.folded.includes(column.id) && column.under === true),
    [shownColumns, plan]
  )
  const folded = useMemo(
    () => shownColumns.filter((column) => plan.folded.includes(column.id) && column.under !== true),
    [shownColumns, plan]
  )

  // -- Lines: the region's entries, with each opened row's detail under it. ------------------------------------
  const [expanded, setExpanded] = useState<HashSet.HashSet<string>>(HashSet.empty)
  const onExpand = useCallback(
    (rowId: string) =>
      setExpanded((before) =>
        HashSet.has(before, rowId) ? HashSet.remove(before, rowId) : HashSet.add(before, rowId)
      ),
    []
  )
  const entries = useMemo<ReadonlyArray<Line>>(
    () =>
      folded.length === 0 || HashSet.size(expanded) === 0
        ? props.entries
        : props.entries.flatMap((entry): ReadonlyArray<Line> =>
            entry.type === "row" && HashSet.has(expanded, entry.view.row.id)
              ? [entry, { type: "detail", view: entry.view }]
              : [entry]
          ),
    [props.entries, folded.length, expanded]
  )

  // A value under the name takes a second line: such rows are 44 px whatever the density, so the virtual list's
  // estimate matches what is drawn.
  const height = props.density === "comfortable" || under.length > 0 ? tallRowHeight : rowHeight
  const virtual = useVirtualizer({
    count: entries.length,
    getScrollElement: () => scroller.current,
    estimateSize: (index) =>
      entries[index]?.type === "row" ? height : entries[index]?.type === "group" ? groupHeight : bandHeight,
    overscan: 12
  })
  const latest = useRef(entries)
  latest.current = entries
  useImperativeHandle(
    props.handle,
    () => ({
      reveal: (rowId) => {
        const index = latest.current.findIndex((entry) => entry.type === "row" && entry.view.row.id === rowId)
        if (index !== -1) virtual.scrollToIndex(index, { align: "auto" })
      },
      focus: () => scroller.current?.focus()
    }),
    [virtual]
  )

  // Group headings change the sizes, and a new filter starts at its first line.
  const shape = entries.map((entry) => (entry.type === "row" ? "" : entry.type === "detail" ? "d" : "g")).join("")
  const firstKey = entries[0] === undefined ? "" : entries[0].type === "row" ? entries[0].view.row.id : entries[0].type
  const seen = useRef({ firstKey, length: entries.length })
  useEffect(() => {
    virtual.measure()
    const before = seen.current
    seen.current = { firstKey, length: entries.length }
    if (before.firstKey !== firstKey && Math.abs(before.length - entries.length) > 1)
      scroller.current?.scrollTo({ top: 0 })
  }, [shape, firstKey, entries.length, virtual])

  const labelsKey = props.allColumns.map((column) => `${column.id}:${column.label}`).join("|")
  const labels = useRef({ key: "", map: HashMap.empty<string, string>() })
  if (labels.current.key !== labelsKey) {
    labels.current = {
      key: labelsKey,
      map: HashMap.fromIterable(props.allColumns.map((column) => [column.id, column.label] as const))
    }
  }

  // The filled button is the first rule group's accept that is in view; scrolled away, it hands the role back.
  const range = virtual.range
  const lead =
    !props.canLead || range === null
      ? undefined
      : entries
          .slice(range.startIndex, range.endIndex + 1)
          .find(
            (entry): entry is Extract<Line, { type: "group" }> =>
              entry.type === "group" && !entry.applied && choicesOf(entry.group) === undefined
          )?.group.id
  const leading = lead !== undefined
  const { onLead } = props
  useEffect(() => onLead(leading), [leading, onLead])

  const items = virtual.getVirtualItems()
  const padTop = items[0]?.start ?? 0
  const padBottom = virtual.getTotalSize() - (items[items.length - 1]?.end ?? 0)
  const span = columns.length + (props.showStatus ? 2 : 1)
  // The flex column is drawn without a width and takes what the others leave, so rounding never opens a gap.
  const widthOf = (id: string): number | undefined =>
    id === plan.flex ? undefined : plan.shown.find((shown) => shown.id === id)?.width
  const widths = [
    widthOf(columns[0]?.id ?? ""),
    ...(props.showStatus ? [statusWidth] : []),
    ...columns.slice(1).map((column) => widthOf(column.id)),
    props.actionsWidth
  ]
  let group: FixGroup | undefined

  return (
    <StickyTableFrame ref={scroller} label={props.caption} framed={props.framed === true}>
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
                      sortable !== undefined && !(column.match?.state === "unmatched" && props.onMatch !== undefined)
                    }
                  >
                    {column.match?.state === "unmatched" && props.onMatch !== undefined ? (
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
                  {index === 0 && props.showStatus ? <StickyTableColumn>Status</StickyTableColumn> : null}
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
                if (entry.type === "detail") {
                  return (
                    <StickyTableBand
                      key={`detail:${entry.view.row.id}`}
                      span={span}
                      quiet
                      ref={virtual.measureElement}
                      data-index={item.index}
                      aria-rowindex={item.index + 2}
                    >
                      <Detail view={entry.view} columns={folded} />
                    </StickyTableBand>
                  )
                }
                if (entry.type === "kind") {
                  return (
                    <KindRow
                      key={`kind:${entry.kind.id}`}
                      entry={entry}
                      span={span}
                      index={item.index}
                      actions={props.groupActions}
                      readOnly={props.readOnly}
                    />
                  )
                }
                if (entry.type === "rest") {
                  return (
                    <StickyTableBand key={`rest:${item.index}`} span={span} aria-rowindex={item.index + 2}>
                      <span className="pl-6 text-sm text-muted-foreground">
                        {rowsWord(entry.count)} to settle one at a time
                      </span>
                    </StickyTableBand>
                  )
                }
                if (entry.type === "group") {
                  return (
                    <GroupRow
                      key={`group:${entry.group.id}`}
                      group={entry.group}
                      applied={entry.applied}
                      span={span}
                      index={item.index}
                      lead={entry.group.id === lead}
                      excluded={props.excluded}
                      ticks={banding}
                      labels={labels.current.map}
                      actions={props.groupActions}
                      readOnly={props.readOnly}
                      indent={folded.length > 0}
                      actionsWidth={props.actionsWidth}
                      measure={virtual.measureElement}
                    />
                  )
                }
                // The headings a row sits under: its kind's, and the nearest group above it that lists the row.
                group = undefined
                let sectioned = false
                let sought = true
                for (let at = item.index - 1; at >= 0; at -= 1) {
                  const above = entries[at]
                  if (above?.type === "group" && sought) {
                    if (above.group.rowIds.includes(entry.view.row.id)) group = above.group
                    sought = false
                  }
                  if (above?.type === "kind") {
                    sectioned = true
                    break
                  }
                }
                return (
                  <Row
                    key={entry.view.row.id}
                    view={entry.view}
                    index={item.index}
                    columns={columns}
                    allColumns={props.allColumns}
                    under={under}
                    dense={props.density === "compact"}
                    showStatus={props.showStatus}
                    folded={folded}
                    expanded={HashSet.has(expanded, entry.view.row.id)}
                    onExpand={onExpand}
                    words={props.words}
                    group={group}
                    banded={
                      banding && group !== undefined && choicesOf(group) === undefined && entry.view.status === "needs"
                    }
                    rowAction={props.rowAction}
                    cellEditor={props.cellEditor}
                    included={!HashSet.has(props.excluded, entry.view.row.id)}
                    sectioned={sectioned}
                    labels={labels.current.map}
                    kinds={props.kinds}
                    actions={props.actions}
                    groupActions={props.groupActions}
                    readOnly={props.readOnly}
                  />
                )
              })}
              {padBottom > 0 ? <StickyTableFill span={span} height={padBottom} /> : null}
            </>
          )}
        </StickyTableBody>
      </StickyTable>
    </StickyTableFrame>
  )
}
