/**
 * A file of screens exports components and nothing else (Benjamin, 2026-11-23: "Yes, build it", on his editor's
 * `react(only-export-components)` warning). Vite's fast refresh keeps a component's state across an edit only when
 * its file exports nothing but components; a file that also exports an atom, a constant or a helper reloads the page
 * and loses what the person typed. The rule is oxlint's `react/only-export-components`, an error, run over our own
 * screen code from the root (`.oxlintrc.fast-refresh.json`): the app's `src/web`, and the four packages the build
 * names as having screens (`screenPackages` in `apps/inventory/vite.config.ts`: `packages/ui`, `packages/review`,
 * `packages/access/web`, `packages/catalog/web`), each under `src/`.
 *
 * Not read: the registry's components and hooks under `packages/ui/src/components/` and `packages/ui/src/hooks/`,
 * whose exports their registry sets (a component beside its `cva` variants, a hook beside its provider): 22 places
 * in 17 files on 2026-11-23, which a later `shadcn add` would put back. Benjamin chose this ("Skip registry folders",
 * 2026-11-23) for this rule alone: the readonly and dual laws still read those folders.
 *
 * `ledgers/fast-refresh.json` names the files that break the rule today, each with how many places, which only falls,
 * held against the files there are and against main (`internal/ledger.ts`). The profile is held as written, and a
 * comment that turns the rule off is refused.
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
import { err, type Line, out } from "../../Report.schema.ts"
import { silencings } from "./internal/directives.ts"
import { ledgerAgainst, ledgersFolder, readLedger, standingOf, standingWords } from "./internal/ledger.ts"

const $I = $RepoCliId.create("commands/Laws/FastRefresh.rules")

/** The profile, from the root. */
export const fastRefreshProfile = ".oxlintrc.fast-refresh.json"

/** The ledger's file, from the root. */
export const fastRefreshLedger = `${ledgersFolder}/fast-refresh.json`

/** The folders of screen code that are read, from the root. */
export const screenFolders: ReadonlyArray<string> = [
  "apps/inventory/src/web/",
  "packages/ui/src/",
  "packages/review/src/",
  "packages/access/web/src/",
  "packages/catalog/web/src/"
]

/** What is not read inside them: the registry's components and hooks, whose exports their registry sets. */
export const fastRefreshLeftOut: ReadonlyArray<string> = ["packages/ui/src/components/", "packages/ui/src/hooks/"]

const isCode = (file: string) => Str.match(/\.[cm]?[jt]sx?$/)(file).pipe(O.isSome)

const isRead = (file: string): boolean =>
  isCode(file) &&
  A.some(screenFolders, (folder) => Str.startsWith(folder)(file)) &&
  !A.some(fastRefreshLeftOut, (folder) => Str.startsWith(folder)(file))

/** The profile as it must be: the one rule, an error, every category of other rules off, no exception. */
const Profile = S.fromJsonString(
  S.Struct({
    $schema: S.optionalKey(S.String).pipe(S.annotateKey({ description: "oxlint's own schema, for an editor" })),
    plugins: S.Tuple([S.Literal("react")]).pipe(S.annotateKey({ description: "The one plugin the rule is in" })),
    categories: S.Record(S.String, S.Literal("off")).pipe(
      S.annotateKey({ description: "Every category of other rules, off" })
    ),
    rules: S.Struct({ "react/only-export-components": S.Literal("error") }).pipe(
      S.annotateKey({ description: "The one rule, an error" })
    )
  }).pipe($I.annoteSchema("FastRefreshProfile", { description: "The fast-refresh ban's profile, as it must be" }))
)

/** oxlint's JSON report, as far as the law reads it: each finding's file and line, and how many files it read. */
const Report = S.fromJsonString(
  S.Struct({
    diagnostics: S.Array(
      S.Struct({ filename: S.String, labels: S.Array(S.Struct({ span: S.Struct({ line: S.Int }) })) })
    ),
    number_of_files: S.Int
  }).pipe($I.annoteSchema("FastRefreshReport", { description: "What oxlint found with the fast-refresh rule" }))
)

/** Whether a directive turns the rule off: it names it, under either plugin's spelling, or names none. */
const silences = (rules: ReadonlyArray<string>) =>
  A.isReadonlyArrayEmpty(rules) || A.some(rules, Str.endsWith("only-export-components"))

/**
 * What `laws fast-refresh` finds.
 *
 * @category schemas
 */
export const FastRefreshFinding = S.TaggedUnion({
  Clean: {},
  Refused: {
    broken: S.Boolean.pipe(
      S.annotateKey({ description: "Whether a place breaks the rule, or only the ledger or what it reads fails" })
    )
  },
  Unreadable: {
    why: S.String.pipe(
      S.annotateKey({ description: "Why the profile, git's list or oxlint's report could not be read" })
    )
  },
  At: {
    place: S.String.pipe(S.annotateKey({ description: "The file and line, as file:line" }))
  },
  Standing: {
    file: S.String.pipe(S.annotateKey({ description: "A listed file whose number of places moved" })),
    words: S.String.pipe(S.annotateKey({ description: "How it moved, and what to do" }))
  },
  Ledger: {
    said: S.String.pipe(S.annotateKey({ description: "What the ledger says against the files and against main" }))
  },
  Silenced: {
    place: S.String.pipe(S.annotateKey({ description: "The file and line of the comment, as file:line" })),
    directive: S.String.pipe(S.annotateKey({ description: "The comment's directive, as written" }))
  }
}).pipe(
  $I.annoteSchema("FastRefreshFinding", {
    description: "Every file of screens exports components only, or a refusal and each place one does not"
  })
)

/**
 * The decoded value of `FastRefreshFinding`.
 *
 * @category models
 */
export type FastRefreshFinding = typeof FastRefreshFinding.Type

const read = `${A.join(screenFolders, ", ")} are read but ${A.join(fastRefreshLeftOut, " and ")}; the files in ${fastRefreshLedger} are listed`

/**
 * The line each finding prints.
 *
 * @category rendering
 */
export const fastRefreshSentence: (finding: FastRefreshFinding) => Line = FastRefreshFinding.match({
  Clean: () => out(`fast-refresh:check OK  every file of screens exports components only (${read})`),
  Refused: ({ broken }) =>
    broken
      ? err(
          `fast-refresh:check FAIL  a file of screens exports more than components. Write what each line says (${read}):`
        )
      : err(`fast-refresh:check FAIL  its ledger, or what it reads, does not hold (${read}):`),
  Unreadable: ({ why }) => err(`  ${why}`),
  At: ({ place }) =>
    err(
      `${place}  an export that is not a component: move it to a file of its own (an atom to a .atoms.ts, a helper to a .rules.ts), so fast refresh keeps the screen's state`
    ),
  Standing: ({ file, words }) => err(`${file}  ${words}`),
  Ledger: ({ said }) => err(said),
  Silenced: ({ directive, place }) =>
    err(`${place}  a comment that turns only-export-components off (${directive}): no comment does. Remove it`)
})

/** Where oxlint finds the rule broken in `files`, or why its report could not be read. */
const placesIn = Effect.fn("FastRefresh.placesIn")(function* (files: ReadonlyArray<string>) {
  const repo = yield* Repo
  const oxlint = repo.join(repo.root, "node_modules", ".bin", "oxlint")
  const answer = yield* repo.run(oxlint, [
    "--config",
    repo.join(repo.root, fastRefreshProfile),
    "--disable-nested-config",
    "--format",
    "json",
    ...files
  ])
  return O.match(S.decodeOption(Report)(answer.stdout), {
    onNone: () =>
      Result.fail(
        `oxlint gave no report (exit ${answer.code}): ${Str.takeLeft(400)(Str.trim(`${answer.stdout}${answer.stderr}`))}`
      ),
    onSome: (report) =>
      report.number_of_files === A.length(files)
        ? Result.succeed(
            A.map(report.diagnostics, (diagnostic) => ({
              file: diagnostic.filename,
              line: A.match(diagnostic.labels, { onEmpty: () => 0, onNonEmpty: ([first]) => first.span.line })
            }))
          )
        : Result.fail(
            `oxlint read ${report.number_of_files} of the ${A.length(files)} files it was handed: none may be passed over`
          )
  })
})

/**
 * Runs the rule over the screen folders, from the repository's root, and holds what it finds to the ledger.
 *
 * @category rules
 */
export const fastRefresh = Effect.fn("FastRefresh.fastRefresh")(function* () {
  const repo = yield* Repo
  const refused = (problems: ReadonlyArray<FastRefreshFinding>) =>
    A.prepend<FastRefreshFinding, FastRefreshFinding>(
      problems,
      FastRefreshFinding.cases.Refused.make({
        broken: A.some(
          problems,
          (problem) => FastRefreshFinding.guards.At(problem) || FastRefreshFinding.guards.Silenced(problem)
        )
      })
    )
  const written = yield* repo.text(repo.join(repo.root, fastRefreshProfile))
  if (O.isNone(S.decodeOption(Profile, { onExcessProperty: "error" })(written))) {
    return refused([
      FastRefreshFinding.cases.Unreadable.make({
        why: `${fastRefreshProfile} is not the profile this law holds: the one rule, an error, every other category off`
      })
    ])
  }
  const ledger = yield* readLedger(fastRefreshLedger)
  if (Result.isFailure(ledger)) return refused([FastRefreshFinding.cases.Ledger.make({ said: ledger.failure })])
  const git = yield* repo.run("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard", "--deduplicate"])
  if (git.code !== 0) {
    return refused([
      FastRefreshFinding.cases.Unreadable.make({ why: `git could not list the files: ${Str.trim(git.stderr)}` })
    ])
  }
  const files = yield* Effect.filter(
    A.filter(Str.split("\0")(git.stdout), isRead),
    (file) => repo.exists(repo.join(repo.root, file)),
    { concurrency: 1 }
  )
  const comments = yield* Effect.forEach(
    files,
    (file) =>
      Effect.map(repo.text(repo.join(repo.root, file)), (text) =>
        A.map(silencings({ text, silences }), ({ directive, line }) =>
          FastRefreshFinding.cases.Silenced.make({ place: `${file}:${line}`, directive })
        )
      ),
    { concurrency: 16 }
  )
  const places = A.isReadonlyArrayEmpty(files)
    ? Result.succeed<ReadonlyArray<{ readonly file: string; readonly line: number }>>([])
    : yield* placesIn(files)
  if (Result.isFailure(places)) return refused([FastRefreshFinding.cases.Unreadable.make({ why: places.failure })])
  const found = A.flatMap(files, (file): ReadonlyArray<FastRefreshFinding> => {
    const here = A.filter(places.success, (place) => place.file === file)
    return O.match(standingOf(ledger.success, { file, now: A.length(here) }), {
      onNone: () =>
        A.map(A.dedupe(A.map(here, ({ line }) => line)), (line) =>
          FastRefreshFinding.cases.At.make({ place: `${file}:${line}` })
        ),
      onSome: (standing) =>
        O.match(standingWords(standing, fastRefreshLedger), {
          onNone: () => [],
          onSome: (words) => A.of(FastRefreshFinding.cases.Standing.make({ file, words }))
        })
    })
  })
  const against = yield* ledgerAgainst({ path: fastRefreshLedger, now: ledger.success, files })
  const problems = A.flatten<ReadonlyArray<ReadonlyArray<FastRefreshFinding>>>([
    A.map(against, (said) => FastRefreshFinding.cases.Ledger.make({ said })),
    A.flatten(comments),
    found
  ])
  return A.isReadonlyArrayNonEmpty(problems)
    ? refused(problems)
    : A.of<FastRefreshFinding>(FastRefreshFinding.cases.Clean.make({}))
})
