/**
 * A tagged value's case is told by what its type gives, never by its `_tag` by hand: `Option.isSome` and
 * `Option.match`, `AsyncResult.isFailure`, a tagged enum's `$is` and `$match`, a schema union's `guards`, `isAnyOf` and
 * `match`, `Schema.is` of one member (Benjamin's standing rule; goals/atoms). And a case is built by its own
 * constructor (`Union.cases.A.make`, a tagged enum's `A(…)`, an error's `.make`), never as an object with a `_tag` key.
 * A hand-written tag names a case as a string the compiler checks only where it narrows; a `switch` over tags that
 * misses a new case draws nothing for it, without a word; and an object built by hand skips what the constructor
 * checks and brands.
 *
 * What is refused: `x._tag === "A"` with any of `===`, `!==`, `==`, `!=`, on either side, through `?.` and brackets;
 * a `switch` on `x._tag`; the same through anything the tag flows into: a name it was read into (`const tag =
 * x._tag`, `const { _tag } = x`, `const { _tag: kind } = x`, `const tag = x._tag ?? ""`), a choice or a template that
 * is only the tag, a template with words compared, what a function that hands the tag back answers (`kindOf(x)`,
 * `Effect.map(effect, (error) => error._tag)`, then `yield*`); a tag handed to a call (`A.contains(["A", "B"],
 * x._tag)`, `expect(tag).toBe("A")`); a method called on a tag (`x._tag.startsWith("Sav")`); a record read by a tag
 * (`handlers[x._tag]`); and an object literal with a `_tag` key, unless its tag is written out and the module types
 * that case itself as a plain type (a type alias or an interface with `_tag: "A"`; a `_tag` inside another type's
 * arguments, `Extract<Opened, { _tag: "Detail" }>`, declares nothing). What passes: `"_tag" in x`, a `_tag` read and
 * handed on as a value (returned, or put in a record), and a sentence that names one (a template with words, handed to
 * a call or written as a key).
 *
 * Where: every file of our own code and every test, the screens' and the server's, the model's, the host's and the
 * repository's own commands alike. The vendored kit (its components and hooks, and each package a `vendor.json`
 * copies from beep-effect) keeps its own. A file that still has places, owned by work not yet done, is in the root's
 * `tags-ledger.json` with how many: it may have no more, and when it has fewer the ledger is lowered (it only falls).
 *
 * "Every file git would commit" is git's answer to give, so this asks git, and fails when git does not answer.
 *
 * @packageDocumentation
 */
import { $RepoCliId } from "@beep/identity/packages"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import * as Str from "effect/String"
import { TagsLedger } from "../../Repo.schema.ts"
import { Repo } from "../../Repo.service.ts"
import { err, type Line, out } from "../../Report.schema.ts"
import { type ByHand, readTags } from "./internal/tagsCode.ts"

const $I = $RepoCliId.create("commands/Laws/Tags.rules")

/** The ledger of the files that still have places, at the repository's root. */
export const ledgerFile = "tags-ledger.json"

/**
 * Our own code and every test; the vendored components and the agents' skills left out. Each is a glob pathspec:
 * without the magic git reads `**` as `*`, so a pattern missed every file straight under its folder
 * (`apps/inventory/src/web/App.tsx`).
 */
const ownCode = A.appendAll(
  A.map(
    [
      "apps/*/src/**/*.ts",
      "apps/*/src/**/*.tsx",
      "apps/*/test/**/*.ts",
      "apps/*/test/**/*.tsx",
      "packages/**/src/**/*.ts",
      "packages/**/src/**/*.tsx",
      "packages/**/test/**/*.ts",
      "packages/**/test/**/*.tsx",
      "packages/client/**/*.ts",
      "packages/client/**/*.tsx",
      "packages/review/**/*.ts",
      "packages/review/**/*.tsx",
      "packages/ui/**/*.ts",
      "packages/ui/**/*.tsx"
    ],
    (pattern) => `:(glob)${pattern}`
  ),
  [":!packages/ui/src/components", ":!packages/ui/src/hooks", ":!.agents"]
)

/**
 * What `laws tags` finds: nothing (and what the ledger still records), or a refusal and each place a `_tag` is told
 * apart or built by hand, and each file the ledger records wrongly.
 *
 * @category schemas
 */
export const TagsFinding = S.TaggedUnion({
  Clean: {},
  Recorded: {
    files: S.Int.pipe(S.annotateKey({ description: "How many files the ledger records" })),
    places: S.Int.pipe(S.annotateKey({ description: "How many places they hold between them" }))
  },
  Refused: {},
  Unlisted: {
    why: S.String.pipe(S.annotateKey({ description: "What git said when it could not list the files" }))
  },
  At: {
    place: S.String.pipe(S.annotateKey({ description: "The file and line, as file:line" })),
    how: S.String.pipe(
      S.annotateKey({
        description:
          'How: "===" and its kin, "switch", "argument" (a tag handed to a call), "method" (a method of a tag), "key" (a record read by a tag) or "literal" (an object built with a _tag key)'
      })
    )
  },
  Above: {
    file: S.String.pipe(S.annotateKey({ description: "A file the ledger records, from the root" })),
    found: S.Int.pipe(S.annotateKey({ description: "How many places it has" })),
    recorded: S.Int.pipe(S.annotateKey({ description: "How many the ledger records for it" }))
  },
  Below: {
    file: S.String.pipe(S.annotateKey({ description: "A file the ledger records, from the root" })),
    found: S.Int.pipe(S.annotateKey({ description: "How many places it has" })),
    recorded: S.Int.pipe(S.annotateKey({ description: "How many the ledger records for it" }))
  }
}).pipe(
  $I.annoteSchema("TagsFinding", {
    description: "No `_tag` is told apart or built by hand, or a refusal and each place one is"
  })
)

/**
 * The decoded value of `TagsFinding`.
 *
 * @category models
 */
export type TagsFinding = typeof TagsFinding.Type

const sayHow = (how: string): string =>
  how === "switch"
    ? "switch over a _tag"
    : how === "argument"
      ? "a _tag handed to a call"
      : how === "method"
        ? "a method called on a _tag"
        : how === "key"
          ? "a record read by a _tag"
          : how === "literal"
            ? "an object built with a _tag key: use the case's own constructor or .make"
            : `_tag ${how}`

/**
 * The line each finding prints.
 *
 * @category rendering
 */
export const tagsSentence: (finding: TagsFinding) => Line = TagsFinding.match({
  Clean: () => out("tags:check OK  no _tag is told apart or built by hand"),
  Recorded: ({ files, places }) =>
    out(
      `  ${places} places in ${files} files are still recorded in ${ledgerFile}: none more, and the count only falls`
    ),
  Refused: () =>
    err(
      "tags:check FAIL  a _tag told apart or built by hand. Use what the type gives: O.isSome or O.match, AsyncResult.isFailure, a tagged enum's $is or $match, a schema union's guards, isAnyOf or match, S.is of one class; build a case with its constructor or .make:"
    ),
  Unlisted: ({ why }) => err(`git could not list the files, so none was checked: ${why}`),
  At: ({ how, place }) => err(`${place}  ${sayHow(how)}`),
  Above: ({ file, found, recorded }) =>
    err(`${file}  ${found} places, and ${ledgerFile} records ${recorded}: it may have no more`),
  Below: ({ file, found, recorded }) =>
    err(
      found === 0
        ? `${file}  has no place left, and ${ledgerFile} records ${recorded}: take it out of the ledger`
        : `${file}  ${found} places, and ${ledgerFile} records ${recorded}: lower it to ${found}`
    )
})

/**
 * Reads every file of our own code and every test from the repository's root, and holds each file the ledger records
 * to its count.
 *
 * @category rules
 */
export const tags = Effect.fn("Tags.tags")(function* () {
  const repo = yield* Repo
  const git = (pathspec: ReadonlyArray<string>) =>
    repo.run("git", ["ls-files", "--cached", "--others", "--exclude-standard", ...pathspec])
  const listed = yield* git(["--", ...ownCode])
  const vendored = yield* git(["--", ":(glob)packages/**/vendor.json"])
  // A list git could not give is not an empty list: nothing was checked, and the law says so.
  if (listed.code !== 0 || vendored.code !== 0) {
    return A.make<[TagsFinding, TagsFinding]>(
      TagsFinding.cases.Refused.make({}),
      TagsFinding.cases.Unlisted.make({ why: Str.trim(listed.code !== 0 ? listed.stderr : vendored.stderr) })
    )
  }
  // A package the kit is copied into keeps beep-effect's code as it is: its folder, from the root, with a slash.
  const kit = A.map(
    A.filter(Str.split("\n")(vendored.stdout), (file) => file !== ""),
    (file) => Str.slice(0, file.length - "vendor.json".length)(file)
  )
  const files = yield* Effect.filter(
    A.dedupe(
      A.filter(
        Str.split("\n")(listed.stdout),
        (file) => file !== "" && !Str.endsWith(".d.ts")(file) && !A.some(kit, (folder) => Str.startsWith(folder)(file))
      )
    ),
    (file) => repo.exists(repo.join(repo.root, file)),
    { concurrency: 1 }
  )
  const ledgerAt = repo.join(repo.root, ledgerFile)
  const ledger = (yield* repo.exists(ledgerAt)) ? (yield* repo.json(TagsLedger)(ledgerAt)).files : {}
  const read = yield* Effect.forEach(
    files,
    (file) =>
      Effect.map(repo.text(repo.join(repo.root, file)), (source) => ({ file, found: readTags({ file, source }) })),
    { concurrency: 1 }
  )
  const byFile = R.fromEntries(A.map(read, ({ file, found }) => [file, found] as const))
  const places = (file: string) => O.getOrElse(R.get(byFile, file), () => A.empty<ByHand>())
  const atEach = (file: string): ReadonlyArray<TagsFinding> =>
    A.map(places(file), (byHand) => TagsFinding.cases.At.make({ place: `${file}:${byHand.line}`, how: byHand.how }))
  const unrecorded = A.flatMap(read, ({ file }) => (R.has(ledger, file) ? A.empty<TagsFinding>() : atEach(file)))
  // Each file the ledger records: held to its count, which only falls (a file it names that is gone has none).
  const recorded = A.flatMap(R.toEntries(ledger), ([file, count]): ReadonlyArray<TagsFinding> => {
    const found = places(file).length
    if (found > count) {
      return A.prepend<TagsFinding, TagsFinding>(
        atEach(file),
        TagsFinding.cases.Above.make({ file, found, recorded: count })
      )
    }
    return found < count ? [TagsFinding.cases.Below.make({ file, found, recorded: count })] : []
  })
  const problems = A.appendAll(unrecorded, recorded)
  if (A.isArrayNonEmpty(problems)) {
    return A.prepend<TagsFinding, TagsFinding>(problems, TagsFinding.cases.Refused.make({}))
  }
  const still = R.values(ledger)
  return A.isArrayNonEmpty(still)
    ? A.make<[TagsFinding, TagsFinding]>(
        TagsFinding.cases.Clean.make({}),
        TagsFinding.cases.Recorded.make({ files: still.length, places: A.reduce(still, 0, (sum, n) => sum + n) })
      )
    : A.of<TagsFinding>(TagsFinding.cases.Clean.make({}))
})
