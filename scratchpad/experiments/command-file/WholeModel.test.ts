// The whole catalog model under Verify, as `packages/catalog/model/test/Catalog.verify.test.ts` runs it, three times: on a
// copy of the package's files (`model-baseline`) and on that copy with `MatchColumn`, its event, its decide, the
// rejections it shares and the import's state in files of their own, and every decision importing them from there
// (`model-split`), and on the copy with only the command, its event and the shared rejections moved and every
// decide left in the aggregate (`model-split-command`), the shape decision 1 chose. Each is held to its own copy of the package's lock and to the lock's list of rules that must stay
// proved. Run with CI=true, so that nothing is written to a lock and a rule it does not list fails.
import { Story } from "@alchemy.run/domain/Story"
import * as Verify from "@alchemy.run/domain/Verify"
import * as NodeServices from "@effect/platform-node/NodeServices"
import { expect, layer } from "@effect/vitest"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Path from "effect/Path"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import { CatalogApi as BaselineApi } from "./model-baseline/Catalog.api.ts"
import { Catalog as Baseline } from "./model-baseline/Catalog.model.ts"
import { CatalogApi as SplitApi } from "./model-split/Catalog.api.ts"
import { Catalog as Split } from "./model-split/Catalog.model.ts"
import { CatalogApi as SplitCommandApi } from "./model-split-command/Catalog.api.ts"
import { Catalog as SplitCommand } from "./model-split-command/Catalog.model.ts"

const LockFile = S.fromJsonString(
  S.Struct({
    version: S.Literal(1),
    rules: S.Record(S.String, S.Record(S.String, S.Struct({ kind: S.String, source: S.String })))
  })
)

const provedKinds = ["invariant", "transition", "relation"]

/** The rules a variant's lock keeps that must stay proved. */
const lockedProved = Effect.fnUntraced(function* (lock: URL) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const file = yield* path.fromFileUrl(lock)
  const read = yield* fs.readFileString(file).pipe(Effect.flatMap(S.decodeEffect(LockFile)))
  const rules = yield* Effect.fromOption(R.get(read.rules, "Catalog"))
  return A.map(
    A.filter(R.toEntries(rules), ([, rule]) => A.contains(provedKinds, rule.kind)),
    ([name]) => name
  )
}, Effect.orDie)

const DEPTH = 3

layer(NodeServices.layer)("command-file, the whole model", (it) => {
  it.effect(
    "the package's files, copied, are verified against the package's lock",
    Effect.fnUntraced(function* () {
      const lock = new URL("./model-baseline/Catalog.lock.json", import.meta.url)
      const proved = yield* lockedProved(lock)
      expect(proved.length).toBe(134)
      const report = yield* Verify.report(Baseline, {
        apis: [BaselineApi],
        story: Story.make(Baseline),
        source: new URL("./model-baseline/Catalog.model.ts", import.meta.url),
        depth: DEPTH,
        lock,
        require: { proved }
      })
      const said = Verify.render(report)
      expect(report.explored.depth, said).toBe(DEPTH)
      expect(report.undone, said).toEqual([])
      expect(Verify.verified(report), said).toBe(true)
      expect(report.relocked, said).toEqual([])
    }),
    3_000_000
  )

  it.effect(
    "with a command, its decide and the state in files of their own, the model is verified against the same lock",
    Effect.fnUntraced(function* () {
      const lock = new URL("./model-split/Catalog.lock.json", import.meta.url)
      const proved = yield* lockedProved(lock)
      expect(proved.length).toBe(134)
      const report = yield* Verify.report(Split, {
        apis: [SplitApi],
        story: Story.make(Split),
        source: new URL("./model-split/Catalog.model.ts", import.meta.url),
        depth: DEPTH,
        lock,
        require: { proved }
      })
      const said = Verify.render(report)
      expect(report.explored.depth, said).toBe(DEPTH)
      expect(report.undone, said).toEqual([])
      expect(Verify.verified(report), said).toBe(true)
      expect(report.relocked, said).toEqual([])
    }),
    3_000_000
  )

  it.effect(
    "with a command, its event and the shared rejections in files of their own and decide left in the aggregate, the model is verified against the same lock",
    Effect.fnUntraced(function* () {
      const lock = new URL("./model-split-command/Catalog.lock.json", import.meta.url)
      const proved = yield* lockedProved(lock)
      expect(proved.length).toBe(134)
      const report = yield* Verify.report(SplitCommand, {
        apis: [SplitCommandApi],
        story: Story.make(SplitCommand),
        source: new URL("./model-split-command/Catalog.model.ts", import.meta.url),
        depth: DEPTH,
        lock,
        require: { proved }
      })
      const said = Verify.render(report)
      expect(report.explored.depth, said).toBe(DEPTH)
      expect(report.undone, said).toEqual([])
      expect(Verify.verified(report), said).toBe(true)
      expect(report.relocked, said).toEqual([])
    }),
    3_000_000
  )
})
