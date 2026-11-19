// The stage C ceilings of every package with screens add up to at most the number recorded when the exception was
// split between them (decision "ui-packages brief", (d)): 678. Each package's own check keeps its ceiling equal to its
// count, so the sum only falls; this keeps a package from raising its own while another's falls.
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { dirname, join, relative } from "node:path"
import { fileURLToPath } from "node:url"

const repo = dirname(dirname(fileURLToPath(import.meta.url)))
const cap = 678
const found = []
const walk = (dir, depth) => {
  if (depth > 3) return
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === "node_modules" || entry.name.startsWith(".")) continue
    const path = join(dir, entry.name)
    if (existsSync(join(path, "strict-ceiling.json"))) found.push(join(path, "strict-ceiling.json"))
    walk(path, depth + 1)
  }
}
walk(join(repo, "apps"), 0)
walk(join(repo, "packages"), 0)
const rows = found.map((file) => [relative(repo, dirname(file)), JSON.parse(readFileSync(file, "utf8")).ceiling])
const sum = rows.reduce((total, [, ceiling]) => total + ceiling, 0)
for (const [where, ceiling] of rows) console.log(`  ${where}: ${ceiling}`)
console.log(`ceilings:check  sum ${sum}, cap ${cap}`)
if (sum > cap) {
  console.error(`ceilings:check FAIL  the stage C ceilings add up to ${sum}, above ${cap}`)
  process.exitCode = 1
}
