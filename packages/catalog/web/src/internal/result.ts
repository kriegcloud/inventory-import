// A read's `AsyncResult` in the words the catalog's screens draw by: the answer once there is one, the failure while
// nothing is being asked again, and whether it is being asked again (shown from before meanwhile).
import * as Cause from "effect/Cause"
import * as O from "effect/Option"
import * as AsyncResult from "effect/reactivity/AsyncResult"

/** What a screen draws from one read. */
export interface Drawn<A> {
  /** The answer, also while it is being asked again; none before the first one came. */
  readonly data: A | undefined
  /** Why it could not be read, while it is not being asked again; null otherwise. */
  readonly error: unknown
  readonly isError: boolean
  /** Shown from before while it is asked again. */
  readonly updating: boolean
}

/** One read as a screen draws it. */
export const resultOf = <A, E>(result: AsyncResult.AsyncResult<A, E>): Drawn<A> => {
  const error = AsyncResult.isFailure(result) && !result.waiting ? Cause.squash(result.cause) : null
  return {
    data: result.pipe(AsyncResult.value, O.getOrUndefined),
    error,
    isError: error !== null,
    updating: result.waiting
  }
}
