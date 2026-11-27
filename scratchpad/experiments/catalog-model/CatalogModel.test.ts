// The whole catalog model under Verify, as `packages/catalog/model/test/Catalog.verify.test.ts` runs it, twice: on a
// copy of the package's files (`baseline`), and on the same model written to the module taxonomy (`model`). Each is
// held to its own copy of the package's lock and to the lock's list of rules that must stay proved. The test gives
// Verify `CI=true` through its own ConfigProvider, whatever the caller's environment, so nothing is written to a lock
// and a rule the lock does not list fails; after each report the copy is compared byte for byte with the package's
// lock.
import { Story } from "@alchemy.run/domain/Story"
import * as Verify from "@alchemy.run/domain/Verify"
import * as NodeServices from "@effect/platform-node/NodeServices"
import { expect, layer } from "@effect/vitest"
import * as A from "effect/Array"
import * as ConfigProvider from "effect/ConfigProvider"
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Layer from "effect/Layer"
import * as Path from "effect/Path"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import { CatalogApi as BaselineApi } from "./baseline/Catalog.api.ts"
import { Catalog as Baseline } from "./baseline/Catalog.model.ts"
import { CatalogApi as ModelApi } from "./model/Catalog.api.ts"
import { Catalog as Model } from "./model/Catalog.model.ts"

const LockFile = S.fromJsonString(
  S.Struct({
    version: S.Literal(1),
    rules: S.Record(S.String, S.Record(S.String, S.Struct({ kind: S.String, source: S.String })))
  })
)

const provedKinds = ["invariant", "transition", "relation"]

const packageLock = new URL("../../../packages/catalog/model/test/Catalog.lock.json", import.meta.url)

/** The text of a lock file. */
const lockText = Effect.fnUntraced(function* (lock: URL) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const file = yield* path.fromFileUrl(lock)
  return yield* fs.readFileString(file)
}, Effect.orDie)

/** The rules a variant's lock keeps that must stay proved. */
const lockedProved = Effect.fnUntraced(function* (lock: URL) {
  const read = yield* lockText(lock).pipe(Effect.flatMap(S.decodeEffect(LockFile)))
  const rules = yield* Effect.fromOption(R.get(read.rules, "Catalog"))
  return A.map(
    A.filter(R.toEntries(rules), ([, rule]) => A.contains(provedKinds, rule.kind)),
    ([name]) => name
  )
}, Effect.orDie)

const DEPTH = 3

const UnderCi = Layer.mergeAll(NodeServices.layer, ConfigProvider.layer(ConfigProvider.fromUnknown({ CI: "true" })))

layer(UnderCi)("the catalog model, written to the module taxonomy", (it) => {
  it.effect(
    "the package's files, copied, are verified under CI against a copy of the package's lock, left byte-equal to it",
    Effect.fnUntraced(function* () {
      const lock = new URL("./baseline/Catalog.lock.json", import.meta.url)
      const proved = yield* lockedProved(lock)
      expect(proved.length).toBe(134)
      const report = yield* Verify.report(Baseline, {
        apis: [BaselineApi],
        story: Story.make(Baseline),
        source: new URL("./baseline/Catalog.model.ts", import.meta.url),
        depth: DEPTH,
        lock,
        require: { proved }
      })
      const said = Verify.render(report)
      expect(report.explored.depth, said).toBe(DEPTH)
      expect(report.undone, said).toEqual([])
      expect(Verify.verified(report), said).toBe(true)
      expect(report.relocked, said).toEqual([])
      const [copy, original] = yield* Effect.all([lockText(lock), lockText(packageLock)], { concurrency: 1 })
      expect(copy).toBe(original)
    }),
    3_000_000
  )

  it.effect(
    "with every block in a file of its kind, rules listed by name and defaults on the state, it is verified the same",
    Effect.fnUntraced(function* () {
      const lock = new URL("./model/Catalog.lock.json", import.meta.url)
      const proved = yield* lockedProved(lock)
      expect(proved.length).toBe(134)
      const report = yield* Verify.report(Model, {
        apis: [ModelApi],
        story: Story.make(Model),
        source: new URL("./model/Catalog.model.ts", import.meta.url),
        depth: DEPTH,
        lock,
        require: { proved }
      })
      const said = Verify.render(report)
      expect(report.explored.depth, said).toBe(DEPTH)
      expect(report.undone, said).toEqual([])
      expect(Verify.verified(report), said).toBe(true)
      expect(report.relocked, said).toEqual([])
      const [copy, original] = yield* Effect.all([lockText(lock), lockText(packageLock)], { concurrency: 1 })
      expect(copy).toBe(original)
    }),
    3_000_000
  )
})
