/** Reads git and manifests once, then gives the pure plan to the same runner as the full check. */
import * as A from "effect/Array"
import * as Console from "effect/Console"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import * as Str from "effect/String"
import { RepoError } from "../../Cli.errors.ts"
import { Manifest } from "../../Repo.schema.ts"
import { Repo } from "../../Repo.service.ts"
import { ChangedCheckInput, CheckPackage, TurboPackages, changedCheckPlan } from "./CheckChanged.schema.ts"
import { checkRun } from "./CheckRunner.ts"

/** Resolves changed packages against origin/main, including dirty and untracked files, before running turbo. */
export const checkChanged = Effect.fn("Check.changed")(function* (args: ReadonlyArray<string>) {
  const repo = yield* Repo
  const main = yield* repo.run("git", ["rev-parse", "--verify", "origin/main^{commit}"])
  if (main.code !== 0)
    return yield* RepoError.make({
      path: "origin/main",
      message: "origin/main is missing. Run `git fetch origin main`, then retry check:changed."
    })
  const merge = yield* repo.run("git", ["merge-base", "HEAD", "origin/main"])
  if (merge.code !== 0)
    return yield* RepoError.make({
      path: "origin/main",
      message: "Cannot find a merge base with origin/main. Run `git fetch origin main`, then retry check:changed."
    })
  const base = Str.trim(merge.stdout)
  const listed = yield* repo.run("turbo", ["ls", `--filter=[${base}]`, "--output=json"])
  if (listed.code !== 0) return yield* RepoError.make({ path: "turbo ls", message: listed.stderr })
  const selected = yield* S.decodeEffect(S.fromJsonString(TurboPackages))(listed.stdout).pipe(
    Effect.mapError((cause) => RepoError.make({ path: "turbo ls", message: cause.message }))
  )
  const diff = yield* repo.run("git", ["diff", "--name-only", "-z", base, "--"])
  const untracked = yield* repo.run("git", ["ls-files", "--others", "--exclude-standard", "-z"])
  if (diff.code !== 0 || untracked.code !== 0)
    return yield* RepoError.make({
      path: "git",
      message: `Cannot read changed files: ${diff.stderr}${untracked.stderr}`
    })
  const globalChange = A.some(Str.split("\0")(`${diff.stdout}${untracked.stdout}`), (file) =>
    A.contains(["turbo.json", "bun.lock", "package.json", "tsconfig.base.json"], file)
  )
  const root = yield* repo.json(Manifest)(repo.join(repo.root, "package.json"))
  const check = R.get(root.scripts, "check")
  if (O.isNone(check))
    return yield* RepoError.make({ path: "package.json", message: "The root check script is missing" })
  const workspaces = yield* repo.workspaces
  const packages = A.flatMap(workspaces, ({ manifest }) =>
    A.map(O.toArray(O.fromUndefinedOr(manifest.name)), (name) =>
      CheckPackage.make({
        name,
        scripts: R.keys(manifest.scripts),
        dependencies: A.flatMap(
          [manifest.dependencies, manifest.devDependencies, manifest.peerDependencies],
          (dependencies) => A.flatMap(O.toArray(O.fromUndefinedOr(dependencies)), R.keys)
        )
      })
    )
  )
  const plan = changedCheckPlan(
    ChangedCheckInput.make({
      base,
      changedPackages: A.map(selected.packages.items, (pkg) => pkg.name),
      packages,
      rootTasks: A.filter(Str.split(/\s+/)(check.value), Str.startsWith("//#")),
      globalChange
    })
  )
  yield* Console.log(plan.sentence)
  yield* checkRun([...plan.words, ...args])
})
