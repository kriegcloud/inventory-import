// Which package may import which (BRIEF-contexts.md, "The dependency direction"), held to account. bun hoists one
// node_modules, so an import of a workspace package the importer never declared still resolves; this check reads
// every workspace's package.json (`beep.family`, and for a context package `beep.context` and `beep.layer`) and every
// import specifier under its src and test, and fails on:
//   - a workspace package imported but not declared in dependencies, devDependencies or peerDependencies;
//   - a declared or imported workspace package the importer's row does not allow;
//   - a path into apps/ from a package.
// Third-party packages are not this check's business.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { dirname, join, relative } from "node:path"
import { fileURLToPath } from "node:url"

const repo = dirname(dirname(fileURLToPath(import.meta.url)))

const workspaces = []
const walk = (dir, depth) => {
  if (depth > 4) return
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === "node_modules" || entry.name.startsWith(".")) continue
    const path = join(dir, entry.name)
    if (existsSync(join(path, "package.json"))) {
      const pkg = JSON.parse(readFileSync(join(path, "package.json"), "utf8"))
      workspaces.push({ dir: path, pkg })
    } else walk(path, depth + 1)
  }
}
walk(join(repo, "apps"), 0)
walk(join(repo, "packages"), 0)
const byName = new Map(workspaces.map((w) => [w.pkg.name, w]))

/** What a workspace is, for the table: its family, and for a context package its context and layer. */
const kindOf = (w) => {
  const beep = w.pkg.beep ?? {}
  if (w.dir.includes(`${"/"}apps${"/"}`)) return { family: "app" }
  return { family: beep.family ?? "unknown", context: beep.context, layer: beep.layer }
}

/** Whether `from` may depend on `to`. */
const allowed = (from, to) => {
  const a = kindOf(from)
  const b = kindOf(to)
  if (a.family === "app") return true
  if (b.family === "app") return false
  if (b.family === "foundation") return true
  switch (a.family) {
    case "foundation":
      return false
    case "drivers":
      return b.family === "drivers"
    case "kernel":
      return false
    case "ui-system":
      return b.family === "ui-system"
    case "web-kit":
      return b.family === "kernel"
    case "context": {
      const own = a.context === b.context
      if (b.family === "kernel") return true
      if (a.layer === "contract") return false
      if (a.layer === "model") return own && b.layer === "contract"
      if (a.layer === "host")
        return (
          (own && (b.layer === "model" || b.layer === "contract")) || b.layer === "contract" || b.family === "drivers"
        )
      if (a.layer === "web")
        return (
          (own && (b.layer === "contract" || b.layer === "model")) || b.family === "ui-system" || b.family === "web-kit"
        )
      return false
    }
    default:
      return false
  }
}

const specifiers =
  /(?:import|export)\s[^"'`;]*?from\s*["']([^"']+)["']|import\s*["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g
const files = (dir) =>
  existsSync(dir)
    ? readdirSync(dir).flatMap((name) => {
        const path = join(dir, name)
        if (name === "node_modules") return []
        return statSync(path).isDirectory() ? files(path) : /\.(m?ts|tsx)$/.test(name) ? [path] : []
      })
    : []

const problems = []
for (const w of workspaces) {
  const declared = new Set(
    Object.keys({ ...w.pkg.dependencies, ...w.pkg.devDependencies, ...w.pkg.peerDependencies }).filter((name) =>
      byName.has(name)
    )
  )
  for (const name of declared) {
    if (!allowed(w, byName.get(name))) problems.push(`${w.pkg.name} declares ${name}, which its layer may not use`)
  }
  for (const file of [...files(join(w.dir, "src")), ...files(join(w.dir, "test"))]) {
    const text = readFileSync(file, "utf8")
    for (const match of text.matchAll(specifiers)) {
      const spec = match[1] ?? match[2] ?? match[3] ?? ""
      const where = relative(repo, file)
      if (kindOf(w).family !== "app" && spec.startsWith(".") && spec.includes("apps/")) {
        problems.push(`${where} imports "${spec}": a package never reaches into apps/`)
        continue
      }
      const name = spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0]
      if (!byName.has(name) || name === w.pkg.name) continue
      if (!declared.has(name)) problems.push(`${where} imports ${name}, which ${w.pkg.name} does not declare`)
      else if (!allowed(w, byName.get(name))) problems.push(`${where} imports ${name}, which its layer may not use`)
    }
  }
}

if (problems.length > 0) {
  console.error(`check-boundaries FAIL\n  ${[...new Set(problems)].join("\n  ")}`)
  process.exitCode = 1
} else {
  console.log(`check-boundaries OK  ${workspaces.length} workspaces`)
}
