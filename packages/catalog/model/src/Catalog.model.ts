// The catalog's model, as far as it is built: the review of one import, with an act on a group of rows decided as one
// unit. The import's lifecycle, one instance per decided row, one per act on a group, the four decisions that record
// an act on the import and on a row or a group, and the rules that hold across them. Nothing is hosted and nothing is
// stored: the screens and the server run on D1 as before, and this model runs in memory under its stories and under
// Verify. The one thing not to break: a rule over every instance at once (a model invariant) is searched over short
// sequences and never proved, and a `sometimes` rule says only that one sequence gets there, so nothing here may be
// said to be proved of either.
import * as Domain from "@alchemy.run/domain"
import * as A from "effect/Array"
import { Group, GroupState, GroupEvent } from "./Group/Group.aggregate.ts"
import type { DecidedGroup } from "./Group/Group.aggregate.ts"
import { Import, ImportState, ImportEvent } from "./Import/Import.aggregate.ts"
import { Deciding } from "./Review/Deciding.decision.ts"
import { DecidingGroup } from "./Review/DecidingGroup.decision.ts"
import { Undoing } from "./Review/Undoing.decision.ts"
import { UndoingGroup } from "./Review/UndoingGroup.decision.ts"
import { RowState, Row, RowEvent } from "./Row/Row.aggregate.ts"
import { dual } from "effect/Function"

// What the invariants below are said in. An invariant of the model is searched, never proved: Verify runs it as it is
// written and does not read its code, so it may call these. A relation is proved, so the two relations call nothing.

/** One instance as an invariant sees it: its name and what it holds. */
type Held<State> = { readonly id: string; readonly state: State }

/** An import that was staged and not removed: the cases that number changes. */
type StagedImport = Exclude<ImportState, typeof ImportState.cases.Unstaged.Type | typeof ImportState.cases.Removed.Type>

/**
 * Whether an act on a group still gives its rows what it decided. `undoneAt` is the change that took the act back, and
 * 0 says none did: a change is numbered from 1. Every invariant asks it here, so the 0 is read in one place.
 */
const inForce = (group: DecidedGroup): boolean => group.undoneAt === 0

/** Two decisions recorded by the same change of the same import. */
const sameChangeOfOneImport = (
  a: { readonly importId: string; readonly change: number },
  b: { readonly importId: string; readonly change: number }
): boolean => a.importId === b.importId && a.change === b.change

/** No two instances that hold a decision are `alike`. An instance is never compared with itself. */
const noTwoHold = <State, Decided extends State>(
  held: ReadonlyArray<Held<State>>,
  decided: (state: State) => state is Decided,
  alike: (a: Decided, b: Decided) => boolean
): boolean =>
  A.every(held, (a) =>
    A.every(held, (b) => a.id === b.id || !decided(a.state) || !decided(b.state) || !alike(a.state, b.state))
  )

/** `holds` of every act on a group that was decided, in force or taken back. */
const everyDecidedGroup = (groups: ReadonlyArray<Held<GroupState>>, holds: (group: DecidedGroup) => boolean): boolean =>
  A.every(groups, (group) => !GroupState.guards.Decided(group.state) || holds(group.state))

/**
 * `holds` of every decided act on a group, beside the import it was recorded on. A removed import is asked nothing:
 * what it numbered is gone. An import not yet staged has no act on a group, so one found there breaks the rule.
 */
const everyGroupOfItsImport: {
  (
    all: { readonly Group: ReadonlyArray<Held<GroupState>>; readonly Import: ReadonlyArray<Held<ImportState>> },
    holds: (group: DecidedGroup, life: StagedImport) => boolean
  ): boolean
  (
    holds: (group: DecidedGroup, life: StagedImport) => boolean
  ): (all: {
    readonly Group: ReadonlyArray<Held<GroupState>>
    readonly Import: ReadonlyArray<Held<ImportState>>
  }) => boolean
} = dual(
  2,
  (
    all: { readonly Group: ReadonlyArray<Held<GroupState>>; readonly Import: ReadonlyArray<Held<ImportState>> },
    holds: (group: DecidedGroup, life: StagedImport) => boolean
  ): boolean =>
    everyDecidedGroup(all.Group, (group) =>
      A.every(
        all.Import,
        (life) =>
          group.importId !== life.id ||
          ImportState.guards.Removed(life.state) ||
          (!ImportState.guards.Unstaged(life.state) && holds(group, life.state))
      )
    )
)

/**
 * `holds` of every row an act has reached, beside the import it belongs to. A removed import is asked nothing, as for
 * a group; an import not yet staged has no row, so one found there breaks the rule.
 */
const everyRowOfItsImport: {
  (
    all: { readonly Row: ReadonlyArray<Held<RowState>>; readonly Import: ReadonlyArray<Held<ImportState>> },
    holds: (row: ReachedRow, life: StagedImport) => boolean
  ): boolean
  (
    holds: (row: ReachedRow, life: StagedImport) => boolean
  ): (all: {
    readonly Row: ReadonlyArray<Held<RowState>>
    readonly Import: ReadonlyArray<Held<ImportState>>
  }) => boolean
} = dual(
  2,
  (
    all: { readonly Row: ReadonlyArray<Held<RowState>>; readonly Import: ReadonlyArray<Held<ImportState>> },
    holds: (row: ReachedRow, life: StagedImport) => boolean
  ): boolean => {
    const besideItsImport = (row: ReachedRow): boolean =>
      A.every(
        all.Import,
        (life) =>
          row.importId !== life.id ||
          ImportState.guards.Removed(life.state) ||
          (!ImportState.guards.Unstaged(life.state) && holds(row, life.state))
      )
    return A.every(all.Row, (row) => RowState.guards.Untouched(row.state) || besideItsImport(row.state))
  }
)

/** A row an act has reached: it names its import. */
type ReachedRow = Exclude<RowState, typeof RowState.cases.Untouched.Type>

/** The catalog's model: today, the review of an import. */
export class Catalog extends Domain.Model(
  "Catalog",
  {
    aggregates: [Import, Row, Group],
    decisions: [Deciding, Undoing, DecidingGroup, UndoingGroup],
    relations: {
      // A row that was decided belongs to the organization of its import.
      ARowBelongsToItsImportsOrganization: Domain.Relation({
        over: { life: Import, row: Row },
        holds: ({ life, row }) =>
          RowState.guards.Untouched(row.state) ||
          row.state.importId !== life.id ||
          (!ImportState.guards.Unstaged(life.state) && row.state.organizationId === life.state.organizationId)
      }),
      // And so does an act on a group.
      AGroupBelongsToItsImportsOrganization: Domain.Relation({
        over: { life: Import, group: Group },
        holds: ({ life, group }) =>
          GroupState.guards.Untouched(group.state) ||
          group.state.importId !== life.id ||
          (!ImportState.guards.Unstaged(life.state) && group.state.organizationId === life.state.organizationId)
      })
    },
    invariants: {
      // No two rows of one import ever hold a decision of the same change.
      NoTwoRowsHoldTheSameChange: (all) => noTwoHold(all.Row, RowState.guards.Decided, sameChangeOfOneImport),
      // Nor a row and an act on a group, by the change that decided the group or the one that took it back.
      NoRowAndGroupHoldTheSameChange: (all) =>
        A.every(all.Row, (row) =>
          everyDecidedGroup(
            all.Group,
            (group) =>
              !RowState.guards.Decided(row.state) ||
              row.state.importId !== group.importId ||
              (row.state.change !== group.change && row.state.change !== group.undoneAt)
          )
        ),
      // Nor two acts on a group.
      NoTwoGroupsHoldTheSameChange: (all) => noTwoHold(all.Group, GroupState.guards.Decided, sameChangeOfOneImport),
      // An act on a group was recorded, and taken back, by changes its import gave.
      AGroupsChangeIsOneItsImportGave: (all) =>
        everyGroupOfItsImport(
          all,
          (group, life) => group.change >= 1 && group.change <= life.changes && group.undoneAt <= life.changes
        ),
      // A row's decision, and the change its last undo took back, are changes its import gave. A row that took no
      // undo holds 0 there, so that half is bounded below by 0, not 1: a negative one is refused all the same
      // (Benjamin, 2026-11-26, from CodeRabbit's finding on pull request 32).
      ARowsChangeIsOneItsImportGave: (all) =>
        everyRowOfItsImport(
          all,
          (row, life) =>
            row.undone.change >= 0 &&
            row.undone.change <= life.changes &&
            (!RowState.guards.Decided(row) || (row.change >= 1 && row.change <= life.changes))
        ),
      // A group is taken back by a later change than the one that decided it.
      AGroupsUndoComesAfterIt: (all) =>
        everyDecidedGroup(all.Group, (group) => inForce(group) || group.undoneAt > group.change),
      // The group an import holds as its last in force is in force.
      TheLastGroupInForceIsInForce: (all) =>
        everyGroupOfItsImport(all, (group, life) => group.change !== life.topGroup || inForce(group)),
      // And no group in force is later than it: the one an import holds as its last in force is the last.
      NoGroupInForceIsLaterThanTheLastInForce: (all) =>
        everyGroupOfItsImport(all, (group, life) => !inForce(group) || group.change <= life.topGroup),
      // No act on a group of an import is later than the one the import holds as its last.
      NoGroupActIsLaterThanTheImportsLast: (all) =>
        everyGroupOfItsImport(all, (group, life) => group.change <= life.lastGroup && group.undoneAt <= life.lastGroup)
    },
    // Each command can be taken: some sequence of commands, from a model with nothing in it, records its event. A
    // change that made the model refuse a command shows here as "never reached". It is a search, and it says nothing
    // of any other sequence: that a valid act is taken is what the stories hold (Benjamin, 2026-11-22: "Yes, one per
    // command").
    sometimes: {
      AnImportCanBeStaged: (all) => A.some(all.Import, (life) => A.some(life.events, ImportEvent.guards.ImportStaged)),
      AColumnCanBeMatched: (all) => A.some(all.Import, (life) => A.some(life.events, ImportEvent.guards.ColumnMatched)),
      ASuggestionCanBeRecorded: (all) =>
        A.some(all.Import, (life) => A.some(life.events, ImportEvent.guards.SuggestionRecorded)),
      AnImportCanBeConfirmed: (all) =>
        A.some(all.Import, (life) => A.some(life.events, ImportEvent.guards.ImportConfirmed)),
      AnImportCanBeTakenBack: (all) =>
        A.some(all.Import, (life) => A.some(life.events, ImportEvent.guards.ImportTakenBack)),
      AnImportCanBeReopened: (all) =>
        A.some(all.Import, (life) => A.some(life.events, ImportEvent.guards.ImportReopened)),
      AnImportCanBeRemoved: (all) =>
        A.some(all.Import, (life) => A.some(life.events, ImportEvent.guards.ImportRemoved)),
      ARowCanBeDecided: (all) => A.some(all.Row, (row) => A.some(row.events, RowEvent.guards.RowDecided)),
      ARowsDecisionCanBeUndone: (all) => A.some(all.Row, (row) => A.some(row.events, RowEvent.guards.StepUndone)),
      AGroupCanBeDecided: (all) => A.some(all.Group, (group) => A.some(group.events, GroupEvent.guards.GroupDecided)),
      AGroupCanBeUndone: (all) => A.some(all.Group, (group) => A.some(group.events, GroupEvent.guards.GroupUndone))
    }
  },
  { description: "The catalog: the review of an import, its rows, the acts on groups of them, and the acts on each" }
) {}
