// The search box's words, read before the database sees them. The claims that would hurt most if wrong: a search
// longer than the box allows is refused, not cut; a word's quotes, `%` and `_` are text, never syntax; and a word
// with one letter missing, extra, wrong or swapped is always found by one of its near spellings.
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, String as Str } from "effect"
import * as S from "effect/Schema"
import { ItemQueryParams } from "@inventory/catalog-contract/Catalog"
import { ItemQuery } from "@inventory/catalog-contract/ItemQuery"
import { maxSearch } from "@inventory/catalog-contract/ItemSearch"
import {
  closeMatches,
  contains,
  phrase,
  plan,
  searchWords,
  wordsLeftOut,
  wordsToCheck
} from "@inventory/catalog-model/ItemSearch"
const decodeQuery = S.decodeUnknownEffect(ItemQuery)
const decodeParams = S.decodeUnknownEffect(ItemQueryParams)
const asked = { page: 1, perPage: 20, sorting: [], filters: [], joinOperator: "and" }

/** SQLite's LIKE with `ESCAPE '\'`, ignoring case: what the server compares a pattern with. */
const like = (pattern: string, text: string): boolean => {
  let source = ""
  const characters = Arr.fromIterable(pattern)
  for (let i = 0; i < characters.length; i++) {
    const character = characters[i] ?? ""
    if (character === "\\") {
      source += Str.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")(characters[i + 1] ?? "")
      i++
    } else if (character === "%") source += "[\\s\\S]*"
    else if (character === "_") source += "[\\s\\S]"
    else source += Str.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")(character)
  }
  return new RegExp(`^${source}$`, "iu").test(text)
}

describe("the search in the query", () => {
  it.effect("is part of the query, at most 200 characters, and an address without it searches nothing", () =>
    Effect.gen(function* () {
      const longest = Str.repeat(maxSearch)("x")
      const ok = yield* decodeQuery({ ...asked, search: longest })
      expect(ok.search).toBe(longest)
      const refused = yield* decodeQuery({ ...asked, search: `${longest}x` }).pipe(Effect.flip)
      expect(String(refused)).toContain("200")
      const params = { page: "1", perPage: "20", sort: "[]", filters: "[]", joinOperator: "and" }
      const without = yield* decodeParams(params)
      expect(without.search).toBe("")
      const typed = yield* decodeParams({ ...params, search: "m8 washer" })
      expect(typed.search).toBe("m8 washer")
    })
  )
})

describe("the words of a search", () => {
  it("are lower case, without accents, each once, without the commas between them", () => {
    expect(searchWords("  Split  LOCK, washer m8 lock ")).toEqual(["split", "lock", "washer", "m8"])
    expect(searchWords("Écrou À embase")).toEqual(["ecrou", "a", "embase"])
    expect(searchWords("nut;\tbolt\u0000washer")).toEqual(["nut", "bolt", "washer"])
    expect(searchWords("   ")).toEqual([])
  })

  it("stop at eight, and say how many were left out", () => {
    const ten = "one two three four five six seven eight nine ten"
    expect(searchWords(ten)).toHaveLength(8)
    expect([wordsLeftOut(ten), wordsLeftOut("m8 washer")]).toEqual([2, 0])
  })

  it("keep their quotes, operators, % and _ as text", () => {
    expect(phrase('1/8"')).toBe('"1/8"""')
    expect(phrase("NEAR(washer")).toBe('"NEAR(washer"')
    expect(contains("50%")).toBe("%50\\%%")
    expect(contains("a_b\\c")).toBe("%a\\_b\\\\c%")
    expect(like(contains("50%"), "Rag 50% cotton")).toBe(true)
    expect(like(contains("50%"), "Rag 500 cotton")).toBe(false)
    expect(like(contains("_"), "Cable tie")).toBe(false)
    expect(Arr.every(closeMatches("50%x"), (pattern) => !like(pattern, "50 pack"))).toBe(true)
  })

  it("are read by length and by whether the items hold them as typed", () => {
    expect(wordsToCheck(["m8", "nut", "washr", "lock"])).toEqual(["washr", "lock"])
    expect(Arr.map(plan({ words: ["m8", "nut", "washr", "lock"], found: ["lock"] }), (word) => word._tag)).toEqual([
      "Contains",
      "Indexed",
      "Close",
      "Indexed"
    ])
  })
})

const letters = ["a", "b", "e", "k", "s", "w", "1", "8", "-", "%", "_", '"'] as const
const Letter = S.Literals(letters)

describe("a word with one letter different", () => {
  it.prop(
    "is always found in the item's text by one of the typed word's near spellings",
    {
      stored: S.Array(Letter).check(S.isMinLength(5), S.isMaxLength(12)),
      edit: S.Literals(["missing", "extra", "wrong", "swapped"]),
      at: S.Int.check(S.isBetween({ minimum: 0, maximum: 11 })),
      letter: Letter
    },
    ({ stored, edit, at, letter }) => {
      const n = stored.length
      const i = Math.min(at, n - 1)
      const typed =
        edit === "missing"
          ? [...Arr.take(stored, i), ...Arr.drop(stored, i + 1)]
          : edit === "extra"
            ? [...Arr.take(stored, i), letter, ...Arr.drop(stored, i)]
            : edit === "wrong"
              ? [...Arr.take(stored, i), letter, ...Arr.drop(stored, i + 1)]
              : i + 1 < n
                ? [...Arr.take(stored, i), stored[i + 1] ?? "", stored[i] ?? "", ...Arr.drop(stored, i + 2)]
                : stored
      const word = Arr.join(typed, "")
      const text = `Item ${Arr.join(stored, "")} M8`
      // Typed as stored (a wrong letter that is the same letter, a swap of two equal ones), it is simply contained.
      const found = like(contains(word), text) || Arr.some(closeMatches(word), (pattern) => like(pattern, text))
      expect({ word, text, found }).toEqual({ word, text, found: true })
    }
  )

  it("covers the misspellings people type", () => {
    const finds = (typed: string, text: string) => Arr.some(closeMatches(typed), (pattern) => like(pattern, text))
    expect(finds("washr", "Split lock washer M8")).toBe(true)
    expect(finds("gasgket", "Flange gasket 2 in")).toBe(true)
    expect(finds("swivle", "Swivel caster 3")).toBe(true)
    expect(finds("aluminim", "Aluminum flat bar")).toBe(true)
    expect(finds("washers", "Split lock washer M8")).toBe(true)
    expect(finds("gasket", "Flange seal 2 in")).toBe(false)
  })
})
