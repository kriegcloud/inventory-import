// A style finding: a native string method where the Effect String module has one. It runs the same either way, so the
// hour's check passes and `bun run check:strict` counts one preferEffectString.
import { Effect } from "effect"

export const shout = Effect.fn("shout")(function* (name: string) {
  return yield* Effect.succeed(name.toUpperCase())
})
