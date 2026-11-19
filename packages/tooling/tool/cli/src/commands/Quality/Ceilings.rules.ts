/**
 * The stage C ceilings of every package with screens add up to at most the number recorded when the exception was
 * split between them (decision "ui-packages brief", (d)): 678. Each package's own check keeps its ceiling equal to
 * its count, so the sum only falls; this keeps a package from raising its own while another's falls.
 *
 * @packageDocumentation
 */
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as Num from "effect/Number"
import * as Str from "effect/String"
import type { RepoError } from "../../Cli.errors.ts"
import { Repo } from "../../Repo.service.ts"
import { StrictCeiling } from "../../Repo.schema.ts"
import { err, failed, out, passed } from "../../Report.schema.ts"

/** The sum the ceilings may not pass. */
export const cap = 678

/**
 * Reads every `strict-ceiling.json` under `apps` and `packages` (at most four folders deep) and reports each, their
 * sum, and whether the sum is above the cap.
 *
 * @category rules
 */
export const ceilings = Effect.fn("Ceilings.ceilings")(function* () {
  const repo = yield* Repo
  const readCeiling = repo.json(StrictCeiling)
  const walk: (dir: string, depth: number) => Effect.Effect<ReadonlyArray<string>, RepoError> = Effect.fn(
    "Ceilings.walk"
  )(function* (dir: string, depth: number) {
    if (depth > 3) return A.empty<string>()
    const entries = yield* repo.entries(dir)
    const nested = yield* Effect.forEach(
      A.filter(
        entries,
        (entry) => entry.directory && entry.name !== "node_modules" && !Str.startsWith(".")(entry.name)
      ),
      Effect.fnUntraced(function* (entry) {
        const file = repo.join(entry.path, "strict-ceiling.json")
        const present = yield* repo.exists(file)
        const below = yield* walk(entry.path, depth + 1)
        return A.appendAll(present ? A.of(file) : A.empty<string>(), below)
      }),
      { concurrency: 1 }
    )
    return A.flatten(nested)
  })
  const inApps = yield* walk(repo.join(repo.root, "apps"), 0)
  const inPackages = yield* walk(repo.join(repo.root, "packages"), 0)
  const found = A.appendAll(inApps, inPackages)
  const rows = yield* Effect.forEach(
    found,
    (file) =>
      readCeiling(file).pipe(
        Effect.map((ceiling) => ({ where: repo.relative(repo.root, repo.dirname(file)), ceiling: ceiling.ceiling }))
      ),
    { concurrency: 1 }
  )
  const sum = Num.sumAll(A.map(rows, (row) => row.ceiling))
  const lines = A.append(
    A.map(rows, (row) => out(`  ${row.where}: ${row.ceiling}`)),
    out(`ceilings:check  sum ${sum}, cap ${cap}`)
  )
  return sum > cap
    ? failed(A.append(lines, err(`ceilings:check FAIL  the stage C ceilings add up to ${sum}, above ${cap}`)))
    : passed(lines)
})
