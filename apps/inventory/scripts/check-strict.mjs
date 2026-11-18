// `bun run check:strict`: the Effect diagnostics at their production severity, as a measurement, not a gate.
// `bun run check` uses the profile in tsconfig.base.json, where style rules are suggestions that never fail it.
// This runs the same rules with every suggestion raised to the error it is in production, prints the findings grouped
// by rule with a total, and exits 0. The TypeScript compiler's own errors are `bun run check`'s job, not counted here.
//   bun run check:strict                       every project in tsconfig.json
//   node scripts/check-strict.mjs --project <tsconfig>   one project (absolute or relative path)
//   bun run check:strict -- --all              every finding, not the first three of each rule
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { dirname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))

/** A file inside an installed package: the nearest `node_modules` up from this script (the workspace root's, hoisted). */
const installed = (path) => {
  for (let dir = dirname(fileURLToPath(import.meta.url)); ; dir = dirname(dir)) {
    const candidate = join(dir, "node_modules", path)
    if (existsSync(candidate)) return candidate
    if (dirname(dir) === dir) throw new Error(`${path} is not installed: run \`bun install\` at the repository root.`)
  }
}

/** JSON with comments and trailing commas (tsconfig) as a value. Strings are kept as they are. */
export function parseJsonc(text) {
  let out = ""
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i]
    if (c === '"') {
      let j = i + 1
      while (j < text.length && text[j] !== '"') j += text[j] === "\\" ? 2 : 1
      out += text.slice(i, j + 1)
      i = j
    } else if (c === "/" && text[i + 1] === "/") {
      while (i < text.length && text[i] !== "\n") i += 1
      out += "\n"
    } else if (c === "/" && text[i + 1] === "*") {
      i = text.indexOf("*/", i + 2) + 1
    } else {
      out += c
    }
  }
  return JSON.parse(out.replace(/,(\s*[}\]])/g, "$1"))
}

/** The plugin options with every "suggestion" raised to "error": the production profile. */
export function productionProfile(plugin) {
  const raise = (severities) =>
    Object.fromEntries(
      Object.entries(severities ?? {}).map(([rule, level]) => [rule, level === "suggestion" ? "error" : level])
    )
  return {
    ...plugin,
    diagnosticSeverity: raise(plugin.diagnosticSeverity),
    overrides: (plugin.overrides ?? []).map((o) => ({
      ...o,
      options: { ...o.options, diagnosticSeverity: raise(o.options?.diagnosticSeverity) }
    }))
  }
}

/** Findings grouped by rule, most first, each finding once even when two projects include its file. */
export function groupFindings(findings) {
  const seen = new Set()
  const byRule = {}
  for (const f of findings) {
    const key = `${f.file}:${f.line}:${f.column}:${f.name}`
    if (seen.has(key)) continue
    seen.add(key)
    ;(byRule[f.name] ??= []).push(f)
  }
  const rules = Object.entries(byRule).sort((a, b) => b[1].length - a[1].length || (a[0] < b[0] ? -1 : 1))
  return { total: seen.size, rules }
}

function projects(args) {
  const named = []
  for (let i = 0; i < args.length; i += 1) if (args[i] === "--project" && args[i + 1]) named.push(resolve(args[i + 1]))
  if (named.length > 0) return named
  const root = parseJsonc(readFileSync(join(ROOT, "tsconfig.json"), "utf8"))
  return (root.references ?? []).map((r) => join(ROOT, r.path))
}

/** The plugin options a project resolves to: its own, or the first found up its `extends` chain. */
function pluginOf(tsconfig) {
  const config = parseJsonc(readFileSync(tsconfig, "utf8"))
  const own = (config.compilerOptions?.plugins ?? []).find((p) => p.name === "@effect/language-service")
  if (own !== undefined) return own
  if (typeof config.extends !== "string") return undefined
  return pluginOf(resolve(dirname(tsconfig), config.extends))
}

function main(args) {
  const started = Date.now()
  const findings = []
  for (const project of projects(args)) {
    const plugin = pluginOf(project)
    if (plugin === undefined) continue
    let out
    try {
      out = execFileSync(
        process.execPath,
        [
          installed("@effect/tsgo/dist/effect-tsgo.cjs"),
          "diagnostics",
          "--project",
          project,
          "--format",
          "json",
          "--lspconfig",
          JSON.stringify(productionProfile(plugin))
        ],
        { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 64 * 1024 * 1024 }
      )
    } catch (error) {
      // The command exits 1 when it finds an error; its report is still on stdout.
      out = error.stdout ?? ""
    }
    const report = out.trim() === "" ? { diagnostics: [] } : JSON.parse(out)
    findings.push(...report.diagnostics)
  }
  const { total, rules } = groupFindings(findings)
  console.log("Effect diagnostics at production severity (bun run check:strict). A measurement: this never fails.")
  for (const [rule, list] of rules) {
    console.log(`  ${rule}: ${list.length}`)
    const shown = args.includes("--all") ? list : list.slice(0, 3)
    for (const f of shown) console.log(`    ${relative(ROOT, f.file)}:${f.line}:${f.column}`)
    if (list.length > shown.length) console.log(`    and ${list.length - shown.length} more (--all lists them)`)
  }
  console.log(
    `Total: ${total} finding${total === 1 ? "" : "s"} in ${rules.length} rule${rules.length === 1 ? "" : "s"} (${((Date.now() - started) / 1000).toFixed(1)} s).`
  )
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main(process.argv.slice(2))
