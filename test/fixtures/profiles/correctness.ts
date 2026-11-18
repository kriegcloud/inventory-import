// A correctness finding: an Effect that is built and never run (floatingEffect). The log line never happens, so the
// hour's check fails.
import { Effect } from "effect"

export const greet = Effect.fn("greet")(function* (name: string) {
  Effect.log(`Hello ${name}`)
  return name
})
