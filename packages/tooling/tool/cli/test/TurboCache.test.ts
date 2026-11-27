// What turbo's results rest on once they are shared between the workstation and CI (goals/ci-speed), read from the
// files turbo reads. A result stored on one machine is replayed on another, so each line here is one where a wrong
// setting shares a secret or replays a result that is no longer true, and nothing else in the check would say so:
// a build's stored files never hold the workstation's `.dev.vars`; the root depends on no workspace, which would put
// that workspace's source into every task's hash; and the one Node every task runs under is in every hash.
import * as NodeServices from "@effect/platform-node/NodeServices"
import { expect, layer } from "@effect/vitest"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import * as Str from "effect/String"
import * as Digest from "effect/crypto/Digest"
import { Repo } from "../src/Repo.service.ts"
import { decodeJsonc } from "../src/Sync.rules.ts"

const here = Repo.layer().pipe(Layer.provide(Digest.layerWebCrypto), Layer.provide(NodeServices.layer))

/** A list of globs, or none where the key is not written. */
const Globs = S.String.pipe(S.Array, S.OptionFromOptionalKey)

const Task = S.Struct({ outputs: Globs })

/** A turbo.json, as far as these rules read it. */
const TurboFile = S.Struct({
  global: S.Struct({ inputs: Globs }).pipe(S.OptionFromOptionalKey),
  tasks: S.Record(S.String, Task)
})

const Manifest = S.Struct({
  dependencies: S.OptionFromOptionalKey(S.Record(S.String, S.String)),
  devDependencies: S.OptionFromOptionalKey(S.Record(S.String, S.String))
})

/** Every turbo.json: the root's, and each workspace's that has one. */
const turboFiles = Effect.gen(function* () {
  const repo = yield* Repo
  const workspaces = yield* repo.workspaces
  const candidates = A.map([repo.root, ...A.map(workspaces, (workspace) => workspace.dir)], (dir) =>
    repo.join(dir, "turbo.json")
  )
  const present = yield* Effect.filter(candidates, (path) => repo.exists(path), { concurrency: 1 })
  return yield* Effect.forEach(
    present,
    (path) =>
      Effect.gen(function* () {
        const file = repo.relative(path, repo.root)
        const source = yield* repo.text(path)
        const decoded = yield* decodeJsonc(TurboFile)(file, source)
        return { file, decoded }
      }),
    { concurrency: 1 }
  )
})

/** The files that hold a machine's secrets, wherever a build copies them under `dist`. */
const secretFiles = ["!dist/**/.dev.vars", "!dist/**/.dev.vars.*", "!dist/**/.env", "!dist/**/.env.*"]

layer(here)("turbo's results, shared between machines", (it) => {
  it.effect("no task that stores files under dist stores a .dev.vars or a .env with them", () =>
    Effect.gen(function* () {
      const files = yield* turboFiles
      const storing = A.flatMap(files, ({ file, decoded }) =>
        A.flatMap(R.toEntries(decoded.tasks), ([name, task]) => {
          const outputs = task.outputs.pipe(O.toArray, A.flatten)
          return A.some(outputs, (output) => !Str.startsWith("!")(output) && Str.includes("dist")(output))
            ? [{ task: `${file} ${name}`, missing: A.filter(secretFiles, (line) => !A.contains(outputs, line)) }]
            : []
        })
      )
      // The app's build is one of them: were the list empty, the rule would hold nothing.
      expect(A.map(storing, (one) => one.task)).toContain("turbo.json build")
      expect(A.filter(storing, (one) => one.missing.length > 0)).toEqual([])
    })
  )

  it.effect("the root depends on no workspace, so no package's source is in every task's hash", () =>
    Effect.gen(function* () {
      const repo = yield* Repo
      const source = yield* repo.text(repo.join(repo.root, "package.json"))
      const root = yield* decodeJsonc(Manifest)("package.json", source)
      const asked = A.flatMap([root.dependencies, root.devDependencies], (block) =>
        A.flatMap(O.toArray(block), R.toEntries)
      )
      expect(A.filter(asked, ([, spec]) => Str.startsWith("workspace:")(spec))).toEqual([])
    })
  )

  it.effect("the Node and the bun every task runs under are in every task's hash", () =>
    Effect.gen(function* () {
      const repo = yield* Repo
      const files = yield* turboFiles
      const inputs = A.flatMap(files, ({ file, decoded }) =>
        file === "turbo.json"
          ? decoded.global.pipe(
              O.flatMap((global) => global.inputs),
              O.toArray,
              A.flatten
            )
          : []
      )
      expect(A.filter([".tool-versions", ".bun-version"], (pin) => !A.contains(inputs, pin))).toEqual([])
      // One exact version: a range or a major would let two machines run two Nodes under one hash.
      const pin = yield* repo.text(repo.join(repo.root, ".tool-versions"))
      expect(pin).toMatch(/^node \d+\.\d+\.\d+\n$/)
    })
  )
})
