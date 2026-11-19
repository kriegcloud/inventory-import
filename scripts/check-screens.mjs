// Every package with screens the app mounts must be in the two lists Tailwind reads class names from, or the classes
// only its screens use are missing from the stylesheet and nothing else fails: every text is right and the layout is
// wrong. The two lists are the `@source` lines of apps/inventory/src/web/index.css (development) and `screenPackages`
// in apps/inventory/vite.config.ts (the production build narrows the sources to the files the entry reaches in them).
// A package has screens when it has a .tsx file under src; it is the app's when the app declares it.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { dirname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const repo = dirname(dirname(fileURLToPath(import.meta.url)))
const app = join(repo, "apps", "inventory")
const css = join(app, "src", "web", "index.css")
const vite = join(app, "vite.config.ts")

const hasTsx = (dir) =>
  existsSync(dir) &&
  readdirSync(dir).some((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? hasTsx(path) : name.endsWith(".tsx")
  })

const workspaces = []
const walk = (dir, depth) => {
  if (depth > 4) return
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === "node_modules" || entry.name.startsWith(".")) continue
    const path = join(dir, entry.name)
    if (existsSync(join(path, "package.json"))) {
      workspaces.push({ dir: path, name: JSON.parse(readFileSync(join(path, "package.json"), "utf8")).name })
    } else walk(path, depth + 1)
  }
}
walk(join(repo, "packages"), 0)

const appPackage = JSON.parse(readFileSync(join(app, "package.json"), "utf8"))
const declared = new Set(Object.keys({ ...appPackage.dependencies, ...appPackage.devDependencies }))
const screens = workspaces.filter((w) => declared.has(w.name) && hasTsx(join(w.dir, "src")))

// `@source "../../../../packages/x/src";` lines, as folders.
const sources = new Set(
  [...readFileSync(css, "utf8").matchAll(/^@source "([^"]+)";/gm)].map((match) => resolve(dirname(css), match[1]))
)
// The entries of `screenPackages`: `"@scope/name": fileURLToPath(new URL("../../packages/x", import.meta.url))`.
const viteText = readFileSync(vite, "utf8")
const block = /const screenPackages = \{([\s\S]*?)\n\}/.exec(viteText)
const listed = new Map(
  block === null
    ? []
    : [...block[1].matchAll(/"([^"]+)":\s*fileURLToPath\(new URL\("([^"]+)", import\.meta\.url\)\)/g)].map((match) => [
        match[1],
        resolve(dirname(vite), match[2])
      ])
)

const problems = []
if (block === null) problems.push("apps/inventory/vite.config.ts has no `const screenPackages = { ... }` to read")
for (const w of screens) {
  const where = relative(repo, w.dir)
  if (!sources.has(join(w.dir, "src"))) {
    problems.push(
      `${w.name} has screens (${where}/src) and no \`@source\` line in apps/inventory/src/web/index.css: add @source "${relative(dirname(css), join(w.dir, "src"))}";`
    )
  }
  if (listed.get(w.name) !== w.dir) {
    problems.push(
      `${w.name} has screens and is not in \`screenPackages\` in apps/inventory/vite.config.ts with its folder (${where}): the production stylesheet would lack its classes`
    )
  }
}
for (const [name, dir] of listed) {
  if (!existsSync(join(dir, "package.json")))
    problems.push(`screenPackages names ${name} at ${relative(repo, dir)}, which is no package`)
}
for (const dir of sources) {
  if (dir.startsWith(join(repo, "packages")) && !existsSync(dir)) {
    problems.push(`index.css names the source ${relative(repo, dir)}, which does not exist`)
  }
}

if (problems.length > 0) {
  console.error("check-screens FAIL")
  for (const problem of problems) console.error(`  ${problem}`)
  process.exit(1)
}
console.log(
  `check-screens OK  ${screens.length} packages with screens, each in both lists: ${screens.map((w) => w.name).join(", ")}`
)
