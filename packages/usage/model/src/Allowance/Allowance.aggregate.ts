// One organization's model calls, counted per UTC day: one instance per organization, the day held as a whole number
// of days since 1970-01-01 UTC and worked out from the time `decide` is given (decision 25: "the 40 come back together
// at 00:00 UTC"; decision 26: an aggregate per organization). No command starts a day and nothing is scheduled: the
// first call of a later day counts 1 against that day. This is trial 9 of research 07 with the answers of 2026-11-26
// applied: `CallTaken` keeps the organization, the day, who asked and for what ("Org, day, who, purpose"), and a state
// is told by its schema's own guard and built by its case's own `make` (docs/building.md, "The model's blocks: what
// Verify reads"). No count is carried over from the `modelCall` table (decision 37).
//
// The one thing not to break: every rule is one comparison the prover reads, and the day is a number, never its date
// text (the prover has no order on text: trial 9's second variant proved nothing).
import * as Domain from "@alchemy.run/domain"
import { Role } from "@inventory/kernel/Role"
import { dailyModelCalls, ModelCallPurpose } from "@inventory/usage-contract/ModelCall"
import * as A from "effect/Array"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as S from "effect/Schema"
import { CurrentActor } from "../Actor/Actor.context.ts"
import { IdText } from "../Actor/Id.schema.ts"
import { Session } from "../Actor/Session.middleware.ts"

/** A UTC day, in milliseconds: the day number is the time divided by it, rounded down. */
export const dayMs = 86_400_000

/** One call counted, against the day it counts for: a later day's first call names its own day. */
export class CallTaken extends Domain.Event(
  "CallTaken",
  {
    organizationId: IdText.pipe(S.annotateKey({ description: "The organization whose allowance the call is from" })),
    day: S.Int.pipe(S.annotateKey({ description: "The UTC day it counts against, as days since 1970-01-01" })),
    by: IdText.pipe(S.annotateKey({ description: "The member who asked for the call" })),
    purpose: ModelCallPurpose.pipe(S.annotateKey({ description: "What the call was for" }))
  },
  { description: "One model call was taken from an organization's allowance for the day" }
) {}

/** The day's calls are used: they come back at 00:00 UTC. */
export class DayUsedUp extends Domain.Rejection(
  "DayUsedUp",
  { day: S.Int.pipe(S.annotateKey({ description: "The UTC day whose calls are used, as days since 1970-01-01" })) },
  { description: "The day's model calls are used; they come back at midnight UTC", httpApiStatus: 429 }
) {}

/**
 * The person's role is too low for this call: `required` is the lowest role that may take it, so the screen can say
 * which role they have, which one this needs and whom to ask, as the catalog's `NotPermitted` does. A viewer takes
 * only the table assistant's call. It is asked before the organization, as the catalog asks it.
 */
export class NotPermitted extends Domain.Rejection(
  "NotPermitted",
  { required: Role.pipe(S.annotateKey({ description: "The lowest role that may take this call" })) },
  { description: "The person's role is too low for this call", httpApiStatus: 403 }
) {}

/**
 * No allowance with this id is in the person's organization: a take from another organization's allowance, or a read
 * of its count, answered as not found, as the catalog answers another organization's import (`ImportNotFound`). The
 * site's Worker always names the actor's own organization, so only a bug there reaches this, and it has no sentence of
 * its own: with no `reason`, `sayError` says it in its words for an error that carries none.
 */
export class AllowanceNotFound extends Domain.Rejection(
  "AllowanceNotFound",
  {},
  { description: "No allowance with this id is in the person's organization", httpApiStatus: 404 }
) {}

/**
 * Take one call from the organization's allowance before a model is asked. The organization is an input only so the
 * call finds its instance: `decide` refuses one that is not the actor's.
 */
export class TakeCall extends Domain.Command(
  "TakeCall",
  {
    middleware: [Session],
    input: {
      organizationId: IdText.pipe(S.annotateKey({ description: "The organization the call is taken from" })),
      purpose: ModelCallPurpose.pipe(S.annotateKey({ description: "What the call is for" }))
    },
    events: [CallTaken],
    rejects: [DayUsedUp, NotPermitted, AllowanceNotFound]
  },
  { description: "Take one of the day's model calls for the asker's organization, before a model is asked" }
) {}

/**
 * Where an organization's allowance is: no call taken yet, or the day of its last call with how many it has taken
 * that day. A day that has passed is not reset: the next call names its own day and counts 1.
 */
export const AllowanceState = S.Union([
  S.Struct({ status: S.tag("Fresh") }),
  S.Struct({
    status: S.tag("Counting"),
    organizationId: IdText.pipe(S.annotateKey({ description: "The organization this allowance is" })),
    day: S.Int.pipe(S.annotateKey({ description: "The UTC day of the last call, as days since 1970-01-01" })),
    taken: S.Int.pipe(S.annotateKey({ description: "How many calls that day has taken" }))
  })
])
  .annotate({ description: "One organization's model calls: none yet, or the day of the last and how many it took" })
  .pipe(S.toTaggedUnion("status"))
/** The decoded value of `AllowanceState`. */
export type AllowanceState = typeof AllowanceState.Type

/** One organization's model calls, forty a UTC day, back together at midnight UTC. */
export class Allowance extends Domain.Aggregate(
  "Allowance",
  {
    id: IdText,
    state: AllowanceState,
    initial: AllowanceState.cases.Fresh.make({ status: "Fresh" }),
    invariants: {
      // Never more than forty calls counted for one day, and a counted day has at least its first call.
      NeverMoreThanFortyInADay: (s) => AllowanceState.guards.Fresh(s) || (s.taken >= 1 && s.taken <= dailyModelCalls)
    },
    transitions: {
      // Within one day the count only rises, by one call at a time.
      WithinADayTheCountRisesByOne: ({ before, after }) =>
        !AllowanceState.guards.Counting(before) ||
        !AllowanceState.guards.Counting(after) ||
        after.day !== before.day ||
        after.taken === before.taken + 1,
      // A new day's count starts at 1.
      ANewDayStartsAtOne: ({ before, after }) =>
        !AllowanceState.guards.Counting(after) ||
        (AllowanceState.guards.Counting(before) && before.day === after.day) ||
        after.taken === 1,
      // A day changes only forward: a clock behind the stored day counts against the stored day.
      ADayChangesOnlyForward: ({ before, after }) =>
        !AllowanceState.guards.Counting(before) || !AllowanceState.guards.Counting(after) || after.day >= before.day,
      // An allowance never changes organization.
      AnAllowanceNeverChangesOrganization: ({ before, after }) =>
        !AllowanceState.guards.Counting(before) ||
        !AllowanceState.guards.Counting(after) ||
        before.organizationId === after.organizationId,
      // Only its own organization takes a call from it.
      OnlyItsOwnOrganizationTakesACall: Effect.fn("Allowance.OnlyItsOwnOrganizationTakesACall")(function* ({
        command
      }) {
        return (yield* CurrentActor).organizationId === command.organizationId
      }),
      // A viewer takes only the table assistant's call (today's endpoints: the assistant is open to every member, the
      // check and the suggestions need an editor).
      AViewerTakesOnlyTheAssistantsCall: Effect.fn("Allowance.AViewerTakesOnlyTheAssistantsCall")(function* ({
        command
      }) {
        return (yield* CurrentActor).role !== "viewer" || command.purpose === "view"
      }),
      // Every call taken says who asked and for what, as the command was sent.
      EveryCallSaysWhoAndWhatFor: Effect.fn("Allowance.EveryCallSaysWhoAndWhatFor")(function* ({ command, events }) {
        const actor = yield* CurrentActor
        return A.every(events, (e) => e.by === actor.memberId && e.purpose === command.purpose)
      })
    },
    commands: [TakeCall],
    keyOf: (cmd: TakeCall) => cmd.organizationId,
    decide: {
      TakeCall: Effect.fn("Allowance.TakeCall")(function* (s, cmd, { now }) {
        const actor = yield* CurrentActor
        // The role first, then the organization, as the catalog asks them (DECISIONS.md, 2026-11-27).
        if (actor.role === "viewer" && cmd.purpose !== "view") return yield* NotPermitted.make({ required: "editor" })
        if (actor.organizationId !== cmd.organizationId) return yield* AllowanceNotFound.make({})
        const today = Math.floor(DateTime.toEpochMillis(now) / dayMs)
        // A later day starts its own count; a clock behind the stored day counts against the stored day.
        if (AllowanceState.guards.Fresh(s) || today > s.day) {
          return [
            CallTaken.make({ organizationId: cmd.organizationId, day: today, by: actor.memberId, purpose: cmd.purpose })
          ]
        }
        if (s.taken >= dailyModelCalls) return yield* DayUsedUp.make({ day: s.day })
        return [
          CallTaken.make({ organizationId: cmd.organizationId, day: s.day, by: actor.memberId, purpose: cmd.purpose })
        ]
      })
    },
    evolve: {
      // A new day keeps the organization it holds: the key is the organization, and trial 9's prover found a command
      // for another organization changing it from a state no real run reaches when the event's was taken.
      CallTaken: (s, e) =>
        AllowanceState.guards.Counting(s) && s.day === e.day
          ? AllowanceState.cases.Counting.make({
              status: "Counting",
              organizationId: s.organizationId,
              day: s.day,
              taken: s.taken + 1
            })
          : AllowanceState.cases.Counting.make({
              status: "Counting",
              organizationId: AllowanceState.guards.Counting(s) ? s.organizationId : e.organizationId,
              day: e.day,
              taken: 1
            })
    }
  },
  { description: "One organization's model calls: forty a UTC day, back together at midnight UTC" }
) {}
