// How many rows one act on a group covers: a value the group's state, its event and the command that decides it share.
import * as S from "effect/Schema"

/**
 * **Details**
 *
 * The count is a whole number, and it is its sender's word: the model reads no row out of a group's rows, so nothing
 * ties it to them. It is held by the schema of the event and of the state, so Verify proves it kept as part of "the
 * state stays in its schema".
 *
 * **Example** (A group covers at least one row)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import * as Size from "./Size.schema.ts"
 *
 * O.isSome(Size.Size.makeOption(1)) // => true
 * O.isNone(Size.Size.makeOption(0)) // => true
 * O.isNone(Size.Size.makeOption(1.5)) // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const Size = S.Int.check(S.isGreaterThanOrEqualTo(1)).annotate({
  description: "How many rows an act on a group covers: at least one"
})
/**
 * The decoded value of `Size`: a whole number of at least one.
 *
 * @category models
 * @since 0.0.0
 */
export type Size = typeof Size.Type
