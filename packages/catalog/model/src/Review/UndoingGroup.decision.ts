// @effect-diagnostics newSchemaClass:off
// The undo of one act on a group of rows, decided across the import and the group: one act too, whatever the number of
// rows. Only its maker takes it back, once, and only while it is the last group still in force (Benjamin, 2026-11-22:
// "Only the last group act"): a later group was drawn on a screen that had this one. Taking the last one back makes
// the one that was under it the last in force again, so the groups are taken back in the order they were laid, one by
// one. It does not reach past a confirm that stands, nor into another opening of the import. The one thing not to
// break: every check here that refuses an undo has its rule below.
import * as Domain from "@alchemy.run/domain"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as Match from "effect/Match"
import * as S from "effect/Schema"
import { CurrentActor, Session } from "../Actor/Actor.context.ts"
import { Group, GroupUndone, isDecidedGroup, isUntouchedGroup } from "../Group/Group.aggregate.ts"
import { ConfirmedSince, GroupCounted, Import, isOpen, NotOpen, NotPermitted } from "../Import/Import.aggregate.ts"
import { Change, ImportKey, Step } from "./Change.schema.ts"
import { DecidedBeforeTheConfirm, NotYourStep } from "./Undoing.decision.ts"

/** A later group is still in force over this one: its number. Take that one back first. */
export class GroupedAfter extends Domain.Rejection(
  "GroupedAfter",
  { last: Change },
  { description: "A later act on a group is still in force over this one: its number" }
) {}

/**
 * Take back one act on a group. `step` names the group; `undo` is the change that recorded it; `opening` is how many
 * times the import had been confirmed when the undo was made.
 */
export class UndoGroup extends Domain.Command(
  "UndoGroup",
  {
    middleware: [Session],
    input: { importId: ImportKey, step: Step, undo: Change, opening: S.Int },
    events: [GroupUndone, GroupCounted],
    rejects: [NotOpen, NotPermitted, ConfirmedSince, NotYourStep, DecidedBeforeTheConfirm, GroupedAfter]
  },
  { description: "Take back the sender's own act on a group of rows, while it is the last group in force" }
) {}

type UndoingGroupEvent = GroupUndone | GroupCounted
const yes = (): boolean => true
const no = (): boolean => false
const isGroupCounted = (event: UndoingGroupEvent): event is GroupCounted =>
  Match.value(event).pipe(Match.tag("GroupCounted", yes), Match.orElse(no))

/** The undo of one act on a group: read from the import and the group, recorded on both or on neither. */
export class UndoingGroup extends Domain.Decision(
  UndoGroup,
  {
    reads: { life: Import, group: Group },
    keyOf: (cmd: UndoGroup) => ({ life: cmd.importId, group: `${cmd.importId}/${cmd.step}` }),
    decide: Effect.fn("UndoingGroup.decide")(function* ({ life, group }, cmd) {
      const actor = yield* CurrentActor
      if (!isOpen(life.state)) return yield* new NotOpen({})
      if (actor.organizationId !== life.state.organizationId || actor.role === "viewer") {
        return yield* new NotPermitted({})
      }
      if (cmd.opening !== life.state.confirms) return yield* new ConfirmedSince({})
      if (!isDecidedGroup(group.state)) return yield* new NotYourStep({})
      // A group instance belongs to one import of one organization, for good.
      if (group.state.importId !== cmd.importId || group.state.organizationId !== life.state.organizationId) {
        return yield* new NotPermitted({})
      }
      if (group.state.by !== actor.memberId || group.state.change !== cmd.undo || group.state.undoneAt !== 0) {
        return yield* new NotYourStep({})
      }
      // What a standing confirm wrote is taken back with the import, not here.
      if (group.state.change <= life.state.confirmedAt) return yield* new DecidedBeforeTheConfirm({})
      // A later group is still in force: what that one did was drawn on a screen that had this one. Once it is taken
      // back, this one is the last in force again.
      if (group.state.change !== life.state.topGroup) return yield* new GroupedAfter({ last: life.state.topGroup })
      const change = life.state.changes + 1
      return [
        group.record(new GroupUndone({ change })),
        life.record(
          new GroupCounted({
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
          if (!isOpen(before.life) || !isDecidedGroup(before.group)) return false
          const actor = yield* CurrentActor
          return before.group.change === command.undo && actor.memberId === before.group.by
        }
      ),
      AGroupsUndoIsOfThisOpening: ({ before, command }) =>
        isOpen(before.life) && command.opening === before.life.confirms,
      // Only the last group still in force is taken back; then the one that was under it is the last in force.
      OnlyTheLastGroupInForceIsTakenBack: ({ before }) =>
        isOpen(before.life) && isDecidedGroup(before.group) && before.group.change === before.life.topGroup,
      ThenTheOneUnderItIsTheLastInForce: ({ before, after }) =>
        !isDecidedGroup(before.group) || !isOpen(after.life) || after.life.topGroup === before.group.under,
      AGroupIsTakenBackOnce: ({ before }) => isDecidedGroup(before.group) && before.group.undoneAt === 0,
      AGroupsUndoDoesNotReachPastAConfirm: ({ before }) =>
        isOpen(before.life) && isDecidedGroup(before.group) && before.group.change > before.life.confirmedAt,
      // It is one change, whatever the number of rows, and the group says when.
      AGroupsUndoIsOneChange: ({ before, after }) =>
        isOpen(before.life) && isOpen(after.life) && after.life.changes === before.life.changes + 1,
      AndTheGroupSaysWhen: ({ after }) =>
        !isOpen(after.life) || !isDecidedGroup(after.group) || after.group.undoneAt === after.life.changes,
      TheImportHoldsItAsItsLastGroupAct: ({ after }) =>
        !isOpen(after.life) || after.life.lastGroup === after.life.changes,
      TheImportsEventSaysHowManyRows: ({ before, events }) =>
        A.every(events, (e) => !isGroupCounted(e) || !isDecidedGroup(before.group) || e.rows === before.group.count),
      // Who may change a group. The group has no command of its own, so these are rules of the decisions that record
      // on it: only its maker takes it back, only its own organization changes it, and a viewer changes none.
      NobodyUndoesAnotherPersonsGroup: Effect.fn("UndoingGroup.NobodyUndoesAnotherPersonsGroup")(function* ({
        before,
        after
      }) {
        if (
          !isDecidedGroup(before.group) ||
          !isDecidedGroup(after.group) ||
          after.group.undoneAt === before.group.undoneAt
        ) {
          return true
        }
        const actor = yield* CurrentActor
        return actor.memberId === before.group.by
      }),
      OnlyItsOwnOrganizationChangesTheGroup: Effect.fn("UndoingGroup.OnlyItsOwnOrganizationChangesTheGroup")(
        function* ({ before }) {
          if (isUntouchedGroup(before.group)) return true
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
