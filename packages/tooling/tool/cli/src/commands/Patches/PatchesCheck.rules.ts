/**
 * `patches check`: every patch to a dependency is one the repository can stand behind (docs/patches.md).
 *
 * - **It says what it is.** Each patch has its header, every field filled, and the test its header names exists and
 *   is no other patch's.
 * - **It is for what is installed.** `bun.lock` holds the resolution the header names. bun only warns about a patch
 *   whose package has moved on, and installs the package unpatched.
 * - **It applies.** For a package kept as a file, each patch is applied to the unpacked file, in order, with no
 *   install. For a package from a registry, `bun install` is what refuses a patch that does not apply.
 * - **bun reads it.** The file bun is given is the package's patches one after another, and the root's
 *   `patchedDependencies` names that file for that resolution, and nothing else.
 * - **It is installed.** What is in `node_modules` holds every change the patches make.
 * - **Nothing runs on an install that is behind.** Every task of the root's `turbo.json` that a package runs waits
 *   for `//#patches:installed`, itself or through a task it depends on, and so does a package's own task that states
 *   what it depends on. A task that does not could run on the package as it was and be replayed after the install.
 *
 * @packageDocumentation
 */
import { $RepoCliId } from "@beep/identity/packages"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import * as Str from "effect/String"
import { Repo } from "../../Repo.service.ts"
import { err, type Line, out } from "../../Report.schema.ts"
import { decodeJsonc } from "../../Sync.rules.ts"
import { notYetReported, PatchedManifest, patchesFolder } from "./Patches.schema.ts"
import {
  applyEach,
  builtText,
  headerOf,
  holdsPatches,
  inTempFolder,
  isKeptFile,
  type PatchFile,
  type PatchSet,
  readPatches,
  resolutionsOf,
  unpack
} from "./PatchesRead.rules.ts"

const $I = $RepoCliId.create("commands/Patches/PatchesCheck.rules")

const patch = S.String.pipe(S.annotateKey({ description: "The patch file, from the root" }))

/**
 * What `patches check` finds: every patch in order, or each way one is not.
 *
 * @category schemas
 */
export const PatchesCheckFinding = S.TaggedUnion({
  Held: {
    patches: S.Int.pipe(S.annotateKey({ description: "How many patches were checked" })),
    packages: S.Int.pipe(S.annotateKey({ description: "To how many packages" }))
  },
  BadName: { patch },
  NoHeader: { patch },
  MissingField: { patch, field: S.String.pipe(S.annotateKey({ description: "The field that is missing or empty" })) },
  NoDiff: { patch },
  UpstreamUnclear: {
    patch,
    upstream: S.String.pipe(S.annotateKey({ description: "What the header says under Upstream" }))
  },
  NoTest: { patch, test: S.String.pipe(S.annotateKey({ description: "The test the header names, from the root" })) },
  SharedTest: {
    patch,
    test: S.String.pipe(S.annotateKey({ description: "The test the header names, from the root" })),
    first: S.String.pipe(S.annotateKey({ description: "The patch that names the same test before it" }))
  },
  Mixed: { folder: S.String.pipe(S.annotateKey({ description: "The package's folder of patches, from the root" })) },
  BuiltDiffers: {
    built: S.String.pipe(S.annotateKey({ description: "The file bun reads, from the root" })),
    folder: S.String.pipe(S.annotateKey({ description: "The folder its patches are in, from the root" }))
  },
  NotRegistered: {
    key: S.String.pipe(S.annotateKey({ description: "`name@resolution`, as patchedDependencies must name it" })),
    built: S.String.pipe(S.annotateKey({ description: "The file bun reads, from the root" }))
  },
  Unexpected: {
    key: S.String.pipe(S.annotateKey({ description: "A key of patchedDependencies" })),
    path: S.String.pipe(S.annotateKey({ description: "The file it names" }))
  },
  StrayBuilt: { built: S.String.pipe(S.annotateKey({ description: "A patch file beside the folders" })) },
  NotInstalledVersion: {
    folder: S.String.pipe(S.annotateKey({ description: "The package's folder of patches, from the root" })),
    name: S.String.pipe(S.annotateKey({ description: "The package" })),
    appliesTo: S.String.pipe(S.annotateKey({ description: "The resolution its patches name" })),
    holds: S.Array(S.String).pipe(S.annotateKey({ description: "The resolutions bun.lock holds for it" }))
  },
  DoesNotApply: {
    patch,
    to: S.String.pipe(S.annotateKey({ description: "The kept file it was applied to" })),
    said: S.String.pipe(S.annotateKey({ description: "What git said" }))
  },
  NotInPlace: {
    name: S.String.pipe(S.annotateKey({ description: "The package" })),
    built: S.String.pipe(S.annotateKey({ description: "The file bun reads, from the root" }))
  },
  NotWaiting: {
    file: S.String.pipe(S.annotateKey({ description: "The turbo.json, from the root" })),
    task: S.String.pipe(S.annotateKey({ description: "The task that does not wait for the install to be read" }))
  },
  Failed: { problems: S.Int.pipe(S.annotateKey({ description: "How many problems were found" })) }
}).pipe($I.annoteSchema("PatchesCheckFinding", { description: "Every patch in order, or each way one is not" }))

/**
 * The decoded value of `PatchesCheckFinding`.
 *
 * @category models
 */
export type PatchesCheckFinding = typeof PatchesCheckFinding.Type

/**
 * The root task every run of code waits for: what is installed holds what the patches write (`patches installed`).
 *
 * @category models
 */
export const installedTask = "//#patches:installed"

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`

/**
 * The line each finding prints.
 *
 * @category rendering
 */
export const patchesCheckSentence: (finding: PatchesCheckFinding) => Line = PatchesCheckFinding.match({
  Held: ({ patches, packages }) =>
    out(
      patches === 0
        ? "patches:check OK  no dependency is patched"
        : `patches:check OK  ${plural(patches, "patch", "patches")} to ${plural(packages, "package", "packages")}: each has its header and its test, applies to what bun.lock holds, and is installed`
    ),
  BadName: ({ patch: file }) =>
    err(
      `${file}: a patch is named by two digits and a few words (01-what-it-fixes.patch): the digits order a package's patches`
    ),
  NoHeader: ({ patch: file }) =>
    err(
      `${file}: has no header. Above its first "diff --git" write Package, Applies-to, Upstream, Why, Remove-when and Test, a line each (docs/patches.md)`
    ),
  MissingField: ({ patch: file, field }) => err(`${file}: its header has no "${field}:" (docs/patches.md)`),
  NoDiff: ({ patch: file }) => err(`${file}: changes no file: it has no "diff --git" line`),
  UpstreamUnclear: ({ patch: file, upstream }) =>
    err(
      `${file}: Upstream is "${upstream}". Write the address of the issue or pull request (https://…), or "${notYetReported}"`
    ),
  NoTest: ({ patch: file, test }) =>
    err(`${file}: its header names the test ${test}, which is not there. A patch has a test that fails without it`),
  SharedTest: ({ patch: file, test, first }) =>
    err(
      `${file}: its header names the test ${test}, which is ${first}'s. A patch has a test of its own: what fails without one patch shows nothing about another`
    ),
  Mixed: ({ folder }) =>
    err(
      `${folder}: its patches name more than one package or resolution. A folder holds the patches of one package at one resolution`
    ),
  BuiltDiffers: ({ built, folder }) =>
    err(
      `${built}: is not the patches of ${folder} one after another, so bun applies something else. Run \`bun run beep patches build\`, then \`bun install\``
    ),
  NotRegistered: ({ key, built }) =>
    err(
      `package.json: patchedDependencies does not give "${key}" the file "${built}", so bun does not apply it. Add that line, then run \`bun install\``
    ),
  Unexpected: ({ key, path }) =>
    err(
      `package.json: patchedDependencies gives "${key}" the file "${path}", and no folder under ${patchesFolder} holds patches for that. Remove the line, or give the patch its folder and header`
    ),
  StrayBuilt: ({ built }) =>
    err(`${built}: no folder of that name holds its patches. Remove it, or move its diff into a folder as one patch`),
  NotInstalledVersion: ({ folder, name, appliesTo, holds }) =>
    err(
      `${folder}: its patches apply to ${name}@${appliesTo}, and bun.lock holds ${
        holds.length === 0 ? "no such package" : A.join(holds, ", ")
      }: a patch for a version that is no longer installed. Re-make each patch for what is installed, or drop it`
    ),
  DoesNotApply: ({ patch: file, to, said }) =>
    err(`${file}: no longer applies to ${to} (${said}). Re-make the patch, or drop it if the library fixed the defect`),
  NotInPlace: ({ name, built }) =>
    err(`node_modules/${name}: does not hold what ${built} writes, so the package runs unpatched. Run \`bun install\``),
  NotWaiting: ({ file, task }) =>
    err(
      `${file}: the task "${task}" does not wait for ${installedTask}, so it can run on an install that is behind the patches and be replayed after \`bun install\` as if it had run with them. Add "${installedTask}" to its dependsOn, or to a task it depends on`
    ),
  Failed: ({ problems }) => err(`patches:check failed: ${plural(problems, "problem", "problems")}`)
})

const named = /^\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*\.patch$/
// An address a person can open: a host, and a path on it. `https://` alone, or a host with nothing after it, names
// no issue and no pull request.
const address = /^https:\/\/[^\s/]+\.[^\s/]+\/\S+$/
const one = (finding: PatchesCheckFinding) => A.of(finding)
const none = A.empty<PatchesCheckFinding>()
const { cases } = PatchesCheckFinding

/** What a patch file says of itself: its name, its header and its test. */
const ofItself = Effect.fn("PatchesCheck.ofItself")(function* (file: PatchFile) {
  const repo = yield* Repo
  const test = O.map(file.read.header, (header) => `${patchesFolder}/${header.test}`)
  const testThere = yield* O.match(test, {
    onNone: () => Effect.succeed(true),
    onSome: (path) => repo.exists(repo.join(repo.root, path))
  })
  return A.flatten([
    named.test(file.name) ? none : one(cases.BadName.make({ patch: file.file })),
    file.read.hasHeader
      ? A.map(file.read.missing, (field) => cases.MissingField.make({ patch: file.file, field }))
      : one(cases.NoHeader.make({ patch: file.file })),
    file.read.touched.length === 0 ? one(cases.NoDiff.make({ patch: file.file })) : none,
    O.match(file.read.header, {
      onNone: () => none,
      onSome: (header) =>
        header.upstream === notYetReported || address.test(header.upstream)
          ? none
          : one(cases.UpstreamUnclear.make({ patch: file.file, upstream: header.upstream }))
    }),
    O.match(test, {
      onNone: () => none,
      onSome: (path) => (testThere ? none : one(cases.NoTest.make({ patch: file.file, test: path })))
    })
  ])
})

/** The parts of a `turbo.json` that say which task waits for which. */
class TurboTasks extends S.Class<TurboTasks, { readonly brand: unique symbol }>($I`TurboTasks`)(
  {
    tasks: S.Record(
      S.String,
      S.Struct({
        dependsOn: S.Array(S.String).pipe(
          S.optionalKey,
          S.annotateKey({ description: "The tasks this one waits for: `name`, `^name`, `package#name` or `//#name`" })
        )
      })
    ).pipe(S.optionalKey, S.annotateKey({ description: "The tasks, a root task as //#name" }))
  },
  $I.annote("TurboTasks", { description: "Which task of a turbo.json waits for which" })
) {}

/**
 * Whether a task waits for the install to be read: it names the root task, or a task it waits for does. A task is
 * looked up in the root's `turbo.json` by the name it is waited for under, without the `^` of "in the packages
 * this one depends on".
 *
 * @example
 * waits({ transit: ["^transit", "//#patches:installed"], test: ["transit"], prove: [] })(["transit"]) // true
 *
 * @category rules
 */
export const waits =
  (root: Readonly<Record<string, ReadonlyArray<string>>>) =>
  (dependsOn: ReadonlyArray<string>): boolean => {
    const reach = (names: ReadonlyArray<string>, seen: ReadonlyArray<string>): boolean =>
      A.some(names, (written) => {
        const name = Str.replace(/^\^/, "")(written)
        if (name === installedTask) return true
        if (A.contains(seen, name)) return false
        return reach(
          O.getOrElse(R.get(root, name), () => A.empty<string>()),
          A.append(seen, name)
        )
      })
    return reach(dependsOn, A.empty())
  }

/**
 * Every task a package runs that does not wait for the install to be read: in the root's `turbo.json` each task
 * that is not a root task, and in a package's own `turbo.json` each task that states what it waits for, which
 * replaces what the root says for it. With no `turbo.json` at the root there is nothing to hold.
 */
const notWaiting = Effect.fn("PatchesCheck.notWaiting")(function* () {
  const repo = yield* Repo
  const rootFile = repo.join(repo.root, "turbo.json")
  if (!(yield* repo.exists(rootFile))) return none
  const read = Effect.fnUntraced(function* (absolute: string) {
    const text = yield* repo.text(absolute)
    const config = yield* decodeJsonc(TurboTasks)(repo.relative(absolute, repo.root), text)
    return R.map(config.tasks ?? {}, (task) => task.dependsOn ?? A.empty<string>())
  })
  const root = yield* read(rootFile)
  const reaches = waits(root)
  const ofRoot = A.flatMap(R.toEntries(root), ([task, dependsOn]) =>
    Str.startsWith("//#")(task) || reaches(dependsOn) ? none : one(cases.NotWaiting.make({ file: "turbo.json", task }))
  )
  const workspaces = yield* repo.workspaces
  const perPackage = yield* Effect.forEach(
    workspaces,
    Effect.fnUntraced(function* (workspace) {
      const absolute = repo.join(workspace.dir, "turbo.json")
      if (!(yield* repo.exists(absolute))) return none
      const text = yield* repo.text(absolute)
      const file = repo.relative(absolute, repo.root)
      const config = yield* decodeJsonc(TurboTasks)(file, text)
      return A.flatMap(R.toEntries(config.tasks ?? {}), ([task, stated]) =>
        stated.dependsOn === undefined || reaches(stated.dependsOn) ? none : one(cases.NotWaiting.make({ file, task }))
      )
    }),
    { concurrency: 1 }
  )
  return A.appendAll(ofRoot, A.flatten(perPackage))
})

/**
 * Checks every patch under the patches workspace against the root's `package.json`, `bun.lock`, the kept files and
 * what is installed.
 *
 * @category rules
 */
export const patchesCheck = Effect.fn("PatchesCheck.patchesCheck")(function* () {
  const repo = yield* Repo
  const { sets, builtFiles } = yield* readPatches()
  const manifest = yield* repo.json(PatchedManifest)(repo.join(repo.root, "package.json"))
  const registered = R.toEntries(manifest.patchedDependencies ?? {})
  const lockFile = repo.join(repo.root, "bun.lock")
  const lock = (yield* repo.exists(lockFile)) ? yield* repo.text(lockFile) : ""

  const checkSet = Effect.fnUntraced(function* (set: PatchSet) {
    const folder = `${patchesFolder}/${set.name}`
    const perPatch = yield* Effect.forEach(set.patches, ofItself, { concurrency: 1 })
    const themselves = A.flatten(perPatch)
    if (themselves.length > 0) return themselves
    const shared = headerOf(set)
    if (O.isNone(shared)) return one(cases.Mixed.make({ folder }))
    const header = shared.value
    const key = `${header.package}@${header.appliesTo}`
    const builtFile = repo.join(repo.root, set.built)
    const builtNow = (yield* repo.exists(builtFile)) ? yield* repo.text(builtFile) : ""
    const holds = resolutionsOf(header.package)(lock)
    const wired = A.flatten([
      builtNow === builtText(set) ? none : one(cases.BuiltDiffers.make({ built: set.built, folder })),
      A.some(registered, ([name, path]) => name === key && path === set.built)
        ? none
        : one(cases.NotRegistered.make({ key, built: set.built })),
      A.contains(holds, header.appliesTo)
        ? none
        : one(cases.NotInstalledVersion.make({ folder, name: header.package, appliesTo: header.appliesTo, holds }))
    ])
    if (wired.length > 0) return wired
    const kept = isKeptFile(header.appliesTo) && (yield* repo.exists(repo.join(repo.root, header.appliesTo)))
    const refused = kept
      ? yield* inTempFolder(
          Effect.fnUntraced(function* (dir) {
            yield* unpack(header.appliesTo, dir)
            return yield* applyEach(set, dir)
          })
        )
      : O.none()
    if (O.isSome(refused)) {
      return one(
        cases.DoesNotApply.make({ patch: refused.value.patch.file, to: header.appliesTo, said: refused.value.said })
      )
    }
    const inPlace = yield* holdsPatches(header.package, set.built)
    return inPlace ? none : one(cases.NotInPlace.make({ name: header.package, built: set.built }))
  })
  const perSet = yield* Effect.forEach(sets, checkSet, { concurrency: 1 })

  const expected = A.map(sets, (set) => ({
    built: set.built,
    key: O.map(headerOf(set), (header) => `${header.package}@${header.appliesTo}`)
  }))
  const strays = A.map(
    A.filter(builtFiles, (built) => !A.some(sets, (set) => set.built === built)),
    (built) => cases.StrayBuilt.make({ built })
  )
  // A line whose file is a package's, under another key, is the old resolution's: bun warns and applies nothing.
  // A package whose patches do not say what they apply to has that said above, and its line is left alone.
  const unexpected = A.map(
    A.filter(
      registered,
      ([key, path]) => !A.some(expected, (set) => set.built === path && (O.isNone(set.key) || O.contains(set.key, key)))
    ),
    ([key, path]) => cases.Unexpected.make({ key, path })
  )
  // A test is one patch's: the first to name it keeps it, and each later one is told whose it is.
  const naming = A.flatMap(sets, (set) =>
    A.flatMap(set.patches, (file) =>
      O.toArray(O.map(file.read.header, (header) => ({ patch: file.file, test: `${patchesFolder}/${header.test}` })))
    )
  )
  const shared = A.flatMap(naming, (one, index) =>
    O.toArray(
      O.map(
        A.findFirst(A.take(naming, index), (earlier) => earlier.test === one.test),
        (earlier) => cases.SharedTest.make({ patch: one.patch, test: one.test, first: earlier.patch })
      )
    )
  )
  const waiting = yield* notWaiting()
  const problems = A.flatten([A.flatten(perSet), shared, strays, unexpected, waiting])
  if (A.isReadonlyArrayNonEmpty(problems)) {
    return A.append<PatchesCheckFinding, PatchesCheckFinding>(
      problems,
      cases.Failed.make({ problems: problems.length })
    )
  }
  return one(
    cases.Held.make({
      patches: A.reduce(sets, 0, (sum, set) => sum + set.patches.length),
      packages: sets.length
    })
  )
})
