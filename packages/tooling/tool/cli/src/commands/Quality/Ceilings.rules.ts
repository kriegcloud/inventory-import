/**
 * The stage C ceilings of every package with screens add up to at most the number recorded when the exception was
 * split between them (decision "ui-packages brief", (d)): 678. Each package's own check keeps its ceiling equal to
 * its count, so the sum only falls; this keeps a package from raising its own while another's falls.
 *
 * @packageDocumentation
 */
import { $RepoCliId } from "@beep/identity/packages"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as Num from "effect/Number"
import * as S from "effect/Schema"
import * as Str from "effect/String"
import type { RepoError } from "../../Cli.errors.ts"
import { Repo } from "../../Repo.service.ts"
import { StrictCeiling } from "../../Repo.schema.ts"
import { err, type Line, out } from "../../Report.schema.ts"

const $I = $RepoCliId.create("commands/Quality/Ceilings.rules")

/** The sum the ceilings may not pass. */
export const cap = 678

/**
 * What `quality ceilings` finds: each package's ceiling, their sum, and the sum above the cap.
 *
 * @category schemas
 */
export const CeilingsFinding = S.TaggedUnion({
  Ceiling: {
    where: S.String.pipe(S.annotateKey({ description: "The package's folder, from the root" })),
    ceiling: S.Int.pipe(S.annotateKey({ description: "Its recorded ceiling" }))
  },
  Sum: {
    sum: S.Int.pipe(S.annotateKey({ description: "The ceilings added up" })),
    cap: S.Int.pipe(S.annotateKey({ description: "The number the sum may not pass" }))
  },
  AboveCap: {
    sum: S.Int.pipe(S.annotateKey({ description: "The ceilings added up" })),
    cap: S.Int.pipe(S.annotateKey({ description: "The number the sum passed" }))
  }
}).pipe($I.annoteSchema("CeilingsFinding", { description: "A package's ceiling, the sum, or the sum above the cap" }))

/**
 * The decoded value of `CeilingsFinding`.
 *
 * @category models
 */
export type CeilingsFinding = typeof CeilingsFinding.Type

/**
 * The line each finding prints.
 *
 * @category rendering
 */
export const ceilingsSentence: (finding: CeilingsFinding) => Line = CeilingsFinding.match({
  Ceiling: ({ where, ceiling }) => out(`  ${where}: ${ceiling}`),
  Sum: ({ sum, cap: limit }) => out(`ceilings:check  sum ${sum}, cap ${limit}`),
  AboveCap: ({ sum, cap: limit }) => err(`ceilings:check FAIL  the stage C ceilings add up to ${sum}, above ${limit}`)
})

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
  const said = A.append<CeilingsFinding, CeilingsFinding>(
    A.map(rows, (row): CeilingsFinding =>
      CeilingsFinding.cases.Ceiling.make({ where: row.where, ceiling: row.ceiling })
    ),
    CeilingsFinding.cases.Sum.make({ sum, cap })
  )
  return sum > cap
    ? A.append<CeilingsFinding, CeilingsFinding>(said, CeilingsFinding.cases.AboveCap.make({ sum, cap }))
    : said
})
