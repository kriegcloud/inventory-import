/**
 * Every package with screens the app mounts must be in the two lists Tailwind reads class names from, or the classes
 * only its screens use are missing from the stylesheet and nothing else fails: every text is right and the layout is
 * wrong. The two lists are the `@source` lines of `apps/inventory/src/web/index.css` (development) and
 * `screenPackages` in `apps/inventory/vite.config.ts` (the production build narrows the sources to the files the
 * entry reaches in them). A package has screens when it has a `.tsx` file under `src`; it is the app's when the app
 * declares it.
 *
 * @packageDocumentation
 */
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as Str from "effect/String"
import { Repo } from "../../Repo.service.ts"
import { Manifest } from "../../Repo.schema.ts"
import { err, failed, out, passed } from "../../Report.schema.ts"

/**
 * Compares the packages with screens against both lists.
 *
 * @category rules
 */
export const screens = Effect.fn("Screens.screens")(function* () {
  const repo = yield* Repo
  const app = repo.join(repo.root, "apps", "inventory")
  const css = repo.join(app, "src", "web", "index.css")
  const vite = repo.join(app, "vite.config.ts")

  const all = yield* repo.workspaces
  const packagesDir = repo.join(repo.root, "packages")
  const workspaces = A.filter(all, (workspace) => Str.startsWith(`${packagesDir}/`)(workspace.dir))
  const appPackage = yield* repo.json(Manifest)(repo.join(app, "package.json"))
  const declared = R.keys({ ...appPackage.dependencies, ...appPackage.devDependencies })
  const withScreens = yield* Effect.filter(
    A.filter(workspaces, (workspace) => A.contains(declared, String(workspace.manifest.name))),
    (workspace) =>
      repo.files(repo.join(workspace.dir, "src")).pipe(Effect.map(A.some((file) => Str.endsWith(".tsx")(file)))),
    { concurrency: 1 }
  )

  // `@source "../../../../packages/x/src";` lines, as folders.
  const cssText = yield* repo.text(css)
  const sources = A.dedupe(
    A.map(A.fromIterable(Str.matchAll(/^@source "([^"]+)";/gm)(cssText)), (match) =>
      repo.resolve(repo.dirname(css), match[1] ?? "")
    )
  )
  // The entries of `screenPackages`: `"@scope/name": fileURLToPath(new URL("../../packages/x", import.meta.url))`.
  const viteText = yield* repo.text(vite)
  const block = O.fromNullishOr(/const screenPackages = \{([\s\S]*?)\n\}/.exec(viteText))
  const listed = R.fromEntries(
    O.match(block, {
      onNone: () => A.empty<readonly [string, string]>(),
      onSome: (found) =>
        A.map(
          A.fromIterable(
            Str.matchAll(/"([^"]+)":\s*fileURLToPath\(new URL\("([^"]+)", import\.meta\.url\)\)/g)(found[1] ?? "")
          ),
          (match) => [match[1] ?? "", repo.resolve(repo.dirname(vite), match[2] ?? "")] as const
        )
    })
  )

  const missingBlock = O.isNone(block)
    ? A.of("apps/inventory/vite.config.ts has no `const screenPackages = { ... }` to read")
    : A.empty<string>()
  const perPackage = A.flatMap(withScreens, (workspace) => {
    const name = String(workspace.manifest.name)
    const where = repo.relative(repo.root, workspace.dir)
    const src = repo.join(workspace.dir, "src")
    const noSource = A.contains(sources, src)
      ? A.empty<string>()
      : A.of(
          `${name} has screens (${where}/src) and no \`@source\` line in apps/inventory/src/web/index.css: add @source "${repo.relative(repo.dirname(css), src)}";`
        )
    const notListed = O.contains(R.get(listed, name), workspace.dir)
      ? A.empty<string>()
      : A.of(
          `${name} has screens and is not in \`screenPackages\` in apps/inventory/vite.config.ts with its folder (${where}): the production stylesheet would lack its classes`
        )
    return A.appendAll(noSource, notListed)
  })
  const noPackage = yield* Effect.forEach(
    R.toEntries(listed),
    ([name, dir]) =>
      repo
        .exists(repo.join(dir, "package.json"))
        .pipe(
          Effect.map((present) =>
            present
              ? A.empty<string>()
              : A.of(`screenPackages names ${name} at ${repo.relative(repo.root, dir)}, which is no package`)
          )
        ),
    { concurrency: 1 }
  )
  const noSourceFolder = yield* Effect.forEach(
    A.filter(sources, (dir) => Str.startsWith(packagesDir)(dir)),
    (dir) =>
      repo
        .exists(dir)
        .pipe(
          Effect.map((present) =>
            present
              ? A.empty<string>()
              : A.of(`index.css names the source ${repo.relative(repo.root, dir)}, which does not exist`)
          )
        ),
    { concurrency: 1 }
  )
  const problems = A.appendAll(
    A.appendAll(missingBlock, perPackage),
    A.appendAll(A.flatten(noPackage), A.flatten(noSourceFolder))
  )
  return A.isArrayNonEmpty(problems)
    ? failed(
        A.prepend(
          A.map(problems, (problem) => err(`  ${problem}`)),
          err("check-screens FAIL")
        )
      )
    : passed([
        out(
          `check-screens OK  ${withScreens.length} packages with screens, each in both lists: ${A.join(
            A.map(withScreens, (workspace) => String(workspace.manifest.name)),
            ", "
          )}`
        )
      ])
})
