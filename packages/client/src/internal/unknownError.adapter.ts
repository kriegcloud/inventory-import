import * as P from "effect/Predicate"

/** WeakSet accepts object failures only; null and primitive failures are logged on each occurrence. */
export const UnknownError = { isWeakKey: (error: unknown): error is object => P.isObjectOrArray(error) }
