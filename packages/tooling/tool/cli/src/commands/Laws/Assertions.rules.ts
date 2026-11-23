/**
 * The lists of the type-assertion ban, held (Benjamin, 2026-11-22: "type assertions are banned"). oxlint refuses the
 * assertions themselves, `x as T` and `<T>x`, with `typescript/consistent-type-assertions` set to never, over every
 * package at once from the root (`.oxlintrc.assertions.json`, `bun run assertions:check`); `as const` stays allowed.
 * What oxlint cannot hold is its own exceptions, so this law holds them:
 *
 * - each file an override of that configuration names still holds an assertion (read from its syntax tree), so a file
 *   whose last one is gone comes off its list;
 * - each listed file is held at its number of assertions in `ledgers/assertions.json`, which only falls, against the
 *   files there are and against main (`internal/ledger.ts`), and the overrides name the files the ledger names;
 * - no comment turns the rule off (`oxlint-disable` or `eslint-disable` naming it), in any code file git would commit.
 *
 * @packageDocumentation
 */
import { $RepoCliId } from "@beep/identity/packages"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as Result from "effect/Result"
import * as S from "effect/Schema"
import * as Str from "effect/String"
import { Repo } from "../../Repo.service.ts"
import { scratchpadFolder } from "../../Repo.schema.ts"
import { err, type Line, out } from "../../Report.schema.ts"
import { blankComments } from "../../Sync.rules.ts"
import { silencings } from "./internal/directives.ts"
import { ledgerAgainst, ledgersFolder, readLedger, standingOf, standingWords } from "./internal/ledger.ts"
import { children, isNode, type Node, parsedAs } from "./internal/tryCode.ts"

const $I = $RepoCliId.create("commands/Laws/Assertions.rules")

/** The configuration oxlint runs the ban with, from the root. */
export const assertionsConfig = ".oxlintrc.assertions.json"

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
      ])
    }).pipe(S.annotateKey({ description: "The one rule, an error, no assertion allowed" })),
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
    overrides: S.Tuple([Override, Override, Override]).pipe(
      S.annotateKey({ description: "The three lists: the vendored kit, the registry's components, everyone else's" })
    )
  }).pipe(
    $I.annoteSchema("AssertionsProfile", { description: "The type-assertion ban's configuration, as it must be" })
  )
)

/** Whether a directive turns the rule off: it names it, under either plugin's spelling. */
const silences = (rules: ReadonlyArray<string>) =>
  A.some(rules, (name) => Str.endsWith("consistent-type-assertions")(name))

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
  const listed = A.flatten(lists)
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
  const counted = A.map(
    A.filter(R.keys(ledger.success), (file) => !A.contains(listed, file)),
    (file) => AssertionsFinding.cases.Uncounted.make({ file })
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
  const against = yield* ledgerAgainst({ path: ledgerPath, now: ledger.success, files: code })
  const problems = A.flatten<ReadonlyArray<ReadonlyArray<AssertionsFinding>>>([
    A.map(against, (said) => AssertionsFinding.cases.Ledger.make({ said })),
    A.flatten(standings),
    counted,
    A.flatten(silenced)
  ])
  return A.isReadonlyArrayNonEmpty(problems)
    ? refused(problems)
    : A.of<AssertionsFinding>(AssertionsFinding.cases.Clean.make({ listed: listed.length }))
})
