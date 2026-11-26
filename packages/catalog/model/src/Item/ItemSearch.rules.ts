// What a search of the items looks for: the words of the text typed, how each is matched (as typed, as its start, or
// one letter off), and in what order the items that hold them come. Nothing here is SQL: the host turns the plan
// into statements.
// Commas and semicolons around a word are how people list words ("nut, bolt"), not part of what they look for.
import * as A from "effect/Array"
import * as Data from "effect/Data"
import * as Str from "effect/String"
import { maxSearchWords, closeFrom, indexedFrom } from "@inventory/catalog-contract/ItemSearch"
const edges = /^[,;]+|[,;]+$/g

const everyWord = (text: string): ReadonlyArray<string> => {
  const plain = Str.toLowerCase(Str.replace(/\p{M}+/gu, "")(Str.normalize("NFD")(text)))
  const spaced = Str.replace(/\p{Cc}+/gu, " ")(plain)
  const words = A.filter(
    A.map(Str.split(/\s+/)(Str.trim(spaced)), (word) => Str.replace(edges, "")(word)),
    (word) => word !== ""
  )
  return A.dedupe(words)
}

/**
 * The words of a search, as the database compares them: lower case, accents taken off ("Écrou" is "ecrou"), control
 * characters read as spaces, commas and semicolons around a word dropped, each word once, at most `maxSearchWords`.
 *
 * @example searchWords("  Split  LOCK, washer m8 lock ") // ["split", "lock", "washer", "m8"]
 */
export const searchWords = (text: string): ReadonlyArray<string> => A.take(everyWord(text), maxSearchWords)

/**
 * How many words of a search are left out because it has more than `maxSearchWords`.
 *
 * @example wordsLeftOut("one two three four five six seven eight nine ten") // 2
 */
export const wordsLeftOut = (text: string): number => Math.max(0, everyWord(text).length - maxSearchWords)

/** A word's length in characters, as the index and LIKE count them (an accented letter is one). */
export const characters = (word: string): number => A.fromIterable(word).length

/**
 * A word as one FTS5 string: in double quotes, a double quote inside doubled. Whatever the word holds (`*`, `^`,
 * `:`, `(`, `NEAR`, `AND`, `-`) is then text to find, never query syntax.
 *
 * @example phrase('1/8"') // "\"1/8\"\"\""
 */
export const phrase = (word: string): string => `"${Str.replaceAll('"', '""')(word)}"`

/** LIKE's own characters escaped with a backslash, for a pattern compared with `ESCAPE '\'`. */
const literal = (text: string): string => Str.replace(/[\\%_]/g, "\\$&")(text)

/**
 * A LIKE pattern that finds the word anywhere in a value, its own `%`, `_` and `\` escaped.
 *
 * @example contains("50%") // "%50\\%%"
 */
export const contains = (word: string): string => `%${literal(word)}%`

/**
 * Every LIKE pattern that finds the word with one difference: one letter missing ("washr" finds "washer"), one
 * extra ("gasgket" finds "gasket"), one wrong ("brackit" finds "bracket"), or two neighbours swapped ("swivle"
 * finds "swivel"). A difference at either end is covered by dropping that letter, because the pattern finds the
 * word inside a longer one. Each pattern once.
 *
 * @example closeMatches("nutt") // ["%utt%", "%ntt%", "%nut%", "%n_tt%", "%nu_t%", "%n_utt%", ...]
 */
export const closeMatches = (word: string): ReadonlyArray<string> => {
  const letters = A.map(A.fromIterable(word), literal)
  const n = letters.length
  if (n < 2) return []
  const join = (parts: ReadonlyArray<string>) => `%${A.join(parts, "")}%`
  const before = (i: number) => A.take(letters, i)
  const after = (i: number) => A.drop(letters, i)
  // `A.range` is never empty (a range that runs backwards is its start), so an empty one is said here.
  const indices = (from: number, to: number): ReadonlyArray<number> => (from > to ? [] : A.range(from, to))
  const dropped = A.map(indices(0, n - 1), (i) => join([...before(i), ...after(i + 1)]))
  const wrong = A.map(indices(1, n - 2), (i) => join([...before(i), "_", ...after(i + 1)]))
  const missing = A.map(indices(1, n - 1), (i) => join([...before(i), "_", ...after(i)]))
  // Each letter with the one after it.
  const swapped = A.flatMap(A.zip(letters, A.drop(letters, 1)), ([a, b], i) =>
    a === b ? [] : [join([...before(i), b, a, ...after(i + 2)])]
  )
  return A.dedupe([...dropped, ...wrong, ...missing, ...swapped])
}

/**
 * How one word of a search is compared. `Indexed`: looked up in the full-text index as typed. `Contains`: too short
 * for the index, compared as text. `Close`: not in the organization's items as typed, so compared with one letter
 * different.
 */
export type WordMatch = Data.TaggedEnum<{
  readonly Indexed: { readonly word: string; readonly phrase: string }
  readonly Contains: { readonly word: string; readonly patterns: ReadonlyArray<string> }
  readonly Close: { readonly word: string; readonly patterns: ReadonlyArray<string> }
}>

/** The constructors, guards and matcher of `WordMatch`. */
export const WordMatch = Data.taggedEnum<WordMatch>()
// Taken out of the enum once, so a search builds each word with a plain function.
const { Close, Contains, Indexed } = WordMatch

/**
 * The words that need asking first whether the organization's items contain them as typed: those long enough to be
 * read with one letter different if they do not.
 */
export const wordsToCheck = (words: ReadonlyArray<string>): ReadonlyArray<string> =>
  A.filter(words, (word) => characters(word) >= closeFrom)

/**
 * How each word is compared, given which words the organization's items contain as typed (`found`, from the
 * index). A word the items contain is never read as a typo, so a correctly typed word never brings in near misses.
 *
 * @example
 * plan({ words: ["m8", "washr"], found: [] })
 * // [WordMatch.Contains({ word: "m8", patterns: ["%m8%"] }), WordMatch.Close({ word: "washr", patterns: [...] })]
 */
export const plan = (input: {
  readonly words: ReadonlyArray<string>
  readonly found: ReadonlyArray<string>
}): ReadonlyArray<WordMatch> =>
  A.map(input.words, (word): WordMatch => {
    const n = characters(word)
    if (n < indexedFrom) return Contains({ word, patterns: [contains(word)] })
    if (n < closeFrom || A.contains(input.found, word)) return Indexed({ word, phrase: phrase(word) })
    return Close({ word, patterns: closeMatches(word) })
  })
