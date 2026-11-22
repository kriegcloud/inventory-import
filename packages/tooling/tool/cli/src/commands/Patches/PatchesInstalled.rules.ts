/**
 * `patches installed`: what is in `node_modules` holds what every registered patch writes (docs/patches.md).
 *
 * This is the one question a run of code has to have answered first. turbo takes the patch files into every task's
 * hash, and reads nothing of `node_modules`: a test run after a patch changed and before `bun install` would run on
 * the package as it was, pass, and be stored under the new patch's hash, then replayed after the install as if it
 * had run with it. So every task that runs or type-checks code waits for this (`turbo.json`), and it is never
 * replayed itself. It reads only the root's `patchedDependencies`, not the headers: a patch whose header is not
 * finished stops `patches check`, and stops no test.
 *
 * @packageDocumentation
 */
import { $RepoCliId } from "@beep/identity/packages"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import { Repo } from "../../Repo.service.ts"
import { err, type Line, out } from "../../Report.schema.ts"
import { PatchedManifest } from "./Patches.schema.ts"
import { holdsPatches } from "./PatchesRead.rules.ts"

const $I = $RepoCliId.create("commands/Patches/PatchesInstalled.rules")

const built = S.String.pipe(S.annotateKey({ description: "The file bun applies, from the root" }))

/**
 * What `patches installed` finds: every patched package installed patched, or each that is not.
 *
 * @category schemas
 */
export const PatchesInstalledFinding = S.TaggedUnion({
  Held: { packages: S.Int.pipe(S.annotateKey({ description: "How many patched packages were read" })) },
  NoFile: {
    key: S.String.pipe(S.annotateKey({ description: "A key of patchedDependencies" })),
    built
  },
  NotInPlace: { name: S.String.pipe(S.annotateKey({ description: "The package" })), built },
  Failed: { problems: S.Int.pipe(S.annotateKey({ description: "How many packages are not installed patched" })) }
}).pipe($I.annoteSchema("PatchesInstalledFinding", { description: "A patched package, as it is installed" }))

/**
 * The decoded value of `PatchesInstalledFinding`.
 *
 * @category models
 */
export type PatchesInstalledFinding = typeof PatchesInstalledFinding.Type

/**
 * The line each finding prints.
 *
 * @category rendering
 */
export const patchesInstalledSentence: (finding: PatchesInstalledFinding) => Line = PatchesInstalledFinding.match({
  Held: ({ packages }) =>
    out(
      packages === 0
        ? "patches:installed OK  no dependency is patched"
        : `patches:installed OK  ${packages} patched package${packages === 1 ? " is" : "s are"} installed with what the patches write`
    ),
  NoFile: ({ key, built: file }) =>
    err(`package.json: patchedDependencies gives "${key}" the file "${file}", which is not there`),
  NotInPlace: ({ name, built: file }) =>
    err(
      `node_modules/${name}: does not hold what ${file} writes, so nothing was run: a test or a proof would run on the package as it was before and be replayed later as if it had run with the patch. Run \`bun install\``
    ),
  Failed: ({ problems }) =>
    err(`patches:installed failed: ${problems} package${problems === 1 ? "" : "s"} not installed as patched`)
})

/**
 * The package a key of `patchedDependencies` names: what is before the `@` that starts its resolution.
 *
 * @example
 * packageOf("@alchemy.run/domain@vendor/alchemy/alchemy.run-domain-734c27a.tgz") // "@alchemy.run/domain"
 *
 * @category rules
 */
export const packageOf = (key: string): string => O.getOrElse(O.fromNullishOr(/^(@?[^@]+)@/.exec(key)?.[1]), () => key)

/**
 * Reads every package the root's `patchedDependencies` names as it is installed.
 *
 * @category rules
 */
export const patchesInstalled = Effect.fn("PatchesInstalled.patchesInstalled")(function* () {
  const repo = yield* Repo
  const manifest = yield* repo.json(PatchedManifest)(repo.join(repo.root, "package.json"))
  const registered = R.toEntries(manifest.patchedDependencies ?? {})
  const { cases } = PatchesInstalledFinding
  const perPackage = yield* Effect.forEach(
    registered,
    Effect.fnUntraced(function* ([key, file]) {
      if (!(yield* repo.exists(repo.join(repo.root, file)))) {
        return A.of<PatchesInstalledFinding>(cases.NoFile.make({ key, built: file }))
      }
      const name = packageOf(key)
      const holds = yield* holdsPatches(name, file)
      return holds ? A.empty<PatchesInstalledFinding>() : A.of(cases.NotInPlace.make({ name, built: file }))
    }),
    { concurrency: 1 }
  )
  const problems = A.flatten(perPackage)
  return A.append<PatchesInstalledFinding, PatchesInstalledFinding>(
    problems,
    problems.length > 0
      ? cases.Failed.make({ problems: problems.length })
      : cases.Held.make({ packages: registered.length })
  )
})
