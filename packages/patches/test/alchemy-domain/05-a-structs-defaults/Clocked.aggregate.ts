// A meter whose reading starts from a default that is worked out when it is asked for. The prover cannot say what it
// gives, and has to say so: a rule that rests on it is not proved.
import * as Domain from "@alchemy.run/domain"
import * as Effect from "effect/Effect"
import * as S from "effect/Schema"

/** A reading, with where it starts worked out when asked. */
export const Reading = S.Struct({
  reading: S.Int.pipe(S.withConstructorDefault(Effect.suspend(() => Effect.succeed(0)))),
  steps: S.Int
})

/** A clocked meter was started. */
export class Clocked extends Domain.Event("Clocked", { steps: S.Int }) {}

/** Start a clocked meter. */
export class Clock extends Domain.Command("Clock", { input: { meterId: S.String, steps: S.Int }, events: [Clocked] }) {}

/** One clocked meter. */
export class ClockedMeter extends Domain.Aggregate("ClockedMeter", {
  id: S.String,
  state: Reading,
  initial: { reading: 0, steps: 0 },
  transitions: {
    AClockedMeterReadsZero: ({ after }) => after.reading === 0
  },
  commands: [Clock],
  keyOf: (cmd) => cmd.meterId,
  decide: { Clock: (_meter, cmd) => [Clocked.make({ steps: cmd.steps })] },
  evolve: { Clocked: (_meter, event) => Reading.make({ steps: event.steps }) }
}) {}
