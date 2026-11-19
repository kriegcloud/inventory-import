/**
 * The recorded exceptions of a package with screens (the app, `@inventory/ui`, `@inventory/review` and the rest),
 * held to account. Run from the package's folder with its ceiling file.
 *
 * 1. The package's Effect plugin options (its `tsconfig.base.json`) must equal the root's (`tsconfig.base.json`,
 *    copied from beep-effect) everywhere but `overrides`: `plugins` replaces the inherited list whole, so a drift
 *    would be silent otherwise.
 * 2. Stage C turns four style rules off for own code. Their findings are counted here with that override taken out,
 *    in the files under the ceiling file's `own` folders and outside its `vendored` ones (stage D), and the count
 *    must equal its `ceiling`: above it fails (new findings), below it fails too until the ceiling is lowered to the
 *    new count, so the recorded number only ever falls and stays true. `quality ceilings` keeps the packages' sum.
 *
 * @packageDocumentation
 */
import { $RepoCliId } from "@beep/identity/packages"
import * as A from "effect/Array"
import * as Clock from "effect/Clock"
import * as Effect from "effect/Effect"
import * as Num from "effect/Number"
import * as O from "effect/Option"
import * as Order from "effect/Order"
import * as P from "effect/Predicate"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import * as Str from "effect/String"
import { RepoError } from "../../Cli.errors.ts"
import { Repo } from "../../Repo.service.ts"
import { StrictCeiling } from "../../Repo.schema.ts"
import { err, failed, type Line, out, passed } from "../../Report.schema.ts"

const $I = $RepoCliId.create("commands/Quality/Strict.rules")

const fromJson = S.decodeEffect(S.fromJsonString(S.Unknown))
const asJson = S.encodeEffect(S.fromJsonString(S.Unknown))

/**
 * One finding of the type-checker's Effect diagnostics.
 *
 * @category schemas
 */
export class Finding extends S.Class<Finding, { readonly brand: unique symbol }>($I`Finding`)(
  {
    file: S.String.pipe(S.annotateKey({ description: "The file, absolute" })),
    line: S.Finite.pipe(S.annotateKey({ description: "The line, from 1" })),
    column: S.Finite.pipe(S.annotateKey({ description: "The column, from 1" })),
    name: S.String.pipe(S.annotateKey({ description: "The rule that fired" }))
  },
  $I.annote("Finding", { description: "One finding of the Effect diagnostics: where, and which rule" })
) {}

const Diagnostics = S.Struct({
  diagnostics: S.Array(Finding).pipe(S.annotateKey({ description: "Every finding in the project" }))
}).pipe($I.annoteSchema("Diagnostics", { description: "The type-checker's diagnostics report" }))

/**
 * JSON with comments and trailing commas (a tsconfig) as plain JSON text. Strings are kept as they are.
 *
 * @category rules
 */
export const stripJsonc = (text: string): string => {
  let stripped = ""
  let i = 0
  while (i < text.length) {
    const c = text[i]
    if (c === '"') {
      let j = i + 1
      while (j < text.length && text[j] !== '"') j += text[j] === "\\" ? 2 : 1
      stripped += Str.slice(i, j + 1)(text)
      i = j
    } else if (c === "/" && text[i + 1] === "/") {
      while (i < text.length && text[i] !== "\n") i += 1
      stripped += "\n"
    } else if (c === "/" && text[i + 1] === "*") {
      i += 2
      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) i += 1
      i += 1
    } else {
      stripped += c
    }
    i += 1
  }
  return Str.replace(/,(\s*[}\]])/g, "$1")(stripped)
}

const byCountThenName = Order.combine(
  Order.mapInput(Order.flip(Order.Number), (entry: readonly [string, ReadonlyArray<Finding>]) => entry[1].length),
  Order.mapInput(Order.String, (entry: readonly [string, ReadonlyArray<Finding>]) => entry[0])
)

/**
 * Findings grouped by rule, most first, each finding once even when two projects include its file.
 *
 * @category rules
 */
export const groupFindings = (findings: ReadonlyArray<Finding>) => {
  const once = A.dedupeWith(
    findings,
    (a, b) => a.file === b.file && a.line === b.line && a.column === b.column && a.name === b.name
  )
  return { total: once.length, rules: A.sort(R.toEntries(A.groupBy(once, (finding) => finding.name)), byCountThenName) }
}

const field = (value: unknown, key: string): unknown => (P.hasProperty(value, key) ? value[key] : undefined)
const record = (value: unknown): Record<string, unknown> => (P.isObject(value) ? { ...value } : {})
const list = (value: unknown): ReadonlyArray<unknown> => (A.isArray(value) ? value : [])

/** The plugin options with the stage C override (the one that turns the ledgered rules off) taken out. */
const withoutLedger = (plugin: Record<string, unknown>, rules: ReadonlyArray<string>) => {
  const ledgered = (override: unknown): boolean => {
    const severity = record(field(field(override, "options"), "diagnosticSeverity"))
    return R.keys(severity).length === rules.length && A.every(rules, (rule) => severity[rule] === "off")
  }
  return { ...plugin, overrides: A.filter(list(plugin["overrides"]), (override) => !ledgered(override)) }
}

/**
 * Checks the package in the folder the command was started in. `ceilingFile` is its ceiling file; `all` lists every
 * finding instead of the first three of each rule.
 *
 * @category rules
 */
export const strict = Effect.fn("Strict.strict")(function* (ceilingFile: O.Option<string>, all: boolean) {
  const repo = yield* Repo
  const started = yield* Clock.currentTimeMillis
  const fail = (message: string): Line => err(`check:strict FAIL  ${message}`)

  /** The plugin options a project resolves to: its own, or the first found up its `extends` chain. */
  const pluginOf: (tsconfig: string) => Effect.Effect<O.Option<Record<string, unknown>>, RepoError> = Effect.fn(
    "Strict.pluginOf"
  )(function* (tsconfig: string) {
    const text = yield* repo.text(tsconfig)
    const config = yield* fromJson(stripJsonc(text)).pipe(
      Effect.mapError((cause) =>
        RepoError.make({ path: tsconfig, message: `${tsconfig} is not what was expected: ${cause.message}` })
      )
    )
    const own = A.findFirst(
      list(field(field(config, "compilerOptions"), "plugins")),
      (plugin) => field(plugin, "name") === "@effect/language-service"
    )
    if (O.isSome(own)) return O.some(record(own.value))
    const parent = field(config, "extends")
    if (!P.isString(parent)) return O.none()
    return yield* pluginOf(repo.resolve(repo.dirname(tsconfig), parent))
  })

  const own = yield* pluginOf(repo.join(repo.cwd, "tsconfig.base.json"))
  const root = yield* pluginOf(repo.join(repo.root, "tsconfig.base.json"))
  if (O.isNone(own) || O.isNone(root)) {
    return failed([fail("no @effect/language-service plugin in tsconfig.base.json")])
  }
  const ownText = yield* asJson({ ...own.value, overrides: [] }).pipe(Effect.orDie)
  const rootText = yield* asJson({ ...root.value, overrides: [] }).pipe(Effect.orDie)
  const drift =
    ownText === rootText
      ? A.empty<Line>()
      : A.of(
          fail("the package's plugin options differ from the root's outside `overrides`: copy the root's block again")
        )

  if (O.isNone(ceilingFile)) {
    return failed(A.append(drift, fail("name the ceiling file: beep-cli quality strict strict-ceiling.json")))
  }
  const ledger = yield* repo.json(StrictCeiling)(repo.join(repo.cwd, ceilingFile.value))
  const tsgo = repo.join(repo.root, "node_modules", "@effect/tsgo/dist/effect-tsgo.cjs")
  if (!(yield* repo.exists(tsgo))) {
    return yield* RepoError.make({
      path: tsgo,
      message: "@effect/tsgo/dist/effect-tsgo.cjs is not installed: run `bun install` at the repository root."
    })
  }
  const lspconfig = yield* asJson(withoutLedger(own.value, ledger.rules)).pipe(Effect.orDie)
  // The command exits 1 when it finds an error; its report is still on standard output.
  const answer = yield* repo.run("node", [
    tsgo,
    "diagnostics",
    "--project",
    repo.join(repo.cwd, ledger.project),
    "--format",
    "json",
    "--lspconfig",
    lspconfig
  ])
  const report =
    Str.trim(answer.stdout) === ""
      ? { diagnostics: A.empty<Finding>() }
      : yield* S.decodeEffect(S.fromJsonString(Diagnostics))(answer.stdout).pipe(
          Effect.mapError((cause) =>
            RepoError.make({ path: tsgo, message: `the diagnostics report could not be read: ${cause.message}` })
          )
        )
  const inOwn = (finding: Finding): boolean => {
    const path = repo.relative(repo.cwd, finding.file)
    return (
      A.some(ledger.own, (dir) => Str.startsWith(dir)(path)) &&
      !A.some(ledger.vendored, (dir) => Str.startsWith(dir)(path))
    )
  }
  const { total, rules } = groupFindings(
    A.filter(report.diagnostics, (finding) => inOwn(finding) && A.contains(ledger.rules, finding.name))
  )
  const perRule = A.flatMap(rules, ([rule, found]) => {
    const shown = all ? found : A.take(found, 3)
    return A.flatten([
      A.of(out(`  ${rule}: ${found.length}`)),
      A.map(shown, (finding) => out(`    ${repo.relative(repo.cwd, finding.file)}:${finding.line}:${finding.column}`)),
      found.length > shown.length ? A.of(out(`    and ${found.length - shown.length} more (--all lists them)`)) : []
    ])
  })
  const finished = yield* Clock.currentTimeMillis
  const seconds = Num.round((finished - started) / 1000, 1).toFixed(1)
  const lines = A.flatten([
    drift,
    A.of(out(`Stage C ledger: ${A.join(ledger.rules, ", ")} in own code (${A.join(ledger.own, ", ")}).`)),
    perRule,
    A.of(out(`Total: ${total}, ceiling ${ledger.ceiling} (${seconds} s).`)),
    total > ledger.ceiling
      ? A.of(fail(`${total - ledger.ceiling} new finding(s) above the ceiling: write them the Effect way`))
      : [],
    total < ledger.ceiling
      ? A.of(fail(`the count fell to ${total}: set "ceiling" to ${total} in ${ceilingFile.value}`))
      : []
  ])
  return A.isReadonlyArrayNonEmpty(drift) || total !== ledger.ceiling ? failed(lines) : passed(lines)
})
