// A number read from every path a list names, recorded beside the list. A file swapped for another changes it, so the
// law refuses the list until the number is recorded again. It is a guard for the review, not for the code: the
// number sits beside the list and changes in the same commit, so what it ensures is that a change to a list shows in
// the diff as a change to its number. What holds each file mechanically is its count (`ledger.ts`).
import * as A from "effect/Array"
import * as Hash from "effect/Hash"
import * as Order from "effect/Order"

/**
 * The number a list of files is held by: the same for the same paths in any order, another for any other list.
 *
 * @example heldAs(["b.ts", "a.ts"]) === heldAs(["a.ts", "b.ts"]) // true
 */
export const heldAs = (files: ReadonlyArray<string>): number => Hash.string(A.join(A.sort(files, Order.String), "\n"))
