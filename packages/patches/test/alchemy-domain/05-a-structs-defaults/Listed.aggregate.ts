// A meter whose marks start from a default that is a list. The prover reads a default that is a number, a text, a
// truth or `null`, and has to say so of any other: a rule that rests on it is not proved.
import * as Domain from "@alchemy.run/domain"
import * as Effect from "effect/Effect"
import * as S from "effect/Schema"

/** The marks a meter holds, none to begin with. */
export const Marks = S.Struct({
  marks: S.Array(S.Int).pipe(S.withConstructorDefault(Effect.succeed([]))),
  steps: S.Int
})

/** A listed meter was started. */
export class Listed extends Domain.Event("Listed", { steps: S.Int }) {}

/** Start a listed meter. */
export class List extends Domain.Command("List", { input: { meterId: S.String, steps: S.Int }, events: [Listed] }) {}

/** One listed meter. */
export class ListedMeter extends Domain.Aggregate("ListedMeter", {
  id: S.String,
  state: Marks,
  initial: { marks: [], steps: 0 },
  transitions: {
    AListedMeterHoldsNoMark: ({ after }) => after.marks.length === 0
  },
  commands: [List],
  keyOf: (cmd) => cmd.meterId,
  decide: { List: (_meter, cmd) => [Listed.make({ steps: cmd.steps })] },
  evolve: { Listed: (_meter, event) => Marks.make({ steps: event.steps }) }
}) {}
