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

/** The file a workspace package's exact export names, or undefined when the specifier is not one of `packages`. */
const exported = (specifier, packages) => {
  for (const [name, dir] of Object.entries(packages)) {
    if (specifier !== name && !specifier.startsWith(`${name}/`)) continue
    const exports = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")).exports ?? {}
    const key = specifier === name ? "." : `./${specifier.slice(name.length + 1)}`
    const target = exports[key]
    if (typeof target !== "string") throw new Error(`"${specifier}" is not an export of ${name}`)
    return resolve(dir, target)
  }
  return undefined
}

/**
 * Every file under `root`, or inside one of the workspace `packages` (name to folder), reachable from `entry` by
 * static or dynamic imports, `@/` meaning `alias` and a package's specifier meaning the file its exact export names.
 * Other packages are left to their own stylesheets.
 * A file named in `except` is not followed: a page that only a development build shows.
 */
export function reachableSources(input) {
  const { entry, root, alias } = input
  // Pages only a development build shows: their imports are not followed, so their classes stay out of the stylesheet.
  const except = new Set((input.except ?? []).map((file) => resolve(file)))
  const packages = Object.fromEntries(Object.entries(input.packages ?? {}).map(([name, dir]) => [name, resolve(dir)]))
  const inside = (path) => path.startsWith(root) || Object.values(packages).some((dir) => path.startsWith(`${dir}/`))
  const seen = new Set()
  const pending = [resolve(entry)]
  while (pending.length > 0) {
    const file = pending.pop()
    if (file === undefined || seen.has(file)) continue
    seen.add(file)
    const text = readFileSync(file, "utf8")
    for (const match of text.matchAll(specifiers)) {
      const specifier = match[1] ?? match[2] ?? match[3] ?? ""
      const local = specifier.startsWith("@/")
        ? join(alias, specifier.slice(2))
        : specifier.startsWith(".")
          ? resolve(dirname(file), specifier)
          : exported(specifier, packages)
      if (local === undefined || /\.(css|svg|png|woff2?)$/.test(local)) continue
      const found = extensions
        .map((ext) => `${local}${ext}`)
        .find((path) => existsSync(path) && statSync(path).isFile())
      if (found === undefined) throw new Error(`${relative(root, file)} imports "${specifier}", which was not found`)
      if (inside(found) && !except.has(found)) pending.push(found)
    }
  }
  return [...seen].sort()
}
