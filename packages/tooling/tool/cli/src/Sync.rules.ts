/**
 * Reading and repairing configuration as text. The sync commands change one value in a file a person wrote, so they
 * never decode a file and print it again: a comment, the order of keys and the layout stay as they were. A file is
 * decoded through a schema to learn what it says, and the same text is searched for the stretch that says it.
 *
 * @packageDocumentation
 */
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as S from "effect/Schema"
import * as Str from "effect/String"
import { RepoError } from "./Cli.errors.ts"

/** The widest line the formatter leaves alone (`printWidth` in `.oxfmtrc.json`). */
export const printWidth = 120

/**
 * JSON-with-comments text with every comment turned into spaces, so an offset into the result is the same offset
 * into the file, and a key in a comment is never mistaken for the file's own.
 *
 * @category rules
 */
export const blankComments = (text: string): string => {
  let blanked = ""
  let i = 0
  while (i < text.length) {
    const c = text[i] ?? ""
    if (c === '"') {
      let j = i + 1
      while (j < text.length && text[j] !== '"') j += text[j] === "\\" ? 2 : 1
      blanked += Str.slice(i, j + 1)(text)
      i = j + 1
    } else if (c === "/" && text[i + 1] === "/") {
      while (i < text.length && text[i] !== "\n") {
        blanked += " "
        i += 1
      }
    } else if (c === "/" && text[i + 1] === "*") {
      const close = O.getOrElse(Str.indexOf("*/")(Str.slice(i + 2)(text)), () => text.length)
      const end = Math.min(text.length, i + 2 + close + 2)
      blanked += Str.replace(/[^\n]/g, " ")(Str.slice(i, end)(text))
      i = end
    } else {
      blanked += c
      i += 1
    }
  }
  return blanked
}

/**
 * Decodes JSON, or JSON with comments and trailing commas, through a schema. What does not decode is a sentence
 * naming the file.
 *
 * @category rules
 */
export const decodeJsonc =
  <Sch extends S.Constraint>(schema: Sch) =>
  (file: string, text: string): Effect.Effect<Sch["Type"], RepoError, Sch["DecodingServices"]> =>
    S.decodeEffect(S.fromJsonString(schema))(Str.replace(/,(\s*[}\]])/g, "$1")(blankComments(text))).pipe(
      Effect.mapError((cause) =>
        RepoError.make({ path: file, message: `${file} is not what was expected: ${cause.message}` })
      )
    )

/** A string found in a file: what it says and where its characters are, the quotes left out. */
export interface Found {
  readonly value: string
  readonly start: number
  readonly end: number
}

/** A string with every character a regular expression reads as its own taken literally. */
export const literally = (text: string): string => Str.replace(/[.*+?^${}()|[\]\\/-]/g, "\\$&")(text)

/**
 * Every `"key": "value"` of a JSON file, comments left out, in the order they are written.
 *
 * @category rules
 */
export const stringValues =
  (key: string) =>
  (text: string): ReadonlyArray<Found> =>
    A.map(
      A.fromIterable(
        Str.matchAll(new RegExp(`"${literally(key)}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`, "g"))(blankComments(text))
      ),
      (match) => {
        const value = match[1] ?? ""
        const end = (match.index ?? 0) + match[0].length - 1
        return { value, start: end - value.length, end }
      }
    )

/** An array or object found in a file: from its opening bracket to after its closing one, and what is around it. */
export interface FoundBlock {
  readonly start: number
  readonly end: number
  /** The white space the line of its key starts with. */
  readonly indent: string
  /** How many characters are before its opening bracket on that line. */
  readonly before: number
  /** How many characters follow its closing bracket on its last line. */
  readonly after: number
}

const blockOf =
  (open: "[" | "{", close: "]" | "}") =>
  (key: string) =>
  (text: string): O.Option<FoundBlock> => {
    const blanked = blankComments(text)
    const opening = new RegExp(`"${literally(key)}"\\s*:\\s*\\${open}`).exec(blanked)
    if (opening === null) return O.none()
    const start = opening.index + opening[0].length - 1
    let depth = 0
    let i = start
    while (i < blanked.length) {
      const c = blanked[i]
      if (c === '"') {
        i += 1
        while (i < blanked.length && blanked[i] !== '"') i += blanked[i] === "\\" ? 2 : 1
      } else if (c === open) {
        depth += 1
      } else if (c === close) {
        depth -= 1
        if (depth === 0) break
      }
      i += 1
    }
    if (i >= blanked.length) return O.none()
    const end = i + 1
    const lineStart = O.match(Str.lastIndexOf("\n")(Str.slice(0, start)(text)), {
      onNone: () => 0,
      onSome: (index) => index + 1
    })
    const lineEnd = O.match(Str.indexOf("\n")(Str.slice(end)(text)), {
      onNone: () => text.length,
      onSome: (index) => end + index
    })
    const indent = /^[ \t]*/.exec(Str.slice(lineStart)(text))?.[0] ?? ""
    return O.some({ start, end, indent, before: start - lineStart, after: lineEnd - end })
  }

/**
 * The array a key holds, the first time the key is written.
 *
 * @category rules
 */
export const arrayOf = blockOf("[", "]")

/**
 * The object a key holds, the first time the key is written.
 *
 * @category rules
 */
export const objectOf = blockOf("{", "}")

/**
 * The strings written directly in a stretch of a file, in order.
 *
 * @category rules
 */
export const stringsIn =
  (span: { readonly start: number; readonly end: number }) =>
  (text: string): ReadonlyArray<Found> =>
    A.map(
      A.fromIterable(Str.matchAll(/"((?:[^"\\]|\\.)*)"/g)(Str.slice(span.start, span.end)(blankComments(text)))),
      (match) => {
        const value = match[1] ?? ""
        const from = span.start + (match.index ?? 0) + 1
        return { value, start: from, end: from + value.length }
      }
    )

/**
 * An array as the formatter leaves it: on one line when that line stays within the print width, otherwise one item
 * a line, with no trailing comma. `items` are already JSON.
 *
 * @example
 * renderArray({ indent: "  ", before: 12, after: 1 })(['"package.json"', '"apps/*\/package.json"'])
 * // '["package.json", "apps/*\/package.json"]'
 *
 * @category rules
 */
export const renderArray =
  (at: { readonly indent: string; readonly before: number; readonly after: number }) =>
  (items: ReadonlyArray<string>): string => {
    const oneLine = `[${A.join(items, ", ")}]`
    if (at.before + oneLine.length + at.after <= printWidth) return oneLine
    return `[\n${A.join(
      A.map(items, (item) => `${at.indent}  ${item}`),
      ",\n"
    )}\n${at.indent}]`
  }

/** The line an offset is on, from 1. */
export const lineAt =
  (text: string) =>
  (offset: number): number =>
    Str.split("\n")(Str.slice(0, offset)(text)).length

/**
 * Whether a path, or a package's name, fits a pattern: `*` is anything but a slash, `**` is anything.
 *
 * @example
 * fits("packages/foundation/*\/*")("packages/foundation/modeling/csv") // true
 * fits("@alchemy.run/**")("@alchemy.run/cloudflare") // true
 *
 * @category rules
 */
export const fits = (pattern: string): ((candidate: string) => boolean) => {
  const body = A.join(
    A.map(Str.split("**")(pattern), (part) => A.join(A.map(Str.split("*")(part), literally), "[^/]*")),
    ".*"
  )
  const expression = new RegExp(`^${body}$`)
  return (candidate) => expression.test(candidate)
}

/** A relative path with the `./` and `../` it starts with taken off: what it names, whatever folder it was read from. */
export const anchorless = (path: string): string => Str.replace(/^(?:\.{1,2}\/)+/, "")(path)

/** Whether a value is a path on this disk, and not an address or a package's name. */
export const isLocalPath = (value: string): boolean =>
  !/^[a-z][a-z0-9+.-]*:/i.test(value) && (Str.startsWith(".")(value) || Str.startsWith("node_modules/")(value))
