// The review's model holds no "what a row's decision is now": a row's own instance holds only its own acts, and an act
// on a group of rows is one instance of its own. What a row reads as is a fold, written here: the row's own decision,
// then the patch of every group in force that names it and came after that decision, oldest first. A group's two
// texts are its rows split by the exact patch each row got: `patch` is the list of distinct patches as JSON, `rows`
// the list of row ids that got each one, in the same order. The sentence this file makes true, and must not break:
// reading a row through its groups equals today's `act` only when a group's rows are split by exactly what each got.
// The screen's presses are sent as the model's commands (a group act is one DecideGroup, an undo of it one UndoGroup,
// a redo a new act naming the undone unit's own rows and patches) to the real model in memory, under `Story`, whose
// instances are read back and folded.
import { Story } from "@alchemy.run/domain/Story"
import { expect, it } from "@effect/vitest"
import { RowDecision, type SavedDecisions } from "@inventory/catalog-contract/Decision"
import { ImportId, RowId } from "@inventory/catalog-contract/Ids"
import type { StagedTable } from "@inventory/catalog-contract/Staged"
import { type Actor, CurrentActor } from "@inventory/catalog-model/Actor"
import { DecideRow, GroupedAfter } from "@inventory/catalog-model/Deciding"
import { DecideGroup } from "@inventory/catalog-model/DecidingGroup"
import {
  Group,
  GroupDecided,
  type GroupState,
  GroupUndone,
  isDecidedGroup
} from "@inventory/catalog-model/GroupAggregate"
import { ActCounted, GroupCounted, Import, ImportStaged } from "@inventory/catalog-model/ImportAggregate"
import { Catalog } from "@inventory/catalog-model/Model"
import { firstDecisions, recheckRow, review, ruleFixes } from "@inventory/catalog-model/Review"
import {
  isDecided,
  Level,
  NO_DECISION,
  noLevel,
  Row,
  RowDecided,
  type RowState,
  seal,
  StepUndone
} from "@inventory/catalog-model/RowAggregate"
import { NotYourStep, UndoRowStep } from "@inventory/catalog-model/Undoing"
import { UndoGroup } from "@inventory/catalog-model/UndoingGroup"
import {
  storedChoice,
  toRegionDecisions,
  toRegionProblem,
  toRegionRows,
  toServerDecisions
} from "@inventory/catalog-web/ImportReview"
import {
  isKept,
  isLeftOut,
  kept,
  leftOut,
  putBack,
  ReviewDecision,
  RowPlace,
  toFlags
} from "@inventory/review/ReviewDecision"
import { act, Action, appliedGroups, columnFor, saved, viewRows, waitingGroups } from "@inventory/review/ReviewDraft"
import {
  Fix,
  Problem,
  ReviewRow,
  type ReviewState,
  type RowView,
  type UndoStep,
  Why
} from "@inventory/review/ReviewTypes"
import * as A from "effect/Array"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import * as HashMap from "effect/HashMap"
import * as O from "effect/Option"
import * as Order from "effect/Order"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import * as Str from "effect/String"
import { sample, stage } from "./support/files.ts"

// ---------------------------------------------------------------------------------------------------------------
// What a group act does to one row, and the fold
// ---------------------------------------------------------------------------------------------------------------

/**
 * What one press did to one row, read from the press and never from the row's later state: an `accept` says whether
 * it also put an undone rule fix back in force (`lift`), because the rows a screen draws change with the decisions and
 * would answer that differently later.
 */
const Patch = S.Union([
  S.Struct({ kind: S.tag("accept"), column: S.String, lift: S.Boolean }),
  S.Struct({ kind: S.tag("edit"), column: S.String, value: S.String }),
  S.Struct({ kind: S.tag("leaveOut") }),
  S.Struct({ kind: S.tag("keep") }),
  S.Struct({ kind: S.tag("putBack") }),
  S.Struct({ kind: S.tag("revert"), column: S.String })
])
  .annotate({ description: "What one press did to one row" })
  .pipe(S.toTaggedUnion("kind"))
type Patch = typeof Patch.Type
const samePatch = S.toEquivalence(Patch)

/** A group's `patch` text: its distinct patches. Its `rows` text: the rows that got each, in the same order. */
const GroupPatches = Patch.pipe(S.Array, S.fromJsonString)
const GroupRows = S.String.pipe(S.Array, S.Array, S.fromJsonString)

const undecided = ReviewDecision.make({})
const sameDecision = S.toEquivalence(ReviewDecision)
const without = (list: ReadonlyArray<string>, item: string): ReadonlyArray<string> =>
  A.filter(list, (entry) => entry !== item)
const keptFlag = (decision: ReviewDecision): boolean =>
  isKept(decision.place) || (RowPlace.guards.leftOut(decision.place) && decision.place.wasKept)

/** One patch on a row's decision, as `act` writes it. */
const applyPatch = (before: O.Option<ReviewDecision>, patch: Patch): ReviewDecision => {
  const d = O.getOrElse(before, () => undecided)
  return Patch.match(patch, {
    accept: ({ column, lift }) =>
      ReviewDecision.make({
        ...d,
        reverted: lift ? without(d.reverted, column) : d.reverted,
        accepted: [...without(d.accepted, column), column]
      }),
    edit: ({ column, value }) => ReviewDecision.make({ ...d, edits: { ...d.edits, [column]: value } }),
    leaveOut: () => ReviewDecision.make({ ...d, place: leftOut(O.exists(before, keptFlag)) }),
    keep: () => ReviewDecision.make({ ...d, place: kept }),
    putBack: () => ReviewDecision.make({ ...d, place: putBack(d.place) }),
    revert: ({ column }) =>
      ReviewDecision.make({
        ...d,
        reverted: [...without(d.reverted, column), column],
        accepted: without(d.accepted, column)
      })
  })
}

/** A decision equal to another, a row with none counting as one that says nothing. */
const holdsAlready = (before: O.Option<ReviewDecision>, after: ReviewDecision): boolean =>
  O.match(before, { onNone: () => ReviewDecision.isEmpty(after), onSome: (d) => sameDecision(d, after) })

/** A row's own decision and the change that recorded it. */
interface Own {
  readonly change: number
  readonly decision: ReviewDecision
}
/** Some rows of a group and the one patch each of them got. */
interface Part {
  readonly patch: Patch
  readonly rows: ReadonlyArray<string>
}
/** One group act: its number, the change that took it back (0 while in force), and its parts. */
interface GroupUnit {
  readonly change: number
  readonly undoneAt: number
  readonly parts: ReadonlyArray<Part>
}
/** The model's instances, decoded: each decided row's own decision, and every group act. */
interface Instances {
  readonly own: Readonly<Record<string, Own>>
  readonly groups: ReadonlyArray<GroupUnit>
}

const byChange = Order.mapInput(Order.Number, (group: GroupUnit) => group.change)

/** The patches a row reads through: of the groups in force that name it and came after its own decision. */
const patchesOver = (instances: Instances, row: string): ReadonlyArray<Patch> => {
  const since = O.match(R.get(instances.own, row), { onNone: () => 0, onSome: (own) => own.change })
  return A.flatMap(A.sort(instances.groups, byChange), (group: GroupUnit) =>
    group.undoneAt !== 0 || group.change <= since
      ? []
      : A.map(
          A.filter(group.parts, (part) => A.contains(part.rows, row)),
          (part) => part.patch
        )
  )
}

/** What one row reads as: its own decision, then each group in force over it, oldest first. */
const foldRow = (instances: Instances, row: string): O.Option<ReviewDecision> =>
  A.reduce(
    patchesOver(instances, row),
    O.map(R.get(instances.own, row), (own) => own.decision),
    (decision, patch) => O.some(applyPatch(decision, patch))
  )

/** A group in force over the row came after its own decision: the row is not as its own instance has it. */
const coveredIn = (instances: Instances, row: string): boolean => A.isReadonlyArrayNonEmpty(patchesOver(instances, row))

/** Every row's decision, read through its groups. */
const fold = (instances: Instances): Readonly<Record<string, ReviewDecision>> => {
  const rows = A.dedupe([
    ...R.keys(instances.own),
    ...A.flatMap(instances.groups, (group) => A.flatMap(group.parts, (part) => part.rows))
  ])
  return R.fromEntries(
    A.getSomes(A.map(rows, (row) => O.map(foldRow(instances, row), (decision) => [row, decision] as const)))
  )
}

// ---------------------------------------------------------------------------------------------------------------
// The translation of a press
// ---------------------------------------------------------------------------------------------------------------

/** One row a press wrote, and its patch. */
interface Written {
  readonly row: string
  readonly patch: Patch
}
/** What one press wrote: the rows in the order it wrote them. */
type Unit = ReadonlyArray<Written>

const decidedByPerson = (decision: O.Option<ReviewDecision>): boolean =>
  O.exists(decision, (d) => isLeftOut(d.place) || keptFlag(d) || !R.isEmptyRecord(d.edits))

/**
 * The rows a press writes and the patch each gets, worked out on the screen as `act` works it out. The property
 * checks it against `act` at every press, so a difference is a failure and not a guess.
 */
const patchesFor = (input: {
  readonly views: ReadonlyArray<RowView>
  readonly decisions: HashMap.HashMap<string, ReviewDecision>
  readonly action: Action
}): Unit => {
  const byId = R.fromEntries(A.map(input.views, (view) => [view.row.id, view] as const))
  const decisionOf = (row: string): O.Option<ReviewDecision> => HashMap.get(input.decisions, row)
  const order: Array<string> = []
  let patches: Readonly<Record<string, Patch>> = {}
  const set = (row: string, patch: Patch): void => {
    if (!R.has(patches, row)) order.push(row)
    patches = R.set(patches, row, patch)
  }
  const accept = (view: RowView): void => {
    const fix = view.problem?.fix
    if (view.status !== "needs" || fix === undefined) return
    const lift = A.some(view.row.applied ?? [], (applied) => applied.column === fix.column)
    set(view.row.id, Patch.cases.accept.make({ kind: "accept", column: fix.column, lift }))
  }
  const each = (rows: ReadonlyArray<string>, f: (view: RowView) => void): void => {
    for (const row of rows) O.map(R.get(byId, row), f)
  }
  const leaving = Patch.cases.leaveOut.make({ kind: "leaveOut" })
  Action.match(input.action, {
    undo: () => undefined,
    redo: () => undefined,
    accept: ({ rowIds }) => each(rowIds, accept),
    acceptGroup: ({ groupId, except }) =>
      O.map(
        A.findFirst(waitingGroups({ views: input.views }), (group) => group.id === groupId),
        (group) =>
          each(
            A.filter(group.rowIds, (row) => except?.includes(row) !== true),
            accept
          )
      ),
    chooseGroup: ({ groupId, value, except }) =>
      O.map(
        A.findFirst(waitingGroups({ views: input.views }), (group) => group.id === groupId),
        (group) =>
          each(
            A.filter(group.rowIds, (row) => except?.includes(row) !== true),
            (view) => {
              const fix = view.problem?.fix
              if (value === fix?.to) return accept(view)
              const column = fix === undefined ? group.column : columnFor(fix, value)
              set(view.row.id, Patch.cases.edit.make({ kind: "edit", column, value }))
            }
          )
      ),
    keep: ({ rowId }) =>
      each([rowId], (view) => {
        if (view.status !== "needs" || view.problem?.rivals === undefined) return
        set(rowId, Patch.cases.keep.make({ kind: "keep" }))
        for (const rival of view.problem.rivals) {
          if (R.has(byId, rival) && !decidedByPerson(decisionOf(rival))) set(rival, leaving)
        }
      }),
    leaveOut: ({ rowIds }) =>
      each(rowIds, (view) => {
        if (view.status === "out" || view.status === "stored" || view.status === "cannot") return
        set(view.row.id, leaving)
      }),
    putBack: ({ rowId }) =>
      O.map(decisionOf(rowId), (decision) => {
        if (isLeftOut(decision.place)) set(rowId, Patch.cases.putBack.make({ kind: "putBack" }))
      }),
    edit: ({ rowId, column, value }) =>
      each([rowId], (view) => {
        if (view.status === "stored" || view.status === "cannot") return
        set(rowId, Patch.cases.edit.make({ kind: "edit", column, value }))
      }),
    revert: ({ rowId, column }) =>
      each([rowId], (view) => {
        const mark = R.get(view.marks, column)
        if (O.isNone(mark) || mark.value.by === "you" || view.status === "stored") return
        set(rowId, Patch.cases.revert.make({ kind: "revert", column }))
      }),
    revertGroup: ({ groupId }) =>
      O.map(
        A.findFirst(appliedGroups(input.views), (group) => group.id === groupId),
        (group) => {
          for (const row of group.rowIds) set(row, Patch.cases.revert.make({ kind: "revert", column: group.column }))
        }
      )
  })
  return A.getSomes(A.map(order, (row) => O.map(R.get(patches, row), (patch): Written => ({ row, patch }))))
}

/** Recorded as one group act: the group presses always; accept, leave out and keep when they change several rows. */
const isGroupAct = (action: Action, rows: number): boolean =>
  Action.match(action, {
    acceptGroup: () => true,
    chooseGroup: () => true,
    revertGroup: () => true,
    accept: () => rows > 1,
    leaveOut: () => rows > 1,
    keep: () => rows > 1,
    putBack: () => false,
    edit: () => false,
    revert: () => false,
    undo: () => false,
    redo: () => false
  })

/** The written rows split by the exact patch each got. */
const partsOf = (unit: Unit): ReadonlyArray<Part> =>
  A.reduce(unit, A.empty<Part>(), (parts, written) =>
    O.match(
      A.findFirstIndex(parts, (part) => samePatch(part.patch, written.patch)),
      {
        onNone: () => A.append(parts, { patch: written.patch, rows: [written.row] }),
        onSome: (at) =>
          A.map(parts, (part, index) => (index === at ? { ...part, rows: A.append(part.rows, written.row) } : part))
      }
    )
  )

// ---------------------------------------------------------------------------------------------------------------
// The model, as a live screen holds it: every change it received, sent as commands and read back
// ---------------------------------------------------------------------------------------------------------------

const importId = ImportId.make("0190a5c2-7b1e-7c3a-9f10-4d2e8b6a1c55")
const life = Import.ref(importId)
const story = Story.make(Catalog)
type Step = Parameters<typeof story>[number]
const dana: Actor = { organizationId: "org_prairie", memberId: "mem_dana", role: "editor" }
const ana: Actor = { organizationId: "org_prairie", memberId: "mem_ana", role: "editor" }

/** Every decided row's decision as the text the model holds: the flags the contract's `RowDecision` is stored as. */
const Texts = S.Record(S.String, S.fromJsonString(RowDecision))
const Flags = S.fromJsonString(RowDecision)
const textsOf = (decisions: SavedDecisions): Effect.Effect<Readonly<Record<string, string>>> =>
  Effect.orDie(S.encodeEffect(Texts)(decisions))
/** What a row is decided as, as text; a row with no decision reads as one that decides nothing. */
const textOf = (texts: Readonly<Record<string, string>>, row: string): string =>
  O.getOrElse(R.get(texts, row), () => NO_DECISION)
/** The region's decisions as the texts the server is sent. */
const regionTexts = (decisions: Readonly<Record<string, ReviewDecision>>) => textsOf(toServerDecisions(decisions))

/** What a press sent: nothing, one row's act, or one group act. */
type Sent = Data.TaggedEnum<{
  Nothing: {}
  RowAct: { readonly row: string; readonly change: number }
  GroupAct: { readonly step: string; readonly change: number }
}>
const Sent = Data.taggedEnum<Sent>()

/** What an undo sent came to: taken, or refused with one of the two rejections a live screen can meet. */
type Undid = "taken" | "GroupedAfter" | "NotYourStep"

/** A level of a row's own history, as the screen received it, with the decision it is. */
interface Held {
  readonly level: Level
  readonly decision: ReviewDecision
}
/** A group act as the screen received it. */
interface KnownGroup extends GroupUnit {
  readonly step: string
  readonly by: string
  readonly under: number
  readonly count: number
}
/** The instances as read back after one press, before they are decoded. */
interface Reading {
  readonly rows: Readonly<Record<string, RowState>>
  readonly groups: Readonly<Record<string, GroupState>>
}

const levelOf = (input: {
  readonly change: number
  readonly by: string
  readonly step: string
  readonly flags: string
}) =>
  Level.make({
    change: input.change,
    by: input.by,
    step: input.step,
    flags: input.flags,
    madeOn: 0,
    label: "act",
    bySize: input.by.length,
    stepSize: input.step.length,
    flagsSize: input.flags.length,
    labelSize: "act".length
  })
/** Everything below the level under a row's decision, sealed as the row seals it: the oldest first. */
const sealed = (levels: ReadonlyArray<Level>): string => A.reduce(levels, "", (below, level) => seal({ level, below }))

/**
 * The model as a live screen holds it. Each command is written with the events the model must record for it, worked
 * out from what the screen received (a story fails on any other event and on a rejection), and after each press the
 * instances it touched are read back from the model itself: the fold reads those, never this bookkeeping.
 */
const modelSide = (input: { readonly rows: number; readonly first: Actor }) => {
  const steps: Array<Step> = [
    Story.given(
      life,
      ImportStaged.make({
        organizationId: input.first.organizationId,
        rows: input.rows,
        columns: "by heading",
        by: input.first.memberId
      })
    ),
    Story.provide(CurrentActor, input.first)
  ]
  let acting = input.first
  let changes = 0
  let lastGroup = 0
  let topGroup = 0
  let own: Readonly<Record<string, ReadonlyArray<Held>>> = {}
  let groups: ReadonlyArray<KnownGroup> = []
  let touchedRows: ReadonlyArray<string> = []
  let touchedGroups: ReadonlyArray<string> = []
  let readRows: Readonly<Record<string, RowState>> = {}
  let readGroups: Readonly<Record<string, GroupState>> = {}
  // Group undos taken while a row the group names holds a row act made after the group (N1), and row undos taken on a
  // row three or more decisions deep, which bring a sealed level back.
  let behindRowActs = 0
  let sealedUndos = 0
  const readings: Array<Reading> = []
  const stackOf = (row: string): ReadonlyArray<Held> => O.getOrElse(R.get(own, row), () => [])
  const as = (actor: Actor): void => {
    if (actor.memberId === acting.memberId) return
    steps.push(Story.provide(CurrentActor, actor))
    acting = actor
  }
  const known = (): Instances => ({
    own: R.fromEntries(
      A.getSomes(
        A.map(R.toEntries(own), ([row, stack]) =>
          O.map(A.last(stack), (top) => [row, { change: top.level.change, decision: top.decision }] as const)
        )
      )
    ),
    groups
  })

  const decideRow = Effect.fnUntraced(function* (actor: Actor, step: string, row: string, decision: ReviewDecision) {
    as(actor)
    const texts = yield* regionTexts({ [row]: decision })
    const flags = textOf(texts, row)
    const stack = stackOf(row)
    const top = A.last(stack)
    const covered = coveredIn(known(), row)
    // On a covered row the screen says whether the press leaves it reading as it reads through its groups: then it is
    // no change, and recorded as nobody's (Benjamin, 2026-11-22: "No change, Ana's undo applies").
    const asItReads = covered && holdsAlready(foldRow(known(), row), decision)
    steps.push(
      Story.when(
        DecideRow.make({
          importId,
          row: RowId.make(row),
          step,
          sawGroup: lastGroup,
          covered,
          asItReads,
          opening: 0,
          saw: O.match(top, { onNone: () => 0, onSome: (held) => held.level.change }),
          flags,
          madeOn: 0,
          label: "act"
        })
      )
    )
    touchedRows = A.append(touchedRows, row)
    // The row reads as this already, through its groups or by its own instance: the model records nothing.
    if (
      covered ? asItReads : flags === O.match(top, { onNone: () => NO_DECISION, onSome: (held) => held.level.flags })
    ) {
      return Sent.Nothing()
    }
    changes += 1
    const change = changes
    steps.push(
      Story.then(
        Row.ref(`${importId}/${row}`),
        RowDecided.make({
          importId,
          organizationId: actor.organizationId,
          change,
          by: actor.memberId,
          step,
          flags,
          madeOn: 0,
          label: "act"
        })
      ),
      Story.then(
        life,
        ActCounted.make({
          change,
          step,
          row,
          label: "act",
          holds: change,
          by: actor.memberId,
          actor: actor.memberId,
          flags,
          madeOn: 0
        })
      )
    )
    own = R.set(own, row, A.append(stack, { level: levelOf({ change, by: actor.memberId, step, flags }), decision }))
    return Sent.RowAct({ row, change })
  })

  const undoRow = (actor: Actor, step: string, row: string, undo: number): Undid => {
    as(actor)
    const stack = stackOf(row)
    const mine = O.exists(A.last(stack), (top) => top.level.change === undo && top.level.by === actor.memberId)
    const rest = A.dropRight(stack, 1)
    const under = A.last(rest)
    // The model takes the level brought to go under the decision put back only when it seals to what the row holds.
    const kept = stack.length >= 3
    const next = kept ? O.getOrElse(A.get(stack, stack.length - 3), () => ({ level: noLevel })).level : noLevel
    const below = kept ? sealed(A.map(A.take(stack, stack.length - 3), (held) => held.level)) : ""
    // A group in force decided after the row's decision covers it: the screen says so, as it does for a row's act.
    const covered = coveredIn(known(), row)
    const command = UndoRowStep.make({
      importId,
      row: RowId.make(row),
      undo,
      step,
      sawGroup: lastGroup,
      covered,
      opening: 0,
      next,
      below
    })
    // Someone else decided the row since: it holds no decision of the sender's to take back.
    if (!mine) {
      steps.push(Story.when(command), Story.rejected(NotYourStep.make({})))
      return "NotYourStep"
    }
    // The decision lies under a later group in force: it is not taken back from under it.
    if (covered) {
      steps.push(Story.when(command), Story.rejected(GroupedAfter.make({ last: topGroup })))
      return "GroupedAfter"
    }
    changes += 1
    if (kept) sealedUndos += 1
    const level = O.match(under, { onNone: () => noLevel, onSome: (held) => held.level })
    steps.push(
      Story.when(command),
      Story.then(Row.ref(`${importId}/${row}`), StepUndone.make({ next, below, undo, step, by: actor.memberId })),
      Story.then(
        life,
        ActCounted.make({
          change: changes,
          step,
          row,
          label: "undo",
          holds: level.change,
          by: level.by,
          actor: actor.memberId,
          flags: level.flags,
          madeOn: level.madeOn
        })
      )
    )
    touchedRows = A.append(touchedRows, row)
    own = R.set(own, row, rest)
    return "taken"
  }

  const decideGroup = Effect.fnUntraced(function* (actor: Actor, step: string, parts: ReadonlyArray<Part>) {
    as(actor)
    const patch = yield* S.encodeEffect(GroupPatches)(A.map(parts, (part) => part.patch))
    const rows = yield* S.encodeEffect(GroupRows)(A.map(parts, (part) => part.rows))
    const count = A.reduce(parts, 0, (n, part) => n + part.rows.length)
    steps.push(
      Story.when(
        DecideGroup.make({ importId, step, opening: 0, seen: changes, madeOn: 0, patch, rows, count, label: "group" })
      )
    )
    changes += 1
    const change = changes
    steps.push(
      Story.then(
        Group.ref(`${importId}/${step}`),
        GroupDecided.make({
          importId,
          organizationId: actor.organizationId,
          change,
          by: actor.memberId,
          step,
          patch,
          rows,
          count,
          madeOn: 0,
          label: "group",
          under: topGroup
        })
      ),
      Story.then(
        life,
        GroupCounted.make({ change, step, rows: count, label: "group", by: actor.memberId, top: change })
      )
    )
    groups = A.append(groups, { step, change, by: actor.memberId, under: topGroup, undoneAt: 0, count, parts })
    topGroup = change
    lastGroup = change
    touchedGroups = A.append(touchedGroups, step)
    return Sent.GroupAct({ step, change })
  }, Effect.orDie)

  const undoGroup = (actor: Actor, step: string): Undid =>
    O.match(
      A.findFirst(groups, (group) => group.step === step),
      {
        onNone: (): Undid => "NotYourStep",
        onSome: (group): Undid => {
          as(actor)
          const command = UndoGroup.make({ importId, step, undo: group.change, opening: 0 })
          if (group.undoneAt !== 0 || group.by !== actor.memberId) {
            steps.push(Story.when(command), Story.rejected(NotYourStep.make({})))
            return "NotYourStep"
          }
          // A later group is in force over it: only the last in force is taken back.
          if (group.change !== topGroup) {
            steps.push(Story.when(command), Story.rejected(GroupedAfter.make({ last: topGroup })))
            return "GroupedAfter"
          }
          const named = A.flatMap(group.parts, (part) => part.rows)
          if (A.some(named, (row) => O.exists(A.last(stackOf(row)), (top) => top.level.change > group.change))) {
            behindRowActs += 1
          }
          changes += 1
          const change = changes
          steps.push(
            Story.when(command),
            Story.then(Group.ref(`${importId}/${step}`), GroupUndone.make({ change })),
            Story.then(
              life,
              GroupCounted.make({
                change,
                step,
                rows: group.count,
                label: "undo",
                by: actor.memberId,
                top: group.under
              })
            )
          )
          groups = A.map(groups, (g) => (g.step === step ? { ...g, undoneAt: change } : g))
          topGroup = group.under
          lastGroup = change
          touchedGroups = A.append(touchedGroups, step)
          return "taken"
        }
      }
    )

  return {
    steps,
    readings,
    known,
    decideRow,
    decideGroup,
    /** Takes back what a press sent: a row's act by UndoRowStep, a group act by UndoGroup. */
    undo: (actor: Actor, step: string, sent: Sent): Undid =>
      Sent.$match(sent, {
        Nothing: (): Undid => "taken",
        RowAct: ({ row, change }) => undoRow(actor, step, row, change),
        GroupAct: (group) => undoGroup(actor, group.step)
      }),
    /** Reads back every instance the last press touched, then keeps all of them as they stand. */
    mark: (): void => {
      for (const row of A.dedupe(touchedRows)) {
        steps.push(
          Story.state(Row.ref(`${importId}/${row}`), (state) => {
            readRows = R.set(readRows, row, state)
          })
        )
      }
      for (const step of A.dedupe(touchedGroups)) {
        steps.push(
          Story.state(Group.ref(`${importId}/${step}`), (state) => {
            readGroups = R.set(readGroups, step, state)
          })
        )
      }
      steps.push(
        Story.state(life, () => {
          readings.push({ rows: readRows, groups: readGroups })
        })
      )
      touchedRows = []
      touchedGroups = []
    },
    /**
     * How many groups are in force now, how deep the deepest row's own history is, and the rows two or more groups in
     * force name.
     */
    depth: () => {
      const inForce = A.filter(groups, (group) => group.undoneAt === 0)
      const named = A.flatMap(inForce, (group) => A.dedupe(A.flatMap(group.parts, (part) => part.rows)))
      return {
        inForce: inForce.length,
        deepest: A.reduce(R.values(own), 0, (most, stack) => Math.max(most, stack.length)),
        stacked:
          inForce.length < 2
            ? []
            : R.keys(
                R.filter(
                  A.groupBy(named, (row) => row),
                  (rows) => rows.length >= 2
                )
              )
      }
    },
    /** How many parts the group act a step sent has: more than one when its rows got different patches. */
    partsIn: (step: string): number =>
      O.match(
        A.findFirst(groups, (group) => group.step === step),
        { onNone: () => 0, onSome: (group) => group.parts.length }
      ),
    /** The group undos taken behind a later row act on their rows, and the row undos that brought a sealed level. */
    reached: () => ({ behindRowActs, sealedUndos })
  }
}
type ModelSide = ReturnType<typeof modelSide>

/** The instances of one reading, decoded: a row's flags as the region's decision, a group's texts as its parts. */
const decoded = Effect.fnUntraced(function* (reading: Reading) {
  const own = yield* Effect.forEach(
    R.toEntries(reading.rows),
    Effect.fnUntraced(function* ([row, state]) {
      if (!isDecided(state)) return O.none<readonly [string, Own]>()
      const decision = yield* Effect.orDie(S.decodeEffect(Flags)(state.flags))
      return O.map(
        R.get(toRegionDecisions({ [row]: decision }), row),
        (region) => [row, { change: state.change, decision: region }] as const
      )
    }),
    { concurrency: 1 }
  )
  const groups = yield* Effect.forEach(
    R.values(reading.groups),
    Effect.fnUntraced(function* (state) {
      if (!isDecidedGroup(state)) return O.none<GroupUnit>()
      const patches = yield* S.decodeEffect(GroupPatches)(state.patch)
      const rows = yield* S.decodeEffect(GroupRows)(state.rows)
      const parts = A.zipWith(patches, rows, (patch, named): Part => ({ patch, rows: named }))
      return O.some<GroupUnit>({ change: state.change, undoneAt: state.undoneAt, parts })
    }, Effect.orDie),
    { concurrency: 1 }
  )
  const instances: Instances = { own: R.fromEntries(A.getSomes(own)), groups: A.getSomes(groups) }
  return instances
})

/** The rows where the fold of the model's instances and the decisions `act` holds say different things. */
const apartFrom = Effect.fnUntraced(function* (reading: Reading, expected: Readonly<Record<string, string>>) {
  const instances = yield* decoded(reading)
  const folded = yield* regionTexts(fold(instances))
  return A.map(
    A.filter(
      A.dedupe([...R.keys(folded), ...R.keys(expected)]),
      (row) => textOf(folded, row) !== textOf(expected, row)
    ),
    (row) => `${row}: the fold ${textOf(folded, row)}, act ${textOf(expected, row)}`
  )
})

// ---------------------------------------------------------------------------------------------------------------
// People on live screens, `act` as the reference
// ---------------------------------------------------------------------------------------------------------------

/** Which step last named each row: an undo or a redo has an answer only while its rows still carry the touch it left. */
type Touches = Readonly<Record<string, number>>

/** A press as it was translated and sent, kept for its undo, with the touches it found on its rows and left there. */
interface Done {
  readonly action: Action
  readonly unit: Unit
  readonly sent: Sent
  readonly prior: Touches
  readonly after: Touches
}
/** A press taken back, kept for its redo: the touches its undo left (none when it had no answer) and its own. */
interface Undone {
  readonly action: Action
  readonly unit: Unit
  readonly expect: O.Option<Touches>
  readonly after: Touches
}
/** One person's histories: the units they sent, and `act`'s own steps beside them. */
interface Person {
  readonly undo: ReadonlyArray<Done>
  readonly redo: ReadonlyArray<Undone>
  readonly steps: { readonly undo: ReadonlyArray<UndoStep>; readonly redo: ReadonlyArray<UndoStep> }
}
const nobody: Person = { undo: [], redo: [], steps: { undo: [], redo: [] } }

/**
 * How a press is translated. `redo`: "same" sends the undone unit's own rows and patches again; "again" presses the
 * action again on the screen (counterexample C1). `rows`: "changed" sends only the rows whose decision the press
 * changed; "written" every row `act` wrote, a covered row's no-change press included (counterexample C2, which the
 * model now answers "no change", so both agree).
 */
interface How {
  readonly redo: "same" | "again"
  readonly rows: "changed" | "written"
}
const right: How = { redo: "same", rows: "changed" }

type Recheck = Parameters<typeof act>[0]["recheck"]

/** What one press came to: what kind of press, what it sent, whether the reference had an answer, any refusal. */
interface Pressed {
  readonly kind: "new" | "undo" | "redo"
  readonly sent: Sent
  readonly answer: boolean
  readonly undid: Undid
}

/**
 * A review on live screens, judged by one reference: one shared map of decisions, which `act` changes press by press,
 * each person's history kept apart (an undo is `act`'s undo of the presser's own last step over the map as it is).
 * An undo or a redo has an answer only while nobody, the presser included, named its rows since; where it has none,
 * `act` would overwrite somebody's later decision, so the reference takes the model's fold as the map and judges later
 * presses from there. A refused undo leaves the map as it is: one refused because a later group is in force stays on
 * the person's history, one refused as not theirs is dropped. Every press is also translated and sent to the model,
 * and after it the texts `act` holds are kept where there is an answer, to compare with the fold of what the model
 * holds. Both screens are live: each holds every change, so each draws the shared map.
 */
const liveReview = (input: {
  readonly side: ModelSide
  readonly rows: (decisions: Readonly<Record<string, ReviewDecision>>) => ReadonlyArray<ReviewRow>
  readonly recheck: Recheck
  /** Which steps count as naming a row: any whose rows hold it (the default), or only one that changed it. */
  readonly touching?: "named" | "changed"
}) => {
  let decisions = HashMap.empty<string, ReviewDecision>()
  let people: Readonly<Record<string, Person>> = {}
  let touch: Touches = {}
  let tick = 0
  let presses = 0
  const expected: Array<O.Option<Readonly<Record<string, string>>>> = []
  const apart: Array<string> = []
  const checking = input.recheck === undefined ? {} : { recheck: input.recheck }
  const stateOf = (steps: Person["steps"]): ReviewState => ({ decisions, undo: steps.undo, redo: steps.redo })
  const personOf = (actor: Actor): Person => O.getOrElse(R.get(people, actor.memberId), () => nobody)
  const touchOf = (row: string): number => O.getOrElse(R.get(touch, row), () => 0)
  const rowsOf = (step: UndoStep): ReadonlyArray<string> => step.before.pipe(HashMap.keys, A.fromIterable)
  const look = () => {
    const rows = input.rows(saved(stateOf(nobody.steps)))
    return { rows, views: viewRows({ rows, state: stateOf(nobody.steps), ...checking }) }
  }
  /**
   * Each row of a step gets a new touch (with `touching: "changed"`, only a row whose decision it changed from
   * `before`): what it carried before, and what it carries now.
   */
  const touchStep = (step: UndoStep, before: HashMap.HashMap<string, ReviewDecision>) => {
    const rows = rowsOf(step)
    const prior: Touches = R.fromEntries(A.map(rows, (row) => [row, touchOf(row)] as const))
    for (const row of rows) {
      const now = O.getOrElse(HashMap.get(decisions, row), () => undecided)
      if (input.touching === "changed" && holdsAlready(HashMap.get(before, row), now)) continue
      tick += 1
      touch = R.set(touch, row, tick)
    }
    const after: Touches = R.fromEntries(A.map(rows, (row) => [row, touchOf(row)] as const))
    return { prior, after }
  }
  /** Every step's rows still carry the touches it expects. */
  const stands = (rows: ReadonlyArray<string>, touches: O.Option<Touches>): boolean =>
    O.exists(touches, (t) => A.every(rows, (row) => O.exists(R.get(t, row), (n) => n === touchOf(row))))
  /** Where there is no answer: the map becomes the model's fold, and every row it moved, or `also` names, is touched. */
  const follow = (also: ReadonlyArray<string>): HashMap.HashMap<string, ReviewDecision> => {
    const before = decisions
    decisions = HashMap.fromIterable(R.toEntries(fold(input.side.known())))
    const rows = A.dedupe([...HashMap.keys(before), ...HashMap.keys(decisions), ...also])
    for (const row of rows) {
      const moved = O.match(HashMap.get(decisions, row), {
        onNone: () => !holdsAlready(HashMap.get(before, row), undecided),
        onSome: (now) => !holdsAlready(HashMap.get(before, row), now)
      })
      if (moved || A.contains(also, row)) {
        tick += 1
        touch = R.set(touch, row, tick)
      }
    }
    return before
  }
  /** `act`'s step for what the model did, on every row that moved and on `also`. */
  const stepFrom = (before: HashMap.HashMap<string, ReviewDecision>, also: ReadonlyArray<string>): UndoStep => {
    const rows = A.filter(A.dedupe([...HashMap.keys(before), ...HashMap.keys(decisions), ...also]), (row) => {
      const now = HashMap.get(decisions, row)
      return A.contains(also, row) || O.isNone(now) || !holdsAlready(HashMap.get(before, row), now.value)
    })
    return {
      label: "as the model has it",
      before: HashMap.fromIterable(A.map(rows, (row) => [row, HashMap.get(before, row)] as const)),
      focus: O.none()
    }
  }

  /** Sends one unit as the model's commands: nothing, one row's act or one group act. */
  const send = Effect.fnUntraced(function* (actor: Actor, step: string, action: Action, unit: Unit, how: How) {
    const after = (written: Written) => applyPatch(HashMap.get(decisions, written.row), written.patch)
    const sending =
      how.rows === "written"
        ? unit
        : A.filter(unit, (written) => !holdsAlready(HashMap.get(decisions, written.row), after(written)))
    if (!A.isReadonlyArrayNonEmpty(sending)) return Sent.Nothing()
    if (isGroupAct(action, sending.length)) return yield* input.side.decideGroup(actor, step, partsOf(sending))
    if (sending.length > 1) apart.push(`${step}: ${action.type} changed ${sending.length} rows and is no group act`)
    const one = A.headNonEmpty(sending)
    return yield* input.side.decideRow(actor, step, one.row, after(one))
  })

  /** The translation says of every row what `act` wrote. */
  const agrees = (step: string, unit: Unit, written: ReadonlyArray<string>, next: ReviewState): void => {
    const rows = A.map(unit, (w) => w.row)
    if (rows.length !== written.length || !A.every(written, (row) => A.contains(rows, row))) {
      apart.push(`${step}: the translation wrote ${A.join(rows, ",")}, act ${A.join(written, ",")}`)
    }
    for (const w of unit) {
      const ours = applyPatch(HashMap.get(decisions, w.row), w.patch)
      const acts = HashMap.get(next.decisions, w.row)
      if (O.isNone(acts) || !sameDecision(ours, acts.value)) apart.push(`${step} ${w.row}: the patch is not act's`)
    }
  }

  const press = Effect.fnUntraced(function* (actor: Actor, action: Action, how: How = right) {
    const shown = look()
    const person = personOf(actor)
    const step = `press-${presses}`
    presses += 1
    const actOn = (steps: Person["steps"], pressed: Action) =>
      act({ rows: shown.rows, state: stateOf(steps), action: pressed, ...checking })
    let pressed: Pressed = { kind: "new", sent: Sent.Nothing(), answer: true, undid: "taken" }
    if (action.type === "undo") {
      const done = A.last(person.undo)
      const taken = A.last(person.steps.undo)
      if (O.isSome(done) && O.isSome(taken)) {
        const answer = stands(rowsOf(taken.value), O.some(done.value.after))
        const undid = input.side.undo(actor, step, done.value.sent)
        pressed = { kind: "undo", sent: done.value.sent, answer, undid }
        if (undid === "NotYourStep") {
          people = R.set(people, actor.memberId, {
            ...person,
            undo: A.dropRight(person.undo, 1),
            steps: { ...person.steps, undo: A.dropRight(person.steps.undo, 1) }
          })
        }
        if (undid === "taken") {
          const out = actOn({ undo: [taken.value], redo: [] }, action)
          if (answer) {
            decisions = out.state.decisions
            touch = { ...touch, ...done.value.prior }
          } else {
            follow([...R.keys(done.value.after), ...A.map(done.value.unit, (w) => w.row)])
          }
          people = R.set(people, actor.memberId, {
            undo: A.dropRight(person.undo, 1),
            redo: A.append(person.redo, {
              action: done.value.action,
              unit: done.value.unit,
              expect: answer ? O.some(done.value.prior) : O.none(),
              after: done.value.after
            }),
            steps: { undo: A.dropRight(person.steps.undo, 1), redo: [...person.steps.redo, ...out.state.redo] }
          })
        }
      }
    } else if (action.type === "redo") {
      const back = A.last(person.redo)
      const mirror = A.last(person.steps.redo)
      if (O.isSome(back) && O.isSome(mirror)) {
        const answer = stands(rowsOf(mirror.value), back.value.expect)
        const out = actOn({ undo: [], redo: [mirror.value] }, action)
        // A redo is a new act. "same": the undone unit's own rows and patches, on the decisions as they are now.
        const unit =
          how.redo === "same"
            ? back.value.unit
            : patchesFor({ views: shown.views, decisions, action: back.value.action })
        const sent = yield* send(actor, step, back.value.action, unit, how)
        pressed = { kind: "redo", sent, answer, undid: "taken" }
        let done: Done
        let taken: UndoStep
        if (answer) {
          decisions = out.state.decisions
          touch = { ...touch, ...back.value.after }
          taken = O.getOrElse(A.head(out.state.undo), () => mirror.value)
          done = {
            action: back.value.action,
            unit,
            sent,
            prior: O.getOrElse(back.value.expect, () => ({})),
            after: back.value.after
          }
        } else {
          const before = follow([])
          taken = stepFrom(
            before,
            A.map(unit, (w) => w.row)
          )
          const touched = touchStep(taken, before)
          done = { action: back.value.action, unit, sent, ...touched }
        }
        people = R.set(people, actor.memberId, {
          undo: A.append(person.undo, done),
          redo: A.dropRight(person.redo, 1),
          steps: { undo: A.append(person.steps.undo, taken), redo: A.dropRight(person.steps.redo, 1) }
        })
      }
    } else {
      const unit = patchesFor({ views: shown.views, decisions, action })
      const out = actOn(nobody.steps, action)
      agrees(step, unit, out.changed, out.state)
      const sent = yield* send(actor, step, action, unit, how)
      pressed = { kind: "new", sent, answer: true, undid: "taken" }
      const before = decisions
      decisions = out.state.decisions
      // `act` takes a step only when it wrote a row, and only then starts a new future.
      const taken = A.head(out.state.undo)
      if (O.isSome(taken)) {
        const touched = touchStep(taken.value, before)
        people = R.set(people, actor.memberId, {
          undo: A.append(person.undo, { action, unit, sent, ...touched }),
          redo: [],
          steps: { undo: A.append(person.steps.undo, taken.value), redo: [] }
        })
      }
    }
    input.side.mark()
    const held = yield* textsOf(toServerDecisions(saved(stateOf(nobody.steps))))
    expected.push(pressed.answer && pressed.undid === "taken" ? O.some(held) : O.none())
    return pressed
  })

  return {
    look,
    press,
    expected,
    apart,
    /** `act`'s own history for one person: what an undo or a redo would take. */
    history: (actor: Actor): Person["steps"] => personOf(actor).steps
  }
}

/**
 * Runs the story the presses wrote, then folds every reading where the reference had an answer and holds it beside
 * what `act` held after that press.
 */
const verdict = Effect.fnUntraced(function* (
  side: ModelSide,
  expected: ReadonlyArray<O.Option<Readonly<Record<string, string>>>>
) {
  yield* story(...side.steps)
  expect(side.readings.length).toBe(expected.length)
  const apart = yield* Effect.forEach(
    A.zip(side.readings, expected),
    ([reading, held]) =>
      O.match(held, { onNone: () => Effect.succeed(A.empty<string>()), onSome: (texts) => apartFrom(reading, texts) }),
    { concurrency: 1 }
  )
  return A.flatMap(apart, (rows, index) => A.map(rows, (row) => `press ${index}, ${row}`))
})

/** The decisions as plain flags, to compare by value. */
const flagsOf = (decisions: Readonly<Record<string, ReviewDecision>>) => R.map(decisions, (d) => toFlags(d))

// ---------------------------------------------------------------------------------------------------------------
// 1. The fold, one example per rule
// ---------------------------------------------------------------------------------------------------------------

const typedSku = ReviewDecision.make({ edits: { sku: "HB-8" } })
const typeUom = (value: string) => Patch.cases.edit.make({ kind: "edit", column: "uom", value })
const acceptUom = Patch.cases.accept.make({ kind: "accept", column: "uom", lift: false })
const groupOf = (change: number, parts: ReadonlyArray<Part>, undoneAt = 0): GroupUnit => ({ change, undoneAt, parts })

it("the fold: a row's own decision is what it reads as when no group is over it", () => {
  const instances: Instances = { own: { "row-1": { change: 3, decision: typedSku } }, groups: [] }
  expect(flagsOf(fold(instances))).toEqual({ "row-1": { edits: { sku: "HB-8" } } })
})

it("the fold: a group in force over a row applies its patch, to a row with no decision of its own too", () => {
  const instances: Instances = {
    own: { "row-1": { change: 3, decision: typedSku } },
    groups: [groupOf(5, [{ patch: acceptUom, rows: ["row-1", "row-2"] }])]
  }
  expect(flagsOf(fold(instances))).toEqual({
    "row-1": { accepted: ["uom"], edits: { sku: "HB-8" } },
    "row-2": { accepted: ["uom"] }
  })
})

it("the fold: a group taken back gives no row anything", () => {
  const instances: Instances = {
    own: { "row-1": { change: 3, decision: typedSku } },
    groups: [groupOf(5, [{ patch: acceptUom, rows: ["row-1", "row-2"] }], 6)]
  }
  expect(flagsOf(fold(instances))).toEqual({ "row-1": { edits: { sku: "HB-8" } } })
})

it("the fold: a row decided after a group keeps its whole decision; the group stays on its other rows", () => {
  const instances: Instances = {
    own: { "row-1": { change: 7, decision: ReviewDecision.make({ edits: { uom: "KG" } }) } },
    groups: [groupOf(5, [{ patch: typeUom("EA"), rows: ["row-1", "row-2"] }])]
  }
  expect(flagsOf(fold(instances))).toEqual({ "row-1": { edits: { uom: "KG" } }, "row-2": { edits: { uom: "EA" } } })
})

it("the fold: of two groups over a row the later is laid over the earlier, and its undo uncovers the earlier", () => {
  const earlier = groupOf(5, [{ patch: typeUom("EA"), rows: ["row-1"] }])
  const later = (undoneAt: number) => groupOf(8, [{ patch: typeUom("KG"), rows: ["row-1"] }], undoneAt)
  // Listed out of order on purpose: the fold orders groups by their number, not by how they are read back.
  expect(flagsOf(fold({ own: {}, groups: [later(0), earlier] }))).toEqual({ "row-1": { edits: { uom: "KG" } } })
  expect(flagsOf(fold({ own: {}, groups: [later(9), earlier] }))).toEqual({ "row-1": { edits: { uom: "EA" } } })
})

const why = Why.make({ basis: "the file's other rows" })
const unitFix = (column: string, to: string, group?: string) =>
  Fix.make({ column, to, kind: "unit", confidence: O.none(), ...(group === undefined ? {} : { group }), why })
const plainRow = (id: string, line: number) => ReviewRow.make({ id, line, cells: { a: "x", b: "x", c: "x" } })
const groupedRow = (id: string, line: number, to: string) =>
  ReviewRow.make({
    id,
    line,
    cells: { a: "x", b: "x", c: "x" },
    problem: Problem.make({ kind: "unit", column: "a", fix: unitFix("a", to, "g") })
  })

it.effect("the fold equals `act` on a group only when the group's rows are split by exactly what each got", () =>
  Effect.gen(function* () {
    // One press of "Set all to EA" over a group: row-1 proposed EA (accepted), row-2 proposed KG (EA typed instead).
    const rows = [groupedRow("row-1", 1, "EA"), groupedRow("row-2", 2, "KG")]
    const state: ReviewState = { decisions: HashMap.empty(), undo: [], redo: [] }
    const action: Action = { type: "chooseGroup", groupId: "g", value: "EA" }
    const unit = patchesFor({ views: viewRows({ rows, state }), decisions: state.decisions, action })
    const acted = yield* regionTexts(saved(act({ rows, state, action }).state))
    const split = partsOf(unit)
    expect(split.length).toBe(2)
    const one: ReadonlyArray<Part> = A.map(A.take(split, 1), (part) => ({ ...part, rows: A.map(unit, (w) => w.row) }))
    const splitByPatch = yield* regionTexts(fold({ own: {}, groups: [groupOf(1, split)] }))
    const onePatch = yield* regionTexts(fold({ own: {}, groups: [groupOf(1, one)] }))
    expect(splitByPatch).toEqual(acted)
    expect(onePatch).not.toEqual(acted)
  })
)

// ---------------------------------------------------------------------------------------------------------------
// 2 and 3. One person on a live screen, on the messy sample
// ---------------------------------------------------------------------------------------------------------------

/** The rows the Review step gives the region for decisions, and its recheck: the app's own wiring. */
const messy = (table: StagedTable) => {
  const input = { table, choices: [], storedItems: [] }
  const check = recheckRow(input)
  const recheck = (asked: { row: ReviewRow; cells: Readonly<Record<string, string>> }) => {
    const problem = check({ id: asked.row.id, values: asked.cells })
    const answered = asked.cells[storedChoice] === "keep" || asked.cells[storedChoice] === "replace"
    if (problem?.kind === "changed" && answered) return asked.row.problem
    return problem === undefined ? undefined : toRegionProblem(problem)
  }
  const rows = (decisions: Readonly<Record<string, ReviewDecision>>) => {
    const server = toServerDecisions(decisions)
    return toRegionRows(review({ ...input, decisions: server }), server)
  }
  return { rows, recheck, first: firstDecisions({ table, choices: [], mode: ruleFixes }) }
}

/**
 * How many rows, from the top of the file, a run presses row by row. Few, so the same rows are decided over and over
 * and their histories grow deep; the groups still reach every row of the file.
 */
const BUSY_ROWS = 12

/** The actions a person could press now on one row, read from what the screen shows: that row's own answers. */
const rowPresses = (views: ReadonlyArray<RowView>): ReadonlyArray<Action> =>
  A.flatMap(A.take(views, BUSY_ROWS), (view): ReadonlyArray<Action> => {
    const id = view.row.id
    const column = view.problem?.column
    return [
      ...(view.status === "needs" || view.status === "ready" ? [{ type: "leaveOut" as const, rowIds: [id] }] : []),
      ...(view.status === "out" ? [{ type: "putBack" as const, rowId: id }] : []),
      ...(view.status === "needs" && view.problem?.fix !== undefined
        ? [{ type: "accept" as const, rowIds: [id] }]
        : []),
      ...(view.problem?.rivals !== undefined ? [{ type: "keep" as const, rowId: id }] : []),
      ...(view.status === "needs" && column !== undefined
        ? A.map(
            A.append(
              A.map(view.problem?.choices ?? [], (choice) => choice.value),
              "ZZZ-9999"
            ),
            (value) => ({ type: "edit" as const, rowId: id, column, value })
          )
        : []),
      ...A.map(R.keys(view.marks), (marked) => ({
        type: "revert" as const,
        rowId: id,
        column: marked,
        how: "undo" as const
      }))
    ]
  })

/**
 * The actions a person could press now on several rows: three busy rows left out or their fixes accepted at once,
 * each waiting group's accept and choice (all of it, or with its first row unticked), each applied group's undo.
 */
const groupPresses = (views: ReadonlyArray<RowView>): ReadonlyArray<Action> => {
  const busy = A.take(views, BUSY_ROWS)
  const open = A.filter(busy, (view) => view.status === "needs" || view.status === "ready")
  const fixable = A.filter(busy, (view) => view.status === "needs" && view.problem?.fix !== undefined)
  return [
    ...(open.length > 1 ? [{ type: "leaveOut" as const, rowIds: A.map(A.take(open, 3), (view) => view.row.id) }] : []),
    ...(fixable.length > 1
      ? [{ type: "accept" as const, rowIds: A.map(A.take(fixable, 3), (view) => view.row.id) }]
      : []),
    ...A.flatMap(waitingGroups({ views }), (group): ReadonlyArray<Action> => [
      { type: "acceptGroup", groupId: group.id, except: [] },
      { type: "acceptGroup", groupId: group.id, except: A.take(group.rowIds, 1) },
      { type: "chooseGroup", groupId: group.id, value: group.to, except: [] },
      { type: "chooseGroup", groupId: group.id, value: "ZZZ-9999", except: [] }
    ]),
    ...A.map(appliedGroups(views), (group) => ({ type: "revertGroup" as const, groupId: group.id }))
  ]
}

/**
 * The press a number picks: an undo for three in ten of them while there is a step to undo, a redo for a tenth while
 * there is one to put back, so histories grow deep and are walked back; otherwise a press on one row for four in ten
 * and one on several rows for two in ten (or the other kind, when the screen offers none of the first).
 */
const pressFor = (pick: number, history: Person["steps"], views: ReadonlyArray<RowView>): O.Option<Action> => {
  const turn = pick % 100
  if (turn < 30 && A.isReadonlyArrayNonEmpty(history.undo)) return O.some({ type: "undo" as const })
  if (turn < 40 && A.isReadonlyArrayNonEmpty(history.redo)) return O.some({ type: "redo" as const })
  const one = rowPresses(views)
  const several = groupPresses(views)
  const first = turn < 80 ? one : several
  const actions = A.isReadonlyArrayNonEmpty(first) ? first : turn < 80 ? several : one
  return A.get(actions, Math.floor(pick / 100) % Math.max(actions.length, 1))
}

/** What one run did, for the tests that say how far the sequences went. */
interface Walked {
  readonly apart: ReadonlyArray<string>
  readonly groupActs: number
  readonly groupUndos: number
  readonly rowActs: number
  readonly rowUndos: number
  readonly mostInForce: number
  readonly deepest: number
  /** Redos pressed and taken, and of them those that sent a DecideGroup and those that sent a DecideRow. */
  readonly redos: number
  readonly groupRedos: number
  readonly rowRedos: number
  /** Group acts sent, a redo's included, whose rows got more than one patch: a group of several parts. */
  readonly splitGroups: number
  /** Rows that at some moment had two or more groups in force naming them. */
  readonly stackedRows: number
  /** Group undos taken while a row the group names held a row act made after the group (N1). */
  readonly behindRowActs: number
  /** Row undos taken on a row three or more decisions deep: each brought a sealed level back. */
  readonly sealedUndos: number
  /** Presses where the reference had an answer and the fold was compared with it. */
  readonly compared: number
  /** Undos and redos the model took where the reference had no answer. */
  readonly noAnswer: number
  /** Undos the model refused, by the rejection it gave. */
  readonly groupedAfter: number
  readonly notYourStep: number
}

/**
 * Presses one seeded sequence on the messy sample, sends it, runs the story and folds every reading. With one person
 * every press is Dana's; with two, the top half of the numbers are Ana's presses, each on her own live screen.
 * `touching` is the reference's: which steps count as naming a row.
 */
const walk = Effect.fnUntraced(function* (
  table: StagedTable,
  picks: ReadonlyArray<number>,
  people: "one" | "two" = "one",
  touching: "named" | "changed" = "named"
) {
  const screen = messy(table)
  // With rule fixes in force a review starts with no decision, as every row of the model does.
  expect(screen.first).toEqual({})
  const side = modelSide({ rows: table.rows.length, first: dana })
  const live = liveReview({ side, rows: screen.rows, recheck: screen.recheck, touching })
  let groupActs = 0
  let groupUndos = 0
  let rowActs = 0
  let rowUndos = 0
  let mostInForce = 0
  let deepest = 0
  let redos = 0
  let groupRedos = 0
  let rowRedos = 0
  let splitGroups = 0
  let stackedRows: ReadonlyArray<string> = []
  let noAnswer = 0
  let groupedAfter = 0
  let notYourStep = 0
  const refused: Array<string> = []
  for (const pick of picks) {
    const actor = people === "two" && pick >= 500_000 ? ana : dana
    const press = pressFor(pick, live.history(actor), live.look().views)
    if (O.isNone(press)) continue
    const { kind, sent, answer, undid } = yield* live.press(actor, press.value)
    // One person's history is walked back in order: every undo and redo has an answer, and none is refused.
    if (people === "one" && (!answer || undid !== "taken")) refused.push(`${kind}: answer ${answer}, ${undid}`)
    if (!answer && undid === "taken") noAnswer += 1
    if (undid === "GroupedAfter") groupedAfter += 1
    if (undid === "NotYourStep") notYourStep += 1
    if (undid !== "taken") continue
    if (kind === "redo") redos += 1
    Sent.$match(sent, {
      Nothing: () => undefined,
      RowAct: () => {
        if (kind === "undo") {
          rowUndos += 1
          return
        }
        rowActs += 1
        if (kind === "redo") rowRedos += 1
      },
      GroupAct: ({ step }) => {
        if (kind === "undo") {
          groupUndos += 1
          return
        }
        groupActs += 1
        if (kind === "redo") groupRedos += 1
        if (side.partsIn(step) > 1) splitGroups += 1
      }
    })
    const now = side.depth()
    mostInForce = Math.max(mostInForce, now.inForce)
    deepest = Math.max(deepest, now.deepest)
    stackedRows = A.union(stackedRows, now.stacked)
  }
  const folded = yield* verdict(side, live.expected)
  const apart = [...live.apart, ...refused, ...folded]
  const compared = A.filter(live.expected, O.isSome).length
  const walked: Walked = {
    apart,
    groupActs,
    groupUndos,
    rowActs,
    rowUndos,
    mostInForce,
    deepest,
    redos,
    groupRedos,
    rowRedos,
    splitGroups,
    stackedRows: stackedRows.length,
    ...side.reached(),
    compared,
    noAnswer,
    groupedAfter,
    notYourStep
  }
  return walked
})

/** The numbers that pick each press of one run: sixty to ninety of them. */
const Picks = S.Array(S.Int.check(S.isBetween({ minimum: 0, maximum: 999_999 }))).check(
  S.isMinLength(60),
  S.isMaxLength(90)
)
const SEED = 20261122
const RUNS = 25

/** What the runs of one property did, added up: the most in force and the deepest are the most any run reached. */
type Tally = Omit<Walked, "apart">
const nothingYet: Tally = {
  groupActs: 0,
  groupUndos: 0,
  rowActs: 0,
  rowUndos: 0,
  mostInForce: 0,
  deepest: 0,
  redos: 0,
  groupRedos: 0,
  rowRedos: 0,
  splitGroups: 0,
  stackedRows: 0,
  behindRowActs: 0,
  sealedUndos: 0,
  compared: 0,
  noAnswer: 0,
  groupedAfter: 0,
  notYourStep: 0
}
const addUp = (tally: Tally, walked: Walked): Tally =>
  R.map(tally, (n, key) => (key === "mostInForce" || key === "deepest" ? Math.max(n, walked[key]) : n + walked[key]))

// The run is the same on every machine: a fixed seed and a fixed run count give the same sequences, and nothing in a
// walk reads the clock or races. So each tally below is the number the seed gives, asserted exactly.

let runs = 0
let tally = nothingYet

it.effect.prop(
  "one person on a live screen: after every press the fold of the model's instances is what `act` holds",
  { picks: Picks },
  ({ picks }) =>
    Effect.gen(function* () {
      const table = yield* stage(sample("items_messy.csv"))
      const walked = yield* walk(table, picks)
      runs += 1
      tally = addUp(tally, walked)
      // The translation matches `act` at every press, and the model took every command (the story fails on a
      // rejection and on an event no step names).
      expect(walked.apart).toEqual([])
    }),
  { arbitrary: { runs: RUNS, seed: SEED }, timeout: 600_000 }
)

it("the sequences sent many group acts, took many of them back, and stacked groups and decisions deep", () => {
  expect(runs).toBe(RUNS)
  // 432 group acts sent (a redo of one is a new one) and 319 taken back by UndoGroup; 405 row acts and 300 row undos.
  expect(tally.groupActs).toBe(432)
  expect(tally.groupUndos).toBe(319)
  expect(tally.rowActs).toBe(405)
  expect(tally.rowUndos).toBe(300)
  // 77 redos pressed: 34 sent a DecideGroup and 43 a DecideRow, so a redo of each kind was a new act of its kind.
  expect(tally.redos).toBe(77)
  expect(tally.groupRedos).toBe(34)
  expect(tally.rowRedos).toBe(43)
  // 50 group acts whose rows got different patches, the case the file's sentence rests on; ten groups in force at
  // once, and 53 rows two or more of them named at the same moment.
  expect(tally.splitGroups).toBe(50)
  expect(tally.mostInForce).toBe(10)
  expect(tally.stackedRows).toBe(53)
  // Five decisions deep on one row, and 12 row undos that brought a sealed level back.
  expect(tally.deepest).toBe(5)
  expect(tally.sealedUndos).toBe(12)
  expect(tally.compared).toBe(1500)
  // Not reached by one person: a group undone behind a later row act on its rows (N1). One history is walked back in
  // order, so the row act is taken back before the group is. The two-people properties below reach it.
})

// ---------------------------------------------------------------------------------------------------------------
// 4. Two people on live screens
// ---------------------------------------------------------------------------------------------------------------

let twoRuns = 0
let twoTally = nothingYet

it.effect.prop(
  "two people on live screens: where `act` has an answer the fold is what it holds, and a refusal is a named one",
  { picks: Picks },
  ({ picks }) =>
    Effect.gen(function* () {
      const table = yield* stage(sample("items_messy.csv"))
      const walked = yield* walk(table, picks, "two")
      twoRuns += 1
      twoTally = addUp(twoTally, walked)
      // The story names each refusal exactly (GroupedAfter with the group in force, or NotYourStep) and fails on any
      // other, and on an act it refused that was not foreseen.
      expect(walked.apart).toEqual([])
    }),
  { arbitrary: { runs: RUNS, seed: SEED }, timeout: 600_000 }
)

it("two people met every case: compared presses, undos with no answer, and both refusals", () => {
  expect(twoRuns).toBe(RUNS)
  // 1,344 presses compared with `act`; 397 group acts sent and 129 taken back; 463 row acts and 291 row undos.
  expect(twoTally.compared).toBe(1344)
  expect(twoTally.groupActs).toBe(397)
  expect(twoTally.groupUndos).toBe(129)
  expect(twoTally.rowActs).toBe(463)
  expect(twoTally.rowUndos).toBe(291)
  // 119 redos pressed: 18 sent a DecideGroup, 96 a DecideRow, and 5 sent nothing (the rows already held what the
  // undone unit gives them, after the other person's presses).
  expect(twoTally.redos).toBe(119)
  expect(twoTally.groupRedos).toBe(18)
  expect(twoTally.rowRedos).toBe(96)
  // 41 group acts of several parts; twenty groups in force at once, and 89 rows named by two or more at one moment.
  expect(twoTally.splitGroups).toBe(41)
  expect(twoTally.mostInForce).toBe(20)
  expect(twoTally.stackedRows).toBe(89)
  // One group undone behind a later row act on its rows (N1): the reference had no answer there, so the model's map
  // was adopted, not compared. Five decisions deep, and 8 row undos that brought a sealed level back.
  expect(twoTally.behindRowActs).toBe(1)
  expect(twoTally.deepest).toBe(5)
  expect(twoTally.sealedUndos).toBe(8)
  // 13 undos or redos the model took where `act` had no answer (a row named since by someone); 136 group undos
  // refused as GroupedAfter and 7 undos refused as NotYourStep.
  expect(twoTally.noAnswer).toBe(13)
  expect(twoTally.groupedAfter).toBe(136)
  expect(twoTally.notYourStep).toBe(7)
})

/*
 * Under the reference's touching "named", a press that writes a row without changing it still names the row, so a
 * later undo over it has no answer and the reference takes the model's map: what the translation sends for such a
 * press is never compared. Under "changed" only a step that changed a row names it, the undo keeps its answer, and
 * the translation's one choice (it sends only the rows whose decision a press changed, not every row `act` wrote) is
 * compared on every press that has one.
 *
 * Before the model answered a covered row's no-change press "no change" (`asItReads`, Benjamin, 2026-11-22: "No
 * change, Ana's undo applies"), the two translations differed: at 200 runs with this seed, "every row `act` wrote"
 * failed at run 169, a group's typed value kept past its undo by a covered row's no-change act, as in C2. Now the
 * model records nothing for such a press, and the hand-written C2 test shows both translations agreeing. 25 runs.
 */
let changedRuns = 0
let changedTally = nothingYet

it.effect.prop(
  "two people on live screens, a step naming a row only when it changed it: where `act` has an answer the fold is what it holds",
  { picks: Picks },
  ({ picks }) =>
    Effect.gen(function* () {
      const table = yield* stage(sample("items_messy.csv"))
      const walked = yield* walk(table, picks, "two", "changed")
      changedRuns += 1
      changedTally = addUp(changedTally, walked)
      expect(walked.apart).toEqual([])
    }),
  { arbitrary: { runs: RUNS, seed: SEED }, timeout: 600_000 }
)

it("two people, a step naming a row only when it changed it: compared presses, no-answer presses and refusals", () => {
  expect(changedRuns).toBe(RUNS)
  // The same sequences as the property above, so the same presses: three more of them compared (1,347 against
  // 1,344), and three fewer with no answer (10 against 13), where a press that changed nothing no longer names a row.
  expect(changedTally.compared).toBe(1347)
  expect(changedTally.noAnswer).toBe(10)
  expect(changedTally.groupedAfter).toBe(136)
  expect(changedTally.notYourStep).toBe(7)
  expect(changedTally.groupActs).toBe(397)
  expect(changedTally.groupUndos).toBe(129)
  expect(changedTally.rowActs).toBe(463)
  expect(changedTally.rowUndos).toBe(291)
  expect(changedTally.redos).toBe(119)
  expect(changedTally.groupRedos).toBe(18)
  expect(changedTally.rowRedos).toBe(96)
  expect(changedTally.splitGroups).toBe(41)
  expect(changedTally.mostInForce).toBe(20)
  expect(changedTally.stackedRows).toBe(89)
  expect(changedTally.behindRowActs).toBe(1)
  expect(changedTally.deepest).toBe(5)
  expect(changedTally.sealedUndos).toBe(8)
})

// ---------------------------------------------------------------------------------------------------------------
// 5. Why the translation is what it is: the counterexamples, each in its smallest form
// ---------------------------------------------------------------------------------------------------------------

/** Two people on live screens over hand-made rows: the presses, then the fold of the last reading beside `act`. */
const twoOn = Effect.fnUntraced(function* (
  rows: ReadonlyArray<ReviewRow>,
  presses: ReadonlyArray<readonly [Actor, Action]>,
  how: How,
  touching: "named" | "changed" = "named"
) {
  const side = modelSide({ rows: rows.length, first: dana })
  const live = liveReview({ side, rows: () => rows, recheck: undefined, touching })
  for (const [actor, action] of presses) yield* live.press(actor, action, how)
  const apart = yield* verdict(side, live.expected)
  // The instances read back from the model after the last press, once the story has run: not the test's own record.
  const read = yield* A.last(side.readings).pipe(Effect.fromOption, Effect.orDie)
  const instances = yield* decoded(read)
  return {
    translation: live.apart,
    answered: O.isSome(O.getOrElse(A.last(live.expected), () => O.none())),
    last: A.filter(apart, (line) => Str.startsWith(`press ${presses.length - 1},`)(line)),
    // What each row reads as on the model after the last press, and each group act as the model holds it.
    folded: flagsOf(fold(instances)),
    groups: instances.groups
  }
})

it.effect(
  "C1: a redo is the undone unit's own rows and patches; pressing the action again reaches a row it never had",
  () =>
    Effect.gen(function* () {
      const rows = [plainRow("row-1", 1), plainRow("row-2", 2)]
      const presses: ReadonlyArray<readonly [Actor, Action]> = [
        [ana, { type: "leaveOut", rowIds: ["row-1"] }],
        // row-1 is out already: Dana's press writes row-2 only.
        [dana, { type: "leaveOut", rowIds: ["row-1", "row-2"] }],
        [dana, { type: "undo" }],
        [ana, { type: "undo" }],
        // `act`'s redo leaves row-2 out again, and row-1 stays in, as Ana put it back.
        [dana, { type: "redo" }]
      ]
      const again = yield* twoOn(rows, presses, { ...right, redo: "again" })
      expect(again.last).toEqual([`press 4, row-1: the fold {"out":true}, act {}`])
      const same = yield* twoOn(rows, presses, right)
      expect(same.last).toEqual([])
      for (const run of [again, same]) {
        expect(run.answered).toBe(true)
        expect(run.translation).toEqual([])
      }
    })
)

// Where the model and today's `act` part on purpose (Benjamin, 2026-11-22: "Row 14 stays whole"). A group is taken
// back; a row someone decided after it keeps that person's whole decision, the group's effect included, and the
// screen names it. Today's `act` would instead put back what the row held before the group, and lose the later
// decision. The model is what was chosen: the review region's `act` is what changes, at the move that puts the
// review on the model. So the property compares only where one shared history has an answer, and here it has none.
it.effect(
  "row 14 stays whole: a group taken back leaves a row decided since as its decider made it, the group's effect included",
  () =>
    Effect.gen(function* () {
      const rows = [
        ReviewRow.make({
          id: "row-14",
          line: 14,
          cells: { a: "x", b: "x", c: "x" },
          problem: Problem.make({ kind: "unit", column: "a", fix: unitFix("a", "X", "g") })
        })
      ]
      const presses: ReadonlyArray<readonly [Actor, Action]> = [
        [ana, { type: "acceptGroup", groupId: "g", except: [] }],
        [dana, { type: "edit", rowId: "row-14", column: "b", value: "KG" }],
        [ana, { type: "undo" }]
      ]
      const run = yield* twoOn(rows, presses, right)
      // Ana's undo took the group out of force on the model (change 3), and the group's accept stays on row 14,
      // inside the decision Dana made over it.
      expect(A.map(run.groups, (group) => ({ change: group.change, undoneAt: group.undoneAt }))).toEqual([
        { change: 1, undoneAt: 3 }
      ])
      expect(run.folded).toEqual({ "row-14": { accepted: ["a"], edits: { b: "KG" } } })
      // One shared history has no answer: its undo would write Ana's step over Dana's later decision.
      expect(run.answered).toBe(false)
      expect(run.translation).toEqual([])
    })
)

it.effect(
  "C2: a covered row's press that changes nothing is no change, so a group's undo takes its effect back, whatever rows are sent",
  () =>
    Effect.gen(function* () {
      const rows = [
        ReviewRow.make({
          id: "row-1",
          line: 1,
          cells: { a: "x", b: "x", c: "x" },
          applied: [unitFix("c", "X")],
          problem: Problem.make({ kind: "unit", column: "a", fix: unitFix("a", "X", "g") })
        })
      ]
      const presses: ReadonlyArray<readonly [Actor, Action]> = [
        [dana, { type: "revert", rowId: "row-1", column: "c", how: "undo" }],
        [ana, { type: "acceptGroup", groupId: "g" }],
        // c is undone already: the press leaves row-1 as it is.
        [dana, { type: "revert", rowId: "row-1", column: "c", how: "undo" }],
        // `act` puts back what Ana's step held: c undone, nothing accepted.
        [ana, { type: "undo" }]
      ]
      // As C2 was first found: a step counts as naming a row only when it changed it, so Ana's undo has an answer.
      // Dana's second press leaves row-1 reading as it reads through Ana's group: the screen says so (`asItReads`),
      // the model records nothing, and Ana's undo leaves c undone and nothing accepted, as `act` does. Before that
      // answer the model recorded the press as Dana's whole decision, and the fold kept Ana's accept:
      // `{"accepted":["a"],"reverted":["c"]}` against `act`'s `{"reverted":["c"]}`.
      const written = yield* twoOn(rows, presses, { ...right, rows: "written" }, "changed")
      expect(written.last).toEqual([])
      const changed = yield* twoOn(rows, presses, right, "changed")
      expect(changed.last).toEqual([])
      for (const run of [written, changed]) {
        expect(run.answered).toBe(true)
        expect(run.translation).toEqual([])
      }
    })
)
