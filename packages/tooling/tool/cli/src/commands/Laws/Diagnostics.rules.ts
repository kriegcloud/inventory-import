/**
 * No `@effect-diagnostics` comment is written (Benjamin's rule, 2026-11-22: "`@effect-diagnostics` ignore comments are
 * not allowed"). Such a comment turns one of the Effect language service's rules off for a file or a line, so what
 * the type-check says of that code is no longer what it says of every other: the code is changed until the rule
 * holds. A layer is built at the entry point (`Layer.build`, then `Effect.provideContext`, or
 * `Effect.provideServiceEffect`), a file is read through the `FileSystem` service, a request through `HttpClient`.
 *
 * What is refused: `@effect-diagnostics` or `@effect-diagnostics-next-line` followed by a rule and a setting
 * (`strictEffectProvide:off`), in every code file git would commit. The text is matched, not parsed, because the
 * checker reads the directive in a string too: a test that needs one puts it together (`Scratch.templates.ts`,
 * `diagnosticDirective`), so its file holds none.
 *
 * Not read, each by name: `.agents/`, `vendor/` and `docs/`, as Benjamin's rule has it; and `scratchpad/`, whose own
 * check (`scratch:check`) refuses every directive.
 * `ledgers/diagnostics.json` names the files that hold one today, each with how many, which only falls, held against
 * the files there are and against main (`internal/ledger.ts`).
 * A listed file with none left is refused
 * until its line is taken off, and `test/Diagnostics.test.ts` holds the list at its length.
 *
 * @packageDocumentation
 */
import { $RepoCliId } from "@beep/identity/packages"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as Result from "effect/Result"
import * as S from "effect/Schema"
import * as Str from "effect/String"
import { Repo } from "../../Repo.service.ts"
import { scratchpadFolder } from "../../Repo.schema.ts"
import { err, type Line, out } from "../../Report.schema.ts"
import { ledgerAgainst, ledgersFolder, readLedger, standingOf, standingWords } from "./internal/ledger.ts"
import { linesOf } from "./internal/lines.ts"

const $I = $RepoCliId.create("commands/Laws/Diagnostics.rules")

/** A code file, by its name: TypeScript or JavaScript, wherever it is. */
const isCode = (file: string) => Str.match(/\.[cm]?[jt]sx?$/)(file).pipe(O.isSome)

/** What is not read, each from the root, a folder with its closing slash. */
export const diagnosticsLeftOut: ReadonlyArray<string> = [".agents/", "vendor/", "docs/", `${scratchpadFolder}/`]

const isLeftOut = (file: string): boolean => A.some(diagnosticsLeftOut, (path) => Str.startsWith(path)(file))

/** A directive the checker reads: the word, then a rule (or `*`) and a setting. */
const directive = /@effect-diagnostics(?:-next-line)?\s+[A-Za-z*]+:(?:off|error|warning|message|suggestion|skip-file)/g

/**
 * The lines of `text` that hold a directive, from 1.
 *
 * @example directiveLines("const a = 1\n") // []: a directive is not written out here, since the checker would read it
 */
export const directiveLines = (text: string): ReadonlyArray<number> => {
  const lineAt = linesOf(text)
  // One line for each directive, so two on one line count as two: the ledger counts places, not lines.
  return A.map(A.fromIterable(Str.matchAll(directive)(text)), (found) =>
    lineAt(O.getOrElse(O.fromUndefinedOr(found.index), () => 0))
  )
}

/** The ledger's file, from the root. */
export const diagnosticsLedger = `${ledgersFolder}/diagnostics.json`

/** The paths not read, as the output names them each time. */
const notRead = `${A.join(diagnosticsLeftOut, ", ")} are not read; the files in ${diagnosticsLedger} are listed`

/**
 * What `laws diagnostics` finds: nothing, or a refusal and each directive; a listed file with none left.
 *
 * @category schemas
 */
export const DiagnosticsFinding = S.TaggedUnion({
  Clean: {},
  Refused: {
    directive: S.Boolean.pipe(
      S.annotateKey({ description: "Whether a directive is among what is refused, or only the ledger" })
    )
  },
  Unlisted: {
    why: S.String.pipe(S.annotateKey({ description: "What git said when it could not list the files" }))
  },
  At: {
    place: S.String.pipe(S.annotateKey({ description: "The file and line, as file:line" }))
  },
  Standing: {
    file: S.String.pipe(S.annotateKey({ description: "A listed file whose number of directives moved" })),
    words: S.String.pipe(S.annotateKey({ description: "How it moved, and what to do" }))
  },
  Ledger: {
    said: S.String.pipe(S.annotateKey({ description: "What the ledger says against the files and against main" }))
  }
}).pipe(
  $I.annoteSchema("DiagnosticsFinding", {
    description: "No @effect-diagnostics directive is written, or a refusal and each place one is"
  })
)

/**
 * The decoded value of `DiagnosticsFinding`.
 *
 * @category models
 */
export type DiagnosticsFinding = typeof DiagnosticsFinding.Type

/**
 * The line each finding prints.
 *
 * @category rendering
 */
export const diagnosticsSentence: (finding: DiagnosticsFinding) => Line = DiagnosticsFinding.match({
  Clean: () => out(`diagnostics:check OK  no @effect-diagnostics directive is written (${notRead})`),
  Refused: ({ directive }) =>
    directive
      ? err(
          `diagnostics:check FAIL  an @effect-diagnostics directive turns a rule off. Change the code until it holds (${notRead}):`
        )
      : err(`diagnostics:check FAIL  its ledger does not hold (${notRead}):`),
  Unlisted: ({ why }) => err(`git could not list the files, so none was checked: ${why}`),
  At: ({ place }) => err(`${place}  an @effect-diagnostics directive: remove it and write the code the rule asks for`),
  Standing: ({ file, words }) => err(`${file}  ${words}`),
  Ledger: ({ said }) => err(said)
})

/**
 * Reads every code file git would commit, from the repository's root, but what `diagnosticsLeftOut` names.
 *
 * @category rules
 */
export const diagnostics = Effect.fn("Diagnostics.diagnostics")(function* () {
  const repo = yield* Repo
  const ledger = yield* readLedger(diagnosticsLedger)
  if (Result.isFailure(ledger)) {
    return A.make<[DiagnosticsFinding, DiagnosticsFinding]>(
      DiagnosticsFinding.cases.Refused.make({ directive: false }),
      DiagnosticsFinding.cases.Ledger.make({ said: ledger.failure })
    )
  }
  const listed = yield* repo.run("git", [
    "ls-files",
    "-z",
    "--cached",
    "--others",
    "--exclude-standard",
    "--deduplicate"
  ])
  if (listed.code !== 0) {
    return A.make<[DiagnosticsFinding, DiagnosticsFinding]>(
      DiagnosticsFinding.cases.Refused.make({ directive: false }),
      DiagnosticsFinding.cases.Unlisted.make({ why: Str.trim(listed.stderr) })
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
      Effect.map(repo.text(repo.join(repo.root, file)), (text): ReadonlyArray<DiagnosticsFinding> => {
        const lines = directiveLines(text)
        const standing = standingOf(ledger.success, { file, now: A.length(lines) })
        if (O.isSome(standing)) {
          return O.match(standingWords(standing.value, diagnosticsLedger), {
            onNone: () => [],
            onSome: (words) => A.of(DiagnosticsFinding.cases.Standing.make({ file, words }))
          })
        }
        return A.map(A.dedupe(lines), (line) => DiagnosticsFinding.cases.At.make({ place: `${file}:${line}` }))
      }),
    { concurrency: 1 }
  )
  const against = yield* ledgerAgainst({ path: diagnosticsLedger, now: ledger.success, files })
  const problems = A.appendAll(
    A.map(against, (said) => DiagnosticsFinding.cases.Ledger.make({ said })),
    A.flatten(found)
  )
  return A.isArrayNonEmpty(problems)
    ? A.prepend<DiagnosticsFinding, DiagnosticsFinding>(
        problems,
        DiagnosticsFinding.cases.Refused.make({
          directive: A.some(problems, (problem) => !DiagnosticsFinding.guards.Ledger(problem))
        })
      )
    : A.of<DiagnosticsFinding>(DiagnosticsFinding.cases.Clean.make({}))
})
