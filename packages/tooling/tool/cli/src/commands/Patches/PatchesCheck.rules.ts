/**
 * `patches check`: every patch to a dependency is one the repository can stand behind (docs/patches.md).
 *
 * - **It says what it is.** Each patch has its header, every field filled, and the test its header names exists.
 * - **It is for what is installed.** `bun.lock` holds the resolution the header names. bun only warns about a patch
 *   whose package has moved on, and installs the package unpatched.
 * - **It applies.** For a package kept as a file, each patch is applied to the unpacked file, in order, with no
 *   install. For a package from a registry, `bun install` is what refuses a patch that does not apply.
 * - **bun reads it.** The file bun is given is the package's patches one after another, and the root's
 *   `patchedDependencies` names that file for that resolution, and nothing else.
 * - **It is installed.** What is in `node_modules` holds every change the patches make.
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
import { notYetReported, PatchedManifest, patchesFolder } from "./Patches.schema.ts"
import {
  applyEach,
  builtText,
  gitApply,
  headerOf,
  inTempFolder,
  installedAt,
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
  Failed: { problems: S.Int.pipe(S.annotateKey({ description: "How many problems were found" })) }
}).pipe($I.annoteSchema("PatchesCheckFinding", { description: "Every patch in order, or each way one is not" }))

/**
 * The decoded value of `PatchesCheckFinding`.
 *
 * @category models
 */
export type PatchesCheckFinding = typeof PatchesCheckFinding.Type

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
  Failed: ({ problems }) => err(`patches:check failed: ${plural(problems, "problem", "problems")}`)
})

const named = /^\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*\.patch$/
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
        header.upstream === notYetReported || Str.startsWith("https://")(header.upstream)
          ? none
          : one(cases.UpstreamUnclear.make({ patch: file.file, upstream: header.upstream }))
    }),
    O.match(test, {
      onNone: () => none,
      onSome: (path) => (testThere ? none : one(cases.NoTest.make({ patch: file.file, test: path })))
    })
  ])
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
    const installed = repo.join(repo.root, installedAt(header.package))
    const inPlace =
      (yield* repo.exists(installed)) && (yield* gitApply(installed, ["--check", "--reverse"], builtFile)).code === 0
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
  const problems = A.flatten([A.flatten(perSet), strays, unexpected])
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
