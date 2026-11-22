// The catalog's model, as far as it is built: the review of one import, with an act on a group of rows decided as one
// unit. The import's lifecycle, one instance per decided row, one per act on a group, the four decisions that record
// an act on the import and on a row or a group, and the rules that hold across them. Nothing is hosted and nothing is
// stored: the screens and the server run on D1 as before, and this model runs in memory under its stories and under
// Verify. The one thing not to break: a rule over every instance at once (a model invariant) is searched over short
// sequences and never proved, and a `sometimes` rule says only that one sequence gets there, so nothing here may be
// said to be proved of either.
import * as Domain from "@alchemy.run/domain"
import * as A from "effect/Array"
import * as Match from "effect/Match"
import {
  Group,
  type GroupDecided,
  type GroupUndone,
  isDecidedGroup,
  isUntouchedGroup
} from "./Group/Group.aggregate.ts"
import { Import, type ImportEvent, isRemoved, isUnstaged } from "./Import/Import.aggregate.ts"
import { Deciding } from "./Review/Deciding.decision.ts"
import { DecidingGroup } from "./Review/DecidingGroup.decision.ts"
import { Undoing } from "./Review/Undoing.decision.ts"
import { UndoingGroup } from "./Review/UndoingGroup.decision.ts"
import { isDecided, isUntouched, Row, type RowDecided, type StepUndone } from "./Row/Row.aggregate.ts"

const yes = (): boolean => true
const no = (): boolean => false
type RowEvent = RowDecided | StepUndone
type GroupEvent = GroupDecided | GroupUndone
// One guard for each event that says a command was taken: a `sometimes` rule looks for it among what an instance
// recorded.
const isStaged = (e: ImportEvent): boolean => Match.value(e).pipe(Match.tag("ImportStaged", yes), Match.orElse(no))
const isMatched = (e: ImportEvent): boolean => Match.value(e).pipe(Match.tag("ColumnMatched", yes), Match.orElse(no))
const isSuggested = (e: ImportEvent): boolean =>
  Match.value(e).pipe(Match.tag("SuggestionRecorded", yes), Match.orElse(no))
const isConfirmed = (e: ImportEvent): boolean =>
  Match.value(e).pipe(Match.tag("ImportConfirmed", yes), Match.orElse(no))
const isTakenBack = (e: ImportEvent): boolean =>
  Match.value(e).pipe(Match.tag("ImportTakenBack", yes), Match.orElse(no))
const isReopened = (e: ImportEvent): boolean => Match.value(e).pipe(Match.tag("ImportReopened", yes), Match.orElse(no))
const isRemovedEvent = (e: ImportEvent): boolean =>
  Match.value(e).pipe(Match.tag("ImportRemoved", yes), Match.orElse(no))
const isRowDecided = (e: RowEvent): boolean => Match.value(e).pipe(Match.tag("RowDecided", yes), Match.orElse(no))
const isStepUndone = (e: RowEvent): boolean => Match.value(e).pipe(Match.tag("StepUndone", yes), Match.orElse(no))
const isGroupDecided = (e: GroupEvent): boolean => Match.value(e).pipe(Match.tag("GroupDecided", yes), Match.orElse(no))
const isGroupUndone = (e: GroupEvent): boolean => Match.value(e).pipe(Match.tag("GroupUndone", yes), Match.orElse(no))

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
          isUntouched(row.state) ||
          row.state.importId !== life.id ||
          (!isUnstaged(life.state) && row.state.organizationId === life.state.organizationId)
      }),
      // And so does an act on a group.
      AGroupBelongsToItsImportsOrganization: Domain.Relation({
        over: { life: Import, group: Group },
        holds: ({ life, group }) =>
          isUntouchedGroup(group.state) ||
          group.state.importId !== life.id ||
          (!isUnstaged(life.state) && group.state.organizationId === life.state.organizationId)
      })
    },
    invariants: {
      // No two rows of one import ever hold a decision of the same change.
      NoTwoRowsHoldTheSameChange: (all) =>
        A.every(all.Row, (a) =>
          A.every(
            all.Row,
            (b) =>
              a.id === b.id ||
              !isDecided(a.state) ||
              !isDecided(b.state) ||
              a.state.importId !== b.state.importId ||
              a.state.change !== b.state.change
          )
        ),
      // Nor a row and an act on a group, by the change that decided the group or the one that took it back.
      NoRowAndGroupHoldTheSameChange: (all) =>
        A.every(all.Row, (row) =>
          A.every(
            all.Group,
            (group) =>
              !isDecided(row.state) ||
              !isDecidedGroup(group.state) ||
              row.state.importId !== group.state.importId ||
              (row.state.change !== group.state.change && row.state.change !== group.state.undoneAt)
          )
        ),
      NoTwoGroupsHoldTheSameChange: (all) =>
        A.every(all.Group, (a) =>
          A.every(
            all.Group,
            (b) =>
              a.id === b.id ||
              !isDecidedGroup(a.state) ||
              !isDecidedGroup(b.state) ||
              a.state.importId !== b.state.importId ||
              a.state.change !== b.state.change
          )
        ),
      // An act on a group was recorded, and taken back, by changes its import gave.
      AGroupsChangeIsOneItsImportGave: (all) =>
        A.every(all.Group, (group) =>
          A.every(
            all.Import,
            (life) =>
              !isDecidedGroup(group.state) ||
              group.state.importId !== life.id ||
              isRemoved(life.state) ||
              (!isUnstaged(life.state) && group.state.change >= 1 && group.state.undoneAt <= life.state.changes)
          )
        ),
      AGroupsUndoComesAfterIt: (all) =>
        A.every(
          all.Group,
          (group) =>
            !isDecidedGroup(group.state) || group.state.undoneAt === 0 || group.state.undoneAt > group.state.change
        ),
      // The group an import holds as its last in force is in force.
      TheLastGroupInForceIsInForce: (all) =>
        A.every(all.Group, (group) =>
          A.every(
            all.Import,
            (life) =>
              !isDecidedGroup(group.state) ||
              group.state.importId !== life.id ||
              isRemoved(life.state) ||
              isUnstaged(life.state) ||
              group.state.change !== life.state.topGroup ||
              group.state.undoneAt === 0
          )
        ),
      // No act on a group of an import is later than the one the import holds as its last.
      NoGroupActIsLaterThanTheImportsLast: (all) =>
        A.every(all.Group, (group) =>
          A.every(
            all.Import,
            (life) =>
              !isDecidedGroup(group.state) ||
              group.state.importId !== life.id ||
              isRemoved(life.state) ||
              isUnstaged(life.state) ||
              (group.state.change <= life.state.lastGroup && group.state.undoneAt <= life.state.lastGroup)
          )
        )
    },
    // Each command can be taken: some sequence of commands, from a model with nothing in it, records its event. A
    // change that made the model refuse a command shows here as "never reached". It is a search, and it says nothing
    // of any other sequence: that a valid act is taken is what the stories hold (Benjamin, 2026-11-22: "Yes, one per
    // command").
    sometimes: {
      AnImportCanBeStaged: (all) => A.some(all.Import, (life) => A.some(life.events, isStaged)),
      AColumnCanBeMatched: (all) => A.some(all.Import, (life) => A.some(life.events, isMatched)),
      ASuggestionCanBeRecorded: (all) => A.some(all.Import, (life) => A.some(life.events, isSuggested)),
      AnImportCanBeConfirmed: (all) => A.some(all.Import, (life) => A.some(life.events, isConfirmed)),
      AnImportCanBeTakenBack: (all) => A.some(all.Import, (life) => A.some(life.events, isTakenBack)),
      AnImportCanBeReopened: (all) => A.some(all.Import, (life) => A.some(life.events, isReopened)),
      AnImportCanBeRemoved: (all) => A.some(all.Import, (life) => A.some(life.events, isRemovedEvent)),
      ARowCanBeDecided: (all) => A.some(all.Row, (row) => A.some(row.events, isRowDecided)),
      ARowsDecisionCanBeUndone: (all) => A.some(all.Row, (row) => A.some(row.events, isStepUndone)),
      AGroupCanBeDecided: (all) => A.some(all.Group, (group) => A.some(group.events, isGroupDecided)),
      AGroupCanBeUndone: (all) => A.some(all.Group, (group) => A.some(group.events, isGroupUndone))
    }
  },
  { description: "The catalog: the review of an import, its rows, the acts on groups of them, and the acts on each" }
) {}

/**
 * Every command of the model, for its stories and for Verify's search. What a browser and what the server may send
 * are separate Apis, declared when the model is hosted.
 */
export class CatalogApi extends Domain.Api(
  "CatalogApi",
  { model: Catalog },
  { description: "Every command of the catalog's model, for its stories and its search" }
) {}
