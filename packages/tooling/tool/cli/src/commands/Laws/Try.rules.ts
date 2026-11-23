/**
 * No `try` statement is written: code that can fail is an Effect, or a `Result` or an `Option` outside one
 * (Benjamin's rule, 2026-11-22: "In beep-effect I've banned try/catch blocks as my preference is either using
 * Effect(s) or effect/Result for code which can fail with errors. I want this enforced repo wide."). A `try` hides
 * what can fail from the type: its `catch` is handed `unknown`, and what it answers is a value no caller can tell
 * from a success. Inside an Effect, `Effect.try` or `Effect.tryPromise` with a `catch` that returns a typed error;
 * outside one, `Result.try` or `Option.liftThrowable`; for a `finally`, `Effect.ensuring` or `Effect.acquireUseRelease`.
 *
 * What is refused: every `try` statement, with a `catch`, a `finally` or both, nested or not, in a function, a method
 * or an arrow, in every code file git would commit (TypeScript and JavaScript, sources, tests, scripts and the
 * vendored kit alike), and in the code examples of doc comments (an `@example`, or a fenced block of code): an example
 * is copied, so one that shows a `try` teaches it. What passes: `Effect.try`, `Result.try`, `Option.liftThrowable`, and
 * the word in a name, a key, a string or a comment.
 *
 * Nothing turns it off: it reads no configuration, no ledger and no comment that would except a file or a line, and
 * it refuses a comment that turns a linter's rule against `try` off (`oxlint-disable` or `eslint-disable`, naming
 * `no-restricted-syntax`, a rule named `no-try…`, or no rule at all), as the deprecated-API law refuses one for its
 * rule.
 *
 * Three paths are not read, each by name and by Benjamin's decision (`tryLeftOut`): `.agents/`, the agent skills, as for
 * the deprecated-API law; `scratchpad/`, where an idea is tried under the type-checker only and this law applies when
 * its code graduates into a package (decision "the scratchpad", 2026-11-22); and `apps/inventory/public/theme-init.js`,
 * which "runs before the app loads and cannot import Effect without loading the library before first paint"
 * (explorations/ideal-architecture/DECISIONS.md, "2026-11-22 — no `try` statement, repository wide").
 *
 * A file nested too deep (brackets, chained operators, or statements nested without braces), one too large, or one
 * the parser reads with errors (`internal/budget.ts`) is refused as a whole, once, at the line being read, in words
 * that say which: never handed to a parser that would die on it, never passed in silence. "Every file git would commit" is git's answer to give, so this
 * asks git, and fails when git does not answer.
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
import { scratchpadFolder } from "../../Repo.schema.ts"
import { err, type Line, out } from "../../Report.schema.ts"
import { unreadSentence } from "./internal/budget.ts"
import { silencings } from "./internal/directives.ts"
import { readTry, type TryForm } from "./internal/tryCode.ts"

const $I = $RepoCliId.create("commands/Laws/Try.rules")

/** A code file, by its name: TypeScript or JavaScript, wherever it is. */
const isCode = (file: string) => Str.match(/\.[cm]?[jt]sx?$/)(file).pipe(O.isSome)

/**
 * What is not read, each from the root: a folder with its closing slash, a file by its whole path. `.agents/` holds
 * the agent skills, copied as they were published and run by no part of the app or its checks, left out as for the
 * deprecated-API law. The scratchpad is where an experiment is tried, and this law applies to it when it graduates
 * into a package. `theme-init.js` "runs before the app loads and cannot import Effect without loading the library
 * before first paint" (explorations/ideal-architecture/DECISIONS.md, 2026-11-22): the one file allowed a `try`.
 * Anything else git would commit is read, a new folder included.
 */
export const tryLeftOut: ReadonlyArray<string> = [
  ".agents/",
  `${scratchpadFolder}/`,
  "apps/inventory/public/theme-init.js"
]

/** Whether `file`, from the root, is one of what is not read. */
const isLeftOut = (file: string): boolean =>
  A.some(tryLeftOut, (path) => (Str.endsWith("/")(path) ? Str.startsWith(path)(file) : file === path))

/** The paths not read, as the output names them each time. */
const notRead = `${A.join(A.dropRight(tryLeftOut, 1), ", ")} and ${A.join(A.takeRight(tryLeftOut, 1), "")} are not read`

/** Whether a directive turns a rule against `try` off: it names one, under any plugin's spelling, or names none. */
const silences = (rules: ReadonlyArray<string>) =>
  A.isReadonlyArrayEmpty(rules) ||
  A.some(rules, (name) => Str.match(/(?:^|\/)(?:no-restricted-syntax|no-try[\w-]*)$/)(name).pipe(O.isSome))

/**
 * What `laws try` finds: nothing, or a refusal and each `try` statement; and what keeps it from being sure.
 *
 * @category schemas
 */
export const TryFinding = S.TaggedUnion({
  Clean: {},
  Refused: {},
  Unlisted: {
    why: S.String.pipe(S.annotateKey({ description: "What git said when it could not list the files" }))
  },
  At: {
    place: S.String.pipe(S.annotateKey({ description: "The file and line, as file:line" })),
    form: S.Literals(["catch", "finally", "both"]).pipe(
      S.annotateKey({ description: "What the statement has beside its block: a catch, a finally, or both" })
    ),
    inExample: S.Boolean.pipe(
      S.annotateKey({ description: "Whether it is in the code example of a doc comment, not in the code" })
    )
  },
  Silenced: {
    place: S.String.pipe(S.annotateKey({ description: "The file and line of the comment, as file:line" })),
    directive: S.String.pipe(S.annotateKey({ description: "The comment's directive, as written" }))
  },
  Unread: {
    place: S.String.pipe(S.annotateKey({ description: "The file and line the law stopped at, as file:line" })),
    why: S.String.pipe(S.annotateKey({ description: "Why the law did not read the file, in words" }))
  }
}).pipe(
  $I.annoteSchema("TryFinding", {
    description: "No `try` statement is written, or a refusal and each place one is, or why that could not be told"
  })
)

/**
 * The decoded value of `TryFinding`.
 *
 * @category models
 */
export type TryFinding = typeof TryFinding.Type

const forCatch =
  "Effect.try or Effect.tryPromise with a catch that returns a typed error inside an Effect, Result.try or Option.liftThrowable outside one"
const forFinally = "Effect.ensuring or Effect.acquireUseRelease for the finally"

/** What to write instead of a `try` statement of each form. */
const insteadOf = (form: TryForm): string =>
  form === "catch" ? forCatch : form === "finally" ? forFinally : `${forCatch}; ${forFinally}`

const formWords = (form: TryForm): string =>
  form === "catch" ? "with a catch" : form === "finally" ? "with a finally" : "with a catch and a finally"

/**
 * The line each finding prints.
 *
 * @category rendering
 */
export const trySentence: (finding: TryFinding) => Line = TryFinding.match({
  Clean: () => out(`try:check OK  no try statement is written (${notRead})`),
  Refused: () => err(`try:check FAIL  a try statement is written. Write what each line says instead (${notRead}):`),
  Unlisted: ({ why }) => err(`git could not list the files, so none was checked: ${why}`),
  At: ({ form, inExample, place }) =>
    err(
      inExample
        ? `${place}  a try statement ${formWords(form)} in a doc comment's example: show ${insteadOf(form)}`
        : `${place}  a try statement ${formWords(form)}: write ${insteadOf(form)}`
    ),
  Silenced: ({ directive, place }) =>
    err(`${place}  a comment that turns a rule against try off (${directive}): no comment does. Remove it`),
  Unread: ({ place, why }) => err(`${place}  ${why}`)
})

/**
 * Reads every code file git would commit, from the repository's root, but what `tryLeftOut` names.
 *
 * @category rules
 */
export const tryStatements = Effect.fn("Try.tryStatements")(function* () {
  const repo = yield* Repo
  // Every file, each ended by a zero byte: with no `-z` git quotes a name that has a letter outside ASCII, and a
  // quoted name is no file. Once each, though a merge holds a file at three stages. No pathspec either: a code file in
  // a folder nobody thought of is still listed. A tracked file gone from the folder is passed over below.
  const listed = yield* repo.run("git", [
    "ls-files",
    "-z",
    "--cached",
    "--others",
    "--exclude-standard",
    "--deduplicate"
  ])
  // A list git could not give is not an empty list: nothing was checked, and the law says so.
  if (listed.code !== 0) {
    return A.make<[TryFinding, TryFinding]>(
      TryFinding.cases.Refused.make({}),
      TryFinding.cases.Unlisted.make({ why: Str.trim(listed.stderr) })
    )
  }
  const files = yield* Effect.filter(
    A.filter(Str.split("\0")(listed.stdout), (file) => isCode(file) && !isLeftOut(file)),
    (file) => repo.exists(repo.join(repo.root, file)),
    { concurrency: 1 }
  )
  const found = yield* Effect.forEach(
    files,
    (file) =>
      Effect.map(repo.text(repo.join(repo.root, file)), (source): ReadonlyArray<TryFinding> => {
        const comments = A.map(silencings({ text: source, silences }), ({ directive, line }): TryFinding =>
          TryFinding.cases.Silenced.make({ place: `${file}:${line}`, directive })
        )
        const read = readTry({ file, source })
        // A file the law did not read is refused once, where it stopped, in words that say why.
        const statements = O.match(read.unread, {
          onNone: (): ReadonlyArray<TryFinding> =>
            A.map(read.found, ({ form, inExample, line }) =>
              TryFinding.cases.At.make({ place: `${file}:${line}`, form, inExample })
            ),
          onSome: ({ line, unread }): ReadonlyArray<TryFinding> =>
            A.of(TryFinding.cases.Unread.make({ place: `${file}:${line}`, why: unreadSentence(unread) }))
        })
        return A.appendAll(comments, statements)
      }),
    { concurrency: 1 }
  )
  const problems = A.flatten(found)
  return A.isArrayNonEmpty(problems)
    ? A.prepend<TryFinding, TryFinding>(problems, TryFinding.cases.Refused.make({}))
    : A.of<TryFinding>(TryFinding.cases.Clean.make({}))
})
