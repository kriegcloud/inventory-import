/**
 * In the packages with screens a tagged value's case is told by what its type gives, never by comparing `_tag` by
 * hand: `Option.isSome` and `Option.match`, `AsyncResult.isFailure`, a tagged enum's `$is` and `$match`, a schema
 * union's `guards` and `match`, `Schema.is` of one member (Benjamin's standing rule; goals/atoms). A hand-written
 * comparison names a case as a string the compiler checks only where it narrows, and a `switch` over tags that misses
 * a new case draws nothing for it, without a word.
 *
 * What is refused: `x._tag === "A"` with any of `===`, `!==`, `==`, `!=`, on either side, through `?.` and
 * brackets, and a `switch` on `x._tag`. What passes: `"_tag" in x`, and a `_tag` read and handed on (a guard's own body
 * is written once, in the module that owns the type, outside these packages or with `Predicate.isTagged`).
 *
 * Where: the app's screens and their tests, and every package that holds screens or their state. The vendored kit
 * keeps its own.
 *
 * "Every file git would commit" is git's answer to give, so this asks git, and fails when git does not answer.
 *
 * @packageDocumentation
 */
import { $RepoCliId } from "@beep/identity/packages"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as S from "effect/Schema"
import * as Str from "effect/String"
import { Repo } from "../../Repo.service.ts"
import { err, type Line, out } from "../../Report.schema.ts"
import { readTags } from "./internal/tagsCode.ts"

const $I = $RepoCliId.create("commands/Laws/Tags.rules")

/** The packages with screens, their state and their tests; the vendored kit and the agents' skills left out. */
const webCode = [
  "--",
  "apps/*/src/web/**/*.ts",
  "apps/*/src/web/**/*.tsx",
  "apps/*/test/web/**/*.ts",
  "apps/*/test/web/**/*.tsx",
  "packages/*/web/**/*.ts",
  "packages/*/web/**/*.tsx",
  "packages/client/**/*.ts",
  "packages/client/**/*.tsx",
  "packages/review/**/*.ts",
  "packages/review/**/*.tsx",
  "packages/ui/**/*.ts",
  "packages/ui/**/*.tsx",
  ":!packages/ui/src/components",
  ":!packages/ui/src/hooks",
  ":!.agents"
]

/**
 * What `laws tags` finds: nothing, or a refusal and each place a `_tag` is compared by hand.
 *
 * @category schemas
 */
export const TagsFinding = S.TaggedUnion({
  Clean: {},
  Refused: {},
  Unlisted: {
    why: S.String.pipe(S.annotateKey({ description: "What git said when it could not list the files" }))
  },
  At: {
    place: S.String.pipe(S.annotateKey({ description: "The file and line, as file:line" })),
    how: S.String.pipe(S.annotateKey({ description: 'The comparison: "===" and its kin, or "switch"' }))
  }
}).pipe(
  $I.annoteSchema("TagsFinding", {
    description: "No `_tag` is compared by hand in the packages with screens, or a refusal and each place one is"
  })
)

/**
 * The decoded value of `TagsFinding`.
 *
 * @category models
 */
export type TagsFinding = typeof TagsFinding.Type

/**
 * The line each finding prints.
 *
 * @category rendering
 */
export const tagsSentence: (finding: TagsFinding) => Line = TagsFinding.match({
  Clean: () => out("tags:check OK  no _tag is compared by hand in the packages with screens"),
  Refused: () =>
    err(
      "tags:check FAIL  a _tag compared by hand. Use what the type gives: O.isSome or O.match, AsyncResult.isFailure, a tagged enum's $is or $match, a schema union's guards or match:"
    ),
  Unlisted: ({ why }) => err(`git could not list the files, so none was checked: ${why}`),
  At: ({ how, place }) => err(`${place}  ${how === "switch" ? "switch over a _tag" : `_tag ${how}`}`)
})

/**
 * Reads every file of the packages with screens from the repository's root.
 *
 * @category rules
 */
export const tags = Effect.fn("Tags.tags")(function* () {
  const repo = yield* Repo
  const listed = yield* repo.run("git", ["ls-files", "--cached", "--others", "--exclude-standard", ...webCode])
  // A list git could not give is not an empty list: nothing was checked, and the law says so.
  if (listed.code !== 0) {
    return A.make<[TagsFinding, TagsFinding]>(
      TagsFinding.cases.Refused.make({}),
      TagsFinding.cases.Unlisted.make({ why: Str.trim(listed.stderr) })
    )
  }
  const files = yield* Effect.filter(
    A.filter(Str.split("\n")(listed.stdout), (file) => file !== "" && !Str.endsWith(".d.ts")(file)),
    (file) => repo.exists(repo.join(repo.root, file)),
    { concurrency: 1 }
  )
  const found = yield* Effect.forEach(
    files,
    (file) =>
      Effect.map(repo.text(repo.join(repo.root, file)), (source) =>
        A.map(readTags({ file, source }), (byHand) =>
          TagsFinding.cases.At.make({ place: `${file}:${byHand.line}`, how: byHand.how })
        )
      ),
    { concurrency: 1 }
  )
  const places = A.flatten(found)
  return A.isArrayNonEmpty(places)
    ? A.prepend<TagsFinding, TagsFinding>(places, TagsFinding.cases.Refused.make({}))
    : A.of<TagsFinding>(TagsFinding.cases.Clean.make({}))
})
