// `bun run check:strict` (part of `check`): the app's two recorded exceptions to the repository profile, held to account.
// 1. The app's Effect plugin options (tsconfig.base.json here) must equal the root's (../../tsconfig.base.json, copied
//    from beep-effect) everywhere but `overrides`: `plugins` replaces the inherited list whole, so a drift would be
//    silent otherwise.
// 2. Stage C turns four style rules off for own web code. Their findings are counted here with that override taken
//    out, and the count must equal the ceiling in scripts/strict-ceiling.json: above it fails (new findings), below it
//    fails too until the ceiling is lowered to the new count, so the recorded number only ever falls and stays true.
//    The vendored src/web/components/ui (stage D) stays excluded.
//   bun run check:strict           the check, with the first three findings of each rule
//   bun run check:strict -- --all  every finding
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

/** The plugin options a project resolves to: its own, or the first found up its `extends` chain. */
function pluginOf(tsconfig) {
  const config = parseJsonc(readFileSync(tsconfig, "utf8"))
  const own = (config.compilerOptions?.plugins ?? []).find((p) => p.name === "@effect/language-service")
  if (own !== undefined) return own
  if (typeof config.extends !== "string") return undefined
  return pluginOf(resolve(dirname(tsconfig), config.extends))
}

/** The plugin options with the stage C override (the one that turns the ledgered rules off) taken out. */
function withoutLedger(plugin, rules) {
  const ledgered = (o) => {
    const severity = o.options?.diagnosticSeverity ?? {}
    const keys = Object.keys(severity)
    return keys.length === rules.length && rules.every((rule) => severity[rule] === "off")
  }
  return { ...plugin, overrides: (plugin.overrides ?? []).filter((o) => !ledgered(o)) }
}

function main(args) {
  const started = Date.now()
  let failed = false
  const fail = (message) => {
    console.error(`check:strict FAIL  ${message}`)
    failed = true
  }

  const own = pluginOf(join(ROOT, "tsconfig.base.json"))
  const root = pluginOf(join(ROOT, "..", "..", "tsconfig.base.json"))
  if (own === undefined || root === undefined) return fail("no @effect/language-service plugin in tsconfig.base.json")
  if (JSON.stringify({ ...own, overrides: [] }) !== JSON.stringify({ ...root, overrides: [] })) {
    fail("the app's plugin options differ from the root's outside `overrides`: copy the root's block again")
  }

  const ledger = JSON.parse(readFileSync(join(ROOT, "scripts", "strict-ceiling.json"), "utf8"))
  const project = join(ROOT, "tsconfig.app.json")
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
        JSON.stringify(withoutLedger(own, ledger.rules))
      ],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 64 * 1024 * 1024 }
    )
  } catch (error) {
    // The command exits 1 when it finds an error; its report is still on stdout.
    out = error.stdout ?? ""
  }
  const report = out.trim() === "" ? { diagnostics: [] } : JSON.parse(out)
  const inWeb = (f) => {
    const path = relative(ROOT, f.file)
    return path.startsWith("src/web/") && !path.startsWith("src/web/components/ui/")
  }
  const { total, rules } = groupFindings(report.diagnostics.filter((f) => inWeb(f) && ledger.rules.includes(f.name)))
  console.log(`Stage C ledger: ${ledger.rules.join(", ")} in own web code.`)
  for (const [rule, list] of rules) {
    console.log(`  ${rule}: ${list.length}`)
    const shown = args.includes("--all") ? list : list.slice(0, 3)
    for (const f of shown) console.log(`    ${relative(ROOT, f.file)}:${f.line}:${f.column}`)
    if (list.length > shown.length) console.log(`    and ${list.length - shown.length} more (--all lists them)`)
  }
  console.log(`Total: ${total}, ceiling ${ledger.ceiling} (${((Date.now() - started) / 1000).toFixed(1)} s).`)
  if (total > ledger.ceiling)
    fail(`${total - ledger.ceiling} new finding(s) above the ceiling: write them the Effect way`)
  if (total < ledger.ceiling)
    fail(`the count fell to ${total}: set "ceiling" to ${total} in scripts/strict-ceiling.json`)
  if (failed) process.exitCode = 1
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main(process.argv.slice(2))
