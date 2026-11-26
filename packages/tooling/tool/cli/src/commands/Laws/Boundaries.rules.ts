/**
 * Which package may import which (BRIEF-contexts.md, "The dependency direction"), held to account. bun hoists one
 * `node_modules`, so an import of a workspace package the importer never declared still resolves; this rule reads
 * every workspace's `package.json` (`beep.family`, and for a context package `beep.context` and `beep.layer`) and
 * every import specifier under its `src` and `test`, and fails on:
 *
 * - a workspace package imported but not declared: from `src`, in dependencies or peerDependencies; from `test`,
 *   in devDependencies too;
 * - a declared or imported workspace package the importer's row does not allow;
 * - a path into `apps/` from a package;
 * - a third-party package imported but not declared by the importer (or, for what every workspace is run with, by
 *   the root: its dependencies for `src`, its devDependencies for `test` only): hoisting would let a package reach any
 *   hook or store another one installed, under its hoisted name, past the lint that refuses them by the names it
 *   knows. The root's devDependencies are its tools (the type-checker, the linter, turbo): `src` that imports one is
 *   refused like any other undeclared package;
 * - a package imported from `src` that the importer declares only in devDependencies: what it declares for its tests
 *   is not there for its code (`@tanstack/store`, kept for one test of the review package, once came back into its
 *   `src` this way and passed).
 *
 * And nothing reaches the scratchpad (`scratchpad/`, decision "the scratchpad", 2026-11-22): neither the root's
 * package.json nor a workspace's declares its package or maps a `#` import into it, and no file imports it, by its
 * name, by a path into its folder or by an alias that climbs into it (`@/../../scratchpad/...`), nor pulls it in
 * through `import.meta.glob` or a stylesheet's `@import` or `@source`. For this one rule a workspace's `scripts`
 * folder, the files at its root (a build's configuration), its stylesheets and the files at the repository's root
 * (`alchemy.run.ts`, what a deploy runs) are read too. A path written some other way, built at run time, is not seen. The scratchpad
 * imports every package; if a package could import it back, an experiment would be part of the app.
 *
 * Every form of import is read: `import`, `export … from`, `import x = require(…)` and `import(…)`.
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
import { scratchpadFolder } from "../../Repo.schema.ts"
import { err, type Line, out } from "../../Report.schema.ts"
import { objectOf, stringsIn } from "../../Sync.rules.ts"
import { readImports } from "./internal/importsCode.ts"

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
  UndeclaredThirdParty: {
    where: S.String.pipe(S.annotateKey({ description: "The file, from the root" })),
    imported: S.String.pipe(S.annotateKey({ description: "The third-party package it imports" })),
    name: S.String.pipe(S.annotateKey({ description: "The workspace that does not declare it" }))
  },
  TestOnly: {
    where: S.String.pipe(S.annotateKey({ description: "The file under src, from the root" })),
    imported: S.String.pipe(S.annotateKey({ description: "The package it imports" })),
    name: S.String.pipe(S.annotateKey({ description: "The workspace that declares it only in devDependencies" }))
  },
  ImportedAgainstRow: {
    where: S.String.pipe(S.annotateKey({ description: "The file, from the root" })),
    imported: S.String.pipe(S.annotateKey({ description: "The workspace package its row refuses" }))
  },
  DeclaresScratchpad: {
    name: S.String.pipe(S.annotateKey({ description: "The workspace that declares the scratchpad" })),
    dependency: S.String.pipe(S.annotateKey({ description: "The scratchpad's package name" }))
  },
  IntoScratchpad: {
    where: S.String.pipe(S.annotateKey({ description: "The file, from the root" })),
    specifier: S.String.pipe(S.annotateKey({ description: "What it imports: the scratchpad's name or a path into it" }))
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
  UndeclaredThirdParty: ({ where, imported, name }) =>
    err(`  ${where} imports ${imported}, which ${name} does not declare (add it where it is used)`),
  TestOnly: ({ where, imported, name }) =>
    err(
      `  ${where} imports ${imported}, which ${name} declares only for its tests (devDependencies): declare it in dependencies, or keep it in test`
    ),
  ImportedAgainstRow: ({ where, imported }) => err(`  ${where} imports ${imported}, which its layer may not use`),
  DeclaresScratchpad: ({ name, dependency }) =>
    err(`  ${name} declares ${dependency}: nothing depends on the scratchpad. Move what it needs into a package`),
  IntoScratchpad: ({ where, specifier }) =>
    err(
      `  ${where} imports "${specifier}": nothing imports from the scratchpad. An experiment's code graduates into a package first`
    )
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
 * Nothing depends on `ontology` either, the app included (decision 9; report 14 section 7.2): it projects the
 * vocabulary into generated files and holds the ontology's gates, so it is run, never imported. The rule has no
 * notion of a test, so a test outside the package may not import it either. An `ontology` package may use the
 * foundation, the kernel (where the vocabulary and the records it reads live) and a context's contract package.
 *
 * @category rules
 */
export const allowed =
  (a: Kind) =>
  (b: Kind): boolean => {
    if (b.family === "tooling" || b.family === "infra") return false
    if (b.family === "ontology") return false
    if (a.family === "app") return true
    if (b.family === "app") return false
    if (b.family === "foundation") return true
    if (a.family === "ontology") return b.family === "kernel" || (b.family === "context" && b.layer === "contract")
    if (a.family === "drivers") return b.family === "drivers"
    if (a.family === "ui-system") return b.family === "ui-system"
    if (a.family === "web-kit") return b.family === "kernel"
    if (a.family === "context") return contextMay(a, b)
    return false
  }

const Declared = S.optionalKey(S.Record(S.String, S.String))
/** The part of the root manifest this rule reads: what it declares for every workspace. */
const RootDeclared = S.Struct({ dependencies: Declared, devDependencies: Declared })

const packageOf = (specifier: string): string =>
  Str.startsWith("@")(specifier)
    ? A.join(A.take(Str.split("/")(specifier), 2), "/")
    : A.head(Str.split("/")(specifier)).pipe(O.getOrElse(() => specifier))

// A package's name as npm allows it, with or without a scope and a path inside it: the app's own `@/` alias and a
// path are not one.
const packageName = /^(?:@[a-z0-9][a-z0-9._~-]*\/)?[a-z0-9][a-z0-9._~-]*(?:\/[A-Za-z0-9._~@/-]*)?(?:\?[a-z]+)?$/

/**
 * True for a specifier that names a package to install: not a path, not a built-in of the runtime, not one of the
 * build's own modules.
 */
const isThirdParty = (specifier: string): boolean =>
  packageName.test(specifier) && !/^(node|bun|virtual|cloudflare):/.test(specifier)

/**
 * Checks every workspace under `apps` and `packages`.
 *
 * @category rules
 */
export const boundaries = Effect.fn("Boundaries.boundaries")(function* () {
  const repo = yield* Repo
  const workspaces = yield* repo.workspaces
  const byName = R.fromEntries(A.map(workspaces, (workspace) => [String(workspace.manifest.name), workspace] as const))
  // What the root declares is there for every workspace: its dependencies for code and tests alike, its
  // devDependencies (the test runner, the type-checker, the build's own tools) for tests only.
  const root = yield* repo.json(RootDeclared)(repo.join(repo.root, "package.json"))
  const rootForCode = R.keys({ ...root.dependencies })
  const rootForTests = A.appendAll(rootForCode, R.keys({ ...root.devDependencies }))
  const sources = Effect.fn("Boundaries.sources")(function* (dir: string) {
    const files = yield* repo.files(dir)
    return A.filter(files, (file) => !Str.includes("/node_modules/")(file) && /\.(m?ts|tsx)$/.test(file))
  })
  // The scratchpad: its folder, and its package's name when it is there.
  const scratchDir = repo.join(repo.root, scratchpadFolder)
  const scratchManifest = repo.join(scratchDir, "package.json")
  const hasScratchpad = yield* repo.exists(scratchManifest)
  const scratchName = hasScratchpad
    ? O.fromUndefinedOr((yield* repo.json(S.Struct({ name: S.optionalKey(S.String) }))(scratchManifest)).name)
    : O.none<string>()
  // By its name; by a path from the file; or by an alias that climbs out of its folder into the scratchpad (`@/` and
  // `#` forms, `~/`): such a path names the scratchpad's folder among its parts after a `..`.
  const intoScratchpad = (file: string, specifier: string): boolean => {
    const path = Str.replace(/^!/, "")(specifier)
    if (O.contains(scratchName, packageOf(path))) return true
    if (Str.startsWith(".")(path)) {
      return Str.startsWith(`${scratchDir}/`)(`${repo.resolve(repo.dirname(file), path)}/`)
    }
    const parts = Str.split("/")(path)
    return !packageName.test(path) && A.contains(parts, "..") && A.contains(parts, scratchpadFolder)
  }
  // What a file names besides its imports: the paths of `import.meta.glob`, and in a stylesheet, `@import` and
  // `@source`. Either pulls files into a build.
  const named = (file: string, text: string): ReadonlyArray<string> =>
    Str.endsWith(".css")(file)
      ? A.map(A.fromIterable(Str.matchAll(/@(?:import|source)\s+(?:url\()?["']([^"']+)["']/g)(text)), (m) => m[1] ?? "")
      : A.flatMap(
          A.fromIterable(
            Str.matchAll(/import\.meta\.glob(?:Eager)?\s*(?:<[^>]*>)?\(\s*(\[[^\]]*\]|["'`][^"'`]*["'`])/g)(text)
          ),
          (m) => A.map(A.fromIterable(Str.matchAll(/["'`]([^"'`]+)["'`]/g)(m[1] ?? "")), (g) => g[1] ?? "")
        )
  /** Every way a file reaches into the scratchpad, as findings. */
  const reaching = (file: string, text: string): ReadonlyArray<BoundariesFinding> =>
    A.map(
      A.filter(
        A.appendAll(Str.endsWith(".css")(file) ? [] : readImports({ file, source: text }), named(file, text)),
        (specifier) => intoScratchpad(file, specifier)
      ),
      (specifier) => BoundariesFinding.cases.IntoScratchpad.make({ where: repo.relative(repo.root, file), specifier })
    )
  /** A package.json's `imports` map (`#exp/*`) whose target is in the scratchpad. */
  const mappedInto = (file: string, text: string): ReadonlyArray<BoundariesFinding> =>
    O.match(objectOf("imports")(text), {
      onNone: () => A.empty<BoundariesFinding>(),
      onSome: (block) =>
        A.map(
          A.filter(stringsIn(block)(text), (found) => intoScratchpad(file, found.value)),
          (found) =>
            BoundariesFinding.cases.IntoScratchpad.make({
              where: repo.relative(repo.root, file),
              specifier: found.value
            })
        )
    })
  // The repository's own files at its root (alchemy.run.ts is what a deploy runs) and its own package.json.
  const rootEntries = yield* repo.entries(repo.root)
  const rootFiles = A.map(
    A.filter(rootEntries, (entry) => !entry.directory && /\.(c?m?[jt]s|tsx)$/.test(entry.name)),
    (entry) => entry.path
  )
  const fromRootFiles = yield* Effect.forEach(
    rootFiles,
    (file) => Effect.map(repo.text(file), (text) => reaching(file, text)),
    { concurrency: 1 }
  )
  const rootManifestFile = repo.join(repo.root, "package.json")
  const rootManifestText = yield* repo.text(rootManifestFile)
  const fromRootManifest = A.appendAll(
    A.map(
      A.filter(R.keys({ ...root.dependencies, ...root.devDependencies }), (dependency) =>
        O.contains(scratchName, dependency)
      ),
      (dependency) => BoundariesFinding.cases.DeclaresScratchpad.make({ name: "the root's package.json", dependency })
    ),
    mappedInto(rootManifestFile, rootManifestText)
  )
  const perWorkspace = yield* Effect.forEach(
    workspaces,
    Effect.fnUntraced(function* (workspace) {
      const name = String(workspace.manifest.name)
      const kind = kindOf(workspace)
      const may = (other: string): boolean => R.get(byName, other).pipe(O.map(kindOf), O.exists(allowed(kind)))
      // What its code may import (dependencies and peerDependencies), and what its tests may import besides
      // (devDependencies).
      const forCode = R.keys({ ...workspace.manifest.dependencies, ...workspace.manifest.peerDependencies })
      const forTests = A.appendAll(forCode, R.keys({ ...workspace.manifest.devDependencies }))
      const declared = A.filter(forTests, (dependency) => R.has(byName, dependency))
      const fromManifest = A.appendAll(
        A.flatMap(declared, (dependency) =>
          may(dependency)
            ? A.empty<BoundariesFinding>()
            : A.of(BoundariesFinding.cases.DeclaredAgainstRow.make({ name, dependency }))
        ),
        A.map(
          A.filter(forTests, (dependency) => O.contains(scratchName, dependency)),
          (dependency) => BoundariesFinding.cases.DeclaresScratchpad.make({ name, dependency })
        )
      )
      const inSrc = yield* sources(repo.join(workspace.dir, "src"))
      const inTest = yield* sources(repo.join(workspace.dir, "test"))
      // Read for the scratchpad's rule only: the package's scripts, and the files at its root.
      const underScripts = yield* repo.files(repo.join(workspace.dir, "scripts"))
      const inScripts = A.filter(
        underScripts,
        (file) => !Str.includes("/node_modules/")(file) && /\.(m?[jt]s|tsx)$/.test(file)
      )
      const atRoot = yield* repo.entries(workspace.dir)
      const beside = A.appendAll(
        inScripts,
        A.map(
          A.filter(atRoot, (entry) => !entry.directory && /\.(m?[jt]s|tsx)$/.test(entry.name)),
          (entry) => entry.path
        )
      )
      const underSrc = yield* repo.files(repo.join(workspace.dir, "src"))
      const stylesheets = A.filter(
        A.appendAll(
          underSrc,
          A.map(atRoot, (entry) => entry.path)
        ),
        (file) => !Str.includes("/node_modules/")(file) && Str.endsWith(".css")(file)
      )
      const fromBeside = yield* Effect.forEach(
        A.appendAll(beside, stylesheets),
        (file) => Effect.map(repo.text(file), (text) => reaching(file, text)),
        { concurrency: 1 }
      )
      const manifestFile = repo.join(workspace.dir, "package.json")
      const manifestText = yield* repo.text(manifestFile)
      const fromImportsMap = mappedInto(manifestFile, manifestText)
      const fromFiles = yield* Effect.forEach(
        A.appendAll(
          A.map(inSrc, (file) => ({ file, code: true })),
          A.map(inTest, (file) => ({ file, code: false }))
        ),
        ({ code, file }) =>
          repo.text(file).pipe(
            Effect.map((text) => {
              const where = repo.relative(repo.root, file)
              // A third-party package this file may import: the code takes what it and the root declare to run with,
              // a test takes what either declares for the tests too.
              const thirdParty = code ? A.appendAll(rootForCode, forCode) : A.appendAll(rootForTests, forTests)
              // Declared only for the tests: a test may import it, the code may not.
              const testOnly = (imported: string): boolean => code && !A.contains(forCode, imported)
              const testOnlyFinding = (imported: string) =>
                A.of(BoundariesFinding.cases.TestOnly.make({ where, imported, name }))
              const globbed = A.map(
                A.filter(named(file, text), (specifier) => intoScratchpad(file, specifier)),
                (specifier) => BoundariesFinding.cases.IntoScratchpad.make({ where, specifier })
              )
              return A.appendAll(
                globbed,
                A.flatMap(readImports({ file, source: text }), (specifier) => {
                  if (intoScratchpad(file, specifier)) {
                    return A.of(BoundariesFinding.cases.IntoScratchpad.make({ where, specifier }))
                  }
                  if (kind.family !== "app" && Str.startsWith(".")(specifier) && Str.includes("apps/")(specifier)) {
                    return A.of(BoundariesFinding.cases.IntoApps.make({ where, specifier }))
                  }
                  const imported = packageOf(specifier)
                  if (imported === name) return A.empty<BoundariesFinding>()
                  if (!R.has(byName, imported)) {
                    if (!isThirdParty(specifier) || A.contains(thirdParty, imported))
                      return A.empty<BoundariesFinding>()
                    // Declared by the workspace for its tests only: said as that, with where to move it.
                    return A.contains(forTests, imported)
                      ? testOnlyFinding(imported)
                      : A.of(BoundariesFinding.cases.UndeclaredThirdParty.make({ where, imported, name }))
                  }
                  if (!A.contains(declared, imported)) {
                    return A.of(BoundariesFinding.cases.Undeclared.make({ where, imported, name }))
                  }
                  if (testOnly(imported)) return testOnlyFinding(imported)
                  return may(imported)
                    ? A.empty<BoundariesFinding>()
                    : A.of(BoundariesFinding.cases.ImportedAgainstRow.make({ where, imported }))
                })
              )
            })
          ),
        { concurrency: 1 }
      )
      return A.flatten([fromManifest, A.flatten(fromFiles), A.flatten(fromBeside), fromImportsMap])
    }),
    { concurrency: 1 }
  )
  // One line per problem, as the person reads it: the same import twice in a file is said once.
  const problems = A.dedupeWith(
    A.flatten([fromRootManifest, A.flatten(fromRootFiles), A.flatten(perWorkspace)]),
    (a, b) => boundariesSentence(a).text === boundariesSentence(b).text
  )
  return A.isArrayNonEmpty(problems)
    ? A.prepend<BoundariesFinding, BoundariesFinding>(problems, BoundariesFinding.cases.Refused.make({}))
    : A.of<BoundariesFinding>(BoundariesFinding.cases.Held.make({ workspaces: workspaces.length }))
})
