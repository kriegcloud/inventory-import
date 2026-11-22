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
import { err, type Line, out } from "../../Report.schema.ts"

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

/**
 * What `quality strict` finds: the ledger's counts by rule with where each finding is, and the total against the
 * ceiling; or a refusal.
 *
 * @category schemas
 */
export const StrictFinding = S.TaggedUnion({
  NoPlugin: {},
  Drift: {},
  NoCeilingFile: {},
  Ledger: {
    rules: S.Array(S.String).pipe(S.annotateKey({ description: "The rules that are counted" })),
    own: S.Array(S.String).pipe(S.annotateKey({ description: "The folders that are the package's own code" }))
  },
  RuleCount: {
    rule: S.String.pipe(S.annotateKey({ description: "The rule" })),
    count: S.Int.pipe(S.annotateKey({ description: "How many findings it has in own code" }))
  },
  At: {
    file: S.String.pipe(S.annotateKey({ description: "The file, from the package" })),
    line: S.Finite.pipe(S.annotateKey({ description: "The line, from 1" })),
    column: S.Finite.pipe(S.annotateKey({ description: "The column, from 1" }))
  },
  More: { count: S.Int.pipe(S.annotateKey({ description: "How many findings of the rule are not listed" })) },
  Total: {
    total: S.Int.pipe(S.annotateKey({ description: "Every counted finding" })),
    ceiling: S.Int.pipe(S.annotateKey({ description: "The recorded ceiling" })),
    seconds: S.String.pipe(S.annotateKey({ description: "How long the count took, to one decimal" }))
  },
  Above: { by: S.Int.pipe(S.annotateKey({ description: "How many findings are above the ceiling" })) },
  Below: {
    total: S.Int.pipe(S.annotateKey({ description: "The count, now below the ceiling" })),
    ceilingFile: S.String.pipe(S.annotateKey({ description: "The ceiling file to lower" }))
  }
}).pipe(
  $I.annoteSchema("StrictFinding", { description: "The style findings counted against the ceiling, or a refusal" })
)

/**
 * The decoded value of `StrictFinding`.
 *
 * @category models
 */
export type StrictFinding = typeof StrictFinding.Type

const fail = (message: string): Line => err(`check:strict FAIL  ${message}`)

/**
 * The line each finding prints.
 *
 * @category rendering
 */
export const strictSentence: (finding: StrictFinding) => Line = StrictFinding.match({
  NoPlugin: () => fail("no @effect/language-service plugin in tsconfig.base.json"),
  Drift: () =>
    fail("the package's plugin options differ from the root's outside `overrides`: copy the root's block again"),
  NoCeilingFile: () => fail("name the ceiling file: beep-cli quality strict strict-ceiling.json"),
  Ledger: ({ rules, own }) => out(`Stage C ledger: ${A.join(rules, ", ")} in own code (${A.join(own, ", ")}).`),
  RuleCount: ({ rule, count }) => out(`  ${rule}: ${count}`),
  At: ({ file, line, column }) => out(`    ${file}:${line}:${column}`),
  More: ({ count }) => out(`    and ${count} more (--all lists them)`),
  Total: ({ total, ceiling, seconds }) => out(`Total: ${total}, ceiling ${ceiling} (${seconds} s).`),
  Above: ({ by }) => fail(`${by} new finding(s) above the ceiling: write them the Effect way`),
  Below: ({ total, ceilingFile }) => fail(`the count fell to ${total}: set "ceiling" to ${total} in ${ceilingFile}`)
})

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
    return A.of<StrictFinding>(StrictFinding.cases.NoPlugin.make({}))
  }
  const ownText = yield* asJson({ ...own.value, overrides: [] }).pipe(Effect.orDie)
  const rootText = yield* asJson({ ...root.value, overrides: [] }).pipe(Effect.orDie)
  const drift =
    ownText === rootText ? A.empty<StrictFinding>() : A.of<StrictFinding>(StrictFinding.cases.Drift.make({}))

  if (O.isNone(ceilingFile))
    return A.append<StrictFinding, StrictFinding>(drift, StrictFinding.cases.NoCeilingFile.make({}))
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
  const perRule = A.flatMap(rules, ([rule, found]): ReadonlyArray<StrictFinding> => {
    const shown = all ? found : A.take(found, 3)
    return A.flatten<ReadonlyArray<ReadonlyArray<StrictFinding>>>([
      [StrictFinding.cases.RuleCount.make({ rule, count: found.length })],
      A.map(shown, (finding) =>
        StrictFinding.cases.At.make({
          file: repo.relative(repo.cwd, finding.file),
          line: finding.line,
          column: finding.column
        })
      ),
      found.length > shown.length ? [StrictFinding.cases.More.make({ count: found.length - shown.length })] : []
    ])
  })
  const finished = yield* Clock.currentTimeMillis
  const seconds = Num.round((finished - started) / 1000, 1).toFixed(1)
  return A.flatten<ReadonlyArray<ReadonlyArray<StrictFinding>>>([
    drift,
    [StrictFinding.cases.Ledger.make({ rules: ledger.rules, own: ledger.own })],
    perRule,
    [StrictFinding.cases.Total.make({ total, ceiling: ledger.ceiling, seconds })],
    total > ledger.ceiling ? [StrictFinding.cases.Above.make({ by: total - ledger.ceiling })] : [],
    total < ledger.ceiling ? [StrictFinding.cases.Below.make({ total, ceilingFile: ceilingFile.value })] : []
  ])
})
