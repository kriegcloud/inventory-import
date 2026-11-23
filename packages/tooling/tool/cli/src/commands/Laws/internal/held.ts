// What holds a list of files that may only shrink by its contents, not only its length: a number read from every
// path in it, in order, recorded beside the list. A file swapped for another changes it, so the law refuses the list
// until the number is recorded again, which a review sees.
import * as A from "effect/Array"
import * as Hash from "effect/Hash"
import * as Order from "effect/Order"

/**
 * The number a list of files is held by: the same for the same paths in any order, another for any other list.
 *
 * @example heldAs(["b.ts", "a.ts"]) === heldAs(["a.ts", "b.ts"]) // true
 */
export const heldAs = (files: ReadonlyArray<string>): number => Hash.string(A.join(A.sort(files, Order.String), "\n"))
