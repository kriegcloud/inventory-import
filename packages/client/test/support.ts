import { assertTrue } from "@effect/vitest/utils"
import * as O from "effect/Option"

/** Reads the answer a test requires, failing before using a missing answer. */
export const assertedValue = <A>(value: O.Option<A>): A => {
  const present = O.isSome(value)
  assertTrue(present)
  return value.value
}
