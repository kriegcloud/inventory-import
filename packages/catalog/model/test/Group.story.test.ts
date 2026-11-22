// Acts on groups of rows, as stories on the model in memory: a group is one act and one change whatever its number of
// rows (Benjamin, 2026-11-22: "One unit per group"), what it refuses, what a row's act and a confirm have to have seen
// of it, and how groups are taken back, last first. `DecideGroup` and `UndoGroup` are taken here with every event they
// record stated, as the table in `Review.story.test.ts` lists. The one thing not to break: a story fails on a rejection
// no `rejected` names and on an event no `then` names, so a refused act is shown to record nothing.
import { Story } from "@alchemy.run/domain/Story"
import { it } from "@effect/vitest"
import { ImportId, RowId } from "@inventory/catalog-contract/Ids"
import * as A from "effect/Array"
import { type Actor, CurrentActor } from "../src/Actor/Actor.context.ts"
import { Catalog } from "../src/Catalog.model.ts"
import { Group, GroupDecided, GroupUndone } from "../src/Group/Group.aggregate.ts"
import {
  ActCounted,
  ColumnMatched,
  ConfirmedSince,
  ConfirmImport,
  GroupCounted,
  Import,
  ImportConfirmed,
  ImportReopened,
  ImportStaged,
  MatchColumn,
  MatchedSince,
  ReopenImport,
  ReviewMovedOn
} from "../src/Import/Import.aggregate.ts"
import {
  DecidedSince,
  DecideRow,
  GroupedAfter,
  GroupedSince,
  NoLongerThere,
  PutBackSince,
  UndoneSince
} from "../src/Review/Deciding.decision.ts"
import { DecideGroup, StepTaken } from "../src/Review/DecidingGroup.decision.ts"
import { DecidedBeforeTheConfirm, NotYourStep, UndoRowStep } from "../src/Review/Undoing.decision.ts"
import { UndoGroup } from "../src/Review/UndoingGroup.decision.ts"
import { noLevel, Row, RowDecided, StepUndone } from "../src/Row/Row.aggregate.ts"

const story = Story.make(Catalog)
const id = ImportId.make("0190a5c2-7b1e-7c3a-9f10-4d2e8b6a1c55")
const life = Import.ref(id)
const g1 = Group.ref(`${id}/g1`)
const g2 = Group.ref(`${id}/g2`)
const g3 = Group.ref(`${id}/g3`)
const row3 = Row.ref(`${id}/row-3`)
const row12 = Row.ref(`${id}/row-12`)
const row14 = Row.ref(`${id}/row-14`)

const ana: Actor = { organizationId: "org_prairie", memberId: "ana", role: "editor" }
const dana: Actor = { organizationId: "org_prairie", memberId: "dana", role: "editor" }
const carl: Actor = { organizationId: "org_prairie", memberId: "carl", role: "editor" }
const staged = ImportStaged.make({ organizationId: "org_prairie", rows: 50_000, columns: "by heading", by: "ana" })
// 6,000 rows named in one text, as the screen encodes them.
const rows = A.join(
  A.makeBy(6_000, (n) => `row-${n + 1}`),
  ","
)
const label = "6,000 fixes accepted"
// Dana's group: other rows, another count.
const danasRows = "row-1,row-2"
const danasLabel = "900 fixes accepted"
const patch = '{"accept":"unit"}'
const accepted = '{"accepted":["unit"]}'
const leftOut = '{"out":true}'
const kept = '{"kept":true}'
const typed = '{"edits":{"name":"Hex bolt M8"}}'
const typedEight = '{"edits":{"quantityOnHand":"8"}}'

const group = (input: {
  readonly seen: number
  readonly step?: string
  readonly opening?: number
  readonly madeOn?: number
  readonly rows?: string
  readonly count?: number
  readonly label?: string
  readonly patch?: string
}) =>
  DecideGroup.make({
    importId: id,
    step: input.step ?? "g1",
    opening: input.opening ?? 0,
    seen: input.seen,
    madeOn: input.madeOn ?? 0,
    patch: input.patch ?? patch,
    rows: input.rows ?? rows,
    count: input.count ?? 6_000,
    label: input.label ?? label
  })
const groupDecided = (input: {
  readonly change: number
  readonly step?: string
  readonly by?: string
  readonly rows?: string
  readonly count?: number
  readonly label?: string
  readonly madeOn?: number
  readonly under?: number
  readonly patch?: string
}) =>
  GroupDecided.make({
    importId: id,
    organizationId: "org_prairie",
    change: input.change,
    by: input.by ?? "ana",
    step: input.step ?? "g1",
    patch: input.patch ?? patch,
    rows: input.rows ?? rows,
    count: input.count ?? 6_000,
    madeOn: input.madeOn ?? 0,
    label: input.label ?? label,
    under: input.under ?? 0
  })
// The import's count of a group act or its undo; `top` is the last group in force after it, itself by default.
const groupCounted = (input: {
  readonly change: number
  readonly step?: string
  readonly rows?: number
  readonly label?: string
  readonly by?: string
  readonly top?: number
}) =>
  GroupCounted.make({
    change: input.change,
    step: input.step ?? "g1",
    rows: input.rows ?? 6_000,
    label: input.label ?? label,
    by: input.by ?? "ana",
    top: input.top ?? input.change
  })
const undoGroup = (input: { readonly undo: number; readonly step?: string; readonly opening?: number }) =>
  UndoGroup.make({ importId: id, step: input.step ?? "g1", undo: input.undo, opening: input.opening ?? 0 })
const act = (input: {
  readonly step: string
  readonly saw: number
  readonly sawGroup: number
  readonly covered: boolean
  readonly asItReads?: boolean
  readonly flags: string
  readonly row?: string
  readonly madeOn?: number
  readonly sawUndone?: number
}) =>
  DecideRow.make({
    importId: id,
    row: RowId.make(input.row ?? "row-12"),
    step: input.step,
    sawGroup: input.sawGroup,
    covered: input.covered,
    asItReads: input.asItReads ?? false,
    opening: 0,
    saw: input.saw,
    sawUndone: input.sawUndone ?? 0,
    flags: input.flags,
    madeOn: input.madeOn ?? 0,
    label: "Decide"
  })
const undo = (input: {
  readonly undo: number
  readonly step: string
  readonly sawGroup: number
  readonly row?: string
  readonly covered?: boolean
  readonly madeOn?: number
  readonly sawUndone?: number
}) =>
  UndoRowStep.make({
    importId: id,
    row: RowId.make(input.row ?? "row-12"),
    undo: input.undo,
    step: input.step,
    sawGroup: input.sawGroup,
    covered: input.covered ?? false,
    madeOn: input.madeOn ?? 0,
    sawUndone: input.sawUndone ?? 0,
    opening: 0,
    next: noLevel,
    below: ""
  })
const decided = (input: {
  readonly change: number
  readonly by: string
  readonly step: string
  readonly flags: string
}) =>
  RowDecided.make({
    importId: id,
    organizationId: "org_prairie",
    change: input.change,
    by: input.by,
    step: input.step,
    flags: input.flags,
    madeOn: 0,
    label: "Decide"
  })
const counted = (input: {
  readonly change: number
  readonly step: string
  readonly by: string
  readonly flags: string
  readonly row?: string
}) =>
  ActCounted.make({
    change: input.change,
    step: input.step,
    row: input.row ?? "row-12",
    label: "Decide",
    holds: input.change,
    by: input.by,
    actor: input.by,
    flags: input.flags,
    madeOn: 0
  })
// A row's undo that leaves the row with nothing, as the import counts it.
const undoneToNothing = (input: {
  readonly change: number
  readonly step: string
  readonly actor: string
  readonly row?: string
}) =>
  ActCounted.make({
    change: input.change,
    step: input.step,
    row: input.row ?? "row-12",
    label: "undo",
    holds: 0,
    by: "",
    actor: input.actor,
    flags: "",
    madeOn: -1
  })
const counts = { created: 155, updated: 0, already: 0, notImported: 49_845 }
const confirm = (seen: number) =>
  ConfirmImport.make({ importId: id, shown: "155", plan: "155", seen, planAt: seen, ...counts })

it.effect("a group of 6,000 rows is one act and one change, and a confirm has to have received it", () =>
  story(
    Story.given(life, staged),
    Story.provide(CurrentActor, ana),
    Story.when(group({ seen: 0 })),
    Story.then(g1, groupDecided({ change: 1 })),
    Story.then(life, groupCounted({ change: 1 })),
    Story.provide(CurrentActor, dana),
    Story.when(confirm(0)),
    Story.rejected(ReviewMovedOn.make({ last: 1 })),
    Story.when(confirm(1)),
    Story.then(life, ImportConfirmed.make({ change: 2, ...counts, by: "dana" }))
  )
)
it.effect(
  "a group is taken only from a screen that has every change, a step decides one group, and only its maker takes it back, once",
  () =>
    story(
      Story.given(life, staged, counted({ change: 1, step: "d1", by: "dana", flags: leftOut })),
      Story.given(row12, decided({ change: 1, by: "dana", step: "d1", flags: leftOut })),
      Story.provide(CurrentActor, ana),
      // Ana's screen drew the group before Dana left row 12 out.
      Story.when(group({ seen: 0 })),
      Story.rejected(ReviewMovedOn.make({ last: 1 })),
      Story.when(group({ seen: 1 })),
      Story.then(g1, groupDecided({ change: 2 })),
      Story.then(life, groupCounted({ change: 2 })),
      Story.when(group({ seen: 2 })),
      Story.rejected(StepTaken.make({})),
      Story.provide(CurrentActor, dana),
      Story.when(undoGroup({ undo: 2 })),
      Story.rejected(NotYourStep.make({})),
      Story.provide(CurrentActor, ana),
      Story.when(undoGroup({ undo: 2 })),
      Story.then(g1, GroupUndone.make({ change: 3 })),
      Story.then(life, groupCounted({ change: 3, label: "undo", top: 0 })),
      Story.when(undoGroup({ undo: 2 })),
      Story.rejected(NotYourStep.make({}))
    )
)
it.effect(
  "refuse and show: a row's undo or act sent before the last group act reached its screen is refused and records nothing, and is taken sent again with it",
  () =>
    story(
      Story.given(life, staged, counted({ change: 1, step: "d1", by: "dana", flags: kept })),
      Story.given(row12, decided({ change: 1, by: "dana", step: "d1", flags: kept })),
      Story.provide(CurrentActor, ana),
      Story.when(group({ seen: 1 })),
      Story.then(g1, groupDecided({ change: 2 })),
      Story.then(life, groupCounted({ change: 2 })),
      // Dana presses undo on her own decision; Ana's group has not reached her screen.
      Story.provide(CurrentActor, dana),
      Story.when(undo({ undo: 1, step: "u1", sawGroup: 0 })),
      Story.rejected(GroupedSince.make({})),
      Story.then(row12),
      Story.then(life),
      Story.then(g1),
      // Her screen has drawn the group now, and she presses again.
      Story.when(undo({ undo: 1, step: "u2", sawGroup: 2 })),
      Story.then(row12, StepUndone.make({ next: noLevel, below: "", undo: 1, step: "u2", by: "dana" })),
      Story.then(life, undoneToNothing({ change: 3, step: "u2", actor: "dana" })),
      // The same for an act: typed before the group reached her screen, then again after.
      Story.when(act({ step: "d2", saw: 0, sawGroup: 0, covered: true, flags: typed })),
      Story.rejected(GroupedSince.make({})),
      Story.then(row12),
      Story.then(life),
      Story.when(act({ step: "d3", saw: 0, sawUndone: 1, sawGroup: 2, covered: true, flags: typed })),
      Story.then(row12, decided({ change: 4, by: "dana", step: "d3", flags: typed })),
      Story.then(life, counted({ change: 4, step: "d3", by: "dana", flags: typed }))
    )
)
it.effect(
  "the same text over a group in force is a change: covered, it records a decision; not covered, it records nothing",
  () =>
    story(
      Story.given(life, staged, counted({ change: 1, step: "d1", by: "dana", flags: kept })),
      Story.given(row12, decided({ change: 1, by: "dana", step: "d1", flags: kept })),
      Story.provide(CurrentActor, ana),
      Story.when(group({ seen: 1 })),
      Story.then(g1, groupDecided({ change: 2 })),
      Story.then(life, groupCounted({ change: 2 })),
      // Row 12's own instance holds Dana's kept; the group in force covers it since. Saying kept again without the
      // group is no change.
      Story.provide(CurrentActor, dana),
      Story.when(act({ step: "d2", saw: 1, sawGroup: 2, covered: false, flags: kept })),
      Story.then(row12),
      Story.then(life),
      // Over the group, the same text is a decision: the row goes back to kept.
      Story.when(act({ step: "d3", saw: 1, sawGroup: 2, covered: true, flags: kept })),
      Story.then(row12, decided({ change: 3, by: "dana", step: "d3", flags: kept })),
      Story.then(life, counted({ change: 3, step: "d3", by: "dana", flags: kept })),
      // The same on row 3, which holds nothing of its own: nothing decided, over a group, is a decision.
      Story.when(act({ row: "row-3", step: "d4", saw: 0, sawGroup: 2, covered: false, flags: "{}" })),
      Story.then(row3),
      Story.then(life),
      Story.when(act({ row: "row-3", step: "d5", saw: 0, sawGroup: 2, covered: true, flags: "{}" })),
      Story.then(row3, decided({ change: 4, by: "dana", step: "d5", flags: "{}" })),
      Story.then(life, counted({ change: 4, step: "d5", by: "dana", flags: "{}", row: "row-3" }))
    )
)
it.effect(
  "a group's undo touches no row: a row another person decided since keeps its decision, and a row's act made before the undo reached its screen is refused",
  () =>
    story(
      Story.given(
        life,
        staged,
        groupCounted({ change: 1 }),
        counted({ change: 2, step: "d1", by: "dana", flags: accepted })
      ),
      Story.given(g1, groupDecided({ change: 1 })),
      Story.given(row12, decided({ change: 2, by: "dana", step: "d1", flags: accepted })),
      Story.provide(CurrentActor, ana),
      Story.when(undoGroup({ undo: 1 })),
      Story.then(g1, GroupUndone.make({ change: 3 })),
      Story.then(life, groupCounted({ change: 3, label: "undo", top: 0 })),
      Story.then(row12),
      Story.state(row12, { status: "Decided", change: 2, by: "dana" }),
      Story.provide(CurrentActor, dana),
      Story.when(act({ step: "d2", saw: 2, sawGroup: 1, covered: false, flags: leftOut })),
      Story.rejected(GroupedSince.make({}))
    )
)
it.effect(
  "a group taken back gives no row anything again: Ana's group of twelve rows, Dana types on row 14, both are taken back, and row 14 holds nothing",
  () =>
    story(
      Story.given(life, staged),
      Story.provide(CurrentActor, ana),
      Story.when(
        group({
          seen: 0,
          rows: A.join(
            A.makeBy(12, (n) => `row-${n + 3}`),
            ","
          ),
          count: 12,
          label: "12 fixes accepted"
        })
      ),
      Story.then(
        g1,
        groupDecided({
          change: 1,
          rows: "row-3,row-4,row-5,row-6,row-7,row-8,row-9,row-10,row-11,row-12,row-13,row-14",
          count: 12,
          label: "12 fixes accepted"
        })
      ),
      Story.then(life, groupCounted({ change: 1, rows: 12, label: "12 fixes accepted" })),
      // Dana's screen has the group; she types a name on row 14, which the group covers.
      Story.provide(CurrentActor, dana),
      Story.when(act({ row: "row-14", step: "d1", saw: 0, sawGroup: 1, covered: true, flags: typed })),
      Story.then(row14, decided({ change: 2, by: "dana", step: "d1", flags: typed })),
      Story.then(life, counted({ change: 2, step: "d1", by: "dana", flags: typed, row: "row-14" })),
      // Ana takes her group back: one act, and row 14's own instance is not touched.
      Story.provide(CurrentActor, ana),
      Story.when(undoGroup({ undo: 1 })),
      Story.then(g1, GroupUndone.make({ change: 3 })),
      Story.then(life, groupCounted({ change: 3, rows: 12, label: "undo", top: 0 })),
      Story.then(row14),
      // Dana takes hers back, from a screen that has Ana's undo.
      Story.provide(CurrentActor, dana),
      Story.when(undo({ row: "row-14", undo: 2, step: "u1", sawGroup: 3 })),
      Story.then(row14, StepUndone.make({ next: noLevel, below: "", undo: 2, step: "u1", by: "dana" })),
      Story.then(life, undoneToNothing({ change: 4, step: "u1", actor: "dana", row: "row-14" })),
      // The model keeps no reading of a row through its groups: what holds here is the row's own instance, with
      // nothing in it, and the group's `undoneAt`, which says it was taken back by change 3. Nothing brings the group's
      // patch back onto row 14.
      Story.state(row14, { status: "Undecided" }),
      Story.state(g1, { status: "Decided", undoneAt: 3 })
    )
)
it.effect(
  "a press that leaves a row reading as it reads is no change: Ana's group of twelve rows, Dana's press on row 14 changes nothing, Ana takes the group back, and row 14 holds nothing",
  () =>
    story(
      Story.given(life, staged),
      Story.provide(CurrentActor, ana),
      Story.when(
        group({
          seen: 0,
          rows: A.join(
            A.makeBy(12, (n) => `row-${n + 3}`),
            ","
          ),
          count: 12,
          label: "12 fixes accepted"
        })
      ),
      Story.then(
        g1,
        groupDecided({
          change: 1,
          rows: "row-3,row-4,row-5,row-6,row-7,row-8,row-9,row-10,row-11,row-12,row-13,row-14",
          count: 12,
          label: "12 fixes accepted"
        })
      ),
      Story.then(life, groupCounted({ change: 1, rows: 12, label: "12 fixes accepted" })),
      // Dana's screen has the group: row 14 reads as the group's accepted unit. She accepts the unit on it, which leaves
      // it reading as it reads (Benjamin, 2026-11-22: "No change, Ana's undo applies"). Nothing is recorded, on the row
      // or on the import.
      Story.provide(CurrentActor, dana),
      Story.when(
        act({ row: "row-14", step: "d1", saw: 0, sawGroup: 1, covered: true, asItReads: true, flags: accepted })
      ),
      Story.then(row14),
      Story.then(life),
      // Ana takes her group back, and nothing of it stays on row 14: the row has no decision of its own.
      Story.provide(CurrentActor, ana),
      Story.when(undoGroup({ undo: 1 })),
      Story.then(g1, GroupUndone.make({ change: 2 })),
      Story.then(life, groupCounted({ change: 2, rows: 12, label: "undo", top: 0 })),
      Story.state(row14, { status: "Untouched" }),
      Story.state(g1, { status: "Decided", undoneAt: 2 })
    )
)
it.effect(
  "a press from a screen that is behind is held, not lost as no change: Ana's group leaves row 14 out, Dana types 8 on it, and Carl, who has not received her 8, presses leave out there",
  () =>
    story(
      Story.given(life, staged),
      Story.provide(CurrentActor, ana),
      Story.when(group({ seen: 0, rows: "row-3,row-14", count: 2, patch: leftOut })),
      Story.then(g1, groupDecided({ change: 1, rows: "row-3,row-14", count: 2, patch: leftOut })),
      Story.then(life, groupCounted({ change: 1, rows: 2 })),
      // Dana types 8 in Quantity on row 14, which the group covers: a change, recorded as hers.
      Story.provide(CurrentActor, dana),
      Story.when(act({ row: "row-14", step: "d1", saw: 0, sawGroup: 1, covered: true, flags: typedEight })),
      Story.then(row14, decided({ change: 2, by: "dana", step: "d1", flags: typedEight })),
      Story.then(life, counted({ change: 2, step: "d1", by: "dana", flags: typedEight, row: "row-14" })),
      // Carl's screen has the group and not Dana's 8: on it, row 14 reads as left out through the group, and his
      // press leaves it so. It is not "no change": it is refused with Dana's decision, so his screen holds it and
      // shows both (2026-11-22: "Same: hold, show both"), and nothing is recorded.
      Story.provide(CurrentActor, carl),
      Story.when(
        act({ row: "row-14", step: "c1", saw: 0, sawGroup: 1, covered: true, asItReads: true, flags: leftOut })
      ),
      Story.rejected(DecidedSince.make({ by: "dana", change: 2 })),
      Story.state(row14, { status: "Decided", by: "dana", change: 2 })
    )
)
it.effect(
  "a covered press made on an older matching is held too: Ana's group leaves row 14 out, Dana matches a column, and Carl, who has not received the match, presses leave out there",
  () =>
    story(
      Story.given(life, staged),
      Story.provide(CurrentActor, ana),
      Story.when(group({ seen: 0, rows: "row-3,row-14", count: 2, patch: leftOut })),
      Story.then(g1, groupDecided({ change: 1, rows: "row-3,row-14", count: 2, patch: leftOut })),
      Story.then(life, groupCounted({ change: 1, rows: 2 })),
      Story.provide(CurrentActor, dana),
      Story.when(MatchColumn.make({ importId: id, columns: "unit: UoM", saw: 0, opening: 0 })),
      Story.then(life, ColumnMatched.make({ change: 2, matching: 1, columns: "unit: UoM", by: "dana" })),
      // Carl's screen has the group and not the match. His press leaves row 14 reading as it read to him, on the
      // matching before: it is refused with the matching now, not answered "no change", and nothing is recorded.
      Story.provide(CurrentActor, carl),
      Story.when(
        act({ row: "row-14", step: "c1", saw: 0, sawGroup: 1, covered: true, asItReads: true, flags: leftOut })
      ),
      Story.rejected(MatchedSince.make({ matching: 1 })),
      Story.state(row14, { status: "Untouched" }),
      // With the match on his screen, the same press is no change.
      Story.when(
        act({
          row: "row-14",
          step: "c2",
          saw: 0,
          sawGroup: 1,
          covered: true,
          asItReads: true,
          flags: leftOut,
          madeOn: 1
        })
      ),
      Story.then(row14),
      Story.then(life)
    )
)
it.effect(
  "a press that matches what the row holds is held when its screen is behind a group: Dana accepts row 14, Ana's group covers it, Dana types 8 and takes that back, and Carl, who has not received the undo, presses accept there",
  () =>
    story(
      Story.given(life, staged),
      Story.provide(CurrentActor, dana),
      Story.when(act({ row: "row-14", step: "d1", saw: 0, sawGroup: 0, covered: false, flags: accepted })),
      Story.then(row14, decided({ change: 1, by: "dana", step: "d1", flags: accepted })),
      Story.then(life, counted({ change: 1, step: "d1", by: "dana", flags: accepted, row: "row-14" })),
      Story.provide(CurrentActor, ana),
      Story.when(group({ seen: 1, rows: "row-3,row-14", count: 2, patch: leftOut })),
      Story.then(g1, groupDecided({ change: 2, rows: "row-3,row-14", count: 2, patch: leftOut })),
      Story.then(life, groupCounted({ change: 2, rows: 2 })),
      // Dana types 8 on row 14 over the group, then takes it back: the row holds her accept of change 1 again, and
      // Ana's group, made after it, covers the row again.
      Story.provide(CurrentActor, dana),
      Story.when(act({ row: "row-14", step: "d2", saw: 1, sawGroup: 2, covered: true, flags: typedEight })),
      Story.then(row14, decided({ change: 3, by: "dana", step: "d2", flags: typedEight })),
      Story.then(life, counted({ change: 3, step: "d2", by: "dana", flags: typedEight, row: "row-14" })),
      Story.when(undo({ row: "row-14", undo: 3, step: "u1", sawGroup: 2 })),
      Story.then(row14, StepUndone.make({ next: noLevel, below: "", undo: 3, step: "u1", by: "dana" })),
      Story.then(
        life,
        ActCounted.make({
          change: 4,
          step: "u1",
          row: "row-14",
          label: "undo",
          holds: 1,
          by: "dana",
          actor: "dana",
          flags: accepted,
          madeOn: 0
        })
      ),
      // Carl's screen has the 8 and not its undo: on it row 14 is uncovered and holds the 8, and he presses accept.
      // That is what the row's own instance holds, and recorded it would put the accept over Ana's group. It is not
      // "no change": it is refused saying the 8 was taken back and what the row holds again, so his screen holds the
      // press and shows both (Benjamin, 2026-11-22: "Hold it when behind"), and nothing is recorded.
      Story.provide(CurrentActor, carl),
      Story.when(act({ row: "row-14", step: "c1", saw: 3, sawGroup: 2, covered: false, flags: accepted })),
      Story.rejected(PutBackSince.make({ by: "dana", change: 1 })),
      Story.state(row14, { status: "Decided", by: "dana", change: 1 }),
      // From a screen that has the undo, the same press on the row's own decision is no change.
      Story.when(act({ row: "row-14", step: "c2", saw: 1, sawGroup: 2, covered: false, flags: accepted })),
      Story.then(row14),
      Story.then(life),
      // Ana lays another group over row 14. Dana's screen has it and still not her own undo's answer: to it the 8
      // stands under the new group. Her press there is covered, and refused the same true way.
      Story.provide(CurrentActor, ana),
      Story.when(group({ step: "g2", seen: 4, rows: "row-14", count: 1, patch: leftOut })),
      Story.then(g2, groupDecided({ change: 5, step: "g2", rows: "row-14", count: 1, patch: leftOut, under: 2 })),
      Story.then(life, groupCounted({ change: 5, step: "g2", rows: 1 })),
      Story.provide(CurrentActor, dana),
      Story.when(act({ row: "row-14", step: "d3", saw: 3, sawGroup: 5, covered: true, flags: typed })),
      Story.rejected(PutBackSince.make({ by: "dana", change: 1 }))
    )
)
it.effect(
  "the same on a row left with no decision: Ana's group covers row 14, Dana types 8 on it and takes that back, and Carl, who has not received the undo, clears the row",
  () =>
    story(
      Story.given(life, staged),
      Story.provide(CurrentActor, ana),
      Story.when(group({ seen: 0, rows: "row-3,row-14", count: 2, patch: leftOut })),
      Story.then(g1, groupDecided({ change: 1, rows: "row-3,row-14", count: 2, patch: leftOut })),
      Story.then(life, groupCounted({ change: 1, rows: 2 })),
      Story.provide(CurrentActor, dana),
      Story.when(act({ row: "row-14", step: "d1", saw: 0, sawGroup: 1, covered: true, flags: typedEight })),
      Story.then(row14, decided({ change: 2, by: "dana", step: "d1", flags: typedEight })),
      Story.then(life, counted({ change: 2, step: "d1", by: "dana", flags: typedEight, row: "row-14" })),
      Story.when(undo({ row: "row-14", undo: 2, step: "u1", sawGroup: 1 })),
      Story.then(row14, StepUndone.make({ next: noLevel, below: "", undo: 2, step: "u1", by: "dana" })),
      Story.then(life, undoneToNothing({ change: 3, step: "u1", actor: "dana", row: "row-14" })),
      // Carl's screen still has Dana's 8 as the row's own, over the group. He clears it: the row's own instance holds
      // nothing already, and the group reads through it now. Refused and held, not "no change".
      Story.provide(CurrentActor, carl),
      Story.when(act({ row: "row-14", step: "c1", saw: 2, sawGroup: 1, covered: false, flags: "{}" })),
      Story.rejected(NoLongerThere.make({})),
      Story.then(row14),
      Story.then(life)
    )
)
it.effect(
  "a decision a later group covers is not taken back from under it: Dana types 8 on row 14, Ana's group covers the row, Dana's undo is refused naming the group, and is taken once Ana has taken the group back",
  () =>
    story(
      Story.given(life, staged),
      Story.provide(CurrentActor, dana),
      Story.when(act({ row: "row-14", step: "d1", saw: 0, sawGroup: 0, covered: false, flags: typedEight })),
      Story.then(row14, decided({ change: 1, by: "dana", step: "d1", flags: typedEight })),
      Story.then(life, counted({ change: 1, step: "d1", by: "dana", flags: typedEight, row: "row-14" })),
      // Ana's screen has the 8: her group is drawn on rows that read with it.
      Story.provide(CurrentActor, ana),
      Story.when(group({ seen: 1, rows: "row-3,row-14", count: 2 })),
      Story.then(g1, groupDecided({ change: 2, rows: "row-3,row-14", count: 2 })),
      Story.then(life, groupCounted({ change: 2, rows: 2 })),
      // Dana has the group and takes her 8 back. The group would then read over a row its maker never saw: refused
      // with the group's number, as a group's undo under a later group is, and nothing is recorded.
      Story.provide(CurrentActor, dana),
      Story.when(undo({ row: "row-14", undo: 1, step: "u1", sawGroup: 2, covered: true })),
      Story.rejected(GroupedAfter.make({ last: 2 })),
      Story.then(row14),
      Story.then(life),
      Story.provide(CurrentActor, ana),
      Story.when(undoGroup({ undo: 2 })),
      Story.then(g1, GroupUndone.make({ change: 3 })),
      Story.then(life, groupCounted({ change: 3, rows: 2, label: "undo", top: 0 })),
      // No group covers the row now, and the same undo is taken.
      Story.provide(CurrentActor, dana),
      Story.when(undo({ row: "row-14", undo: 1, step: "u2", sawGroup: 3 })),
      Story.then(row14, StepUndone.make({ next: noLevel, below: "", undo: 1, step: "u2", by: "dana" })),
      Story.then(life, undoneToNothing({ change: 4, step: "u2", actor: "dana", row: "row-14" }))
    )
)
it.effect(
  "a row's undo under a group is refused with the import's last group in force, the one to take back first, whichever group covers the row: Dana types 8 on row 14, Ana's group covers it, and Carl's later group names other rows",
  () =>
    story(
      Story.given(life, staged),
      Story.provide(CurrentActor, dana),
      Story.when(act({ row: "row-14", step: "d1", saw: 0, sawGroup: 0, covered: false, flags: typedEight })),
      Story.then(row14, decided({ change: 1, by: "dana", step: "d1", flags: typedEight })),
      Story.then(life, counted({ change: 1, step: "d1", by: "dana", flags: typedEight, row: "row-14" })),
      Story.provide(CurrentActor, ana),
      Story.when(group({ seen: 1, rows: "row-3,row-14", count: 2 })),
      Story.then(g1, groupDecided({ change: 2, rows: "row-3,row-14", count: 2 })),
      Story.then(life, groupCounted({ change: 2, rows: 2 })),
      Story.provide(CurrentActor, carl),
      Story.when(group({ step: "g2", seen: 2, rows: "row-20,row-21", count: 2 })),
      Story.then(g2, groupDecided({ change: 3, step: "g2", by: "carl", rows: "row-20,row-21", count: 2, under: 2 })),
      Story.then(life, groupCounted({ change: 3, step: "g2", rows: 2, by: "carl" })),
      // The model keeps no reading of a group's rows, so it cannot name Ana's group as the one over row 14. It names
      // the last group in force, Carl's: groups are taken back last first, so that is the one to take back first.
      Story.provide(CurrentActor, dana),
      Story.when(undo({ row: "row-14", undo: 1, step: "u1", sawGroup: 3, covered: true })),
      Story.rejected(GroupedAfter.make({ last: 3 })),
      Story.provide(CurrentActor, carl),
      Story.when(undoGroup({ undo: 3, step: "g2" })),
      Story.then(g2, GroupUndone.make({ change: 4 })),
      Story.then(life, groupCounted({ change: 4, step: "g2", rows: 2, label: "undo", by: "carl", top: 2 })),
      // Ana's group is the last in force again, and still over the row.
      Story.provide(CurrentActor, dana),
      Story.when(undo({ row: "row-14", undo: 1, step: "u1", sawGroup: 4, covered: true })),
      Story.rejected(GroupedAfter.make({ last: 2 })),
      Story.then(row14),
      Story.then(life)
    )
)
it.effect(
  "an undo sent twice is answered as the first time when a group act landed between: Dana types 8 on row 14 and takes it back, Ana accepts a group, and Dana's screen sends the undo again",
  () =>
    story(
      Story.given(life, staged),
      Story.provide(CurrentActor, dana),
      Story.when(act({ row: "row-14", step: "d1", saw: 0, sawGroup: 0, covered: false, flags: typedEight })),
      Story.then(row14, decided({ change: 1, by: "dana", step: "d1", flags: typedEight })),
      Story.then(life, counted({ change: 1, step: "d1", by: "dana", flags: typedEight, row: "row-14" })),
      Story.when(undo({ row: "row-14", undo: 1, step: "u1", sawGroup: 0 })),
      Story.then(row14, StepUndone.make({ next: noLevel, below: "", undo: 1, step: "u1", by: "dana" })),
      Story.then(life, undoneToNothing({ change: 2, step: "u1", actor: "dana", row: "row-14" })),
      Story.provide(CurrentActor, ana),
      Story.when(group({ seen: 2, rows: "row-3,row-20", count: 2 })),
      Story.then(g1, groupDecided({ change: 3, rows: "row-3,row-20", count: 2 })),
      Story.then(life, groupCounted({ change: 3, rows: 2 })),
      // The answer to Dana's undo was lost, and the copy cannot have seen Ana's group. The row took that very undo:
      // nothing more is recorded, and her screen is not told to hold a press that is on the row already.
      Story.provide(CurrentActor, dana),
      Story.when(undo({ row: "row-14", undo: 1, step: "u1", sawGroup: 0 })),
      Story.then(row14),
      Story.then(life),
      // Another undo from the screen that has not received the group is still refused and held.
      Story.when(undo({ row: "row-14", undo: 1, step: "u2", sawGroup: 0 })),
      Story.rejected(GroupedSince.make({}))
    )
)
it.effect(
  "a press sent twice is answered as the first time when a group act landed between: Dana types 8 on row 14, Ana accepts a group, and Dana's screen sends the press again",
  () =>
    story(
      Story.given(life, staged),
      Story.provide(CurrentActor, dana),
      Story.when(act({ row: "row-14", step: "d1", saw: 0, sawGroup: 0, covered: false, flags: typedEight })),
      Story.then(row14, decided({ change: 1, by: "dana", step: "d1", flags: typedEight })),
      Story.then(life, counted({ change: 1, step: "d1", by: "dana", flags: typedEight, row: "row-14" })),
      Story.provide(CurrentActor, ana),
      Story.when(group({ seen: 1, rows: "row-3,row-20", count: 2 })),
      Story.then(g1, groupDecided({ change: 2, rows: "row-3,row-20", count: 2 })),
      Story.then(life, groupCounted({ change: 2, rows: 2 })),
      // The answer to Dana's 8 was lost, and the copy cannot have seen Ana's group. The row holds that very press:
      // nothing more is recorded, and her screen is not told to hold a press that is on the row already.
      Story.provide(CurrentActor, dana),
      Story.when(act({ row: "row-14", step: "d1", saw: 0, sawGroup: 0, covered: false, flags: typedEight })),
      Story.then(row14),
      Story.then(life),
      // Any other press from the screen that has not received the group is still refused and held: under a new
      // step, with another text, or from someone else.
      Story.when(act({ row: "row-14", step: "d2", saw: 0, sawGroup: 0, covered: false, flags: typedEight })),
      Story.rejected(GroupedSince.make({})),
      Story.when(act({ row: "row-14", step: "d1", saw: 0, sawGroup: 0, covered: false, flags: leftOut })),
      Story.rejected(GroupedSince.make({})),
      Story.provide(CurrentActor, ana),
      Story.when(act({ row: "row-14", step: "d1", saw: 0, sawGroup: 0, covered: false, flags: typedEight })),
      Story.rejected(GroupedSince.make({}))
    )
)
it.effect(
  "a covered press sent twice is written once and answered the same: Ana's group leaves row 14 out, Dana types 8 on it, and her screen sends the press again",
  () =>
    story(
      Story.given(life, staged),
      Story.provide(CurrentActor, ana),
      Story.when(group({ seen: 0, rows: "row-3,row-14", count: 2, patch: leftOut })),
      Story.then(g1, groupDecided({ change: 1, rows: "row-3,row-14", count: 2, patch: leftOut })),
      Story.then(life, groupCounted({ change: 1, rows: 2 })),
      Story.provide(CurrentActor, dana),
      Story.when(act({ row: "row-14", step: "d1", saw: 0, sawGroup: 1, covered: true, flags: typedEight })),
      Story.then(row14, decided({ change: 2, by: "dana", step: "d1", flags: typedEight })),
      Story.then(life, counted({ change: 2, step: "d1", by: "dana", flags: typedEight, row: "row-14" })),
      // The answer was lost and the screen sends the very same press. The row holds it already, as hers, under that
      // step: nothing more is recorded, and she is not refused with her own decision.
      Story.when(act({ row: "row-14", step: "d1", saw: 0, sawGroup: 1, covered: true, flags: typedEight })),
      Story.then(row14),
      Story.then(life),
      // Another press of hers from a screen that has not received the first is still refused with it.
      Story.when(act({ row: "row-14", step: "d2", saw: 0, sawGroup: 1, covered: true, flags: typed })),
      Story.rejected(DecidedSince.make({ by: "dana", change: 2 })),
      // So is one with the very same text, pressed anew from her second screen: it is another press, under its own
      // step, and not the first one sent again.
      Story.when(act({ row: "row-14", step: "d3", saw: 0, sawGroup: 1, covered: true, flags: typedEight })),
      Story.rejected(DecidedSince.make({ by: "dana", change: 2 })),
      // A press under her first step that says something else is no copy of it either.
      Story.when(act({ row: "row-14", step: "d1", saw: 0, sawGroup: 1, covered: true, flags: typed })),
      Story.rejected(DecidedSince.make({ by: "dana", change: 2 })),
      // And nobody else is answered for her press: the same step and text from Carl is refused with her decision.
      Story.provide(CurrentActor, carl),
      Story.when(act({ row: "row-14", step: "d1", saw: 0, sawGroup: 1, covered: true, flags: typedEight })),
      Story.rejected(DecidedSince.make({ by: "dana", change: 2 })),
      Story.then(row14),
      Story.then(life)
    )
)
it.effect(
  "a press sent again after its sender took it back is not written a second time: Ana's group leaves row 14 out, Dana types 8 on it and takes that back, and the first sending of her 8 arrives late",
  () =>
    story(
      Story.given(life, staged),
      Story.provide(CurrentActor, ana),
      Story.when(group({ seen: 0, rows: "row-3,row-14", count: 2, patch: leftOut })),
      Story.then(g1, groupDecided({ change: 1, rows: "row-3,row-14", count: 2, patch: leftOut })),
      Story.then(life, groupCounted({ change: 1, rows: 2 })),
      Story.provide(CurrentActor, dana),
      Story.when(act({ row: "row-14", step: "d1", saw: 0, sawGroup: 1, covered: true, flags: typedEight })),
      Story.then(row14, decided({ change: 2, by: "dana", step: "d1", flags: typedEight })),
      Story.then(life, counted({ change: 2, step: "d1", by: "dana", flags: typedEight, row: "row-14" })),
      Story.when(undo({ row: "row-14", undo: 2, step: "u1", sawGroup: 1 })),
      Story.then(row14, StepUndone.make({ next: noLevel, below: "", undo: 2, step: "u1", by: "dana" })),
      Story.then(life, undoneToNothing({ change: 3, step: "u1", actor: "dana", row: "row-14" })),
      // A copy of the press that stalled on the way arrives now. The row holds nothing again, which is exactly what
      // the copy says it saw: only the undo it has not received tells it from a new press. It is refused naming the
      // undo, and her 8 is not back on the row she cleared.
      Story.when(act({ row: "row-14", step: "d1", saw: 0, sawGroup: 1, covered: true, flags: typedEight })),
      Story.rejected(UndoneSince.make({ by: "dana", change: 2 })),
      Story.then(row14),
      Story.then(life),
      Story.state(row14, { status: "Undecided" }),
      // A press made after the undo, on a screen that has it, is taken.
      Story.when(
        act({ row: "row-14", step: "d2", saw: 0, sawUndone: 2, sawGroup: 1, covered: true, flags: typedEight })
      ),
      Story.then(row14, decided({ change: 4, by: "dana", step: "d2", flags: typedEight })),
      Story.then(life, counted({ change: 4, step: "d2", by: "dana", flags: typedEight, row: "row-14" }))
    )
)
it.effect(
  "a group's undo is taken from a screen that is behind on the rows, and touches none: Ana's group covers row 14, Dana types 8 on it, and Ana, who has not received the 8, takes her group back",
  () =>
    story(
      Story.given(life, staged),
      Story.provide(CurrentActor, ana),
      Story.when(group({ seen: 0, rows: "row-3,row-14", count: 2 })),
      Story.then(g1, groupDecided({ change: 1, rows: "row-3,row-14", count: 2 })),
      Story.then(life, groupCounted({ change: 1, rows: 2 })),
      Story.provide(CurrentActor, dana),
      Story.when(act({ row: "row-14", step: "d1", saw: 0, sawGroup: 1, covered: true, flags: typedEight })),
      Story.then(row14, decided({ change: 2, by: "dana", step: "d1", flags: typedEight })),
      Story.then(life, counted({ change: 2, step: "d1", by: "dana", flags: typedEight, row: "row-14" })),
      // Ana's undo names nothing her screen has seen of the rows, and is taken: it takes back her own act and no
      // one else's. The answer is the group's undo with its number; row 14 keeps Dana's whole decision, made since
      // the group, which is what Ana's screen then names as changed since and staying.
      Story.provide(CurrentActor, ana),
      Story.when(undoGroup({ undo: 1 })),
      Story.then(g1, GroupUndone.make({ change: 3 })),
      Story.then(life, groupCounted({ change: 3, rows: 2, label: "undo", top: 0 })),
      Story.then(row14),
      Story.state(row14, { status: "Decided", by: "dana", change: 2, flags: typedEight }),
      Story.state(g1, { status: "Decided", undoneAt: 3 })
    )
)
it.effect(
  "walk-back: Ana decides a group, Dana decides a group; Ana's undo is refused naming Dana's; Dana undoes hers, then Ana hers",
  () =>
    story(
      Story.given(life, staged),
      Story.provide(CurrentActor, ana),
      Story.when(group({ seen: 0 })),
      Story.then(g1, groupDecided({ change: 1 })),
      Story.then(life, groupCounted({ change: 1 })),
      Story.provide(CurrentActor, dana),
      Story.when(group({ step: "g2", seen: 1, rows: danasRows, count: 900, label: danasLabel })),
      Story.then(
        g2,
        groupDecided({ change: 2, step: "g2", by: "dana", rows: danasRows, count: 900, label: danasLabel, under: 1 })
      ),
      Story.then(life, groupCounted({ change: 2, step: "g2", rows: 900, label: danasLabel, by: "dana" })),
      // Dana's group came after Ana's and is in force: Ana's undo is refused and says which.
      Story.provide(CurrentActor, ana),
      Story.when(undoGroup({ undo: 1 })),
      Story.rejected(GroupedAfter.make({ last: 2 })),
      Story.then(g1),
      Story.then(life),
      Story.provide(CurrentActor, dana),
      Story.when(undoGroup({ step: "g2", undo: 2 })),
      Story.then(g2, GroupUndone.make({ change: 3 })),
      Story.then(life, groupCounted({ change: 3, step: "g2", rows: 900, label: "undo", by: "dana", top: 1 })),
      // Ana's is the last in force again.
      Story.provide(CurrentActor, ana),
      Story.when(undoGroup({ undo: 1 })),
      Story.then(g1, GroupUndone.make({ change: 4 })),
      Story.then(life, groupCounted({ change: 4, label: "undo", top: 0 }))
    )
)
it.effect("a group made on an older matching is refused", () =>
  story(
    Story.given(
      life,
      staged,
      ColumnMatched.make({ change: 1, matching: 1, columns: "unit: Unit of measure", by: "dana" })
    ),
    Story.provide(CurrentActor, ana),
    Story.when(group({ seen: 1, madeOn: 0 })),
    Story.rejected(MatchedSince.make({ matching: 1 })),
    Story.when(MatchColumn.make({ importId: id, columns: "unit: UoM", saw: 1, opening: 0 })),
    Story.then(life, ColumnMatched.make({ change: 2, matching: 2, columns: "unit: UoM", by: "ana" }))
  )
)
it.effect(
  "a group's undo does not reach past a confirm that stands, and a group made before it is not taken after a reopen",
  () =>
    story(
      Story.given(life, staged, groupCounted({ change: 1 }), ImportConfirmed.make({ change: 2, ...counts, by: "ana" })),
      Story.given(g1, groupDecided({ change: 1 })),
      Story.provide(CurrentActor, ana),
      Story.when(ReopenImport.make({ importId: id, seen: 2 })),
      Story.then(life, ImportReopened.make({ change: 3, by: "ana" })),
      Story.when(undoGroup({ undo: 1, opening: 0 })),
      Story.rejected(ConfirmedSince.make({})),
      Story.when(undoGroup({ undo: 1, opening: 1 })),
      Story.rejected(DecidedBeforeTheConfirm.make({})),
      Story.when(group({ step: "g2", seen: 3, opening: 0 })),
      Story.rejected(ConfirmedSince.make({}))
    )
)
it.effect("a group decided after another was taken back goes over the one still in force, on the matching now", () =>
  story(
    Story.given(
      life,
      staged,
      ColumnMatched.make({ change: 1, matching: 1, columns: "unit: UoM", by: "dana" }),
      groupCounted({ change: 2 }),
      groupCounted({ change: 3, step: "g2", rows: 900, label: danasLabel, by: "dana" }),
      groupCounted({ change: 4, step: "g2", rows: 900, label: "undo", by: "dana", top: 2 })
    ),
    Story.given(g1, groupDecided({ change: 2, madeOn: 1 })),
    Story.given(
      g2,
      groupDecided({
        change: 3,
        step: "g2",
        by: "dana",
        rows: danasRows,
        count: 900,
        label: danasLabel,
        madeOn: 1,
        under: 2
      }),
      GroupUndone.make({ change: 4 })
    ),
    Story.provide(CurrentActor, ana),
    // Dana's group is taken back: Ana's new one goes over Ana's first, not over the undo.
    Story.when(group({ step: "g3", seen: 4, madeOn: 1 })),
    Story.then(g3, groupDecided({ change: 5, step: "g3", madeOn: 1, under: 2 })),
    Story.then(life, groupCounted({ change: 5, step: "g3" }))
  )
)
it.effect("an undo of a group step that decided no group is refused as not the sender's step", () =>
  story(
    Story.given(life, staged, groupCounted({ change: 1 })),
    Story.given(g1, groupDecided({ change: 1 })),
    Story.provide(CurrentActor, ana),
    Story.when(undoGroup({ step: "g2", undo: 1 })),
    Story.rejected(NotYourStep.make({}))
  )
)
