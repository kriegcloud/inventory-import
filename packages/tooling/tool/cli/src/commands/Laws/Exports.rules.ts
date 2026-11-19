/**
 * A design-system package's exact exports, held to account (decision "ui-packages brief", (b)). Run from the
 * package's folder. Every file under `src/components` and `src/hooks` has exactly one export entry, and every entry
 * names a file that exists, so a component the shadcn CLI adds cannot be forgotten and no entry points at nothing.
 * Exports are exact everywhere in this repository: no wildcard.
 *
 * @packageDocumentation
 */
import { $RepoCliId } from "@beep/identity/packages"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as P from "effect/Predicate"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import * as Str from "effect/String"
import { Repo } from "../../Repo.service.ts"
import { Manifest } from "../../Repo.schema.ts"
import { err, type Line, out } from "../../Report.schema.ts"

const $I = $RepoCliId.create("commands/Laws/Exports.rules")

/**
 * What `laws exports` finds: the package's exports are exact, or it is refused and each problem follows.
 *
 * @category schemas
 */
export const ExportsFinding = S.TaggedUnion({
  Exact: {
    name: S.String.pipe(S.annotateKey({ description: "The package's name" })),
    entries: S.Int.pipe(S.annotateKey({ description: "How many export entries it has" }))
  },
  Refused: { name: S.String.pipe(S.annotateKey({ description: "The package's name" })) },
  Wildcard: { key: S.String.pipe(S.annotateKey({ description: "The export entry that has a wildcard" })) },
  NamesNoFile: { key: S.String.pipe(S.annotateKey({ description: "The export entry whose target is no file" })) },
  Unlisted: {
    file: S.String.pipe(S.annotateKey({ description: "A component or hook with no export entry, from the package" }))
  }
}).pipe($I.annoteSchema("ExportsFinding", { description: "Exact exports, or a refusal and each problem with them" }))

/**
 * The decoded value of `ExportsFinding`.
 *
 * @category models
 */
export type ExportsFinding = typeof ExportsFinding.Type

/**
 * The line each finding prints.
 *
 * @category rendering
 */
export const exportsSentence: (finding: ExportsFinding) => Line = ExportsFinding.match({
  Exact: ({ name, entries }) => out(`check-exports OK  ${name}: ${entries} exact entries`),
  Refused: ({ name }) => err(`check-exports FAIL  ${name}`),
  Wildcard: ({ key }) => err(`  ${key}: a wildcard export`),
  NamesNoFile: ({ key }) => err(`  ${key}: names no file`),
  Unlisted: ({ file }) => err(`  ${file}: no export entry`)
})

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
      if (Str.includes("*")(key) || Str.includes("*")(String(target)))
        return A.of<ExportsFinding>({ _tag: "Wildcard", key })
      if (!P.isString(target) || !(yield* repo.exists(repo.join(root, target))))
        return A.of<ExportsFinding>({ _tag: "NamesNoFile", key })
      return A.empty<ExportsFinding>()
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
              A.contains(targets, file)
                ? A.empty<ExportsFinding>()
                : A.of<ExportsFinding>({ _tag: "Unlisted", file: repo.relative(root, file) })
            )
          )
        ),
    { concurrency: 1 }
  )
  const problems = A.appendAll(A.flatten(wrong), A.flatten(unlisted))
  const name = String(manifest.name)
  return A.isArrayNonEmpty(problems)
    ? A.prepend<ExportsFinding, ExportsFinding>(problems, { _tag: "Refused", name })
    : A.of<ExportsFinding>({ _tag: "Exact", name, entries: entries.length })
})
