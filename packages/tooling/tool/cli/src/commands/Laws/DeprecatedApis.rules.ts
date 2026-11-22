/**
 * No deprecated API is used: not one of a library's, not one of this repository's own packages', not a deprecated
 * overload, property or prop. The rule is oxlint's `typescript/no-deprecated`, which reads each file's types, in the
 * profile beep-effect runs it in (`.oxlintrc.deprecated-apis.json`): one rule, an error, on the same engine (`tsrs-lint`).
 *
 * What the law adds is that nothing is left unread and nothing is turned off. oxlint passes over a file its config
 * ignores, drops a finding a comment or an `overrides` entry turns off, and reads a file no tsconfig includes without
 * its package's types (no Node types, so a deprecated `node:url` function passes), each without a word. So the law:
 *
 * - refuses a profile that is anything but the one rule as an error (no `overrides`, `ignorePatterns` or `extends`);
 * - hands oxlint every code file git would commit, wherever it is, and fails when oxlint read fewer;
 * - refuses a comment in one of them that turns the rule off, by name or by naming no rule;
 * - asks `tsgolint` (the linter `tsrs-lint` is a port of, and the one that says it) which project each file has, and
 *   fails on a file that has none, JavaScript included.
 *
 * Two folders are left out, each by name and by Benjamin's decision (`leftOut`): `.agents/`, the agent skills,
 * vendored as they were published, most from other people and some from his own beep-effect; and `scratchpad/`,
 * where an idea is tried under the type-checker only and this law applies when its code graduates into a package
 * (decision "the scratchpad", 2026-11-22).
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
import { scratchpadFolder } from "../../Repo.schema.ts"
import { err, type Line, out } from "../../Report.schema.ts"

const $I = $RepoCliId.create("commands/Laws/DeprecatedApis.rules")

/** The profile, from the root. */
const profile = ".oxlintrc.deprecated-apis.json"

/** A code file, by its name: TypeScript or JavaScript, wherever it is. */
const isCode = (file: string) => Str.match(/\.[cm]?[jt]sx?$/)(file).pipe(O.isSome)

/**
 * The folders that are not read, each from the root with its closing slash. `.agents/` holds the agent skills, copied
 * as they were published and never run by the app or its checks: 16 of its 18 code files are other people's, and two
 * (the ontology auditor's script and its test) are from Benjamin's own beep-effect. One of the others reads deprecated
 * CSS properties on purpose, to report a page that uses them. Leaving the folder out is his decision
 * (explorations/ideal-architecture/DECISIONS.md, 2026-11-22). The scratchpad is left out by the decision of the same
 * day that made it: the laws on how code is written apply to an experiment when it graduates into a package.
 * Anything else git would commit is read, a new folder included.
 */
const leftOut: ReadonlyArray<string> = [".agents/", `${scratchpadFolder}/`]

/** The profile as it must be: the one rule, an error, and nothing that turns it off or leaves a file out. */
const Profile = S.Struct({
  $schema: S.optionalKey(S.String).pipe(S.annotateKey({ description: "oxlint's own schema, for an editor" })),
  plugins: S.Tuple([S.Literal("typescript")]).pipe(S.annotateKey({ description: "The one plugin the rule is in" })),
  options: S.Struct({
    typeAware: S.Literal(true).pipe(S.annotateKey({ description: "The rule reads types" }))
  }).pipe(S.annotateKey({ description: "How oxlint runs" })),
  categories: S.Record(S.String, S.Literal("off")).pipe(
    S.annotateKey({ description: "Every category of other rules, off" })
  ),
  rules: S.Struct({
    "typescript/no-deprecated": S.Literal("error").pipe(S.annotateKey({ description: "The rule, as an error" }))
  }).pipe(S.annotateKey({ description: "The one rule" }))
}).pipe($I.annoteSchema("Profile", { description: "The deprecated-API profile: one rule, an error, no exception" }))

const readProfile = S.decodeEffect(S.fromJsonString(Profile), { onExcessProperty: "error", errors: "all" })

/**
 * A comment that turns rules off: `oxlint-disable` or `eslint-disable`, for a line, the next one or the file, at the
 * start of a `//` comment (read to the line's end) or of a block comment (read to its end, over as many lines as it
 * has). Groups 1 and 2 are a line comment's directive and what follows it; 3 and 4 a block comment's.
 *
 * The text is matched, not parsed, so the same words inside a string or after `//` in a sentence of a doc comment are
 * refused too, though oxlint ignores them there (measured on 1.93.0). That errs on the side of the rule: write the
 * words another way there, as this law's own test does.
 */
const directive =
  /\/\/[ \t]*((?:oxlint|eslint)-disable(?:-next-line|-line)?)(?![\w-])([^\r\n]*)|\/\*\s*((?:oxlint|eslint)-disable(?:-next-line|-line)?)(?![\w-])([\s\S]*?)\*\//g

/**
 * The rules a directive names: what follows it up to its reason, which begins at the first `--`, with or without
 * spaces around it, as oxlint reads it (measured: `typescript/no-deprecated--legacy` turns the rule off).
 */
const namedRules = (rest: string) => A.filter(Str.split(/[\s,]+/)(`${Str.split("--")(rest)[0]}`), Str.isNonEmpty)

/** Whether a directive turns this rule off: it names it, under any plugin's spelling, or names no rule at all. */
const silences = (rules: ReadonlyArray<string>) =>
  A.isReadonlyArrayEmpty(rules) || A.some(rules, (name) => Str.match(/(?:^|\/)no-deprecated$/)(name).pipe(O.isSome))

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
    file: S.String.pipe(S.annotateKey({ description: "A code file no tsconfig includes, from the root" }))
  },
  Loosened: {
    why: S.String.pipe(S.annotateKey({ description: "Where the profile is not the one rule as an error" }))
  },
  Silenced: {
    place: S.String.pipe(S.annotateKey({ description: "The file and line of the comment, as file:line" })),
    directive: S.String.pipe(S.annotateKey({ description: "The comment's directive, as written" }))
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
  Clean: () => out("deprecated:check OK  no deprecated API is used (.agents/ and scratchpad/ are not read)"),
  Refused: () => fail("a deprecated API is used. Move to what its note names:"),
  At: ({ note, place }) => err(`${place}  ${note}`),
  Unlisted: ({ why }) => fail(`git could not list the files, so none was checked: ${why}`),
  Unread: ({ listed, read }) =>
    fail(`oxlint read ${read} of the ${listed} files it was handed: none may be passed over`),
  Unowned: ({ file }) =>
    fail(
      `${file} is in no tsconfig, so it is read without its package's types: include it in one the nearest tsconfig.json above it references, or the root's`
    ),
  Loosened: ({ why }) =>
    fail(
      `${profile} must be the one rule as an error and nothing else (no overrides, ignorePatterns or extends), so nothing was checked: ${why}`
    ),
  Silenced: ({ directive: written, place }) =>
    fail(`${place} turns the rule off (${written}): no comment does. Move to what the note names`)
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

/** A note as one line: its own line breaks and double spaces are the source comment's. */
const oneLine = (note: string) => Str.trim(Str.replace(/\s+/g, " ")(note))

/**
 * Reads every code file git would commit, from the repository's root.
 *
 * @category rules
 */
export const deprecatedApis = Effect.fn("DeprecatedApis.deprecatedApis")(function* () {
  const repo = yield* Repo
  // The profile first: one that leaves a file out or turns the rule off answers nothing about the files.
  const written = yield* repo.text(repo.join(repo.root, profile))
  const loosened = yield* readProfile(written).pipe(
    Effect.as(O.none<string>()),
    Effect.catch((cause) => Effect.succeedSome(oneLine(cause.message)))
  )
  if (O.isSome(loosened)) {
    return A.of<DeprecatedApisFinding>(DeprecatedApisFinding.cases.Loosened.make({ why: loosened.value }))
  }
  // Every file, each ended by a zero byte: with no `-z` git quotes a name that has a letter outside ASCII, and a
  // quoted name is no file. No pathspec either: a code file in a folder nobody thought of is still listed.
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
    return A.of<DeprecatedApisFinding>(DeprecatedApisFinding.cases.Unlisted.make({ why: Str.trim(listed.stderr) }))
  }
  const files = yield* Effect.filter(
    A.filter(
      Str.split("\0")(listed.stdout),
      (file) => isCode(file) && !A.some(leftOut, (folder) => Str.startsWith(folder)(file))
    ),
    (file) => repo.exists(repo.join(repo.root, file)),
    { concurrency: 1 }
  )
  const tool = (name: string) => repo.join(repo.root, "node_modules", ".bin", name)
  const owners = tool("tsgolint")

  /** The files with no project, by the summary `tsgolint` logs: no summary is not an empty one. */
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
    return named
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

  /** Each comment that turns the rule off, in the files oxlint is handed: it would drop the finding without a word. */
  const silenced = Effect.map(
    Effect.forEach(
      files,
      (file) =>
        Effect.map(repo.text(repo.join(repo.root, file)), (text) =>
          A.flatMap(A.fromIterable(Str.matchAll(directive)(text)), (found) =>
            silences(namedRules(`${found[2] ?? found[4]}`))
              ? A.of<DeprecatedApisFinding>(
                  DeprecatedApisFinding.cases.Silenced.make({
                    place: `${file}:${A.length(Str.split("\n")(Str.slice(0, found.index)(text)))}`,
                    directive: `${found[1] ?? found[3]}`
                  })
                )
              : A.empty<DeprecatedApisFinding>()
          )
        ),
      { concurrency: 16 }
    ),
    A.flatten
  )

  const [orphans, report, comments] = yield* Effect.all([unowned, linted, silenced], { concurrency: "unbounded" })
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
    comments,
    A.map(orphans, (file) => DeprecatedApisFinding.cases.Unowned.make({ file })),
    A.isReadonlyArrayNonEmpty(uses) ? [DeprecatedApisFinding.cases.Refused.make({}), ...uses] : []
  ])
  return A.isReadonlyArrayNonEmpty(problems)
    ? problems
    : A.of<DeprecatedApisFinding>(DeprecatedApisFinding.cases.Clean.make({}))
})
