// A save is written only in the opening of the import it names (how many times the import had been confirmed when the
// screen decided). What must not break: a save from another opening, an empty one or one that only clears included,
// writes nothing at all, so neither the draft's revision nor its count of saves moves. Over the in-memory twins; the
// same on D1 is in the app's ConfirmRevision slow test, and through the Worker's fetch in DecidedBeforeConfirm.
import { expect, layer } from "@effect/vitest"
import { decisionFromFlags, type SaveRequest } from "@inventory/catalog-contract/Decision"
import { AlreadyImported } from "@inventory/catalog-contract/ImportRejection"
import { ImportStore } from "@inventory/catalog-model/ImportStore"
import { importsEndpoints } from "@inventory/catalog-model/ImportsHandler"
import { catalogMemory } from "@inventory/catalog-model/Memory"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as SecureRandom from "effect/crypto/SecureRandom"
import * as S from "effect/Schema"
import { as, fiveLines, marcus, stage, tableOf } from "./support.ts"

const App = Layer.mergeAll(catalogMemory(), SecureRandom.layerWebCrypto)

const accept = { "row-2": decisionFromFlags({ accepted: ["uom"] }) }

layer(App)("a save from another opening of the import", (it) => {
  it.effect("is refused, an empty or clear-only one too, and moves neither the revision nor the count of saves", () =>
    Effect.gen(function* () {
      const imports = yield* importsEndpoints
      const store = yield* ImportStore
      const view = yield* stage(tableOf({ fileName: "five.csv", lines: fiveLines })).pipe(as(marcus))
      const params = { id: view.id }
      yield* imports
        .commit({ params, payload: { revision: view.revision, madeOn: {}, set: {}, clear: [] } })
        .pipe(as(marcus))
      const reopened = yield* imports.reopen({ params }).pipe(as(marcus))
      const decide = (payload: SaveRequest) => imports.decide({ params, payload }).pipe(as(marcus))
      // Row 2 decided in this opening, the second: written, and counted as a save.
      yield* decide({ madeOn: { "row-2": reopened.revision }, opening: 1, set: accept, clear: [] })
      const before = yield* imports.get({ params }).pipe(as(marcus))
      const held = yield* store.decisions(marcus.organizationId, view.id)
      const refused = yield* Effect.forEach(
        [
          { madeOn: { "row-2": before.revision }, opening: 0, set: accept, clear: [] },
          { madeOn: { "row-2": before.revision }, opening: 2, set: accept, clear: [] },
          { madeOn: {}, opening: 0, set: {}, clear: [] },
          { madeOn: { "row-2": before.revision }, opening: 0, set: {}, clear: ["row-2"] }
        ],
        (payload) => Effect.flip(decide(payload)),
        { concurrency: 1 }
      )
      const after = yield* imports.get({ params }).pipe(as(marcus))
      const heldAfter = yield* store.decisions(marcus.organizationId, view.id)
      expect([
        A.map(refused, (failure) => S.is(AlreadyImported)(failure)),
        after.revision,
        heldAfter.saves,
        R.get(after.decisions, "row-2")
      ]).toEqual([[true, true, true, true], before.revision, held.saves, O.some(accept["row-2"])])
      expect(held.saves).toBeGreaterThan(0)
    })
  )
})
