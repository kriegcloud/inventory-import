// A reason quotes a cell cut short, and a stored reason longer than the result reads is read cut short: `clipped`
// keeps at most `max` UTF-16 units, ends with "…" when it cut, and never cuts a character in two. Held against a cut
// worked out character by character, whole code points only.
import { describe, expect, it } from "@effect/vitest"
import { clipped } from "@inventory/catalog-host/ImportRows"
import * as A from "effect/Array"
import * as Arbitrary from "effect/Arbitrary"
import * as S from "effect/Schema"

// Text of one-unit and two-unit characters, so a cut often falls inside a pair of surrogates.
const Text = S.Array(S.Literals(["a", "é", " ", "😀", "𝟘"])).check(S.isMaxLength(30))
const Max = S.Int.check(S.isBetween({ minimum: 2, maximum: 40 }))

/** The longest run of whole characters from the start that leaves one unit for "…", then "…"; or the text itself. */
const cutByHand = (text: string, max: number): string =>
  text.length <= max
    ? text
    : `${
        A.reduce(A.fromIterable(text), { kept: "", full: false }, (cut, character) =>
          cut.full || cut.kept.length + character.length > max - 1
            ? { kept: cut.kept, full: true }
            : { kept: `${cut.kept}${character}`, full: false }
        ).kept
      }…`

describe("text cut short", () => {
  it.prop(
    "keeps whole characters up to the limit, ends with … when it cut, and fits",
    [Arbitrary.schema(Text), Arbitrary.schema(Max)],
    ([characters, max]) => {
      const text = A.join(characters, "")
      const cut = clipped(text, max)
      expect(cut).toBe(cutByHand(text, max))
      expect(cut.length <= max).toBe(true)
      expect(clipped(max)(text)).toBe(cut)
    }
  )
})
