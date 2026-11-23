/**
 * The lists of the type-assertion ban, held (Benjamin, 2026-11-22: "type assertions are banned"). oxlint refuses the
 * assertions themselves, `x as T` and `<T>x`, with `typescript/consistent-type-assertions` set to never, over every
 * package at once from the root (`.oxlintrc.assertions.json`, `bun run assertions:check`); `as const` stays allowed.
 * What oxlint cannot hold is its own exceptions, so this law holds them:
 *
 * - each file an override of that configuration names still holds an assertion (read from its syntax tree), so a file
 *   whose last one is gone comes off its list;
 * - no list is longer than its ceiling (`assertionCeilings`), and a ceiling above its list is lowered, so a list only
 *   shrinks;
 * - no comment turns the rule off (`oxlint-disable` or `eslint-disable` naming it), in any code file git would commit.
 *
 * @packageDocumentation
 */
import { $RepoCliId } from "@beep/identity/packages"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as S from "effect/Schema"
import * as Str from "effect/String"
import { Repo } from "../../Repo.service.ts"
import { scratchpadFolder } from "../../Repo.schema.ts"
import { err, type Line, out } from "../../Report.schema.ts"
import { blankComments } from "../../Sync.rules.ts"
import { silencings } from "./internal/directives.ts"
import { children, isNode, type Node, parsedAs } from "./internal/tryCode.ts"

const $I = $RepoCliId.create("commands/Laws/Assertions.rules")

/** The configuration oxlint runs the ban with, from the root. */
export const assertionsConfig = ".oxlintrc.assertions.json"

/**
 * How long each list of `assertionsConfig` may be, in the order its overrides stand: beep-effect's vendored kit, the
 * registry's components, and everyone else's files. Each only falls: lower it when a list shrinks.
 */
export const assertionCeilings: ReadonlyArray<number> = [23, 33, 64]

const isCode = (file: string) => Str.match(/\.[cm]?[jt]sx?$/)(file).pipe(O.isSome)
const leftOut = [".agents/", ".codex/", `${scratchpadFolder}/`, "vendor/"]

/** The part of the configuration the law reads: each override's files. */
const Config = S.fromJsonString(S.Struct({ overrides: S.Array(S.Struct({ files: S.Array(S.String) })) }))

/** Whether a directive turns the rule off: it names it, under either plugin's spelling. */
const silences = (rules: ReadonlyArray<string>) =>
  A.some(rules, (name) => Str.endsWith("consistent-type-assertions")(name))

/**
 * Whether `source` holds a type assertion: `x as T` with any type but `const`, or `<T>x`.
 *
 * @example holdsAssertion({ file: "a.ts", source: "export const a = [1] as const" }) // false
 */
export const holdsAssertion = (input: { readonly file: string; readonly source: string }): boolean => {
  const read = parsedAs(input)
  if (O.isNone(read.program)) return false
  const asConst = (node: Node) => {
    const type = node["typeAnnotation"]
    return (
      isNode(type) &&
      type.type === "TSTypeReference" &&
      isNode(type["typeName"]) &&
      type["typeName"]["name"] === "const"
    )
  }
  const left: Array<Node> = [read.program.value]
  for (let node = left.pop(); node !== undefined; node = left.pop()) {
    if (node.type === "TSTypeAssertion" || (node.type === "TSAsExpression" && !asConst(node))) return true
    for (const next of children(node)) left.push(next)
  }
  return false
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
  Settled: {
    file: S.String.pipe(S.annotateKey({ description: "A listed file that holds no assertion any more, or none" }))
  },
  Grown: {
    list: S.Int.pipe(S.annotateKey({ description: "Which list, from 1, in the order the overrides stand" })),
    length: S.Int.pipe(S.annotateKey({ description: "How many files it names" })),
    ceiling: S.Int.pipe(S.annotateKey({ description: "How many it may name" }))
  },
  Shrunk: {
    list: S.Int.pipe(S.annotateKey({ description: "Which list, from 1" })),
    length: S.Int.pipe(S.annotateKey({ description: "How many files it names" })),
    ceiling: S.Int.pipe(S.annotateKey({ description: "The ceiling still written for it" }))
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
  Settled: ({ file }) =>
    err(`  ${file}  is listed but holds no type assertion: take its line off the list in ${assertionsConfig}`),
  Grown: ({ ceiling, length, list }) =>
    err(
      `  list ${list} names ${length} files, past its ceiling of ${ceiling}: a list only shrinks. Fix the code instead`
    ),
  Shrunk: ({ ceiling, length, list }) =>
    err(`  list ${list} names ${length} files: lower its ceiling from ${ceiling} to ${length} in assertionCeilings`),
  Silenced: ({ directive, place }) =>
    err(`  ${place}  a comment that turns the type-assertion rule off (${directive}): no comment does. Remove it`)
})

/**
 * Reads the configuration's lists and every code file git would commit.
 *
 * @category rules
 */
export const assertions = Effect.fn("Assertions.assertions")(function* () {
  const repo = yield* Repo
  const refused = (problems: ReadonlyArray<AssertionsFinding>) =>
    A.prepend<AssertionsFinding, AssertionsFinding>(problems, AssertionsFinding.cases.Refused.make({}))
  const text = yield* repo.text(repo.join(repo.root, assertionsConfig))
  const config = S.decodeOption(Config)(blankComments(text))
  if (O.isNone(config)) {
    return refused([
      AssertionsFinding.cases.Unreadable.make({ why: `${assertionsConfig} does not read as its overrides' files` })
    ])
  }
  const lists = A.map(config.value.overrides, (override) => override.files)
  const lengths = A.flatMap(lists, (files, index): ReadonlyArray<AssertionsFinding> => {
    const ceiling = assertionCeilings[index] ?? 0
    const list = index + 1
    if (files.length > ceiling) return [AssertionsFinding.cases.Grown.make({ list, length: files.length, ceiling })]
    if (files.length < ceiling) return [AssertionsFinding.cases.Shrunk.make({ list, length: files.length, ceiling })]
    return []
  })
  const listed = A.flatten(lists)
  const settled = yield* Effect.filter(
    listed,
    (file) =>
      Effect.gen(function* () {
        const path = repo.join(repo.root, file)
        if (!(yield* repo.exists(path))) return true
        return !holdsAssertion({ file, source: yield* repo.text(path) })
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
  const problems = A.flatten<ReadonlyArray<ReadonlyArray<AssertionsFinding>>>([
    lengths,
    A.map(settled, (file) => AssertionsFinding.cases.Settled.make({ file })),
    A.flatten(silenced)
  ])
  return A.isReadonlyArrayNonEmpty(problems)
    ? refused(problems)
    : A.of<AssertionsFinding>(AssertionsFinding.cases.Clean.make({ listed: listed.length }))
})
