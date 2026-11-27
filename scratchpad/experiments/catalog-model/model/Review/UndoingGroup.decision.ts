// The undo of one act on a group of rows, decided across the import and the group: one act too, whatever the number of
// rows. Only its maker takes it back, once, and only while it is the last group still in force (Benjamin, 2026-11-22:
// "Only the last group act"): a later group was drawn on a screen that had this one. Taking the last one back makes
// the one that was under it the last in force again, so the groups are taken back in the order they were laid, one by
// one. It does not reach past a confirm that stands, nor into another opening of the import, and it is taken only from
// a screen that has every change of the import: a row decided since on a screen the sender has not received keeps
// that person's whole decision when the group goes, and the sender is shown it first (2026-11-22, by the rule on a
// press from a screen that is behind). The one thing not to break: every check in `UndoGroup.decide`
// (`UndoGroup.command.ts`) that refuses an undo has its rule in `UndoingGroup.transition.ts`.
import * as Domain from "@alchemy.run/domain"
import { Group } from "../Group/Group.aggregate.ts"
import { Import } from "../Import/Import.aggregate.ts"
import * as UndoGroup from "./UndoGroup.command.ts"
import {
  AGroupIsTakenBackOnce,
  AGroupsUndoDoesNotReachPastAConfirm,
  AGroupsUndoIsMadeOnEveryChange,
  AGroupsUndoIsOfAGroupOfTheImportItNames,
  AGroupsUndoIsOfThisOpening,
  AGroupsUndoIsOneChange,
  AGroupsUndoTakesBackOnlyItsSendersOwn,
  AndTheGroupSaysWhen,
  AViewerChangesNoGroup,
  NobodyUndoesAnotherPersonsGroup,
  OnlyItsOwnOrganizationChangesTheGroup,
  OnlyTheLastGroupInForceIsTakenBack,
  TheImportHoldsItAsItsLastGroupAct,
  TheImportsEventSaysHowManyRows,
  ThenTheOneUnderItIsTheLastInForce
} from "./UndoingGroup.transition.ts"

/**
 * **Details**
 *
 * It reads the import and the group the command names. The group's instance is keyed by the import's id and the step,
 * as `<importId>/<step>`.
 *
 * @category decisions
 * @since 0.0.0
 */
export class UndoingGroup extends Domain.Decision(
  UndoGroup.Command,
  {
    reads: { life: Import, group: Group },
    keyOf: (cmd: UndoGroup.Command) => ({ life: cmd.importId, group: `${cmd.importId}/${cmd.step}` }),
    decide: UndoGroup.decide,
    transitions: {
      AGroupsUndoTakesBackOnlyItsSendersOwn,
      AGroupsUndoIsOfThisOpening,
      AGroupsUndoIsOfAGroupOfTheImportItNames,
      OnlyTheLastGroupInForceIsTakenBack,
      ThenTheOneUnderItIsTheLastInForce,
      AGroupsUndoIsMadeOnEveryChange,
      AGroupIsTakenBackOnce,
      AGroupsUndoDoesNotReachPastAConfirm,
      AGroupsUndoIsOneChange,
      AndTheGroupSaysWhen,
      TheImportHoldsItAsItsLastGroupAct,
      TheImportsEventSaysHowManyRows,
      NobodyUndoesAnotherPersonsGroup,
      OnlyItsOwnOrganizationChangesTheGroup,
      AViewerChangesNoGroup
    }
  },
  { description: "The undo of one act on a group of rows, recorded on the import and on the group, or on neither" }
) {}
