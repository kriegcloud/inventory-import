/**
 * The scratchpad: a folder beside the workspaces, not one of them (`scratchpad/`), whose experiments import every
 * package of the repository from the root's install. An idea is tried in a folder of its own
 * (`scratchpad/experiments/<name>/`); the root's install, the build and a deploy never read it, and `bun run check`
 * only for an import of it, a key and a home path (decision "the scratchpad", 2026-11-22, and its install, in
 * explorations/ideal-architecture/DECISIONS.md).
 *
 * - `scratch new <name> --template <template>` writes an experiment whose test already passes, and its `NOTE.md`.
 * - `scratch list` says what is open and how old, warns past 30 days or 200 files, and reads back the log.
 * - `scratch check` holds what keeps the scratchpad small: no install inside an experiment (a `package.json`, a
 *   lockfile, a `node_modules`), a note that says what the experiment is, every library of the scratchpad named by an
 *   experiment's note and none the root's install already has, the scratchpad's own lockfile beside its libraries, its
 *   configuration as the CLI writes it; then the type-checker with the Effect diagnostics.
 * - `scratch graduate` and `scratch drop` end an experiment: its folder is deleted, the libraries only it named are
 *   removed, and one line of what was learned is appended to `scratchpad/LOG.md`. Moving code into a package is the
 *   person's, before graduating; there the repository's laws apply to it.
 *
 * @packageDocumentation
 */
import { $RepoCliId } from "@beep/identity/packages"
import { LiteralKit } from "@beep/schema/LiteralKit"
import * as A from "effect/Array"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as Order from "effect/Order"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import * as Str from "effect/String"
import { RepoError } from "../../Cli.errors.ts"
import { Repo } from "../../Repo.service.ts"
import { scratchpadFolder } from "../../Repo.schema.ts"
import { err, type Line, out } from "../../Report.schema.ts"
import { decodeJsonc, entriesOf, objectOf, renderObject } from "../../Sync.rules.ts"
import { scratchpadFiles } from "./Scratch.config.ts"
import { decideFileLine, diagnosticDirective, filesOf, Template, templates } from "./Scratch.templates.ts"

const $I = $RepoCliId.create("commands/Scratch/Scratch.rules")

const scratchpad = scratchpadFolder
/** An experiment older than this many days is named when the experiments are listed. */
export const oldAfterDays = 30
/** An experiment with more files than this is named when the experiments are listed. */
export const largeAfterFiles = 200

/**
 * Where an experiment stands. Only `open` is ever in a note: an experiment that graduated or was dropped has no
 * folder, and its line in the log says which.
 *
 * @category schemas
 */
export const Status = LiteralKit(["open", "graduated", "dropped"]).pipe(
  $I.annoteSchema("Status", { description: "Open, graduated into a package, or dropped" })
)

const day = S.String.pipe(
  S.check(S.isPattern(/^\d{4}-\d{2}-\d{2}$/)),
  S.annotateKey({ description: "A day, as 2026-11-22" })
)

/**
 * The head of an experiment's `NOTE.md`: what it is, since when, and what it needs that nothing else does.
 *
 * @category schemas
 */
export class Note extends S.Class<Note, { readonly brand: unique symbol }>($I`Note`)(
  {
    status: S.Literal("open").pipe(S.annotateKey({ description: "An experiment with a folder is open" })),
    started: day,
    template: Template.pipe(S.annotateKey({ description: "What it started from" })),
    libraries: S.Array(S.String).pipe(
      S.annotateKey({
        description: "The libraries only this experiment needs, as the scratchpad's package.json names them"
      })
    )
  },
  $I.annote("Note", { description: "What an experiment is, when it started and the libraries only it needs" })
) {}

/**
 * How an experiment ended.
 *
 * @category schemas
 */
export const Ending = S.TaggedUnion({
  Graduated: { to: S.String.pipe(S.annotateKey({ description: "Where its code went, from the root" })) },
  Dropped: {}
}).pipe($I.annoteSchema("Ending", { description: "Graduated to a place in the repository, or dropped" }))

/**
 * The decoded value of `Ending`.
 *
 * @category models
 */
export type Ending = typeof Ending.Type

/**
 * One line of the log: an experiment that ended, and what was learned.
 *
 * @category schemas
 */
export class Ended extends S.Class<Ended, { readonly brand: unique symbol }>($I`Ended`)(
  {
    day,
    name: S.String.pipe(S.annotateKey({ description: "The experiment's name" })),
    ending: Ending.pipe(S.annotateKey({ description: "Graduated and where to, or dropped" })),
    learned: S.String.pipe(S.annotateKey({ description: "What was learned, in one line" }))
  },
  $I.annote("Ended", { description: "An experiment that ended, how, and what was learned" })
) {}

/**
 * The parts of the scratchpad's `package.json` its rules read.
 *
 * @category schemas
 */
export class ScratchPackage extends S.Class<ScratchPackage, { readonly brand: unique symbol }>($I`ScratchPackage`)(
  {
    name: S.String.pipe(S.annotateKey({ description: "The scratchpad's package name" })),
    dependencies: S.Record(S.String, S.String).pipe(
      S.optionalKey,
      S.annotateKey({ description: "The libraries experiments added, and nothing the root's install has" })
    ),
    devDependencies: S.Record(S.String, S.String).pipe(
      S.optionalKey,
      S.annotateKey({ description: "What experiments are checked and tested with" })
    )
  },
  $I.annote("ScratchPackage", { description: "The scratchpad's name and what it depends on" })
) {}

const name = S.String.pipe(S.annotateKey({ description: "The experiment's name" }))

/**
 * What the scratch commands say.
 *
 * @category schemas
 */
export const ScratchFinding = S.TaggedUnion({
  Created: {
    name,
    template: Template.pipe(S.annotateKey({ description: "What it started from" })),
    files: S.Array(S.String).pipe(S.annotateKey({ description: "The files written, from the root" }))
  },
  Next: { text: S.String.pipe(S.annotateKey({ description: "A command to run next, and what it does" })) },
  None: {},
  Listed: { open: S.Int.pipe(S.annotateKey({ description: "How many experiments are open" })) },
  Open: {
    name,
    template: Template.pipe(S.annotateKey({ description: "What it started from" })),
    started: day,
    days: S.Int.pipe(S.annotateKey({ description: "How many days ago it started" })),
    files: S.Int.pipe(S.annotateKey({ description: "How many files it holds" }))
  },
  Warned: { name, why: S.String.pipe(S.annotateKey({ description: "What is past its limit" })) },
  Learned: { ended: Ended.pipe(S.annotateKey({ description: "A line of the log" })) },
  Kept: {
    experiments: S.Int.pipe(S.annotateKey({ description: "How many experiments were read" })),
    dependencies: S.Int.pipe(S.annotateKey({ description: "How many dependencies were accounted for" }))
  },
  Refused: { problems: S.Int.pipe(S.annotateKey({ description: "How many problems were found" })) },
  Problem: {
    where: S.String.pipe(S.annotateKey({ description: "The file or folder, from the root" })),
    message: S.String.pipe(S.annotateKey({ description: "What is wrong and what to do" }))
  },
  Typed: { experiments: S.Int.pipe(S.annotateKey({ description: "How many experiments were type-checked" })) },
  Tested: {
    name: S.String.pipe(S.annotateKey({ description: "Which tests ran: every experiment's, or one's" })),
    code: S.Int.pipe(S.annotateKey({ description: "The test runner's exit code" })),
    output: S.String.pipe(S.annotateKey({ description: "What the test runner said" }))
  },
  TypeErrors: { output: S.String.pipe(S.annotateKey({ description: "What the type-checker said" })) },
  Over: {
    ended: Ended.pipe(S.annotateKey({ description: "The line appended to the log" })),
    files: S.Int.pipe(S.annotateKey({ description: "How many files were deleted" })),
    libraries: S.Array(S.String).pipe(S.annotateKey({ description: "The libraries removed with it" }))
  }
}).pipe($I.annoteSchema("ScratchFinding", { description: "What a scratch command made, found, listed or ended" }))

/**
 * The decoded value of `ScratchFinding`.
 *
 * @category models
 */
export type ScratchFinding = typeof ScratchFinding.Type

const endingWords: (ending: Ending) => string = Ending.match({
  Graduated: ({ to }) => `graduated to ${to}`,
  Dropped: () => "dropped"
})

/**
 * An ended experiment as its line of the log, and back.
 *
 * @category rules
 */
export const logLine = (ended: Ended): string =>
  `- ${ended.day} ${ended.name}: ${endingWords(ended.ending)}. ${ended.learned}`

/**
 * A line of the log read back; a line that is not one (the heading, the paragraph under it) is none.
 *
 * @category rules
 */
export const readLogLine = (line: string): O.Option<Ended> =>
  O.map(
    O.fromNullishOr(/^- (\d{4}-\d{2}-\d{2}) ([a-z][a-z0-9-]*): (?:graduated to (\S+)|dropped)\. (.+)$/.exec(line)),
    (match) =>
      Ended.make({
        day: match[1] ?? "",
        name: match[2] ?? "",
        ending: O.match(O.fromNullishOr(match[3]), {
          onNone: () => Ending.cases.Dropped.make({}),
          onSome: (to) => Ending.cases.Graduated.make({ to })
        }),
        learned: match[4] ?? ""
      })
  )

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`

/**
 * The line each finding prints.
 *
 * @category rendering
 */
export const scratchSentence: (finding: ScratchFinding) => Line = ScratchFinding.match({
  Created: ({ name: slug, template, files }) =>
    out(
      `scratch:new  ${slug}, from the ${template} template: ${plural(files.length, "file", "files")} in ${scratchpad}/experiments/${slug}`
    ),
  Next: ({ text }) => out(`  ${text}`),
  None: () => out("scratch:list  no experiment is open"),
  Listed: ({ open }) => out(`scratch:list  ${plural(open, "experiment is", "experiments are")} open`),
  Open: ({ name: slug, template, started, days, files }) =>
    out(
      `  open  ${slug} (${template}), since ${started}: ${plural(days, "day", "days")}, ${plural(files, "file", "files")}`
    ),
  Warned: ({ name: slug, why }) =>
    out(`  look  ${slug} ${why}: graduate it (\`bun run scratch:graduate\`) or drop it (\`bun run scratch:drop\`)`),
  Learned: ({ ended }) => out(`  ${Str.slice(2)(logLine(ended))}`),
  Kept: ({ experiments, dependencies }) =>
    out(
      `scratch:check OK  ${plural(experiments, "experiment", "experiments")}, none with an install of its own; ${plural(dependencies, "dependency", "dependencies")} accounted for`
    ),
  Refused: ({ problems }) => err(`scratch:check FAIL  ${plural(problems, "problem", "problems")}`),
  Problem: ({ where, message }) => err(`  ${where}: ${message}`),
  Typed: ({ experiments }) =>
    out(
      `scratch:check OK  the scratchpad's configuration and ${plural(experiments, "experiment pass", "experiments pass")} the type-checker and the Effect diagnostics`
    ),
  Tested: ({ name: which, code, output }) =>
    code === 0 ? out(`scratch:test OK  ${which}\n${output}`) : err(`scratch:test FAIL  ${which}\n${output}`),
  TypeErrors: ({ output }) =>
    err(`scratch:check FAIL  the type-checker, with the Effect diagnostics, over the experiments:\n${output}`),
  Over: ({ ended, files, libraries }) =>
    out(
      `scratch  ${ended.name} ${endingWords(ended.ending)}: ${plural(files, "file", "files")} deleted${
        libraries.length === 0 ? "" : `, ${A.join(libraries, ", ")} removed from the scratchpad's package.json`
      }, one line added to ${scratchpad}/LOG.md`
    )
})

const refuse = (path: string, message: string) => RepoError.make({ path, message })
const validName = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/
const installs = ["package.json", "bun.lock", "bun.lockb", "package-lock.json", "pnpm-lock.yaml", "yarn.lock"]
const ownState = (path: string) =>
  A.some([".state", "node_modules", "dist"], (folder) => A.contains(Str.split("/")(path), folder))

/**
 * The head of a `NOTE.md` (the lines between its two `---`) as a note; what does not read as one is none.
 *
 * @category rules
 */
export const readNote = (text: string): O.Option<Note> => {
  // A note saved on Windows, or with a byte-order mark, is the same note.
  const plain = Str.replace(/\r\n?/g, "\n")(Str.replace(/^\uFEFF/, "")(text))
  const head = O.fromNullishOr(/^---\n([\s\S]*?)\n---/.exec(plain)?.[1])
  const fields = O.map(head, (found) =>
    R.fromEntries(
      A.flatMap(Str.split("\n")(found), (line) =>
        O.match(O.fromNullishOr(/^([a-z]+):\s*(.*)$/.exec(line)), {
          onNone: () => A.empty<readonly [string, string]>(),
          onSome: (match) => [[match[1] ?? "", Str.trim(match[2] ?? "")] as const]
        })
      )
    )
  )
  return O.flatMap(fields, (found) =>
    S.decodeUnknownOption(Note)({
      status: O.getOrUndefined(R.get(found, "status")),
      started: O.getOrUndefined(R.get(found, "started")),
      template: O.getOrUndefined(R.get(found, "template")),
      libraries: A.filter(
        A.map(Str.split(",")(O.getOrElse(R.get(found, "libraries"), () => "")), Str.trim),
        (library) => library !== ""
      )
    })
  )
}

/**
 * A new experiment's `NOTE.md`.
 *
 * @category rules
 */
export const noteText = (options: { readonly name: string; readonly note: Note; readonly question: string }): string =>
  A.join(
    [
      "---",
      `status: ${options.note.status}`,
      `started: ${options.note.started}`,
      `template: ${options.note.template}`,
      `libraries: ${A.join(options.note.libraries, ", ")}`,
      "---",
      "",
      `# ${options.name}`,
      "",
      options.question === "" ? "What is this experiment trying to find out? One sentence." : options.question,
      "",
      "## What was tried",
      "",
      "## What was found",
      ""
    ],
    "\n"
  )

/** The install that follows a change to the scratchpad's dependencies. A test gives its own. */
export type Install = Effect.Effect<{ readonly code: number; readonly output: string }, RepoError, Repo>

/** The type-check of every experiment: `tsrs -p tsconfig.json` in the scratchpad, through its `types` script. */
export const bunTypes: Install = Effect.gen(function* () {
  const repo = yield* Repo
  const answer = yield* repo.run("bun", ["run", "types"], { cwd: repo.join(repo.root, scratchpad) })
  return { code: answer.code, output: Str.trim(`${answer.stdout}\n${answer.stderr}`) }
})

/**
 * Where a file turns an Effect diagnostic off, and whether it may (decision 33 of the Alchemy brief, 2026-11-22: "`new`
 * only in decide files"). The prover knows an event or a rejection only by `new`, so a decide file (`*.aggregate.ts`,
 * `*.decision.ts`) may turn `newSchemaClass` off on its first line, and on no other; no other file may turn anything
 * off. Each line is a refusal, with its line number from 1.
 *
 * @example
 * diagnosticLines("Shelf.aggregate.ts")(decideFileLine) // []
 * diagnosticLines("Shelf.ts")(decideFileLine) // [1]
 *
 * @category rules
 */
export const diagnosticLines =
  (file: string) =>
  (text: string): ReadonlyArray<number> => {
    const decideFile = /\.(aggregate|decision)\.ts$/.test(file)
    return A.flatMap(Str.split("\n")(Str.replace(/\r/g, "")(text)), (line, index) =>
      Str.includes(diagnosticDirective)(line) && !(decideFile && index === 0 && Str.trim(line) === decideFileLine)
        ? [index + 1]
        : []
    )
  }

/**
 * The comment that turns the type-checker, and with it every Effect diagnostic, off for a whole file. It is another
 * spelling of "turn a diagnostic off", so the scratchpad refuses it as it refuses the Effect directive.
 *
 * @category rules
 */
export const noCheck = "@ts-nocheck"

/**
 * The lines of a file that name {@link noCheck}, numbered from 1, in any mix of capitals: the compiler lower-cases
 * the name before it looks it up, so `@TS-NoCheck` turns the checks off as well. The compiler honours it only before
 * the code; the scratchpad refuses it wherever it stands, so nobody has to reason about which comment is the leading
 * one.
 *
 * @example
 * uncheckedLines("// @ts-nocheck\nexport const count = 1\n") // [1]
 *
 * @category rules
 */
export const uncheckedLines = (text: string): ReadonlyArray<number> =>
  A.flatMap(Str.split("\n")(text), (line, index) => (/@ts-nocheck/i.test(line) ? [index + 1] : []))

/** The files the type-check reads, each absolute. A test gives its own. */
export type Listing = Effect.Effect<ReadonlyArray<string>, RepoError, Repo>

/**
 * The TypeScript files in what the compiler prints for `--listFilesOnly`: one absolute path a line, other lines (a
 * runner's own) left out.
 *
 * @example
 * programFiles("$ tsrs -p tsconfig.json\n/repo/scratchpad/vite.config.ts\n") // ["/repo/scratchpad/vite.config.ts"]
 *
 * @category rules
 */
export const programFiles = (output: string): ReadonlyArray<string> =>
  A.filter(A.map(Str.split("\n")(output), Str.trim), (line) => /^(?:\/|[A-Za-z]:[\\/]).*\.[cm]?tsx?$/.test(line))

/**
 * Every file the scratchpad's type-check reads, asked of the compiler itself (`tsrs -p tsconfig.json
 * --listFilesOnly`): what its `include` matches, following a linked folder, and every file those reach by an import,
 * whatever folder it is in. Walking the folder instead would guess at both.
 *
 * @category rules
 */
export const bunFiles: Listing = Effect.gen(function* () {
  const repo = yield* Repo
  const dir = repo.join(repo.root, scratchpad)
  const answer = yield* repo.run("bun", ["run", "types", "--listFilesOnly"], { cwd: dir })
  if (answer.code !== 0) {
    return yield* refuse(
      repo.join(dir, "tsconfig.json"),
      `the type-checker could not say which files it reads:\n${Str.trim(`${answer.stdout}\n${answer.stderr}`)}`
    )
  }
  return programFiles(answer.stdout)
})

/** The test runner over the scratchpad, given the folder to run: every experiment's, or one's. */
export type RunTests = (
  folder: string
) => Effect.Effect<{ readonly code: number; readonly output: string }, RepoError, Repo>

/**
 * vitest in the scratchpad, through its `tests` script, limited to the files under one folder: the folder ends in a
 * slash, so `experiments/xlsx-dates/` never matches `experiments/xlsx-dates-2/`.
 */
export const bunTests: RunTests = Effect.fn("Scratch.bunTests")(function* (folder: string) {
  const repo = yield* Repo
  const answer = yield* repo.run("bun", ["run", "tests", `${folder}/`], { cwd: repo.join(repo.root, scratchpad) })
  return { code: answer.code, output: Str.trim(`${answer.stdout}\n${answer.stderr}`) }
})

/**
 * `scratch test [name]`: every experiment's tests, or one experiment's only. The name is a folder, so `xlsx-dates`
 * never runs `xlsx-dates-2` too (a test runner's name filter matches any part of a path).
 *
 * @category rules
 */
export const scratchTest = Effect.fn("Scratch.scratchTest")(function* (name: O.Option<string>, run: RunTests) {
  const state = yield* reading()
  if (O.isSome(name) && !A.some(state.experiments, (one) => one.slug === name.value)) {
    return yield* refuse(
      `${scratchpad}/experiments/${name.value}`,
      `${scratchpad}/experiments/${name.value} is not there. Open: ${
        state.experiments.length === 0
          ? "none"
          : A.join(
              A.map(state.experiments, (one) => one.slug),
              ", "
            )
      }`
    )
  }
  const folder = O.match(name, { onNone: () => "experiments", onSome: (slug) => `experiments/${slug}` })
  const ran = yield* run(folder)
  // An experiment with no test ran nothing, which is no pass: the scratchpad passes when empty, an experiment does not.
  const none = O.isSome(name) && /No test files found/.test(ran.output)
  return A.of<ScratchFinding>(
    ScratchFinding.cases.Tested.make({
      name: O.getOrElse(name, () => "every experiment"),
      code: none ? 1 : ran.code,
      output: none
        ? `${ran.output}\n${folder} has no test file: an experiment starts with one (\`bun run scratch:new\`)`
        : ran.output
    })
  )
})

/** `bun install` in the scratchpad, which has its own lockfile: the root's install is never touched. */
export const bunInstall: Install = Effect.gen(function* () {
  const repo = yield* Repo
  const answer = yield* repo.run("bun", ["install"], { cwd: repo.join(repo.root, scratchpad) })
  return { code: answer.code, output: Str.trim(`${answer.stdout}\n${answer.stderr}`) }
})

/** The scratchpad as the rules read it: its folders, its experiments and its package.json. */
const reading = Effect.fn("Scratch.reading")(function* () {
  const repo = yield* Repo
  const dir = repo.join(repo.root, scratchpad)
  const manifestFile = repo.join(dir, "package.json")
  if (!(yield* repo.exists(manifestFile))) {
    return yield* refuse(manifestFile, `${scratchpad}/package.json is not there: this repository has no scratchpad`)
  }
  const experimentsDir = repo.join(dir, "experiments")
  const entries = yield* repo.entries(experimentsDir)
  const folders = A.sort(
    A.map(
      A.filter(entries, (entry) => entry.directory),
      (entry) => entry.name
    ),
    Order.String
  )
  const experiments = yield* Effect.forEach(
    folders,
    Effect.fnUntraced(function* (slug) {
      const folder = repo.join(experimentsDir, slug)
      const noteFile = repo.join(folder, "NOTE.md")
      const hasNote = yield* repo.exists(noteFile)
      const text = hasNote ? yield* repo.text(noteFile) : ""
      const paths = yield* repo.tree(folder)
      return { slug, folder, note: readNote(text), paths }
    }),
    { concurrency: 1 }
  )
  const manifestText = yield* repo.text(manifestFile)
  const manifest = yield* decodeJsonc(ScratchPackage)(`${scratchpad}/package.json`, manifestText)
  return { dir, experimentsDir, experiments, manifestFile, manifestText, manifest }
})

const today = Effect.map(DateTime.now, DateTime.formatIsoDateUtc)

/** A `package.json`'s text with one block of names and versions changed. */
const withBlock = (
  text: string,
  block: string,
  change: (entries: ReadonlyArray<readonly [string, string]>) => ReadonlyArray<readonly [string, string]>
): string =>
  O.match(objectOf(block)(text), {
    onNone: () => text,
    onSome: (found) => {
      const entries = A.map(entriesOf(found)(text), ([key, value]) => [key.value, value.value] as const)
      const byName = Order.mapInput(Order.String, (entry: readonly [string, string]) => entry[0])
      const changed = A.sort(change(entries), byName)
      return `${Str.slice(0, found.start)(text)}${renderObject(found.indent)(changed)}${Str.slice(found.end)(text)}`
    }
  })

/**
 * `scratch new`: a folder for one experiment, from a template whose test already passes.
 *
 * @category rules
 */
export const scratchNew = Effect.fn("Scratch.scratchNew")(function* (options: {
  readonly name: string
  readonly template: Template
  readonly question: string
}) {
  const repo = yield* Repo
  const slug = options.name
  if (!validName.test(slug) || slug.length > 40) {
    return yield* refuse(
      slug,
      `"${slug}" cannot name an experiment: use small letters, digits and single hyphens, starting with a letter, at most 40 characters (stock-count, xlsx-dates-2)`
    )
  }
  const state = yield* reading()
  const folder = repo.join(state.experimentsDir, slug)
  const where = `${scratchpad}/experiments/${slug}`
  if (yield* repo.exists(folder)) {
    return yield* refuse(folder, `${where} is already there: choose another name, or end that experiment first`)
  }

  // The prover comes from the root's install, as every package of the repository does: it is there once a package
  // asks for it. A second copy in the scratchpad would be a second Effect beside the packages'.
  if (options.template === "verify") {
    const prover = repo.join(repo.root, "node_modules", "@alchemy.run", "domain", "package.json")
    if (!(yield* repo.exists(prover))) {
      return yield* refuse(
        prover,
        `the verify template needs @alchemy.run/domain, and the root's install does not have it (no package asks for it yet, or \`bun install\` has not run). Until it does, start from ${A.join(
          A.filter(templates, (template) => template !== "verify"),
          ", "
        )}`
      )
    }
  }

  const started = yield* today
  const note = Note.make({
    status: "open",
    started,
    template: options.template,
    libraries: []
  })
  const files = A.prepend(filesOf(options.template)(slug), {
    name: "NOTE.md",
    text: noteText({ name: slug, note, question: options.question })
  })
  yield* Effect.forEach(files, (file) => repo.write(repo.join(folder, file.name), file.text), {
    concurrency: 1,
    discard: true
  })
  // The scratchpad's own configuration, written where it is missing: the CLI is where it is kept.
  yield* Effect.forEach(
    scratchpadFiles,
    Effect.fnUntraced(function* (file) {
      const absolute = repo.join(state.dir, file.name)
      if (!(yield* repo.exists(absolute))) yield* repo.write(absolute, file.text)
    }),
    { concurrency: 1, discard: true }
  )
  const next: ReadonlyArray<string> = A.flatten([
    [`bun run scratch:test ${slug}    its test, which passes as written`],
    options.template === "screen"
      ? [`bun run scratch:serve experiments/${slug}    its page, on http://localhost:5273`]
      : [],
    ["bun run scratch:check    the type-checker and the Effect diagnostics, over every experiment"],
    [`${where}/NOTE.md    say what it is trying to find out`]
  ])
  return A.prepend<ScratchFinding, ScratchFinding>(
    A.map(next, (text): ScratchFinding => ScratchFinding.cases.Next.make({ text })),
    ScratchFinding.cases.Created.make({
      name: slug,
      template: options.template,
      files: A.map(files, (file) => `${where}/${file.name}`)
    })
  )
})

const dayMillis = 86_400_000

/**
 * `scratch list`: what is open, how old and how large, what is past a limit, and what the ended ones taught.
 *
 * @category rules
 */
export const scratchList = Effect.fn("Scratch.scratchList")(function* () {
  const repo = yield* Repo
  const state = yield* reading()
  const now = yield* DateTime.now
  const open = A.flatMap(state.experiments, (experiment): ReadonlyArray<ScratchFinding> => {
    const files = A.filter(experiment.paths, (path) => !ownState(path) && /\.[A-Za-z0-9]+$/.test(path)).length
    return O.match(experiment.note, {
      onNone: () => [
        ScratchFinding.cases.Warned.make({
          name: experiment.slug,
          why: "has no NOTE.md that says what it is (`bun run scratch:check` says what is missing)"
        })
      ],
      onSome: (note) => {
        const days = O.match(DateTime.make(note.started), {
          onNone: () => 0,
          onSome: (started) => Math.floor((DateTime.toEpochMillis(now) - DateTime.toEpochMillis(started)) / dayMillis)
        })
        const reasons = A.appendAll(
          days > oldAfterDays ? [`is ${days} days old (more than ${oldAfterDays})`] : [],
          files > largeAfterFiles ? [`holds ${files} files (more than ${largeAfterFiles})`] : []
        )
        return A.prepend<ScratchFinding, ScratchFinding>(
          A.map(reasons, (why): ScratchFinding => ScratchFinding.cases.Warned.make({ name: experiment.slug, why })),
          ScratchFinding.cases.Open.make({
            name: experiment.slug,
            template: note.template,
            started: note.started,
            days,
            files
          })
        )
      }
    })
  })
  const logFile = repo.join(state.dir, "LOG.md")
  const hasLog = yield* repo.exists(logFile)
  const log = hasLog ? yield* repo.text(logFile) : ""
  const learned = A.map(
    A.flatMap(Str.split("\n")(log), (line) => O.toArray(readLogLine(line))),
    (ended): ScratchFinding => ScratchFinding.cases.Learned.make({ ended })
  )
  const header =
    state.experiments.length === 0
      ? ScratchFinding.cases.None.make({})
      : ScratchFinding.cases.Listed.make({ open: state.experiments.length })
  return A.flatten<ReadonlyArray<ReadonlyArray<ScratchFinding>>>([[header], open, learned])
})

/**
 * `scratch check`: no install inside an experiment, a note for each, every dependency accounted for, and then the
 * type-checker with the Effect diagnostics over every experiment. An empty scratchpad has nothing to type-check.
 *
 * @category rules
 */
export const scratchCheck = Effect.fn("Scratch.scratchCheck")(function* (types: Install, files: Listing) {
  const repo = yield* Repo
  const state = yield* reading()
  const problem = (where: string, message: string): ScratchFinding =>
    ScratchFinding.cases.Problem.make({ where, message })
  // A diagnostic turned off: only `newSchemaClass`, only on the first line of a decide file. Read in the files the
  // compiler itself says it reads, so a file it reaches by an import or through a linked folder is read here too,
  // whatever its folder is called, and a file it never loads (JavaScript, a cache nothing imports) is not.
  const program = yield* files
  const inScratchpad = (file: string) => Str.startsWith(`${state.dir}/`)(file)
  const owner: (dir: string) => Effect.Effect<O.Option<string>> = Effect.fnUntraced(function* (dir: string) {
    if (yield* repo.exists(repo.join(dir, "package.json"))) return O.some(dir)
    const parent = repo.dirname(dir)
    return parent === dir ? O.none<string>() : yield* owner(parent)
  })
  // Outside the scratchpad, a file of a package is that package's own, held by its own check; any other file an
  // experiment reached (one loose in the repository, or outside it) is the experiment's.
  const ours = yield* Effect.filter(
    A.filter(A.dedupe(program), (file) => !A.contains(Str.split("/")(file), "node_modules")),
    (file) =>
      inScratchpad(file)
        ? Effect.succeed(true)
        : Effect.map(
            owner(repo.dirname(file)),
            O.match({ onNone: () => true, onSome: (dir) => dir === repo.root || dir === state.dir })
          ),
    { concurrency: 1 }
  )
  const code = A.sort(
    A.map(ours, (file) => repo.relative(repo.root, file)),
    Order.String
  )
  const turnedOff = yield* Effect.forEach(
    code,
    (path) =>
      Effect.map(repo.text(repo.join(repo.root, path)), (text) =>
        A.appendAll(
          A.map(diagnosticLines(path)(text), (line) =>
            problem(
              `${path}:${line}`,
              `turns an Effect diagnostic off. Only a decide file (\`*.aggregate.ts\`, \`*.decision.ts\`) may, and only \`${decideFileLine}\` as its first line (decision 33 of the Alchemy brief): build with \`.make\` here`
            )
          ),
          A.map(uncheckedLines(text), (line) =>
            problem(
              `${path}:${line}`,
              `names \`${noCheck}\`, which turns the type-checker and every Effect diagnostic off for a whole file. No file of the scratchpad may hold it: remove the line and fix what the type-checker then says`
            )
          )
        )
      ),
    { concurrency: 1 }
  )
  const perExperiment = A.flatMap(state.experiments, (experiment) => {
    const where = `${scratchpad}/experiments/${experiment.slug}`
    const nested = A.filter(experiment.paths, (path) => {
      const segments = Str.split("/")(path)
      return (
        A.contains(
          installs,
          O.getOrElse(A.last(segments), () => "")
        ) || O.contains(A.last(segments), "node_modules")
      )
    })
    return A.appendAll(
      A.map(nested, (path) =>
        problem(
          `${where}/${path}`,
          "an experiment has no install of its own: a library goes in the scratchpad's package.json and is named in the experiment's NOTE.md (`libraries:`). Remove this"
        )
      ),
      O.isSome(experiment.note)
        ? []
        : [
            problem(
              `${where}/NOTE.md`,
              `is missing or does not read as a note: it starts with status: open, started: a day, template: one of ${A.join(templates, ", ")}, and libraries: (empty, or names separated by commas), between two lines of ---`
            )
          ]
    )
  })

  // A library of the scratchpad is an experiment's own: one the root's install already has (effect, react, a package
  // of the repository) comes from the root, as it is, and a second copy would be a second of it beside the packages'.
  const fromRoot = (name: string) => repo.exists(repo.join(repo.root, "node_modules", name, "package.json"))
  const named = A.flatMap(state.experiments, (experiment) =>
    O.match(experiment.note, {
      onNone: () => A.empty<{ readonly library: string; readonly slug: string }>(),
      onSome: (note) => A.map(note.libraries, (library) => ({ library, slug: experiment.slug }))
    })
  )
  const declared = R.toEntries({ ...state.manifest.dependencies, ...state.manifest.devDependencies })
  const shared = yield* Effect.filter(
    A.map(declared, ([dependency]) => dependency),
    (dependency) =>
      Effect.map(
        fromRoot(dependency),
        (installed) =>
          installed ||
          dependency === "effect" ||
          Str.startsWith("@effect/")(dependency) ||
          Str.startsWith("react")(dependency)
      ),
    { concurrency: 1 }
  )
  const sharedProblems = A.map(shared, (dependency) =>
    problem(
      `${scratchpad}/package.json`,
      `\`${dependency}\` comes from the root's install: an experiment imports it as the packages do. Remove it here (\`bun remove --cwd ${scratchpad} ${dependency}\`), so there is one copy`
    )
  )
  const unaccounted = A.map(
    A.filter(
      declared,
      ([dependency]) => !A.contains(shared, dependency) && !A.some(named, (one) => one.library === dependency)
    ),
    ([dependency]) =>
      problem(
        `${scratchpad}/package.json`,
        `\`${dependency}\` is a library no experiment's NOTE.md names (\`libraries:\`): name the experiment that needs it, or remove it`
      )
  )
  // The scratchpad's own lockfile is committed: bun writes it with the first library.
  const lockfile = repo.join(state.dir, "bun.lock")
  const hasLockfile = yield* repo.exists(lockfile)
  const unlocked =
    declared.length > 0 && !hasLockfile
      ? [
          problem(
            `${scratchpad}/package.json`,
            `lists libraries and ${scratchpad}/bun.lock is not there: run \`bun install --cwd ${scratchpad}\` and commit ${scratchpad}/bun.lock`
          )
        ]
      : []
  // Its configuration is the CLI's (scratch new writes it): a file that differs would be read by nothing that checks it.
  const configs = yield* Effect.forEach(
    A.filter(scratchpadFiles, (file) => file.name !== "package.json"),
    Effect.fnUntraced(function* (file) {
      const absolute = repo.join(state.dir, file.name)
      const there = yield* repo.exists(absolute)
      const text = there ? yield* repo.text(absolute) : ""
      return text === file.text
        ? A.empty<ScratchFinding>()
        : [
            problem(
              `${scratchpad}/${file.name}`,
              there
                ? "differs from what the CLI writes (packages/tooling/tool/cli/src/commands/Scratch/Scratch.config.ts): change both together"
                : "is missing: `bun run scratch:new` writes it"
            )
          ]
    }),
    { concurrency: 1 }
  )
  const undeclared = A.map(
    A.filter(named, (one) => !A.some(declared, ([dependency]) => dependency === one.library)),
    (one) =>
      problem(
        `${scratchpad}/experiments/${one.slug}/NOTE.md`,
        `names the library \`${one.library}\`, which is not in the scratchpad's package.json: add it there (\`bun add --cwd ${scratchpad} ${one.library}\`), or take it out of the note`
      )
  )
  const problems = A.flatten([
    perExperiment,
    A.flatten(turnedOff),
    sharedProblems,
    unaccounted,
    undeclared,
    unlocked,
    A.flatten(configs)
  ])
  const structure = A.isArrayNonEmpty(problems)
    ? A.prepend<ScratchFinding, ScratchFinding>(
        problems,
        ScratchFinding.cases.Refused.make({ problems: problems.length })
      )
    : A.of<ScratchFinding>(
        ScratchFinding.cases.Kept.make({ experiments: state.experiments.length, dependencies: declared.length })
      )
  // The type-checker runs on an empty scratchpad too: its own configuration files are in the project.
  const typed = yield* types
  return A.append<ScratchFinding, ScratchFinding>(
    structure,
    typed.code === 0
      ? ScratchFinding.cases.Typed.make({ experiments: state.experiments.length })
      : ScratchFinding.cases.TypeErrors.make({ output: typed.output })
  )
})

/**
 * `scratch graduate` and `scratch drop`: the experiment's folder is deleted, the libraries only it named leave the
 * scratchpad's package.json, and one line of what was learned is appended to the log.
 *
 * @category rules
 */
export const scratchEnd = Effect.fn("Scratch.scratchEnd")(function* (
  options: { readonly name: string; readonly to: O.Option<string>; readonly learned: string },
  install: Install
) {
  const repo = yield* Repo
  const state = yield* reading()
  const slug = options.name
  const where = `${scratchpad}/experiments/${slug}`
  const experiment = A.findFirst(state.experiments, (one) => one.slug === slug)
  if (O.isNone(experiment)) {
    return yield* refuse(
      where,
      `${where} is not there. Open: ${
        state.experiments.length === 0
          ? "none"
          : A.join(
              A.map(state.experiments, (one) => one.slug),
              ", "
            )
      }`
    )
  }
  const learned = Str.trim(Str.replace(/\s+/g, " ")(options.learned))
  if (learned === "") {
    return yield* refuse(where, "say what was learned, in one line (--learned): it is all that stays of the experiment")
  }
  const to = O.map(options.to, (path) => repo.relative(repo.root, repo.resolve(path)))
  if (O.isSome(to)) {
    const target = repo.join(repo.root, to.value)
    const inside =
      to.value === scratchpad || Str.startsWith(`${scratchpad}/`)(to.value) || Str.startsWith("..")(to.value)
    if (inside || /\s/.test(to.value) || !(yield* repo.exists(target))) {
      return yield* refuse(
        to.value,
        `an experiment graduates to where its code now is: a file or folder of this repository outside the scratchpad, with no space in its path. ${to.value} is not one. Move the code first, then graduate`
      )
    }
  }
  const ending = O.match(to, {
    onNone: () => Ending.cases.Dropped.make({}),
    onSome: (path) => Ending.cases.Graduated.make({ to: path })
  })
  const day = yield* today
  const ended = Ended.make({ day, name: slug, ending, learned })

  // The libraries only this experiment named go with it.
  const own = O.match(experiment.value.note, { onNone: () => A.empty<string>(), onSome: (note) => note.libraries })
  const librariesOf = (note: O.Option<Note>): ReadonlyArray<string> =>
    O.match(note, { onNone: () => A.empty<string>(), onSome: (found) => found.libraries })
  const others = A.flatMap(state.experiments, (one) => (one.slug === slug ? [] : librariesOf(one.note)))
  const leaving = A.filter(own, (library) => !A.contains(others, library))
  const without = (entries: ReadonlyArray<readonly [string, string]>) =>
    A.filter(entries, ([key]) => !A.contains(leaving, key))
  const manifestText = withBlock(withBlock(state.manifestText, "dependencies", without), "devDependencies", without)
  const removed = manifestText !== state.manifestText
  if (removed) yield* repo.write(state.manifestFile, manifestText)

  const files = A.filter(experiment.value.paths, (path) => !ownState(path) && /\.[A-Za-z0-9]+$/.test(path)).length
  yield* repo.remove(experiment.value.folder)
  const logFile = repo.join(state.dir, "LOG.md")
  const hasLog = yield* repo.exists(logFile)
  const log = hasLog ? yield* repo.text(logFile) : "# What the experiments taught\n\n"
  yield* repo.write(logFile, `${Str.endsWith("\n")(log) ? log : `${log}\n`}${logLine(ended)}\n`)
  if (removed) {
    const installed = yield* install
    if (installed.code !== 0) {
      return yield* refuse(
        "bun install",
        `${where} is deleted and logged, and ${A.join(leaving, ", ")} is out of the scratchpad's package.json, but \`bun install\` did not finish:\n${installed.output}`
      )
    }
  }
  return A.of<ScratchFinding>(ScratchFinding.cases.Over.make({ ended, files, libraries: removed ? leaving : [] }))
})
