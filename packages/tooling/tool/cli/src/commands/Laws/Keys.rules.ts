/**
 * No key-shaped string (an OpenRouter or Anthropic key, a PEM private key) is in any file git would commit: tracked
 * files and new files `.gitignore` does not exclude. It names the file and line, never the string. A test that
 * needs a key-shaped value puts it together at run time.
 *
 * "Every file git would commit" is git's answer to give, so this asks git.
 *
 * @packageDocumentation
 */
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as Str from "effect/String"
import { Repo } from "../../Repo.service.ts"
import { err, failed, out, passed } from "../../Report.schema.ts"

const pattern = "sk-or-[A-Za-z0-9_-]{16,}|sk-ant-[A-Za-z0-9_-]{16,}|-----BEGIN [A-Z ]*PRIVATE KEY"

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
    ? failed([err(`keys:check FAIL  a key-shaped string is in:\n${A.join(found, "\n")}`)])
    : passed([out("keys:check OK  no key-shaped string in any file git would commit")])
})
