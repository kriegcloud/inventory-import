// A rule run on a small repository written to a real temporary folder (decision T8): the files a test names, a root
// package.json with workspaces unless the test writes its own, and the Repo service pointed at one of its folders.
// A test builds its repository per case, so its services are built here, for that case, and not once per file.
import * as NodeServices from "@effect/platform-node/NodeServices"
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Layer from "effect/Layer"
import * as Path from "effect/Path"
import * as A from "effect/Array"
import { dual } from "effect/Function"
import * as R from "effect/Record"
import * as Result from "effect/Result"
import * as S from "effect/Schema"
import * as Digest from "effect/crypto/Digest"
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner"
import type { RepoError } from "../../src/Cli.errors.ts"
import { Repo } from "../../src/Repo.service.ts"

/** File contents by path from the repository's root. */
export type Tree = Readonly<Record<string, string>>

/** JSON text for a file in a tree, written before any Effect runs: a value a test gives is always JSON. */
export const json = (value: unknown): string =>
  S.encodeUnknownResult(S.fromJsonString(S.Unknown))(value).pipe(Result.getOrThrow)

/** What a rule may ask for: the repository, and a process of its own. */
type Rule<A, E> = Effect.Effect<A, E, Repo | ChildProcessSpawner.ChildProcessSpawner>

/** Gives `effect` what `layer` makes, built for this run and let go when it ends. */
const built =
  <ROut, E2, R2>(layer: Layer.Layer<ROut, E2, R2>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>) =>
    Layer.build(layer).pipe(
      Effect.flatMap((context) => Effect.provideContext(effect, context)),
      Effect.scoped
    )

/**
 * Runs `rule` in a repository holding `tree`, started in `cwd` (a path from its root; the root by default). A rule may
 * start a process of its own too.
 */
export const inTree: {
  <A, E>(rule: Rule<A, E>, cwd?: string): (tree: Tree) => Effect.Effect<A, E | RepoError>
  <A, E>(tree: Tree, rule: Rule<A, E>, cwd?: string): Effect.Effect<A, E | RepoError>
} = dual(
  (args) => !Effect.isEffect(args[0]),
  <A, E>(tree: Tree, rule: Rule<A, E>, cwd = "."): Effect.Effect<A, E | RepoError> =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "repo-cli-" }).pipe(Effect.orDie)
      const files = { "package.json": json({ name: "root", workspaces: ["packages/*"] }), ...tree }
      yield* Effect.forEach(
        R.toEntries(files),
        ([file, content]) =>
          fs
            .makeDirectory(path.dirname(path.join(root, file)), { recursive: true })
            .pipe(Effect.andThen(fs.writeFileString(path.join(root, file), content)), Effect.orDie),
        { concurrency: 1, discard: true }
      )
      return yield* rule.pipe(
        built(Repo.layer({ cwd: path.join(root, cwd) }).pipe(Layer.provide(Digest.layerWebCrypto)))
      )
    }).pipe(Effect.scoped, built(NodeServices.layer))
)

/** A report's lines as plain text, each with the stream it goes to. */
export const printed = (report: { readonly lines: ReadonlyArray<{ readonly to: string; readonly text: string }> }) =>
  A.map(report.lines, (line) => `${line.to}: ${line.text}`)
