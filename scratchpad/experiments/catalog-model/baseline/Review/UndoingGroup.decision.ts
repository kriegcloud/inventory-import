// The undo of one act on a group of rows, decided across the import and the group: one act too, whatever the number of
// rows. Only its maker takes it back, once, and only while it is the last group still in force (Benjamin, 2026-11-22:
// "Only the last group act"): a later group was drawn on a screen that had this one. Taking the last one back makes
// the one that was under it the last in force again, so the groups are taken back in the order they were laid, one by
// one. It does not reach past a confirm that stands, nor into another opening of the import, and it is taken only from
// a screen that has every change of the import: a row decided since on a screen the sender has not received keeps
// that person's whole decision when the group goes, and the sender is shown it first (2026-11-22, by the rule on a
// press from a screen that is behind). The one thing not to break: every check here that refuses an undo has its
// rule below.
import * as Domain from "@alchemy.run/domain"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as S from "effect/Schema"
import { CurrentActor } from "../Actor/Actor.context.ts"
import { Session } from "../Actor/Session.middleware.ts"
import { Group, GroupUndone, GroupState } from "../Group/Group.aggregate.ts"
import {
  ConfirmedSince,
  GroupCounted,
  Import,
  ImportState,
  NotOpen,
  NotPermitted,
  ReviewMovedOn,
  ImportEvent
} from "../Import/Import.aggregate.ts"
import { Change, ImportKey, Step } from "./Change.schema.ts"
import { GroupedAfter } from "./Deciding.decision.ts"
import { DecidedBeforeTheConfirm, NotYourStep } from "./Undoing.decision.ts"

/**
 * Take back one act on a group. `step` names the group; `undo` is the change that recorded it; `opening` is how many
 * times the import had been confirmed when the undo was made; `seen`: the screen has received every change of the
 * import up to this number, as a group's act says.
 */
export class UndoGroup extends Domain.Command(
  "UndoGroup",
  {
    middleware: [Session],
    input: { importId: ImportKey, step: Step, undo: Change, opening: S.Int, seen: Change },
    events: [GroupUndone, GroupCounted],
    rejects: [NotOpen, NotPermitted, ConfirmedSince, NotYourStep, DecidedBeforeTheConfirm, GroupedAfter, ReviewMovedOn]
  },
  { description: "Take back the sender's own act on a group of rows, while it is the last group in force" }
) {}

/** The undo of one act on a group: read from the import and the group, recorded on both or on neither. */
export class UndoingGroup extends Domain.Decision(
  UndoGroup,
  {
    reads: { life: Import, group: Group },
    keyOf: (cmd: UndoGroup) => ({ life: cmd.importId, group: `${cmd.importId}/${cmd.step}` }),
    decide: Effect.fn("UndoingGroup.decide")(function* ({ life, group }, cmd) {
      const actor = yield* CurrentActor
      if (!ImportState.guards.Open(life.state)) return yield* NotOpen.make({})
      if (actor.organizationId !== life.state.organizationId || actor.role === "viewer") {
        return yield* NotPermitted.make({})
      }
      if (cmd.opening !== life.state.confirms) return yield* ConfirmedSince.make({})
      if (!GroupState.guards.Decided(group.state)) return yield* NotYourStep.make({})
      // A group instance belongs to one import of one organization, for good.
      if (group.state.importId !== cmd.importId || group.state.organizationId !== life.state.organizationId) {
        return yield* NotPermitted.make({})
      }
      if (group.state.by !== actor.memberId || group.state.change !== cmd.undo || group.state.undoneAt !== 0) {
        return yield* NotYourStep.make({})
      }
      // What a standing confirm wrote is taken back with the import, not here.
      if (group.state.change <= life.state.confirmedAt) return yield* DecidedBeforeTheConfirm.make({})
      // A later group is still in force: what that one did was drawn on a screen that had this one. Once it is taken
      // back, this one is the last in force again.
      if (group.state.change !== life.state.topGroup) return yield* GroupedAfter.make({ last: life.state.topGroup })
      // The sender's screen has not received every change. The model keeps no reading of a group's rows, so it cannot
      // say whether what landed since is on one of them: a row another person decided since keeps that whole decision
      // when the group goes, and the sender would learn it only after. Refused with the import's last change and
      // held, as a group's act is; taken once the screen has it.
      if (cmd.seen !== life.state.changes) return yield* ReviewMovedOn.make({ last: life.state.changes })
      const change = life.state.changes + 1
      return [
        group.record(GroupUndone.make({ change })),
        life.record(
          GroupCounted.make({
            change,
            step: cmd.step,
            rows: group.state.count,
            label: "undo",
            by: actor.memberId,
            top: group.state.under
          })
        )
      ]
    }),
    transitions: {
      AGroupsUndoTakesBackOnlyItsSendersOwn: Effect.fn("UndoingGroup.AGroupsUndoTakesBackOnlyItsSendersOwn")(
        function* ({ before, command }) {
          if (!ImportState.guards.Open(before.life) || !GroupState.guards.Decided(before.group)) return false
          const actor = yield* CurrentActor
          return before.group.change === command.undo && actor.memberId === before.group.by
        }
      ),
      AGroupsUndoIsOfThisOpening: ({ before, command }) =>
        ImportState.guards.Open(before.life) && command.opening === before.life.confirms,
      // It is an undo of a group of the import it names: the group's key is built from the import's id and the step,
      // and two pairs can build the same key.
      AGroupsUndoIsOfAGroupOfTheImportItNames: ({ before, command }) =>
        GroupState.guards.Decided(before.group) && before.group.importId === command.importId,
      // Only the last group still in force is taken back; then the one that was under it is the last in force.
      OnlyTheLastGroupInForceIsTakenBack: ({ before }) =>
        ImportState.guards.Open(before.life) &&
        GroupState.guards.Decided(before.group) &&
        before.group.change === before.life.topGroup,
      ThenTheOneUnderItIsTheLastInForce: ({ before, after }) =>
        !GroupState.guards.Decided(before.group) ||
        !ImportState.guards.Open(after.life) ||
        after.life.topGroup === before.group.under,
      // And only from a screen that has every change of the import, as a group is made on one.
      AGroupsUndoIsMadeOnEveryChange: ({ before, command }) =>
        ImportState.guards.Open(before.life) && command.seen === before.life.changes,
      AGroupIsTakenBackOnce: ({ before }) => GroupState.guards.Decided(before.group) && before.group.undoneAt === 0,
      AGroupsUndoDoesNotReachPastAConfirm: ({ before }) =>
        ImportState.guards.Open(before.life) &&
        GroupState.guards.Decided(before.group) &&
        before.group.change > before.life.confirmedAt,
      // It is one change, whatever the number of rows, and the group says when.
      AGroupsUndoIsOneChange: ({ before, after }) =>
        ImportState.guards.Open(before.life) &&
        ImportState.guards.Open(after.life) &&
        after.life.changes === before.life.changes + 1,
      AndTheGroupSaysWhen: ({ after }) =>
        !ImportState.guards.Open(after.life) ||
        !GroupState.guards.Decided(after.group) ||
        after.group.undoneAt === after.life.changes,
      TheImportHoldsItAsItsLastGroupAct: ({ after }) =>
        !ImportState.guards.Open(after.life) || after.life.lastGroup === after.life.changes,
      TheImportsEventSaysHowManyRows: ({ before, events }) =>
        A.every(
          events,
          (e) =>
            !ImportEvent.guards.GroupCounted(e) ||
            !GroupState.guards.Decided(before.group) ||
            e.rows === before.group.count
        ),
      // Who may change a group. The group has no command of its own, so these are rules of the decisions that record
      // on it: only its maker takes it back, only its own organization changes it, and a viewer changes none.
      NobodyUndoesAnotherPersonsGroup: Effect.fn("UndoingGroup.NobodyUndoesAnotherPersonsGroup")(function* ({
        before,
        after
      }) {
        if (
          !GroupState.guards.Decided(before.group) ||
          !GroupState.guards.Decided(after.group) ||
          after.group.undoneAt === before.group.undoneAt
        ) {
          return true
        }
        const actor = yield* CurrentActor
        return actor.memberId === before.group.by
      }),
      OnlyItsOwnOrganizationChangesTheGroup: Effect.fn("UndoingGroup.OnlyItsOwnOrganizationChangesTheGroup")(
        function* ({ before }) {
          if (GroupState.guards.Untouched(before.group)) return true
          const actor = yield* CurrentActor
          return actor.organizationId === before.group.organizationId
        }
      ),
      AViewerChangesNoGroup: Effect.fn("UndoingGroup.AViewerChangesNoGroup")(function* () {
        const actor = yield* CurrentActor
        return actor.role !== "viewer"
      })
    }
  },
  { description: "The undo of one act on a group of rows, recorded on the import and on the group, or on neither" }
) {}
