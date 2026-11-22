/**
 * Every Effect import follows `docs/standards/effect-imports.md`, held to account. The rules are beep-effect's
 * (`standards/effect-laws-v1.md` laws 1 and 2, `.patterns/effect-module-paths.md`); its own checker is a command of
 * the same name in its CLI, and this is the same law.
 *
 * What fails:
 *
 * - `root-barrel`: anything imported or re-exported from `"effect"`;
 * - `nested-barrel`: anything from a folder of modules (`effect/http`, `effect/sql`, ...) or from an
 *   `@effect/<package>` root other than the test runner's;
 * - `alias`: a namespace import whose name is not the module's (A, O, P, R, S, Str, Eq, Bool, F, BI, Regex, Num, and
 *   the module's own name for every other), unless that name is already taken in the file;
 * - `named-import`: a value picked by name from a module's own path; only `effect/Function` is imported that way;
 * - `unknown-path`: a path the installed package does not have.
 *
 * It reads code under `apps`, `packages`, `scripts` and `test`, the examples in their comments, and the standing
 * documents. The vendored kit packages (a `vendor.json` at their root) are not this repository's to change and are
 * skipped. With `write`, code that can be repaired mechanically is repaired first; documents are checked, never
 * rewritten: a sentence around an import has to be reworded by a person.
 *
 * @packageDocumentation
 */
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as HashSet from "effect/HashSet"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as Str from "effect/String"
import type { RepoError } from "../../Cli.errors.ts"
import { Repo } from "../../Repo.service.ts"
import { EffectImportsFinding } from "./EffectImports.schema.ts"
import { judgeCode, repairCode } from "./internal/effectImportsCode.ts"
import { type Installed, judgeText, lineOf } from "./internal/effectImportsJudge.ts"

/** The standard shows wrong imports on purpose. */
const standard = "docs/standards/effect-imports.md"

const codeRoots = ["apps", "packages", "scripts", "test"] as const
const extensions = ["ts", "tsx", "mts", "mjs"] as const

/**
 * Checks every file, or only `only` (paths from the folder the command was started in); `write` repairs code first.
 *
 * @category rules
 */
export const effectImports = Effect.fn("EffectImports.effectImports")(function* (
  write: boolean,
  only: ReadonlyArray<string>
) {
  const repo = yield* Repo
  const named = A.map(only, (file) => repo.relative(repo.root, repo.resolve(file)))
  const lines = (text: string) => A.filter(Str.split("\n")(text), (line) => line !== "")
  const tracked = Effect.fn("EffectImports.tracked")(function* (patterns: ReadonlyArray<string>) {
    const answer = yield* repo.run("git", ["ls-files", "--cached", "--others", "--exclude-standard", "--", ...patterns])
    return yield* Effect.filter(lines(answer.stdout), (file) => repo.exists(repo.join(repo.root, file)), {
      concurrency: 1
    })
  })

  // What the installed Effect packages hold: the nearest copy of each, the root's first.
  const manifests = yield* repo.run("git", ["ls-files", "*/package.json"])
  const holders = A.prepend(
    A.map(lines(manifests.stdout), (file) => repo.join(repo.root, repo.dirname(file), "node_modules")),
    repo.join(repo.root, "node_modules")
  )
  const namesIn = Effect.fn("EffectImports.namesIn")(function* (holder: string) {
    const scoped = yield* repo.entries(repo.join(holder, "@effect"))
    const plain = yield* repo.exists(repo.join(holder, "effect", "package.json"))
    return A.appendAll(
      plain ? ["effect"] : [],
      A.map(scoped, (entry) => `@effect/${entry.name}`)
    )
  })
  const perHolder = yield* Effect.forEach(holders, namesIn, { concurrency: 1 })
  const packageNames = A.dedupe(A.flatten(perHolder))
  const dirOf = Effect.fn("EffectImports.dirOf")(function* (name: string) {
    return yield* Effect.findFirst(
      A.map(holders, (holder) => repo.join(holder, name)),
      (dir) => repo.exists(repo.join(dir, "package.json"))
    )
  })
  const distEntries = yield* Effect.forEach(
    packageNames,
    Effect.fnUntraced(function* (name) {
      const dir = yield* dirOf(name)
      if (O.isNone(dir)) return A.empty<readonly [string, HashSet.HashSet<string>]>()
      const files = yield* repo.tree(repo.join(dir.value, "dist"))
      return A.of([name, HashSet.fromIterable(files)] as const)
    }),
    { concurrency: 1 }
  )
  const effectDir = yield* dirOf("effect")
  const functionText = yield* O.match(effectDir, {
    onNone: () => Effect.succeed(""),
    onSome: (dir) => repo.text(repo.join(dir, "dist", "Function.d.ts"))
  })
  const installed: Installed = {
    dist: R.fromEntries(A.flatten(distEntries)),
    functionNames: A.map(
      A.fromIterable(Str.matchAll(/^export (?:declare )?(?:const|function) (\w+)/gm)(functionText)),
      (match) => match[1] ?? ""
    )
  }

  // Which files.
  const vendorRecords = yield* tracked(["*vendor.json"])
  const vendored = A.map(vendorRecords, (file) => `${repo.dirname(file)}/`)
  const isVendored = (file: string) =>
    A.some(vendored, (dir) => Str.startsWith(dir)(file)) || Str.includes("/dist/")(file)
  const inRoots = yield* tracked(
    A.flatMap(codeRoots, (root) => A.map(extensions, (extension) => `${root}/**/*.${extension}`))
  )
  const inScripts = yield* tracked(["scripts/*.mjs", "scripts/*.ts"])
  const wanted = (file: string) => named.length === 0 || A.contains(named, file)
  const codeFiles = A.filter(A.dedupe(A.appendAll(inRoots, inScripts)), (file) => !isVendored(file) && wanted(file))
  // The standing documents: what an agent or a person reads as current guidance. Evidence (docs/session, docs/qa),
  // research and vendored skills are other people's words or a record, and are not rewritten.
  const documents = yield* tracked(["*.md", "docs/**/*.md", ".claude/agents/*.md"])
  const textFiles = A.filter(
    documents,
    (file) =>
      !Str.startsWith("docs/session/")(file) &&
      !Str.startsWith("docs/qa/")(file) &&
      file !== standard &&
      (!Str.includes("/")(file) || Str.startsWith("docs/")(file) || Str.startsWith(".claude/agents/")(file)) &&
      wanted(file)
  )

  const perCode = yield* Effect.forEach(
    codeFiles,
    Effect.fnUntraced(function* (file): Effect.fn.Return<
      { readonly problems: ReadonlyArray<EffectImportsFinding>; readonly changed: boolean },
      RepoError
    > {
      const absolute = repo.join(repo.root, file)
      const original = yield* repo.text(absolute)
      const repaired = write ? repairCode(installed)(file, original) : { text: original, left: [] }
      if (repaired.text !== original) yield* repo.write(absolute, repaired.text)
      const line = lineOf(repaired.text)
      return {
        problems: A.appendAll<EffectImportsFinding, EffectImportsFinding>(
          A.map(repaired.left, (left) => EffectImportsFinding.cases.Left.make({ file, left })),
          A.map(judgeCode(installed)(file, repaired.text), (hit) =>
            EffectImportsFinding.cases.Fault.make({
              file,
              line: line(hit.offset),
              inComment: hit.inComment,
              fault: hit.fault
            })
          )
        ),
        changed: repaired.text !== original
      }
    }),
    { concurrency: 1 }
  )
  const perText = yield* Effect.forEach(
    textFiles,
    (file) =>
      Effect.map(repo.text(repo.join(repo.root, file)), (text) =>
        A.map(judgeText(installed)(text), (hit): EffectImportsFinding =>
          EffectImportsFinding.cases.Fault.make({
            file,
            line: lineOf(text)(hit.offset),
            inComment: hit.inComment,
            fault: hit.fault
          })
        )
      ),
    { concurrency: 1 }
  )
  const files = codeFiles.length + textFiles.length
  const problems = A.appendAll(
    A.flatMap(perCode, (one) => one.problems),
    A.flatten(perText)
  )
  const wrote: ReadonlyArray<EffectImportsFinding> = write
    ? [EffectImportsFinding.cases.Wrote.make({ changed: A.filter(perCode, (one) => one.changed).length, files })]
    : []
  return A.isReadonlyArrayNonEmpty(problems)
    ? A.flatten<ReadonlyArray<ReadonlyArray<EffectImportsFinding>>>([
        wrote,
        [EffectImportsFinding.cases.Refused.make({ problems: problems.length, files })],
        problems
      ])
    : A.append<EffectImportsFinding, EffectImportsFinding>(wrote, EffectImportsFinding.cases.Held.make({ files }))
})
