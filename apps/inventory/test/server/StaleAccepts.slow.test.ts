// A save and a confirm name the revision of the draft their decisions were made on, and the server does not apply
// an accept made before its field's column was matched again (DECISIONS.md: "Server refuses, screen says so"). On
// the real handlers and SQL, a fresh D1: the save applies the rest and names the accept; the confirm writes nothing.
import { expect, layer } from "@effect/vitest"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as Str from "effect/String"
import * as HttpApiTest from "effect/http-api/HttpApiTest"
import messy from "../../public/samples/items_messy.csv?raw"
import { Api } from "../../src/api/v1/Api.ts"
import { decisionFromFlags } from "@inventory/catalog-contract/Decision"
import { as, TypedApp } from "./support/app.ts"
import { stage } from "./support/files.ts"
import { upload } from "./support/upload.ts"

layer(TypedApp)("an accept made before its field's column was matched again", (it) => {
  it.effect(
    "is not applied by a save, which applies the rest and names it; and a confirm that carries it writes nothing",
    () =>
      Effect.gen(function* () {
        const client = yield* HttpApiTest.groups(Api, ["imports", "items"])
        const marcus = as("mem_marcus")
        const dana = as("mem_dana")
        const staged = yield* upload({ client, table: yield* stage(new File([messy], "items_messy.csv")) }).pipe(marcus)
        const params = { id: staged.id }
        // Dana matches the unit cost's column again (the same column, chosen by hand): the draft moves on.
        const table = yield* client.imports.table({ params }).pipe(dana)
        const cost = O.getOrThrow(
          A.findFirst(table.columns, (column) => Str.includes("cost")(Str.toLowerCase(column.label)))
        )
        const matched = yield* client.imports
          .match({ params, payload: { field: "unitCost", column: O.some(cost.index) } })
          .pipe(dana)
        expect(matched.revision).toBeGreaterThan(staged.revision)

        // Marcus's screen still holds the import as it was staged. He accepts row 55's cost and undoes row 18's unit.
        const mine = {
          "row-55": decisionFromFlags({ accepted: ["unitCost"] }),
          "row-18": decisionFromFlags({ reverted: ["uom"] })
        }
        const saved = yield* client.imports
          .decide({ params, payload: { madeOn: R.map(mine, () => staged.revision), set: mine, clear: [] } })
          .pipe(marcus)
        expect([saved.changed, saved.notApplied]).toEqual([true, [{ rowId: "row-55", field: "unitCost" }]])
        const after = yield* client.imports.get({ params }).pipe(marcus)
        expect([R.get(after.decisions, "row-55"), R.get(after.decisions, "row-18")]).toEqual([
          O.some(decisionFromFlags({})),
          O.some(mine["row-18"])
        ])

        // A confirm that carries the same accept, made on the same older revision: nothing is written.
        const refused = yield* Effect.flip(
          client.imports
            .commit({
              params,
              payload: {
                revision: after.revision,
                madeOn: { "row-55": staged.revision },
                set: { "row-55": mine["row-55"] },
                clear: []
              }
            })
            .pipe(marcus)
        )
        expect([refused._tag, refused._tag === "AcceptsTakenBack" ? refused.accepts : []]).toEqual([
          "AcceptsTakenBack",
          [{ rowId: "row-55", field: "unitCost" }]
        ])
        const still = yield* client.imports.get({ params }).pipe(marcus)
        expect([still.status, still.revision]).toEqual(["open", after.revision])
        expect((yield* client.items.list().pipe(marcus)).length).toBe(0)

        // Made on the draft as it is now, the accept is applied.
        const again = yield* client.imports
          .decide({
            params,
            payload: { madeOn: { "row-55": still.revision }, set: { "row-55": mine["row-55"] }, clear: [] }
          })
          .pipe(marcus)
        expect([again.changed, again.notApplied]).toEqual([true, []])
      })
  )
})
