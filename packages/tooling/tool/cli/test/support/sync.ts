// A sync command run four times on one small repository: a check that names what differs, a write, a second check
// that finds nothing left, and a second write that changes nothing. The files a test names are read back after the
// first write, so it holds the text the command left, not only what it said.
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as R from "effect/Record"
import type { RepoError } from "../../src/Cli.errors.ts"
import { Repo } from "../../src/Repo.service.ts"
import { type Line, render } from "../../src/Report.schema.ts"
import type { Mode } from "../../src/Sync.schema.ts"
import { inTree, printed, type Tree } from "./tree.ts"

/** What the four runs printed, whether the first check failed, and the files as the write left them. */
export interface Cycle {
  readonly before: ReadonlyArray<string>
  readonly failed: boolean
  readonly written: ReadonlyArray<string>
  readonly after: ReadonlyArray<string>
  readonly again: ReadonlyArray<string>
  readonly files: Readonly<Record<string, string>>
}

/** Runs `command` as check, write, check, write in a repository holding `tree`, and reads `files` back. */
export const cycle = <Finding>(options: {
  readonly tree: Tree
  readonly command: (mode: Mode) => Effect.Effect<ReadonlyArray<Finding>, RepoError, Repo>
  readonly sentence: (finding: Finding) => Line
  readonly files?: ReadonlyArray<string>
}): Effect.Effect<Cycle, RepoError> =>
  inTree(
    options.tree,
    Effect.gen(function* () {
      const repo = yield* Repo
      const say = render(options.sentence)
      const before = yield* Effect.map(options.command("check"), say)
      const written = yield* Effect.map(options.command("write"), say)
      const texts = yield* Effect.forEach(
        options.files ?? [],
        (file) => Effect.map(repo.text(repo.join(repo.root, file)), (text) => [file, text] as const),
        { concurrency: 1 }
      )
      const after = yield* Effect.map(options.command("check"), say)
      const again = yield* Effect.map(options.command("write"), say)
      return {
        before: printed(before),
        failed: before.failed,
        written: printed(written),
        after: printed(after),
        again: printed(again),
        files: R.fromEntries(texts)
      }
    })
  )

/** Lines of text as one file, ending with a line break. */
export const lines = (all: ReadonlyArray<string>): string => `${A.join(all, "\n")}\n`
