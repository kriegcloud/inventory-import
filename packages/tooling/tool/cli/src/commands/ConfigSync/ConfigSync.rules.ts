/**
 * Configuration that repeats what the workspaces already say, derived from them instead of kept by hand. A package
 * is added in one place (a folder with a `package.json` under a `workspaces` pattern); every list and path that
 * depends on where it is and what it holds follows from that:
 *
 * - `sources`: `.syncpackrc.json` reads the root's `package.json` and one pattern for each `workspaces` pattern, so
 *   `deps:lint`, `deps:outdated` and `deps:update` see every package;
 * - `coverage`: every folder with a `package.json` under `apps` and `packages` fits a `workspaces` pattern, and every
 *   pattern names at least one;
 * - `paths`: a `$schema`, an `extends` and a path in a script name a file that exists; one that does not, and would
 *   from the repository's root, is written for the folder it is in (the depth of the package);
 * - `references`: a solution file (`"files": []`) references every project beside it, and the root's also every
 *   project of a package that its own `tsconfig.json` leaves out; no reference names nothing; a project that has
 *   `references` lists the packages its `package.json` declares;
 * - `scripts`: a package has the scripts turbo runs for what it holds: `check` type-checks each of its projects and
 *   counts against its ceiling file, `test` exists beside a `vitest.config.ts`, `lint` unless it is vendored;
 * - `tasks`: every root task `turbo.json` defines (`//#name`) has a root script and is run by `check` and
 *   `check:full`;
 * - `vendored`: the formatter leaves every vendored package alone;
 * - `scratchpad`: the scratchpad (`scratchpad/`) depends on every package under `packages`, so an experiment can
 *   import any of them and a new package is there without anyone remembering. syncpack does not read the scratchpad:
 *   what an experiment adds there is the experiment's, and `version-sync` holds the rest to the packages' versions.
 *
 * @packageDocumentation
 */
import { $RepoCliId } from "@beep/identity/packages"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as Order from "effect/Order"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import * as Str from "effect/String"
import type { RepoError } from "../../Cli.errors.ts"
import { Repo, type Workspace } from "../../Repo.service.ts"
import { scratchpadFolder } from "../../Repo.schema.ts"
import {
  anchorless,
  blankComments,
  arrayOf,
  decodeJsonc,
  entriesOf,
  fits,
  type Found,
  type FoundBlock,
  isLocalPath,
  lineAt,
  objectOf,
  renderArray,
  renderObject,
  stringsIn,
  stringValues
} from "../../Sync.rules.ts"
import { Drift, mergePlans, type Mode, Plan, Problem, settle, SyncFinding } from "../../Sync.schema.ts"

const $I = $RepoCliId.create("commands/ConfigSync/ConfigSync.rules")

/**
 * The parts of a `package.json` the derived configuration follows from.
 *
 * @category schemas
 */
export class PackageFile extends S.Class<PackageFile, { readonly brand: unique symbol }>($I`PackageFile`)(
  {
    name: S.optionalKey(S.String).pipe(S.annotateKey({ description: "The package's name" })),
    workspaces: S.String.pipe(
      S.Array,
      S.optionalKey,
      S.annotateKey({ description: "The workspace patterns: only the repository's root has them" })
    ),
    scripts: S.Record(S.String, S.String).pipe(
      S.optionalKey,
      S.annotateKey({ description: "The package's scripts, name to command" })
    )
  },
  $I.annote("PackageFile", { description: "A package.json's name, workspace patterns and scripts" })
) {}

/**
 * The parts of a `tsconfig` file the references follow from.
 *
 * @category schemas
 */
export class TsconfigFile extends S.Class<TsconfigFile, { readonly brand: unique symbol }>($I`TsconfigFile`)(
  {
    files: S.String.pipe(
      S.Array,
      S.optionalKey,
      S.annotateKey({ description: "The files it names: an empty list makes it a solution file" })
    ),
    references: S.Struct({ path: S.String }).pipe(
      S.Array,
      S.optionalKey,
      S.annotateKey({ description: "The projects it references, each a file or a folder" })
    )
  },
  $I.annote("TsconfigFile", { description: "A tsconfig's file list and project references" })
) {}

/**
 * The parts of `turbo.json` the root scripts follow from.
 *
 * @category schemas
 */
export class TurboFile extends S.Class<TurboFile, { readonly brand: unique symbol }>($I`TurboFile`)(
  {
    tasks: S.Record(S.String, S.Unknown).pipe(S.annotateKey({ description: "The tasks, a root task as //#name" }))
  },
  $I.annote("TurboFile", { description: "The task names turbo.json defines" })
) {}

/** A file's text with where it is, from the root and on disk. */
interface Text {
  readonly file: string
  readonly absolute: string
  readonly text: string
}

const drift = (
  at: Text,
  span: { readonly start: number; readonly end: number },
  words: { readonly what: string; readonly found: string; readonly expected: string; readonly text: string }
): Drift => Drift.make({ file: at.file, line: lineAt(at.text)(span.start), start: span.start, end: span.end, ...words })

const one = (plan: { readonly drifts?: ReadonlyArray<Drift>; readonly problems?: ReadonlyArray<Problem> }): Plan =>
  Plan.make({ checked: 1, drifts: plan.drifts ?? [], problems: plan.problems ?? [] })
const agreed = Plan.make({ checked: 1, drifts: [], problems: [] })

/** Whether a stretch of a file holds a comment, which rewriting the stretch whole would lose. */
const commentIn = (at: Text, span: { readonly start: number; readonly end: number }): boolean =>
  Str.slice(span.start, span.end)(at.text) !== Str.slice(span.start, span.end)(blankComments(at.text))

/**
 * A list or an object rewritten whole, or, when it holds a comment that the rewrite would lose, a problem that says
 * what to change by hand.
 */
const blockDrift = (
  at: Text,
  span: { readonly start: number; readonly end: number },
  words: { readonly what: string; readonly found: string; readonly expected: string; readonly text: string }
): Plan =>
  commentIn(at, span)
    ? one({
        problems: [
          Problem.make({
            file: at.file,
            message: `line ${lineAt(at.text)(span.start)}: ${words.what} differs (found ${words.found}; expected ${words.expected}), and writing it would lose the comment inside it: change it by hand`
          })
        ]
      })
    : one({ drifts: [drift(at, span, words)] })
const nothing = Plan.make({ checked: 0, drifts: [], problems: [] })
const quoted = (value: string) => `"${value}"`
const listed = (values: ReadonlyArray<string>) => (values.length === 0 ? "nothing" : A.join(values, ", "))
const inside = (block: FoundBlock) => (found: Found) => found.start > block.start && found.end < block.end
const projectName = /^tsconfig\.[\w-]+\.json$/
const base = "tsconfig.base.json"

/**
 * Compares every derived list and path with what the workspaces say, and writes nothing.
 *
 * @category rules
 */
export const configSyncPlan = Effect.fn("ConfigSync.plan")(function* () {
  const repo = yield* Repo
  const read = Effect.fn("ConfigSync.read")(function* (absolute: string) {
    const text = yield* repo.text(absolute)
    return { file: repo.relative(repo.root, absolute), absolute, text } satisfies Text
  })
  const readIfThere = Effect.fn("ConfigSync.readIfThere")(function* (absolute: string) {
    if (!(yield* repo.exists(absolute))) return O.none<Text>()
    const at = yield* read(absolute)
    return O.some(at)
  })
  const fromHere = (dir: string, target: string) => {
    const relative = repo.relative(dir, target)
    return Str.startsWith(".")(relative) ? relative : `./${relative}`
  }

  const rootPackage = yield* read(repo.join(repo.root, "package.json"))
  const rootManifest = yield* decodeJsonc(PackageFile)(rootPackage.file, rootPackage.text)
  const patterns = rootManifest.workspaces ?? []
  const byFolder = Order.mapInput(Order.String, (workspace: Workspace) => workspace.dir)
  const unsorted = yield* repo.workspaces
  const workspaces = A.sort(unsorted, byFolder)
  const folderOf = (workspace: Workspace) => repo.relative(repo.root, workspace.dir)

  // sources: what syncpack reads is the root and one pattern for each workspace pattern.
  const sourcesPlan = Effect.fn("ConfigSync.sources")(function* () {
    const config = yield* readIfThere(repo.join(repo.root, ".syncpackrc.json"))
    if (O.isNone(config)) return nothing
    const expected = A.prepend(
      A.map(
        A.filter(patterns, (pattern) => pattern !== scratchpadFolder),
        (pattern) => `${pattern}/package.json`
      ),
      "package.json"
    )
    const block = arrayOf("source")(config.value.text)
    if (O.isNone(block)) {
      return one({
        problems: [
          Problem.make({
            file: config.value.file,
            message: `has no "source" list: add "source": [] and run \`bun run config-sync\`, or syncpack reads only the packages it guesses`
          })
        ]
      })
    }
    const found = A.map(stringsIn(block.value)(config.value.text), (entry) => entry.value)
    if (A.join(found, "\n") === A.join(expected, "\n")) return agreed
    return blockDrift(config.value, block.value, {
      what: "`source`, from the `workspaces` of package.json",
      found: listed(found),
      expected: listed(expected),
      text: renderArray(block.value)(A.map(expected, quoted))
    })
  })

  // coverage: every package fits a workspace pattern, and every pattern names a package.
  const scratchPackage = yield* readIfThere(repo.join(repo.root, scratchpadFolder, "package.json"))
  const folders = A.appendAll(A.map(workspaces, folderOf), O.isSome(scratchPackage) ? [scratchpadFolder] : [])
  const coverage = Plan.make({
    checked: folders.length + patterns.length,
    drifts: [],
    problems: A.appendAll(
      A.map(
        A.filter(folders, (folder) => !A.some(patterns, (pattern) => fits(pattern)(folder))),
        (folder) =>
          Problem.make({
            file: `${folder}/package.json`,
            message: `is a package no \`workspaces\` pattern of the root's package.json covers: bun does not install it, and \`deps:lint\` and \`deps:update\` do not read it. Add a pattern for it`
          })
      ),
      A.map(
        A.filter(patterns, (pattern) => !A.some(folders, fits(pattern))),
        (pattern) =>
          Problem.make({
            file: "package.json",
            message: `the \`workspaces\` pattern "${pattern}" names no package: remove it, or the package it was written for has moved`
          })
      )
    )
  })

  // paths: a `$schema`, an `extends` and a path in a script name a file that exists.
  const repairedPath = Effect.fn("ConfigSync.repairedPath")(function* (at: Text, found: Found, what: string) {
    if (!isLocalPath(found.value) && !Str.startsWith("../")(found.value)) return nothing
    const dir = repo.dirname(at.absolute)
    if (yield* repo.exists(repo.resolve(dir, found.value))) return agreed
    const fromRoot = repo.join(repo.root, anchorless(found.value))
    // Only a path that climbs (`../`) or names an installed file can have the wrong depth; `./x` names the folder
    // the file is in, so when nothing is there, the file was moved or renamed, and the root's file of that name is
    // another file.
    const climbs = Str.startsWith("../")(found.value) || Str.startsWith("node_modules/")(found.value)
    if (!climbs || !(yield* repo.exists(fromRoot))) {
      return one({
        problems: [
          Problem.make({
            file: at.file,
            message: climbs
              ? `line ${lineAt(at.text)(found.start)}: ${what} names ${found.value}, which does not exist here or from the repository's root (run \`bun install\` if it is an installed package's file)`
              : `line ${lineAt(at.text)(found.start)}: ${what} names ${found.value}, which is not beside it: write the file's new name`
          })
        ]
      })
    }
    const expected = fromHere(dir, fromRoot)
    return one({
      drifts: [
        drift(at, found, { what: `${what}, from the folder's depth`, found: found.value, expected, text: expected })
      ]
    })
  })
  const configPaths = Effect.fn("ConfigSync.configPaths")(function* (dir: string) {
    const entries = yield* repo.entries(dir)
    const configs = A.filter(
      entries,
      (entry) =>
        !entry.directory &&
        entry.name !== "package.json" &&
        (Str.endsWith(".json")(entry.name) || Str.endsWith(".jsonc")(entry.name))
    )
    const plans = yield* Effect.forEach(
      configs,
      Effect.fnUntraced(function* (entry) {
        const at = yield* read(entry.path)
        const schema = yield* Effect.forEach(
          stringValues("$schema")(at.text),
          (found) => repairedPath(at, found, "`$schema`"),
          { concurrency: 1 }
        )
        const single = stringValues("extends")(at.text)
        const several = O.match(arrayOf("extends")(at.text), {
          onNone: () => A.empty<Found>(),
          onSome: (block) => stringsIn(block)(at.text)
        })
        const parents = yield* Effect.forEach(
          A.appendAll(single, several),
          (found) => repairedPath(at, found, "`extends`"),
          { concurrency: 1 }
        )
        return mergePlans(A.appendAll(schema, parents))
      }),
      { concurrency: 1 }
    )
    return mergePlans(plans)
  })
  const scriptPaths = Effect.fn("ConfigSync.scriptPaths")(function* (workspace: Workspace) {
    const at = yield* read(repo.join(workspace.dir, "package.json"))
    const block = objectOf("scripts")(at.text)
    if (O.isNone(block)) return nothing
    const plans = yield* Effect.forEach(
      A.flatMap(stringsIn(block.value)(at.text), (script) =>
        A.map(A.fromIterable(Str.matchAll(/(?<![\w./-])(?:\.\.\/)+[\w.@/-]+/g)(script.value)), (match): Found => ({
          value: match[0],
          start: script.start + (match.index ?? 0),
          end: script.start + (match.index ?? 0) + match[0].length
        }))
      ),
      (found) => repairedPath(at, found, "a script's path"),
      { concurrency: 1 }
    )
    return mergePlans(plans)
  })
  const dirs = A.prepend(
    A.map(workspaces, (workspace) => workspace.dir),
    repo.root
  )
  const withScratchpad = A.appendAll(dirs, O.isSome(scratchPackage) ? [repo.join(repo.root, scratchpadFolder)] : [])
  const inConfigs = yield* Effect.forEach(withScratchpad, configPaths, { concurrency: 1 })
  const inScripts = yield* Effect.forEach(workspaces, scriptPaths, { concurrency: 1 })
  const paths = mergePlans(A.appendAll(inConfigs, inScripts))

  // references: what each solution file and each project with references names.
  const tsconfigOf = Effect.fn("ConfigSync.tsconfigOf")(function* (absolute: string) {
    const at = yield* readIfThere(absolute)
    if (O.isNone(at)) return O.none<{ readonly at: Text; readonly config: TsconfigFile }>()
    const config = yield* decodeJsonc(TsconfigFile)(at.value.file, at.value.text)
    return O.some({ at: at.value, config })
  })
  const isSolution = (config: TsconfigFile) =>
    config.references !== undefined && config.files !== undefined && config.files.length === 0
  const projectsOf = Effect.fn("ConfigSync.projectsOf")(function* (dir: string) {
    const entries = yield* repo.entries(dir)
    return A.sort(
      A.filter(
        A.map(
          A.filter(entries, (entry) => !entry.directory),
          (entry) => entry.name
        ),
        (name) => projectName.test(name) && name !== base
      ),
      Order.String
    )
  })
  const solutionOf = Effect.fn("ConfigSync.solutionOf")(function* (dir: string) {
    const main = yield* tsconfigOf(repo.join(dir, "tsconfig.json"))
    return O.filter(main, (found) => isSolution(found.config))
  })
  const referencesDrift = Effect.fn("ConfigSync.referencesDrift")(function* (
    dir: string,
    at: Text,
    config: TsconfigFile,
    wanted: ReadonlyArray<string>,
    keepOthers: boolean,
    what: string
  ) {
    const block = arrayOf("references")(at.text)
    if (O.isNone(block)) return nothing
    const written = A.map(config.references ?? [], (reference) => reference.path)
    const resolving = yield* Effect.filter(written, (path) => repo.exists(repo.resolve(dir, path)), { concurrency: 1 })
    const target = (path: string) => repo.resolve(dir, path)
    const kept = keepOthers
      ? resolving
      : A.filter(resolving, (path) => A.some(wanted, (want) => target(want) === target(path)))
    const expected = A.appendAll(
      kept,
      A.filter(wanted, (want) => !A.some(kept, (path) => target(path) === target(want)))
    )
    if (A.join(written, "\n") === A.join(expected, "\n")) return agreed
    return blockDrift(at, block.value, {
      what,
      found: listed(written),
      expected: listed(expected),
      text: renderArray(block.value)(A.map(expected, (path) => `{ "path": ${quoted(path)} }`))
    })
  })
  const solutions = yield* Effect.forEach(
    dirs,
    Effect.fnUntraced(function* (dir) {
      const solution = yield* solutionOf(dir)
      if (O.isNone(solution)) return nothing
      const own = yield* projectsOf(dir)
      const beside = A.map(own, (name) => `./${name}`)
      const perPackage = yield* Effect.forEach(
        dir === repo.root ? workspaces : A.empty<Workspace>(),
        Effect.fnUntraced(function* (workspace) {
          const theirs = yield* solutionOf(workspace.dir)
          if (O.isSome(theirs)) return A.empty<string>()
          const names = yield* projectsOf(workspace.dir)
          return A.map(names, (name) => `./${folderOf(workspace)}/${name}`)
        }),
        { concurrency: 1 }
      )
      const below = A.flatten(perPackage)
      return yield* referencesDrift(
        dir,
        solution.value.at,
        solution.value.config,
        A.appendAll(beside, below),
        true,
        dir === repo.root
          ? "`references`, from the projects beside it and each package's projects other than its tsconfig.json"
          : "`references`, from the projects beside it"
      )
    }),
    { concurrency: 1 }
  )

  // scripts: a package has the scripts turbo runs for what it holds.
  const scripts = yield* Effect.forEach(
    workspaces,
    Effect.fnUntraced(function* (workspace) {
      const at = yield* read(repo.join(workspace.dir, "package.json"))
      const manifest = yield* decodeJsonc(PackageFile)(at.file, at.text)
      const has = (name: string) => repo.exists(repo.join(workspace.dir, name))
      const solution = yield* solutionOf(workspace.dir)
      const hasMain = yield* has("tsconfig.json")
      const others = yield* projectsOf(workspace.dir)
      const typeChecks = O.isSome(solution)
        ? ["tsrs -b"]
        : A.map(A.appendAll(hasMain ? ["tsconfig.json"] : [], others), (name) => `tsrs -p ${name}`)
      const hasCeiling = yield* has("strict-ceiling.json")
      const steps = A.appendAll(typeChecks, hasCeiling ? ["beep-cli quality strict strict-ceiling.json"] : [])
      const hasLintConfig = yield* has(".oxlintrc.json")
      const isVendored = yield* has("vendor.json")
      const linted = hasLintConfig || !isVendored
      const tested = yield* has("vitest.config.ts")
      const lintFolders = yield* Effect.filter(["src", "test"], has, { concurrency: 1 })
      const wantedScripts: ReadonlyArray<readonly [string, string]> = A.flatten([
        steps.length === 0 ? [] : [["check", A.join(steps, " && ")] as const],
        linted ? [["lint", `oxlint --quiet ${A.join(lintFolders, " ")}`] as const] : [],
        tested ? [["test", "vitest run"] as const] : []
      ])
      const own = manifest.scripts ?? {}
      const missing = A.filter(wantedScripts, ([name]) => !R.has(own, name))
      const block = objectOf("scripts")(at.text)
      if (O.isNone(block)) {
        return Plan.make({
          checked: wantedScripts.length,
          drifts: [],
          problems:
            missing.length === 0
              ? []
              : [
                  Problem.make({
                    file: at.file,
                    message: `has no "scripts", and turbo runs ${listed(A.map(missing, ([name]) => name))} in a package like it: add "scripts": {} and run \`bun run config-sync\``
                  })
                ]
        })
      }
      const empty = R.keys(own).length === 0
      const added = A.map(missing, ([name, command]) => `${block.value.indent}  ${quoted(name)}: ${quoted(command)}`)
      const adding =
        missing.length === 0
          ? A.empty<Drift>()
          : A.of(
              drift(
                at,
                { start: block.value.start + 1, end: block.value.start + 1 },
                {
                  what: "`scripts`, from what the package holds",
                  found: `no ${listed(A.map(missing, ([name]) => name))}`,
                  expected: listed(A.map(missing, ([name, command]) => `${name}: ${command}`)),
                  text: empty ? `\n${A.join(added, ",\n")}\n${block.value.indent}` : `\n${A.join(added, ",\n")},`
                }
              )
            )
      const written = A.findFirst(stringValues("check")(at.text), inside(block.value))
      const absent = O.match(written, {
        onNone: () => A.empty<string>(),
        onSome: (check) => A.filter(steps, (step) => !Str.includes(step)(check.value))
      })
      const completing = O.match(written, {
        onNone: () => A.empty<Drift>(),
        onSome: (check) =>
          absent.length === 0
            ? A.empty<Drift>()
            : A.of(
                drift(
                  at,
                  { start: check.end, end: check.end },
                  {
                    what: "the `check` script, from the package's projects and ceiling file",
                    found: `without ${listed(absent)}`,
                    expected: `with ${listed(absent)}`,
                    text: A.join(
                      A.map(absent, (step) => ` && ${step}`),
                      ""
                    )
                  }
                )
              )
      })
      return Plan.make({
        checked: wantedScripts.length + steps.length,
        drifts: A.appendAll(adding, completing),
        problems: []
      })
    }),
    { concurrency: 1 }
  )

  // tasks: every root task of turbo.json has a root script and is run by the two checks.
  const tasksPlan = Effect.fn("ConfigSync.tasks")(function* () {
    const turbo = yield* readIfThere(repo.join(repo.root, "turbo.json"))
    if (O.isNone(turbo)) return nothing
    const config = yield* decodeJsonc(TurboFile)(turbo.value.file, turbo.value.text)
    const rootTasks = A.flatMap(R.keys(config.tasks), (name) =>
      Str.startsWith("//#")(name) ? [Str.slice(3)(name)] : []
    )
    const own = rootManifest.scripts ?? {}
    const unscripted = A.map(
      A.filter(rootTasks, (name) => !R.has(own, name)),
      (name) =>
        Problem.make({
          file: "turbo.json",
          message: `defines the root task //#${name} and the root's package.json has no script "${name}": add the script, or remove the task`
        })
    )
    const block = objectOf("scripts")(rootPackage.text)
    const runners = A.flatMap(["check", "check:full"], (script) =>
      O.toArray(
        O.flatMap(block, (scriptsBlock) =>
          O.map(A.findFirst(stringValues(script)(rootPackage.text), inside(scriptsBlock)), (found) => ({
            script,
            found
          }))
        )
      )
    )
    const drifts = A.flatMap(
      A.filter(runners, (runner) => Str.startsWith("turbo run ")(runner.found.value)),
      ({ script, found }) => {
        const words = A.filter(Str.split(" ")(found.value), (word) => word !== "")
        const named = A.flatMap(words, (word) => (Str.startsWith("//#")(word) ? [Str.slice(3)(word)] : []))
        const missing = A.filter(rootTasks, (name) => !A.contains(named, name))
        const stale = A.filter(named, (name) => !A.contains(rootTasks, name))
        if (missing.length === 0 && stale.length === 0) return A.empty<Drift>()
        const expected = A.join(
          A.appendAll(
            A.filter(
              words,
              (word) =>
                !A.contains(
                  A.map(stale, (name) => `//#${name}`),
                  word
                )
            ),
            A.map(missing, (name) => `//#${name}`)
          ),
          " "
        )
        return A.of(
          drift(rootPackage, found, {
            what: `the \`${script}\` script, from the root tasks of turbo.json`,
            found: A.join(
              A.appendAll(
                missing.length === 0 ? [] : [`without ${listed(A.map(missing, (name) => `//#${name}`))}`],
                stale.length === 0 ? [] : [`with ${listed(A.map(stale, (name) => `//#${name}`))}, which is no task`]
              ),
              ", "
            ),
            expected: "every root task turbo.json defines, and no other",
            text: expected
          })
        )
      }
    )
    return Plan.make({ checked: rootTasks.length * (1 + runners.length), drifts, problems: unscripted })
  })

  // vendored: the formatter leaves every vendored package alone.
  const vendoredPlan = Effect.fn("ConfigSync.vendored")(function* () {
    const config = yield* readIfThere(repo.join(repo.root, ".oxfmtrc.json"))
    if (O.isNone(config)) return nothing
    const kit = yield* Effect.filter(workspaces, (workspace) => repo.exists(repo.join(workspace.dir, "vendor.json")), {
      concurrency: 1
    })
    const wanted = A.map(kit, (workspace) => `${folderOf(workspace)}/**`)
    const block = arrayOf("ignorePatterns")(config.value.text)
    const written = O.match(block, {
      onNone: () => A.empty<string>(),
      onSome: (found) => A.map(stringsIn(found)(config.value.text), (entry) => entry.value)
    })
    const missing = A.filter(wanted, (pattern) => !A.contains(written, pattern))
    // A package that stops being vendored is the repository's own code again, so the formatter reads it again.
    const ownCode = A.map(
      A.filter(workspaces, (workspace) => !A.contains(wanted, `${folderOf(workspace)}/**`)),
      (workspace) => `${folderOf(workspace)}/**`
    )
    const stale = A.filter(written, (pattern) => A.contains(ownCode, pattern))
    if (missing.length === 0 && stale.length === 0) {
      return Plan.make({ checked: wanted.length, drifts: [], problems: [] })
    }
    return O.match(block, {
      onNone: () =>
        Plan.make({
          checked: wanted.length,
          drifts: [],
          problems: [
            Problem.make({
              file: config.value.file,
              message: `has no "ignorePatterns" list, and the vendored packages must not be reformatted: add ${listed(A.map(missing, quoted))}`
            })
          ]
        }),
      onSome: (found) =>
        blockDrift(config.value, found, {
          what: "`ignorePatterns`, from the packages with a vendor.json",
          found: A.join(
            A.appendAll(
              missing.length === 0 ? [] : [`without ${listed(missing)}`],
              stale.length === 0 ? [] : [`with ${listed(stale)}, which is no vendored package`]
            ),
            ", "
          ),
          expected: "every vendored package, and no package of the repository's own",
          text: renderArray(found)(
            A.map(
              A.appendAll(
                A.filter(written, (pattern) => !A.contains(stale, pattern)),
                missing
              ),
              quoted
            )
          )
        })
    })
  })

  // scratchpad: it depends on every package, so an experiment can import any of them.
  const scratch = O.match(scratchPackage, {
    onNone: () => nothing,
    onSome: (at) => {
      const wanted = A.map(
        A.filter(workspaces, (workspace) => Str.startsWith("packages/")(folderOf(workspace))),
        (workspace) => String(workspace.manifest.name)
      )
      const block = objectOf("dependencies")(at.text)
      if (O.isNone(block)) {
        return one({
          problems: [
            Problem.make({
              file: at.file,
              message: `has no "dependencies", and the scratchpad depends on every package: add "dependencies": {} and run \`bun run config-sync\``
            })
          ]
        })
      }
      const written = A.map(entriesOf(block.value)(at.text), ([key, value]) => [key.value, value.value] as const)
      const linked = A.map(
        A.filter(written, ([, spec]) => Str.startsWith("workspace:")(spec)),
        ([name]) => name
      )
      // Stale is a name no workspace has: one an experiment linked on purpose (the app) stays, as written.
      const everyWorkspace = A.map(workspaces, (workspace) => String(workspace.manifest.name))
      const missing = A.filter(wanted, (name) => !A.contains(linked, name))
      const stale = A.filter(linked, (name) => !A.contains(everyWorkspace, name))
      const byName = Order.mapInput(Order.String, (entry: readonly [string, string]) => entry[0])
      const expected = A.sort(
        A.appendAll(
          A.filter(written, ([name]) => !A.contains(stale, name)),
          A.map(missing, (name) => [name, "workspace:*"] as const)
        ),
        byName
      )
      if (missing.length === 0 && stale.length === 0)
        return Plan.make({ checked: wanted.length, drifts: [], problems: [] })
      return blockDrift(at, block.value, {
        what: "the scratchpad's `dependencies`, from the packages under packages/",
        found: A.join(
          A.appendAll(
            missing.length === 0 ? [] : [`without ${listed(missing)}`],
            stale.length === 0 ? [] : [`with ${listed(stale)}, which is no workspace`]
          ),
          ", "
        ),
        expected: "every package under packages/, as workspace:*",
        text: renderObject(block.value.indent)(expected)
      })
    }
  })

  const sources = yield* sourcesPlan()
  const tasks = yield* tasksPlan()
  const vendored = yield* vendoredPlan()
  return mergePlans(
    A.flatten<ReadonlyArray<ReadonlyArray<Plan>>>([
      [sources, coverage, paths],
      solutions,
      scripts,
      [tasks, vendored, scratch]
    ])
  )
})

/**
 * `config-sync`: plans, then names, writes or lists what differs, as the mode asks.
 *
 * @category rules
 */
export const configSync = Effect.fn("ConfigSync.configSync")(function* (
  mode: Mode,
  install: Effect.Effect<{ readonly code: number; readonly output: string }, RepoError, Repo>
) {
  const plan = yield* configSyncPlan()
  const said = yield* settle({ command: "config-sync", repair: "bun run config-sync", mode }, plan)
  // A package.json it wrote (the scratchpad's dependencies, a package's scripts) changes what bun.lock must say, so
  // the lockfile is brought along at once, as `deps:update` does: committed without it, the change can make CI's
  // frozen install refuse the lockfile.
  const manifests = A.some(plan.drifts, (drift) => Str.endsWith("package.json")(drift.file))
  if (mode !== "write" || !manifests) return said
  const installed = yield* install
  return A.append<SyncFinding, SyncFinding>(
    said,
    installed.code === 0
      ? SyncFinding.cases.Installed.make({ command: "config-sync" })
      : SyncFinding.cases.InstallFailed.make({
          command: "config-sync",
          output: A.join(A.takeRight(Str.split("\n")(installed.output), 12), "\n")
        })
  )
})
