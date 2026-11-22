// What a law that follows names may spend on one file, and what it refuses to read at all. Before the parser is handed
// a file, a scan refuses one too large, or nested deeper than the parser survives (the parser dies on it, natively,
// past any catch). While a law reads, it counts its steps (at most a multiple of the file's length plus a base, never
// past a ceiling), the judgements it makes inside one another by following names, and its reads inside one another of
// any kind, far below what overflows the stack. A file past any of these is refused with one finding in words that
// say why, at the place the law was reading: never read without end, never thrown on, never passed in silence.
import * as A from "effect/Array"
import * as Data from "effect/Data"
import * as Str from "effect/String"

/**
 * Steps each law may take for each character of a file, up to `maxSteps`: at least thirty times what each file of this
 * repository it reads needs (the least, 31 times, the tags law on `effectImportsCode.ts`).
 */
export const refsStepsPerCharacter = 32
export const tagsStepsPerCharacter = 46

/** Steps a law may take on any file, however short. */
export const baseSteps = 400_000

/**
 * Steps a law may take on any file, however long: what a file of any shape costs stops growing here, so a law ends on
 * it in about two seconds and well under a gigabyte. The heaviest file of this repository needs 109,846 (the tags
 * law on `Draft.machine.test.ts`).
 */
export const maxSteps = 4_000_000

/** How many judgements a law may make inside one another by following names: our deepest file needs 4. */
export const maxDepth = 200

/**
 * How many reads a law may make inside one another, of any kind (a value inside a value, a judgement inside a
 * judgement): about half of what node's stack holds on the read that takes the most of it (a pattern nested in
 * objects, 737 deep); our deepest file needs 25. A walk of the whole tree keeps its own list and is not counted.
 */
export const maxNesting = 400

/**
 * How deep brackets may nest (a template's `${` counted as one), outside strings, comments and regular expressions:
 * the parser dies on parentheses nested about 5,700 deep and on templates about 5,000 deep; our deepest file has 18.
 */
export const maxBrackets = 1000

/**
 * How many operators one expression or statement may chain before it ends (each character of `+`, `?:`, `=>`, `<>`,
 * `.` and their kin, a word such as `else`, `typeof` or `as`, and a bracket where it opens), counted along its
 * brackets from the outermost: a comma, a semicolon, or a line end between two words that neither joins ends one, and
 * an element once closed chains nothing after it. The parser dies first on types nested in each other's arguments,
 * about 5,700 deep (`A<A<…>>`, refused from 2,000); our longest chain is 195.
 */
export const maxChain = 4000

/** The largest file a law reads, in characters: ten times our largest source file (98,433). */
export const maxFileSize = 1_000_000

/** Why a law did not read a file. */
export type Unread = Data.TaggedEnum<{
  /** Its names lead into each other past the steps the file allows, or past `maxDepth` judgements. */
  Names: {}
  /** It is nested past `maxNesting`, `maxBrackets` or `maxChain`. */
  Nested: {}
  /** It is longer than `maxFileSize`. */
  Large: {}
  /** The parser read it with errors: the first is `message`. */
  Unparsed: { readonly message: string }
}>

/** The constructors, guards and matcher of `Unread`. */
export const Unread = Data.taggedEnum<Unread>()

/**
 * What a law says of a file it did not read, for each reason.
 *
 * @example unreadSentence(Unread.Large()) // "the file is longer than the 1000000 characters a law reads: split it"
 */
export const unreadSentence: (unread: Unread) => string = Unread.$match({
  Names: () =>
    "the names here lead into each other too far for the law to read in the steps it allows a file this long: write it with fewer steps (one name for one value, given where it is used)",
  Nested: () =>
    "the code here is nested too deep to read: write it with fewer brackets, choices or operators inside one another (a name for a part, a list for many)",
  Large: () => `the file is longer than the ${maxFileSize} characters a law reads: split it`,
  Unparsed: ({ message }) => `the file could not be parsed (${message}): the law reads it once it parses`
})

/** Where a law stopped reading a file, and why. */
export interface Stopped {
  readonly at: number
  readonly unread: Unread
}

/** What a law has spent on one file, where it was reading, and the steps and depths it may still take. */
export interface Budget {
  /** The steps taken so far: never more than `limit`. */
  readonly steps: () => number
  /** The steps the file allows. */
  readonly limit: number
  /** The judgements made inside one another by following names, now and at most. */
  readonly depth: () => number
  readonly deepest: () => number
  /** The reads made inside one another, of any kind, now and at most. */
  readonly nesting: () => number
  readonly nestedMost: () => number
  /** Where and why the law stopped, once it has. */
  readonly stopped: () => Stopped | undefined
  /**
   * Counts `count` steps where the law is reading (at the offset `at`, when it says): false once the file's steps are
   * spent, and from then on.
   */
  readonly tick: (count?: number, at?: number) => boolean
  /**
   * `read()` as one read inside the one being made, at the offset `at` (where the last began, when it has none of its
   * own), a step; `fallback` when the steps or the nesting run out: what is answered then is never read, since the
   * whole file is refused.
   */
  readonly within: <A>(at: number | undefined, fallback: A, read: () => A) => A
  /** `within`, for a judgement that follows a name to what it stands for: one deeper by `depth` as well. */
  readonly following: <A>(at: number | undefined, fallback: A, judge: () => A) => A
}

/**
 * The budget of one file of `length` characters, for a law that may take `perCharacter` steps on each.
 *
 * @example budgetOf({ length: 100, perCharacter: refsStepsPerCharacter }).limit // 403200
 */
export const budgetOf = (input: { readonly length: number; readonly perCharacter: number }): Budget => {
  const { length, perCharacter } = input
  const limit = Math.min(perCharacter * length + baseSteps, maxSteps)
  let steps = 0
  let depth = 0
  let deepest = 0
  let nesting = 0
  let nestedMost = 0
  let at = 0
  let stopped: Stopped | undefined
  const stop = (unread: Unread): false => {
    if (stopped === undefined) stopped = { at, unread }
    return false
  }
  const tick = (count = 1, offset?: number): boolean => {
    if (stopped !== undefined) return false
    if (offset !== undefined) at = offset
    if (steps + count > limit) return stop(Unread.Names())
    steps += count
    return true
  }
  const enter = (offset: number | undefined, follows: boolean): boolean => {
    if (stopped !== undefined) return false
    if (offset !== undefined) at = offset
    if (!tick()) return false
    if (follows && depth >= maxDepth) return stop(Unread.Names())
    if (nesting >= maxNesting) return stop(Unread.Nested())
    nesting += 1
    if (nesting > nestedMost) nestedMost = nesting
    if (follows) {
      depth += 1
      if (depth > deepest) deepest = depth
    }
    return true
  }
  const read =
    (follows: boolean) =>
    <A>(offset: number | undefined, fallback: A, judge: () => A): A => {
      if (!enter(offset, follows)) return fallback
      const answer = judge()
      nesting -= 1
      if (follows) depth -= 1
      return answer
    }
  return {
    steps: () => steps,
    limit,
    depth: () => depth,
    deepest: () => deepest,
    nesting: () => nesting,
    nestedMost: () => nestedMost,
    stopped: () => stopped,
    tick,
    within: read(false),
    following: read(true)
  }
}

/**
 * Where and why a law stops when the parser read a file with errors: at the first, in its words. A law that read the
 * tree of such a file would judge what the parser guessed, and pass what it dropped.
 *
 * @example parseFailure([{ message: "Unexpected token", labels: [{ start: 11 }] }])?.at // 11
 */
export const parseFailure = (
  errors: ReadonlyArray<{ readonly message: string; readonly labels: ReadonlyArray<{ readonly start: number }> }>
): Stopped | undefined => {
  const [first] = errors
  if (first === undefined) return undefined
  const [label] = first.labels
  return { at: label === undefined ? 0 : label.start, unread: Unread.Unparsed({ message: first.message }) }
}

// What the scan tells apart.
const operators = Array.from("+-*/%&|^!~<>=?:.")
const isOperator = (char: string): boolean => A.contains(operators, char)
const isWordChar = (char: string): boolean =>
  (char >= "0" && char <= "9") ||
  (char >= "A" && char <= "Z") ||
  (char >= "a" && char <= "z") ||
  char === "_" ||
  char === "$" ||
  char > "\x7f"
const isSpace = (char: string): boolean =>
  char === " " || char === "\t" || char === "\r" || char === "\n" || char === "﻿"
/** The words that join what is before them to what is after: a line end beside one ends nothing. */
const joiningWords = ["else", "as", "in", "instanceof", "extends", "satisfies", "is"]
/** The words that join what follows them only: a line end after one ends nothing. */
const leadingWords = [
  "typeof",
  "void",
  "await",
  "new",
  "delete",
  "yield",
  "keyof",
  "readonly",
  "unique",
  "infer",
  "asserts",
  "do"
]
/**
 * The words that open a statement's head: once its parentheses close, they join the statement it governs to them, so
 * heads nested without braces (`if (a)` on each line, as the parser reads them, one inside another) chain as one.
 */
const headWords = ["if", "while", "for", "with"]
/** The words after which a `/` starts a regular expression. */
const beforeRegex = [
  "return",
  "case",
  "do",
  "else",
  "in",
  "of",
  "new",
  "delete",
  "void",
  "throw",
  "yield",
  "await",
  "typeof",
  "instanceof"
]

/**
 * Where a law refuses `source` before parsing it, and why, if it does: longer than `maxFileSize`, brackets deeper than
 * `maxBrackets`, or one expression or statement chaining more than `maxChain` operators (statements' heads nested
 * without braces, `if (a)` on each line, chain as one). Strings, comments, a template's text and
 * regular expressions are skipped, so a bracket in them neither opens nor closes; a closing bracket with none open is
 * passed over. A quote straight after a letter is a letter (JSX text: `Don't`).
 *
 * @example unreadable("f([x])") // undefined
 */
export const unreadable = (source: string): Stopped | undefined => {
  const length = source.length
  if (length > maxFileSize) return { at: 0, unread: Unread.Large() }
  const charAt = (offset: number): string => source[offset] ?? ""
  const nested = (offset: number): Stopped => ({ at: offset, unread: Unread.Nested() })
  // For each bracket open, whether it is a template's `${`, and whether it is a statement's head (`if (`); what each
  // has chained since it last ended; and for each element written in it and not yet closed (`<p`, or a type's `<T`,
  // which never is), what it had chained before.
  const opened: Array<boolean> = []
  const heads: Array<boolean> = []
  const chained: Array<number> = [0]
  const elements: Array<Array<number>> = [[]]
  let total = 0
  // Whether what came last joins what follows to it, whether a line ended since, whether a `/` starts a regex.
  let joins = true
  let lineEnded = false
  let regexNext = true
  let inTemplate = false
  // Whether the next `(` opens a statement's head, and whether a `;` ended a statement an `else` may still continue.
  let headNext = false
  let endPending = false
  let at = 0
  const count = (): boolean => {
    total += 1
    chained[chained.length - 1] = (chained[chained.length - 1] ?? 0) + 1
    return total <= maxChain
  }
  const end = (): void => {
    total -= chained[chained.length - 1] ?? 0
    chained[chained.length - 1] = 0
  }
  // An element closed (`</p>`, `/>`) chains nothing after it: its siblings are beside it, not inside it.
  const closeElement = (): void => {
    const before = elements[elements.length - 1]?.pop()
    const now = chained[chained.length - 1] ?? 0
    if (before !== undefined && now > before) {
      total -= now - before
      chained[chained.length - 1] = before
    }
  }
  const open = (template: boolean, head = false): boolean => {
    opened.push(template)
    heads.push(head)
    chained.push(0)
    elements.push([])
    return opened.length <= maxBrackets
  }
  while (at < length) {
    const char = charAt(at)
    if (inTemplate) {
      // A template's text, to its end or its next `${`.
      if (char === "\\") at += 2
      else if (char === "`") {
        at += 1
        inTemplate = false
        joins = false
        regexNext = false
      } else if (char === "$" && charAt(at + 1) === "{") {
        if (!count() || !open(true)) return nested(at)
        at += 2
        inTemplate = false
        joins = true
        regexNext = true
      } else at += 1
      continue
    }
    if (isSpace(char)) {
      if (char === "\n") lineEnded = true
      at += 1
      continue
    }
    const next = charAt(at + 1)
    if (char === "/" && next === "/") {
      while (at < length && charAt(at) !== "\n") at += 1
      continue
    }
    if (char === "/" && next === "*") {
      at += 2
      while (at < length && !(charAt(at) === "*" && charAt(at + 1) === "/")) {
        if (charAt(at) === "\n") lineEnded = true
        at += 1
      }
      at += 2
      continue
    }
    let after = at
    while (after < length && isWordChar(charAt(after))) after += 1
    const word = Str.slice(at, after)(source)
    // A statement a `;` ended goes on in an `else` (an else-if chain is one statement nested in another), and else
    // ended there.
    if (endPending && word !== "else") end()
    endPending = false
    // A line ended between two words neither of which joins the other: what was before it has ended.
    if (lineEnded && !joins && !isOperator(char) && !A.contains(joiningWords, word)) end()
    lineEnded = false
    if (word !== "") {
      at = after
      const chains = A.contains(joiningWords, word) || A.contains(leadingWords, word)
      if (chains && !count()) return nested(at)
      joins = chains
      regexNext = A.contains(beforeRegex, word)
      headNext = A.contains(headWords, word) || (headNext && word === "await")
      // A quote straight after a letter is part of the text it is in.
      while (charAt(at) === "'" || charAt(at) === '"') at += 1
      continue
    }
    at += 1
    const head = headNext && char === "("
    headNext = false
    if (char === "'" || char === '"') {
      while (at < length) {
        const inner = charAt(at)
        if (inner === "\n") break
        at += inner === "\\" ? 2 : 1
        if (inner === char) break
      }
      joins = false
      regexNext = false
    } else if (char === "`") inTemplate = true
    else if (char === "(" || char === "[" || char === "{") {
      if (!count() || !open(false, head)) return nested(at - 1)
      joins = true
      regexNext = true
    } else if (char === ")" || char === "]" || char === "}") {
      const template = opened.pop()
      const closedHead = heads.pop() === true
      if (template !== undefined) {
        // What a bracket chained is chained by what holds it.
        const inner = chained.pop() ?? 0
        elements.pop()
        chained[chained.length - 1] = (chained[chained.length - 1] ?? 0) + inner
      }
      inTemplate = template === true
      // A head's parentheses join the statement it governs to them: a line end after them ends nothing.
      joins = closedHead
      regexNext = closedHead
    } else if (char === ",") {
      end()
      joins = true
      regexNext = true
    } else if (char === ";") {
      // What it ends is ended at the next word, unless that word is `else`.
      endPending = true
      joins = true
      regexNext = true
    } else if (char === "<" && charAt(at) === "/") {
      // A closing tag, read whole.
      while (at < length && charAt(at) !== ">" && charAt(at) !== "\n") at += 1
      at += 1
      closeElement()
      joins = false
      regexNext = false
    } else if (char === "/" && charAt(at) === ">" && A.isReadonlyArrayNonEmpty(elements[elements.length - 1] ?? [])) {
      at += 1
      closeElement()
      joins = false
      regexNext = false
    } else if (char === "/" && regexNext) {
      // A regular expression, its classes and escapes skipped, to its end or the line's.
      let inClass = false
      while (at < length) {
        const inner = charAt(at)
        if (inner === "\n") break
        at += inner === "\\" ? 2 : 1
        if (inner === "[") inClass = true
        else if (inner === "]") inClass = false
        else if (inner === "/" && !inClass) break
      }
      joins = false
      regexNext = false
    } else if (isOperator(char)) {
      // An element, or a type's arguments, opened.
      if (char === "<" && (isWordChar(charAt(at)) || charAt(at) === ">")) {
        elements[elements.length - 1]?.push(chained[chained.length - 1] ?? 0)
      }
      if (!count()) return nested(at - 1)
      joins = true
      regexNext = true
    } else {
      joins = false
      regexNext = false
    }
  }
  return undefined
}
