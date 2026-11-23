/**
 * No Promise is written: code that waits is an Effect (Benjamin's rule, 2026-11-22: "Promises are also banned"). A
 * Promise hides what can fail from the type, starts the moment it is made, and cannot be interrupted; an Effect says
 * what it needs and how it fails, and starts when it is run. A platform's Promise comes in at an edge through
 * `Effect.tryPromise` (with a `catch` that returns a typed error) or `Effect.promise`, and an Effect goes out as a
 * Promise only where a platform calls in (`promiseEntryPoints`).
 *
 * What is refused, in every code file git would commit: an `async` function or method, an `await` (`for await`
 * included), a `new Promise`, any call of `Promise.*`, a `Promise<…>` or `PromiseLike<…>` type, a `.then(`, `.catch(`
 * or `.finally(` call on anything but a name an import binds (`Effect.catch` and `Story.then` are a module's members,
 * not a promise's), an Effect run as a Promise (`runPromise`, `runPromiseExit`, `runPromiseWith`), and `Promise`
 * taken as a value (`const Q = Promise`). `Promise` is caught however it is reached: by its name, through
 * `globalThis`, `self` or `window`, or by a member in brackets (`Promise["all"]`).
 *
 * A law that reads names can be routed round (`globalThis["Prom" + "ise"]`, `const g = globalThis; g.Promise`, a
 * thenable imported from a module), so the law also reads types: every file it would refuse a use in is handed to
 * oxlint with the type-aware rules of `.oxlintrc.promises.json`, on the engine the deprecated-API law runs
 * (`tsrs-lint`), and each finding is refused the same way:
 *
 * - `typescript/no-floating-promises` (with `void` not excusing one): a Promise-typed value made and left;
 * - `typescript/no-misused-promises`: a Promise where a condition, a spread or a callback that returns nothing is;
 * - `typescript/await-thenable`: an `await` of what is not one.
 *
 * `typescript/no-misused-promises` keeps its void-return checks whole, though React 19's `ReactNode` includes a Promise,
 * so a function typed to return one is refused where a callback returns nothing (`onClick={render}`). Turning the
 * attribute and argument checks off would let through what they catch today: every one of their 6 findings is a
 * handler that really returns a Promise (a `.catch` chain in `AppSidebar.tsx`, the stepper's handlers), and no
 * `ReactNode`-typed function stands in such a slot.
 *
 * `typescript/promise-function-async` is not run: it refuses the edge this law prescribes (`Effect.tryPromise({ try:
 * () => … })`, `Effect.promise(() => …)`, `lazy(() => import(…))`) and, since React 19's `ReactNode` includes a
 * Promise, every component that returns one; the name half refuses `async` already.
 *
 * What stays open is wide, and is said as it is. A Promise made by a call that names no Promise (a library's function,
 * `globalThis["Prom" + "ise"].resolve(1)`, a function of ours that returns one) passes both halves wherever it is
 * not left floating, awaited, put in a condition or a spread, or handed where a callback returns nothing: bound to a
 * name, passed as an argument, put in an object, an array or a class's field, exported, or used in an expression. No
 * rule oxlint or `tsrs-lint` has refuses a value for its type alone; closing it needs the TypeScript checker run by
 * this repository over each project, which is not built. A file with no project is read by no typed rule: the
 * deprecated-API law refuses such a file. The profile is held as written: any other rule, option or exception is
 * refused.
 *
 * Two lists, each by name. `promiseEntryPoints`: where a platform calls in and takes a Promise, which may run an
 * Effect as one and name the type. `ledgers/promises.json`: the files that use Promises today, each with how many places,
 * which only falls (`internal/ledger.ts`): a listed file that gains a use is refused, one that loses one is refused
 * until its number is lowered, one with none comes off. The components and hooks under `packages/ui/` came from
 * registries, but every one has been changed here since it was first committed and nothing holds it to its registry,
 * so they are read and listed like any other file.
 *
 * As for the `try` law, a file nested too deep, too large, or one the parser reads with errors is refused as a whole,
 * once, at the line being read; and "every file git would commit" is git's answer, so this asks git.
 *
 * @packageDocumentation
 */
import { $RepoCliId } from "@beep/identity/packages"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as Result from "effect/Result"
import * as S from "effect/Schema"
import * as Str from "effect/String"
import { Repo } from "../../Repo.service.ts"
import { scratchpadFolder } from "../../Repo.schema.ts"
import { err, type Line, out } from "../../Report.schema.ts"
import { unreadSentence } from "./internal/budget.ts"
import { silencings } from "./internal/directives.ts"
import { ledgerAgainst, ledgersFolder, readLedger, standingOf, standingWords } from "./internal/ledger.ts"
import { type PromiseUse, readPromises } from "./internal/promiseCode.ts"

const $I = $RepoCliId.create("commands/Laws/Promises.rules")

/** A code file, by its name: TypeScript or JavaScript, wherever it is. */
const isCode = (file: string) => Str.match(/\.[cm]?[jt]sx?$/)(file).pipe(O.isSome)

/**
 * What is not read, each from the root, a folder with its closing slash: the agent skills, copied as published and run
 * by nothing; the scratchpad, where this law applies when an experiment graduates into a package; and the Alchemy
 * packages kept as files, held byte for byte to their source by `bun run alchemy:check` (`vendor/`).
 */
export const promisesLeftOut: ReadonlyArray<string> = [".agents/", `${scratchpadFolder}/`, "vendor/"]

/**
 * Where a platform calls in and takes a Promise, with what calls it: the only files that may run an Effect as a
 * Promise and name its type. Every other use of a Promise there is refused as anywhere else.
 */
export const promiseEntryPoints: Readonly<Record<string, string>> = {
  "apps/inventory/src/server/App.ts": "the Worker's exported fetch, which Cloudflare calls and awaits",
  "apps/inventory/src/web/main.tsx": "the browser's root, which starts the app"
}

/** The uses an entry point may make: an Effect run as a Promise, and the Promise type it hands the platform. */
const atAnEntry: ReadonlyArray<PromiseUse> = ["run", "type"]

/** The ledger's file, from the root. */
export const promisesLedger = `${ledgersFolder}/promises.json`

/** The type-aware profile, from the root. */
export const promisesProfile = ".oxlintrc.promises.json"

/** The typed rules, each an error; no category, option or exception beside them. */
const typedRules = [
  "typescript/no-floating-promises",
  "typescript/await-thenable",
  "typescript/no-misused-promises"
] as const

/** The profile as it must be. */
const Profile = S.fromJsonString(
  S.Struct({
    $schema: S.optionalKey(S.String).pipe(S.annotateKey({ description: "oxlint's own schema, for an editor" })),
    plugins: S.Tuple([S.Literal("typescript")]).pipe(S.annotateKey({ description: "The one plugin the rules are in" })),
    options: S.Struct({ typeAware: S.Literal(true) }).pipe(S.annotateKey({ description: "The rules read types" })),
    categories: S.Record(S.String, S.Literal("off")).pipe(
      S.annotateKey({ description: "Every category of other rules, off" })
    ),
    rules: S.Struct({
      "typescript/no-floating-promises": S.Tuple([S.Literal("error"), S.Struct({ ignoreVoid: S.Literal(false) })]),
      "typescript/await-thenable": S.Literal("error"),
      "typescript/no-misused-promises": S.Literal("error")
    }).pipe(S.annotateKey({ description: "The three typed rules, each an error" }))
  }).pipe($I.annoteSchema("PromisesProfile", { description: "The typed half of the Promise ban, as it must be" }))
)

/** oxlint's JSON report, as far as the law reads it: each finding's file, line and words, and how many files it read. */
const TypedReport = S.fromJsonString(
  S.Struct({
    diagnostics: S.Array(
      S.Struct({
        message: S.String,
        code: S.optionalKey(S.String),
        filename: S.String,
        labels: S.Array(S.Struct({ span: S.Struct({ line: S.Int }) }))
      })
    ),
    number_of_files: S.Int
  }).pipe($I.annoteSchema("TypedReport", { description: "What oxlint found with the typed rules" }))
)

/** Whether a directive turns one of the typed rules off: it names one, under either plugin's spelling, or none. */
const silencesTyped = (rules: ReadonlyArray<string>) =>
  A.isReadonlyArrayEmpty(rules) ||
  A.some(rules, (name) => A.some(typedRules, (rule) => Str.endsWith(Str.slice(11)(rule))(name)))

const isLeftOut = (file: string): boolean => A.some(promisesLeftOut, (path) => Str.startsWith(path)(file))

/** The paths not read, as the output names them each time. */
const notRead = `${A.join(promisesLeftOut, ", ")} are not read; the files in ${promisesLedger} are listed`

const PromiseUseSchema = S.Literals(["async", "await", "new", "static", "type", "chain", "run", "value"])

/**
 * What `laws promises` finds: nothing, or a refusal and each use; a listed file with none left; and what keeps it
 * from being sure.
 *
 * @category schemas
 */
export const PromiseFinding = S.TaggedUnion({
  Clean: {},
  Refused: {
    broken: S.Boolean.pipe(
      S.annotateKey({ description: "Whether a place breaks the rule, or only the ledger or what it reads fails" })
    )
  },
  Unlisted: {
    why: S.String.pipe(S.annotateKey({ description: "What git said when it could not list the files" }))
  },
  At: {
    place: S.String.pipe(S.annotateKey({ description: "The file and line, as file:line" })),
    use: PromiseUseSchema.pipe(S.annotateKey({ description: "What the use of a Promise is" }))
  },
  Standing: {
    file: S.String.pipe(S.annotateKey({ description: "A listed file whose number of uses moved" })),
    words: S.String.pipe(S.annotateKey({ description: "How it moved, and what to do" }))
  },
  Typed: {
    place: S.String.pipe(S.annotateKey({ description: "The file and line, as file:line" })),
    note: S.String.pipe(S.annotateKey({ description: "What the typed rule says, and which rule" }))
  },
  Silenced: {
    place: S.String.pipe(S.annotateKey({ description: "The file and line of the comment, as file:line" })),
    directive: S.String.pipe(S.annotateKey({ description: "The comment's directive, as written" }))
  },
  Loosened: {
    why: S.String.pipe(S.annotateKey({ description: "How the typed profile differs from the one the law holds" }))
  },
  Skipped: {
    handed: S.Int.pipe(S.annotateKey({ description: "How many files oxlint was handed" })),
    read: S.Int.pipe(S.annotateKey({ description: "How many of them it read" }))
  },
  Ledger: {
    said: S.String.pipe(S.annotateKey({ description: "What the ledger says against the files and against main" }))
  },
  Unread: {
    place: S.String.pipe(S.annotateKey({ description: "The file and line the law stopped at, as file:line" })),
    why: S.String.pipe(S.annotateKey({ description: "Why the law did not read the file, in words" }))
  }
}).pipe(
  $I.annoteSchema("PromiseFinding", {
    description: "No Promise is written, or a refusal and each place one is, or why that could not be told"
  })
)

/**
 * The decoded value of `PromiseFinding`.
 *
 * @category models
 */
export type PromiseFinding = typeof PromiseFinding.Type

/** What each use is, and what to write instead. */
const insteadOf = (use: PromiseUse): string => {
  switch (use) {
    case "async":
      return "an async function: write an Effect.fn, with Effect.tryPromise at the edge where a platform hands a Promise"
    case "await":
      return "an await: yield* an Effect in an Effect.fn"
    case "new":
      return "a new Promise: write Effect.async, Effect.callback or a Deferred"
    case "static":
      return "a call of Promise.*: write Effect.all, Effect.forEach, Effect.race or Effect.succeed"
    case "type":
      return "a Promise type: type the Effect, and let only an entry point hand a Promise to the platform"
    case "chain":
      return "a .then, .catch or .finally on a promise: write Effect.map, Effect.catch or Effect.ensuring"
    case "run":
      return "an Effect run as a Promise: run it at an entry point (promiseEntryPoints), or yield* it"
    case "value":
      return "Promise taken as a value, to be called or made under another name: write the Effect that does the work"
  }
}

/**
 * The line each finding prints.
 *
 * @category rendering
 */
export const promiseSentence: (finding: PromiseFinding) => Line = PromiseFinding.match({
  Clean: () => out(`promises:check OK  no Promise is written (${notRead})`),
  Refused: ({ broken }) =>
    broken
      ? err(`promises:check FAIL  a Promise is written. Write what each line says instead (${notRead}):`)
      : err(`promises:check FAIL  its ledger, or what it reads, does not hold (${notRead}):`),
  Unlisted: ({ why }) => err(`git could not list the files, so none was checked: ${why}`),
  At: ({ place, use }) => err(`${place}  ${insteadOf(use)}`),
  Standing: ({ file, words }) => err(`${file}  ${words}`),
  Unread: ({ place, why }) => err(`${place}  ${why}`),
  Typed: ({ note, place }) => err(`${place}  a value typed as a Promise: ${note}. Write the Effect that does the work`),
  Silenced: ({ directive, place }) =>
    err(`${place}  a comment that turns a typed Promise rule off (${directive}): no comment does. Remove it`),
  Loosened: ({ why }) => err(`  ${promisesProfile} is not the profile this law holds: ${why}`),
  Skipped: ({ handed, read }) =>
    err(`  oxlint read ${read} of the ${handed} files it was handed for the typed rules: none may be passed over`),
  Ledger: ({ said }) => err(said)
})

/** What the typed rules say of one place: its file, its line, and their words. */
interface TypedPlace {
  readonly file: string
  readonly line: number
  readonly note: string
}

/**
 * What the typed rules find in `files`: each place, and what keeps the law from being sure (a profile not its own, a
 * report it cannot read, a file passed over, a comment that turns a rule off).
 */
const typedUses = Effect.fn("Promises.typedUses")(function* (files: ReadonlyArray<string>) {
  const repo = yield* Repo
  const written = yield* repo.text(repo.join(repo.root, promisesProfile))
  const profile = S.decodeOption(Profile, { onExcessProperty: "error" })(written)
  const none = A.empty<TypedPlace>()
  if (O.isNone(profile)) {
    return {
      places: none,
      problems: A.of<PromiseFinding>(
        PromiseFinding.cases.Loosened.make({ why: "only the three typed rules, as errors, with void excusing nothing" })
      )
    }
  }
  const comments = yield* Effect.forEach(
    files,
    (file) =>
      Effect.map(repo.text(repo.join(repo.root, file)), (text) =>
        A.map(silencings({ text, silences: silencesTyped }), ({ directive, line }) =>
          PromiseFinding.cases.Silenced.make({ place: `${file}:${line}`, directive })
        )
      ),
    { concurrency: 16 }
  )
  if (A.isReadonlyArrayEmpty(files)) return { places: none, problems: A.flatten(comments) }
  const tool = (name: string) => repo.join(repo.root, "node_modules", ".bin", name)
  const answer = yield* repo.run(
    tool("oxlint"),
    ["--config", repo.join(repo.root, promisesProfile), "--disable-nested-config", "--format", "json", ...files],
    { env: { OXLINT_TSGOLINT_PATH: tool("tsrs-lint"), TSRS_FAST: "0" } }
  )
  const report = S.decodeOption(TypedReport)(answer.stdout)
  if (O.isNone(report)) {
    return {
      places: none,
      problems: A.of<PromiseFinding>(
        PromiseFinding.cases.Loosened.make({
          why: `oxlint gave no report (exit ${answer.code}): ${Str.takeLeft(400)(Str.trim(`${answer.stdout}${answer.stderr}`))}`
        })
      )
    }
  }
  const skipped =
    report.value.number_of_files === A.length(files)
      ? []
      : [PromiseFinding.cases.Skipped.make({ handed: A.length(files), read: report.value.number_of_files })]
  const places = A.map(report.value.diagnostics, (diagnostic): TypedPlace => ({
    file: diagnostic.filename,
    line: A.match(diagnostic.labels, { onEmpty: () => 0, onNonEmpty: ([first]) => first.span.line }),
    note: `${Str.trim(diagnostic.message)}${O.match(O.fromUndefinedOr(diagnostic.code), { onNone: () => "", onSome: (code) => ` (${code})` })}`
  }))
  return { places, problems: A.appendAll(skipped, A.flatten(comments)) }
})

/**
 * Reads every code file git would commit, from the repository's root, but what `promisesLeftOut` names.
 *
 * @category rules
 */
export const promises = Effect.fn("Promises.promises")(function* () {
  const repo = yield* Repo
  const ledger = yield* readLedger(promisesLedger)
  if (Result.isFailure(ledger)) {
    return A.make<[PromiseFinding, PromiseFinding]>(
      PromiseFinding.cases.Refused.make({ broken: false }),
      PromiseFinding.cases.Ledger.make({ said: ledger.failure })
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
    return A.make<[PromiseFinding, PromiseFinding]>(
      PromiseFinding.cases.Refused.make({ broken: false }),
      PromiseFinding.cases.Unlisted.make({ why: Str.trim(listed.stderr) })
    )
  }
  const files = yield* Effect.filter(
    A.filter(Str.split("\0")(listed.stdout), (file) => isCode(file) && !isLeftOut(file)),
    (file) => repo.exists(repo.join(repo.root, file)),
    { concurrency: 1 }
  )
  // The typed half over every file: a listed file is read too, so it comes off the list only when neither half finds a
  // use in it; an entry point too, where only the line that runs an Effect as a Promise is passed over.
  const typed = yield* typedUses(files)
  const typedIn = (file: string) => A.filter(typed.places, (place) => place.file === file)
  const found = yield* Effect.forEach(
    files,
    (file) =>
      Effect.map(repo.text(repo.join(repo.root, file)), (source): ReadonlyArray<PromiseFinding> => {
        const read = readPromises({ file, source })
        if (O.isSome(read.unread)) {
          return A.of(
            PromiseFinding.cases.Unread.make({
              place: `${file}:${read.unread.value.line}`,
              why: unreadSentence(read.unread.value.unread)
            })
          )
        }
        const entry = R.has(promiseEntryPoints, file)
        const allowed = entry ? atAnEntry : []
        const uses = A.filter(read.found, ({ use }) => !A.contains(allowed, use))
        // At an entry point, the line that runs an Effect as a Promise leaves that Promise to the platform: only
        // no-floating-promises is passed over there, and every other typed finding on it still counts.
        const runLines = A.map(
          A.filter(read.found, ({ use }) => entry && use === "run"),
          ({ line }) => line
        )
        const typedHere = A.filter(
          typedIn(file),
          ({ line, note }) => !(A.contains(runLines, line) && Str.includes("no-floating-promises")(note))
        )
        // A listed file is held at its number of uses, by name and by type together, which only falls.
        const standing = standingOf(ledger.success, { file, now: A.length(uses) + A.length(typedHere) })
        if (O.isSome(standing)) {
          return O.match(standingWords(standing.value, promisesLedger), {
            onNone: () => [],
            onSome: (words) => A.of(PromiseFinding.cases.Standing.make({ file, words }))
          })
        }
        return A.appendAll(
          A.map(uses, ({ line, use }) => PromiseFinding.cases.At.make({ place: `${file}:${line}`, use })),
          A.map(typedHere, ({ line, note }) => PromiseFinding.cases.Typed.make({ place: `${file}:${line}`, note }))
        )
      }),
    { concurrency: 1 }
  )
  const against = yield* ledgerAgainst({ path: promisesLedger, now: ledger.success, files })
  const problems = A.appendAll(
    A.map(against, (said) => PromiseFinding.cases.Ledger.make({ said })),
    A.appendAll(typed.problems, A.flatten(found))
  )
  return A.isArrayNonEmpty(problems)
    ? A.prepend<PromiseFinding, PromiseFinding>(
        problems,
        PromiseFinding.cases.Refused.make({
          broken: A.some(problems, (problem) => !PromiseFinding.guards.Ledger(problem))
        })
      )
    : A.of<PromiseFinding>(PromiseFinding.cases.Clean.make({}))
})
