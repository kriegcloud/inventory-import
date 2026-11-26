import * as A from "effect/Array"
import { dual } from "effect/Function"

/** Selects a member of the fixture's nonempty cycle without copying or allocating a lookup wrapper. */
export const cycle: {
  (index: number): <T>(items: A.NonEmptyReadonlyArray<T>) => T
  <T>(items: A.NonEmptyReadonlyArray<T>, index: number): T
} = dual(2, <T>(items: A.NonEmptyReadonlyArray<T>, index: number): T => {
  const position = index % items.length
  let at = 0
  for (const item of items) {
    if (at === position) return item
    at += 1
  }
  return A.headNonEmpty(items)
})
