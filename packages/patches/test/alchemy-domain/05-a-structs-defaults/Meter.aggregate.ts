// A meter whose state leaves its status, its reading and its unit to their constructor defaults: `evolve` names only
// what the event gives, and a place held inside the state leaves its floor to a default too.
import * as Domain from "@alchemy.run/domain"
import * as Effect from "effect/Effect"
import * as S from "effect/Schema"

/** Where a meter is: a room, and the floor it is on. */
export const Place = S.Struct({ room: S.String, floor: S.Int.pipe(S.withConstructorDefault(Effect.succeed(1))) })

/** A meter that was never started. */
export const Idle = S.Struct({ status: S.tag("Idle") })

/** A meter that runs: what it reads, in which unit, and how many steps it was started with. */
export const Running = S.Struct({
  status: S.tag("Running"),
  reading: S.Int.pipe(S.withConstructorDefault(Effect.succeed(0))),
  unit: S.String.pipe(S.withConstructorDefault(Effect.succeed("kWh"))),
  sealed: S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(true))),
  steps: S.Int,
  place: Place
})

/** A meter, idle or running. */
export const MeterState = S.Union([Idle, Running]).pipe(S.toTaggedUnion("status"))

/** A meter was started. */
export class Started extends Domain.Event("Started", { steps: S.Int, room: S.String }) {}

/** Start a meter. */
export class Start extends Domain.Command("Start", {
  input: { meterId: S.String, steps: S.Int, room: S.String },
  events: [Started]
}) {}

/** One meter. */
export class Meter extends Domain.Aggregate("Meter", {
  id: S.String,
  state: MeterState,
  initial: Idle.make({}),
  transitions: {
    AStartedMeterReadsZero: ({ after }) => !MeterState.guards.Running(after) || after.reading === 0,
    AStartedMeterCountsInKilowattHours: ({ after }) => !MeterState.guards.Running(after) || after.unit === "kWh",
    AStartedMeterIsSealed: ({ after }) => !MeterState.guards.Running(after) || after.sealed,
    AStartedMeterIsOnTheFirstFloor: ({ after }) => !MeterState.guards.Running(after) || after.place.floor === 1,
    AStartedMeterReadsOne: ({ after }) => !MeterState.guards.Running(after) || after.reading === 1,
    AStartedMeterIsOnTheSecondFloor: ({ after }) => !MeterState.guards.Running(after) || after.place.floor === 2
  },
  commands: [Start],
  keyOf: (cmd) => cmd.meterId,
  decide: { Start: (_meter, cmd) => [Started.make({ steps: cmd.steps, room: cmd.room })] },
  evolve: { Started: (_meter, event) => Running.make({ steps: event.steps, place: { room: event.room } }) }
}) {}
