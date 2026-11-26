/**
 * Copies the used subset of beep-effect's private kit packages (`@beep/types`, `@beep/identity`, `@beep/schema`,
 * `@beep/utils`) into `packages/foundation/`, from one beep-effect commit, and records every file's source hash in
 * the package's `vendor.json`. `vendor check` then fails whenever a vendored file stops matching its source.
 *
 * The subset is computed, not hand-listed: the import closure of the entries in `VendorSubset.data.ts`, plus the
 * tests named there. Source files are copied byte for byte under a one-line provenance header. Test files get the
 * import rewrites listed there, recorded per file. A source or test file is patched only by a listed patch, each with
 * its reason, recorded in `vendor.json` and named in the file's provenance line (a test's patches apply after its
 * rewrites). Run it again, pointed at a newer commit, to refresh.
 *
 * The words written into the kit (the provenance line, each README, the comment in `vendor.json`) name this command
 * and `vendor check`. A run at the recorded commit changes no file.
 *
 * @packageDocumentation
 */
import { $RepoCliId } from "@beep/identity/packages"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as Order from "effect/Order"
import * as P from "effect/Predicate"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import * as Str from "effect/String"
import { RepoError } from "../../Cli.errors.ts"
import { Repo } from "../../Repo.service.ts"
import { type Line, out } from "../../Report.schema.ts"
import { entriesOf, objectOf } from "../../Sync.rules.ts"
import {
  allowedOutside,
  entries,
  fcRuns,
  type KitPackage,
  packages,
  sourcePatches,
  testRewrites,
  tests
} from "./VendorSubset.data.ts"

const $I = $RepoCliId.create("commands/Vendor/VendorSync.rules")

/**
 * What `vendor sync` says: each package it wrote, then the commit it copied from.
 *
 * @category schemas
 */
export const VendorSyncFinding = S.TaggedUnion({
  Vendored: {
    name: S.String.pipe(S.annotateKey({ description: "The kit package" })),
    sources: S.Int.pipe(S.annotateKey({ description: "How many source files were copied" })),
    tests: S.Int.pipe(S.annotateKey({ description: "How many tests were copied" }))
  },
  From: { commit: S.String.pipe(S.annotateKey({ description: "The beep-effect commit the files were copied at" })) }
}).pipe(
  $I.annoteSchema("VendorSyncFinding", { description: "A package that was vendored, or the commit it came from" })
)

/**
 * The decoded value of `VendorSyncFinding`.
 *
 * @category models
 */
export type VendorSyncFinding = typeof VendorSyncFinding.Type

/**
 * The line each finding prints.
 *
 * @category rendering
 */
export const vendorSyncSentence: (finding: VendorSyncFinding) => Line = VendorSyncFinding.match({
  Vendored: ({ name, sources, tests: copied }) => out(`${name}: ${sources} source files, ${copied} tests`),
  From: ({ commit }) => out(`from beep-effect ${commit}`)
})

const decoder = new TextDecoder()
const encoder = new TextEncoder()
const pretty = S.encodeEffect(S.fromJsonString(S.Unknown, { space: 2 }))
const fromJson = S.decodeEffect(S.fromJsonString(S.Unknown))

/**
 * The names of the root's `catalog`, read from its package.json's text: the dependencies whose version is written
 * once, there. None when the root has no catalog.
 *
 * @example
 * cataloguedIn('{ "catalog": { "effect": "4.1.5" } }') // ["effect"]
 *
 * @category rules
 */
export const cataloguedIn = (rootPackage: string): ReadonlyArray<string> =>
  O.match(objectOf("catalog")(rootPackage), {
    onNone: () => A.empty<string>(),
    onSome: (block) => A.map(entriesOf(block)(rootPackage), ([name]) => name.value)
  })

/**
 * What a vendored package's package.json asks for a dependency: `catalog:` when the root's catalog names it, so the
 * version stays written once, and otherwise the version given.
 *
 * @example
 * vendoredSpec(["effect"])("effect", "4.1.5") // "catalog:"
 * vendoredSpec(["effect"])("yaml", "^2.9.1") // "^2.9.1"
 *
 * @category rules
 */
export const vendoredSpec =
  (catalogued: ReadonlyArray<string>) =>
  (name: string, version: string): string =>
    A.contains(catalogued, name) ? "catalog:" : version

const stop = (message: string) => RepoError.make({ path: "beep-effect", message })

/** A file of one package, by the package's name and the file's path inside it. */
interface Chosen {
  readonly pkg: string
  readonly file: string
}

const field = (value: unknown, key: string): unknown => (P.hasProperty(value, key) ? value[key] : undefined)
const record = (value: unknown): Record<string, unknown> => (P.isObject(value) ? { ...value } : {})

const importsOf = (text: string): ReadonlyArray<string> =>
  A.map(
    A.fromIterable(Str.matchAll(/(?:^|\n)\s*(?:import|export)\b[^"';]*?\bfrom\s+["']([^"']+)["']/g)(text)),
    (match) => match[1] ?? ""
  )

const byLocale = Order.make<readonly [string, string]>((a, b) => Str.localeCompare(b[0])(a[0]))

/**
 * Vendors the subset from the checkout at `from`, at `commit` (its `HEAD` when none is given).
 *
 * @category rules
 */
export const vendorSync = Effect.fn("VendorSync.vendorSync")(function* (from: string, wanted: O.Option<string>) {
  const repo = yield* Repo
  const git = Effect.fn("VendorSync.git")(function* (...args: ReadonlyArray<string>) {
    const answer = yield* repo.run("git", ["-C", from, ...args])
    if (answer.code !== 0) return yield* stop(`git ${A.join(args, " ")} failed in ${from}: ${Str.trim(answer.stderr)}`)
    return answer
  })
  const head = yield* git(
    "rev-parse",
    O.getOrElse(wanted, () => "HEAD")
  )
  const commit = Str.trim(head.stdout)
  const short = Str.slice(0, 12)(commit)
  const show = (file: string) => Effect.map(git("show", `${commit}:${file}`), (answer) => answer.bytes)
  const posixDir = (file: string) => repo.dirname(file)

  const relativeTo = (testFile: string, target: string): string => {
    const relative = repo.relative(posixDir(testFile), target)
    return Str.startsWith(".")(relative) ? relative : `./${relative}`
  }
  const header = (pkgDir: string, file: string, patched: boolean): string =>
    `// Vendored from beep-effect ${short}:${pkgDir}/${file} (MIT, see LICENSE). ${patched ? "Patched on purpose: the patch and its reason are in vendor.json (patches) and in the patches bun run beep vendor sync applies (sourcePatches). " : ""}Do not edit: bun run beep vendor check compares the rest of this file with its recorded hash.\n`

  // ── Resolution against the upstream export maps ───────────────────────────────────────────────────────────────
  const manifestEntries = yield* Effect.forEach(
    packages,
    (pkg) =>
      show(`${pkg.dir}/package.json`).pipe(
        Effect.flatMap((bytes) => fromJson(decoder.decode(bytes))),
        Effect.mapBoth({
          onFailure: (cause) => stop(`${pkg.dir}/package.json at ${commit} could not be read: ${String(cause)}`),
          onSuccess: (manifest) => [pkg.name, manifest] as const
        })
      ),
    { concurrency: 1 }
  )
  const manifests = R.fromEntries(manifestEntries)
  const byName = R.fromEntries(A.map(packages, (pkg) => [pkg.name, pkg] as const))
  const exportsOf = (pkgName: string): Record<string, unknown> => record(field(manifests[pkgName], "exports"))

  /** The package-relative file an export subpath names, or none (null entries and misses). */
  const resolveSubpath = (pkgName: string, subpath: string): O.Option<string> => {
    const exportsMap = exportsOf(pkgName)
    if (R.has(exportsMap, subpath)) {
      const target = exportsMap[subpath]
      return P.isString(target) ? O.some(repo.normalize(target)) : O.none()
    }
    const best = A.reduce(
      R.toEntries(exportsMap),
      O.none<{ readonly prefix: string; readonly target: O.Option<string> }>(),
      (found, [key, target]) => {
        const starAt = Str.indexOf("*")(key)
        if (O.isNone(starAt)) return found
        const star = starAt.value
        const prefix = Str.slice(0, star)(key)
        const suffix = Str.slice(star + 1)(key)
        if (
          !Str.startsWith(prefix)(subpath) ||
          !Str.endsWith(suffix)(subpath) ||
          subpath.length < prefix.length + suffix.length
        ) {
          return found
        }
        if (O.isSome(found) && found.value.prefix.length >= prefix.length) return found
        const middle = Str.slice(prefix.length, subpath.length - suffix.length)(subpath)
        return O.some({
          prefix,
          target: P.isString(target) ? O.some(repo.normalize(Str.replace("*", middle)(target))) : O.none()
        })
      }
    )
    return O.flatMap(best, (found) => found.target)
  }

  /** The file a `@beep/...` specifier names: none for a package that is not the kit's, a failure for a miss. */
  const resolveSpecifier = (specifier: string): Effect.Effect<O.Option<Chosen>, RepoError> => {
    const match = /^(@beep\/[^/]+)(\/.*)?$/.exec(specifier)
    const pkg = match?.[1]
    if (pkg === undefined || !R.has(byName, pkg)) return Effect.succeedNone
    return O.match(resolveSubpath(pkg, match?.[2] === undefined ? "." : `.${match[2]}`), {
      onNone: () => Effect.fail(stop(`${specifier} is not exported by ${pkg} at ${commit}`)),
      onSome: (file) => Effect.succeedSome({ pkg, file })
    })
  }

  // ── The closure ───────────────────────────────────────────────────────────────────────────────────────────────
  const first = yield* Effect.forEach(entries, resolveSpecifier, { concurrency: 1 })
  let queue: ReadonlyArray<Chosen> = A.getSomes(first)
  let chosen: ReadonlyArray<Chosen> = []
  let outside: ReadonlyArray<string> = []
  const isChosen = (pkg: string, file: string) => A.some(chosen, (one) => one.pkg === pkg && one.file === file)
  while (A.isReadonlyArrayNonEmpty(queue)) {
    const next = A.lastNonEmpty(queue)
    queue = A.initNonEmpty(queue)
    if (isChosen(next.pkg, next.file)) continue
    chosen = A.append(chosen, next)
    const dir = byName[next.pkg]?.dir ?? ""
    const bytes = yield* show(`${dir}/${next.file}`)
    for (const specifier of importsOf(decoder.decode(bytes))) {
      if (Str.startsWith(".")(specifier)) {
        queue = A.append(queue, {
          pkg: next.pkg,
          file: repo.normalize(repo.join(posixDir(next.file), specifier))
        })
      } else if (Str.startsWith("@beep/")(specifier)) {
        const resolved = yield* resolveSpecifier(specifier)
        if (O.isNone(resolved)) outside = A.append(outside, specifier)
        else queue = A.append(queue, resolved.value)
      } else if (!Str.startsWith("effect")(specifier)) outside = A.append(outside, specifier)
    }
  }
  const stray = A.findFirst(A.dedupe(outside), (specifier) => !A.contains(allowedOutside, specifier))
  if (O.isSome(stray)) return yield* stop(`the closure reaches ${stray.value}, which is not vendored`)
  const sourcesOf = (pkgName: string): ReadonlyArray<string> =>
    A.sort(
      A.map(
        A.filter(chosen, (one) => one.pkg === pkgName),
        (one) => one.file
      ),
      Order.String
    )

  // ── Package files written here (not vendored) ─────────────────────────────────────────────────────────────────
  /** Workspace packages a set of files imports, from their import specifiers. */
  const dependenciesOf = Effect.fn("VendorSync.dependenciesOf")(function* (
    pkg: KitPackage,
    files: ReadonlyArray<string>
  ) {
    const texts = yield* Effect.forEach(files, (file) => repo.text(repo.join(repo.root, pkg.dir, file)), {
      concurrency: 1
    })
    const found = A.flatMap(texts, (text) =>
      A.flatMap(importsOf(text), (specifier) => {
        const name = /^(@beep\/[^/]+|type-fest)/.exec(specifier)?.[1]
        return name !== undefined && name !== pkg.name ? A.of(name) : A.empty<string>()
      })
    )
    return A.sort(A.dedupe(found), Order.String)
  })
  // A dependency the root's catalog names is asked for as `catalog:`, as in every other package.json. The versions
  // stay written below, where `version-sync` keeps them: they are what a repository with no catalog is given.
  const rootPackage = yield* repo.text(repo.join(repo.root, "package.json"))
  const asked = vendoredSpec(cataloguedIn(rootPackage))
  const asking = (entries: Record<string, string>) => R.map(entries, (version, name) => asked(name, version))
  const versionOf = (name: string): string => (name === "type-fest" ? "^6.0.3" : "workspace:*")
  const versioned = (names: ReadonlyArray<string>) => A.map(names, (name) => [name, versionOf(name)] as const)

  /** Writes package.json, the tsconfigs, the vitest config, the README and test support; returns the local files. */
  const writePackageFiles = Effect.fn("VendorSync.writePackageFiles")(function* (
    pkg: KitPackage,
    target: string,
    exportsMap: Record<string, string>,
    sources: ReadonlyArray<string>
  ) {
    const upstream = manifests[pkg.name]
    const testFiles = A.map(tests[pkg.name] ?? [], (name) => `test/${name}`)
    const sourceDependencies = yield* dependenciesOf(pkg, sources)
    const dependencies = R.fromEntries(
      A.sort(A.append(versioned(sourceDependencies), ["effect", "4.1.6"] as const), byLocale)
    )
    const testDependencies = yield* dependenciesOf(pkg, testFiles)
    const testTexts = yield* Effect.forEach(testFiles, (file) => repo.text(repo.join(target, file)), { concurrency: 1 })
    const devDependencies = R.fromEntries(
      A.sort(
        A.flatten<ReadonlyArray<ReadonlyArray<readonly [string, string]>>>([
          versioned(A.filter(testDependencies, (name) => !R.has(dependencies, name))),
          [["@effect/vitest", "4.1.6"]],
          A.some(testTexts, Str.includes("@effect/platform-node/")) ? [["@effect/platform-node", "4.1.6"]] : [],
          [["@types/node", "^22.20.7"]],
          [["vitest", "^5.1.2"]]
        ]),
        byLocale
      )
    )
    const packageJson = yield* pretty({
      name: pkg.name,
      version: field(upstream, "version"),
      description: `${String(field(upstream, "description"))}: the subset inventory-import uses, vendored from beep-effect (see vendor.json)`,
      license: "MIT",
      private: true,
      type: "module",
      sideEffects: [],
      beep: field(upstream, "beep"),
      exports: exportsMap,
      scripts: {
        check: "tsrs -p tsconfig.json && tsrs -p tsconfig.test.json",
        test: "vitest run"
      },
      dependencies: asking(dependencies),
      devDependencies: asking(devDependencies)
    }).pipe(Effect.orDie)
    yield* repo.write(repo.join(target, "package.json"), `${packageJson}\n`)
    const base = repo.relative(pkg.dir, "tsconfig.base.json")
    const tsconfig = (include: ReadonlyArray<string>) =>
      pretty({ extends: base, include, compilerOptions: { types: ["node"] } }).pipe(
        Effect.orDie,
        Effect.map((text) => `${text}\n`)
      )
    const srcConfig = yield* tsconfig(["src"])
    const testConfig = yield* tsconfig(["src", "test"])
    yield* repo.write(repo.join(target, "tsconfig.json"), srcConfig)
    yield* repo.write(repo.join(target, "tsconfig.test.json"), testConfig)
    // The repository's test limits (vitest.shared.ts), as every package of its own has them: a kit package's
    // property tests are what timed out on CI's runner under vitest's 5 s.
    const shared = repo.relative(pkg.dir, "vitest.shared.ts")
    yield* repo.write(
      repo.join(target, "vitest.config.ts"),
      `import { defineConfig } from "vitest/config"\nimport { limits } from "${shared}"\n\nexport default defineConfig({ test: { include: ["test/**/*.test.ts"], ...limits } })\n`
    )
    const needsRuns = A.some(testTexts, Str.includes("support/fcRuns.ts"))
    if (needsRuns) yield* repo.write(repo.join(target, "test/support/fcRuns.ts"), fcRuns)
    yield* repo.write(
      repo.join(target, "README.md"),
      `# ${pkg.name} (vendored subset)

The part of beep-effect's \`${pkg.name}\` that inventory-import's format packages use, copied from beep-effect commit
\`${short}\` (\`${pkg.dir}\`). beep-effect publishes none of its kit packages, so the subset lives
here under the same name and the same export subpaths, and is replaced by the published package when one exists.

- **Do not edit** \`src/\` or the copied tests. Change the code in beep-effect and run
  \`bun run beep vendor sync --from <beep-effect checkout>\` again.
- \`vendor.json\` records the commit and, for every copied file, the SHA-256 of the upstream file and of the copy (each
  copy starts with one provenance line, which the hash leaves out). \`bun run vendor:check\` fails when they differ.
- Copied tests have their imports of beep-effect's test runner and run-count helper rewritten (each rewrite is listed
  in \`vendor.json\`); \`test/support/fcRuns.ts\`, when present, stands in for the run-count helper.
- A source file, or a copied test beyond its rewrites, differs from upstream only by a patch
  \`bun run beep vendor sync\` applies (\`sourcePatches\`), recorded with its reason under \`patches\` in
  \`vendor.json\` and named in the file's first line.
- Licensed under MIT, as the package's own LICENSE file in beep-effect says (\`LICENSE\`, copied unchanged).
`
    )
    return needsRuns ? A.of("test/support/fcRuns.ts") : A.empty<string>()
  })

  // ── Writing ───────────────────────────────────────────────────────────────────────────────────────────────────
  const vendorPackage = Effect.fn("VendorSync.vendorPackage")(function* (pkg: KitPackage) {
    const target = repo.join(repo.root, pkg.dir)
    yield* repo.remove(repo.join(target, "src"))
    yield* repo.remove(repo.join(target, "test"))
    const sources = sourcesOf(pkg.name)
    const sourceEntries = yield* Effect.forEach(
      sources,
      Effect.fnUntraced(function* (file) {
        const source = yield* show(`${pkg.dir}/${file}`)
        const patches = A.filter(sourcePatches, (patch) => patch.pkg === pkg.name && patch.file === file)
        const original = decoder.decode(source)
        const gone = A.findFirst(patches, (patch) => !Str.includes(patch.from)(original))
        if (O.isSome(gone)) {
          return yield* stop(
            `${pkg.name} ${file}: the text a patch replaces is gone upstream; remove or update the patch`
          )
        }
        // The patches apply in order, each to the text the one before it left.
        const text = A.reduce(patches, original, (so, patch) => Str.replace(patch.from, patch.to)(so))
        const body = encoder.encode(text)
        const lead = encoder.encode(header(pkg.dir, file, A.isReadonlyArrayNonEmpty(patches)))
        const whole = new Uint8Array(lead.length + body.length)
        whole.set(lead, 0)
        whole.set(body, lead.length)
        yield* repo.writeBytes(repo.join(target, file), whole)
        const sourceSha256 = yield* repo.sha256(source)
        const sha256 = yield* repo.sha256(body)
        const applied = A.map(patches, (patch) => ({ change: `${patch.from} -> ${patch.to}`, reason: patch.reason }))
        return {
          path: file,
          sourceSha256,
          sha256,
          rewrites: A.empty<string>(),
          ...(A.isReadonlyArrayNonEmpty(applied) ? { patches: applied } : {})
        }
      }),
      { concurrency: 1 }
    )
    const testEntries = yield* Effect.forEach(
      tests[pkg.name] ?? [],
      Effect.fnUntraced(function* (name) {
        const file = `test/${name}`
        const source = yield* show(`${pkg.dir}/${file}`)
        const rewritten = A.reduce(
          testRewrites,
          { body: decoder.decode(source), rewrites: A.empty<string>() },
          (so, rewrite) => {
            const escaped = Str.replace(/[/.]/g, "\\$&")(rewrite.specifier)
            if (!new RegExp(`(["'])${escaped}\\1`).test(so.body)) return so
            const replacement = "file" in rewrite.to ? relativeTo(file, rewrite.to.file) : rewrite.to.specifier
            return {
              body: Str.replace(new RegExp(`(["'])${escaped}\\1`, "g"), `"${replacement}"`)(so.body),
              rewrites: A.append(so.rewrites, `${rewrite.specifier} -> ${replacement}`)
            }
          }
        )
        const reached = yield* Effect.forEach(
          A.filter(importsOf(rewritten.body), Str.startsWith("@beep/")),
          (specifier) => Effect.map(resolveSpecifier(specifier), (resolved) => [specifier, resolved] as const),
          { concurrency: 1 }
        )
        const beyond = A.findFirst(reached, ([, resolved]) => !O.exists(resolved, (one) => isChosen(one.pkg, one.file)))
        if (O.isSome(beyond)) {
          return yield* stop(`${pkg.name} ${file} imports ${beyond.value[0]}, which is outside the vendored subset`)
        }
        // A test's patches apply to the text its rewrites left, in order, as a source file's do.
        const patches = A.filter(sourcePatches, (patch) => patch.pkg === pkg.name && patch.file === file)
        const gone = A.findFirst(patches, (patch) => !Str.includes(patch.from)(rewritten.body))
        if (O.isSome(gone)) {
          return yield* stop(
            `${pkg.name} ${file}: the text a patch replaces is gone upstream; remove or update the patch`
          )
        }
        const body = A.reduce(patches, rewritten.body, (so, patch) => Str.replace(patch.from, patch.to)(so))
        yield* repo.write(repo.join(target, file), header(pkg.dir, file, A.isReadonlyArrayNonEmpty(patches)) + body)
        const sourceSha256 = yield* repo.sha256(source)
        const sha256 = yield* repo.sha256(encoder.encode(body))
        const applied = A.map(patches, (patch) => ({ change: `${patch.from} -> ${patch.to}`, reason: patch.reason }))
        return {
          path: file,
          sourceSha256,
          sha256,
          rewrites: rewritten.rewrites,
          ...(A.isReadonlyArrayNonEmpty(applied) ? { patches: applied } : {})
        }
      }),
      { concurrency: 1 }
    )
    const license = yield* show(`${pkg.dir}/LICENSE`)
    yield* repo.writeBytes(repo.join(target, "LICENSE"), license)

    // The upstream subpath of every vendored module that has one; a module without one is internal.
    const candidates = A.sort(
      A.dedupe(
        A.flatten([
          A.of("."),
          R.keys(exportsOf(pkg.name)),
          A.flatMap(sources, (file) => {
            const stem = Str.replace(/\.ts$/, "")(Str.replace(/^src\//, "")(file))
            return Str.endsWith("/index")(stem)
              ? [`./${stem}`, `./${Str.slice(0, stem.length - "/index".length)(stem)}`]
              : [`./${stem}`]
          })
        ])
      ),
      Order.String
    )
    const exportsMap = R.fromEntries(
      A.prepend(
        A.flatMap(candidates, (subpath) => {
          if (subpath === "./package.json" || Str.includes("*")(subpath) || Str.includes("/internal")(subpath)) {
            return A.empty<readonly [string, string]>()
          }
          return O.match(resolveSubpath(pkg.name, subpath), {
            onNone: () => A.empty<readonly [string, string]>(),
            onSome: (file) => (isChosen(pkg.name, file) ? A.of([subpath, `./${file}`] as const) : [])
          })
        }),
        ["./package.json", "./package.json"] as const
      )
    )
    const local = yield* writePackageFiles(pkg, target, exportsMap, sources)
    const manifest = yield* pretty({
      $comment:
        "Written by bun run beep vendor sync; checked by bun run beep vendor check. sha256 is of each file without its first (provenance) line; it equals sourceSha256 unless the file lists rewrites (tests) or patches (deliberate source patches, each with its reason, against source.commit). local files are written here, not copied.",
      source: { repository: "beep-effect", commit, path: pkg.dir, license: "MIT" },
      exports: exportsMap,
      files: A.appendAll<unknown, unknown>(sourceEntries, testEntries),
      local
    }).pipe(Effect.orDie)
    yield* repo.write(repo.join(target, "vendor.json"), `${manifest}\n`)
    return VendorSyncFinding.cases.Vendored.make({
      name: pkg.name,
      sources: sources.length,
      tests: (tests[pkg.name] ?? []).length
    }) satisfies VendorSyncFinding
  })
  const written: ReadonlyArray<VendorSyncFinding> = yield* Effect.forEach(packages, vendorPackage, { concurrency: 1 })
  return A.append<VendorSyncFinding, VendorSyncFinding>(written, VendorSyncFinding.cases.From.make({ commit }))
})
