// Copies the used subset of beep-effect's private kit packages (@beep/types, @beep/identity, @beep/schema,
// @beep/utils) into packages/foundation/, from one beep-effect commit, and records every file's source hash in the
// package's vendor.json. scripts/vendor-check.mjs then fails whenever a vendored file stops matching its source.
//
// The subset is computed, not hand-listed: the import closure of ENTRIES below (what the format packages use), plus
// the tests named in TESTS. Source files are copied byte for byte under a one-line provenance header. Test files get
// the import rewrites in TEST_REWRITES (beep-effect's test runner and run-count packages are not vendored), recorded
// per file. A source file is patched only by SOURCE_PATCHES, each with its reason, recorded in vendor.json and named
// in the file's provenance line. Run it again, pointed at a newer commit, to refresh:
//
//   node scripts/vendor-beep.mjs --from <beep-effect checkout> [--commit <sha>]
import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import fs from "node:fs"
import path from "node:path"

const repoRoot = path.resolve(import.meta.dirname, "..")

const argValue = (name) => {
  const at = process.argv.indexOf(name)
  return at === -1 ? undefined : process.argv[at + 1]
}
const from = argValue("--from")
if (from === undefined) {
  console.error("usage: node scripts/vendor-beep.mjs --from <beep-effect checkout> [--commit <sha>]")
  process.exit(2)
}
const git = (...args) => execFileSync("git", ["-C", from, ...args], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })
const commit = git("rev-parse", argValue("--commit") ?? "HEAD").trim()
const show = (file) => execFileSync("git", ["-C", from, "show", `${commit}:${file}`], { maxBuffer: 64 * 1024 * 1024 })
const listTree = (dir) =>
  git("ls-tree", "-r", "--name-only", commit, dir)
    .split("\n")
    .filter((line) => line !== "")

/** The four packages, where they live upstream and here (the same path), and what is taken from each. */
const PACKAGES = [
  { name: "@beep/types", dir: "packages/foundation/primitive/types" },
  { name: "@beep/identity", dir: "packages/foundation/modeling/identity" },
  { name: "@beep/schema", dir: "packages/foundation/modeling/schema" },
  { name: "@beep/utils", dir: "packages/foundation/modeling/utils" }
]

/** What the format packages import. Everything these reach is vendored, nothing else. */
const ENTRIES = [
  "@beep/identity/packages",
  "@beep/schema/LiteralKit",
  "@beep/schema/SchemaUtils/index",
  "@beep/schema/SchemaUtils/defectDiagnostics",
  "@beep/schema/SchemaUtils/optionalDefect",
  "@beep/utils/Schema"
]

/** Upstream tests copied with their package, per package, by file name under test/. */
const TESTS = {
  "@beep/types": ["TString.test.ts"],
  "@beep/identity": [
    "AnnoteError.test.ts",
    "Curie.test.ts",
    "Fibered.test.ts",
    "Identity.test.ts",
    "IdentityRegistry.test.ts",
    "IriBinding.test.ts",
    "OntologyEntrypoints.test.ts",
    "PnLocal.test.ts",
    "SchemaStatics.test.ts",
    "TaggedError.equivalence.test.ts",
    "TemplateGuards.test.ts",
    "Vocab.test.ts",
    "shape-stable.test.ts"
  ],
  "@beep/schema": [
    "LiteralKit.test.ts",
    "collectAnnotationsAt.test.ts",
    "withKeyDefaults.test.ts",
    "SchemaUtils/defectDiagnostics.test.ts",
    "SchemaUtils/optionalDefect.test.ts"
  ],
  "@beep/utils": [
    "Array.test.ts",
    "DrainableWorker.test.ts",
    "Errors.test.ts",
    "FileSystem.test.ts",
    "FormatHelpers.test.ts",
    "HostProcess.test.ts",
    "Number.test.ts",
    "Option.test.ts",
    "Path.test.ts",
    "Predicate.test.ts",
    "Schema.test.ts",
    "SchemaParity.test.ts",
    "Str.test.ts",
    "Struct.test.ts",
    "TaggedError.equivalence.test.ts"
  ]
}

/**
 * Import rewrites applied to copied tests only. beep-effect's instrumented runner (`@beep/test-runner`) and run-count
 * helper (`@beep/fc-runs`) are not vendored: the runner's `it` is a drop-in for `@effect/vitest`'s, and the run count
 * comes from test/support/fcRuns.ts. Internal modules are imported by relative path, never through an export.
 * Each entry: the specifier, and the replacement (a function of the test file's package-relative path).
 */
const relativeTo = (testFile, target) => {
  const rel = path.posix.relative(path.posix.dirname(testFile), target)
  return rel.startsWith(".") ? rel : `./${rel}`
}
const TEST_REWRITES = [
  ["@beep/test-runner", () => "@effect/vitest"],
  ["@beep/fc-runs/FastCheckRuns", (file) => relativeTo(file, "test/support/fcRuns.ts")],
  ["@beep/fc-runs", (file) => relativeTo(file, "test/support/fcRuns.ts")],
  ["@beep/identity/internal/schemaStatics", (file) => relativeTo(file, "src/internal/schemaStatics.ts")],
  [
    "@beep/schema/SchemaUtils/internal/staticDescriptors",
    (file) => relativeTo(file, "src/SchemaUtils/internal/staticDescriptors.ts")
  ]
]

/**
 * Deliberate, minimal patches to vendored source files, each with the reason it exists and what would make it
 * unnecessary upstream. A patch replaces exact text; a refresh fails when the text is gone, so a patch that upstream
 * has made unnecessary is noticed and removed. The import closure (which files are vendored) is computed from the
 * unpatched upstream files, so a patch never changes the vendored subset.
 */
const SOURCE_PATCHES = [
  {
    pkg: "@beep/schema",
    file: "src/LiteralKit/LiteralKit.schema.ts",
    from: 'import { A } from "@beep/utils";',
    to: 'import * as A from "@beep/utils/Array";',
    reason:
      "The @beep/utils root re-exports modules that name Node types (FileSystem, Path, NodeUrl), and Node's URL type clashes with the Workers one, so a Worker that imports LiteralKit failed to type-check. The subpath holds the same module. Unnecessary once beep-effect's LiteralKit imports @beep/utils/Array itself."
  },
  {
    pkg: "@beep/schema",
    file: "src/LiteralKit/internal/builders.ts",
    from: 'import { A, R } from "@beep/utils";',
    to: 'import * as A from "@beep/utils/Array";\nimport * as R from "@beep/utils/Record";',
    reason:
      "As LiteralKit.schema.ts: the @beep/utils root brings Node types into a Worker's type-check. Unnecessary once beep-effect's builders.ts imports @beep/utils/Array and @beep/utils/Record itself."
  }
]

/** The source file's text with its patches applied, and the record of each. */
const patchSource = (pkgName, file, body) => {
  let text = body.toString()
  const applied = []
  for (const patch of SOURCE_PATCHES) {
    if (patch.pkg !== pkgName || patch.file !== file) continue
    if (!text.includes(patch.from)) {
      throw new Error(`${pkgName} ${file}: the text a patch replaces is gone upstream; remove or update the patch`)
    }
    text = text.replace(patch.from, patch.to)
    applied.push({ change: `${patch.from} -> ${patch.to}`, reason: patch.reason })
  }
  return { body: Buffer.from(text), patches: applied }
}

const LICENSE_FILE = "LICENSE"
const header = (pkgDir, file, patched = false) =>
  `// Vendored from beep-effect ${commit.slice(0, 12)}:${pkgDir}/${file} (MIT, see LICENSE). ${patched ? "Patched on purpose: the patch and its reason are in vendor.json (patches) and scripts/vendor-beep.mjs (SOURCE_PATCHES). " : ""}Do not edit: scripts/vendor-check.mjs compares the rest of this file with its recorded hash.\n`

const sha256 = (data) => createHash("sha256").update(data).digest("hex")

// ── Resolution against the upstream export maps ─────────────────────────────────────────────────────────────────────
const manifests = new Map(PACKAGES.map((p) => [p.name, JSON.parse(show(`${p.dir}/package.json`).toString())]))
const byName = new Map(PACKAGES.map((p) => [p.name, p]))

/** The package-relative file an export subpath names, or undefined (null entries and misses). */
const resolveSubpath = (pkgName, subpath) => {
  const exportsMap = manifests.get(pkgName).exports
  if (Object.hasOwn(exportsMap, subpath)) {
    const target = exportsMap[subpath]
    return typeof target === "string" ? path.posix.normalize(target) : undefined
  }
  let best
  for (const [key, target] of Object.entries(exportsMap)) {
    const star = key.indexOf("*")
    if (star === -1) continue
    const prefix = key.slice(0, star)
    const suffix = key.slice(star + 1)
    if (!subpath.startsWith(prefix) || !subpath.endsWith(suffix) || subpath.length < prefix.length + suffix.length)
      continue
    if (best !== undefined && best.prefix.length >= prefix.length) continue
    const middle = subpath.slice(prefix.length, subpath.length - suffix.length)
    best = {
      prefix,
      target: typeof target === "string" ? path.posix.normalize(target.replace("*", middle)) : undefined
    }
  }
  return best?.target
}

const resolveSpecifier = (specifier) => {
  const match = /^(@beep\/[^/]+)(\/.*)?$/.exec(specifier)
  if (match === null || !byName.has(match[1])) return undefined
  const file = resolveSubpath(match[1], match[2] === undefined ? "." : `.${match[2]}`)
  if (file === undefined) throw new Error(`${specifier} is not exported by ${match[1]} at ${commit}`)
  return { pkg: match[1], file }
}

const importsOf = (text) =>
  [...text.matchAll(/(?:^|\n)\s*(?:import|export)\b[^"';]*?\bfrom\s+["']([^"']+)["']/g)].map((m) => m[1])

// ── The closure ──────────────────────────────────────────────────────────────────────────────────────────────────────
/** pkgName -> Set of package-relative source files */
const chosen = new Map(PACKAGES.map((p) => [p.name, new Set()]))
const outside = new Set()
const queue = ENTRIES.map(resolveSpecifier)
while (queue.length > 0) {
  const next = queue.pop()
  const files = chosen.get(next.pkg)
  if (files.has(next.file)) continue
  files.add(next.file)
  const text = show(`${byName.get(next.pkg).dir}/${next.file}`).toString()
  for (const specifier of importsOf(text)) {
    if (specifier.startsWith(".")) {
      queue.push({
        pkg: next.pkg,
        file: path.posix.normalize(path.posix.join(path.posix.dirname(next.file), specifier))
      })
    } else if (specifier.startsWith("@beep/")) {
      const resolved = resolveSpecifier(specifier)
      if (resolved === undefined) outside.add(specifier)
      else queue.push(resolved)
    } else if (!specifier.startsWith("effect")) outside.add(specifier)
  }
}
const allowedOutside = new Set(["type-fest"])
for (const specifier of outside) {
  if (!allowedOutside.has(specifier)) throw new Error(`the closure reaches ${specifier}, which is not vendored`)
}

// ── Package files written here (not vendored) ───────────────────────────────────────────────────────────────────────
/** Workspace packages a set of files imports, from their import specifiers. */
const dependenciesOf = (pkg, files) => {
  const found = new Set()
  for (const file of files) {
    for (const specifier of importsOf(fs.readFileSync(path.join(repoRoot, pkg.dir, file), "utf8"))) {
      const match = /^(@beep\/[^/]+|type-fest)/.exec(specifier)
      if (match !== null && match[1] !== pkg.name) found.add(match[1])
    }
  }
  return [...found].sort()
}
const versionOf = (name) => (name === "type-fest" ? "^6.0.1" : "workspace:*")

const FC_RUNS = `// Stands in for beep-effect's @beep/fc-runs in the vendored tests: a fixed property-test run count.
import type * as Arbitrary from "effect/Arbitrary"

export const DEFAULT_FC_NUM_RUNS = 100

export const fcRuns = (inline?: number): Arbitrary.CheckOptions & { readonly runs: number } => ({
  runs: inline ?? DEFAULT_FC_NUM_RUNS
})
`

/** Writes package.json, the tsconfigs, the vitest config, the README and test support; returns the local files. */
const writePackageFiles = (pkg, target, exportsMap, sources) => {
  const local = []
  const upstream = manifests.get(pkg.name)
  const tests = TESTS[pkg.name].map((name) => `test/${name}`)
  const dependencies = Object.fromEntries(
    [...dependenciesOf(pkg, sources).map((name) => [name, versionOf(name)]), ["effect", "4.1.4"]].sort(([a], [b]) =>
      a.localeCompare(b)
    )
  )
  const devDependencies = Object.fromEntries(
    [
      ...dependenciesOf(pkg, tests)
        .filter((name) => !Object.hasOwn(dependencies, name))
        .map((name) => [name, versionOf(name)]),
      ["@effect/vitest", "4.1.4"],
      ...(tests.some((file) => fs.readFileSync(path.join(target, file), "utf8").includes("@effect/platform-node/"))
        ? [["@effect/platform-node", "4.1.4"]]
        : []),
      ["@types/node", "^24.19.2"],
      ["vitest", "^5.1.0"]
    ].sort(([a], [b]) => a.localeCompare(b))
  )
  const packageJson = {
    name: pkg.name,
    version: upstream.version,
    description: `${upstream.description}: the subset inventory-import uses, vendored from beep-effect (see vendor.json)`,
    license: "MIT",
    private: true,
    type: "module",
    sideEffects: [],
    beep: upstream.beep,
    exports: exportsMap,
    scripts: {
      check: "tsrs -p tsconfig.json && tsrs -p tsconfig.test.json",
      test: "vitest run"
    },
    dependencies,
    devDependencies
  }
  fs.writeFileSync(path.join(target, "package.json"), `${JSON.stringify(packageJson, null, 2)}\n`)
  const base = path.posix.relative(pkg.dir, "tsconfig.base.json")
  const tsconfig = (include) =>
    `${JSON.stringify({ extends: base, include, compilerOptions: { types: ["node"] } }, null, 2)}\n`
  fs.writeFileSync(path.join(target, "tsconfig.json"), tsconfig(["src"]))
  fs.writeFileSync(path.join(target, "tsconfig.test.json"), tsconfig(["src", "test"]))
  fs.writeFileSync(
    path.join(target, "vitest.config.ts"),
    `import { defineConfig } from "vitest/config"\n\nexport default defineConfig({ test: { include: ["test/**/*.test.ts"] } })\n`
  )
  if (tests.some((file) => fs.readFileSync(path.join(target, file), "utf8").includes("support/fcRuns.ts"))) {
    fs.mkdirSync(path.join(target, "test/support"), { recursive: true })
    fs.writeFileSync(path.join(target, "test/support/fcRuns.ts"), FC_RUNS)
    local.push("test/support/fcRuns.ts")
  }
  fs.writeFileSync(
    path.join(target, "README.md"),
    `# ${pkg.name} (vendored subset)

The part of beep-effect's \`${pkg.name}\` that inventory-import's format packages use, copied from beep-effect commit
\`${commit.slice(0, 12)}\` (\`${pkg.dir}\`). beep-effect publishes none of its kit packages, so the subset lives
here under the same name and the same export subpaths, and is replaced by the published package when one exists.

- **Do not edit** \`src/\` or the copied tests. Change the code in beep-effect and run
  \`node scripts/vendor-beep.mjs --from <beep-effect checkout>\` again.
- \`vendor.json\` records the commit and, for every copied file, the SHA-256 of the upstream file and of the copy (each
  copy starts with one provenance line, which the hash leaves out). \`bun run vendor:check\` fails when they differ.
- Copied tests have their imports of beep-effect's test runner and run-count helper rewritten (each rewrite is listed
  in \`vendor.json\`); \`test/support/fcRuns.ts\`, when present, stands in for the run-count helper.
- A source file differs from upstream only by a patch in \`SOURCE_PATCHES\` (scripts/vendor-beep.mjs), recorded with
  its reason under \`patches\` in \`vendor.json\` and named in the file's first line.
- Licensed under MIT, as the package's own LICENSE file in beep-effect says (\`LICENSE\`, copied unchanged).
`
  )
  return local
}

// ── Writing ──────────────────────────────────────────────────────────────────────────────────────────────────────────
for (const pkg of PACKAGES) {
  const target = path.join(repoRoot, pkg.dir)
  for (const sub of ["src", "test"]) fs.rmSync(path.join(target, sub), { recursive: true, force: true })
  fs.mkdirSync(target, { recursive: true })
  const entries = []
  const sources = [...chosen.get(pkg.name)].sort()
  for (const file of sources) {
    const source = show(`${pkg.dir}/${file}`)
    const { body, patches } = patchSource(pkg.name, file, source)
    fs.mkdirSync(path.dirname(path.join(target, file)), { recursive: true })
    fs.writeFileSync(
      path.join(target, file),
      Buffer.concat([Buffer.from(header(pkg.dir, file, patches.length > 0)), body])
    )
    entries.push({
      path: file,
      sourceSha256: sha256(source),
      sha256: sha256(body),
      rewrites: [],
      ...(patches.length === 0 ? {} : { patches })
    })
  }
  for (const name of TESTS[pkg.name]) {
    const file = `test/${name}`
    const source = show(`${pkg.dir}/${file}`)
    let body = source.toString()
    const rewrites = []
    for (const [specifier, replace] of TEST_REWRITES) {
      const quoted = new RegExp(`(["'])${specifier.replace(/[/.]/g, "\\$&")}\\1`, "g")
      if (!quoted.test(body)) continue
      const replacement = replace(file)
      body = body.replace(quoted, `"${replacement}"`)
      rewrites.push(`${specifier} -> ${replacement}`)
    }
    for (const specifier of importsOf(body)) {
      if (!specifier.startsWith("@beep/")) continue
      const resolved = resolveSpecifier(specifier)
      if (resolved === undefined || !chosen.get(resolved.pkg).has(resolved.file)) {
        throw new Error(`${pkg.name} ${file} imports ${specifier}, which is outside the vendored subset`)
      }
    }
    fs.mkdirSync(path.dirname(path.join(target, file)), { recursive: true })
    fs.writeFileSync(path.join(target, file), header(pkg.dir, file) + body)
    entries.push({ path: file, sourceSha256: sha256(source), sha256: sha256(body), rewrites })
  }
  fs.writeFileSync(path.join(target, LICENSE_FILE), show(`${pkg.dir}/LICENSE`))

  // The upstream subpath of every vendored module that has one; a module without one is internal.
  const exportsMap = { "./package.json": "./package.json" }
  const candidates = new Set([".", ...Object.keys(manifests.get(pkg.name).exports)])
  for (const file of sources) {
    const stem = file.replace(/^src\//, "").replace(/\.ts$/, "")
    candidates.add(`./${stem}`)
    if (stem.endsWith("/index")) candidates.add(`./${stem.slice(0, -"/index".length)}`)
  }
  for (const subpath of [...candidates].sort()) {
    if (subpath === "./package.json" || subpath.includes("*") || subpath.includes("/internal")) continue
    const file = resolveSubpath(pkg.name, subpath)
    if (file !== undefined && chosen.get(pkg.name).has(file)) exportsMap[subpath] = `./${file}`
  }

  const manifest = {
    $comment:
      "Written by scripts/vendor-beep.mjs; checked by scripts/vendor-check.mjs. sha256 is of each file without its first (provenance) line; it equals sourceSha256 unless the file lists rewrites (tests) or patches (deliberate source patches, each with its reason, against source.commit). local files are written here, not copied.",
    source: { repository: "beep-effect", commit, path: pkg.dir, license: "MIT" },
    exports: exportsMap,
    files: entries,
    local: writePackageFiles(pkg, target, exportsMap, sources)
  }
  fs.writeFileSync(path.join(target, "vendor.json"), `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(`${pkg.name}: ${sources.length} source files, ${TESTS[pkg.name].length} tests`)
}
console.log(`from beep-effect ${commit}`)
