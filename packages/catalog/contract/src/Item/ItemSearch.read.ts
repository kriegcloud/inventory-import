import { Array as Arr, String as Str } from "effect"
import * as S from "effect/Schema"

// THE ITEMS PAGE'S ONE SEARCH BOX, READ INTO WORDS THE DATABASE CAN ANSWER. A person types a few words; each word
// must be found somewhere in an item's name, SKU or description, in any order. What "found" means is decided here,
// in pure functions, so the rule can be read and tested without a database:
//
// - a word of 3 characters or more is looked up in the full-text index (FTS5, trigram tokenizer), which finds it
//   anywhere inside a word, ignoring case and accents: "brack" finds "Steel bracket 40 mm", "BLT-0" finds "BLT-0042";
// - a word of 1 or 2 characters ("m8") is too short for the index and is compared as text with LIKE;
// - a word of 4 characters or more that the organization's items do not contain as typed is read as a word with one
//   letter wrong, missing, extra, or two letters swapped ("brakcet", "bolts"), compared as text with LIKE.
//
// The one thing not to break: a word is only ever bound as a parameter. `phrase` makes it one FTS5 string, so its
// quotes, `*`, `^`, `:`, `NEAR` and `AND` are text; `contains` escapes LIKE's `%`, `_` and `\`.

/** The longest search a person can type, in characters. The box stops there and the server refuses more. */
export const maxSearch = 200

/** The most words one search narrows by. Later words are left out (and the box says so). */
export const maxSearchWords = 8

/** The shortest word the full-text index can find: its trigram tokenizer reads three characters at a time. */
export const indexedFrom = 3

/** The shortest word that may have one letter wrong. Shorter words have too many neighbours to guess from. */
export const closeFrom = 4

/** What a person typed into the search box. Empty when they are not searching. */
export const ItemSearchText = S.String.check(S.isMaxLength(maxSearch)).annotate({
  description:
    "Words to find in an item's name, SKU or description, in any order, ignoring case and accents; empty for no search"
})
/** The decoded value of `ItemSearchText`. */
export type ItemSearchText = typeof ItemSearchText.Type

// Commas and semicolons around a word are how people list words ("nut, bolt"), not part of what they look for.
const edges = /^[,;]+|[,;]+$/g

const everyWord = (text: string): ReadonlyArray<string> => {
  const plain = Str.toLowerCase(Str.replace(/\p{M}+/gu, "")(Str.normalize("NFD")(text)))
  const spaced = Str.replace(/\p{Cc}+/gu, " ")(plain)
  const words = Arr.filter(
    Arr.map(Str.split(/\s+/)(Str.trim(spaced)), (word) => Str.replace(edges, "")(word)),
    (word) => word !== ""
  )
  return Arr.dedupe(words)
}

/**
 * The words of a search, as the database compares them: lower case, accents taken off ("Écrou" is "ecrou"), control
 * characters read as spaces, commas and semicolons around a word dropped, each word once, at most `maxSearchWords`.
 *
 * @example searchWords("  Split  LOCK, washer m8 lock ") // ["split", "lock", "washer", "m8"]
 */
export const searchWords = (text: string): ReadonlyArray<string> => Arr.take(everyWord(text), maxSearchWords)

/**
 * How many words of a search are left out because it has more than `maxSearchWords`.
 *
 * @example wordsLeftOut("one two three four five six seven eight nine ten") // 2
 */
export const wordsLeftOut = (text: string): number => Math.max(0, everyWord(text).length - maxSearchWords)

/** A word's length in characters, as the index and LIKE count them (an accented letter is one). */
export const characters = (word: string): number => Arr.fromIterable(word).length

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
  const letters = Arr.map(Arr.fromIterable(word), literal)
  const n = letters.length
  if (n < 2) return []
  const join = (parts: ReadonlyArray<string>) => `%${Arr.join(parts, "")}%`
  const before = (i: number) => Arr.take(letters, i)
  const after = (i: number) => Arr.drop(letters, i)
  // `Arr.range` is never empty (a range that runs backwards is its start), so an empty one is said here.
  const indices = (from: number, to: number): ReadonlyArray<number> => (from > to ? [] : Arr.range(from, to))
  const dropped = Arr.map(indices(0, n - 1), (i) => join([...before(i), ...after(i + 1)]))
  const wrong = Arr.map(indices(1, n - 2), (i) => join([...before(i), "_", ...after(i + 1)]))
  const missing = Arr.map(indices(1, n - 1), (i) => join([...before(i), "_", ...after(i)]))
  const swapped = Arr.flatMap(indices(0, n - 2), (i) => {
    const a = letters[i] ?? ""
    const b = letters[i + 1] ?? ""
    return a === b ? [] : [join([...before(i), b, a, ...after(i + 2)])]
  })
  return Arr.dedupe([...dropped, ...wrong, ...missing, ...swapped])
}

/**
 * How one word of a search is compared. `Indexed`: looked up in the full-text index as typed. `Contains`: too short
 * for the index, compared as text. `Close`: not in the organization's items as typed, so compared with one letter
 * different.
 */
export type WordMatch =
  | { readonly _tag: "Indexed"; readonly word: string; readonly phrase: string }
  | { readonly _tag: "Contains"; readonly word: string; readonly patterns: ReadonlyArray<string> }
  | { readonly _tag: "Close"; readonly word: string; readonly patterns: ReadonlyArray<string> }

/**
 * The words that need asking first whether the organization's items contain them as typed: those long enough to be
 * read with one letter different if they do not.
 */
export const wordsToCheck = (words: ReadonlyArray<string>): ReadonlyArray<string> =>
  Arr.filter(words, (word) => characters(word) >= closeFrom)

/**
 * How each word is compared, given which words the organization's items contain as typed (`found`, from the
 * index). A word the items contain is never read as a typo, so a correctly typed word never brings in near misses.
 *
 * @example
 * plan({ words: ["m8", "washr"], found: [] })
 * // [{ _tag: "Contains", word: "m8", patterns: ["%m8%"] }, { _tag: "Close", word: "washr", patterns: [...] }]
 */
export const plan = (input: {
  readonly words: ReadonlyArray<string>
  readonly found: ReadonlyArray<string>
}): ReadonlyArray<WordMatch> =>
  Arr.map(input.words, (word): WordMatch => {
    const n = characters(word)
    if (n < indexedFrom) return { _tag: "Contains", word, patterns: [contains(word)] }
    if (n < closeFrom || Arr.contains(input.found, word)) return { _tag: "Indexed", word, phrase: phrase(word) }
    return { _tag: "Close", word, patterns: closeMatches(word) }
  })
