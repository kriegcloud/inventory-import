import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import * as HashMap from "effect/HashMap"
import * as HashSet from "effect/HashSet"
import * as O from "effect/Option"
import { Fragment, type ReactNode, useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@inventory/ui/components/button"
import { Checkbox } from "@inventory/ui/components/checkbox"
import { ButtonGroup } from "@inventory/ui/components/button-group"
import { Label } from "@inventory/ui/components/label"
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemFooter,
  ItemGroup,
  ItemHeader,
  ItemTitle
} from "@inventory/ui/components/item"
import { Progress } from "@inventory/ui/components/progress"
import { Skeleton } from "@inventory/ui/components/skeleton"
import {
  askFor,
  choicesOf,
  columnFor,
  choiceText,
  otherAnswers,
  queue,
  reasonOf,
  rowName,
  rowsWord,
  shownWith,
  valueWords,
  weakGuess
} from "@inventory/review/ReviewDraft"
import { CellValue, ColumnText, DecisionTag, EditForm, GroupChange, Overlay, Reason, ReasonTag } from "./parts.tsx"
import type { GroupActions, RowActions } from "./ReviewGrid.tsx"
import type {
  ProblemKind,
  QueueEntry,
  ReviewColumn,
  ReviewRegionProps,
  ReviewWords,
  RowView
} from "@inventory/review/ReviewTypes"

const page = 30

/**
 * How far through the decisions the person is: how many are done and how many there are in all. More can need the
 * person than when the queue opened (rows put back from "Left out", a value typed that brings up another problem):
 * the total grows with them, so nothing runs below empty. `done + left = all`, so the card's "Decision 2 of 60" and
 * the footer's "59 decisions left" agree.
 */
export const decided = (progress: { total: number; left: number }): { done: number; all: number } => {
  const done = Math.max(0, progress.total - progress.left)
  return { done, all: done + progress.left }
}

const nameOf = (view: RowView, first: ReviewColumn | undefined): string => {
  const name = first === undefined ? "" : (view.cells[first.id] ?? "")
  return name === "" ? `Row ${rowName(view.row)}` : name
}

/** One line of context under the name: the columns the caller marked, with their labels; a code in its own face. */
const contextOf = (view: RowView, columns: ReadonlyArray<ReviewColumn>, skip: string | undefined): ReactNode =>
  columns
    .filter((column) => column.context === true && column.id !== skip && (view.cells[column.id] ?? "") !== "")
    .slice(0, 3)
    .map((column, at) => (
      <Fragment key={column.id}>
        {at === 0 ? "" : " · "}
        {column.label}{" "}
        <ColumnText column={column}>{shownWith(column, view.cells[column.id] ?? "", view.cells)}</ColumnText>
      </Fragment>
    ))

const first = { "data-first-action": "" }

/** "Why?" on a card: who made the proposal, how sure it is and its evidence, in a sheet that rises from the bottom. */
function WhySheet(props: { title: string; about: string; children: ReactNode }) {
  return (
    <span>
      <Overlay
        title={props.title}
        about={props.about}
        trigger={
          <Button variant="hint" size="touch">
            Why?
          </Button>
        }
      >
        {props.children}
      </Overlay>
    </span>
  )
}

/** The one decision on screen: a group of identical fixes, or a row. Everything needed to decide is on the card. */
function Decision(props: {
  entry: QueueEntry
  columns: ReadonlyArray<ReviewColumn>
  kinds: HashMap.HashMap<string, ProblemKind>
  actions: RowActions
  groupActions: GroupActions
  onSplit: (groupId: string) => void
  excluded: HashSet.HashSet<string>
  rowAction: ReviewRegionProps["rowAction"]
  cellEditor: ReviewRegionProps["cellEditor"]
}) {
  const { entry, actions, groupActions } = props
  const labels = useMemo(
    () => HashMap.fromIterable(props.columns.map((column) => [column.id, column.label] as const)),
    [props.columns]
  )
  const columnOf = (id: string | undefined) => props.columns.find((column) => column.id === id)

  if (entry.type === "group") {
    const { group } = entry
    const n = group.rowIds.filter((rowId) => !HashSet.has(props.excluded, rowId)).length
    const choices = choicesOf(group)
    return (
      <Item variant="outline" className="w-full min-w-0">
        <ItemHeader>
          <ReasonTag kind={O.getOrUndefined(HashMap.get(props.kinds, group.kind))} fallback={group.kind} />
          <span className="text-muted-foreground">{rowsWord(n)}</span>
        </ItemHeader>
        <ItemContent className="min-w-0">
          <ItemTitle>
            <GroupChange group={group} display={columnOf(group.column)?.display} />
          </ItemTitle>
          <WhySheet title="Why this change?" about="What the proposal is based on">
            <p>
              <Reason fix={group} />
            </p>
          </WhySheet>
        </ItemContent>
        <ItemFooter className="min-w-0">
          <div className="flex w-full min-w-0 flex-col gap-2">
            {choices !== undefined ? (
              <ButtonGroup aria-label={`Choose for ${n === 1 ? "the row" : `all ${n} rows`}`} className="w-full">
                {choices.map((choice, at) => (
                  <Button
                    key={choice}
                    variant="outline"
                    size="touch"
                    className="flex-1"
                    {...(at === 0 ? first : {})}
                    onClick={() => groupActions.choose(group.id, choice)}
                  >
                    {valueWords(group, choice)} for {n}
                  </Button>
                ))}
              </ButtonGroup>
            ) : (
              <Button size="touch" {...first} onClick={() => groupActions.accept(group.id)}>
                {group.mixed === true ? `Accept for ${n}` : `Use ${group.label ?? group.to} for ${n}`}
              </Button>
            )}
            <div className="flex flex-col gap-2">
              <Button variant="outline" size="touch" onClick={() => props.onSplit(group.id)}>
                Review {n} one by one
              </Button>
              <Button
                variant="outline"
                size="touch"

                onClick={() => groupActions.leaveOut(group.rowIds)}
              >
                Leave out {n}
              </Button>
            </div>
            <ul className="flex min-w-0 flex-col border-t pt-1">
              {group.rowIds.map((rowId) => {
                const view = actions.peek(rowId)
                if (view === undefined) return null
                const name = nameOf(view, props.columns[0])
                return (
                  <li key={rowId} className="min-w-0 text-sm">
                    {/* The whole line is the tick box's label: a 20px box alone is too small to tap. */}
                    <Label className="min-h-11 min-w-0 overflow-hidden">
                      <Checkbox
                        checked={!HashSet.has(props.excluded, rowId)}
                        aria-label={`In this fix: ${name}`}
                        className="size-5"
                        onCheckedChange={() => groupActions.toggle(rowId)}
                      />
                      <span className="min-w-0 flex-1 leading-5">
                        <span className="block truncate font-medium">{name}</span>
                        <span className="block truncate font-normal text-muted-foreground">
                          {contextOf(view, props.columns, group.column)}
                        </span>
                      </span>
                      <span className="flex-none font-normal text-muted-foreground">
                        <ColumnText column={columnOf(group.column)}>{view.row.cells[group.column]}</ColumnText> →{" "}
                        {/* Each row's own new value: under a `label` the rows of one group end in different values. */}
                        {choices === undefined ? (view.problem?.fix?.to ?? group.to) : "?"}
                      </span>
                    </Label>
                  </li>
                )
              })}
            </ul>
          </div>
        </ItemFooter>
      </Item>
    )
  }

  const { view } = entry
  const nameColumn = props.columns[0]
  const name = nameOf(view, nameColumn)
  const problem = view.problem
  const subject = problem?.column
  const mark = subject === undefined ? undefined : view.marks[subject]
  const fix = mark !== undefined && mark.state === "proposed" ? mark.fix : undefined
  const choices = fix === undefined ? undefined : choicesOf(fix)
  const rival = problem?.rivals?.[0] === undefined ? undefined : actions.peek(problem.rivals[0])
  const label = subject === undefined ? "" : O.getOrElse(HashMap.get(labels, subject), () => subject)
  const extra = problem === undefined ? undefined : props.rowAction?.(view.row)
  const others = otherAnswers({ view, extra })
  const picks = problem?.choices

  let main: ReactNode = null
  if (picks !== undefined && subject !== undefined) {
    // A pick with no default: every choice is the same outline button; a suggestion says so in words.
    main = picks.map((pick, at) => (
      <Button
        key={pick.value}
        variant="outline"
        size="touch"
        className="h-auto min-h-11"
        {...(at === 0 ? first : {})}
        onClick={() => actions.edit(view.row.id, subject, pick.value)}
      >
        <span className="py-2.5 whitespace-normal">{choiceText(pick)}</span>
      </Button>
    ))
  } else if (fix !== undefined && choices !== undefined && !weakGuess(fix)) {
    main = (
      <ButtonGroup aria-label={`${label} for ${name}`} className="w-full">
        {choices.map((choice, at) => (
          <Button
            key={choice}
            variant="outline"
            size="touch"
            className="flex-1"
            {...(at === 0 ? first : {})}
            onClick={() =>
              choice === fix.to
                ? actions.accept(view.row.id)
                : actions.edit(view.row.id, columnFor(fix, choice), choice)
            }
          >
            Use {valueWords(fix, choice)}
          </Button>
        ))}
      </ButtonGroup>
    )
  } else if (fix !== undefined && !weakGuess(fix)) {
    main = (
      <Button size="touch" {...first} onClick={() => actions.accept(view.row.id)}>
        Use {valueWords(fix, fix.to)}
      </Button>
    )
  } else if (subject !== undefined) {
    const own = props.cellEditor?.({ row: view.row, column: subject, value: view.cells[subject] ?? "" })
    main = (
      <Overlay
        title={own?.title ?? `${label} for ${name}`}
        about={`Type the ${label} so ${name} can be imported`}
        trigger={
          <Button size="touch" {...first}>
            {own?.label ?? problem?.ask ?? askFor(label)}
          </Button>
        }
      >
        {(close) =>
          own !== undefined ? (
            own.render((next) => {
              close()
              actions.edit(view.row.id, subject, next)
            })
          ) : (
            <span className="flex flex-col gap-3">
              {/* A weak guess is offered beside the box with its evidence, never as the row's own answer. */}
              {fix === undefined ? null : (
                <span className="flex flex-col gap-1.5">
                  <span className="text-sm text-muted-foreground">{fix.why.basis}</span>
                  <Button
                    variant="outline"
                    size="touch"
                    className="h-auto min-h-11"
                    onClick={() => {
                      close()
                      actions.accept(view.row.id)
                    }}
                  >
                    <span className="py-2.5 whitespace-normal">Use {valueWords(fix, fix.to)} (suggested)</span>
                  </Button>
                </span>
              )}
              <EditForm
                label={label}
                size="touch"
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

  return (
    <Item variant="outline" className="w-full min-w-0">
      <ItemHeader>
        <ReasonTag
          kind={problem === undefined ? undefined : O.getOrUndefined(HashMap.get(props.kinds, problem.kind))}
          tone={problem?.tone}
          fallback={problem?.kind ?? ""}
        />
        <span className="text-muted-foreground">row {rowName(view.row)}</span>
      </ItemHeader>
      <ItemContent className="min-w-0">
        <ItemTitle>{name}</ItemTitle>
        <ItemDescription>{contextOf(view, props.columns, subject)}</ItemDescription>
        {subject === undefined || subject === nameColumn?.id ? null : (
          <p className="flex flex-wrap items-center gap-x-2 text-sm">
            <span className="text-muted-foreground">{label}</span>
            <ColumnText column={columnOf(subject)}>
              <CellValue
                value={view.cells[subject] ?? ""}
                display={columnOf(subject)?.display}
                mark={mark}
                empty={<span className="text-destructive">Empty</span>}
              />
            </ColumnText>
            {rival === undefined ? null : (
              <span className="text-muted-foreground">
                also row {rowName(rival.row)}, {nameOf(rival, nameColumn)}
              </span>
            )}
          </p>
        )}
        {/* Why the row needs the person, with a fix or none; then who proposes the fix and on what evidence. */}
        <p className="text-sm">{reasonOf({ view, kinds: props.kinds })}</p>
        {fix === undefined ? null : (
          <WhySheet title={`Why ${valueWords(fix, fix.to)}?`} about={`Why it is proposed for ${name}`}>
            <p>
              <Reason fix={fix} />
            </p>
          </WhySheet>
        )}
      </ItemContent>
      <ItemFooter className="min-w-0">
        <div className="flex w-full min-w-0 flex-col gap-2">
          {main}
          {fix === undefined || actions.reject === undefined ? null : (
            <Button variant="outline" size="touch" onClick={() => actions.reject?.(view.row.id, fix.column)}>
              Reject this proposal
            </Button>
          )}
          {others === undefined || extra === undefined ? (
            <Button
              variant="outline"
              size="touch"
              {...(main === null ? first : {})}
              onClick={() => actions.leaveOut(view.row.id)}
            >
              Leave out
            </Button>
          ) : (
            // The caller's own answer for the row: each answer in full words, as on a desk.
            others.map((answer) =>
              answer.type === "type" ? (
                subject === undefined ? null : (
                  <Overlay
                    key="type"
                    title={`${label} for ${name}`}
                    about={`Type the ${label} for ${name}`}
                    trigger={
                      <Button variant="outline" size="touch">
                        {askFor(label)}
                      </Button>
                    }
                  >
                    {(close) => (
                      <EditForm
                        label={label}
                        size="touch"
                        value=""
                        onSave={(next) => {
                          close()
                          actions.edit(view.row.id, subject, next)
                        }}
                      />
                    )}
                  </Overlay>
                )
              ) : (
                <Button
                  key={answer.type}
                  variant="outline"
                  size="touch"
                  {...(main === null && answer.type === "leaveOut" ? first : {})}
                  onClick={() => (answer.type === "leaveOut" ? actions.leaveOut(view.row.id) : extra.onSelect())}
                >
                  {answer.label}
                </Button>
              )
            )
          )}
        </div>
      </ItemFooter>
    </Item>
  )
}

/**
 * The phone's review: an approval flow, one decision at a time. A group of identical fixes is one decision; then
 * each row that needs the person, with its reason, the change and what each button will do. The other views are a
 * plain two-line list. Nothing scrolls sideways.
 */
export function ReviewQueue(props: {
  /** Every row as it stands, for the decisions. */
  views: ReadonlyArray<RowView>
  /** The rows of the current view, for the list. */
  list: ReadonlyArray<RowView>
  deciding: boolean
  /** The cards are the rows that cannot be imported as written, one by one, instead of the decisions. */
  blocked?: boolean
  /** Rows the person took out of their group's action. */
  excluded: HashSet.HashSet<string>
  columns: ReadonlyArray<ReviewColumn>
  kinds: HashMap.HashMap<string, ProblemKind>
  actions: RowActions
  groupActions: GroupActions
  /** Decisions there were when the review opened, and how many are left (`decisionsLeft`). */
  progress: { total: number; left: number }
  /** Groups the person chose to go through row by row. Kept by the region, so its count of decisions agrees. */
  split: HashSet.HashSet<string>
  onSplit: (groupId: string) => void
  words: ReviewWords
  undo: ReactNode
  readOnly: boolean
  loading: boolean
  caption: string
  empty: ReactNode
  /** The caller's own answer per row (`rowAction` on the region). */
  rowAction: ReviewRegionProps["rowAction"]
  cellEditor: ReviewRegionProps["cellEditor"]
}) {
  const { split } = props
  const [at, setAt] = useState(0)
  const [shown, setShown] = useState(page)
  const decisions = useMemo(
    () => queue({ views: props.views, split, blocked: props.blocked === true }),
    [props.views, split, props.blocked]
  )
  const index = Math.min(at, Math.max(0, decisions.length - 1))
  const entry = decisions[index]
  const key = entry === undefined ? "" : entry.type === "group" ? `g:${entry.group.id}` : entry.view.row.id
  const nameColumn = props.columns[0]

  // After a decision the next card takes its place, and focus goes to its first button.
  const region = useRef<HTMLDivElement>(null)
  const before = useRef(key)
  useEffect(() => {
    if (before.current === key) return
    before.current = key
    region.current?.querySelector<HTMLElement>("[data-first-action]")?.focus()
  }, [key])

  if (props.loading) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-3 border-y p-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!props.deciding || props.readOnly) {
    const rows = props.list.slice(0, shown)
    return (
      <div
        ref={region}
        role="region"
        aria-label={props.caption}
        data-queue=""
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain border-y"
      >
        {props.list.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">{props.empty}</div>
        ) : (
          <ItemGroup>
            {rows.map((view) => (
              <Item key={view.row.id} size="sm" data-row-id={view.row.id}>
                <ItemContent className="min-w-0">
                  <ItemTitle>{nameOf(view, nameColumn)}</ItemTitle>
                  <ItemDescription>
                    {view.status === "needs" || view.status === "cannot"
                      ? reasonOf({ view, kinds: props.kinds, words: props.words })
                      : contextOf(view, props.columns, undefined)}
                  </ItemDescription>
                </ItemContent>
                {view.status === "needs" || view.status === "cannot" ? (
                  <ReasonTag
                    kind={O.getOrUndefined(HashMap.get(props.kinds, view.problem?.kind ?? ""))}
                    tone={view.problem?.tone}
                    fallback={view.problem?.kind ?? ""}
                  />
                ) : (
                  <DecisionTag view={view} words={props.words} />
                )}
                {props.readOnly ||
                view.status === "needs" ||
                view.status === "stored" ||
                view.status === "cannot" ? null : (
                  <Button
                    variant="quiet"
                    size="touch"
                    data-first-action=""
                    onClick={() =>
                      view.status === "out" ? props.actions.putBack(view.row.id) : props.actions.leaveOut(view.row.id)
                    }
                  >
                    {view.status === "out" ? "Put back" : "Leave out"}
                    <span className="sr-only"> {nameOf(view, nameColumn)}</span>
                  </Button>
                )}
              </Item>
            ))}
          </ItemGroup>
        )}
        {props.list.length > shown ? (
          <Button variant="outline" size="touch" className="my-3 w-full" onClick={() => setShown(shown + page)}>
            Show {Math.min(page, props.list.length - shown)} more
          </Button>
        ) : null}
      </div>
    )
  }

  return (
    <div
      ref={region}
      role="region"
      aria-label={props.caption}
      data-queue=""
      className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain border-y p-4"
    >
      {entry === undefined ? (
        <div className="py-10 text-center text-sm text-muted-foreground">{props.empty}</div>
      ) : (
        <>
          <div className="flex items-center gap-1">
            <p className="flex-1 text-sm font-medium tabular-nums">
              Decision {decided(props.progress).done + index + 1} of {decided(props.progress).done + decisions.length}
            </p>
            {props.undo}
            <Button
              variant="ghost"
              size="icon-touch"
              aria-label="Previous decision"
              disabled={index === 0}
              onClick={() => setAt(index - 1)}
            >
              <ChevronLeftIcon aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="icon-touch"
              aria-label="Skip to the next decision"
              disabled={index >= decisions.length - 1}
              onClick={() => setAt(index + 1)}
            >
              <ChevronRightIcon aria-hidden />
            </Button>
          </div>
          <Progress
            aria-label="Decisions made"
            value={
              decided(props.progress).all === 0
                ? 100
                : (decided(props.progress).done / decided(props.progress).all) * 100
            }
            className="h-1"
          />
          <Decision
            key={key}
            entry={entry}
            columns={props.columns}
            kinds={props.kinds}
            actions={props.actions}
            groupActions={props.groupActions}
            excluded={props.excluded}
            rowAction={props.rowAction}
            cellEditor={props.cellEditor}
            onSplit={props.onSplit}
          />
        </>
      )}
    </div>
  )
}
