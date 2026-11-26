// "Suggest what the rules cannot" through the real handlers and SQL, with no key: the rules answer, the suggestions
// are stored once however often they are asked for, nothing about the rows changes until the person accepts one,
// and a viewer cannot ask.
import { expect, layer } from "@effect/vitest"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as HttpApiTest from "effect/http-api/HttpApiTest"
import messy from "../../public/samples/items_messy.csv?raw"
import { Api } from "../../src/api/v1/Api.ts"
import { AnsweredBy } from "@inventory/catalog-contract/Answer"
import { decisionFromFlags } from "@inventory/catalog-contract/Decision"
import { as, TypedApp } from "./support/app.ts"
import { stage } from "./support/files.ts"
import { upload } from "./support/upload.ts"

layer(TypedApp)("suggestions for an import", (it) => {
  it.effect("are stored once, change no row until accepted, and are the same list the view gives the screen", () =>
    Effect.gen(function* () {
      const client = yield* HttpApiTest.groups(Api, ["imports"])
      const marcus = as("mem_marcus")
      const table = yield* stage(new File([messy], "items_messy.csv"))
      const staged = yield* upload({ client, table }).pipe(marcus)
      expect(staged.suggestions).toEqual([])

      const first = yield* client.imports.suggest({ params: { id: staged.id } }).pipe(marcus)
      expect(AnsweredBy.guards.Rules(first.answeredBy)).toBe(true)
      expect(
        A.map(first.made, (s) => (s.kind === "column" ? [] : [s.rowId, s.kind, s.to, s.by.kind, s.confidence]))
      ).toEqual([
        ["row-7", "name", "Nylon Coil", "rule", "low"],
        ["row-83", "name", "Copper Plate 1/4in", "rule", "low"]
      ])
      // The same press again: nothing new is asked or stored.
      const second = yield* client.imports.suggest({ params: { id: staged.id } }).pipe(marcus)
      expect([second.made, second.suggestions]).toEqual([[], first.suggestions])

      const view = yield* client.imports.get({ params: { id: staged.id } }).pipe(marcus)
      expect(view.suggestions).toEqual(first.suggestions)
      // No row moved: the counts are the ones the file was staged with.
      expect(view.progress).toEqual(staged.progress)

      yield* client.imports
        .decide({
          params: { id: staged.id },
          payload: {
            over: {},
            madeOn: { "row-7": view.revision },
            set: { "row-7": decisionFromFlags({ accepted: ["name"] }) },
            clear: []
          }
        })
        .pipe(marcus)
      const accepted = yield* client.imports.get({ params: { id: staged.id } }).pipe(marcus)
      expect([accepted.progress.ready, accepted.progress.cannot]).toEqual([
        staged.progress.ready + 1,
        staged.progress.cannot - 1
      ])
    })
  )
})
