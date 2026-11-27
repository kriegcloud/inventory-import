/**
 * A model's tasks name what they read, or turbo replays an old pass: a file a model's blocks import from outside a
 * task's inputs can change and leave that task green on the model as it was (goals/alchemy-domain-uptake/INVENTORY.md,
 * tests-07; CLAUDE.md, "A model's task names what it reads"). For every workspace whose `beep.layer` is `model`, this
 * holds each of these tasks its `turbo.json` declares: `verify`, `mutants` and `mutants:sample`, which read the whole
 * model, from every `src/**\/*.model.ts` and `src/**\/*.api.ts`; and `prove`, which reads the blocks a proof runs, from
 * every `src/**\/*.aggregate.ts` and `src/**\/*.decision.ts`. Each task's walk also starts from every code file of the
 * package (`.ts`, `.tsx`, `.mts`, `.cts`; its `node_modules` and dot folders left out) that the task's own inputs
 * read: its tests, its proofs' helpers, its mutants, its vitest config, so what they import is held too. From each
 * start it walks the relative imports, file to file, anywhere they lead (the package's `src`, a folder beside it,
 * another package by a relative path), and refuses every file reached that no input glob of the task matches, naming
 * the task, the file and the glob to add: the file's ending under its top folder (`src/**\/*.view.ts`), the file
 * itself when its name has no ending, or the file under `$TURBO_ROOT$/` when it is outside the package. When a `!`
 * glob is what takes the file out, the refusal names that glob, to remove or narrow, since no glob added can help. A
 * relative import that names no file is refused too.
 *
 * What it reads as turbo does: the package's `turbo.json` with its comments; a glob relative to the package, one
 * under `$TURBO_ROOT$/` relative to the root, `$TURBO_DEFAULT$` as every file inside the package (none reached through
 * `../`), a `!` glob as one taken out; `**`, `*`, `?` and `{a,b}`. Turbo's `$TURBO_DEFAULT$` leaves out what git
 * ignores; this does not tell a git-ignored file inside the package apart, and takes it as read. A task with no
 * `inputs` reads every file, and passes. A relative import is found as the bundler finds it: its `?query` or `#hash`
 * cut off (`./a.csv?raw` names `./a.csv`), then as written, a `.js`, `.jsx`, `.mjs` or `.cjs` written for its `.ts`,
 * `.tsx`, `.mts` or `.cts`, with `.ts` or `.tsx` added, or a folder's `index.ts`. What it does not follow: an import of
 * a package by its name (the kernel, the contract: their folders are listed whole, by hand), and an import whose path
 * is built at run time (a template with nothing put into it, `import(\`./x.ts\`)`, is followed). Type-only imports
 * are followed, the type `import("./x.ts")` included: what a block's types read is what its proofs read.
 *
 * @packageDocumentation
 */
import { $RepoCliId } from "@beep/identity/packages"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as Order from "effect/Order"
import * as S from "effect/Schema"
import * as Str from "effect/String"
import type { RepoError } from "../../Cli.errors.ts"
import { Repo } from "../../Repo.service.ts"
import { err, type Line, out } from "../../Report.schema.ts"
import { decodeJsonc, literally } from "../../Sync.rules.ts"
import { readImports } from "./internal/importsCode.ts"

const $I = $RepoCliId.create("commands/Laws/ModelInputs.rules")

/**
 * What `laws model-inputs` finds: every file a model reaches in the inputs of each task that reads it, or each one that
 * is not (missing, or taken out by a `!` glob), and each relative import that names no file.
 *
 * @category schemas
 */
export const ModelInputsFinding = S.TaggedUnion({
  Held: {
    walked: S.Int.pipe(
      S.annotateKey({
        description:
          "How many files the walks started from: models, Apis, aggregates, decisions and each task's own code"
      })
    ),
    files: S.Int.pipe(
      S.annotateKey({ description: "How many files they reach, each an input of every task that reads it" })
    )
  },
  Refused: {},
  Unmatched: {
    task: S.String.pipe(S.annotateKey({ description: "The task whose inputs do not read the file" })),
    file: S.String.pipe(S.annotateKey({ description: "The file reached, from the root" })),
    from: S.String.pipe(S.annotateKey({ description: "The file the walk that reaches it started from" })),
    turbo: S.String.pipe(S.annotateKey({ description: "The turbo.json that declares the task" })),
    glob: S.String.pipe(S.annotateKey({ description: "The input to add, by the file's ending" }))
  },
  TakenOut: {
    task: S.String.pipe(S.annotateKey({ description: "The task whose inputs take the file out" })),
    file: S.String.pipe(S.annotateKey({ description: "The file reached, from the root" })),
    from: S.String.pipe(S.annotateKey({ description: "The file the walk that reaches it started from" })),
    turbo: S.String.pipe(S.annotateKey({ description: "The turbo.json that declares the task" })),
    glob: S.String.pipe(S.annotateKey({ description: "The ! glob that takes it out, as written" }))
  },
  Unresolved: {
    file: S.String.pipe(S.annotateKey({ description: "The file that imports, from the root" })),
    specifier: S.String.pipe(S.annotateKey({ description: "The relative path it imports, as written" }))
  }
}).pipe(
  $I.annoteSchema("ModelInputsFinding", {
    description: "Every file a model imports in the inputs of each task that reads it, or each one missing"
  })
)

/**
 * The decoded value of `ModelInputsFinding`.
 *
 * @category models
 */
export type ModelInputsFinding = typeof ModelInputsFinding.Type

/** A count and its noun, one or many. */
const plural = (count: number, one: string, many: string): string => `${count} ${count === 1 ? one : many}`

/**
 * The line each finding prints.
 *
 * @category rendering
 */
export const modelInputsSentence: (finding: ModelInputsFinding) => Line = ModelInputsFinding.match({
  Held: ({ walked, files }) =>
    out(
      `model-inputs:check OK  ${plural(walked, "start reaches", "starts reach")} ${plural(files, "file", "files")} (the models, Apis, aggregates and decisions, and the code each task reads), each an input of every task of its package that reads it`
    ),
  Refused: () =>
    err(
      "model-inputs:check FAIL  a model reaches a file a task of its package does not read, so a change to it would replay an old pass:"
    ),
  Unmatched: ({ task, file, from, turbo, glob }) =>
    err(
      `  ${file}${file === from ? "" : `, which ${from} imports,`} is in no input of ${task} in ${turbo}: add "${glob}" to its inputs`
    ),
  TakenOut: ({ task, file, from, turbo, glob }) =>
    err(
      `  ${file}${file === from ? "" : `, which ${from} imports,`} is taken out of the inputs of ${task} in ${turbo} by "${glob}": remove that glob, or narrow it so it leaves this file in`
    ),
  Unresolved: ({ file, specifier }) =>
    err(`  ${file} imports "${specifier}", which names no file: write the path of the file it means`)
})

/** One task's inputs: the globs, or none written, which reads every file. */
const TaskInputs = S.Struct({
  inputs: S.String.pipe(
    S.Array,
    S.OptionFromOptionalKey,
    S.annotateKey({ description: "The globs whose files the task's hash is taken from" })
  )
}).annotate({ description: "One task of a model package's turbo.json" })

/** The part of a model package's `turbo.json` this reads: the inputs of the four tasks that read the model. */
const ModelTurbo = S.Struct({
  tasks: S.Struct({
    verify: S.OptionFromOptionalKey(TaskInputs).pipe(S.annotateKey({ description: "The search of the whole model" })),
    prove: S.OptionFromOptionalKey(TaskInputs).pipe(S.annotateKey({ description: "The proofs of the model's rules" })),
    mutants: S.OptionFromOptionalKey(TaskInputs).pipe(S.annotateKey({ description: "Every mutant of the model" })),
    "mutants:sample": S.OptionFromOptionalKey(TaskInputs).pipe(
      S.annotateKey({ description: "A sample of the model's mutants" })
    )
  }).pipe(S.annotateKey({ description: "The package's tasks" }))
}).annotate({ description: "The tasks of a model package's turbo.json that read the model" })

/** Every glob `{a,b}` stands for, braces inside braces included. */
const expanded = (glob: string): ReadonlyArray<string> =>
  O.match(
    O.flatMap(O.fromNullishOr(/\{([^{}]*)\}/.exec(glob)), (found) =>
      O.map(A.get(found, 1), (inner) => ({
        before: Str.slice(0, found.index)(glob),
        inner,
        after: Str.slice(found.index + found[0].length)(glob)
      }))
    ),
    {
      onNone: () => A.of(glob),
      onSome: ({ before, inner, after }) =>
        A.flatMap(Str.split(",")(inner), (choice) => expanded(`${before}${choice}${after}`))
    }
  )

/**
 * Whether a path fits a glob as turbo reads one: `**` any folders (none included), `*` and `?` within a name, `{a,b}`
 * either.
 *
 * @example globFits("src/**\/*.view.ts")("src/Catalog.view.ts") // true
 */
export const globFits = (glob: string): ((path: string) => boolean) => {
  const expressions = A.map(expanded(glob), (one) => {
    const body = A.join(
      A.map(A.fromIterable(Str.matchAll(/\*\*\/|\*\*|\*|\?|[^*?]+/g)(one)), (match) => {
        const token = match[0]
        return token === "**/"
          ? "(?:.*/)?"
          : token === "**"
            ? ".*"
            : token === "*"
              ? "[^/]*"
              : token === "?"
                ? "[^/]"
                : literally(token)
      }),
      ""
    )
    return new RegExp(`^${body}$`)
  })
  return (path) => A.some(expressions, (expression) => expression.test(path))
}

/** What a task's inputs make of one file: whether a glob reads it, and the `!` glob, as written, that takes it out. */
interface Reading {
  readonly kept: boolean
  readonly takenBy: O.Option<string>
}

/**
 * What the inputs make of a file, given it from the package and from the root. `$TURBO_DEFAULT$` is every file inside
 * the package, as turbo reads only the package's own files for it: never one reached through `../`.
 */
const readingOf = (inputs: ReadonlyArray<string>, fromPackage: string, fromRoot: string): Reading => {
  const fits = (glob: string): boolean =>
    glob === "$TURBO_DEFAULT$"
      ? !Str.startsWith("../")(fromPackage)
      : Str.startsWith("$TURBO_ROOT$/")(glob)
        ? globFits(Str.slice("$TURBO_ROOT$/".length)(glob))(fromRoot)
        : globFits(glob)(fromPackage)
  return {
    kept: A.some(
      A.filter(inputs, (glob) => !Str.startsWith("!")(glob)),
      fits
    ),
    takenBy: A.findFirst(inputs, (glob) => Str.startsWith("!")(glob) && fits(Str.slice(1)(glob)))
  }
}

/** Whether the inputs read a file: a glob reads it and no `!` glob takes it out. */
const reads = (reading: Reading): boolean => reading.kept && O.isNone(reading.takenBy)

/** The input that reads a file and every file of its kind: its ending under its top folder, or the file itself. */
const globFor = (fromPackage: string, fromRoot: string): string => {
  if (Str.startsWith("../")(fromPackage)) return `$TURBO_ROOT$/${fromRoot}`
  const segments = Str.split("/")(fromPackage)
  return O.match(
    O.filter(Str.match(/\.([a-z-]+)\.((?:m|c)?tsx?)$/)(A.lastNonEmpty(segments)), () => segments.length > 1),
    {
      onNone: () => fromPackage,
      onSome: (found) => `${A.headNonEmpty(segments)}/**/*.${A.join(A.drop(found, 1), ".")}`
    }
  )
}

/** The two kinds of walk: from the whole model, or from the blocks a proof runs. */
type Side = "model" | "proof"

/** Where each task's walk starts: the whole model for Verify and the mutants, the blocks a proof runs for `prove`. */
const startsOf: Readonly<Record<Side, (file: string) => boolean>> = {
  model: (file: string): boolean => O.isSome(Str.match(/\.(model|api)\.tsx?$/)(file)),
  proof: (file: string): boolean => O.isSome(Str.match(/\.(aggregate|decision)\.tsx?$/)(file))
}

const isRelative = (specifier: string): boolean => Str.startsWith("./")(specifier) || Str.startsWith("../")(specifier)
const isCode = (file: string): boolean => O.isSome(Str.match(/\.[mc]?[jt]sx?$/)(file))
/** A TypeScript file of the package a task's inputs may name, so a walk starts from it: a test, a helper, a mutant. */
const isOwnCode = (file: string): boolean => O.isSome(Str.match(/\.(m|c)?tsx?$/)(file))

/** The path a specifier names, its `?query` and `#hash` cut off: `./a.csv` of `./a.csv?raw`. */
const pathOf = (specifier: string): string => A.headNonEmpty(Str.split(/[?#]/)(specifier))

/** The paths a relative import may mean, in the order the bundler tries them. */
const candidatesOf = (base: string): ReadonlyArray<string> =>
  A.appendAll(
    A.map(
      A.filter(
        [
          [".js", ".ts"],
          [".js", ".tsx"],
          [".jsx", ".tsx"],
          [".mjs", ".mts"],
          [".cjs", ".cts"]
        ] as const,
        ([written]) => Str.endsWith(written)(base)
      ),
      ([written, meant]) => `${Str.slice(0, base.length - written.length)(base)}${meant}`
    ),
    [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]
  )

/** A relative import that names no file: the file that writes it, from the root, and the path as written. */
interface Unresolved {
  readonly file: string
  readonly specifier: string
}

/** What one file imports: the files its relative imports name, and those that name no file. */
interface Imported {
  readonly found: ReadonlyArray<string>
  readonly unresolved: ReadonlyArray<Unresolved>
}

/** One file the walk reached, and the file it started from. */
interface Reached {
  readonly file: string
  readonly from: string
}

/** One start's walk: the file it starts from, every file it reaches (itself first), and the imports naming no file. */
interface Walk extends Imported {
  readonly start: string
  readonly files: ReadonlyArray<Reached>
}

/**
 * Walks the relative imports of every model, Api, aggregate and decision of every model package, and of every code
 * file of the package a task's inputs read, and holds each file reached to the inputs of each task that reads it.
 *
 * @category rules
 */
export const modelInputs = Effect.fn("ModelInputs.modelInputs")(function* () {
  const repo = yield* Repo
  const all = yield* repo.workspaces
  const models = A.filter(all, (workspace) => workspace.manifest.beep?.layer === "model")

  // Whether a path is a file: it is there, and its folder lists it as no folder.
  const isFile = Effect.fnUntraced(function* (path: string) {
    if (!(yield* repo.exists(path))) return false
    const siblings = yield* repo.entries(repo.dirname(path))
    return A.some(siblings, (entry) => entry.path === path && !entry.directory)
  })
  // The file a relative import names, or none.
  const target = Effect.fnUntraced(function* (from: string, specifier: string) {
    const base = repo.resolve(repo.dirname(from), pathOf(specifier))
    for (const candidate of candidatesOf(base)) {
      if (yield* isFile(candidate)) return O.some(candidate)
    }
    return O.none<string>()
  })
  // The files one file imports, and the relative imports that name no file.
  const importsOf = Effect.fnUntraced(function* (file: string) {
    const nothing: Imported = { found: [], unresolved: [] }
    if (!isCode(file)) return nothing
    const source = yield* repo.text(file)
    const specifiers = A.dedupe(A.filter(readImports({ file, source }), isRelative))
    const resolved = yield* Effect.forEach(
      specifiers,
      (specifier) => Effect.map(target(file, specifier), (found) => ({ specifier, found })),
      { concurrency: 1 }
    )
    const imported: Imported = {
      found: A.getSomes(A.map(resolved, (one) => one.found)),
      unresolved: A.flatMap(resolved, (one) =>
        O.isSome(one.found) ? [] : [{ file: repo.relative(file, repo.root), specifier: one.specifier }]
      )
    }
    return imported
  })
  // Every file one start reaches, itself first, with the imports on the way that name no file.
  const reached = Effect.fnUntraced(function* (start: string) {
    let seen: ReadonlyArray<string> = A.of(start)
    let frontier: ReadonlyArray<string> = A.of(start)
    let unresolved: ReadonlyArray<Unresolved> = []
    while (A.isReadonlyArrayNonEmpty(frontier)) {
      const next: ReadonlyArray<Imported> = yield* Effect.forEach(frontier, importsOf, { concurrency: 1 })
      unresolved = A.appendAll(
        unresolved,
        A.flatMap(next, (one) => one.unresolved)
      )
      const fresh = A.dedupe(
        A.filter(
          A.flatMap(next, (one) => one.found),
          (file) => !A.contains(seen, file)
        )
      )
      seen = A.appendAll(seen, fresh)
      frontier = fresh
    }
    const walk: Omit<Walk, "start"> = {
      found: seen,
      unresolved,
      files: A.map(seen, (file): Reached => ({ file, from: start }))
    }
    return walk
  })

  // Every TypeScript file under a folder, its `node_modules` and dot folders (`.turbo`) left out.
  const codeUnder: (dir: string) => Effect.Effect<ReadonlyArray<string>, RepoError> = Effect.fnUntraced(function* (
    dir: string
  ) {
    const found = yield* repo.entries(dir)
    const nested = yield* Effect.forEach(
      found,
      (entry) =>
        entry.directory
          ? entry.name === "node_modules" || Str.startsWith(".")(entry.name)
            ? Effect.succeed(A.empty<string>())
            : codeUnder(entry.path)
          : Effect.succeed(isOwnCode(entry.path) ? A.of(entry.path) : A.empty<string>()),
      { concurrency: 1 }
    )
    return A.flatten(nested)
  })

  const perPackage = yield* Effect.forEach(
    models,
    Effect.fnUntraced(function* (workspace) {
      const turboFile = repo.join(workspace.dir, "turbo.json")
      const none = { walked: A.empty<string>(), files: A.empty<string>(), findings: A.empty<ModelInputsFinding>() }
      if (!(yield* repo.exists(turboFile))) return none
      const text = yield* repo.text(turboFile)
      const turbo = yield* decodeJsonc(ModelTurbo)(turboFile, text)
      const tasks = [
        { task: "verify", side: "model", declared: turbo.tasks.verify },
        { task: "mutants", side: "model", declared: turbo.tasks.mutants },
        { task: "mutants:sample", side: "model", declared: turbo.tasks["mutants:sample"] },
        { task: "prove", side: "proof", declared: turbo.tasks.prove }
      ] as const
      const held = A.filter(tasks, (one) => O.isSome(one.declared))
      if (!A.isReadonlyArrayNonEmpty(held)) return none
      // In the order of their paths, so the refusals come out the same on every machine.
      const listed = yield* repo.files(repo.join(workspace.dir, "src"))
      const everything = A.sort(listed, Order.String)
      const ownFiles = yield* codeUnder(workspace.dir)
      const code = A.sort(ownFiles, Order.String)
      const readingFor = (globs: ReadonlyArray<string>, file: string): Reading =>
        readingOf(globs, repo.relative(file, workspace.dir), repo.relative(file, repo.root))
      // Each task's starts: the blocks of its side first, then every code file of the package its inputs read.
      const planned = A.map(held, ({ task, side, declared }) => {
        const globs = O.flatMap(declared, (one) => one.inputs)
        const own = O.match(globs, {
          onNone: () => A.empty<string>(),
          onSome: (inputs) => A.filter(code, (file) => reads(readingFor(inputs, file)))
        })
        return { task, globs, starts: A.dedupe(A.appendAll(A.filter(everything, startsOf[side]), own)) }
      })
      const walks: ReadonlyArray<Walk> = yield* Effect.forEach(
        A.dedupe(A.flatMap(planned, (one) => one.starts)),
        (start) => Effect.map(reached(start), (walk): Walk => ({ start, ...walk })),
        { concurrency: 1 }
      )
      const written: ReadonlyArray<Unresolved> = A.flatMap(walks, (walk) => walk.unresolved)
      const unresolved = A.map(
        A.dedupeWith(written, (a, b) => a.file === b.file && a.specifier === b.specifier),
        (one) => ModelInputsFinding.cases.Unresolved.make(one)
      )
      // Every file a task's starts reach, each once, with the first start that reaches it.
      const reachedFrom = (starts: ReadonlyArray<string>): ReadonlyArray<Reached> => {
        const files: ReadonlyArray<Reached> = A.flatMap(starts, (start) =>
          A.flatMap(
            A.filter(walks, (walk: Walk) => walk.start === start),
            (walk: Walk): ReadonlyArray<Reached> => walk.files
          )
        )
        return A.dedupeWith(files, (a, b) => a.file === b.file)
      }
      const unmatched = A.flatMap(planned, ({ task, globs, starts }) =>
        O.match(globs, {
          // A task with no inputs reads every file of its package.
          onNone: () => A.empty<ModelInputsFinding>(),
          onSome: (inputs) =>
            A.flatMap(reachedFrom(starts), ({ file, from }) => {
              const reading = readingFor(inputs, file)
              const fromPackage = repo.relative(file, workspace.dir)
              const fromRoot = repo.relative(file, repo.root)
              const where = {
                task,
                file: fromRoot,
                from: repo.relative(from, repo.root),
                turbo: repo.relative(turboFile, repo.root)
              }
              return O.match(reading.takenBy, {
                onSome: (glob) => A.of<ModelInputsFinding>(ModelInputsFinding.cases.TakenOut.make({ ...where, glob })),
                onNone: () =>
                  reading.kept
                    ? A.empty<ModelInputsFinding>()
                    : A.of<ModelInputsFinding>(
                        ModelInputsFinding.cases.Unmatched.make({ ...where, glob: globFor(fromPackage, fromRoot) })
                      )
              })
            })
        })
      )
      return {
        walked: A.map(walks, (walk) => walk.start),
        files: A.dedupe(A.flatMap(walks, (walk) => A.map(walk.files, (one) => one.file))),
        findings: A.appendAll(unresolved, unmatched)
      }
    }),
    { concurrency: 1 }
  )
  const problems = A.flatMap(perPackage, (one) => one.findings)
  return A.isArrayNonEmpty(problems)
    ? A.prepend<ModelInputsFinding, ModelInputsFinding>(problems, ModelInputsFinding.cases.Refused.make({}))
    : A.of<ModelInputsFinding>(
        ModelInputsFinding.cases.Held.make({
          walked: A.reduce(perPackage, 0, (sum, one) => sum + one.walked.length),
          files: A.reduce(perPackage, 0, (sum, one) => sum + one.files.length)
        })
      )
})
