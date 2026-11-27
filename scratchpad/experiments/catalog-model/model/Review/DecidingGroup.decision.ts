// One act on a group of rows, decided across the import and the group it names, and recorded on both or on neither:
// one command, whatever the number of rows (Benjamin, 2026-11-22: "One unit per group"). It is taken only from a
// screen that has every change of the import, so the rows it names are the ones the act fits now. It becomes the last
// group in force and keeps which one was before it, so that its undo can put that one back as the last. The one thing
// not to break: every check here that refuses an act has its rule below, so a check that is removed breaks a named
// rule under Verify.
import * as Domain from "@alchemy.run/domain"
import { Group } from "../Group/Group.aggregate.ts"
import { Import } from "../Import/Import.aggregate.ts"
import * as DecideGroup from "./DecideGroup.command.ts"
import {
  AGroupDecidedIsTheLastInForce,
  AGroupIsDecidedOnlyOnAnOpenImport,
  AGroupIsMadeOnEveryChange,
  AGroupIsMadeOnTheMatchingNow,
  AGroupIsOfThisOpening,
  AGroupIsOneChange,
  AGroupIsRecorded,
  AndKeepsWhichOneWasBeforeIt,
  AsItsSenders,
  AStepDecidesOneGroup,
  AViewerChangesNoGroup,
  InForce,
  OnItsMatching,
  OnlyItsOwnOrganizationChangesTheGroup,
  OnTheGroupToo,
  TheImportHoldsItAsItsLastGroupAct,
  TheImportsEventSaysHowManyRows,
  WithEveryRowItNames,
  WithItsCount,
  WithWhatItDoes
} from "./DecidingGroup.transition.ts"

/**
 * **Details**
 *
 * It reads the import and the group the command names. The group's instance is keyed by the import's id and the step,
 * as `<importId>/<step>`, so a step names one group.
 *
 * @category decisions
 * @since 0.0.0
 */
export class DecidingGroup extends Domain.Decision(
  DecideGroup.Command,
  {
    reads: { life: Import, group: Group },
    keyOf: (cmd: DecideGroup.Command) => ({ life: cmd.importId, group: `${cmd.importId}/${cmd.step}` }),
    decide: DecideGroup.decide,
    transitions: {
      AGroupIsDecidedOnlyOnAnOpenImport,
      AGroupIsOfThisOpening,
      AGroupIsMadeOnEveryChange,
      AGroupIsMadeOnTheMatchingNow,
      AStepDecidesOneGroup,
      AGroupIsRecorded,
      WithEveryRowItNames,
      WithWhatItDoes,
      WithItsCount,
      OnItsMatching,
      InForce,
      AsItsSenders,
      AGroupIsOneChange,
      OnTheGroupToo,
      TheImportHoldsItAsItsLastGroupAct,
      AGroupDecidedIsTheLastInForce,
      AndKeepsWhichOneWasBeforeIt,
      TheImportsEventSaysHowManyRows,
      OnlyItsOwnOrganizationChangesTheGroup,
      AViewerChangesNoGroup
    }
  },
  { description: "One act on a group of rows, recorded on the import and on the group, or on neither" }
) {}
