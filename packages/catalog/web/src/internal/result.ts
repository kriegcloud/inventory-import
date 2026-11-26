// A read's `AsyncResult` in the words the catalog's screens draw by: the answer once there is one, the failure while
// nothing is being asked again, and whether it is being asked again (shown from before meanwhile).
import * as Cause from "effect/Cause"
import * as O from "effect/Option"
import * as AsyncResult from "effect/reactivity/AsyncResult"

/** What a screen draws from one read. */
export interface Drawn<A> {
  /** The answer, also while it is being asked again; none before the first one came. */
  readonly data: O.Option<A>
  /** Why it could not be read, while it is not being asked again; null otherwise. */
  readonly error: O.Option<unknown>
  readonly isError: boolean
  /** Shown from before while it is asked again. */
  readonly updating: boolean
}

/** One read as a screen draws it. */
export const resultOf = <A, E>(result: AsyncResult.AsyncResult<A, E>): Drawn<A> => {
  const error = AsyncResult.isFailure(result) && !result.waiting ? O.some(result.cause.pipe(Cause.squash)) : O.none()
  return {
    data: AsyncResult.value(result),
    error,
    isError: O.isSome(error),
    updating: result.waiting
  }
}

/** What a screen draws from one read of something its address names (an import, its staged rows). */
export interface Opened<A> {
  /** The answer, also from before a read that failed; never of something found gone. */
  readonly data: O.Option<A>
  /** Why there is nothing to draw: the first read failed, or what the address names is gone. None otherwise. */
  readonly refused: O.Option<unknown>
  /** True where it is gone, said by the server: whatever was read before is not drawn. */
  readonly gone: boolean
  /** Why it could not be read again, while what was read before is drawn; also while it is being asked once more. */
  readonly behind: O.Option<unknown>
}

/**
 * One read as the screen its address opens draws it. A failed read with an answer from before keeps that answer drawn
 * (and whatever is being typed on it); only a first read that failed has nothing to draw, or the server saying it is
 * gone: nothing from before is drawn then, also while it is asked once more.
 */
export const openedOf = <A, E>(input: {
  readonly read: AsyncResult.AsyncResult<A, E>
  readonly isGone: (error: unknown) => boolean
}): Opened<A> => {
  const { read } = input
  const held = AsyncResult.value(read)
  const failed = AsyncResult.isFailure(read) ? O.some(read.cause.pipe(Cause.squash)) : O.none<unknown>()
  const gone = O.exists(failed, input.isGone)
  return {
    data: gone ? O.none() : held,
    refused: gone || (O.isNone(held) && !read.waiting) ? failed : O.none(),
    gone,
    behind: gone || O.isNone(held) ? O.none() : failed
  }
}
