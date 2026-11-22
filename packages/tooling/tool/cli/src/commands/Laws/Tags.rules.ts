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
 * a `switch` on `x._tag`; the same through anything the tag flows into: a name it was read or assigned into (`const
 * tag = x._tag`, `const { _tag } = x`, `const { _tag: kind } = x`, `const tag = x._tag ?? ""`, `t = x._tag`), a place
 * of a list or a record it was put in (`const [t] = [x._tag]`, `const o = { k: x._tag }` then `o.k`), a choice or a
 * template that is only the tag, what a function that hands the tag back answers (`kindOf(x)`, a function declared
 * after its first use, a record's method `k.of(x)`, `Effect.map(effect, (error) => error._tag)`, then `yield*`); a tag
 * handed to a call (`A.contains(["A", "B"], x._tag)`, `expect(tag).toBe("A")`); a sentence that names a tag (a
 * template with words) compared or handed to an expectation; a method called on a tag (`x._tag.startsWith("Sav")`);
 * a record read by a tag (`handlers[x._tag]`). A value that holds a tag is the tag in each of these: tags joined
 * (`A.join([x._tag], "")`, `[x._tag].join("")`, the join itself included), a list or a record with one in it
 * (`expect({ k: x._tag })`, `[x._tag].includes("A")`), a list spread (`[...tags]`, `f(...tags)`), taken out again
 * (`[t] = [x._tag]`, `for (const t of A.map(xs, (e) => e._tag))`). `P.isTagged(x, "A")` is refused too: it takes any
 * value, so a misspelled tag compiles where the type's guards would not. And an object literal with a `_tag` key,
 * in any module: a case typed by hand there is no leave to build it by hand (`Data.taggedEnum` or `S.TaggedUnion` gives
 * it a constructor). What passes: `"_tag" in x`, a `_tag` read and handed on as a value (returned, or put in a record),
 * and a sentence that names one handed on as words (a message, a key, the message an expectation says when it fails).
 *
 * A file whose names lead into each other past the steps its length allows, one nested too deep, one too large, or
 * one the parser reads with errors (`internal/budget.ts`) is refused as a whole, once, at the line being read, in
 * words that say which: never read without end, never passed in silence.
 *
 * Where: every file of our own code and every test, the screens' and the server's, the model's, the host's and the
 * repository's own commands alike. The vendored kit (its components and hooks, and each package a `vendor.json`
 * copies from beep-effect) keeps its own. No file is excepted, and none is held to a count: a count lets one
 * hand-written tag be swapped for another and pass. One folder is left out by name, the scratchpad (`scratchpad/`):
 * an experiment is tried there under the type-checker only, and this law applies to it when its code graduates into
 * a package (decision "the scratchpad", 2026-11-22).
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
import { Repo } from "../../Repo.service.ts"
import { scratchpadFolder } from "../../Repo.schema.ts"
import { err, type Line, out } from "../../Report.schema.ts"
import { unreadSentence } from "./internal/budget.ts"
import { readTags } from "./internal/tagsCode.ts"

const $I = $RepoCliId.create("commands/Laws/Tags.rules")

/**
 * Our own code and every test; the vendored components and the agents' skills left out, and the scratchpad, which
 * the patterns below never reach and which is named here so that it stays out if they widen: an experiment is held
 * to this when it graduates into a package. Each is a glob pathspec:
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
  [":!packages/ui/src/components", ":!packages/ui/src/hooks", ":!.agents", `:!${scratchpadFolder}`]
)

/**
 * What `laws tags` finds: nothing, or a refusal and each place a `_tag` is told apart or built by hand.
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
    how: S.String.pipe(
      S.annotateKey({
        description:
          'How: "===" and its kin, "switch", "argument" (a tag handed to a call), "method" (a method of a tag), "key" (a record read by a tag), "literal" (an object built with a _tag key) or "isTagged" (P.isTagged with a tag as a string)'
      })
    )
  },
  Unread: {
    place: S.String.pipe(S.annotateKey({ description: "The file and line the law stopped at, as file:line" })),
    why: S.String.pipe(S.annotateKey({ description: "Why the law did not read the file, in words" }))
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

/** The words for each way a tag is told apart by hand; a comparison is said with its operator. */
const howWords: Readonly<Record<string, string>> = {
  switch: "switch over a _tag",
  argument: "a _tag handed to a call",
  method: "a method called on a _tag",
  key: "a record read by a _tag",
  literal: "an object built with a _tag key: use the case's own constructor or .make",
  isTagged:
    "P.isTagged with a tag as a string: it takes any value, so a misspelled tag compiles. Use the type's guards, match or Match.valueTags"
}

const sayHow = (how: string): string => O.getOrElse(R.get(howWords, how), () => `_tag ${how}`)

/**
 * The line each finding prints.
 *
 * @category rendering
 */
export const tagsSentence: (finding: TagsFinding) => Line = TagsFinding.match({
  Clean: () => out("tags:check OK  no _tag is told apart or built by hand"),
  Refused: () =>
    err(
      "tags:check FAIL  a _tag told apart or built by hand. Use what the type gives: O.isSome or O.match, AsyncResult.isFailure, a tagged enum's $is or $match, a schema union's guards, isAnyOf or match, S.is of one class; build a case with its constructor or .make:"
    ),
  Unlisted: ({ why }) => err(`git could not list the files, so none was checked: ${why}`),
  At: ({ how, place }) => err(`${place}  ${sayHow(how)}`),
  Unread: ({ place, why }) => err(`${place}  ${why}`)
})

/**
 * Reads every file of our own code and every test from the repository's root.
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
  const found = yield* Effect.forEach(
    files,
    (file) =>
      Effect.map(repo.text(repo.join(repo.root, file)), (source) => {
        const read = readTags({ file, source })
        // A file the law did not read is refused once, where it stopped, in words that say why.
        return O.match(read.unread, {
          onNone: () =>
            A.map(read.found, (byHand) =>
              TagsFinding.cases.At.make({ place: `${file}:${byHand.line}`, how: byHand.how })
            ),
          onSome: ({ line, unread }) =>
            A.of(TagsFinding.cases.Unread.make({ place: `${file}:${line}`, why: unreadSentence(unread) }))
        })
      }),
    { concurrency: 1 }
  )
  const problems = A.flatten(found)
  return A.isArrayNonEmpty(problems)
    ? A.prepend<TagsFinding, TagsFinding>(problems, TagsFinding.cases.Refused.make({}))
    : A.of<TagsFinding>(TagsFinding.cases.Clean.make({}))
})
