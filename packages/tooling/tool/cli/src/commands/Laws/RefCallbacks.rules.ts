/**
 * A `ref` on an element is a DOM ref or a callback that stays the same across draws: never a function written in
 * the element, a call, or a function made inside the component. React calls a ref callback again whenever it is
 * given a new function, so one made on each draw runs after every draw: an effect with no dependency list under
 * another name, which the atoms lint cannot see because no import gives it away (goals/atoms, Benjamin's answer
 * "No, follow the brief").
 *
 * What passes: a name (`ref={scroller}`, `ref={intoView}`), a member (`ref={region.attach}`), and a choice between
 * those and nothing (`ref={lead ? region.markLead : undefined}`). A name passes only if the file does not make a
 * function of that name inside another function. The vendored kit keeps its own.
 *
 * "Every file git would commit" is git's answer to give, so this asks git.
 *
 * @packageDocumentation
 */
import { $RepoCliId } from "@beep/identity/packages"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as S from "effect/Schema"
import * as Str from "effect/String"
import { Repo } from "../../Repo.service.ts"
import { err, type Line, out } from "../../Report.schema.ts"

const $I = $RepoCliId.create("commands/Laws/RefCallbacks.rules")

/** Our own screens: every .tsx git would commit, the vendored kit and the agents' skills left out. */
const screens = ["--", "*.tsx", ":!packages/ui/src/components", ":!packages/ui/src/hooks", ":!.agents"]

/** A name, or a member of one (`a.b.c`). */
const steady = "[A-Za-z_$][A-Za-z0-9_$]*(\\.[A-Za-z_$][A-Za-z0-9_$]*)*"
/** A steady value, or a choice between steady values and nothing. */
const allowed = new RegExp(`^(${steady}|[^?{}()]+ \\? (${steady}|undefined|null) : (${steady}|undefined|null))$`)
/** A function made inside another function: an indented arrow, function expression or function declaration. */
const innerFunction =
  "^[[:space:]]+((const|let) [A-Za-z_$][A-Za-z0-9_$]* = (async )?(\\(|function|[A-Za-z_$][A-Za-z0-9_$]* =>)|(async )?function [A-Za-z_$])"

/**
 * What `laws ref-callbacks` finds: nothing, or a refusal and each `ref` that is not steady, with why.
 *
 * @category schemas
 */
export const RefCallbacksFinding = S.TaggedUnion({
  Clean: {},
  Refused: {},
  At: {
    place: S.String.pipe(S.annotateKey({ description: "The file and line, as file:line" })),
    why: S.String.pipe(S.annotateKey({ description: "What the ref is given, in words" }))
  }
}).pipe(
  $I.annoteSchema("RefCallbacksFinding", {
    description: "Every ref is steady across draws, or a refusal and each place one is not"
  })
)

/**
 * The decoded value of `RefCallbacksFinding`.
 *
 * @category models
 */
export type RefCallbacksFinding = typeof RefCallbacksFinding.Type

/**
 * The line each finding prints.
 *
 * @category rendering
 */
export const refCallbacksSentence: (finding: RefCallbacksFinding) => Line = RefCallbacksFinding.match({
  Clean: () => out("refs:check OK  every ref is a DOM ref or a callback that stays the same across draws"),
  Refused: () =>
    err(
      "refs:check FAIL  a ref callback made on each draw runs after every draw. Use a module-level function, a function an atom holds, or useAtomSubscribe:"
    ),
  At: ({ place, why }) => err(`${place}  ${why}`)
})

/** One line git found: its file, its line number and its text. */
const lineOf = (found: string): { readonly file: string; readonly at: string; readonly text: string } => {
  const parts = Str.split(":")(found)
  return { file: parts[0] ?? "", at: parts[1] ?? "", text: A.join(A.drop(parts, 2), ":") }
}

/** What stands between `ref={` and the brace that closes it, when both are on the line. */
const given = (text: string): O.Option<string> =>
  O.flatMap(Str.indexOf("ref={")(text), (start) => {
    let depth = 0
    for (let index = start + 4; index < text.length; index += 1) {
      const char = text[index]
      if (char === "{") depth += 1
      if (char === "}") {
        depth -= 1
        if (depth === 0) return O.some(Str.slice(start + 5, index)(text))
      }
    }
    return O.none()
  })

/**
 * Searches every screen of our own from the repository's root.
 *
 * @category rules
 */
export const refCallbacks = Effect.fn("RefCallbacks.refCallbacks")(function* () {
  const repo = yield* Repo
  const refs = yield* repo.run("git", ["grep", "--untracked", "-I", "-n", "-E", "\\bref=\\{", ...screens])
  const inner = yield* repo.run("git", ["grep", "--untracked", "-I", "-n", "-E", innerFunction, ...screens])
  const made = A.map(
    A.filter(Str.split("\n")(inner.stdout), (line) => line !== ""),
    lineOf
  )
  const madeInside = (file: string, name: string): boolean =>
    A.some(made, (line) => line.file === file && new RegExp(`\\b(const|let|function) ${name}\\b`).test(line.text))
  const judged = A.map(
    A.filter(Str.split("\n")(refs.stdout), (line) => line !== ""),
    (line): O.Option<RefCallbacksFinding> => {
      const { file, at, text } = lineOf(line)
      const place = `${file}:${at}`
      const value = given(text)
      if (O.isNone(value)) {
        return O.some({ _tag: "At", place, why: "a ref written over several lines: give it a name" })
      }
      const what = Str.trim(value.value)
      if (!allowed.test(what)) {
        return O.some({ _tag: "At", place, why: `ref={${what}} is a function or a call written in the element` })
      }
      const names = A.filter(
        // The names the value starts from: of `region.attach` that is `region`, never `attach`.
        O.getOrElse(Str.match(/(?<![.\w$])[A-Za-z_$][A-Za-z0-9_$]*/g)(what), (): ReadonlyArray<string> => []),
        (name) => madeInside(file, name)
      )
      return A.isArrayNonEmpty(names)
        ? O.some({ _tag: "At", place, why: `${names[0]} is a function made inside the component` })
        : O.none()
    }
  )
  const found = A.getSomes(judged)
  return A.isArrayNonEmpty(found)
    ? A.prepend<RefCallbacksFinding, RefCallbacksFinding>(found, { _tag: "Refused" })
    : A.of<RefCallbacksFinding>({ _tag: "Clean" })
})
