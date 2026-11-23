// The words a count is said with, written once: every sentence of the model that names how many of something there are
// reads the same way.
import { dual } from "effect/Function"

/**
 * A count with its noun, singular for one and plural for every other number, nought included.
 *
 * @example plural(1, "row", "rows") // "1 row"
 * @example plural(0, "row", "rows") // "0 rows"
 */
export const plural: {
  (one: string, many: string): (n: number) => string
  (n: number, one: string, many: string): string
} = dual(3, (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`)
