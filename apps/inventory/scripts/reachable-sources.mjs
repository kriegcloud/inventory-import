// The browser's source files the app can load, found by following imports from its entry: what the production
// stylesheet scans for Tailwind classes (vite.config.ts, `usedSourcesOnly`). Every shadcn component is installed and
// most are not used; scanning them all put 81 kB of classes nothing draws into every page's stylesheet. Following the
// imports keeps it true without a list kept by hand: a component someone starts to use is found by the same walk.
// An import that names a local file which cannot be found stops the build: a file missed here would lose its styles.
import { existsSync, readFileSync, statSync } from "node:fs"
import { dirname, join, relative, resolve } from "node:path"

// `import ... from "x"`, `export ... from "x"`, `import "x"`, `import("x")`.
const specifiers =
  /(?:import|export)\s[^"'`;]*?from\s*["']([^"']+)["']|import\s*["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g
const extensions = ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]

/**
 * Every file under `root` reachable from `entry` by static or dynamic imports, `@/` meaning `alias`. Only files
 * inside `root` are followed; packages are left to their own stylesheets.
 */
export function reachableSources(input) {
  const { entry, root, alias } = input
  const seen = new Set()
  const pending = [resolve(entry)]
  while (pending.length > 0) {
    const file = pending.pop()
    if (seen.has(file)) continue
    seen.add(file)
    const text = readFileSync(file, "utf8")
    for (const match of text.matchAll(specifiers)) {
      const specifier = match[1] ?? match[2] ?? match[3] ?? ""
      const local = specifier.startsWith("@/")
        ? join(alias, specifier.slice(2))
        : specifier.startsWith(".")
          ? resolve(dirname(file), specifier)
          : undefined
      if (local === undefined || /\.(css|svg|png|woff2?)$/.test(local)) continue
      const found = extensions
        .map((ext) => `${local}${ext}`)
        .find((path) => existsSync(path) && statSync(path).isFile())
      if (found === undefined) throw new Error(`${relative(root, file)} imports "${specifier}", which was not found`)
      if (found.startsWith(root)) pending.push(found)
    }
  }
  return [...seen].sort()
}
