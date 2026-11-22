// @effect-diagnostics newSchemaClass:off
// One act on a group of rows, decided across the import and the group it names, and recorded on both or on neither:
// one command, whatever the number of rows (Benjamin, 2026-11-22: "One unit per group"). It is taken only from a
// screen that has every change of the import, so the rows it names are the ones the act fits now. It becomes the last
// group in force and keeps which one was before it, so that its undo can put that one back as the last. The one thing
// not to break: every check here that refuses an act has its rule below, so a check that is removed breaks a named
// rule under Verify.
import * as Domain from "@alchemy.run/domain"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as Match from "effect/Match"
import * as S from "effect/Schema"
import { CurrentActor, Session } from "../Actor/Actor.context.ts"
import { Group, GroupDecided, isDecidedGroup, isUntouchedGroup } from "../Group/Group.aggregate.ts"
import {
  ConfirmedSince,
  GroupCounted,
  Import,
  isOpen,
  MatchedSince,
  NotOpen,
  NotPermitted,
  ReviewMovedOn
} from "../Import/Import.aggregate.ts"
import { Change, ImportKey, Patch, Rows, Step } from "./Change.schema.ts"
import { Label } from "./Deciding.decision.ts"

/** A group was already decided under this step: a step decides one group, once. */
export class StepTaken extends Domain.Rejection(
  "StepTaken",
  {},
  { description: "A group was already decided under this step" }
) {}

/**
 * Decide a group of rows as one act. `seen`: the screen has received every change of the import up to this number.
 * `opening`: how many times the import had been confirmed when the act was made. `madeOn`: the import's matching it
 * was made on. `rows` and `patch`: which rows, and what the act does to each; `count`: how many rows that is.
 */
export class DecideGroup extends Domain.Command(
  "DecideGroup",
  {
    middleware: [Session],
    input: {
      importId: ImportKey,
      step: Step,
      opening: S.Int,
      seen: Change,
      madeOn: S.Int,
      patch: Patch,
      rows: Rows,
      count: S.Int.check(S.isGreaterThanOrEqualTo(1)),
      label: Label
    },
    events: [GroupDecided, GroupCounted],
    rejects: [NotOpen, NotPermitted, StepTaken, ConfirmedSince, ReviewMovedOn, MatchedSince]
  },
  { description: "Decide a group of rows as one act, from a screen that has every change of the import" }
) {}

type DecidingGroupEvent = GroupDecided | GroupCounted
const yes = (): boolean => true
const no = (): boolean => false
const isGroupCounted = (event: DecidingGroupEvent): event is GroupCounted =>
  Match.value(event).pipe(Match.tag("GroupCounted", yes), Match.orElse(no))

/** One act on a group of rows: read from the import and the group, recorded on both or on neither. */
export class DecidingGroup extends Domain.Decision(
  DecideGroup,
  {
    reads: { life: Import, group: Group },
    keyOf: (cmd: DecideGroup) => ({ life: cmd.importId, group: `${cmd.importId}/${cmd.step}` }),
    decide: Effect.fn("DecidingGroup.decide")(function* ({ life, group }, cmd) {
      const actor = yield* CurrentActor
      if (!isOpen(life.state)) return yield* new NotOpen({})
      if (actor.organizationId !== life.state.organizationId || actor.role === "viewer") {
        return yield* new NotPermitted({})
      }
      if (!isUntouchedGroup(group.state)) return yield* new StepTaken({})
      if (cmd.opening !== life.state.confirms) return yield* new ConfirmedSince({})
      if (cmd.seen !== life.state.changes) return yield* new ReviewMovedOn({ last: life.state.changes })
      if (cmd.madeOn !== life.state.matching) return yield* new MatchedSince({ matching: life.state.matching })
      const change = life.state.changes + 1
      return [
        group.record(
          new GroupDecided({
            importId: cmd.importId,
            organizationId: life.state.organizationId,
            change,
            by: actor.memberId,
            step: cmd.step,
            patch: cmd.patch,
            rows: cmd.rows,
            count: cmd.count,
            madeOn: cmd.madeOn,
            label: cmd.label,
            under: life.state.topGroup
          })
        ),
        life.record(
          new GroupCounted({
            change,
            step: cmd.step,
            rows: cmd.count,
            label: cmd.label,
            by: actor.memberId,
            top: change
          })
        )
      ]
    }),
    transitions: {
      AGroupIsDecidedOnlyOnAnOpenImport: ({ before }) => isOpen(before.life),
      AGroupIsOfThisOpening: ({ before, command }) => isOpen(before.life) && command.opening === before.life.confirms,
      // Its screen had every change: the rows it names are the ones the act fits.
      AGroupIsMadeOnEveryChange: ({ before, command }) => isOpen(before.life) && command.seen === before.life.changes,
      AGroupIsMadeOnTheMatchingNow: ({ before, command }) =>
        isOpen(before.life) && command.madeOn === before.life.matching,
      AStepDecidesOneGroup: ({ before }) => isUntouchedGroup(before.group),
      // It is recorded whole: every row it names, what it does to them, as its sender's, in force.
      AGroupIsRecorded: ({ after }) => isDecidedGroup(after.group),
      WithEveryRowItNames: ({ after, command }) => !isDecidedGroup(after.group) || after.group.rows === command.rows,
      WithWhatItDoes: ({ after, command }) => !isDecidedGroup(after.group) || after.group.patch === command.patch,
      WithItsCount: ({ after, command }) => !isDecidedGroup(after.group) || after.group.count === command.count,
      OnItsMatching: ({ after, command }) => !isDecidedGroup(after.group) || after.group.madeOn === command.madeOn,
      InForce: ({ after }) => !isDecidedGroup(after.group) || after.group.undoneAt === 0,
      AsItsSenders: Effect.fn("DecidingGroup.AsItsSenders")(function* ({ after }) {
        if (!isDecidedGroup(after.group)) return true
        const actor = yield* CurrentActor
        return after.group.by === actor.memberId
      }),
      // It is one change of the import, whatever the number of its rows, with the same number on the group.
      AGroupIsOneChange: ({ before, after }) =>
        !isOpen(before.life) || !isOpen(after.life) || after.life.changes === before.life.changes + 1,
      OnTheGroupToo: ({ after }) =>
        !isOpen(after.life) || !isDecidedGroup(after.group) || after.group.change === after.life.changes,
      TheImportHoldsItAsItsLastGroupAct: ({ after }) =>
        !isOpen(after.life) || after.life.lastGroup === after.life.changes,
      // It is now the last group in force, and keeps which one was before it.
      AGroupDecidedIsTheLastInForce: ({ after }) => !isOpen(after.life) || after.life.topGroup === after.life.changes,
      AndKeepsWhichOneWasBeforeIt: ({ before, after }) =>
        !isOpen(before.life) || !isDecidedGroup(after.group) || after.group.under === before.life.topGroup,
      TheImportsEventSaysHowManyRows: ({ command, events }) =>
        A.every(events, (e) => !isGroupCounted(e) || e.rows === command.count),
      // Who may change a group. The group has no command of its own, so these are rules of the decisions that record
      // on it: only its maker takes it back, only its own organization changes it, and a viewer changes none.
      NobodyUndoesAnotherPersonsGroup: Effect.fn("DecidingGroup.NobodyUndoesAnotherPersonsGroup")(function* ({
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
      OnlyItsOwnOrganizationChangesTheGroup: Effect.fn("DecidingGroup.OnlyItsOwnOrganizationChangesTheGroup")(
        function* ({ before }) {
          if (isUntouchedGroup(before.group)) return true
          const actor = yield* CurrentActor
          return actor.organizationId === before.group.organizationId
        }
      ),
      AViewerChangesNoGroup: Effect.fn("DecidingGroup.AViewerChangesNoGroup")(function* () {
        const actor = yield* CurrentActor
        return actor.role !== "viewer"
      })
    }
  },
  { description: "One act on a group of rows, recorded on the import and on the group, or on neither" }
) {}
