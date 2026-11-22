/**
 * `patches prove`: each patch's test fails without the patch (docs/patches.md).
 *
 * The test passes on what is installed: that is the patches workspace's own `test`. Here the same test is run from
 * a copy that sits beside the package as it is without its patches, where node resolves that package first, and it
 * has to fail there with a failed test, not with a file that does not load. A test that passes there says the
 * library fixed the defect, or that the test never tested the patch: either way the patch is no longer shown to be
 * needed.
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

/**
 * What `patches prove` finds for each patch: its test fails without it, passes without it, or did not run.
 *
 * @category schemas
 */
export const PatchesProveFinding = S.TaggedUnion({
  Proved: {
    patch,
    failed: S.Int.pipe(S.annotateKey({ description: "How many of its tests failed without the patch" }))
  },
  Held: { patches: S.Int.pipe(S.annotateKey({ description: "How many patches were proved needed" })) },
  PassesWithout: { patch, test },
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

/**
 * The line each finding prints.
 *
 * @category rendering
 */
export const patchesProveSentence: (finding: PatchesProveFinding) => Line = PatchesProveFinding.match({
  Proved: ({ patch: file, failed }) =>
    out(`  needed  ${file}: without it, ${failed} of its tests fail${failed === 1 ? "s" : ""}`),
  Held: ({ patches }) =>
    out(
      patches === 0
        ? "patches:prove OK  no dependency is patched"
        : `patches:prove OK  ${patches} patch${patches === 1 ? "" : "es"}: each one's test fails without it`
    ),
  PassesWithout: ({ patch: file, test: path }) =>
    err(
      `${file}: its test ${path} passes without it. If the library fixed the defect, drop the patch (docs/patches.md, "Dropping a patch"); if not, the test does not test the patch`
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
 * Puts a package without its patches into a folder: the kept file unpacked, or, for a package from a registry, what
 * is installed with its patches taken out again. The second gives `some` of what git said when what is installed
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

/**
 * Runs every patch's test without the patches of its package, and says which patches that shows to be needed.
 *
 * @category rules
 */
export const patchesProve = Effect.fn("PatchesProve.patchesProve")(function* () {
  const repo = yield* Repo
  const { sets } = yield* readPatches()
  const home = repo.join(repo.root, proofFolder)
  const vitest = repo.join(repo.root, "node_modules/vitest/vitest.mjs")

  const proveSet = Effect.fnUntraced(function* (set: PatchSet) {
    const shared = headerOf(set)
    if (O.isNone(shared))
      return A.of<PatchesProveFinding>(cases.Unread.make({ folder: `${patchesFolder}/${set.name}` }))
    const header = shared.value
    const root = repo.join(home, set.name)
    yield* repo.remove(root)
    const unpatched = yield* withoutPatches(
      set,
      header.package,
      header.appliesTo,
      repo.join(root, installedAt(header.package))
    )

    const proveOne = Effect.fnUntraced(function* (file: PatchFile) {
      const named = O.getOrElse(
        O.map(file.read.header, (own) => own.test),
        () => header.test
      )
      const testFile = repo.join(repo.root, patchesFolder, named)
      const from = `${patchesFolder}/${named}`
      if (O.isSome(unpatched)) {
        return cases.DidNotRun.make({ patch: file.file, test: from, said: unpatched.value })
      }
      const source = repo.dirname(testFile)
      const copy = repo.join(root, Str.replace(/\.patch$/, "")(file.name))
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
      if (!(yield* repo.exists(result))) {
        return cases.DidNotRun.make({ patch: file.file, test: from, said: firstLine(`${ran.stderr}\n${ran.stdout}`) })
      }
      const counts = yield* repo.json(TestRun)(result)
      if (counts.numFailedTests > 0) return cases.Proved.make({ patch: file.file, failed: counts.numFailedTests })
      if (counts.numPassedTests > 0) return cases.PassesWithout.make({ patch: file.file, test: from })
      return cases.DidNotRun.make({
        patch: file.file,
        test: from,
        said: counts.numTotalTests === 0 ? "the run found no test in it" : firstLine(`${ran.stderr}\n${ran.stdout}`)
      })
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
