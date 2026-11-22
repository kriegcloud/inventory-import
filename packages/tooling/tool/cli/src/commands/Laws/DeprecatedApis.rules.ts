/**
 * No deprecated API is used: not one of a library's, not one of this repository's own packages', not a deprecated
 * overload, property or prop. The rule is oxlint's `typescript/no-deprecated`, which reads each file's types, in the
 * profile beep-effect runs it in (`.oxlintrc.deprecated-apis.json`): one rule, an error, on the same engine (`tsrs-lint`).
 *
 * What the law adds is that nothing is left unread. oxlint passes over a file its config ignores without a word, and
 * a file no tsconfig includes is read without its package's types (no Node types, so a deprecated `node:url` function
 * passes). So the law hands oxlint every code file git would commit, and fails when oxlint read fewer; and it asks
 * `tsgolint` (the linter `tsrs-lint` is a port of, and the one that says it) which project each file has, and fails on
 * a TypeScript file that has none. A plain .js or .mjs file may have none: its package's types are then unknown to it.
 *
 * "Every file git would commit" is git's answer to give, so this asks git, and fails when git does not answer.
 *
 * @packageDocumentation
 */
import { $RepoCliId } from "@beep/identity/packages"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as S from "effect/Schema"
import * as Str from "effect/String"
import { RepoError } from "../../Cli.errors.ts"
import { Repo } from "../../Repo.service.ts"
import { err, type Line, out } from "../../Report.schema.ts"

const $I = $RepoCliId.create("commands/Laws/DeprecatedApis.rules")

/** The profile, from the root. */
const profile = ".oxlintrc.deprecated-apis.json"

/** Every code file under the workspaces and at the root, each a glob pathspec. Built files are not git's to commit. */
const code = A.flatMap(["", "apps/**/", "packages/**/"], (folder) =>
  A.map(["ts", "tsx", "mts", "cts", "js", "jsx", "mjs", "cjs"], (extension) => `:(glob)${folder}*.${extension}`)
)

/**
 * What `laws deprecated-apis` finds: nothing, or each use; and what keeps it from being sure.
 *
 * @category schemas
 */
export const DeprecatedApisFinding = S.TaggedUnion({
  Clean: {},
  Refused: {},
  At: {
    place: S.String.pipe(S.annotateKey({ description: "The file, line and column, as file:line:column" })),
    note: S.String.pipe(S.annotateKey({ description: "What is deprecated, and what its note says to use" }))
  },
  Unlisted: {
    why: S.String.pipe(S.annotateKey({ description: "What git said when it could not list the files" }))
  },
  Unread: {
    listed: S.Int.pipe(S.annotateKey({ description: "How many files git would commit" })),
    read: S.Int.pipe(S.annotateKey({ description: "How many of them oxlint read" }))
  },
  Unowned: {
    file: S.String.pipe(S.annotateKey({ description: "A TypeScript file no tsconfig includes, from the root" }))
  }
}).pipe(
  $I.annoteSchema("DeprecatedApisFinding", {
    description: "No deprecated API is used, or each use, or why that could not be told"
  })
)

/**
 * The decoded value of `DeprecatedApisFinding`.
 *
 * @category models
 */
export type DeprecatedApisFinding = typeof DeprecatedApisFinding.Type

const fail = (message: string): Line => err(`deprecated:check FAIL  ${message}`)

/**
 * The line each finding prints.
 *
 * @category rendering
 */
export const deprecatedApisSentence: (finding: DeprecatedApisFinding) => Line = DeprecatedApisFinding.match({
  Clean: () => out("deprecated:check OK  no deprecated API is used"),
  Refused: () => fail("a deprecated API is used. Move to what its note names:"),
  At: ({ note, place }) => err(`${place}  ${note}`),
  Unlisted: ({ why }) => fail(`git could not list the files, so none was checked: ${why}`),
  Unread: ({ listed, read }) =>
    fail(`oxlint read ${read} of ${listed} files: ${profile} leaves none out (no ignorePatterns, no overrides)`),
  Unowned: ({ file }) =>
    fail(
      `${file} is in no tsconfig, so it is read without its package's types: include it in one the root tsconfig.json references`
    )
})

/** oxlint's JSON report: what it found, and how many files it read. */
const OxlintReport = S.Struct({
  diagnostics: S.Struct({
    message: S.String.pipe(S.annotateKey({ description: "The finding in words" })),
    filename: S.String.pipe(S.annotateKey({ description: "The file, from the root" })),
    labels: S.Struct({
      span: S.Struct({
        line: S.Int.pipe(S.annotateKey({ description: "The line, from 1" })),
        column: S.Int.pipe(S.annotateKey({ description: "The column, from 1" }))
      }).pipe(S.annotateKey({ description: "Where it starts" }))
    }).pipe(S.Array, S.annotateKey({ description: "The places it names: none for a finding on a whole file" }))
  }).pipe(S.Array, S.annotateKey({ description: "Every finding" })),
  number_of_files: S.Int.pipe(S.annotateKey({ description: "How many files were read" }))
}).pipe($I.annoteSchema("OxlintReport", { description: "oxlint's report in its JSON format" }))

/** What `tsgolint` is asked: these files, with these rules. With no rule it only finds each file's project. */
const OwnersRequest = S.Struct({
  version: S.Literal(2).pipe(S.annotateKey({ description: "The version of its protocol" })),
  configs: S.Struct({
    file_paths: S.Array(S.String).pipe(S.annotateKey({ description: "The files, absolute" })),
    rules: S.Array(S.String).pipe(S.annotateKey({ description: "The rules to run: none" }))
  }).pipe(S.Array, S.annotateKey({ description: "The files, by the rules to run on them" }))
}).pipe($I.annoteSchema("OwnersRequest", { description: "A request to tsgolint in its headless mode" }))

const asRequest = S.encodeEffect(S.fromJsonString(OwnersRequest))
const readReport = S.decodeEffect(S.fromJsonString(OxlintReport))

const isTypeScript = (file: string) => Str.match(/\.[cm]?tsx?$/)(file).pipe(O.isSome)

/** A note as one line: its own line breaks and double spaces are the source comment's. */
const oneLine = (note: string) => Str.trim(Str.replace(/\s+/g, " ")(note))

/**
 * Reads every code file git would commit, from the repository's root.
 *
 * @category rules
 */
export const deprecatedApis = Effect.fn("DeprecatedApis.deprecatedApis")(function* () {
  const repo = yield* Repo
  const listed = yield* repo.run("git", [
    "ls-files",
    "--cached",
    "--others",
    "--exclude-standard",
    "--deduplicate",
    "--",
    ...code
  ])
  // A list git could not give is not an empty list: nothing was checked, and the law says so.
  if (listed.code !== 0) {
    return A.of<DeprecatedApisFinding>(DeprecatedApisFinding.cases.Unlisted.make({ why: Str.trim(listed.stderr) }))
  }
  const files = yield* Effect.filter(
    A.filter(Str.split("\n")(listed.stdout), Str.isNonEmpty),
    (file) => repo.exists(repo.join(repo.root, file)),
    { concurrency: 1 }
  )
  const tool = (name: string) => repo.join(repo.root, "node_modules", ".bin", name)
  const owners = tool("tsgolint")

  /** The TypeScript files with no project, by the summary `tsgolint` logs: no summary is not an empty one. */
  const unowned = Effect.gen(function* () {
    const request = yield* asRequest({
      version: 2,
      configs: [{ file_paths: A.map(files, (file) => repo.join(repo.root, file)), rules: [] }]
    }).pipe(Effect.orDie)
    const answer = yield* repo.run(owners, ["headless"], { stdin: request, env: { OXC_LOG: "debug" } })
    const summary = Str.match(/Done assigning files to programs\. Total programs: \d+\. Unmatched files: (\d+)/)(
      answer.stderr
    )
    const named = A.map(A.fromIterable(Str.matchAll(/Unmatched file: ([^\r\n]+)/g)(answer.stderr)), (found) =>
      repo.relative(repo.root, Str.trim(`${found[1]}`))
    )
    if (O.isNone(summary) || summary.value[1] !== `${A.length(named)}`) {
      return yield* RepoError.make({
        path: owners,
        message: `${owners} did not say which project each file has, so no file is known to be read with its types: ${Str.takeLeft(400)(Str.trim(answer.stderr))}`
      })
    }
    return A.filter(named, isTypeScript)
  })

  /** What oxlint found and how many files it read. It exits 1 when it found something; its report is still there. */
  const linted = Effect.gen(function* () {
    const oxlint = tool("oxlint")
    const answer = yield* repo.run(
      oxlint,
      ["--config", repo.join(repo.root, profile), "--disable-nested-config", "--format", "json", ...files],
      { env: { OXLINT_TSGOLINT_PATH: tool("tsrs-lint"), TSRS_FAST: "0" } }
    )
    return yield* readReport(answer.stdout).pipe(
      Effect.mapError(() =>
        RepoError.make({
          path: oxlint,
          message: `${oxlint} gave no report (exit ${answer.code}): ${Str.trim(`${answer.stdout}${answer.stderr}`)}`
        })
      )
    )
  })

  const [orphans, report] = yield* Effect.all([unowned, linted], { concurrency: "unbounded" })
  const unread =
    report.number_of_files === A.length(files)
      ? A.empty<DeprecatedApisFinding>()
      : A.of<DeprecatedApisFinding>(
          DeprecatedApisFinding.cases.Unread.make({ listed: A.length(files), read: report.number_of_files })
        )
  const uses = A.map(report.diagnostics, (diagnostic) =>
    DeprecatedApisFinding.cases.At.make({
      place: A.match(diagnostic.labels, {
        onEmpty: () => diagnostic.filename,
        onNonEmpty: ([first]) => `${diagnostic.filename}:${first.span.line}:${first.span.column}`
      }),
      note: oneLine(diagnostic.message)
    })
  )
  const problems = A.flatten<ReadonlyArray<ReadonlyArray<DeprecatedApisFinding>>>([
    unread,
    A.map(orphans, (file) => DeprecatedApisFinding.cases.Unowned.make({ file })),
    A.isReadonlyArrayNonEmpty(uses) ? [DeprecatedApisFinding.cases.Refused.make({}), ...uses] : []
  ])
  return A.isReadonlyArrayNonEmpty(problems)
    ? problems
    : A.of<DeprecatedApisFinding>(DeprecatedApisFinding.cases.Clean.make({}))
})
