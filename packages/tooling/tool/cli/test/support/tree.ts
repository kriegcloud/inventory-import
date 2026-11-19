// A rule run on a small repository written to a real temporary folder (decision T8): the files a test names, a root
// package.json with workspaces unless the test writes its own, and the Repo service pointed at one of its folders.
// A test builds its repository per case, so the layer is provided here and not once per file.
// @effect-diagnostics strictEffectProvide:off
import * as NodeServices from "@effect/platform-node/NodeServices"
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Layer from "effect/Layer"
import * as Path from "effect/Path"
import * as A from "effect/Array"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import * as Digest from "effect/crypto/Digest"
import type { RepoError } from "../../src/Cli.errors.ts"
import { Repo } from "../../src/Repo.service.ts"

/** File contents by path from the repository's root. */
export type Tree = Readonly<Record<string, string>>

/** JSON text for a file in a tree. */
// A fixture is written before any Effect runs.
// @effect-diagnostics-next-line schemaSync:off
export const json = (value: unknown): string => S.encodeSync(S.fromJsonString(S.Unknown))(value)

/** Runs `rule` in a repository holding `tree`, started in `cwd` (a path from its root; the root by default). */
// @effect-diagnostics-next-line missingPipeableSignature:off
export const inTree = <A, E>(tree: Tree, rule: Effect.Effect<A, E, Repo>, cwd = "."): Effect.Effect<A, E | RepoError> =>
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
      Effect.provide(Repo.layer({ cwd: path.join(root, cwd) }).pipe(Layer.provide(Digest.layerWebCrypto)))
    )
  }).pipe(Effect.scoped, Effect.provide(NodeServices.layer))

/** A report's lines as plain text, each with the stream it goes to. */
export const printed = (report: { readonly lines: ReadonlyArray<{ readonly to: string; readonly text: string }> }) =>
  A.map(report.lines, (line) => `${line.to}: ${line.text}`)
