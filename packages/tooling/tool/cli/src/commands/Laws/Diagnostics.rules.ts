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
 * check (`scratch:check`) allows one directive only, decision 33 of the Alchemy brief, and refuses every other.
 * `diagnosticsListed` names the files that hold one today: it may only shrink. A listed file with none left is refused
 * until its line is taken off, and `test/Diagnostics.test.ts` holds the list at its length.
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
import { linesOf } from "./internal/lines.ts"

const $I = $RepoCliId.create("commands/Laws/Diagnostics.rules")

/** A code file, by its name: TypeScript or JavaScript, wherever it is. */
const isCode = (file: string) => Str.match(/\.[cm]?[jt]sx?$/)(file).pipe(O.isSome)

/** What is not read, each from the root, a folder with its closing slash. */
export const diagnosticsLeftOut: ReadonlyArray<string> = [".agents/", "vendor/", "docs/", `${scratchpadFolder}/`]

/**
 * The files that hold a directive today: this list may only shrink. Its owner takes a file off when its last
 * directive is gone, and the law refuses a listed file that has none left. `packages/infra/src/OpReferences.secrets.ts`
 * stays until Alchemy types a secrets layer's failure: its `SecretsLayer` is `Layer<never, unknown, …>`, so the fix
 * goes there first. The five decide files of `packages/catalog/model` hold decision 33's `newSchemaClass:off`, which
 * Benjamin is asked about.
 */
export const diagnosticsListed: ReadonlyArray<string> = [
  "apps/inventory/test/server/AuthIndexes.test.ts",
  "apps/inventory/test/server/AuthSchema.test.ts",
  "apps/inventory/test/server/Pwned.test.ts",
  "apps/inventory/test/server/QueryPlans.test.ts",
  "apps/inventory/test/server/Telemetry.slow.test.ts",
  "apps/inventory/test/server/Telemetry.test.ts",
  "apps/inventory/test/server/support/app.ts",
  "apps/inventory/test/server/support/files.ts",
  "apps/inventory/test/web/samples.test.ts",
  "apps/inventory/test/web/traceContext.test.ts",
  "apps/inventory/vite.config.ts",
  "packages/catalog/model/src/Import/Import.aggregate.ts",
  "packages/catalog/model/src/Review/Deciding.decision.ts",
  "packages/catalog/model/src/Review/DecidingGroup.decision.ts",
  "packages/catalog/model/src/Review/Undoing.decision.ts",
  "packages/catalog/model/src/Review/UndoingGroup.decision.ts",
  "packages/catalog/model/test/Ports.test.ts",
  "packages/catalog/web/test/DraftPicks.test.ts",
  "packages/catalog/web/test/ItemEditor.test.ts",
  "packages/catalog/web/test/KeptRows.test.ts",
  "packages/catalog/web/test/TakenBackWords.test.ts",
  "packages/catalog/web/test/csvDifferential.test.ts",
  "packages/catalog/web/test/readSpreadsheet.test.ts",
  "packages/catalog/web/test/reviewHonesty.test.ts",
  "packages/catalog/web/test/reviewParity.test.ts",
  "packages/catalog/web/test/support/files.ts",
  "packages/catalog/web/test/xlsxParity.test.ts",
  "packages/infra/src/OpReferences.secrets.ts",
  "packages/patches/test/alchemy-domain/01-computed-instance-id/Card.aggregate.ts",
  "packages/patches/test/alchemy-domain/01-computed-instance-id/WritingCard.decision.ts",
  "packages/patches/test/alchemy-domain/02-text-length-in-a-template/Label.aggregate.ts"
]

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
  return A.dedupe(A.map(A.fromIterable(Str.matchAll(directive)(text)), (found) => lineAt(found.index ?? 0)))
}

/** The paths not read, as the output names them each time. */
const notRead = `${A.join(diagnosticsLeftOut, ", ")} are not read; ${A.length(diagnosticsListed)} files are listed`

/**
 * What `laws diagnostics` finds: nothing, or a refusal and each directive; a listed file with none left.
 *
 * @category schemas
 */
export const DiagnosticsFinding = S.TaggedUnion({
  Clean: {},
  Refused: {},
  Unlisted: {
    why: S.String.pipe(S.annotateKey({ description: "What git said when it could not list the files" }))
  },
  At: {
    place: S.String.pipe(S.annotateKey({ description: "The file and line, as file:line" }))
  },
  Settled: {
    file: S.String.pipe(S.annotateKey({ description: "A listed file that holds no directive any more" }))
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
  Refused: () =>
    err(
      `diagnostics:check FAIL  an @effect-diagnostics directive turns a rule off. Change the code until it holds (${notRead}):`
    ),
  Unlisted: ({ why }) => err(`git could not list the files, so none was checked: ${why}`),
  At: ({ place }) => err(`${place}  an @effect-diagnostics directive: remove it and write the code the rule asks for`),
  Settled: ({ file }) =>
    err(`${file}  is listed in diagnosticsListed but holds no directive any more: take its line off the list`)
})

/**
 * Reads every code file git would commit, from the repository's root, but what `diagnosticsLeftOut` names.
 *
 * @category rules
 */
export const diagnostics = Effect.fn("Diagnostics.diagnostics")(function* () {
  const repo = yield* Repo
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
      DiagnosticsFinding.cases.Refused.make({}),
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
        if (A.contains(diagnosticsListed, file)) {
          return A.isReadonlyArrayEmpty(lines) ? A.of(DiagnosticsFinding.cases.Settled.make({ file })) : []
        }
        return A.map(lines, (line) => DiagnosticsFinding.cases.At.make({ place: `${file}:${line}` }))
      }),
    { concurrency: 1 }
  )
  const problems = A.flatten(found)
  return A.isArrayNonEmpty(problems)
    ? A.prepend<DiagnosticsFinding, DiagnosticsFinding>(problems, DiagnosticsFinding.cases.Refused.make({}))
    : A.of<DiagnosticsFinding>(DiagnosticsFinding.cases.Clean.make({}))
})
