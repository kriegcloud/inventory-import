// The comments that turn a linter's rules off, as a law that allows none of them reads them: `oxlint-disable` or
// `eslint-disable`, for a line, the next one or the file. Read as text, not parsed, so the same words in a string are
// refused too: that errs on the side of the rule.
import * as A from "effect/Array"
import * as Str from "effect/String"
import { linesOf } from "./lines.ts"

/**
 * A comment that turns rules off, at the start of a `//` comment (read to the line's end) or of a block comment (read
 * to its end, over as many lines as it has). Groups 1 and 2 are a line comment's directive and what follows it; 3 and
 * 4 a block comment's.
 *
 * The text is matched, not parsed, so the same words inside a string or after `//` in a sentence of a doc comment are
 * refused too, though oxlint ignores them there (measured on 1.93.0). That errs on the side of the rule: write the
 * words another way there, as the laws' own tests do.
 */
const directive =
  /\/\/[ \t]*((?:oxlint|eslint)-disable(?:-next-line|-line)?)(?![\w-])([^\r\n]*)|\/\*\s*((?:oxlint|eslint)-disable(?:-next-line|-line)?)(?![\w-])([\s\S]*?)\*\//g

/**
 * The rules a directive names: what follows it up to its reason, which begins at the first `--`, with or without
 * spaces around it, as oxlint reads it (measured: `typescript/no-deprecated--legacy` turns the rule off).
 *
 * @example namedRules(" typescript/no-deprecated -- legacy") // ["typescript/no-deprecated"]
 */
export const namedRules = (rest: string): ReadonlyArray<string> =>
  A.filter(Str.split(/[\s,]+/)(`${Str.split("--")(rest)[0]}`), Str.isNonEmpty)

/** One comment that turns a rule off: its line, from 1, and its directive as written. */
export interface Silencing {
  readonly line: number
  readonly directive: string
}

/**
 * Each comment in `text` that turns off a rule `silences` says it does, given the rules the comment names (none when
 * it names no rule, which turns every rule off).
 *
 * @example silencings({ text: "// a comment with no directive", silences: A.isReadonlyArrayEmpty }) // []
 */
export const silencings = (input: {
  readonly text: string
  readonly silences: (rules: ReadonlyArray<string>) => boolean
}): ReadonlyArray<Silencing> => {
  const { silences, text } = input
  const lineAt = linesOf(text)
  return A.flatMap(A.fromIterable(Str.matchAll(directive)(text)), (found) =>
    silences(namedRules(`${found[2] ?? found[4]}`))
      ? A.of<Silencing>({ line: lineAt(found.index ?? 0), directive: `${found[1] ?? found[3]}` })
      : A.empty<Silencing>()
  )
}
