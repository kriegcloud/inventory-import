// The `try` statements of one file: in its code, read from the syntax tree, and in the code examples of its doc
// comments (an `@example`, or a fenced block of code), each parsed on its own, or, when it does not parse as a
// module, scanned with the code's strings, regular expressions and comments skipped. It ends on any input: the scan
// before parsing (`budget.ts`) refuses what the parser cannot survive; the walk keeps its own list, so no file nests
// it past the stack, and visits each node once; the fragment scan moves forward at every turn. So it takes no step
// budget: its work grows with the file's length and no faster. A file, or an example, that the scan or the parser
// refuses is refused at the place being read: never passed in silence.
import * as A from "effect/Array"
import * as O from "effect/Option"
import * as Order from "effect/Order"
import * as P from "effect/Predicate"
import * as R from "effect/Record"
import * as Str from "effect/String"
import { parseSync } from "oxc-parser"
import { parseFailure, type Stopped, Unread, unreadable } from "./budget.ts"
import { linesOf } from "./lines.ts"

/** A node of the syntax tree. */
type Node = Readonly<Record<string, unknown>> & { readonly type: string; readonly start: number; readonly end: number }

const isNode = (value: unknown): value is Node =>
  P.isObject(value) && P.isString(value["type"]) && P.isNumber(value["start"]) && P.isNumber(value["end"])
const children = (node: Node): ReadonlyArray<Node> =>
  A.flatMap(R.toEntries(node), ([key, value]) =>
    key === "parent" ? [] : A.isArray(value) ? A.filter(value, isNode) : isNode(value) ? [value] : []
  )

/** What a `try` statement has beside its block: a `catch`, a `finally`, or both. */
export type TryForm = "catch" | "finally" | "both"

/** One `try` statement: its line, from 1, its form, and whether it is in a doc comment's example. */
export interface TryAt {
  readonly line: number
  readonly form: TryForm
  readonly inExample: boolean
}

/** What reading one file gives: the statements, or where and why the law stopped. */
export interface TryRead {
  /** The statements, by line; none when the law stopped. */
  readonly found: ReadonlyArray<TryAt>
  /** Where the law stopped reading and why (`budget.ts`): then nothing else of the file is said. */
  readonly unread: O.Option<{ readonly line: number; readonly unread: Unread }>
}

/** One statement found in a piece of code: its offset there, and its form. */
interface Statement {
  readonly at: number
  readonly form: TryForm
}

const formOf = (caught: boolean, final: boolean): TryForm => (caught && final ? "both" : final ? "finally" : "catch")

/** Every `try` statement under `program`, each node visited once, from a list of its own rather than the stack. */
const statementsIn = (program: Node): ReadonlyArray<Statement> => {
  const found: Array<Statement> = []
  const left: Array<Node> = [program]
  for (let node = left.pop(); node !== undefined; node = left.pop()) {
    if (node.type === "TryStatement") {
      found.push({ at: node.start, form: formOf(isNode(node["handler"]), isNode(node["finalizer"])) })
    }
    for (const next of A.reverse(children(node))) left.push(next)
  }
  return found
}

/** The languages a fenced block is code in, by its first word; a fence with none is code too. */
const codeFences = ["", "ts", "tsx", "js", "jsx", "mts", "mjs", "cts", "cjs", "typescript", "javascript"]

/**
 * The block tags of JSDoc and TSDoc: one of them on its own line ends an `@example`. Any other `@name` there is code (a
 * decorator), so a method under `@dec` is read with its example.
 */
const blockTags = [
  "abstract",
  "access",
  "alias",
  "alpha",
  "augments",
  "author",
  "beta",
  "borrows",
  "callback",
  "category",
  "class",
  "constant",
  "constructor",
  "copyright",
  "default",
  "defaultValue",
  "deprecated",
  "description",
  "enum",
  "event",
  "eventProperty",
  "example",
  "experimental",
  "exports",
  "extends",
  "file",
  "fileoverview",
  "fires",
  "function",
  "generator",
  "ignore",
  "implements",
  "inheritDoc",
  "interface",
  "internal",
  "license",
  "listens",
  "memberof",
  "module",
  "namespace",
  "overload",
  "override",
  "packageDocumentation",
  "param",
  "privateRemarks",
  "property",
  "remarks",
  "requires",
  "returns",
  "return",
  "satisfies",
  "see",
  "since",
  "summary",
  "template",
  "this",
  "throws",
  "todo",
  "type",
  "typedef",
  "typeParam",
  "version",
  "yields"
]

/** One code example of a doc comment: its text, and the line of the file its first line is on. */
interface Example {
  readonly code: string
  readonly line: number
}

/** A fence that opens a block: its mark (three or more backticks or tildes), and the language its first word names. */
const fenceOpening = (text: string): O.Option<{ readonly mark: string; readonly code: boolean }> =>
  O.map(Str.match(/^\s*(`{3,}|~{3,})\s*([^\s{:,;`]*)/)(text), (found) => ({
    mark: `${found[1]}`,
    code: A.contains(codeFences, Str.toLowerCase(`${found[2]}`))
  }))

/** Whether `text` closes a block its `mark` opened: the same character, at least as many, and nothing after. */
const closesFence = (text: string, mark: string): boolean =>
  O.match(Str.match(/^\s*(`{3,}|~{3,})\s*$/)(text), {
    onNone: () => false,
    onSome: (found) => {
      const closing = `${found[1]}`
      return Str.startsWith(Str.slice(0, 1)(mark))(closing) && closing.length >= mark.length
    }
  })

/**
 * The code examples of one doc comment, whose text (what is between its opening and closing marks) starts on `line`:
 * each fenced block of code (three or more backticks or tildes, its language the first word after them, an attribute
 * such as `ts:line-numbers` or `ts title="x"` set aside), and what follows an `@example` tag up to the next block tag,
 * a fence between and the code after it included, each line with its leading `*` and one space taken off.
 */
const examplesOf = (value: string, line: number): ReadonlyArray<Example> => {
  const examples: Array<Example> = []
  let lines: Array<string> = []
  let first = 0
  // Outside a fence: in prose, or in an `@example`. In a fence: its mark, whether it holds code, and where it returns.
  let outside: "prose" | "example" = "prose"
  let fence: O.Option<{ readonly mark: string; readonly code: boolean }> = O.none()
  const close = (): void => {
    if (A.some(lines, (text) => Str.isNonEmpty(Str.trim(text)))) {
      examples.push({ code: A.join(lines, "\n"), line: first })
    }
    lines = []
  }
  A.forEach(Str.split("\n")(value), (raw, index) => {
    const text = Str.replace(/^\s*\*? ?/, "")(raw)
    const here = line + index
    if (O.isSome(fence)) {
      if (closesFence(text, fence.value.mark)) {
        close()
        fence = O.none()
      } else if (fence.value.code) lines.push(text)
      return
    }
    const opening = fenceOpening(text)
    if (O.isSome(opening)) {
      close()
      fence = opening
      first = here + 1
      return
    }
    const tag = Str.match(/^\s*@(\w+)/)(text)
    if (O.isSome(tag) && (outside === "prose" || A.contains(blockTags, `${tag.value[1]}`))) {
      close()
      outside = tag.value[1] === "example" ? "example" : "prose"
      if (outside === "example") {
        lines.push(Str.replace(/^\s*@example\s?/, "")(text))
        first = here
      }
      return
    }
    if (outside === "example") {
      // Code after a fence, under the same `@example`, is an example of its own, from its first line.
      if (A.isArrayEmpty(lines)) first = here
      lines.push(text)
    }
  })
  close()
  return examples
}

const isWordChar = (char: string): boolean =>
  (char >= "0" && char <= "9") ||
  (char >= "A" && char <= "Z") ||
  (char >= "a" && char <= "z") ||
  char === "_" ||
  char === "$" ||
  char > "\x7f"
const isSpace = (char: string): boolean => char === " " || char === "\t" || char === "\r" || char === "\n"

/** What a `/` may follow to start a regular expression, not a division: a mark that opens or joins, or a keyword. */
const marksBeforeRegex = [
  "",
  "(",
  ",",
  "=",
  ":",
  "[",
  "!",
  "&",
  "|",
  "?",
  "{",
  "}",
  ";",
  "+",
  "-",
  "*",
  "%",
  "<",
  ">",
  "~",
  "^",
  "…"
]
const wordsBeforeRegex = [
  "return",
  "typeof",
  "instanceof",
  "in",
  "of",
  "new",
  "delete",
  "void",
  "throw",
  "case",
  "do",
  "else",
  "yield",
  "await"
]

/**
 * Each `try` statement in example code that does not parse as a module: the word `try`, not a member's name
 * (`Effect.try`), with a `{` next, outside strings, templates, regular expressions and comments. Its form is told by
 * the `catch` and `finally` that follow it, before the next `try`. Each turn moves forward by a character at least.
 */
const scanned = (code: string): ReadonlyArray<Statement> => {
  const found: Array<{ at: number; caught: boolean; final: boolean }> = []
  const length = code.length
  const charAt = (offset: number): string => code[offset] ?? ""
  let at = 0
  let before = ""
  let lastWord = ""
  while (at < length) {
    const char = charAt(at)
    const next = charAt(at + 1)
    if (char === "/" && next === "/") {
      while (at < length && charAt(at) !== "\n") at += 1
      continue
    }
    if (char === "/" && next === "*") {
      at += 2
      while (at < length && !(charAt(at) === "*" && charAt(at + 1) === "/")) at += 1
      at += 2
      continue
    }
    // A regular expression, read to its closing `/` outside a class (`[/]`), never past its line: a quote or a `try`
    // in it is neither a string nor a statement.
    if (
      char === "/" &&
      (A.contains(marksBeforeRegex, before) || (before === "w" && A.contains(wordsBeforeRegex, lastWord)))
    ) {
      at += 1
      let inClass = false
      while (at < length && charAt(at) !== "\n" && (inClass || charAt(at) !== "/")) {
        if (charAt(at) === "\\") at += 1
        else if (charAt(at) === "[") inClass = true
        else if (charAt(at) === "]") inClass = false
        at += 1
      }
      at += 1
      before = ")"
      continue
    }
    if (char === "'" || char === '"' || char === "`") {
      at += 1
      while (at < length && charAt(at) !== char && (char === "`" || charAt(at) !== "\n")) {
        at += charAt(at) === "\\" ? 2 : 1
      }
      at += 1
      before = char
      continue
    }
    if (isWordChar(char)) {
      let after = at
      while (after < length && isWordChar(charAt(after))) after += 1
      const word = Str.slice(at, after)(code)
      const last = found[found.length - 1]
      if (word === "try" && before !== ".") {
        let ahead = after
        while (ahead < length && isSpace(charAt(ahead))) ahead += 1
        if (charAt(ahead) === "{") found.push({ at, caught: false, final: false })
      } else if (last !== undefined && before !== "." && (word === "catch" || word === "finally")) {
        found[found.length - 1] = { ...last, ...(word === "catch" ? { caught: true } : { final: true }) }
      }
      before = "w"
      lastWord = word
      at = after
      continue
    }
    // A spread, or the `...` an example writes for what it leaves out, is no member's dot.
    if (char === "." && next === "." && charAt(at + 2) === ".") {
      before = "…"
      at += 3
      continue
    }
    if (!isSpace(char)) before = char
    at += 1
  }
  return A.map(found, ({ at: offset, caught, final }) => ({ at: offset, form: formOf(caught, final) }))
}

/** What the parser makes of one module: its tree, its comments, and where it failed, if it did. */
interface Parsed {
  readonly program: O.Option<Node>
  readonly comments: ReadonlyArray<unknown>
  readonly failed: O.Option<Stopped>
}

const parsedAs = (file: string, source: string): Parsed => {
  const result = parseSync(file, source)
  const program: unknown = result.program
  const tree = O.liftPredicate(program, isNode)
  return {
    program: tree,
    comments: result.comments,
    failed: O.fromUndefinedOr(parseFailure(result.errors))
  }
}

/** A doc comment: a block comment whose text starts with `*`. */
const docComment = (comment: unknown): O.Option<{ readonly value: string; readonly start: number }> =>
  P.isObject(comment) &&
  comment["type"] === "Block" &&
  P.isString(comment["value"]) &&
  P.isNumber(comment["start"]) &&
  Str.startsWith("*")(comment["value"])
    ? O.some({ value: comment["value"], start: comment["start"] })
    : O.none()

const byLine: Order.Order<TryAt> = Order.mapInput(Order.Number, (found: TryAt) => found.line)

/**
 * Every `try` statement of `source`, in its code and in its doc comments' examples, or where and why it was not read.
 *
 * @example readTry({ file: "Tab.atoms.ts", source: "try {\n  go()\n} catch {}" }).found // [{ line: 1, form: "catch", inExample: false }]
 */
export const readTry = (input: { readonly file: string; readonly source: string }): TryRead => {
  const { file, source } = input
  const lineAt = linesOf(source)
  const unreadAt = (stopped: Stopped, line = lineAt(stopped.at)): TryRead => ({
    found: [],
    unread: O.some({ line, unread: stopped.unread })
  })
  const refused = unreadable(source)
  if (refused !== undefined) return unreadAt(refused)
  const whole = parsedAs(file, source)
  if (O.isSome(whole.failed)) return unreadAt(whole.failed.value)
  // The parser gives a program for any text; were it ever to give none, the file is refused, not passed.
  if (O.isNone(whole.program)) return unreadAt({ at: 0, unread: Unread.Unparsed({ message: "no program" }) })
  const found: Array<TryAt> = A.map(statementsIn(whole.program.value), ({ at, form }) => ({
    line: lineAt(at),
    form,
    inExample: false
  }))
  for (const comment of A.getSomes(A.map(whole.comments, docComment))) {
    for (const example of examplesOf(comment.value, lineAt(comment.start))) {
      const exampleLine = linesOf(example.code)
      // A place in the example, as a line of the file.
      const lineOf = (offset: number): number => example.line + exampleLine(offset) - 1
      const deep = unreadable(example.code)
      if (deep !== undefined) return unreadAt(deep, lineOf(deep.at))
      // An example is a module of TypeScript, or of TSX when it writes an element; one that is neither is scanned.
      const asTs = parsedAs("example.ts", example.code)
      const module = O.isNone(asTs.failed)
        ? O.some(asTs)
        : O.liftPredicate(parsedAs("example.tsx", example.code), (read) => O.isNone(read.failed))
      const statements = O.match(
        O.flatMap(module, (read) => read.program),
        {
          onNone: () => scanned(example.code),
          onSome: (program) => statementsIn(program)
        }
      )
      for (const { at, form } of statements) found.push({ line: lineOf(at), form, inExample: true })
    }
  }
  return { found: A.sort(found, byLine), unread: O.none() }
}
