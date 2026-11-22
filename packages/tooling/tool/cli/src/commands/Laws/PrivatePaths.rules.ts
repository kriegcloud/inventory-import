/**
 * Nothing in the scratchpad names a person's machine: no absolute home path (`/home/<name>/`, `/Users/<name>/`,
 * `C:\Users\<name>`) and no private folder an agent or a tool keeps outside the repository (`~/.claude`,
 * `.config/Claude`, notes kept beside a session, a temporary folder of Claude's). The repository is public, and an
 * experiment is where a path copied from a terminal or a fixture lands most easily (decision "the scratchpad",
 * 2026-11-22, answer 3: secrets and private names are still refused there). Key-shaped strings are `laws keys`'s.
 *
 * It names the file and line, never what it found: CI's logs are public too. A real customer's name has no pattern;
 * no list of names exists to refuse, so that part rests on the person.
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
import { RepoError } from "../../Cli.errors.ts"
import { Repo } from "../../Repo.service.ts"
import { scratchpadFolder } from "../../Repo.schema.ts"
import { err, type Line, out } from "../../Report.schema.ts"

const $I = $RepoCliId.create("commands/Laws/PrivatePaths.rules")

/** A home folder of a named person on Linux, macOS or Windows, or a folder kept outside the repository. */
export const privatePath =
  "(^|[^A-Za-z0-9_.-])(/home/[a-z_][a-z0-9_-]*/|/Users/[A-Za-z][A-Za-z0-9._-]*/|[A-Za-z]:[\\\\/]Users[\\\\/][A-Za-z]|~/\\.claude\\b|\\.config/Claude\\b|side-session-notes|claude-tmp/)"

/**
 * What `laws private-paths` finds: nothing, or a refusal and each place one is. Never what was found.
 *
 * @category schemas
 */
export const PrivatePathsFinding = S.TaggedUnion({
  Clean: {},
  Refused: {},
  At: { place: S.String.pipe(S.annotateKey({ description: "The file and line, as file:line" })) }
}).pipe(
  $I.annoteSchema("PrivatePathsFinding", {
    description: "No home path or private folder in the scratchpad, or a refusal and each place one is"
  })
)

/**
 * The decoded value of `PrivatePathsFinding`.
 *
 * @category models
 */
export type PrivatePathsFinding = typeof PrivatePathsFinding.Type

/**
 * The line each finding prints.
 *
 * @category rendering
 */
export const privatePathsSentence: (finding: PrivatePathsFinding) => Line = PrivatePathsFinding.match({
  Clean: () => out("private-paths:check OK  no home path or private folder in any file of the scratchpad"),
  Refused: () =>
    err(
      "private-paths:check FAIL  a home path or a private folder is named in the scratchpad (the repository is public): write a path from the repository's root, or a placeholder, at:"
    ),
  At: ({ place }) => err(place)
})

/**
 * Searches every file of the scratchpad git would commit.
 *
 * @category rules
 */
export const privatePaths = Effect.fn("PrivatePaths.privatePaths")(function* () {
  const repo = yield* Repo
  const answer = yield* repo.run("git", ["grep", "--untracked", "-I", "-n", "-E", privatePath, "--", scratchpadFolder])
  // git grep answers 1 when nothing matched; anything above is git failing, which is no answer.
  if (answer.code > 1) {
    return yield* RepoError.make({
      path: "git grep",
      message: `git could not search ${scratchpadFolder}/: ${Str.trim(answer.stderr)}`
    })
  }
  const found = A.map(
    A.filter(Str.split("\n")(answer.stdout), (line) => line !== ""),
    (line) => A.join(A.take(Str.split(":")(line), 2), ":")
  )
  return A.isArrayNonEmpty(found)
    ? A.prepend<PrivatePathsFinding, PrivatePathsFinding>(
        A.map(found, (place) => PrivatePathsFinding.cases.At.make({ place })),
        PrivatePathsFinding.cases.Refused.make({})
      )
    : A.of<PrivatePathsFinding>(PrivatePathsFinding.cases.Clean.make({}))
})
