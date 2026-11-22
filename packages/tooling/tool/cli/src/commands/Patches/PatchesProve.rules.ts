/**
 * `patches prove`: each patch's test fails without that patch (docs/patches.md).
 *
 * The test passes on what is installed: that is the patches workspace's own `test`. Here the same test is run from
 * a copy that holds the package with **that one patch left out and every other patch of the package applied**,
 * where node resolves that copy first, and it has to fail there with a failed test, not with a file that does not
 * load. Leaving out all of a package's patches at once would show nothing about any one of them: a patch could
 * name another's test, or its test could rest on an earlier patch, and read as needed for ever.
 *
 * A later patch that changes the same lines does not apply without the one it was written on. It is then left out
 * too, and the test is run a second time with only that later patch out, where it has to pass: so the failure is
 * this patch's and not the later one's.
 *
 * A test that passes without its patch says the library fixed the defect, or that the test never tested the patch:
 * either way the patch is no longer shown to be needed.
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
import { err, type Line, out } from "../../Report.schema.ts"
import { patchesFolder, TestRun } from "./Patches.schema.ts"
import {
  firstLine,
  gitApply,
  headerOf,
  installedAt,
  isKeptFile,
  type PatchFile,
  type PatchSet,
  readPatches,
  unpack
} from "./PatchesRead.rules.ts"

const $I = $RepoCliId.create("commands/Patches/PatchesProve.rules")

const patch = S.String.pipe(S.annotateKey({ description: "The patch file, from the root" }))
const test = S.String.pipe(S.annotateKey({ description: "Its test, from the root" }))
const onTop = S.Array(S.String).pipe(
  S.annotateKey({ description: "The later patches that do not apply without this one, by file name" })
)

/**
 * What `patches prove` finds for each patch: its test fails without it, passes without it, fails for a later
 * patch's sake, or did not run.
 *
 * @category schemas
 */
export const PatchesProveFinding = S.TaggedUnion({
  Proved: {
    patch,
    failed: S.Int.pipe(S.annotateKey({ description: "How many of its tests failed without the patch" })),
    onTop
  },
  Held: { patches: S.Int.pipe(S.annotateKey({ description: "How many patches were proved needed" })) },
  PassesWithout: { patch, test },
  NotItsOwn: { patch, test, onTop },
  DidNotRun: { patch, test, said: S.String.pipe(S.annotateKey({ description: "What the run said" })) },
  Unread: { folder: S.String.pipe(S.annotateKey({ description: "The package's folder of patches, from the root" })) },
  Failed: { problems: S.Int.pipe(S.annotateKey({ description: "How many patches are not proved needed" })) }
}).pipe($I.annoteSchema("PatchesProveFinding", { description: "A patch's test, run without the patch" }))

/**
 * The decoded value of `PatchesProveFinding`.
 *
 * @category models
 */
export type PatchesProveFinding = typeof PatchesProveFinding.Type

const listed = (names: ReadonlyArray<string>) => A.join(names, ", ")

/**
 * The line each finding prints.
 *
 * @category rendering
 */
export const patchesProveSentence: (finding: PatchesProveFinding) => Line = PatchesProveFinding.match({
  Proved: ({ patch: file, failed, onTop: later }) =>
    out(
      `  needed  ${file}: with it left out and the others applied, ${failed} of its tests fail${failed === 1 ? "s" : ""}${
        later.length === 0
          ? ""
          : ` (${listed(later)} does not apply without it and was left out too; with only that out, the test passes)`
      }`
    ),
  Held: ({ patches }) =>
    out(
      patches === 0
        ? "patches:prove OK  no dependency is patched"
        : `patches:prove OK  ${patches} patch${patches === 1 ? "" : "es"}: each one's test fails with that patch alone left out`
    ),
  PassesWithout: ({ patch: file, test: path }) =>
    err(
      `${file}: its test ${path} passes with this patch left out and the others applied. If the library fixed the defect, drop the patch (docs/patches.md, "Dropping a patch"); if not, the test does not test this patch`
    ),
  NotItsOwn: ({ patch: file, test: path, onTop: later }) =>
    err(
      `${file}: its test ${path} fails with this patch applied once ${listed(later)} is left out, so the test is of that later patch and shows nothing about this one. Give this patch a test of what it alone fixes`
    ),
  DidNotRun: ({ patch: file, test: path, said }) =>
    err(`${file}: its test ${path} did not run without the patch, so nothing is shown: ${said}`),
  Unread: ({ folder }) =>
    err(`${folder}: its patches cannot be read as one package's: run \`bun run beep patches check\``),
  Failed: ({ problems }) =>
    err(`patches:prove failed: ${problems} patch${problems === 1 ? "" : "es"} not shown to be needed`)
})

const { cases } = PatchesProveFinding

/** Where the copies are made, from the root: git ignores it, and it is removed when the proof ends. */
export const proofFolder = ".scratch/patch-proof"

/**
 * Puts a package without any of its patches into a folder: the kept file unpacked, or, for a package from a registry,
 * what is installed with its patches taken out again. The second gives `some` of what git said when what is installed
 * does not hold the patches.
 *
 * @category rules
 */
export const withoutPatches = Effect.fn("PatchesProve.withoutPatches")(function* (
  set: PatchSet,
  name: string,
  appliesTo: string,
  into: string
) {
  const repo = yield* Repo
  const installed = repo.join(repo.root, installedAt(name))
  if (isKeptFile(appliesTo) && (yield* repo.exists(repo.join(repo.root, appliesTo)))) {
    yield* unpack(appliesTo, into)
    // What the package itself installs beside it is not in the kept file: the copy reads the installed ones.
    const nested = repo.join(installed, "node_modules")
    if (yield* repo.exists(nested)) yield* repo.run("ln", ["-s", nested, repo.join(into, "node_modules")])
    return O.none<string>()
  }
  yield* repo.run("mkdir", ["-p", repo.dirname(into)])
  const copied = yield* repo.run("cp", ["-R", installed, into])
  if (copied.code !== 0) return O.some(firstLine(copied.stderr))
  const taken = yield* gitApply(into, ["--reverse"], repo.join(repo.root, set.built))
  return taken.code === 0 ? O.none<string>() : O.some(firstLine(taken.stderr))
})

/** A package put into a folder with some of its patches left out. */
export interface Without {
  /** What stopped the package without any patch from being made, when something did. */
  readonly said: O.Option<string>
  /** The patches that were to be applied and did not apply: each was written on top of one that was left out. */
  readonly refused: ReadonlyArray<PatchFile>
}

/**
 * Puts a package into a folder with every patch of it applied, in order, but the ones named: the package as it would
 * be had those patches never been made. A patch that does not apply there is left out too, and named.
 *
 * @category rules
 */
export const withoutSome = Effect.fn("PatchesProve.withoutSome")(function* (
  set: PatchSet,
  name: string,
  appliesTo: string,
  out: ReadonlyArray<string>,
  into: string
) {
  const said = yield* withoutPatches(set, name, appliesTo, into)
  if (O.isSome(said)) return { said, refused: A.empty<PatchFile>() } satisfies Without
  const refused = yield* Effect.reduce(
    set.patches,
    () => A.empty<PatchFile>(),
    (refused, file) =>
      A.contains(out, file.name)
        ? Effect.succeed(refused)
        : Effect.map(gitApply(into, [], file.absolute), (answer) =>
            answer.code === 0 ? refused : A.append(refused, file)
          )
  )
  return { said, refused } satisfies Without
})

/**
 * Runs every patch's test beside its package with that one patch left out, and says which patches that shows to be
 * needed.
 *
 * @category rules
 */
export const patchesProve = Effect.fn("PatchesProve.patchesProve")(function* () {
  const repo = yield* Repo
  const { sets } = yield* readPatches()
  const home = repo.join(repo.root, proofFolder)
  const vitest = repo.join(repo.root, "node_modules/vitest/vitest.mjs")

  /** Runs a test from a folder that holds its files and, under `node_modules`, the package it is to meet. */
  const runIn = Effect.fnUntraced(function* (copy: string, testFile: string) {
    const source = repo.dirname(testFile)
    const files = yield* repo.files(source)
    yield* Effect.forEach(
      A.filter(files, (path) => !Str.includes("/node_modules/")(path)),
      Effect.fnUntraced(function* (path) {
        const data = yield* repo.bytes(path)
        yield* repo.writeBytes(repo.join(copy, repo.relative(source, path)), data)
      }),
      { concurrency: 1, discard: true }
    )
    const result = repo.join(copy, ".result.json")
    const ran = yield* repo.run("node", [
      vitest,
      "run",
      "--root",
      copy,
      "--reporter=json",
      `--outputFile=${result}`,
      repo.relative(source, testFile)
    ])
    const said = firstLine(`${ran.stderr}\n${ran.stdout}`)
    if (!(yield* repo.exists(result))) return { counts: O.none<TestRun>(), said }
    const counts = yield* repo.json(TestRun)(result)
    return { counts: O.some(counts), said: counts.numTotalTests === 0 ? "the run found no test in it" : said }
  })

  const proveSet = Effect.fnUntraced(function* (set: PatchSet) {
    const shared = headerOf(set)
    if (O.isNone(shared))
      return A.of<PatchesProveFinding>(cases.Unread.make({ folder: `${patchesFolder}/${set.name}` }))
    const header = shared.value
    const root = repo.join(home, set.name)
    yield* repo.remove(root)

    const proveOne = Effect.fnUntraced(function* (file: PatchFile) {
      const named = O.getOrElse(
        O.map(file.read.header, (own) => own.test),
        () => header.test
      )
      const testFile = repo.join(repo.root, patchesFolder, named)
      const from = `${patchesFolder}/${named}`
      const notRun = (said: string) => cases.DidNotRun.make({ patch: file.file, test: from, said })
      const stem = Str.replace(/\.patch$/, "")(file.name)

      // Without this patch: every other one applied, but a later one written on top of it.
      const copy = repo.join(root, stem)
      const left = yield* withoutSome(
        set,
        header.package,
        header.appliesTo,
        [file.name],
        repo.join(copy, installedAt(header.package))
      )
      if (O.isSome(left.said)) return notRun(left.said.value)
      const without = yield* runIn(copy, testFile)
      if (O.isNone(without.counts)) return notRun(without.said)
      if (without.counts.value.numFailedTests === 0) {
        return without.counts.value.numPassedTests > 0
          ? cases.PassesWithout.make({ patch: file.file, test: from })
          : notRun(without.said)
      }
      const failed = without.counts.value.numFailedTests
      const later = A.map(left.refused, (other) => other.name)
      if (later.length === 0) return cases.Proved.make({ patch: file.file, failed, onTop: later })

      // With this patch and without the later ones: the test has to pass, or its failure above was theirs.
      const beside = repo.join(root, `${stem}.with`)
      const kept = yield* withoutSome(
        set,
        header.package,
        header.appliesTo,
        later,
        repo.join(beside, installedAt(header.package))
      )
      if (O.isSome(kept.said)) return notRun(kept.said.value)
      if (kept.refused.length > 0) {
        return notRun(
          `with ${listed(later)} left out, ${listed(A.map(kept.refused, (other) => other.name))} does not apply`
        )
      }
      const withIt = yield* runIn(beside, testFile)
      if (O.isNone(withIt.counts)) return notRun(withIt.said)
      if (withIt.counts.value.numFailedTests > 0) {
        return cases.NotItsOwn.make({ patch: file.file, test: from, onTop: later })
      }
      return withIt.counts.value.numPassedTests > 0
        ? cases.Proved.make({ patch: file.file, failed, onTop: later })
        : notRun(withIt.said)
    })
    return yield* Effect.forEach(set.patches, proveOne, { concurrency: 1 })
  })

  const perSet = yield* Effect.forEach(sets, proveSet, { concurrency: 1 }).pipe(
    Effect.ensuring(Effect.ignore(repo.remove(home)))
  )
  const found = A.flatten(perSet)
  const problems = A.filter(found, (finding) => !PatchesProveFinding.guards.Proved(finding))
  return A.append<PatchesProveFinding, PatchesProveFinding>(
    found,
    problems.length > 0 ? cases.Failed.make({ problems: problems.length }) : cases.Held.make({ patches: found.length })
  )
})
