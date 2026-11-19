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
