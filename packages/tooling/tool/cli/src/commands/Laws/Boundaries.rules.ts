/**
 * Which package may import which (BRIEF-contexts.md, "The dependency direction"), held to account. bun hoists one
 * `node_modules`, so an import of a workspace package the importer never declared still resolves; this rule reads
 * every workspace's `package.json` (`beep.family`, and for a context package `beep.context` and `beep.layer`) and
 * every import specifier under its `src` and `test`, and fails on:
 *
 * - a workspace package imported but not declared in dependencies, devDependencies or peerDependencies;
 * - a declared or imported workspace package the importer's row does not allow;
 * - a path into `apps/` from a package.
 *
 * Third-party packages are not this rule's business.
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
import { Repo, type Workspace } from "../../Repo.service.ts"
import { err, type Line, out } from "../../Report.schema.ts"

const $I = $RepoCliId.create("commands/Laws/Boundaries.rules")

/**
 * What `laws boundaries` finds: every workspace within its row, or a refusal and each import or declaration against
 * it.
 *
 * @category schemas
 */
export const BoundariesFinding = S.TaggedUnion({
  Held: { workspaces: S.Int.pipe(S.annotateKey({ description: "How many workspaces were read" })) },
  Refused: {},
  DeclaredAgainstRow: {
    name: S.String.pipe(S.annotateKey({ description: "The workspace that declares it" })),
    dependency: S.String.pipe(S.annotateKey({ description: "The workspace package its row refuses" }))
  },
  IntoApps: {
    where: S.String.pipe(S.annotateKey({ description: "The file, from the root" })),
    specifier: S.String.pipe(S.annotateKey({ description: "The relative path that reaches into apps/" }))
  },
  Undeclared: {
    where: S.String.pipe(S.annotateKey({ description: "The file, from the root" })),
    imported: S.String.pipe(S.annotateKey({ description: "The workspace package it imports" })),
    name: S.String.pipe(S.annotateKey({ description: "The workspace that does not declare it" }))
  },
  ImportedAgainstRow: {
    where: S.String.pipe(S.annotateKey({ description: "The file, from the root" })),
    imported: S.String.pipe(S.annotateKey({ description: "The workspace package its row refuses" }))
  }
}).pipe(
  $I.annoteSchema("BoundariesFinding", { description: "Every workspace within its row, or each import against it" })
)

/**
 * The decoded value of `BoundariesFinding`.
 *
 * @category models
 */
export type BoundariesFinding = typeof BoundariesFinding.Type

/**
 * The line each finding prints.
 *
 * @category rendering
 */
export const boundariesSentence: (finding: BoundariesFinding) => Line = BoundariesFinding.match({
  Held: ({ workspaces }) => out(`check-boundaries OK  ${workspaces} workspaces`),
  Refused: () => err("check-boundaries FAIL"),
  DeclaredAgainstRow: ({ name, dependency }) => err(`  ${name} declares ${dependency}, which its layer may not use`),
  IntoApps: ({ where, specifier }) => err(`  ${where} imports "${specifier}": a package never reaches into apps/`),
  Undeclared: ({ where, imported, name }) => err(`  ${where} imports ${imported}, which ${name} does not declare`),
  ImportedAgainstRow: ({ where, imported }) => err(`  ${where} imports ${imported}, which its layer may not use`)
})

interface Kind {
  readonly family: string
  readonly context: string | undefined
  readonly layer: string | undefined
}

/** What a workspace is, for the table: its family, and for a context package its context and layer. */
const kindOf = (workspace: Workspace): Kind =>
  Str.includes("/apps/")(workspace.dir)
    ? { family: "app", context: undefined, layer: undefined }
    : {
        family: workspace.manifest.beep?.family ?? "unknown",
        context: workspace.manifest.beep?.context,
        layer: workspace.manifest.beep?.layer
      }

const contextMay = (a: Kind, b: Kind): boolean => {
  const own = a.context === b.context
  if (b.family === "kernel") return true
  if (a.layer === "contract") return false
  if (a.layer === "model") return own && b.layer === "contract"
  if (a.layer === "host") {
    return (own && (b.layer === "model" || b.layer === "contract")) || b.layer === "contract" || b.family === "drivers"
  }
  if (a.layer === "web") {
    return (
      (own && (b.layer === "contract" || b.layer === "model")) || b.family === "ui-system" || b.family === "web-kit"
    )
  }
  return false
}

/**
 * Whether a workspace of kind `a` may depend on one of kind `b`.
 *
 * Nothing depends on `tooling`: the repository's own commands are run by the root, never imported by a package.
 * Nothing depends on `infra` either: it declares what is deployed, so nothing that is deployed may import it, the
 * app included. An `infra` package itself may use the foundation and nothing else.
 *
 * @category rules
 */
export const allowed =
  (a: Kind) =>
  (b: Kind): boolean => {
    if (b.family === "tooling" || b.family === "infra") return false
    if (a.family === "app") return true
    if (b.family === "app") return false
    if (b.family === "foundation") return true
    if (a.family === "drivers") return b.family === "drivers"
    if (a.family === "ui-system") return b.family === "ui-system"
    if (a.family === "web-kit") return b.family === "kernel"
    if (a.family === "context") return contextMay(a, b)
    return false
  }

const specifiers =
  /(?:import|export)\s[^"'`;]*?from\s*["']([^"']+)["']|import\s*["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g

const packageOf = (specifier: string): string =>
  Str.startsWith("@")(specifier)
    ? A.join(A.take(Str.split("/")(specifier), 2), "/")
    : A.head(Str.split("/")(specifier)).pipe(O.getOrElse(() => specifier))

/**
 * Checks every workspace under `apps` and `packages`.
 *
 * @category rules
 */
export const boundaries = Effect.fn("Boundaries.boundaries")(function* () {
  const repo = yield* Repo
  const workspaces = yield* repo.workspaces
  const byName = R.fromEntries(A.map(workspaces, (workspace) => [String(workspace.manifest.name), workspace] as const))
  const sources = Effect.fn("Boundaries.sources")(function* (dir: string) {
    const files = yield* repo.files(dir)
    return A.filter(files, (file) => !Str.includes("/node_modules/")(file) && /\.(m?ts|tsx)$/.test(file))
  })
  const perWorkspace = yield* Effect.forEach(
    workspaces,
    Effect.fnUntraced(function* (workspace) {
      const name = String(workspace.manifest.name)
      const kind = kindOf(workspace)
      const may = (other: string): boolean => R.get(byName, other).pipe(O.map(kindOf), O.exists(allowed(kind)))
      const declared = A.filter(
        R.keys({
          ...workspace.manifest.dependencies,
          ...workspace.manifest.devDependencies,
          ...workspace.manifest.peerDependencies
        }),
        (dependency) => R.has(byName, dependency)
      )
      const fromManifest = A.flatMap(declared, (dependency) =>
        may(dependency)
          ? A.empty<BoundariesFinding>()
          : A.of<BoundariesFinding>({ _tag: "DeclaredAgainstRow", name, dependency })
      )
      const inSrc = yield* sources(repo.join(workspace.dir, "src"))
      const inTest = yield* sources(repo.join(workspace.dir, "test"))
      const fromFiles = yield* Effect.forEach(
        A.appendAll(inSrc, inTest),
        (file) =>
          repo.text(file).pipe(
            Effect.map((text) => {
              const where = repo.relative(repo.root, file)
              return A.flatMap(A.fromIterable(Str.matchAll(specifiers)(text)), (match) => {
                const specifier = match[1] ?? match[2] ?? match[3] ?? ""
                if (kind.family !== "app" && Str.startsWith(".")(specifier) && Str.includes("apps/")(specifier)) {
                  return A.of<BoundariesFinding>({ _tag: "IntoApps", where, specifier })
                }
                const imported = packageOf(specifier)
                if (!R.has(byName, imported) || imported === name) return A.empty<BoundariesFinding>()
                if (!A.contains(declared, imported)) {
                  return A.of<BoundariesFinding>({ _tag: "Undeclared", where, imported, name })
                }
                return may(imported)
                  ? A.empty<BoundariesFinding>()
                  : A.of<BoundariesFinding>({ _tag: "ImportedAgainstRow", where, imported })
              })
            })
          ),
        { concurrency: 1 }
      )
      return A.appendAll(fromManifest, A.flatten(fromFiles))
    }),
    { concurrency: 1 }
  )
  // One line per problem, as the person reads it: the same import twice in a file is said once.
  const problems = A.dedupeWith(
    A.flatten(perWorkspace),
    (a, b) => boundariesSentence(a).text === boundariesSentence(b).text
  )
  return A.isArrayNonEmpty(problems)
    ? A.prepend<BoundariesFinding, BoundariesFinding>(problems, { _tag: "Refused" })
    : A.of<BoundariesFinding>({ _tag: "Held", workspaces: workspaces.length })
})
