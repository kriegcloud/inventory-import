/**
 * No key-shaped string (an OpenRouter or Anthropic key, a PEM private key) is in any file git would commit: tracked
 * files and new files `.gitignore` does not exclude. It names the file and line, never the string. A test that
 * needs a key-shaped value puts it together at run time.
 *
 * "Every file git would commit" is git's answer to give, so this asks git.
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

const pattern = "sk-or-[A-Za-z0-9_-]{16,}|sk-ant-[A-Za-z0-9_-]{16,}|-----BEGIN [A-Z ]*PRIVATE KEY"

const $I = $RepoCliId.create("commands/Laws/Keys.rules")

/**
 * What `laws keys` finds: nothing, or a refusal and each place a key-shaped string is. Never the string.
 *
 * @category schemas
 */
export const KeysFinding = S.TaggedUnion({
  Clean: {},
  Refused: {},
  At: { place: S.String.pipe(S.annotateKey({ description: "The file and line, as file:line" })) }
}).pipe($I.annoteSchema("KeysFinding", { description: "No key-shaped string, or a refusal and each place one is" }))

/**
 * The decoded value of `KeysFinding`.
 *
 * @category models
 */
export type KeysFinding = typeof KeysFinding.Type

/**
 * The line each finding prints.
 *
 * @category rendering
 */
export const keysSentence: (finding: KeysFinding) => Line = KeysFinding.match({
  Clean: () => out("keys:check OK  no key-shaped string in any file git would commit"),
  Refused: () => err("keys:check FAIL  a key-shaped string is in:"),
  At: ({ place }) => err(place)
})

/**
 * Searches the repository from its root.
 *
 * @category rules
 */
export const keys = Effect.fn("Keys.keys")(function* () {
  const repo = yield* Repo
  const answer = yield* repo.run("git", ["grep", "--untracked", "-I", "-n", "-E", pattern, "--", "."])
  const found = A.map(
    A.filter(Str.split("\n")(answer.stdout), (line) => line !== ""),
    (line) => A.join(A.take(Str.split(":")(line), 2), ":")
  )
  return A.isArrayNonEmpty(found)
    ? A.prepend<KeysFinding, KeysFinding>(
        A.map(found, (place) => KeysFinding.cases.At.make({ place })),
        KeysFinding.cases.Refused.make({})
      )
    : A.of<KeysFinding>(KeysFinding.cases.Clean.make({}))
})
