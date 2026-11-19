// A design-system package's exact exports, held to account (decision "ui-packages brief", (b)). Run from the
// package's folder. Every file under src/components and src/hooks has exactly one export entry, and every entry names
// a file that exists, so a component the shadcn CLI adds cannot be forgotten and no entry points at nothing. Exports
// are exact everywhere in this repository: no wildcard.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"

const root = process.cwd()
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"))
const exports = pkg.exports ?? {}
const problems = []

for (const [key, target] of Object.entries(exports)) {
  if (key.includes("*") || String(target).includes("*")) problems.push(`${key}: a wildcard export`)
  else if (typeof target !== "string" || !existsSync(join(root, target))) problems.push(`${key}: names no file`)
}

const files = (dir) =>
  existsSync(dir)
    ? readdirSync(dir).flatMap((name) => {
        const path = join(dir, name)
        return statSync(path).isDirectory() ? files(path) : [path]
      })
    : []
const targets = new Set(Object.values(exports).map((target) => join(root, String(target))))
for (const folder of ["src/components", "src/hooks"]) {
  for (const file of files(join(root, folder))) {
    if (!targets.has(file)) problems.push(`${relative(root, file)}: no export entry`)
  }
}

if (problems.length > 0) {
  console.error(`check-exports FAIL  ${pkg.name}\n  ${problems.join("\n  ")}`)
  process.exitCode = 1
} else {
  console.log(`check-exports OK  ${pkg.name}: ${Object.keys(exports).length} exact entries`)
}
