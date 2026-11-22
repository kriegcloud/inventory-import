// The lines of one source, for a law that says many places of it: where each line starts is read once, and a place is
// found among them by halves. Counting the line ends before every place read the file once per place.
import * as A from "effect/Array"
import * as Str from "effect/String"

/**
 * The line an offset of `source` is on, from 1.
 *
 * @example linesOf("a\nbc\n")(3) // 2
 */
export const linesOf = (source: string): ((offset: number) => number) => {
  const ends: Array<number> = []
  let at = -1
  for (const line of A.dropRight(Str.split("\n")(source), 1)) {
    at += line.length + 1
    ends.push(at)
  }
  return (offset) => {
    // How many lines end before the offset: the line end at the offset itself is its own line's.
    let before = 0
    let after = ends.length
    while (before < after) {
      const middle = Math.floor((before + after) / 2)
      if ((ends[middle] ?? offset) < offset) before = middle + 1
      else after = middle
    }
    return before + 1
  }
}
