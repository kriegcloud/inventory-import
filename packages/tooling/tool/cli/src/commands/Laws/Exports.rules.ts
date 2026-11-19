/**
 * A design-system package's exact exports, held to account (decision "ui-packages brief", (b)). Run from the
 * package's folder. Every file under `src/components` and `src/hooks` has exactly one export entry, and every entry
 * names a file that exists, so a component the shadcn CLI adds cannot be forgotten and no entry points at nothing.
 * Exports are exact everywhere in this repository: no wildcard.
 *
 * @packageDocumentation
 */
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as P from "effect/Predicate"
import * as R from "effect/Record"
import * as Str from "effect/String"
import { Repo } from "../../Repo.service.ts"
import { Manifest } from "../../Repo.schema.ts"
import { err, failed, out, passed } from "../../Report.schema.ts"

/**
 * Checks the `package.json` of the folder the command was started in.
 *
 * @category rules
 */
export const exactExports = Effect.fn("Exports.exactExports")(function* () {
  const repo = yield* Repo
  const root = repo.cwd
  const manifest = yield* repo.json(Manifest)(repo.join(root, "package.json"))
  const entries = R.toEntries(manifest.exports ?? {})
  const wrong = yield* Effect.forEach(
    entries,
    Effect.fnUntraced(function* ([key, target]) {
      if (Str.includes("*")(key) || Str.includes("*")(String(target))) return A.of<string>(`${key}: a wildcard export`)
      if (!P.isString(target) || !(yield* repo.exists(repo.join(root, target))))
        return A.of<string>(`${key}: names no file`)
      return A.empty<string>()
    }),
    { concurrency: 1 }
  )
  const targets = A.map(entries, ([, target]) => repo.join(root, String(target)))
  const unlisted = yield* Effect.forEach(
    ["src/components", "src/hooks"],
    (folder) =>
      repo
        .files(repo.join(root, folder))
        .pipe(
          Effect.map((files) =>
            A.flatMap(files, (file) =>
              A.contains(targets, file) ? A.empty<string>() : A.of(`${repo.relative(root, file)}: no export entry`)
            )
          )
        ),
    { concurrency: 1 }
  )
  const problems = A.appendAll(A.flatten(wrong), A.flatten(unlisted))
  const name = String(manifest.name)
  return A.isArrayNonEmpty(problems)
    ? failed([err(`check-exports FAIL  ${name}\n  ${A.join(problems, "\n  ")}`)])
    : passed([out(`check-exports OK  ${name}: ${entries.length} exact entries`)])
})
