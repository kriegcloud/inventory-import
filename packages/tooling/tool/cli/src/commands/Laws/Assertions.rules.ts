/**
 * Holds the type-assertion ban and its approved library typing gaps. oxlint refuses assertions everywhere outside
 * the published kit, registry files and the sole unsafeAssert implementation. The first two lists retain their
 * counts in assertions.json; retired own entries are receipts and must hold zero assertions. The helper holds
 * exactly one compiler claim. Each unsafe call has a literal reason counted by file in unsafe-asserts.json, exact
 * against source and decreasing against the base selected by internal/ledger.ts. A first ledger comes in whole as
 * an approval proposal. No comment may silence either assertion rule.
 *
 * @packageDocumentation
 */
import { $RepoCliId } from "@beep/identity/packages"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as P from "effect/Predicate"
import * as R from "effect/Record"
import * as Result from "effect/Result"
import * as S from "effect/Schema"
import * as Str from "effect/String"
import { Repo } from "../../Repo.service.ts"
import { scratchpadFolder } from "../../Repo.schema.ts"
import { err, type Line, out } from "../../Report.schema.ts"
import { blankComments } from "../../Sync.rules.ts"
import { silencings } from "./internal/directives.ts"
import { atBase, ledgerAgainst, ledgersFolder, readLedger, standingOf, standingWords } from "./internal/ledger.ts"
import { children, isNode, type Node, parsedAs } from "./internal/tryCode.ts"

const $I = $RepoCliId.create("commands/Laws/Assertions.rules")

/** The configuration oxlint runs the ban with, from the root. */
export const assertionsConfig = ".oxlintrc.assertions.json"

/** The sole file allowed to make a compiler claim with a type assertion. */
export const unsafeAssertFile = "packages/foundation/typing/unsafe-assert/src/unsafeAssert.ts"
/** Approved library typing gaps, each exact reason counted within its source file. */
export const unsafeAssertionsLedger = `${ledgersFolder}/unsafe-asserts.json`
const UnsafeLedger = S.fromJsonString(S.Record(S.String, S.Record(S.String, S.Int.check(S.isGreaterThanOrEqualTo(1)))))

// Source imports (including TypeScript's .js spelling) must not bypass package-import accounting.
const isUnsafeModule = (specifier: unknown): boolean =>
  P.isString(specifier) &&
  (specifier === "@beep/unsafe-assert" ||
    /(?:^|\/)unsafe-assert(?:\/|$)/.test(specifier) ||
    /\/unsafeAssert(?:\.[cm]?[jt]s)?$/.test(specifier))

/** Reads calls to the unsafe helper, following named import aliases and namespace imports. */
export const unsafeCalls = (input: {
  readonly file: string
  readonly source: string
}): ReadonlyArray<{ readonly reason: string; readonly literal: boolean }> => {
  const read = parsedAs(input)
  if (O.isNone(read.program)) return []
  const nodes: Array<Node> = []
  const parents = new WeakMap<Node, Node>()
  const left: Array<Node> = [read.program.value]
  while (A.isArrayNonEmpty(left)) {
    const node = A.lastNonEmpty(left)
    left.splice(-1, 1)
    nodes.push(node)
    for (const next of children(node)) {
      parents.set(next, node)
      left.push(next)
    }
  }
  const names: Array<string> = ["unsafeAssert"]
  const namespaces: Array<string> = []
  for (const node of nodes) {
    if (node.type !== "ImportDeclaration" || !isNode(node["source"]) || !isUnsafeModule(node["source"]["value"]))
      continue
    for (const specifier of children(node)) {
      if (!isNode(specifier["local"])) continue
      const name = specifier["local"]["name"]
      if (!P.isString(name)) continue
      if (specifier.type === "ImportNamespaceSpecifier") namespaces.push(name)
      if (
        specifier.type === "ImportSpecifier" &&
        isNode(specifier["imported"]) &&
        specifier["imported"]["name"] === "unsafeAssert"
      )
        names.push(name)
    }
  }
  // A helper value may not escape into a wrapper, assignment or re-export, where its calls could evade accounting.
  // Type references describe the function rather than invoking it and are outside this value-use restriction.
  const indirect = A.filter(nodes, (node) => {
    const parent = parents.get(node)
    if (parent === undefined) return false
    if (
      (node.type === "ExportAllDeclaration" || node.type === "ExportNamedDeclaration") &&
      isNode(node["source"]) &&
      isUnsafeModule(node["source"]["value"]) &&
      node["exportKind"] !== "type"
    )
      return true
    if (
      node.type === "Literal" &&
      isUnsafeModule(node["value"]) &&
      (parent.type === "ImportExpression" ||
        (parent.type === "CallExpression" && isNode(parent["callee"]) && parent["callee"]["name"] === "require"))
    )
      return true
    if (node.type !== "Identifier") return false
    const name = node["name"]
    if (!A.some(A.appendAll(names, namespaces), (known) => known === name)) return false
    let ancestor: Node | undefined = parent
    while (ancestor !== undefined) {
      if (
        ancestor.type === "ImportDeclaration" ||
        ancestor.type === "TSTypeQuery" ||
        ancestor.type === "TSTypeReference" ||
        ancestor["exportKind"] === "type"
      )
        return false
      ancestor = parents.get(ancestor)
    }
    if (parent["id"] === node) return false
    if (parent.type === "MemberExpression" && parent["property"] === node && parent["computed"] !== true) return false
    if (parent.type === "Property" && parent["key"] === node && parent["value"] !== node && parent["computed"] !== true)
      return false
    if (parent.type === "CallExpression" && parent["callee"] === node && A.some(names, (known) => known === name))
      return false
    if (
      A.some(namespaces, (known) => known === name) &&
      parent.type === "MemberExpression" &&
      parent["object"] === node
    ) {
      const property = parent["property"]
      const call = parents.get(parent)
      if (
        isNode(property) &&
        ((property["name"] === "unsafeAssert" && parent["computed"] !== true) ||
          property["value"] === "unsafeAssert") &&
        call?.type === "CallExpression" &&
        call["callee"] === parent
      )
        return false
    }
    return true
  })
  const calls = A.filterMap(nodes, (node) => {
    const callee = node["callee"]
    if (node.type !== "CallExpression" || !isNode(callee)) return Result.failVoid
    const direct = callee.type === "Identifier" && A.some(names, (name) => name === callee["name"])
    const object = callee["object"]
    const member =
      callee.type === "MemberExpression" &&
      isNode(object) &&
      A.some(namespaces, (name) => name === object["name"]) &&
      isNode(callee["property"]) &&
      (callee["property"]["name"] === "unsafeAssert" || callee["property"]["value"] === "unsafeAssert")
    if (!direct && !member) return Result.failVoid
    const args = node["arguments"]
    const reason = A.isArray(args) ? args[1] : undefined
    return Result.succeed(
      isNode(reason) &&
        reason.type === "Literal" &&
        P.isString(reason["value"]) &&
        Str.isNonEmpty(Str.trim(reason["value"]))
        ? { reason: reason["value"], literal: true }
        : { reason: "", literal: false }
    )
  })
  return A.appendAll(
    calls,
    A.map(indirect, () => ({ reason: "", literal: false }))
  )
}

const isCode = (file: string) => Str.match(/\.[cm]?[jt]sx?$/)(file).pipe(O.isSome)
const leftOut = [".agents/", ".codex/", `${scratchpadFolder}/`, "vendor/"]

/** An override that turns the rule off for the files it lists, and nothing else. */
const Override = S.Struct({
  files: S.Array(S.String).pipe(S.annotateKey({ description: "The files the rule is off for, from the root" })),
  rules: S.Struct({ "typescript/consistent-type-assertions": S.Literal("off") }).pipe(
    S.annotateKey({ description: "The rule, off, and no other" })
  )
})

/**
 * The vendored kit's list: both rules off, since its files are beep-effect's as published (`bun run vendor:check`) and
 * one of them writes `x!`.
 */
const KitOverride = S.Struct({
  files: S.Array(S.String).pipe(S.annotateKey({ description: "The kit's files the rules are off for, from the root" })),
  rules: S.Struct({
    "typescript/consistent-type-assertions": S.Literal("off"),
    "typescript/no-non-null-assertion": S.Literal("off")
  }).pipe(S.annotateKey({ description: "The two rules, off, and no other" }))
})

/**
 * The configuration as it must be: the one rule, an error with no assertion style allowed, every other rule off, the
 * folders not read as written here, and three lists. A path added to `ignorePatterns`, a rule changed or a fourth list
 * would let a file go unread, so any of them refuses the whole.
 */
const Profile = S.fromJsonString(
  S.Struct({
    $schema: S.optionalKey(S.String).pipe(S.annotateKey({ description: "oxlint's own schema, for an editor" })),
    plugins: S.Tuple([S.Literal("typescript")]).pipe(S.annotateKey({ description: "The one plugin the rule is in" })),
    categories: S.Struct({ correctness: S.Literal("off") }).pipe(
      S.annotateKey({ description: "The rules on by default, off: each package's own lint runs them" })
    ),
    rules: S.Struct({
      "typescript/consistent-type-assertions": S.Tuple([
        S.Literal("error"),
        S.Struct({ assertionStyle: S.Literal("never") })
      ]),
      "typescript/no-non-null-assertion": S.Literal("error")
    }).pipe(
      S.annotateKey({ description: "No `x as T` and no `x!` (Benjamin, 2026-11-26): both errors, no style allowed" })
    ),
    ignorePatterns: S.Tuple([
      S.Literal(".agents/**"),
      S.Literal(".codex/**"),
      S.Literal("scratchpad/**"),
      S.Literal("vendor/**"),
      S.Literal("**/node_modules/**"),
      S.Literal("**/dist/**"),
      S.Literal("**/.wrangler/**"),
      S.Literal("**/.turbo/**"),
      S.Literal(".claude/**")
    ]).pipe(S.annotateKey({ description: "What is not read: what is no source of ours" })),
    overrides: S.Tuple([
      KitOverride,
      Override,
      S.Struct({
        files: S.Tuple([S.Literal(unsafeAssertFile)]),
        rules: S.Struct({ "typescript/consistent-type-assertions": S.Literal("off") })
      })
    ]).pipe(
      S.annotateKey({
        description: "The three lists: the vendored kit, the registry's components, the sole compiler-claim helper"
      })
    )
  }).pipe(
    $I.annoteSchema("AssertionsProfile", { description: "The type-assertion ban's configuration, as it must be" })
  )
)

/** Whether a directive turns the rule off: it names it, under either plugin's spelling. */
const silences = (rules: ReadonlyArray<string>) =>
  A.some(
    rules,
    (name) => Str.endsWith("consistent-type-assertions")(name) || Str.endsWith("no-non-null-assertion")(name)
  )

/**
 * Whether `source` holds a type assertion: `x as T` with any type but `const`, or `<T>x`.
 *
 * @example holdsAssertion({ file: "a.ts", source: "export const a = [1] as const" }) // false
 */
export const holdsAssertion = (input: { readonly file: string; readonly source: string }): boolean =>
  countAssertions(input) > 0

/**
 * How many type assertions `source` holds: `x as T` with any type but `const`, and `<T>x`.
 *
 * @example countAssertions({ file: "a.ts", source: "export const a = (1 as number) as unknown" }) // 2
 */
export const countAssertions = (input: { readonly file: string; readonly source: string }): number => {
  const read = parsedAs(input)
  if (O.isNone(read.program)) return 0
  const asConst = (node: Node) => {
    const type = node["typeAnnotation"]
    return (
      isNode(type) &&
      type.type === "TSTypeReference" &&
      isNode(type["typeName"]) &&
      type["typeName"]["name"] === "const"
    )
  }
  let count = 0
  const left: Array<Node> = [read.program.value]
  while (A.isArrayNonEmpty(left)) {
    const node = A.lastNonEmpty(left)
    left.splice(-1, 1)
    if (node.type === "TSTypeAssertion" || (node.type === "TSAsExpression" && !asConst(node))) count += 1
    for (const next of children(node)) left.push(next)
  }
  return count
}

/**
 * What `laws assertions` finds: the lists hold, or each way they do not.
 *
 * @category schemas
 */
export const AssertionsFinding = S.TaggedUnion({
  Clean: {
    listed: S.Int.pipe(S.annotateKey({ description: "How many files the lists name" }))
  },
  Refused: {},
  Unreadable: {
    why: S.String.pipe(S.annotateKey({ description: "Why the configuration or git's list could not be read" }))
  },
  Standing: {
    file: S.String.pipe(S.annotateKey({ description: "A listed file whose number of assertions moved" })),
    words: S.String.pipe(S.annotateKey({ description: "How it moved, and what to do" }))
  },
  Uncounted: {
    file: S.String.pipe(
      S.annotateKey({ description: "A listed file with no number held, or a number for no listed file" })
    )
  },
  Ledger: {
    said: S.String.pipe(S.annotateKey({ description: "What the ledger says against the files and against main" }))
  },
  Silenced: {
    place: S.String.pipe(S.annotateKey({ description: "The file and line of the comment, as file:line" })),
    directive: S.String.pipe(S.annotateKey({ description: "The comment's directive, as written" }))
  }
}).pipe(
  $I.annoteSchema("AssertionsFinding", {
    description: "The type-assertion ban's lists only shrink and name only files that still hold one"
  })
)

/**
 * The decoded value of `AssertionsFinding`.
 *
 * @category models
 */
export type AssertionsFinding = typeof AssertionsFinding.Type

/**
 * The line each finding prints.
 *
 * @category rendering
 */
export const assertionsSentence: (finding: AssertionsFinding) => Line = AssertionsFinding.match({
  Clean: ({ listed }) =>
    out(`assertions:check OK  the type-assertion ban's lists name ${listed} files, each still holding one`),
  Refused: () => err(`assertions:check FAIL  the type-assertion ban's lists (${assertionsConfig}) do not hold:`),
  Unreadable: ({ why }) => err(`  ${why}`),
  Standing: ({ file, words }) => err(`  ${file}  ${words}`),
  Uncounted: ({ file }) =>
    err(
      `  ${file}  is in one of the lists of ${assertionsConfig} or in its ledger but not both: the two name the same files`
    ),
  Ledger: ({ said }) => err(`  ${said}`),
  Silenced: ({ directive, place }) =>
    err(`  ${place}  a comment that turns the type-assertion rule off (${directive}): no comment does. Remove it`)
})

/** The ledger's file, from the root. */
export const assertionsLedger = `${ledgersFolder}/assertions.json`

/**
 * Reads the configuration's lists and every code file git would commit, holding each listed file to the ledger at
 * `ledgerPath` (`assertionsLedger`; a test hands its own).
 *
 * @category rules
 */
export const assertions = Effect.fn("Assertions.assertions")(function* (ledgerPath: string) {
  const repo = yield* Repo
  const refused = (problems: ReadonlyArray<AssertionsFinding>) =>
    A.prepend<AssertionsFinding, AssertionsFinding>(problems, AssertionsFinding.cases.Refused.make({}))
  const text = yield* repo.text(repo.join(repo.root, assertionsConfig))
  const config = S.decodeOption(Profile, { onExcessProperty: "error" })(blankComments(text))
  if (O.isNone(config)) {
    return refused([
      AssertionsFinding.cases.Unreadable.make({
        why: `${assertionsConfig} is not the profile this law holds: one rule, an error, assertionStyle never, the folders not read as written in the law, and three lists`
      })
    ])
  }
  const ledger = yield* readLedger(ledgerPath)
  if (Result.isFailure(ledger)) return refused([AssertionsFinding.cases.Ledger.make({ said: ledger.failure })])
  const lists = A.map(config.value.overrides, (override) => override.files)
  const listed = A.flatten(A.take(lists, 2))
  // Each listed file at its number of assertions, which only falls; a file in one of the two and not the other is
  // refused, since then nothing holds it.
  const standings = yield* Effect.forEach(
    listed,
    Effect.fnUntraced(function* (file) {
      const path = repo.join(repo.root, file)
      const now = (yield* repo.exists(path)) ? countAssertions({ file, source: yield* repo.text(path) }) : 0
      return O.match(standingOf(ledger.success, { file, now }), {
        onNone: () => A.of<AssertionsFinding>(AssertionsFinding.cases.Uncounted.make({ file })),
        onSome: (standing) =>
          O.match(standingWords(standing, ledgerPath), {
            onNone: () => A.empty<AssertionsFinding>(),
            onSome: (words) => A.of<AssertionsFinding>(AssertionsFinding.cases.Standing.make({ file, words }))
          })
      })
    }),
    { concurrency: 1 }
  )
  const counted = yield* Effect.forEach(
    A.filter(R.keys(ledger.success), (file) => !A.contains(listed, file)),
    Effect.fnUntraced(function* (file) {
      const path = repo.join(repo.root, file)
      const now = (yield* repo.exists(path)) ? countAssertions({ file, source: yield* repo.text(path) }) : 0
      return now === 0 ? [] : [AssertionsFinding.cases.Uncounted.make({ file })]
    }),
    { concurrency: 1 }
  )
  const git = yield* repo.run("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard", "--deduplicate"])
  if (git.code !== 0) {
    return refused([
      AssertionsFinding.cases.Unreadable.make({ why: `git could not list the files: ${Str.trim(git.stderr)}` })
    ])
  }
  const code = yield* Effect.filter(
    A.filter(
      Str.split("\0")(git.stdout),
      (file) => isCode(file) && !A.some(leftOut, (path) => Str.startsWith(path)(file))
    ),
    (file) => repo.exists(repo.join(repo.root, file)),
    { concurrency: 1 }
  )
  const silenced = yield* Effect.forEach(
    code,
    (file) =>
      Effect.map(repo.text(repo.join(repo.root, file)), (source) =>
        A.map(silencings({ text: source, silences }), ({ directive, line }) =>
          AssertionsFinding.cases.Silenced.make({ place: `${file}:${line}`, directive })
        )
      ),
    { concurrency: 1 }
  )
  const against = yield* ledgerAgainst({
    path: ledgerPath,
    now: ledger.success,
    files: A.dedupe(A.appendAll(code, R.keys(ledger.success)))
  })
  const unsafeProblems = yield* unsafeLedgerProblems(code)
  const helperText = yield* repo.text(repo.join(repo.root, unsafeAssertFile))
  const helperProblems =
    countAssertions({ file: unsafeAssertFile, source: helperText }) === 1
      ? []
      : ["unsafeAssert must hold exactly its one compiler claim"]
  const problems = A.flatten<ReadonlyArray<ReadonlyArray<AssertionsFinding>>>([
    A.map(against, (said) => AssertionsFinding.cases.Ledger.make({ said })),
    A.flatten(standings),
    A.flatten(counted),
    A.map(A.appendAll(unsafeProblems, helperProblems), (said) => AssertionsFinding.cases.Ledger.make({ said })),
    A.flatten(silenced)
  ])
  return A.isReadonlyArrayNonEmpty(problems)
    ? refused(problems)
    : A.of<AssertionsFinding>(AssertionsFinding.cases.Clean.make({ listed: listed.length + 1 }))
})

/** Holds each exact reason against source and the base ledger; approvals cannot grow in the same change. */
const unsafeLedgerProblems = Effect.fn("Assertions.unsafeLedgerProblems")(function* (files: ReadonlyArray<string>) {
  const repo = yield* Repo
  const path = repo.join(repo.root, unsafeAssertionsLedger)
  if (!(yield* repo.exists(path))) return [`${unsafeAssertionsLedger} is missing`]
  const text = yield* repo.text(path)
  const decoded = S.decodeOption(UnsafeLedger)(text)
  if (O.isNone(decoded)) return [`${unsafeAssertionsLedger} must hold file -> string-literal reason -> positive count`]
  const ledger = decoded.value
  const actual: Record<string, Record<string, number>> = {}
  const problems: Array<string> = []
  let total = 0
  for (const file of files) {
    const calls = unsafeCalls({ file, source: yield* repo.text(repo.join(repo.root, file)) })
    if (calls.length === 0) continue
    let counts: Record<string, number> = {}
    for (const call of calls) {
      total += 1
      if (!call.literal)
        problems.push(
          `${file} unsafeAssert requires a direct call with a nonempty string-literal reason; helper values cannot be aliased or re-exported`
        )
      else counts = { ...counts, [call.reason]: O.getOrElse(R.get(counts, call.reason), () => 0) + 1 }
    }
    actual[file] = counts
  }
  if (total >= 15) problems.push(`unsafeAssert has ${total} calls: fewer than 15 are allowed`)
  for (const file of A.dedupe(A.appendAll(R.keys(actual), R.keys(ledger)))) {
    const now = O.getOrElse(R.get(actual, file), () => ({}))
    const approved = O.getOrElse(R.get(ledger, file), () => ({}))
    if (R.size(approved) === 0 && R.has(ledger, file)) problems.push(`${file} has an empty unsafe approval: remove it`)
    for (const reason of A.dedupe(A.appendAll(R.keys(now), R.keys(approved)))) {
      const count = O.getOrElse(R.get(now, reason), () => 0)
      const held = O.getOrElse(R.get(approved, reason), () => 0)
      if (count !== held)
        problems.push(
          `${file} unsafeAssert reason ${reason}: source has ${count}, ledger has ${held}; unlisted and stale approvals are refused`
        )
    }
  }
  const base = yield* atBase(unsafeAssertionsLedger, files)
  if (O.isSome(base.problem)) problems.push(base.problem.value)
  if (O.isSome(base.text)) {
    const before = S.decodeOption(UnsafeLedger)(base.text.value)
    if (O.isNone(before)) problems.push(`${unsafeAssertionsLedger} at base could not be read`)
    else
      for (const [file, reasons] of R.toEntries(ledger)) {
        const was = O.getOrElse(R.get(base.renamed, file), () => file)
        const held = O.getOrElse(R.get(before.value, was), () => ({}))
        for (const [reason, count] of R.toEntries(reasons)) {
          if (count > O.getOrElse(R.get(held, reason), () => 0))
            problems.push(
              `${file} unsafeAssert reason ${reason} adds an approval or raises its count against base: approvals only decrease`
            )
        }
      }
  }
  return problems
})
