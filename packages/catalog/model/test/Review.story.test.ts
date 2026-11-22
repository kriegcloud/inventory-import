// The orderings that decide whether the review's model holds Benjamin's answers, as stories on the model in memory:
// who may act, an import that is not open, the confirm, the take-back, a match, an opening, and every depth of an
// undo. Acts on groups of rows are in `Group.story.test.ts`. No rule of the model holds that a valid act is taken (a
// `sometimes` rule only finds one sequence that takes it); these stories do (Benjamin, 2026-11-22: "Yes, one per
// command"). So every command has at least one story in which it is taken and every event it records is stated:
//
//   Command          Taken, its events in full, in
//   StageImport      "a viewer may not stage a file; an editor stages it, once"
//   MatchColumn      "a match made over one its sender never saw is refused, ..."
//   RecordSuggestion "a suggestion is recorded as its asker's and changes no number; a viewer's is refused"
//   ConfirmImport    "a plan built before the last act may not be confirmed after it"
//   TakeBackImport   "a take-back, a reopen and a remove each name the last change, ..."
//   ReopenImport     "a take-back, a reopen and a remove each name the last change, ..."
//   RemoveImport     "a take-back, a reopen and a remove each name the last change, ..."
//   DecideRow        "another person's act lands before the screen's own waiting act: the confirm is refused"
//   UndoRowStep      "undos go down every level exactly as it was, and end at none"
//   DecideGroup      "a group of 6,000 rows is one act and one change, ..." (Group.story.test.ts)
//   UndoGroup        "walk-back: ..." (Group.story.test.ts)
//
// The one thing not to break: a story fails on a rejection no `rejected` names and on an event no `then` names, so
// nothing a command does goes unseen. Keep every accepted step followed by a `then` for each instance it touches.
import { Story } from "@alchemy.run/domain/Story"
import { it } from "@effect/vitest"
import { ImportId, RowId } from "@inventory/catalog-contract/Ids"
import * as A from "effect/Array"
import * as Str from "effect/String"
import { type Actor, CurrentActor } from "../src/Actor/Actor.context.ts"
import { Catalog } from "../src/Catalog.model.ts"
import { Group, GroupDecided } from "../src/Group/Group.aggregate.ts"
import {
  ActCounted,
  AlreadyStaged,
  ColumnMatched,
  ConfirmedSince,
  ConfirmImport,
  CountsDoNotAddUp,
  GroupCounted,
  HasItemsInForce,
  Import,
  ImportConfirmed,
  ImportRemoved,
  ImportReopened,
  ImportStaged,
  ImportTakenBack,
  MatchColumn,
  MatchedSince,
  MoreKeptThanInForce,
  NotClosed,
  NotImported,
  NotOpen,
  NotPermitted,
  NotWhatWasShown,
  PlanBehind,
  RecordSuggestion,
  RemoveImport,
  ReopenImport,
  ReviewMovedOn,
  StageImport,
  SuggestionRecorded,
  TakeBackImport
} from "../src/Import/Import.aggregate.ts"
import { DecidedSince, DecideRow, NoLongerThere } from "../src/Review/Deciding.decision.ts"
import { DecideGroup } from "../src/Review/DecidingGroup.decision.ts"
import {
  DecidedBeforeTheConfirm,
  HistoryEnds,
  NotWhatWasUnder,
  NotYourStep,
  UndoRowStep
} from "../src/Review/Undoing.decision.ts"
import { UndoGroup } from "../src/Review/UndoingGroup.decision.ts"
import { letGo, Level, noLevel, Row, RowDecided, seal, StepUndone } from "../src/Row/Row.aggregate.ts"

const story = Story.make(Catalog)
const id = ImportId.make("0190a5c2-7b1e-7c3a-9f10-4d2e8b6a1c55")
// Another import of the same organization: a row instance kept under its id is not this import's.
const otherImport = "0190a5c2-7b1e-7c3a-9f10-4d2e8b6a1c56"
const life = Import.ref(id)
const row3 = Row.ref(`${id}/row-3`)
const row7 = Row.ref(`${id}/row-7`)
const row12 = Row.ref(`${id}/row-12`)
const g1 = Group.ref(`${id}/g1`)

const ana: Actor = { organizationId: "org_prairie", memberId: "ana", role: "editor" }
const dana: Actor = { organizationId: "org_prairie", memberId: "dana", role: "editor" }
const admin: Actor = { organizationId: "org_prairie", memberId: "ada", role: "admin" }
const anaViewer: Actor = { ...ana, role: "viewer" }
// An admin of another organization: a role is no key to an organization's imports.
const oli: Actor = { organizationId: "org_other", memberId: "oli", role: "admin" }
const staged = ImportStaged.make({ organizationId: "org_prairie", rows: 200, columns: "by heading", by: "ana" })
const leftOut = '{"out":true}'
const kept = '{"kept":true}'
const typed = '{"edits":{"name":"Hex bolt M8"}}'
const patch = '{"accept":"unit"}'

const act = (input: {
  readonly row: string
  readonly step: string
  readonly saw: number
  readonly flags: string
  readonly madeOn?: number
  readonly opening?: number
  readonly sawGroup?: number
  readonly covered?: boolean
  readonly asItReads?: boolean
}) =>
  DecideRow.make({
    importId: id,
    row: RowId.make(input.row),
    step: input.step,
    sawGroup: input.sawGroup ?? 0,
    covered: input.covered ?? false,
    asItReads: input.asItReads ?? false,
    opening: input.opening ?? 0,
    saw: input.saw,
    flags: input.flags,
    madeOn: input.madeOn ?? 0,
    label: "Decide"
  })
const undo = (input: {
  readonly row: string
  readonly undo: number
  readonly step: string
  readonly opening?: number
  readonly sawGroup?: number
  readonly next?: Level
  readonly below?: string
}) =>
  UndoRowStep.make({
    importId: id,
    row: RowId.make(input.row),
    undo: input.undo,
    step: input.step,
    sawGroup: input.sawGroup ?? 0,
    opening: input.opening ?? 0,
    next: input.next ?? noLevel,
    below: input.below ?? ""
  })
const decided = (input: {
  readonly change: number
  readonly by: string
  readonly step: string
  readonly flags: string
  readonly madeOn?: number
  readonly organizationId?: string
  readonly importId?: string
}) =>
  RowDecided.make({
    importId: input.importId ?? id,
    organizationId: input.organizationId ?? "org_prairie",
    change: input.change,
    by: input.by,
    step: input.step,
    flags: input.flags,
    madeOn: input.madeOn ?? 0,
    label: "Decide"
  })
const counted = (input: {
  readonly change: number
  readonly step: string
  readonly row: string
  readonly by: string
  readonly flags: string
  readonly madeOn?: number
}) =>
  ActCounted.make({
    change: input.change,
    step: input.step,
    row: input.row,
    label: "Decide",
    holds: input.change,
    by: input.by,
    actor: input.by,
    flags: input.flags,
    madeOn: input.madeOn ?? 0
  })
// An undo, as the import counts it: what the row holds after it, whose that is, and who acted.
const undone = (input: {
  readonly change: number
  readonly row: string
  readonly step: string
  readonly holds: number
  readonly by: string
  readonly flags: string
  readonly madeOn?: number
}) =>
  ActCounted.make({
    change: input.change,
    step: input.step,
    row: input.row,
    label: "undo",
    holds: input.holds,
    by: input.by,
    actor: "ana",
    flags: input.flags,
    madeOn: input.madeOn ?? 0
  })
const counts = { created: 155, updated: 0, already: 0, notImported: 45 }
const confirm = (input: { readonly seen: number; readonly planAt: number }) =>
  ConfirmImport.make({ importId: id, shown: "155", plan: "155", ...counts, ...input })
const confirmed = (change: number, more: Partial<typeof counts & { readonly by: string }> = {}) =>
  ImportConfirmed.make({ change, ...counts, by: "ana", ...more })
const level = (input: {
  readonly change: number
  readonly by: string
  readonly step: string
  readonly flags: string
}): Level =>
  Level.make({
    change: input.change,
    by: input.by,
    step: input.step,
    flags: input.flags,
    madeOn: 0,
    label: "Decide",
    bySize: input.by.length,
    stepSize: input.step.length,
    flagsSize: input.flags.length,
    labelSize: "Decide".length
  })
// One recorded act, as the events it leaves on the row and on the import.
const recorded = (
  ref: typeof row3,
  row: string,
  input: {
    readonly change: number
    readonly by: string
    readonly step: string
    readonly flags: string
    readonly madeOn?: number
  }
) => [Story.then(ref, decided(input)), Story.then(life, counted({ row, ...input }))] as const
const group = (input: { readonly step: string; readonly seen: number; readonly opening?: number }) =>
  DecideGroup.make({
    importId: id,
    step: input.step,
    opening: input.opening ?? 0,
    seen: input.seen,
    madeOn: 0,
    patch,
    rows: "row-3,row-12",
    count: 2,
    label: "2 fixes accepted"
  })
// Ana's group g1 over rows 3 and 12, as the group and the import hold it once it was recorded as change `change`.
const groupDecided = (change: number, organizationId = "org_prairie", importId: string = id, step = "g1") =>
  GroupDecided.make({
    importId,
    organizationId,
    change,
    by: "ana",
    step,
    patch,
    rows: "row-3,row-12",
    count: 2,
    madeOn: 0,
    label: "2 fixes accepted",
    under: 0
  })
const groupCounted = (change: number) =>
  GroupCounted.make({ change, step: "g1", rows: 2, label: "2 fixes accepted", by: "ana", top: change })

// ---- a file staged, a suggestion
it.effect("a viewer may not stage a file; an editor stages it, once", () =>
  story(
    Story.provide(CurrentActor, anaViewer),
    Story.when(StageImport.make({ importId: id, rows: 200, columns: "by heading" })),
    Story.rejected(NotPermitted.make({})),
    Story.provide(CurrentActor, ana),
    Story.when(StageImport.make({ importId: id, rows: 200, columns: "by heading" })),
    Story.then(life, staged),
    Story.provide(CurrentActor, dana),
    Story.when(StageImport.make({ importId: id, rows: 12, columns: "sku: A" })),
    Story.rejected(AlreadyStaged.make({}))
  )
)
it.effect("a suggestion is recorded as its asker's and changes no number; a viewer's is refused", () =>
  story(
    Story.given(life, staged),
    Story.provide(CurrentActor, dana),
    Story.when(RecordSuggestion.make({ importId: id })),
    Story.then(life, SuggestionRecorded.make({ by: "dana" })),
    // The next change is still number 1.
    Story.when(MatchColumn.make({ importId: id, columns: "tags: none", saw: 0, opening: 0 })),
    Story.then(life, ColumnMatched.make({ change: 1, matching: 1, columns: "tags: none", by: "dana" })),
    Story.provide(CurrentActor, anaViewer),
    Story.when(RecordSuggestion.make({ importId: id })),
    Story.rejected(NotPermitted.make({}))
  )
)
it.effect(
  "a removed import takes nothing more: no suggestion, no match, no take-back, no reopen, no second staging",
  () =>
    story(
      Story.given(life, staged),
      Story.provide(CurrentActor, ana),
      Story.when(RemoveImport.make({ importId: id, seen: 0 })),
      Story.then(life, ImportRemoved.make({ change: 1, by: "ana" })),
      Story.when(RecordSuggestion.make({ importId: id })),
      Story.rejected(NotOpen.make({})),
      Story.when(MatchColumn.make({ importId: id, columns: "tags: none", saw: 0, opening: 0 })),
      Story.rejected(NotOpen.make({})),
      Story.when(TakeBackImport.make({ importId: id, seen: 1, kept: 0, keptReplaced: 0 })),
      Story.rejected(NotImported.make({})),
      Story.when(ReopenImport.make({ importId: id, seen: 1 })),
      Story.rejected(NotClosed.make({})),
      Story.when(StageImport.make({ importId: id, rows: 200, columns: "by heading" })),
      Story.rejected(AlreadyStaged.make({}))
    )
)

// ---- who may act
it.effect("an admin of another organization changes nothing in this one's import, its rows or its groups", () =>
  story(
    Story.given(
      life,
      staged,
      counted({ change: 1, step: "a1", row: "row-12", by: "ana", flags: leftOut }),
      groupCounted(2)
    ),
    Story.given(row12, decided({ change: 1, by: "ana", step: "a1", flags: leftOut })),
    Story.given(g1, groupDecided(2)),
    Story.provide(CurrentActor, oli),
    Story.when(MatchColumn.make({ importId: id, columns: "tags: none", saw: 0, opening: 0 })),
    Story.rejected(NotPermitted.make({})),
    Story.when(RecordSuggestion.make({ importId: id })),
    Story.rejected(NotPermitted.make({})),
    Story.when(confirm({ seen: 2, planAt: 2 })),
    Story.rejected(NotPermitted.make({})),
    Story.when(RemoveImport.make({ importId: id, seen: 2 })),
    Story.rejected(NotPermitted.make({})),
    Story.when(act({ row: "row-12", step: "o1", saw: 1, sawGroup: 2, covered: true, flags: kept })),
    Story.rejected(NotPermitted.make({})),
    Story.when(undo({ row: "row-12", undo: 1, step: "o2", sawGroup: 2 })),
    Story.rejected(NotPermitted.make({})),
    Story.when(group({ step: "g2", seen: 2 })),
    Story.rejected(NotPermitted.make({})),
    Story.when(UndoGroup.make({ importId: id, step: "g1", undo: 2, opening: 0 })),
    Story.rejected(NotPermitted.make({}))
  )
)
it.effect("an admin of another organization neither takes back nor reopens this one's confirmed import", () =>
  story(
    Story.given(life, staged, confirmed(1)),
    Story.provide(CurrentActor, oli),
    Story.when(TakeBackImport.make({ importId: id, seen: 1, kept: 0, keptReplaced: 0 })),
    Story.rejected(NotPermitted.make({})),
    Story.when(ReopenImport.make({ importId: id, seen: 1 })),
    Story.rejected(NotPermitted.make({}))
  )
)
it.effect("a viewer changes nothing: no match, suggestion, confirm, remove, row act, undo, group or group undo", () =>
  story(
    Story.given(
      life,
      staged,
      counted({ change: 1, step: "a1", row: "row-12", by: "ana", flags: leftOut }),
      groupCounted(2)
    ),
    Story.given(row12, decided({ change: 1, by: "ana", step: "a1", flags: leftOut })),
    Story.given(g1, groupDecided(2)),
    Story.provide(CurrentActor, anaViewer),
    Story.when(MatchColumn.make({ importId: id, columns: "tags: none", saw: 0, opening: 0 })),
    Story.rejected(NotPermitted.make({})),
    Story.when(RecordSuggestion.make({ importId: id })),
    Story.rejected(NotPermitted.make({})),
    Story.when(confirm({ seen: 2, planAt: 2 })),
    Story.rejected(NotPermitted.make({})),
    Story.when(RemoveImport.make({ importId: id, seen: 2 })),
    Story.rejected(NotPermitted.make({})),
    Story.when(act({ row: "row-12", step: "v1", saw: 1, sawGroup: 2, covered: true, flags: kept })),
    Story.rejected(NotPermitted.make({})),
    Story.when(undo({ row: "row-12", undo: 1, step: "v2", sawGroup: 2 })),
    Story.rejected(NotPermitted.make({})),
    Story.when(group({ step: "g2", seen: 2 })),
    Story.rejected(NotPermitted.make({})),
    Story.when(UndoGroup.make({ importId: id, step: "g1", undo: 2, opening: 0 })),
    Story.rejected(NotPermitted.make({}))
  )
)
it.effect("a viewer neither takes back nor reopens a confirmed import", () =>
  story(
    Story.given(life, staged, confirmed(1)),
    Story.provide(CurrentActor, anaViewer),
    Story.when(TakeBackImport.make({ importId: id, seen: 1, kept: 0, keptReplaced: 0 })),
    Story.rejected(NotPermitted.make({})),
    Story.when(ReopenImport.make({ importId: id, seen: 1 })),
    Story.rejected(NotPermitted.make({}))
  )
)
it.effect("when a person is made a viewer, their next act on a row is refused, and an admin's confirm is taken", () =>
  story(
    Story.given(life, staged, counted({ change: 1, step: "a1", row: "row-3", by: "ana", flags: leftOut })),
    Story.given(row3, decided({ change: 1, by: "ana", step: "a1", flags: leftOut })),
    Story.provide(CurrentActor, anaViewer),
    Story.when(act({ row: "row-12", step: "a2", saw: 0, flags: leftOut })),
    Story.rejected(NotPermitted.make({})),
    Story.provide(CurrentActor, admin),
    Story.when(confirm({ seen: 1, planAt: 1 })),
    Story.then(life, confirmed(2, { by: "ada" }))
  )
)
it.effect("a row or a group kept under another organization's or import's name is not changed, even by its maker", () =>
  story(
    Story.given(
      life,
      staged,
      counted({ change: 1, step: "a1", row: "row-12", by: "ana", flags: leftOut }),
      groupCounted(2)
    ),
    Story.given(row12, decided({ change: 1, by: "ana", step: "a1", flags: leftOut, organizationId: "org_other" })),
    Story.given(row3, decided({ change: 1, by: "ana", step: "a1", flags: leftOut, importId: otherImport })),
    Story.given(g1, groupDecided(2, "org_other")),
    Story.given(Group.ref(`${id}/g2`), groupDecided(2, "org_prairie", otherImport, "g2")),
    Story.provide(CurrentActor, ana),
    Story.when(act({ row: "row-12", step: "a2", saw: 1, sawGroup: 2, covered: true, flags: kept })),
    Story.rejected(NotPermitted.make({})),
    Story.when(undo({ row: "row-12", undo: 1, step: "a3", sawGroup: 2 })),
    Story.rejected(NotPermitted.make({})),
    Story.when(act({ row: "row-3", step: "a4", saw: 1, sawGroup: 2, covered: true, flags: kept })),
    Story.rejected(NotPermitted.make({})),
    Story.when(undo({ row: "row-3", undo: 1, step: "a5", sawGroup: 2 })),
    Story.rejected(NotPermitted.make({})),
    Story.when(UndoGroup.make({ importId: id, step: "g1", undo: 2, opening: 0 })),
    Story.rejected(NotPermitted.make({})),
    Story.when(UndoGroup.make({ importId: id, step: "g2", undo: 2, opening: 0 })),
    Story.rejected(NotPermitted.make({}))
  )
)

// ---- an import that is not open
it.effect(
  "on a confirmed import nothing is reviewed, matched, suggested, confirmed again or removed until it is reopened",
  () =>
    story(
      Story.given(
        life,
        staged,
        counted({ change: 1, step: "a1", row: "row-12", by: "ana", flags: leftOut }),
        groupCounted(2),
        confirmed(3)
      ),
      Story.given(row12, decided({ change: 1, by: "ana", step: "a1", flags: leftOut })),
      Story.given(g1, groupDecided(2)),
      Story.provide(CurrentActor, ana),
      Story.when(MatchColumn.make({ importId: id, columns: "tags: none", saw: 0, opening: 1 })),
      Story.rejected(NotOpen.make({})),
      Story.when(RecordSuggestion.make({ importId: id })),
      Story.rejected(NotOpen.make({})),
      Story.when(confirm({ seen: 3, planAt: 3 })),
      Story.rejected(NotOpen.make({})),
      Story.when(RemoveImport.make({ importId: id, seen: 3 })),
      Story.rejected(NotOpen.make({})),
      Story.when(act({ row: "row-12", step: "a2", saw: 1, sawGroup: 2, covered: true, flags: kept, opening: 1 })),
      Story.rejected(NotOpen.make({})),
      Story.when(undo({ row: "row-12", undo: 1, step: "a3", sawGroup: 2, opening: 1 })),
      Story.rejected(NotOpen.make({})),
      Story.when(group({ step: "g2", seen: 3, opening: 1 })),
      Story.rejected(NotOpen.make({})),
      Story.when(UndoGroup.make({ importId: id, step: "g1", undo: 2, opening: 1 })),
      Story.rejected(NotOpen.make({})),
      Story.when(ReopenImport.make({ importId: id, seen: 3 })),
      Story.then(life, ImportReopened.make({ change: 4, by: "ana" }))
    )
)
it.effect("an import never confirmed is not taken back, and an open one is not opened again", () =>
  story(
    Story.given(life, staged),
    Story.provide(CurrentActor, ana),
    Story.when(TakeBackImport.make({ importId: id, seen: 0, kept: 0, keptReplaced: 0 })),
    Story.rejected(NotImported.make({})),
    Story.when(ReopenImport.make({ importId: id, seen: 0 })),
    Story.rejected(NotClosed.make({}))
  )
)
it.effect("an import whose confirm stands is not removed, even when it created nothing, until it is taken back", () =>
  story(
    Story.given(
      life,
      staged,
      confirmed(1, { created: 0, already: 155 }),
      ImportReopened.make({ change: 2, by: "ana" })
    ),
    Story.provide(CurrentActor, ana),
    Story.when(RemoveImport.make({ importId: id, seen: 2 })),
    Story.rejected(HasItemsInForce.make({})),
    Story.when(TakeBackImport.make({ importId: id, seen: 2, kept: 0, keptReplaced: 0 })),
    Story.then(life, ImportTakenBack.make({ change: 3, removed: 0, kept: 0, restored: 0, keptReplaced: 0, by: "ana" })),
    Story.when(RemoveImport.make({ importId: id, seen: 3 })),
    Story.then(life, ImportRemoved.make({ change: 4, by: "ana" }))
  )
)
it.effect("an import with items in force is not removed: a take-back that keeps some leaves them in force", () =>
  story(
    Story.given(life, staged, confirmed(1), ImportReopened.make({ change: 2, by: "ana" })),
    Story.provide(CurrentActor, ana),
    Story.when(RemoveImport.make({ importId: id, seen: 2 })),
    Story.rejected(HasItemsInForce.make({})),
    Story.when(TakeBackImport.make({ importId: id, seen: 2, kept: 3, keptReplaced: 0 })),
    Story.then(
      life,
      ImportTakenBack.make({ change: 3, removed: 152, kept: 3, restored: 0, keptReplaced: 0, by: "ana" })
    ),
    Story.when(RemoveImport.make({ importId: id, seen: 3 })),
    Story.rejected(HasItemsInForce.make({}))
  )
)

// ---- the confirm
it.effect("a plan built before the last act may not be confirmed after it", () =>
  story(
    Story.given(
      life,
      staged,
      counted({ change: 1, step: "a1", row: "row-3", by: "ana", flags: leftOut }),
      counted({ change: 2, step: "a2", row: "row-12", by: "ana", flags: leftOut })
    ),
    Story.provide(CurrentActor, ana),
    Story.when(confirm({ seen: 2, planAt: 1 })),
    Story.rejected(PlanBehind.make({ last: 2 })),
    Story.when(confirm({ seen: 2, planAt: 2 })),
    Story.then(life, confirmed(3))
  )
)
it.effect("a plan that would do something else than the button said is refused: the stored items changed", () =>
  story(
    Story.given(life, staged),
    Story.provide(CurrentActor, ana),
    Story.when(
      ConfirmImport.make({
        importId: id,
        seen: 0,
        planAt: 0,
        shown: "155 new",
        plan: "155 there",
        created: 0,
        updated: 0,
        already: 155,
        notImported: 45
      })
    ),
    Story.rejected(NotWhatWasShown.make({}))
  )
)
it.effect("another person's act lands before the screen's own waiting act: the confirm is refused", () =>
  story(
    Story.given(life, staged),
    Story.provide(CurrentActor, dana),
    Story.when(act({ row: "row-7", step: "d1", saw: 0, flags: kept })),
    ...recorded(row7, "row-7", { change: 1, by: "dana", step: "d1", flags: kept }),
    // Ana's screen has not received change 1. Her own act is change 2: she has 2 and not 1, so every change up to 0.
    Story.provide(CurrentActor, ana),
    Story.when(act({ row: "row-3", step: "a1", saw: 0, flags: leftOut })),
    ...recorded(row3, "row-3", { change: 2, by: "ana", step: "a1", flags: leftOut }),
    Story.when(confirm({ seen: 0, planAt: 2 })),
    Story.rejected(ReviewMovedOn.make({ last: 2 })),
    Story.when(confirm({ seen: 2, planAt: 2 })),
    Story.then(life, confirmed(3))
  )
)
it.effect(
  "counts that do not add up to the file's rows are refused, and so is more in force than the file has rows",
  () =>
    story(
      Story.given(life, staged, confirmed(1), ImportReopened.make({ change: 2, by: "ana" })),
      Story.provide(CurrentActor, ana),
      Story.when(
        ConfirmImport.make({
          importId: id,
          seen: 2,
          planAt: 2,
          shown: "x",
          plan: "x",
          created: 0,
          updated: 0,
          already: 10,
          notImported: 0
        })
      ),
      Story.rejected(CountsDoNotAddUp.make({})),
      // An item of the first confirm was changed: its row is no longer already there.
      Story.when(
        ConfirmImport.make({
          importId: id,
          seen: 2,
          planAt: 2,
          shown: "x",
          plan: "x",
          created: 0,
          updated: 0,
          already: 154,
          notImported: 46
        })
      ),
      Story.then(
        life,
        ImportConfirmed.make({ change: 3, created: 0, updated: 0, already: 154, notImported: 46, by: "ana" })
      ),
      Story.when(ReopenImport.make({ importId: id, seen: 3 })),
      Story.then(life, ImportReopened.make({ change: 4, by: "ana" })),
      // More than the file has rows is never in force.
      Story.when(
        ConfirmImport.make({
          importId: id,
          seen: 4,
          planAt: 4,
          shown: "x",
          plan: "x",
          created: 46,
          updated: 0,
          already: 154,
          notImported: 0
        })
      ),
      Story.rejected(CountsDoNotAddUp.make({}))
    )
)

// ---- take-back, reopen, remove
it.effect("a take-back, a reopen and a remove each name the last change, so a press on an old screen is refused", () =>
  story(
    Story.given(
      life,
      staged,
      confirmed(1),
      ImportTakenBack.make({ change: 2, removed: 155, kept: 0, restored: 0, keptReplaced: 0, by: "ana" }),
      ImportReopened.make({ change: 3, by: "ana" }),
      confirmed(4)
    ),
    Story.provide(CurrentActor, ana),
    Story.when(TakeBackImport.make({ importId: id, seen: 1, kept: 0, keptReplaced: 0 })),
    Story.rejected(ReviewMovedOn.make({ last: 4 })),
    Story.when(ReopenImport.make({ importId: id, seen: 2 })),
    Story.rejected(ReviewMovedOn.make({ last: 4 })),
    Story.when(TakeBackImport.make({ importId: id, seen: 4, kept: 0, keptReplaced: 0 })),
    Story.then(
      life,
      ImportTakenBack.make({ change: 5, removed: 155, kept: 0, restored: 0, keptReplaced: 0, by: "ana" })
    ),
    Story.when(ReopenImport.make({ importId: id, seen: 5 })),
    Story.then(life, ImportReopened.make({ change: 6, by: "ana" })),
    Story.when(RemoveImport.make({ importId: id, seen: 5 })),
    Story.rejected(ReviewMovedOn.make({ last: 6 })),
    Story.when(RemoveImport.make({ importId: id, seen: 6 })),
    Story.then(life, ImportRemoved.make({ change: 7, by: "ana" }))
  )
)
it.effect("a take-back takes back everything in force: the second round's items and the first's", () =>
  story(
    Story.given(life, staged, confirmed(1), ImportReopened.make({ change: 2, by: "ana" })),
    Story.provide(CurrentActor, ana),
    Story.when(
      ConfirmImport.make({
        importId: id,
        seen: 2,
        planAt: 2,
        shown: "10",
        plan: "10",
        created: 10,
        updated: 0,
        already: 155,
        notImported: 35
      })
    ),
    Story.then(
      life,
      ImportConfirmed.make({ change: 3, created: 10, updated: 0, already: 155, notImported: 35, by: "ana" })
    ),
    Story.when(TakeBackImport.make({ importId: id, seen: 3, kept: 0, keptReplaced: 0 })),
    Story.then(
      life,
      ImportTakenBack.make({ change: 4, removed: 165, kept: 0, restored: 0, keptReplaced: 0, by: "ana" })
    ),
    Story.when(TakeBackImport.make({ importId: id, seen: 4, kept: 0, keptReplaced: 0 })),
    Story.rejected(NotImported.make({})),
    Story.when(ReopenImport.make({ importId: id, seen: 4 })),
    Story.then(life, ImportReopened.make({ change: 5, by: "ana" })),
    Story.when(RemoveImport.make({ importId: id, seen: 5 })),
    Story.then(life, ImportRemoved.make({ change: 6, by: "ana" }))
  )
)
it.effect("an import opened again is taken back without confirming it again", () =>
  story(
    Story.given(life, staged, confirmed(1), ImportReopened.make({ change: 2, by: "ana" })),
    Story.provide(CurrentActor, ana),
    Story.when(TakeBackImport.make({ importId: id, seen: 2, kept: 5, keptReplaced: 0 })),
    Story.then(
      life,
      ImportTakenBack.make({ change: 3, removed: 150, kept: 5, restored: 0, keptReplaced: 0, by: "ana" })
    )
  )
)
it.effect(
  "a take-back counts the items that were replaced too, put back and kept, and never keeps more than there is",
  () =>
    story(
      Story.given(
        life,
        staged,
        confirmed(1, { created: 100, updated: 50, notImported: 50 }),
        ImportReopened.make({ change: 2, by: "ana" })
      ),
      Story.provide(CurrentActor, ana),
      Story.when(TakeBackImport.make({ importId: id, seen: 2, kept: 101, keptReplaced: 3 })),
      Story.rejected(MoreKeptThanInForce.make({})),
      Story.when(TakeBackImport.make({ importId: id, seen: 2, kept: 2, keptReplaced: 51 })),
      Story.rejected(MoreKeptThanInForce.make({})),
      Story.when(TakeBackImport.make({ importId: id, seen: 2, kept: 2, keptReplaced: 3 })),
      Story.then(
        life,
        ImportTakenBack.make({ change: 3, removed: 98, kept: 2, restored: 47, keptReplaced: 3, by: "ana" })
      )
    )
)

// ---- a match, an opening
it.effect(
  "a match made over one its sender never saw is refused, and the columns as they are, by heading or by hand, are no match",
  () =>
    story(
      Story.given(life, staged),
      Story.provide(CurrentActor, ana),
      // By hand, what the headings gave already: nothing is taken back.
      Story.when(MatchColumn.make({ importId: id, columns: "by heading", saw: 0, opening: 0 })),
      Story.then(life),
      // None, on purpose, for a column its heading gave: that is a match.
      Story.when(MatchColumn.make({ importId: id, columns: "tags: none", saw: 0, opening: 0 })),
      Story.then(life, ColumnMatched.make({ change: 1, matching: 1, columns: "tags: none", by: "ana" })),
      Story.provide(CurrentActor, dana),
      Story.when(MatchColumn.make({ importId: id, columns: "uom: Unit", saw: 0, opening: 0 })),
      Story.rejected(MatchedSince.make({ matching: 1 }))
    )
)
it.effect("an act made on an older matching is refused, whatever it decides", () =>
  story(
    Story.given(life, staged, ColumnMatched.make({ change: 1, matching: 1, columns: "sku: B", by: "dana" })),
    Story.provide(CurrentActor, ana),
    Story.when(act({ row: "row-12", step: "a1", saw: 0, flags: '{"stored":"replace"}', madeOn: 0 })),
    Story.rejected(MatchedSince.make({ matching: 1 })),
    Story.when(act({ row: "row-12", step: "a2", saw: 0, flags: '{"stored":"replace"}', madeOn: 1 })),
    ...recorded(row12, "row-12", { change: 2, by: "ana", step: "a2", flags: '{"stored":"replace"}', madeOn: 1 })
  )
)
it.effect("an act made before a confirm is not taken after the import is opened again", () =>
  story(
    Story.given(life, staged, confirmed(1), ImportReopened.make({ change: 2, by: "ana" })),
    Story.provide(CurrentActor, ana),
    Story.when(act({ row: "row-3", step: "a1", saw: 0, flags: leftOut, opening: 0 })),
    Story.rejected(ConfirmedSince.make({})),
    Story.when(act({ row: "row-3", step: "a2", saw: 0, flags: leftOut, opening: 1 })),
    ...recorded(row3, "row-3", { change: 3, by: "ana", step: "a2", flags: leftOut })
  )
)
it.effect(
  "a match, a group and an undo made before a confirm are not taken after the import is opened again either",
  () =>
    story(
      Story.given(
        life,
        staged,
        counted({ change: 1, step: "a1", row: "row-12", by: "ana", flags: leftOut }),
        confirmed(2),
        ImportTakenBack.make({ change: 3, removed: 155, kept: 0, restored: 0, keptReplaced: 0, by: "dana" }),
        ImportReopened.make({ change: 4, by: "dana" })
      ),
      Story.given(row12, decided({ change: 1, by: "ana", step: "a1", flags: leftOut })),
      Story.provide(CurrentActor, ana),
      Story.when(undo({ row: "row-12", undo: 1, step: "u1", opening: 0 })),
      Story.rejected(ConfirmedSince.make({})),
      Story.when(MatchColumn.make({ importId: id, columns: "unitCost: List price", saw: 0, opening: 0 })),
      Story.rejected(ConfirmedSince.make({})),
      Story.when(group({ step: "g1", seen: 4, opening: 0 })),
      Story.rejected(ConfirmedSince.make({})),
      // Made in this opening, the match is taken.
      Story.when(MatchColumn.make({ importId: id, columns: "unitCost: List price", saw: 0, opening: 1 })),
      Story.then(life, ColumnMatched.make({ change: 5, matching: 1, columns: "unitCost: List price", by: "ana" }))
    )
)
it.effect("an undo does not reach past a confirm that stands", () =>
  story(
    Story.given(
      life,
      staged,
      counted({ change: 1, step: "a1", row: "row-12", by: "ana", flags: typed }),
      confirmed(2),
      ImportReopened.make({ change: 3, by: "ana" })
    ),
    Story.given(row12, decided({ change: 1, by: "ana", step: "a1", flags: typed })),
    Story.provide(CurrentActor, ana),
    Story.when(undo({ row: "row-12", undo: 1, step: "u1", opening: 1 })),
    Story.rejected(DecidedBeforeTheConfirm.make({}))
  )
)

// ---- rows and undo
it.effect("when someone else decided the row first, the act is refused with whose decision is there", () =>
  story(
    Story.given(life, staged, counted({ change: 1, step: "d1", row: "row-12", by: "dana", flags: kept })),
    Story.given(row12, decided({ change: 1, by: "dana", step: "d1", flags: kept })),
    Story.provide(CurrentActor, ana),
    Story.when(act({ row: "row-12", step: "a1", saw: 0, flags: leftOut })),
    Story.rejected(DecidedSince.make({ by: "dana", change: 1 }))
  )
)
it.effect("a decision its sender saw that was taken back since is no longer there, and the act is refused", () =>
  story(
    Story.given(life, staged, counted({ change: 1, step: "a1", row: "row-12", by: "ana", flags: leftOut })),
    Story.given(row12, decided({ change: 1, by: "ana", step: "a1", flags: leftOut })),
    Story.provide(CurrentActor, ana),
    Story.when(undo({ row: "row-12", undo: 1, step: "u1" })),
    Story.then(row12, StepUndone.make({ next: noLevel, below: "" })),
    Story.then(life, undone({ change: 2, row: "row-12", step: "u1", holds: 0, by: "", flags: "", madeOn: -1 })),
    // Dana's screen still shows Ana's decision on row 12.
    Story.provide(CurrentActor, dana),
    Story.when(act({ row: "row-12", step: "d1", saw: 1, flags: kept })),
    Story.rejected(NoLongerThere.make({})),
    Story.when(act({ row: "row-12", step: "d2", saw: 0, flags: kept })),
    ...recorded(row12, "row-12", { change: 3, by: "dana", step: "d2", flags: kept })
  )
)
it.effect("a save that leaves the row as it is records nothing, seen or not: the answer says no change", () =>
  story(
    Story.given(life, staged, counted({ change: 1, step: "a1", row: "row-12", by: "ana", flags: kept })),
    Story.given(row12, decided({ change: 1, by: "ana", step: "a1", flags: kept })),
    Story.provide(CurrentActor, ana),
    Story.when(act({ row: "row-12", step: "a2", saw: 1, flags: kept })),
    Story.then(row12),
    Story.then(life),
    // Nor does an empty decision on a row with none.
    Story.when(act({ row: "row-3", step: "a3", saw: 0, flags: "{}" })),
    Story.then(row3),
    Story.then(life),
    // Somebody else had just decided it the same way, and the screen had not received that.
    Story.provide(CurrentActor, dana),
    Story.when(act({ row: "row-12", step: "d1", saw: 0, flags: kept })),
    Story.then(row12),
    Story.then(life)
  )
)
it.effect("an undo may not bring a text of its sender's as another person's decision", () =>
  story(
    Story.given(life, staged),
    Story.given(
      row12,
      decided({ change: 1, by: "dana", step: "d1", flags: kept }),
      decided({ change: 2, by: "ana", step: "a1", flags: leftOut }),
      decided({ change: 3, by: "ana", step: "a2", flags: typed })
    ),
    Story.provide(CurrentActor, ana),
    Story.when(
      undo({ row: "row-12", undo: 3, step: "u1", next: level({ change: 1, by: "dana", step: "d1", flags: "FORGED" }) })
    ),
    Story.rejected(NotWhatWasUnder.make({})),
    // Nor with sizes that let the forged text share the true one's seal.
    Story.when(
      undo({
        row: "row-12",
        undo: 3,
        step: "u2",
        next: { ...level({ change: 1, by: "dana", step: "d1", flags: kept }), by: "dan", step: "ad1" }
      })
    ),
    Story.rejected(NotWhatWasUnder.make({}))
  )
)
it.effect("undos go down every level exactly as it was, and end at none", () =>
  story(
    Story.given(life, staged, counted({ change: 4, step: "a4", row: "row-12", by: "ana", flags: "4" })),
    Story.given(
      row12,
      decided({ change: 1, by: "ana", step: "a1", flags: "1" }),
      decided({ change: 2, by: "ana", step: "a2", flags: "2" }),
      decided({ change: 3, by: "ana", step: "a3", flags: "3" }),
      decided({ change: 4, by: "ana", step: "a4", flags: "4" })
    ),
    Story.provide(CurrentActor, ana),
    Story.when(
      undo({
        row: "row-12",
        undo: 4,
        step: "u1",
        next: level({ change: 2, by: "ana", step: "a2", flags: "2" }),
        below: seal({ level: level({ change: 1, by: "ana", step: "a1", flags: "1" }), below: "" })
      })
    ),
    Story.then(
      row12,
      StepUndone.make({
        next: level({ change: 2, by: "ana", step: "a2", flags: "2" }),
        below: seal({ level: level({ change: 1, by: "ana", step: "a1", flags: "1" }), below: "" })
      })
    ),
    Story.then(life, undone({ change: 5, row: "row-12", step: "u1", holds: 3, by: "ana", flags: "3" })),
    Story.when(
      undo({ row: "row-12", undo: 3, step: "u2", next: level({ change: 1, by: "ana", step: "a1", flags: "1" }) })
    ),
    Story.then(row12, StepUndone.make({ next: level({ change: 1, by: "ana", step: "a1", flags: "1" }), below: "" })),
    Story.then(life, undone({ change: 6, row: "row-12", step: "u2", holds: 2, by: "ana", flags: "2" })),
    Story.when(undo({ row: "row-12", undo: 2, step: "u3" })),
    Story.then(row12, StepUndone.make({ next: noLevel, below: "" })),
    Story.then(life, undone({ change: 7, row: "row-12", step: "u3", holds: 1, by: "ana", flags: "1" })),
    Story.when(undo({ row: "row-12", undo: 1, step: "u4" })),
    Story.then(row12, StepUndone.make({ next: noLevel, below: "" })),
    Story.then(life, undone({ change: 8, row: "row-12", step: "u4", holds: 0, by: "", flags: "", madeOn: -1 })),
    // A row with no decision has no step to undo.
    Story.when(undo({ row: "row-12", undo: 1, step: "u5" })),
    Story.rejected(NotYourStep.make({}))
  )
)
it.effect("an undo that puts back another person's decision stops there", () =>
  story(
    Story.given(life, staged, counted({ change: 2, step: "a1", row: "row-12", by: "ana", flags: leftOut })),
    Story.given(
      row12,
      decided({ change: 1, by: "dana", step: "d1", flags: kept }),
      decided({ change: 2, by: "ana", step: "a1", flags: leftOut })
    ),
    Story.provide(CurrentActor, ana),
    Story.when(undo({ row: "row-12", undo: 2, step: "u1" })),
    Story.then(row12, StepUndone.make({ next: noLevel, below: "" })),
    Story.then(life, undone({ change: 3, row: "row-12", step: "u1", holds: 1, by: "dana", flags: kept })),
    Story.when(undo({ row: "row-12", undo: 1, step: "u2" })),
    Story.rejected(NotYourStep.make({}))
  )
)
it.effect(
  "a full history never refuses a decision: the oldest levels are let go, and an undo stops there and says so",
  () =>
    story(
      Story.given(life, staged, counted({ change: 5, step: "a5", row: "row-12", by: "ana", flags: "5" })),
      Story.given(
        row12,
        ...A.map([1, 2, 3, 4], (n) =>
          decided({ change: n, by: "ana", step: `a${n}`, flags: Str.repeat(400_000 + n)("x") })
        ),
        decided({ change: 5, by: "ana", step: "a5", flags: "5" })
      ),
      Story.provide(CurrentActor, ana),
      // What is kept below is past the most a row keeps: the act is taken all the same, and the rest is let go.
      Story.when(act({ row: "row-12", step: "a6", saw: 5, flags: "6" })),
      ...recorded(row12, "row-12", { change: 6, by: "ana", step: "a6", flags: "6" }),
      Story.when(undo({ row: "row-12", undo: 6, step: "u1" })),
      Story.then(row12, StepUndone.make({ next: letGo, below: "" })),
      Story.then(life, undone({ change: 7, row: "row-12", step: "u1", holds: 5, by: "ana", flags: "5" })),
      Story.when(undo({ row: "row-12", undo: 5, step: "u2" })),
      Story.rejected(HistoryEnds.make({}))
    )
)
it.effect("a row whose older decisions were let go still takes a decision", () =>
  story(
    Story.given(life, staged, counted({ change: 6, step: "a6", row: "row-12", by: "ana", flags: "6" })),
    Story.given(
      row12,
      ...A.map([1, 2, 3, 4], (n) =>
        decided({ change: n, by: "ana", step: `a${n}`, flags: Str.repeat(400_000 + n)("x") })
      ),
      decided({ change: 5, by: "ana", step: "a5", flags: "5" }),
      decided({ change: 6, by: "ana", step: "a6", flags: "6" })
    ),
    Story.provide(CurrentActor, ana),
    Story.when(act({ row: "row-12", step: "a7", saw: 6, flags: "7" })),
    ...recorded(row12, "row-12", { change: 7, by: "ana", step: "a7", flags: "7" })
  )
)
