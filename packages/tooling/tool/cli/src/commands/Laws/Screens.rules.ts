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
import { $RepoCliId } from "@beep/identity/packages"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import * as Str from "effect/String"
import { Repo } from "../../Repo.service.ts"
import { Manifest } from "../../Repo.schema.ts"
import { err, type Line, out } from "../../Report.schema.ts"

const $I = $RepoCliId.create("commands/Laws/Screens.rules")

/**
 * What `laws screens` finds: every package with screens in both lists, or a refusal and each thing missing.
 *
 * @category schemas
 */
export const ScreensFinding = S.TaggedUnion({
  Listed: {
    names: S.Array(S.String).pipe(S.annotateKey({ description: "The packages with screens, each in both lists" }))
  },
  Refused: {},
  NoBlock: {},
  NoSource: {
    name: S.String.pipe(S.annotateKey({ description: "The package with screens" })),
    where: S.String.pipe(S.annotateKey({ description: "Its folder, from the root" })),
    add: S.String.pipe(S.annotateKey({ description: "The path the missing @source line names" }))
  },
  NotListed: {
    name: S.String.pipe(S.annotateKey({ description: "The package with screens" })),
    where: S.String.pipe(S.annotateKey({ description: "Its folder, from the root" }))
  },
  NoPackage: {
    name: S.String.pipe(S.annotateKey({ description: "The name screenPackages lists" })),
    where: S.String.pipe(S.annotateKey({ description: "The folder it points at, which holds no package" }))
  },
  NoFolder: {
    where: S.String.pipe(S.annotateKey({ description: "The folder an @source line names, which does not exist" }))
  }
}).pipe(
  $I.annoteSchema("ScreensFinding", { description: "Every package with screens in both lists, or what is missing" })
)

/**
 * The decoded value of `ScreensFinding`.
 *
 * @category models
 */
export type ScreensFinding = typeof ScreensFinding.Type

/**
 * The line each finding prints.
 *
 * @category rendering
 */
export const screensSentence: (finding: ScreensFinding) => Line = ScreensFinding.match({
  Listed: ({ names }) =>
    out(`check-screens OK  ${names.length} packages with screens, each in both lists: ${A.join(names, ", ")}`),
  Refused: () => err("check-screens FAIL"),
  NoBlock: () => err("  apps/inventory/vite.config.ts has no `const screenPackages = { ... }` to read"),
  NoSource: ({ name, where, add }) =>
    err(
      `  ${name} has screens (${where}/src) and no \`@source\` line in apps/inventory/src/web/index.css: add @source "${add}";`
    ),
  NotListed: ({ name, where }) =>
    err(
      `  ${name} has screens and is not in \`screenPackages\` in apps/inventory/vite.config.ts with its folder (${where}): the production stylesheet would lack its classes`
    ),
  NoPackage: ({ name, where }) => err(`  screenPackages names ${name} at ${where}, which is no package`),
  NoFolder: ({ where }) => err(`  index.css names the source ${where}, which does not exist`)
})

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

  const missingBlock = O.isNone(block) ? A.of<ScreensFinding>({ _tag: "NoBlock" }) : A.empty<ScreensFinding>()
  const perPackage = A.flatMap(withScreens, (workspace) => {
    const name = String(workspace.manifest.name)
    const where = repo.relative(repo.root, workspace.dir)
    const src = repo.join(workspace.dir, "src")
    const noSource = A.contains(sources, src)
      ? A.empty<ScreensFinding>()
      : A.of<ScreensFinding>({ _tag: "NoSource", name, where, add: repo.relative(repo.dirname(css), src) })
    const notListed = O.contains(R.get(listed, name), workspace.dir)
      ? A.empty<ScreensFinding>()
      : A.of<ScreensFinding>({ _tag: "NotListed", name, where })
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
              ? A.empty<ScreensFinding>()
              : A.of<ScreensFinding>({ _tag: "NoPackage", name, where: repo.relative(repo.root, dir) })
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
              ? A.empty<ScreensFinding>()
              : A.of<ScreensFinding>({ _tag: "NoFolder", where: repo.relative(repo.root, dir) })
          )
        ),
    { concurrency: 1 }
  )
  const problems = A.appendAll(
    A.appendAll(missingBlock, perPackage),
    A.appendAll(A.flatten(noPackage), A.flatten(noSourceFolder))
  )
  return A.isArrayNonEmpty(problems)
    ? A.prepend<ScreensFinding, ScreensFinding>(problems, { _tag: "Refused" })
    : A.of<ScreensFinding>({
        _tag: "Listed",
        names: A.map(withScreens, (workspace) => String(workspace.manifest.name))
      })
})
