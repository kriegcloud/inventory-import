/** A commit checks dependents' types and lint, but only changed packages' own tests (Benjamin, 2026-11-26). */
import { $RepoCliId } from "@beep/identity/packages"
import * as A from "effect/Array"
import * as S from "effect/Schema"
import * as Str from "effect/String"

const $I = $RepoCliId.create("commands/Check/CheckChanged.schema")

/** The workspace facts the planner needs, read from the repository's manifests. */
export class CheckPackage extends S.Opaque<CheckPackage, { readonly brand: unique symbol }>()(
  S.Struct({
    name: S.NonEmptyString.pipe(S.annotateKey({ description: "The workspace's package name" })),
    scripts: S.Array(S.String).pipe(S.annotateKey({ description: "Script names supplied by this package" })),
    dependencies: S.Array(S.String).pipe(
      S.annotateKey({ description: "Runtime, development and peer dependency names" })
    )
  }).pipe($I.annoteSchema("CheckPackage", { description: "A workspace's check tasks and dependency edges" }))
) {}

/** Selection and manifest facts, independent of git and turbo. */
export class ChangedCheckInput extends S.Opaque<ChangedCheckInput, { readonly brand: unique symbol }>()(
  S.Struct({
    base: S.NonEmptyString.pipe(S.annotateKey({ description: "The merge base with origin/main" })),
    changedPackages: S.Array(S.String).pipe(S.annotateKey({ description: "Packages selected by turbo's git filter" })),
    packages: S.Array(CheckPackage).pipe(S.annotateKey({ description: "Every workspace's manifest facts" })),
    rootTasks: S.Array(S.String).pipe(S.annotateKey({ description: "The //# words from the root check script" })),
    globalChange: S.Boolean.pipe(S.annotateKey({ description: "A shared root configuration or lockfile changed" }))
  }).pipe($I.annoteSchema("ChangedCheckInput", { description: "Everything needed to plan a changed check" }))
) {}

/** One turbo invocation, with a sentence saying which tests it runs. */
export class ChangedCheckPlan extends S.Opaque<ChangedCheckPlan, { readonly brand: unique symbol }>()(
  S.Struct({
    words: S.Array(S.String).pipe(S.annotateKey({ description: "Executable and arguments for the shared runner" })),
    sentence: S.String.pipe(S.annotateKey({ description: "The scope printed before turbo starts" }))
  }).pipe($I.annoteSchema("ChangedCheckPlan", { description: "The turbo command and its stated scope" }))
) {}

/** Plans one invocation; root laws always run whole because most read the whole tree and take seconds. */
export const changedCheckPlan = (input: ChangedCheckInput): ChangedCheckPlan => {
  const changed = A.filter(input.packages, (pkg) => input.globalChange || A.contains(input.changedPackages, pkg.name))
  let affected = A.map(changed, (pkg) => pkg.name)
  for (;;) {
    const next = A.map(
      A.filter(
        input.packages,
        (pkg) =>
          A.contains(affected, pkg.name) || A.some(pkg.dependencies, (dependency) => A.contains(affected, dependency))
      ),
      (pkg) => pkg.name
    )
    if (next.length === affected.length) break
    affected = next
  }
  const tests = A.flatMap(changed, (pkg) =>
    A.map(
      A.filter(["test", "prove"], (script) => A.contains(pkg.scripts, script)),
      (script) => `${pkg.name}#${script}`
    )
  )
  const shortBase = Str.slice(0, 8)(input.base)
  const scope = input.globalChange
    ? `shared root configuration changed since ${shortBase}; every package's own tests and proofs, type-check and lint (${changed.length} packages), and all root laws.`
    : changed.length === 0
      ? `no package changed since ${shortBase}; root laws only.`
      : `${changed.length} package${changed.length === 1 ? "" : "s"} changed since ${shortBase} (${A.join(
          A.map(changed, (pkg) => pkg.name),
          ", "
        )}); their own tests and proofs, type-check and lint of ${affected.length} package${affected.length === 1 ? "" : "s"} (changed packages and their dependents), and all root laws. Dependents' tests run in \`bun run check\`.`
  return ChangedCheckPlan.make({
    words: [
      "turbo",
      "run",
      ...(changed.length === 0 ? [] : ["check", "lint"]),
      ...input.rootTasks,
      ...tests,
      ...(input.globalChange || changed.length === 0 ? [] : [`--filter=...[${input.base}]`])
    ],
    sentence: `check:changed: ${scope}`
  })
}

/** The package list turbo prints with `ls --output=json`; unrelated metadata is ignored. */
export class TurboPackages extends S.Opaque<TurboPackages, { readonly brand: unique symbol }>()(
  S.Struct({
    packages: S.Struct({
      items: S.Array(S.Struct({ name: S.String.pipe(S.annotateKey({ description: "Selected workspace name" })) })).pipe(
        S.annotateKey({ description: "Selected workspaces" })
      )
    }).pipe(S.annotateKey({ description: "Turbo's selected package list" }))
  }).pipe($I.annoteSchema("TurboPackages", { description: "The selected package names from turbo ls" }))
) {}

/** Bun removes `run`'s separator; restore it for this forwarding command while retaining its own help. */
export const changedCheckArguments = (args: ReadonlyArray<string>): ReadonlyArray<string> => {
  if (A.join(A.take(args, 2), " ") !== "check changed" || args.length < 3) return args
  const rest = A.drop(args, 2)
  if (
    A.some(A.take(rest, 1), (arg) =>
      A.contains(["--", "--help", "-h", "--version", "--completions", "--wizard", "--log-level"], arg)
    )
  )
    return args
  return ["check", "changed", "--", ...rest]
}
