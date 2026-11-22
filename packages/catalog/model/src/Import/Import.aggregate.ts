// @effect-diagnostics newSchemaClass:off
// One import's lifecycle as its own instance, with no list in its state: staged, matched, confirmed, taken back,
// opened again, removed. It numbers every change. A confirm, a take-back, a reopen and a remove each name the last
// change their sender's screen has received, with none before it missing, and are refused on any other (Benjamin,
// 2026-11-19: "nothing is confirmed that was not on screen"; 2026-11-22: "Refuse, show, confirm again", "Yes, refuse
// and show"). An act on a group of rows is one change (2026-11-22: "One unit per group"), recorded with the group's own
// instance; the import holds its number as the last group act, and the number of the last group still in force, the
// only one that may be taken back ("Only the last group act"). Rows and groups are not here: each decided row is its
// own instance (`Row`), each group act its own (`Group`), and the four decisions record an act on the import and on
// one of them, or on neither. The one thing not to break: a rule is one comparison. The prover takes both sides of
// every `&&`, `||` and `?:` it cannot settle, in the code and in every rule a decision reads, and past 4,096 paths it
// proves nothing.
//
// Verify reads this file's code, not only its types. It reads a case told with `effect/Match` and a state built by its
// case's own `make` with the status written out; it does not read a schema's `guards` or `match`, nor `Event.make`. So
// the guards below are written with Match, every `make` of a state names its status, and events and rejections are
// built with `new` (the one diagnostic this file turns off).
import * as Domain from "@alchemy.run/domain"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as Match from "effect/Match"
import * as S from "effect/Schema"
import { CurrentActor, Session } from "../Actor/Actor.context.ts"
import { Change, Columns, Digest, ImportKey, Step } from "../Review/Change.schema.ts"

const Count = S.Int.check(S.isGreaterThanOrEqualTo(0))

/** A file was staged for review: how many rows it has and which column fills each field by its heading. */
export class ImportStaged extends Domain.Event(
  "ImportStaged",
  { organizationId: S.String, rows: Count, columns: Columns, by: S.String },
  { description: "A file was staged for review" }
) {}

/**
 * Which column fills each field now, every field a match moved included, the number of the match, and who made it:
 * the mapping, and since which match each field reads its column, can be rebuilt from the import's events alone.
 */
export class ColumnMatched extends Domain.Event(
  "ColumnMatched",
  { change: Change, matching: S.Int, columns: Columns, by: S.String },
  { description: "A column was matched to a field: every field's column after it" }
) {}

/**
 * One act on one row, numbered by its import and recorded by the decision that also records the row. It says what the
 * row holds after it: the change that recorded the decision (0 when the row has none), whose it is, and its flags.
 * `actor` is who acted; after an undo the decision the row then holds can be another person's.
 */
export class ActCounted extends Domain.Event(
  "ActCounted",
  {
    change: Change,
    step: Step,
    row: S.String,
    label: S.String,
    holds: Change,
    by: S.String,
    actor: S.String,
    flags: S.String,
    madeOn: S.Int
  },
  { description: "One act on one row was taken: what the row now holds, whose it is, and who acted" }
) {}

/**
 * One act on a group of rows, or its undo, numbered by its import and recorded by the decision that also records the
 * group: how many rows it is of, and who acted. `top` is the last act on a group still in force after this one: itself
 * when it decides a group, the one that was under it when it takes one back (0 for none).
 */
export class GroupCounted extends Domain.Event(
  "GroupCounted",
  { change: Change, step: Step, rows: Count, label: S.String, by: S.String, top: Change },
  {
    description:
      "One act on a group of rows, or its undo, was taken: how many rows, who acted, which group is last in force"
  }
) {}

/** A suggestion was asked for. It changes nothing a person decided. */
export class SuggestionRecorded extends Domain.Event(
  "SuggestionRecorded",
  { by: S.String },
  { description: "A suggestion was recorded; it writes nothing" }
) {}

/** The import was confirmed: what became of its rows, as the four outcomes that add up to them. */
export class ImportConfirmed extends Domain.Event(
  "ImportConfirmed",
  { change: Change, created: Count, updated: Count, already: Count, notImported: Count, by: S.String },
  { description: "The import was confirmed: how many rows were created, updated, already there and not imported" }
) {}

/**
 * The import was taken back. Of the items its confirms created: how many were removed, and kept because someone
 * changed them. Of the replacements they made (a count of replacements, as the confirms said them, not of items):
 * how many were put back, and kept for the same reason.
 */
export class ImportTakenBack extends Domain.Event(
  "ImportTakenBack",
  { change: Change, removed: Count, kept: Count, restored: Count, keptReplaced: Count, by: S.String },
  { description: "The import was taken back: what was removed, put back and kept" }
) {}

/** A closed import was opened again, to fix rows it did not import. */
export class ImportReopened extends Domain.Event(
  "ImportReopened",
  { change: Change, by: S.String },
  { description: "A confirmed or taken-back import was opened again" }
) {}

/** An open import with nothing in force was removed. */
export class ImportRemoved extends Domain.Event(
  "ImportRemoved",
  { change: Change, by: S.String },
  { description: "An import with nothing in force was removed" }
) {}

/** The person is a viewer, or acts in another organization, or is not the one who may do this. */
export class NotPermitted extends Domain.Rejection(
  "NotPermitted",
  {},
  { description: "This person may not do this" }
) {}
/** An import with this id was staged already. */
export class AlreadyStaged extends Domain.Rejection(
  "AlreadyStaged",
  {},
  { description: "An import with this id was staged already" }
) {}
/** The import is not open for review. */
export class NotOpen extends Domain.Rejection("NotOpen", {}, { description: "The import is not open for review" }) {}
/** The screen has not received every change: the last one's number. */
export class ReviewMovedOn extends Domain.Rejection(
  "ReviewMovedOn",
  { last: Change },
  { description: "The sender's screen has not received every change of the import" }
) {}
/** The plan was built at a change that is no longer the last: the handler builds it again. */
export class PlanBehind extends Domain.Rejection(
  "PlanBehind",
  { last: Change },
  { description: "The confirm's plan was built before the import's last change" }
) {}
/** What the plan would do is not what the button said: the stored items changed, with no change of this import between. */
export class NotWhatWasShown extends Domain.Rejection(
  "NotWhatWasShown",
  {},
  { description: "The confirm would do something else than its button said" }
) {}
/** The import was confirmed after the act was made: the screen names it. */
export class ConfirmedSince extends Domain.Rejection(
  "ConfirmedSince",
  {},
  { description: "The import was confirmed after this was made" }
) {}
/** A column was matched again: the matching now. */
export class MatchedSince extends Domain.Rejection(
  "MatchedSince",
  { matching: S.Int },
  { description: "A column was matched again after this was made" }
) {}
/** The confirm's four outcomes do not add up to the rows in the file. */
export class CountsDoNotAddUp extends Domain.Rejection(
  "CountsDoNotAddUp",
  {},
  { description: "The confirm's outcomes do not add up to the rows in the file" }
) {}
/** No confirm of this import stands, so there is nothing to take back. */
export class NotImported extends Domain.Rejection(
  "NotImported",
  {},
  { description: "No confirm of this import stands" }
) {}
/** A take-back says it keeps more items than are in force. */
export class MoreKeptThanInForce extends Domain.Rejection(
  "MoreKeptThanInForce",
  {},
  { description: "A take-back keeps more items than the import has in force" }
) {}
/** The import is open: only a confirmed or taken-back one is opened again. */
export class NotClosed extends Domain.Rejection("NotClosed", {}, { description: "The import is still open" }) {}
/** Items it created are in force, or a confirm of it was not taken back: it stays with them. */
export class HasItemsInForce extends Domain.Rejection(
  "HasItemsInForce",
  {},
  { description: "The import has items in force, so it is not removed" }
) {}

/** Stage a file for review. */
export class StageImport extends Domain.Command(
  "StageImport",
  {
    middleware: [Session],
    input: { importId: ImportKey, rows: Count, columns: Columns },
    events: [ImportStaged],
    rejects: [NotPermitted, AlreadyStaged]
  },
  { description: "Stage a file for review: its rows and the column each field reads by its heading" }
) {}

/** Match a column to a field. `columns` is every field's column after it; `saw` the matching the sender's screen has. */
export class MatchColumn extends Domain.Command(
  "MatchColumn",
  {
    middleware: [Session],
    input: { importId: ImportKey, columns: Columns, saw: S.Int, opening: S.Int },
    events: [ColumnMatched],
    rejects: [NotPermitted, NotOpen, ConfirmedSince, MatchedSince]
  },
  { description: "Match a column to a field, naming the last match the sender saw" }
) {}

/** Record that a suggestion was asked for. */
export class RecordSuggestion extends Domain.Command(
  "RecordSuggestion",
  {
    middleware: [Session],
    input: { importId: ImportKey },
    events: [SuggestionRecorded],
    rejects: [NotPermitted, NotOpen]
  },
  { description: "Record that a suggestion was asked for; it changes no decision" }
) {}

/**
 * Confirm the import. `seen`: the screen has received every change up to this number, its own acts' included.
 * `planAt`: the handler built the plan from rows written up to this number. `shown` and `plan`: what every row
 * becomes, as one digest, as the screen had it and as the plan has it.
 */
export class ConfirmImport extends Domain.Command(
  "ConfirmImport",
  {
    middleware: [Session],
    input: {
      importId: ImportKey,
      seen: Change,
      planAt: Change,
      shown: Digest,
      plan: Digest,
      created: Count,
      updated: Count,
      already: Count,
      notImported: Count
    },
    events: [ImportConfirmed],
    rejects: [NotPermitted, NotOpen, ReviewMovedOn, PlanBehind, NotWhatWasShown, CountsDoNotAddUp]
  },
  { description: "Confirm the import, naming the last change the screen received and what its button said" }
) {}

/** Take back everything the import has in force, saying how many changed items are kept. */
export class TakeBackImport extends Domain.Command(
  "TakeBackImport",
  {
    middleware: [Session],
    input: { importId: ImportKey, seen: Change, kept: Count, keptReplaced: Count },
    events: [ImportTakenBack],
    rejects: [NotPermitted, NotImported, ReviewMovedOn, MoreKeptThanInForce]
  },
  { description: "Take back everything the import has in force, keeping the items someone changed" }
) {}

/** Open a confirmed or taken-back import again. */
export class ReopenImport extends Domain.Command(
  "ReopenImport",
  {
    middleware: [Session],
    input: { importId: ImportKey, seen: Change },
    events: [ImportReopened],
    rejects: [NotPermitted, NotClosed, ReviewMovedOn]
  },
  { description: "Open a confirmed or taken-back import again, naming its last change" }
) {}

/** Remove an open import that has nothing in force. */
export class RemoveImport extends Domain.Command(
  "RemoveImport",
  {
    middleware: [Session],
    input: { importId: ImportKey, seen: Change },
    events: [ImportRemoved],
    rejects: [NotPermitted, NotOpen, ReviewMovedOn, HasItemsInForce]
  },
  { description: "Remove an open import with nothing in force, naming its last change" }
) {}

// What every import that was staged and not removed keeps, whatever its status.
const kept = {
  organizationId: S.String,
  rows: S.Int,
  // How many times it was confirmed: an act names it, so one made before a confirm is not taken after a reopen.
  confirms: S.Int,
  matching: S.Int,
  columns: Columns,
  // The number of the last change, and of the last confirm that stands (0 when none does).
  changes: S.Int,
  confirmedAt: S.Int,
  // Items its confirms created that are in force; replacements its confirms made that were not put back (each
  // confirm adds its `updated`, the sender's count, so an item replaced by two confirms counts twice: a count of
  // replacements, not of items, and bounded by nothing but what the senders said); and its confirms not taken back.
  inForce: S.Int,
  replaced: S.Int,
  standing: S.Int,
  // The number of the last act on a group, its undo included (0 when there was none): a row's act names it.
  lastGroup: S.Int,
  // The change of the last group still in force (0 when there is none): only that one is taken back.
  topGroup: S.Int
}

/**
 * Where an import is in its life. Whatever its status, a staged import holds the number of its last act on a group
 * and of the last group still in force.
 */
export const ImportState = S.Union([
  S.Struct({ status: S.tag("Unstaged") }),
  S.Struct({
    status: S.tag("Open"),
    ...kept,
    suggestions: S.Int
  }),
  S.Struct({
    status: S.tag("Imported"),
    ...kept,
    created: S.Int,
    updated: S.Int,
    already: S.Int,
    notImported: S.Int
  }),
  S.Struct({ status: S.tag("TakenBack"), ...kept, removed: S.Int, kept: S.Int }),
  S.Struct({ status: S.tag("Removed"), organizationId: S.String })
])
  .annotate({ description: "Where one import is in its life, with its counts and the number of its last change" })
  .pipe(S.toTaggedUnion("status"))
/** The decoded value of `ImportState`. */
export type ImportState = typeof ImportState.Type
/** An import that is open for review. */
export type OpenImport = typeof ImportState.cases.Open.Type

const yes = (): boolean => true
const no = (): boolean => false
const byStatus = Match.discriminatorsExhaustive("status")

/** True for an import that was never staged. */
export const isUnstaged = (s: ImportState): s is typeof ImportState.cases.Unstaged.Type =>
  Match.value(s).pipe(byStatus({ Unstaged: yes, Open: no, Imported: no, TakenBack: no, Removed: no }))
/** True for an import open for review. */
export const isOpen = (s: ImportState): s is OpenImport =>
  Match.value(s).pipe(byStatus({ Unstaged: no, Open: yes, Imported: no, TakenBack: no, Removed: no }))
/** True for an import whose last confirm closed it. */
export const isImported = (s: ImportState): s is typeof ImportState.cases.Imported.Type =>
  Match.value(s).pipe(byStatus({ Unstaged: no, Open: no, Imported: yes, TakenBack: no, Removed: no }))
/** True for an import that was taken back from its result. */
export const isTakenBack = (s: ImportState): s is typeof ImportState.cases.TakenBack.Type =>
  Match.value(s).pipe(byStatus({ Unstaged: no, Open: no, Imported: no, TakenBack: yes, Removed: no }))
/** True for an import that was removed. */
export const isRemoved = (s: ImportState): s is typeof ImportState.cases.Removed.Type =>
  Match.value(s).pipe(byStatus({ Unstaged: no, Open: no, Imported: no, TakenBack: no, Removed: yes }))

/** A command the import itself decides. */
type ImportCommand =
  | StageImport
  | MatchColumn
  | RecordSuggestion
  | ConfirmImport
  | TakeBackImport
  | ReopenImport
  | RemoveImport
/** An event the import folds: its own commands', and `ActCounted` and `GroupCounted`, which only a decision records. */
export type ImportEvent =
  | ImportStaged
  | ColumnMatched
  | ActCounted
  | GroupCounted
  | SuggestionRecorded
  | ImportConfirmed
  | ImportTakenBack
  | ImportReopened
  | ImportRemoved

const isConfirm = (command: ImportCommand): command is ConfirmImport =>
  Match.value(command).pipe(Match.tag("ConfirmImport", yes), Match.orElse(no))
const isTakeBack = (command: ImportCommand): command is TakeBackImport =>
  Match.value(command).pipe(Match.tag("TakeBackImport", yes), Match.orElse(no))
const isReopen = (command: ImportCommand): command is ReopenImport =>
  Match.value(command).pipe(Match.tag("ReopenImport", yes), Match.orElse(no))
/** A take-back, a reopen or a remove: each names the last change its sender's screen received. */
const endsOrReopens = (command: ImportCommand): command is TakeBackImport | ReopenImport | RemoveImport =>
  Match.value(command).pipe(Match.tag("TakeBackImport", "ReopenImport", "RemoveImport", yes), Match.orElse(no))
const isMatch = (command: ImportCommand): command is MatchColumn =>
  Match.value(command).pipe(Match.tag("MatchColumn", yes), Match.orElse(no))
const isSuggestion = (command: ImportCommand): command is RecordSuggestion =>
  Match.value(command).pipe(Match.tag("RecordSuggestion", yes), Match.orElse(no))
const isActCounted = (event: ImportEvent): event is ActCounted =>
  Match.value(event).pipe(Match.tag("ActCounted", yes), Match.orElse(no))
const isTakenBackEvent = (event: ImportEvent): event is ImportTakenBack =>
  Match.value(event).pipe(Match.tag("ImportTakenBack", yes), Match.orElse(no))

/**
 * One import's lifecycle: staged, matched, confirmed, taken back, opened again, removed, with the number of its last
 * change. Every act of the review goes through it, so it can order a confirm among them.
 */
export class Import extends Domain.Aggregate(
  "Import",
  {
    id: ImportKey,
    state: ImportState,
    initial: ImportState.cases.Unstaged.make({ status: "Unstaged" }),
    invariants: {
      // A confirm's four outcomes add up to the rows in the file: of the counts its command states.
      OutcomesAddUpToTheRows: (s) => !isImported(s) || s.created + s.updated + s.already + s.notImported === s.rows,
      // No count is negative. One comparison a rule.
      RowsAreNotNegative: (s) => isUnstaged(s) || isRemoved(s) || s.rows >= 0,
      InForceIsNotNegative: (s) => isUnstaged(s) || isRemoved(s) || s.inForce >= 0,
      ReplacedIsNotNegative: (s) => isUnstaged(s) || isRemoved(s) || s.replaced >= 0,
      StandingIsNotNegative: (s) => isUnstaged(s) || isRemoved(s) || s.standing >= 0,
      CreatedIsNotNegative: (s) => !isImported(s) || s.created >= 0,
      UpdatedIsNotNegative: (s) => !isImported(s) || s.updated >= 0,
      AlreadyIsNotNegative: (s) => !isImported(s) || s.already >= 0,
      NotImportedIsNotNegative: (s) => !isImported(s) || s.notImported >= 0,
      RemovedIsNotNegative: (s) => !isTakenBack(s) || s.removed >= 0,
      KeptIsNotNegative: (s) => !isTakenBack(s) || s.kept >= 0,
      // An import never has more items in force than the file has rows.
      NoMoreInForceThanRows: (s) => isUnstaged(s) || isRemoved(s) || s.inForce <= s.rows,
      // What says "taken back" has no confirm standing.
      NothingStandsThatWasTakenBack: (s) => !isTakenBack(s) || s.standing === 0,
      WhatIsInForceThenIsWhatWasKept: (s) => !isTakenBack(s) || s.inForce === s.kept
    },
    transitions: {
      // The status becomes Imported only by a confirm.
      NothingIsWrittenBeforeConfirm: ({ before, after, command }) =>
        !isImported(after) || isImported(before) || isConfirm(command),
      // A confirm leaves the status of an import that is not open as it was. It says no more: what stops a second
      // confirm from writing is that one on a closed import is refused, and "every change has its own number".
      AConfirmLeavesAClosedImportsStatusAsItWas: ({ before, after, command }) =>
        !isConfirm(command) || isOpen(before) || after.status === before.status,
      // Nothing is confirmed that was not on screen: the confirm names the last change, as the last of every one its
      // screen received; its plan is of that change; and the plan does what the screen said it would.
      AConfirmNamesEveryChange: ({ before, after, command }) =>
        !isConfirm(command) || !isOpen(before) || !isImported(after) || command.seen === before.changes,
      APlanIsOfEveryChange: ({ before, after, command }) =>
        !isConfirm(command) || !isOpen(before) || !isImported(after) || command.planAt === before.changes,
      APlanDoesWhatWasShown: ({ before, after, command }) =>
        !isConfirm(command) || !isOpen(before) || !isImported(after) || command.plan === command.shown,
      // Nor is an import taken back, opened again or removed by someone who has not received its last change.
      TheRestNameEveryChangeToo: ({ before, after, command }) =>
        !endsOrReopens(command) ||
        isUnstaged(before) ||
        isRemoved(before) ||
        isUnstaged(after) ||
        command.seen === before.changes,
      // Every change has a number of its own: each raises the import's number by exactly one, and nothing else moves it.
      EveryChangeHasItsOwnNumber: ({ before, after, command }) =>
        isUnstaged(before) ||
        isRemoved(before) ||
        isUnstaged(after) ||
        isRemoved(after) ||
        after.changes === before.changes + (isSuggestion(command) ? 0 : 1),
      OnlyAnImportWithAConfirmStandingIsTakenBack: ({ before, after, command }) =>
        !isTakeBack(command) || isUnstaged(before) || isRemoved(before) || isUnstaged(after) || before.standing >= 1,
      // A take-back is of everything in force: what was removed and what was kept add up to it, and nothing stands
      // after.
      ATakeBackIsOfEverythingInForce: ({ before, after, command, events }) =>
        !isTakeBack(command) ||
        isUnstaged(before) ||
        isRemoved(before) ||
        isUnstaged(after) ||
        isRemoved(after) ||
        (after.standing === 0 &&
          after.replaced === 0 &&
          after.inForce === command.kept &&
          A.every(events, (e) => !isTakenBackEvent(e) || e.removed + e.kept === before.inForce)),
      // What its confirms replaced is put back or kept, and nothing is left out of the two counts.
      AndOfEverythingReplaced: ({ before, command, events }) =>
        !isTakeBack(command) ||
        isUnstaged(before) ||
        isRemoved(before) ||
        A.every(events, (e) => !isTakenBackEvent(e) || e.restored + e.keptReplaced === before.replaced),
      // Every event of the import says whose it is.
      EveryEventSaysWhose: Effect.fn("Import.EveryEventSaysWhose")(function* ({ events }) {
        const actor = yield* CurrentActor
        return A.every(events, (e) => (isActCounted(e) ? e.actor === actor.memberId : e.by === actor.memberId))
      }),
      // A match is made in this opening of the import.
      AMatchIsOfThisOpening: ({ before, after, command }) =>
        !isMatch(command) || !isOpen(before) || !isOpen(after) || command.opening === before.confirms,
      ASuggestionWritesNothing: ({ before, after, command }) =>
        !isSuggestion(command) ||
        !isOpen(before) ||
        (isOpen(after) && after.matching === before.matching && after.changes === before.changes),
      // A match is made by someone who saw the last one, whatever field it moved; it raises the matching by one and
      // holds the columns it says. The same columns again are no match.
      AMatchIsMadeOnTheLastOne: ({ before, after, command }) =>
        !isMatch(command) || !isOpen(before) || !isOpen(after) || command.saw === before.matching,
      AMatchHoldsTheColumnsItSays: ({ before, after, command }) =>
        !isMatch(command) || !isOpen(before) || !isOpen(after) || after.columns === command.columns,
      AMatchIsTheNextOne: ({ before, after, command }) =>
        !isMatch(command) || !isOpen(before) || !isOpen(after) || after.matching === before.matching + 1,
      // The matching moves only on an open import. It reads the matching alone: that no row or group act lands on a
      // closed import is each decision's own rule ("a row is decided only on an open import" and its like).
      TheMatchingMovesOnlyOnAnOpenImport: ({ before, after }) =>
        isOpen(before) ||
        isUnstaged(before) ||
        isRemoved(before) ||
        isRemoved(after) ||
        isUnstaged(after) ||
        after.matching === before.matching,
      AnImportIsOpenedAgainOnlyByReopen: ({ before, after, command }) =>
        !isOpen(after) ||
        isOpen(before) ||
        isUnstaged(before) ||
        (isReopen(command) && (isImported(before) || isTakenBack(before))),
      ARemovedImportStaysRemoved: ({ before, after }) => !isRemoved(before) || isRemoved(after),
      OnlyAnImportWithNothingInForceIsRemoved: ({ before, after }) =>
        !isRemoved(after) || isRemoved(before) || (isOpen(before) && before.inForce === 0 && before.standing === 0),
      AnImportNeverChangesOrganization: ({ before, after }) =>
        isUnstaged(before) || isUnstaged(after) || before.organizationId === after.organizationId,
      OnlyItsOwnOrganizationChangesAnImport: Effect.fn("Import.OnlyItsOwnOrganizationChangesAnImport")(function* ({
        before
      }) {
        if (isUnstaged(before)) return true
        const actor = yield* CurrentActor
        return actor.organizationId === before.organizationId
      }),
      AViewerChangesNothing: Effect.fn("Import.AViewerChangesNothing")(function* () {
        const actor = yield* CurrentActor
        return actor.role !== "viewer"
      })
    },
    commands: [StageImport, MatchColumn, RecordSuggestion, ConfirmImport, TakeBackImport, ReopenImport, RemoveImport],
    events: [ActCounted, GroupCounted],
    keyOf: (cmd) => cmd.importId,
    decide: {
      StageImport: Effect.fn("Import.StageImport")(function* (s, cmd) {
        const actor = yield* CurrentActor
        if (actor.role === "viewer") return yield* new NotPermitted({})
        if (!isUnstaged(s)) return yield* new AlreadyStaged({})
        return [
          new ImportStaged({
            organizationId: actor.organizationId,
            rows: cmd.rows,
            columns: cmd.columns,
            by: actor.memberId
          })
        ]
      }),
      MatchColumn: Effect.fn("Import.MatchColumn")(function* (s, cmd) {
        const actor = yield* CurrentActor
        if (!isOpen(s)) return yield* new NotOpen({})
        if (actor.organizationId !== s.organizationId || actor.role === "viewer") return yield* new NotPermitted({})
        if (cmd.opening !== s.confirms) return yield* new ConfirmedSince({})
        if (cmd.saw !== s.matching) return yield* new MatchedSince({ matching: s.matching })
        // Every field reads this already, by its heading or by hand: nothing is recorded, and nothing is taken back.
        if (s.columns === cmd.columns) return []
        return [
          new ColumnMatched({
            change: s.changes + 1,
            matching: s.matching + 1,
            columns: cmd.columns,
            by: actor.memberId
          })
        ]
      }),
      RecordSuggestion: Effect.fn("Import.RecordSuggestion")(function* (s) {
        const actor = yield* CurrentActor
        if (!isOpen(s)) return yield* new NotOpen({})
        if (actor.organizationId !== s.organizationId || actor.role === "viewer") return yield* new NotPermitted({})
        return [new SuggestionRecorded({ by: actor.memberId })]
      }),
      ConfirmImport: Effect.fn("Import.ConfirmImport")(function* (s, cmd) {
        const actor = yield* CurrentActor
        if (!isOpen(s)) return yield* new NotOpen({})
        if (actor.organizationId !== s.organizationId || actor.role === "viewer") return yield* new NotPermitted({})
        if (cmd.seen !== s.changes) return yield* new ReviewMovedOn({ last: s.changes })
        if (cmd.planAt !== s.changes) return yield* new PlanBehind({ last: s.changes })
        if (cmd.plan !== cmd.shown) return yield* new NotWhatWasShown({})
        if (cmd.created + cmd.updated + cmd.already + cmd.notImported !== s.rows) {
          return yield* new CountsDoNotAddUp({})
        }
        // No more is ever in force than the file has rows.
        if (s.inForce + cmd.created > s.rows) return yield* new CountsDoNotAddUp({})
        return [
          new ImportConfirmed({
            change: s.changes + 1,
            created: cmd.created,
            updated: cmd.updated,
            already: cmd.already,
            notImported: cmd.notImported,
            by: actor.memberId
          })
        ]
      }),
      TakeBackImport: Effect.fn("Import.TakeBackImport")(function* (s, cmd) {
        const actor = yield* CurrentActor
        if (!isImported(s) && !isOpen(s)) return yield* new NotImported({})
        if (actor.organizationId !== s.organizationId || actor.role === "viewer") return yield* new NotPermitted({})
        if (s.standing < 1) return yield* new NotImported({})
        if (cmd.seen !== s.changes) return yield* new ReviewMovedOn({ last: s.changes })
        if (cmd.kept > s.inForce || cmd.keptReplaced > s.replaced) return yield* new MoreKeptThanInForce({})
        return [
          new ImportTakenBack({
            change: s.changes + 1,
            removed: s.inForce - cmd.kept,
            kept: cmd.kept,
            restored: s.replaced - cmd.keptReplaced,
            keptReplaced: cmd.keptReplaced,
            by: actor.memberId
          })
        ]
      }),
      ReopenImport: Effect.fn("Import.ReopenImport")(function* (s, cmd) {
        const actor = yield* CurrentActor
        if (!isImported(s) && !isTakenBack(s)) return yield* new NotClosed({})
        if (actor.organizationId !== s.organizationId || actor.role === "viewer") return yield* new NotPermitted({})
        if (cmd.seen !== s.changes) return yield* new ReviewMovedOn({ last: s.changes })
        return [new ImportReopened({ change: s.changes + 1, by: actor.memberId })]
      }),
      RemoveImport: Effect.fn("Import.RemoveImport")(function* (s, cmd) {
        const actor = yield* CurrentActor
        if (!isOpen(s)) return yield* new NotOpen({})
        if (actor.organizationId !== s.organizationId || actor.role === "viewer") return yield* new NotPermitted({})
        if (cmd.seen !== s.changes) return yield* new ReviewMovedOn({ last: s.changes })
        if (s.inForce !== 0 || s.standing !== 0) return yield* new HasItemsInForce({})
        return [new ImportRemoved({ change: s.changes + 1, by: actor.memberId })]
      })
    },
    evolve: {
      ImportStaged: (_, e) =>
        ImportState.cases.Open.make({
          status: "Open",
          organizationId: e.organizationId,
          rows: e.rows,
          confirms: 0,
          matching: 0,
          columns: e.columns,
          changes: 0,
          confirmedAt: 0,
          inForce: 0,
          replaced: 0,
          standing: 0,
          lastGroup: 0,
          topGroup: 0,
          suggestions: 0
        }),
      ColumnMatched: (s, e) => (isOpen(s) ? { ...s, changes: e.change, matching: e.matching, columns: e.columns } : s),
      ActCounted: (s, e) => (isOpen(s) ? { ...s, changes: e.change } : s),
      GroupCounted: (s, e) => (isOpen(s) ? { ...s, changes: e.change, lastGroup: e.change, topGroup: e.top } : s),
      SuggestionRecorded: (s) => (isOpen(s) ? { ...s, suggestions: s.suggestions + 1 } : s),
      ImportConfirmed: (s, e) =>
        isOpen(s)
          ? ImportState.cases.Imported.make({
              status: "Imported",
              organizationId: s.organizationId,
              rows: s.rows,
              confirms: s.confirms + 1,
              matching: s.matching,
              columns: s.columns,
              changes: e.change,
              confirmedAt: e.change,
              inForce: s.inForce + e.created,
              replaced: s.replaced + e.updated,
              standing: s.standing + 1,
              lastGroup: s.lastGroup,
              topGroup: s.topGroup,
              created: e.created,
              updated: e.updated,
              already: e.already,
              notImported: e.notImported
            })
          : s,
      // Taken back from its result it says so; taken back while it is open again it stays open.
      ImportTakenBack: (s, e) =>
        isOpen(s)
          ? { ...s, changes: e.change, confirmedAt: 0, inForce: e.kept, replaced: 0, standing: 0 }
          : isImported(s)
            ? ImportState.cases.TakenBack.make({
                status: "TakenBack",
                organizationId: s.organizationId,
                rows: s.rows,
                confirms: s.confirms,
                matching: s.matching,
                columns: s.columns,
                changes: e.change,
                confirmedAt: 0,
                inForce: e.kept,
                replaced: 0,
                standing: 0,
                lastGroup: s.lastGroup,
                topGroup: s.topGroup,
                removed: e.removed,
                kept: e.kept
              })
            : s,
      ImportReopened: (s, e) =>
        isImported(s) || isTakenBack(s)
          ? ImportState.cases.Open.make({
              status: "Open",
              organizationId: s.organizationId,
              rows: s.rows,
              confirms: s.confirms,
              matching: s.matching,
              columns: s.columns,
              changes: e.change,
              confirmedAt: s.confirmedAt,
              inForce: s.inForce,
              replaced: s.replaced,
              standing: s.standing,
              lastGroup: s.lastGroup,
              topGroup: s.topGroup,
              suggestions: 0
            })
          : s,
      ImportRemoved: (s) =>
        isOpen(s) ? ImportState.cases.Removed.make({ status: "Removed", organizationId: s.organizationId }) : s
    }
  },
  { description: "One import's lifecycle, which numbers every change of its review" }
) {}
