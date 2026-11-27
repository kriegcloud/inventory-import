// The whole catalog model under Verify, as `packages/catalog/model/test/Catalog.verify.test.ts` runs it, twice: on a
// copy of the package's files (`baseline`), and on the same model written to the module taxonomy (`model`). Each is
// held to its own copy of the package's lock and to the lock's list of rules that must stay proved. Run with CI=true,
// so that nothing is written to a lock and a rule it does not list fails.
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

layer(NodeServices.layer)("the catalog model, written to the module taxonomy", (it) => {
  it.effect(
    "the package's files, copied, are verified against the package's lock",
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
    }),
    3_000_000
  )

  it.effect(
    "with every block in a file of its kind, rules listed by name and defaults on the state, it is verified against the same lock",
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
    }),
    3_000_000
  )
})
